package com.kiro.api.work;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.kiro.api.work.WorkDtos.*;

@Service
@Transactional
public class WorkService {
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final WorkInsightEngine insights;

  public WorkService(JdbcTemplate db, ObjectMapper json, WorkInsightEngine insights) {
    this.db = db; this.json = json; this.insights = insights;
  }

  // Applied inside every list/aggregate query, before data leaves the database.
  static final String VISIBLE = """
      p.tenant_id = ? AND (p.owner_id = ? OR EXISTS (
        SELECT 1 FROM work_project_grants g WHERE g.tenant_id=p.tenant_id
        AND g.project_id=p.id AND g.user_id=? AND g.revoked_at IS NULL))
      """;
  private Object[] scope(AuthenticatedPrincipal u) { return new Object[]{u.tenantId(),u.id(),u.id()}; }
  private String id() { return UUID.randomUUID().toString(); }
  private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Work resource not found"); }

  @Transactional(readOnly=true)
  public List<Map<String,Object>> projects(AuthenticatedPrincipal u, int offset) {
    return db.queryForList("SELECT p.* FROM work_projects p WHERE "+VISIBLE+" ORDER BY p.created_at DESC,p.id LIMIT 100 OFFSET ?",
        u.tenantId(),u.id(),u.id(),offset);
  }

  public Map<String,Object> createProject(AuthenticatedPrincipal u, ProjectInput input) {
    String id=id();
    db.update("INSERT INTO work_projects(id,tenant_id,name,owner_id) VALUES (?,?,?,?)",id,u.tenantId(),input.name().trim(),u.id());
    event(u,id,null,"PROJECT_CREATED",input);
    return project(u,id,false);
  }

  Map<String,Object> project(AuthenticatedPrincipal u, String id, boolean write) {
    // Locking serializes grants/revocation and writes on a project.
    var rows=db.queryForList("SELECT p.* FROM work_projects p WHERE "+VISIBLE+" AND p.id=? FOR UPDATE",
        u.tenantId(),u.id(),u.id(),id);
    if(rows.isEmpty()) throw missing();
    var p=rows.getFirst();
    if(write && !u.id().equals(p.get("owner_id")) && db.queryForObject("""
        SELECT count(*) FROM work_project_grants WHERE tenant_id=? AND project_id=? AND user_id=?
        AND permission='WRITE' AND revoked_at IS NULL
        """,Long.class,u.tenantId(),id,u.id())==0) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Project write access required");
    }
    return p;
  }

  public Map<String,Object> detail(AuthenticatedPrincipal u, String id, int offset) {
    var p=project(u,id,false);
    boolean owner=u.id().equals(p.get("owner_id"));
    p.put("can_manage_access",owner);
    p.put("can_write",owner || db.queryForObject("""
        SELECT count(*) FROM work_project_grants WHERE tenant_id=? AND project_id=? AND user_id=?
        AND permission='WRITE' AND revoked_at IS NULL
        """,Long.class,u.tenantId(),id,u.id())>0);
    return Map.of("project",p,"tasks",db.queryForList("""
        SELECT * FROM work_tasks WHERE tenant_id=? AND project_id=? ORDER BY created_at,id LIMIT 100 OFFSET ?
        """,u.tenantId(),id,offset),"members",db.queryForList("""
        SELECT u.id,u.name FROM users u WHERE u."tenantId"=? AND
        (u.id=? OR EXISTS (SELECT 1 FROM work_project_grants g WHERE g.tenant_id=u."tenantId"
        AND g.user_id=u.id AND g.project_id=? AND g.revoked_at IS NULL)) ORDER BY u.id
        """,u.tenantId(),p.get("owner_id"),id));
  }

  public Map<String,Object> saveTask(AuthenticatedPrincipal u,String projectId,String taskId,TaskInput input) {
    project(u,projectId,true);
    if(input.assigneeId()!=null && !input.assigneeId().isBlank()) {
      long members=db.queryForObject("""
          SELECT count(*) FROM users u JOIN work_projects p ON p.tenant_id=u."tenantId"
          WHERE p.id=? AND p.tenant_id=? AND u.id=? AND (p.owner_id=u.id OR EXISTS (
          SELECT 1 FROM work_project_grants g WHERE g.tenant_id=p.tenant_id AND g.project_id=p.id
          AND g.user_id=u.id AND g.revoked_at IS NULL))
          """,Long.class,projectId,u.tenantId(),input.assigneeId());
      if(members==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Assignee must have project access");
    }
    String assignee=input.assigneeId()==null || input.assigneeId().isBlank()?null:input.assigneeId();
    if(taskId==null) {
      taskId=id();
      db.update("""
          INSERT INTO work_tasks(id,tenant_id,project_id,title,status,assignee_id,remaining_hours,due_date,completed_at)
          VALUES (?,?,?,?,?,?,?,?,CASE WHEN ?='DONE' THEN now() ELSE NULL END)
          """,taskId,u.tenantId(),projectId,input.title().trim(),input.status(),assignee,input.remainingHours(),input.dueDate(),input.status());
    } else {
      if(input.expectedVersion()==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"expectedVersion is required");
      if(db.queryForObject("SELECT count(*) FROM work_tasks WHERE tenant_id=? AND project_id=? AND id=?",
          Long.class,u.tenantId(),projectId,taskId)==0) throw missing();
      int changed=db.update("""
          UPDATE work_tasks SET title=?,status=?,assignee_id=?,remaining_hours=?,due_date=?,
          completed_at=CASE WHEN ?='DONE' THEN COALESCE(completed_at,now()) ELSE NULL END,
          updated_at=now(),version=version+1 WHERE tenant_id=? AND project_id=? AND id=? AND version=?
          """,input.title().trim(),input.status(),assignee,input.remainingHours(),input.dueDate(),input.status(),
          u.tenantId(),projectId,taskId,input.expectedVersion());
      if(changed==0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Task changed; reload before saving");
    }
    var result=db.queryForMap("SELECT * FROM work_tasks WHERE tenant_id=? AND id=?",u.tenantId(),taskId);
    event(u,projectId,taskId,"TASK_SAVED",result);
    insights.refreshProject(u.tenantId(),projectId);
    // Changed source facts require renewed review; resolved conditions retain their triage history.
    int reassessed=db.update("""
        UPDATE work_insights SET triage_status='OPEN',triage_reason=NULL,triaged_by=NULL,triaged_at=NULL,
          triage_version=triage_version+1 WHERE tenant_id=? AND task_id=? AND resolved_at IS NULL
          AND triage_status<>'OPEN'
        """,u.tenantId(),taskId);
    if(reassessed>0) event(u,projectId,taskId,"INSIGHTS_REASSESSED",Map.of("taskVersion",result.get("version"),"count",reassessed));
    return result;
  }

  public Map<String,Object> grant(AuthenticatedPrincipal u,String projectId,GrantInput input,boolean revoke) {
    var p=project(u,projectId,true);
    if(!u.id().equals(p.get("owner_id"))) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the project owner can manage access");
    if(u.id().equals(input.userId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Owner access cannot be changed here");
    if(db.queryForObject("SELECT count(*) FROM users WHERE \"tenantId\"=? AND id=?",Long.class,u.tenantId(),input.userId())==0)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Workspace member not found");
    db.update("UPDATE work_project_grants SET revoked_at=now() WHERE tenant_id=? AND project_id=? AND user_id=? AND revoked_at IS NULL",
        u.tenantId(),projectId,input.userId());
    if(!revoke) db.update("INSERT INTO work_project_grants(id,tenant_id,project_id,user_id,permission,granted_by) VALUES (?,?,?,?,?,?)",
        id(),u.tenantId(),projectId,input.userId(),input.permission(),u.id());
    event(u,projectId,null,revoke?"ACCESS_REVOKED":"ACCESS_GRANTED",input);
    return Map.of("ok",true);
  }

  private Map<String,Object> task(AuthenticatedPrincipal u,String taskId,boolean write) {
    // Authorize before returning any title, status or project identifier.
    var rows=db.queryForList("SELECT t.* FROM work_tasks t JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id WHERE "+
        VISIBLE+" AND t.id=?",u.tenantId(),u.id(),u.id(),taskId);
    if(rows.isEmpty()) throw missing();
    var t=rows.getFirst(); project(u,(String)t.get("project_id"),write); return t;
  }

  public Map<String,Object> dependency(AuthenticatedPrincipal u,String taskId,DependencyInput input) {
    // A tenant lock prevents concurrent edges from creating cycles across projects.
    db.queryForList("SELECT id FROM \"Tenant\" WHERE id=? FOR UPDATE",u.tenantId());
    var t=task(u,taskId,true); task(u,input.dependsOnId(),false);
    long cycle=db.queryForObject("""
        WITH RECURSIVE ancestors(id) AS (
          SELECT ?::text UNION SELECT d.depends_on_id FROM work_dependencies d
          JOIN ancestors a ON d.task_id=a.id WHERE d.tenant_id=?
        ) SELECT count(*) FROM ancestors WHERE id=?
        """,Long.class,input.dependsOnId(),u.tenantId(),taskId);
    if(cycle>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Dependency would form a cycle");
    db.update("""
        INSERT INTO work_dependencies(tenant_id,task_id,depends_on_id,created_by,rationale)
        VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING
        """,u.tenantId(),taskId,input.dependsOnId(),u.id(),input.rationale().trim());
    event(u,(String)t.get("project_id"),taskId,"DEPENDENCY_ADDED",input);
    return Map.of("ok",true);
  }

  public List<Map<String,Object>> impact(AuthenticatedPrincipal u,String taskId) {
    task(u,taskId,false);
    // Traverse only authorized nodes. No hidden paths, counts or names are exposed.
    return db.queryForList("""
        WITH RECURSIVE visible AS (SELECT t.* FROM work_tasks t JOIN work_projects p
          ON p.id=t.project_id AND p.tenant_id=t.tenant_id WHERE
        """+VISIBLE+"""
        ), affected(id) AS (
          SELECT id FROM visible WHERE id=?
          UNION SELECT d.task_id FROM work_dependencies d JOIN affected a ON d.depends_on_id=a.id
          JOIN visible v ON v.id=d.task_id WHERE d.tenant_id=?
        ) SELECT v.* FROM visible v JOIN affected a ON a.id=v.id WHERE v.id<>?
        ORDER BY v.id LIMIT 100
        """,u.tenantId(),u.id(),u.id(),taskId,u.tenantId(),taskId);
  }

  @Transactional(readOnly=true)
  public Map<String,Object> overview(AuthenticatedPrincipal u) {
    var metrics=db.queryForMap("""
        SELECT count(*) AS total_tasks,
          count(*) FILTER (WHERE t.status='DONE') AS completed_tasks,
          count(*) FILTER (WHERE t.status='BLOCKED') AS blocked_tasks,
          count(*) FILTER (WHERE t.status<>'DONE' AND t.due_date < (now() AT TIME ZONE 'UTC')::date) AS overdue_tasks,
          count(*) FILTER (WHERE t.status<>'DONE' AND t.assignee_id IS NULL) AS unassigned_tasks,
          count(*) FILTER (WHERE t.status<>'DONE' AND t.remaining_hours IS NULL) AS missing_estimates,
          COALESCE(sum(t.remaining_hours) FILTER (WHERE t.status<>'DONE'),0) AS estimated_remaining_hours,
          max(t.updated_at) AS last_record_updated_at
        FROM work_tasks t JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id WHERE
        """+VISIBLE,scope(u));
    return Map.of("metrics",metrics,"calculatedAt",java.time.Instant.now(),
        "scope","Projects you own or have an explicit grant to",
        "method","Recorded tasks; overdue means unfinished and due before today (UTC). Hours sum known remaining estimates only.",
        "period","Current recorded state","freshness","Manual records; no external synchronization",
        "utilizationUnavailable","No declared availability or bounded planning period. Utilization cannot be calculated.");
  }

  @Transactional(readOnly=true)
  public List<Map<String,Object>> insightList(AuthenticatedPrincipal u,int offset) {
    return db.queryForList("""
        SELECT i.*,t.title FROM work_insights i JOIN work_projects p ON p.id=i.project_id AND p.tenant_id=i.tenant_id
        JOIN work_tasks t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE
        """+VISIBLE+" ORDER BY i.detected_at DESC,i.id LIMIT 100 OFFSET ?",u.tenantId(),u.id(),u.id(),offset);
  }

  public Map<String,Object> triageInsight(AuthenticatedPrincipal u,String insightId,InsightTriageInput input) {
    var rows=db.queryForList("SELECT i.* FROM work_insights i JOIN work_projects p ON p.id=i.project_id AND p.tenant_id=i.tenant_id WHERE "+
        VISIBLE+" AND i.id=?",u.tenantId(),u.id(),u.id(),insightId);
    if(rows.isEmpty()) throw missing();
    String projectId=(String)rows.getFirst().get("project_id");
    project(u,projectId,true);
    // Same project lock as task saves and rule evaluation; re-read after acquiring it.
    var current=db.queryForMap("SELECT * FROM work_insights WHERE tenant_id=? AND id=?",u.tenantId(),insightId);
    if(current.get("resolved_at")!=null)
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Condition is resolved; refresh insights");
    if(!Objects.equals(current.get("triage_version"),input.expectedVersion()))
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Insight changed; refresh before triaging");
    String reason=input.reason()==null?null:input.reason().trim();
    if("DISMISSED".equals(input.status()) && (reason==null || reason.isEmpty()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A dismissal reason is required");
    db.update("""
        UPDATE work_insights SET triage_status=?,triage_reason=?,triaged_by=?,triaged_at=now(),
          triage_version=triage_version+1 WHERE tenant_id=? AND id=?
        """,input.status(),reason,u.id(),u.tenantId(),insightId);
    var result=db.queryForMap("SELECT * FROM work_insights WHERE tenant_id=? AND id=?",u.tenantId(),insightId);
    event(u,projectId,(String)current.get("task_id"),"INSIGHT_TRIAGED",result);
    return result;
  }

  public List<Map<String,Object>> history(AuthenticatedPrincipal u,String projectId,int offset) {
    project(u,projectId,false);
    return db.queryForList("""
        SELECT e.id,e.kind,e.task_id,e.payload::text AS payload,e.occurred_at FROM work_events e
        WHERE e.tenant_id=? AND e.project_id=? AND (e.kind<>'DEPENDENCY_ADDED' OR EXISTS (
          SELECT 1 FROM work_tasks t JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id
          WHERE t.id=e.payload->>'dependsOnId' AND
        """+VISIBLE+"""
        )) ORDER BY e.occurred_at DESC,e.id LIMIT 100 OFFSET ?
        """,u.tenantId(),projectId,u.tenantId(),u.id(),u.id(),offset);
  }

  public Map<String,Object> scenario(AuthenticatedPrincipal u,String projectId,ScenarioInput input) {
    project(u,projectId,true);
    if(input.periodEnd().isBefore(input.periodStart())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Period end must follow start");
    String scenarioId=id();
    // All unfinished overdue work is included. Undated work makes this analysis incomplete.
    var baseline=db.queryForMap("""
        SELECT COALESCE(sum(remaining_hours),0) AS hours,
          count(*) FILTER (WHERE remaining_hours IS NULL) AS missing,
          count(*) FILTER (WHERE due_date IS NULL) AS undated
        FROM work_tasks WHERE tenant_id=? AND project_id=? AND status<>'DONE' AND (due_date<=? OR due_date IS NULL)
        """,u.tenantId(),projectId,input.periodEnd());
    db.update("""
        INSERT INTO work_scenarios(id,tenant_id,project_id,author_id,name,period_start,period_end,available_hours,
          proposed_hours,rationale,known_remaining_hours,missing_estimates,undated_tasks)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,scenarioId,u.tenantId(),projectId,u.id(),input.name().trim(),input.periodStart(),input.periodEnd(),
        input.availableHours(),input.proposedHours(),input.rationale().trim(),baseline.get("hours"),baseline.get("missing"),baseline.get("undated"));
    db.update("""
        INSERT INTO work_scenario_evidence(tenant_id,scenario_id,task_id,task_version,remaining_hours,due_date)
        SELECT tenant_id,?,id,version,remaining_hours,due_date FROM work_tasks
        WHERE tenant_id=? AND project_id=? AND status<>'DONE' AND (due_date<=? OR due_date IS NULL)
        """,scenarioId,u.tenantId(),projectId,input.periodEnd());
    event(u,projectId,null,"SCENARIO_EVALUATED",Map.of("scenarioId",scenarioId));
    return scenarioResult(u,scenarioId);
  }

  public Map<String,Object> scenarioResult(AuthenticatedPrincipal u,String scenarioId) {
    var rows=db.queryForList("SELECT s.* FROM work_scenarios s JOIN work_projects p ON p.id=s.project_id AND p.tenant_id=s.tenant_id WHERE "+
        VISIBLE+" AND s.id=?",u.tenantId(),u.id(),u.id(),scenarioId);
    if(rows.isEmpty()) throw missing();
    var result=rows.getFirst();
    boolean complete=((Number)result.get("missing_estimates")).intValue()==0 && ((Number)result.get("undated_tasks")).intValue()==0;
    var baseline=(java.math.BigDecimal)result.get("known_remaining_hours");
    var proposed=(java.math.BigDecimal)result.get("proposed_hours");
    var available=(java.math.BigDecimal)result.get("available_hours");
    result.put("assessment",complete?(baseline.add(proposed).compareTo(available)>0?"EXCEEDS_ASSUMED_CAPACITY":"WITHIN_ASSUMED_CAPACITY"):"INSUFFICIENT_DATA");
    result.put("remaining_assumed_hours",complete?available.subtract(baseline).subtract(proposed):null);
    result.put("method","Known unfinished project effort due by period end, including overdue work, plus proposed effort versus assumed available hours. Undated tasks or missing estimates prevent a capacity conclusion.");
    result.put("limitations","What-if estimate, not a forecast or employee utilization measure. Availability is user-declared for this project and period; other projects, skills, sequencing and leave are not modeled.");
    result.put("evidence",db.queryForList("SELECT task_id,task_version,remaining_hours,due_date FROM work_scenario_evidence WHERE tenant_id=? AND scenario_id=? ORDER BY task_id",
        u.tenantId(),scenarioId));
    return result;
  }

  private void event(AuthenticatedPrincipal u,String projectId,String taskId,String kind,Object payload) {
    try {
      db.update("INSERT INTO work_events(id,tenant_id,project_id,actor_id,kind,task_id,payload) VALUES (?,?,?,?,?,?,?::jsonb)",
          id(),u.tenantId(),projectId,u.id(),kind,taskId,json.writeValueAsString(payload));
      db.update("UPDATE work_projects SET updated_at=now() WHERE tenant_id=? AND id=?",u.tenantId(),projectId);
    } catch(JsonProcessingException e) { throw new IllegalStateException("Could not record work history",e); }
  }
}
