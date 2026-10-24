package com.kiro.api.work;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Transactional
public class PlanningService {
  private final JdbcTemplate db; private final WorkService work; private final ObjectMapper json;
  public PlanningService(JdbcTemplate db,WorkService work,ObjectMapper json) {this.db=db;this.work=work;this.json=json;}
  public record Goal(@NotBlank @Size(max=200) String name,@NotBlank @Size(max=40) String unit,
      @NotNull @DecimalMin("0.01") @DecimalMax("100000000000") BigDecimal target,
      @NotNull @DecimalMin("0") @DecimalMax("100000000000") BigDecimal observed,LocalDate dueDate,
      @NotBlank @Size(max=1000) String rationale,@NotNull @Min(0) Integer expectedVersion) {}
  public record Initiative(@NotBlank @Size(max=200) String name,@Size(max=100) String goalId,@NotBlank @Size(max=1000) String outcome) {}
  public record Milestone(@NotBlank @Size(max=200) String name,@Size(max=100) String initiativeId,@NotNull LocalDate dueDate) {}
  public record TaskPlan(@Size(max=100) String parentTaskId,@Size(max=100) String milestoneId,
      @NotNull @Pattern(regexp="LOW|NORMAL|HIGH|CRITICAL") String priority,@Size(max=100) String requiredSkill,@NotNull @Min(0) Integer expectedVersion) {}
  public record Availability(@NotBlank String userId,@NotNull LocalDate start,@NotNull LocalDate end,
      @NotNull @DecimalMin("0") @DecimalMax("100000") BigDecimal hours,@NotBlank @Size(max=1000) String rationale) {}
  public record Skill(@NotBlank String userId,@NotBlank @Size(max=100) String skill,@NotBlank @Size(max=1000) String evidence) {}
  public record TimeEntry(@NotBlank String taskId,@NotNull LocalDate workedOn,@NotNull @DecimalMin("0.01") @DecimalMax("24") BigDecimal hours,@NotBlank @Size(max=1000) String note) {}
  public record Commitment(@NotBlank String userId,@NotNull LocalDate start,@NotNull LocalDate end,
      @NotNull @DecimalMin("0.01") @DecimalMax("100000") BigDecimal hours,@NotBlank @Size(max=200) String title,
      @NotBlank @Size(max=1000) String rationale,@Size(max=100) String sourceProjectId) {}
  private String id() {return UUID.randomUUID().toString();}
  private ResponseStatusException bad(String message) {return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
  private ResponseStatusException conflict() {return new ResponseStatusException(HttpStatus.CONFLICT,"Planning record changed; refresh before saving");}
  private String optional(String value) {return value==null || value.isBlank()?null:value.trim();}
  private void reference(String table,AuthenticatedPrincipal u,String p,String id) {
    if(id!=null && db.queryForObject("SELECT count(*) FROM "+table+" WHERE tenant_id=? AND project_id=? AND id=?",Long.class,u.tenantId(),p,id)==0)throw bad("Related record must belong to this project");
  }
  private void member(AuthenticatedPrincipal u,String p,String user) {
    if(db.queryForObject("SELECT count(*) FROM work_projects p WHERE "+WorkService.VISIBLE+" AND p.id=?",Long.class,u.tenantId(),user,user,p)==0)throw bad("Person must have access to the project");
  }
  private void event(AuthenticatedPrincipal u,String p,String kind,Object data) {
    try {db.update("INSERT INTO work_events(id,tenant_id,project_id,actor_id,kind,payload) VALUES (?,?,?,?,?,?::jsonb)",id(),u.tenantId(),p,u.id(),kind,json.writeValueAsString(data));}
    catch(com.fasterxml.jackson.core.JsonProcessingException e) {throw new IllegalStateException(e);}
  }
  public Map<String,Object> list(AuthenticatedPrincipal u,String p) {
    work.project(u,p,false);var out=new LinkedHashMap<String,Object>();
    for(String table:List.of("goals","initiatives","milestones","task_planning","availability","commitments","skills","time_entries"))
      out.put(table,db.queryForList("SELECT * FROM work_"+table+" WHERE tenant_id=? AND project_id=?"+
          (table.equals("availability")||table.equals("commitments")?" AND revoked_at IS NULL":table.equals("time_entries")?" AND voided_at IS NULL":"")+
          " ORDER BY "+(table.equals("task_planning")?"task_id":table.equals("skills")?"user_id,skill":"id")+" LIMIT 500",u.tenantId(),p));
    out.put("method","Goals are manually reported observations. Availability is explicitly allocated to this project and period. Lists are limited to 500 records.");
    return out;
  }
  public Object goal(AuthenticatedPrincipal u,String p,String goalId,Goal b) {
    work.project(u,p,true);String key=goalId==null?id():goalId;
    if(goalId==null) {
      if(b.expectedVersion()!=0)throw conflict();
      db.update("INSERT INTO work_goals(id,tenant_id,project_id,name,unit,target,observed,due_date,rationale) VALUES (?,?,?,?,?,?,?,?,?)",key,u.tenantId(),p,b.name().trim(),b.unit().trim(),b.target(),b.observed(),b.dueDate(),b.rationale().trim());
    } else if(db.update("UPDATE work_goals SET name=?,unit=?,target=?,observed=?,due_date=?,rationale=?,version=version+1,updated_at=now() WHERE tenant_id=? AND project_id=? AND id=? AND version=?",b.name().trim(),b.unit().trim(),b.target(),b.observed(),b.dueDate(),b.rationale().trim(),u.tenantId(),p,key,b.expectedVersion())==0)throw conflict();
    event(u,p,"GOAL_RECORDED",Map.of("id",key,"observation",b));return Map.of("id",key);
  }
  public Object initiative(AuthenticatedPrincipal u,String p,Initiative b) {
    work.project(u,p,true);reference("work_goals",u,p,optional(b.goalId()));String key=id();
    db.update("INSERT INTO work_initiatives(id,tenant_id,project_id,goal_id,name,outcome) VALUES (?,?,?,?,?,?)",key,u.tenantId(),p,optional(b.goalId()),b.name().trim(),b.outcome().trim());
    event(u,p,"INITIATIVE_CREATED",Map.of("id",key,"input",b));return Map.of("id",key);
  }
  public Object milestone(AuthenticatedPrincipal u,String p,Milestone b) {
    work.project(u,p,true);reference("work_initiatives",u,p,optional(b.initiativeId()));String key=id();
    db.update("INSERT INTO work_milestones(id,tenant_id,project_id,initiative_id,name,due_date) VALUES (?,?,?,?,?,?)",key,u.tenantId(),p,optional(b.initiativeId()),b.name().trim(),b.dueDate());
    event(u,p,"MILESTONE_CREATED",Map.of("id",key,"input",b));return Map.of("id",key);
  }
  public Object taskPlan(AuthenticatedPrincipal u,String p,String task,TaskPlan b) {
    work.project(u,p,true);reference("work_tasks",u,p,task);reference("work_tasks",u,p,optional(b.parentTaskId()));reference("work_milestones",u,p,optional(b.milestoneId()));
    String parent=optional(b.parentTaskId());
    if(parent!=null && (parent.equals(task) || db.queryForObject("""
      WITH RECURSIVE ancestors(id) AS (SELECT ?::text UNION SELECT q.parent_task_id FROM work_task_planning q JOIN ancestors a ON q.task_id=a.id
        WHERE q.tenant_id=? AND q.project_id=? AND q.parent_task_id IS NOT NULL) SELECT count(*) FROM ancestors WHERE id=?
      """,Long.class,parent,u.tenantId(),p,task)>0))throw bad("Subtask hierarchy cannot contain cycles");
    int changed;
    if(b.expectedVersion()==0)changed=db.update("INSERT INTO work_task_planning(tenant_id,project_id,task_id,parent_task_id,milestone_id,priority,required_skill) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",u.tenantId(),p,task,parent,optional(b.milestoneId()),b.priority(),optional(b.requiredSkill()));
    else changed=db.update("UPDATE work_task_planning SET parent_task_id=?,milestone_id=?,priority=?,required_skill=?,version=version+1 WHERE tenant_id=? AND project_id=? AND task_id=? AND version=?",parent,optional(b.milestoneId()),b.priority(),optional(b.requiredSkill()),u.tenantId(),p,task,b.expectedVersion());
    if(changed==0)throw conflict();event(u,p,"TASK_PLAN_RECORDED",Map.of("taskId",task,"input",b));return Map.of("ok",true);
  }
  public Object availability(AuthenticatedPrincipal u,String p,Availability b) {
    work.project(u,p,true);member(u,p,b.userId());period(b.start(),b.end());
    if(db.queryForObject("SELECT count(*) FROM work_availability WHERE tenant_id=? AND project_id=? AND user_id=? AND revoked_at IS NULL AND period_start<=? AND period_end>=?",Long.class,u.tenantId(),p,b.userId(),b.end(),b.start())>0)throw bad("Availability periods cannot overlap for the same person and project; revoke the previous allocation first");
    if(b.hours().compareTo(BigDecimal.valueOf((java.time.temporal.ChronoUnit.DAYS.between(b.start(),b.end())+1)*24))>0)throw bad("Hours exceed the calendar duration");
    String key=id();db.update("INSERT INTO work_availability(id,tenant_id,project_id,user_id,period_start,period_end,hours,rationale,created_by) VALUES (?,?,?,?,?,?,?,?,?)",key,u.tenantId(),p,b.userId(),b.start(),b.end(),b.hours(),b.rationale(),u.id());
    event(u,p,"AVAILABILITY_DECLARED",Map.of("id",key,"input",b));return Map.of("id",key);
  }
  public Object commitment(AuthenticatedPrincipal u,String p,Commitment b) {
    work.project(u,p,true);member(u,p,b.userId());period(b.start(),b.end());
    if(db.queryForObject("SELECT count(*) FROM work_projects p WHERE "+WorkService.VISIBLE+" AND p.id=?",Long.class,u.tenantId(),u.id(),u.id(),p)==0)throw bad("Commitment target must be a project with write access");
    String source=optional(b.sourceProjectId());
    if(source!=null) {
      if(source.equals(p))throw bad("A cross-project commitment must name a different source project");
      if(db.queryForObject("SELECT count(*) FROM work_projects p WHERE "+WorkService.VISIBLE+" AND p.id=?",Long.class,u.tenantId(),u.id(),u.id(),source)==0)throw bad("Source project must be visible to you");
    }
    if(b.hours().compareTo(BigDecimal.valueOf((java.time.temporal.ChronoUnit.DAYS.between(b.start(),b.end())+1)*24))>0)throw bad("Hours exceed the calendar duration");
    if(db.queryForObject("""
        SELECT count(*) FROM (SELECT period_start,period_end FROM work_availability WHERE tenant_id=? AND project_id=? AND user_id=? AND revoked_at IS NULL
          UNION ALL SELECT period_start,period_end FROM work_commitments WHERE tenant_id=? AND project_id=? AND user_id=? AND revoked_at IS NULL) w
        WHERE w.period_start<=? AND w.period_end>=?
        """,Long.class,u.tenantId(),p,b.userId(),u.tenantId(),p,b.userId(),b.end(),b.start())>0)throw bad("Availability periods and commitments cannot overlap for the same person and project; revoke the previous allocation first");
    String key=id();db.update("INSERT INTO work_commitments(id,tenant_id,project_id,user_id,source_project_id,period_start,period_end,hours,title,rationale,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",key,u.tenantId(),p,b.userId(),source,b.start(),b.end(),b.hours(),b.title().trim(),b.rationale().trim(),u.id());
    event(u,p,"COMMITMENT_DECLARED",Map.of("id",key,"input",b));return Map.of("id",key);
  }
  public Object skill(AuthenticatedPrincipal u,String p,Skill b) {
    work.project(u,p,true);member(u,p,b.userId());
    db.update("INSERT INTO work_skills(tenant_id,project_id,user_id,skill,evidence,recorded_by) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,project_id,user_id,skill) DO UPDATE SET evidence=EXCLUDED.evidence,recorded_by=EXCLUDED.recorded_by,updated_at=now()",u.tenantId(),p,b.userId(),b.skill().trim().toLowerCase(Locale.ROOT),b.evidence().trim(),u.id());
    event(u,p,"SKILL_RECORDED",b);return Map.of("ok",true);
  }
  public Object time(AuthenticatedPrincipal u,String p,TimeEntry b) {
    work.project(u,p,true);reference("work_tasks",u,p,b.taskId());
    if(b.workedOn().isAfter(LocalDate.now(java.time.ZoneOffset.UTC)))throw bad("Actual effort cannot be recorded in the future");
    // Serialize a person's time across projects, without disclosing private project details.
    db.queryForList("SELECT id FROM users WHERE id=? AND \"tenantId\"=? FOR UPDATE",u.id(),u.tenantId());
    BigDecimal hours=db.queryForObject("SELECT coalesce(sum(hours),0) FROM work_time_entries WHERE tenant_id=? AND user_id=? AND worked_on=? AND voided_at IS NULL",BigDecimal.class,u.tenantId(),u.id(),b.workedOn());
    if(hours.add(b.hours()).compareTo(BigDecimal.valueOf(24))>0)throw bad("Your recorded hours exceed 24 for that date");
    String key=id();db.update("INSERT INTO work_time_entries(id,tenant_id,project_id,task_id,user_id,worked_on,hours,note) VALUES (?,?,?,?,?,?,?,?)",key,u.tenantId(),p,b.taskId(),u.id(),b.workedOn(),b.hours(),b.note().trim());
    event(u,p,"ACTUAL_EFFORT_RECORDED",Map.of("id",key,"input",b));return Map.of("id",key);
  }
  public Object revoke(AuthenticatedPrincipal u,String p,String kind,String key) {
    work.project(u,p,true);String table,column;
    if(kind.equals("availability")) {table="work_availability";column="revoked_at";}
    else if(kind.equals("time")) {table="work_time_entries";column="voided_at";}
    else if(kind.equals("commitment")) {table="work_commitments";column="revoked_at";} else throw bad("Unknown planning record");
    if(db.update("UPDATE "+table+" SET "+column+"=now() WHERE tenant_id=? AND project_id=? AND id=? AND "+column+" IS NULL",u.tenantId(),p,key)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Planning record not found");
    event(u,p,"PLANNING_RECORD_REVOKED",Map.of("kind",kind,"id",key));return Map.of("ok",true);
  }
  private void period(LocalDate start,LocalDate end) {
    if(end.isBefore(start) || java.time.temporal.ChronoUnit.DAYS.between(start,end)>366)throw bad("Choose an ordered planning period of at most 367 days");
  }
  public Map<String,Object> capacity(AuthenticatedPrincipal u,String p,LocalDate start,LocalDate end) {
    work.project(u,p,false);period(start,end);
    String sql="""
      WITH effort AS (SELECT assignee_id,count(*) AS tasks,count(*) FILTER(WHERE remaining_hours IS NULL) AS missing_estimates,
        count(*) FILTER(WHERE due_date IS NULL) AS undated_tasks,coalesce(sum(remaining_hours),0) AS hours
        FROM work_tasks WHERE tenant_id=? AND project_id=? AND status<>'DONE' AND (due_date<=? OR due_date IS NULL) GROUP BY assignee_id),
      allocated AS (SELECT user_id,sum(hours) AS available_hours FROM work_availability
        WHERE tenant_id=? AND project_id=? AND revoked_at IS NULL AND period_start=? AND period_end=? GROUP BY user_id),
      committed AS (SELECT user_id,sum(hours) AS committed_hours FROM work_commitments
        WHERE tenant_id=? AND project_id=? AND revoked_at IS NULL AND period_start<=? AND period_end>=? GROUP BY user_id),
      committed_cross AS (SELECT user_id,sum(hours) AS cross_all_hours FROM work_commitments
        WHERE tenant_id=? AND revoked_at IS NULL AND period_start<=? AND period_end>=? GROUP BY user_id),
      people AS (SELECT assignee_id AS id FROM effort UNION SELECT user_id FROM allocated UNION SELECT user_id FROM committed)
      SELECT people.id,u.name,coalesce(e.tasks,0) AS tasks,coalesce(e.missing_estimates,0) AS missing_estimates,
        coalesce(e.undated_tasks,0) AS undated_tasks,coalesce(e.hours,0) AS remaining_hours,
        coalesce(a.available_hours,0) AS available_hours,coalesce(c.committed_hours,0) AS committed_hours,
        coalesce(cr.cross_all_hours,0) AS cross_all_hours,
        CASE WHEN coalesce(a.available_hours,0)+coalesce(c.committed_hours,0)>0 AND coalesce(e.missing_estimates,0)=0 AND coalesce(e.undated_tasks,0)=0
          THEN round(100*coalesce(e.hours,0)/(coalesce(a.available_hours,0)+coalesce(c.committed_hours,0)),2) ELSE NULL END AS allocation_load_percent,
        (SELECT coalesce(sum(c2.hours),0) FROM work_commitments c2 JOIN work_projects p ON p.tenant_id=c2.tenant_id AND p.id=c2.project_id
          WHERE c2.tenant_id=? AND c2.revoked_at IS NULL AND c2.period_start<=? AND c2.period_end>=?
            AND c2.user_id=people.id AND c2.project_id<>? AND %s) AS visible_cross_hours
      FROM people LEFT JOIN effort e ON e.assignee_id IS NOT DISTINCT FROM people.id
        LEFT JOIN allocated a ON a.user_id=people.id LEFT JOIN committed c ON c.user_id=people.id
        LEFT JOIN committed_cross cr ON cr.user_id=people.id LEFT JOIN users u ON u.id=people.id AND u."tenantId"=? ORDER BY people.id NULLS LAST
      """;
    var rows=db.queryForList(sql.formatted(WorkService.VISIBLE),
      // effort, allocated, committed, committed_cross
      u.tenantId(),p,end,u.tenantId(),p,start,end,u.tenantId(),p,end,start,u.tenantId(),end,start,
      // visible_cross correlated subquery params: tenant, window, person, project, VISIBLE(tenant,viewer,viewer)
      u.tenantId(),end,start,p,u.tenantId(),u.id(),u.id(),
      // users join
      u.tenantId());
    // Committed hours that stay undisclosed: other than this project and below the reader-only visibility threshold.
    for(Object rowObj:rows) {
      @SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)rowObj;
      BigDecimal crossAll=(BigDecimal)row.getOrDefault("cross_all_hours",BigDecimal.ZERO);
      BigDecimal mine=(BigDecimal)row.getOrDefault("committed_hours",BigDecimal.ZERO);
      BigDecimal visible=(BigDecimal)row.getOrDefault("visible_cross_hours",BigDecimal.ZERO);
      BigDecimal other=crossAll.subtract(mine).subtract(visible).max(BigDecimal.ZERO);
      row.put("other_committed_hours",other);
    }
    var milestones=db.queryForList("""
      SELECT m.id,m.name,m.due_date,count(t.id) AS tasks,count(t.id) FILTER(WHERE t.status='DONE') AS completed,
        count(t.id) FILTER(WHERE t.status='BLOCKED') AS blocked
      FROM work_milestones m LEFT JOIN work_task_planning q ON q.milestone_id=m.id AND q.tenant_id=m.tenant_id
        LEFT JOIN work_tasks t ON t.id=q.task_id AND t.tenant_id=q.tenant_id
      WHERE m.tenant_id=? AND m.project_id=? GROUP BY m.id,m.name,m.due_date ORDER BY m.due_date,m.id
      """,u.tenantId(),p);
    return Map.of("people",rows,"milestones",milestones,"start",start,"end",end,"calculatedAt",java.time.Instant.now(),
      "method","Unfinished project work due by period end, including overdue work. Undated work is counted but prevents a load conclusion. Capacity is availability declared for the exact selected period plus commitments promised to this project; commitments from other projects raise the denominator but are never itemized for projects you cannot read.");
  }
}
