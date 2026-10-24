package com.kiro.api.organization;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrganizationDashboard {
  private final JdbcTemplate db;
  private final OrganizationService org;
  public OrganizationDashboard(JdbcTemplate db,OrganizationService org) { this.db=db;this.org=org; }
  @Transactional(readOnly=true)
  public Map<String,Object> dashboard(AuthenticatedPrincipal u,String view) {
    var views=org.views(u);
    if(!views.contains(view)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Dashboard role is not granted");
    String cte="WITH visible AS (SELECT p.* FROM work_projects p WHERE "+OrganizationAccess.READ+") ";
    Object[] scope={u.tenantId(),u.id(),u.id()};
    String personal=view.equals("EMPLOYEE")?" AND t.assignee_id=?":"";
    Object[] taskScope=view.equals("EMPLOYEE")?new Object[]{u.tenantId(),u.id(),u.id(),u.id()}:scope;
    var result=new LinkedHashMap<String,Object>();result.put("view",view);result.put("availableViews",views);
    result.put("calculatedAt",java.time.Instant.now());
    result.put("method","Current authorized records. Overdue: unfinished and due before today (UTC). Remaining hours sum known estimates only; no availability or utilization is inferred.");
    result.put("metrics",db.queryForMap(cte+"""
      SELECT count(*) AS tasks,count(*) FILTER(WHERE t.status='DONE') AS completed,
      count(*) FILTER(WHERE t.status='BLOCKED') AS blocked,
      count(*) FILTER(WHERE t.status<>'DONE' AND t.due_date<(now() AT TIME ZONE 'UTC')::date) AS overdue,
      count(*) FILTER(WHERE t.status<>'DONE' AND t.remaining_hours IS NULL) AS missing_estimates,
      coalesce(sum(t.remaining_hours) FILTER(WHERE t.status<>'DONE'),0) AS remaining_hours,max(t.updated_at) AS last_updated
      FROM work_tasks t JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id WHERE true
      """+personal,taskScope));
    result.put("tasks",db.queryForList(cte+"""
      SELECT t.id,t.title,t.status,t.due_date,t.remaining_hours,p.name AS project_name
      FROM work_tasks t JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id WHERE t.status<>'DONE'
      """+personal+" ORDER BY t.due_date NULLS LAST,t.id LIMIT 100",taskScope));
    result.put("risks",db.queryForList(cte+"""
      SELECT i.id,i.rule,i.triage_status,i.task_id,t.title,p.name AS project_name,i.detected_at
      FROM work_insights i JOIN visible p ON p.id=i.project_id AND p.tenant_id=i.tenant_id
      JOIN work_tasks t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE i.resolved_at IS NULL
      """+personal+" ORDER BY i.detected_at DESC,i.id LIMIT 100",taskScope));
    if(!view.equals("EMPLOYEE")) {
      result.put("projects",db.queryForList(cte+"""
        SELECT p.id,p.name,p.restricted,count(t.id) AS tasks,count(t.id) FILTER(WHERE t.status='DONE') AS completed,
          count(t.id) FILTER(WHERE t.status='BLOCKED') AS blocked,max(t.updated_at) AS last_updated
        FROM visible p LEFT JOIN work_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id
        GROUP BY p.id,p.name,p.restricted ORDER BY p.name,p.id LIMIT 100
        """,scope));
    }
    if(view.equals("MANAGER")) {
      result.put("workload",db.queryForList(cte+"""
        SELECT t.assignee_id,u.name,count(*) AS tasks,coalesce(sum(t.remaining_hours),0) AS estimated_hours,
          count(*) FILTER(WHERE t.remaining_hours IS NULL) AS missing_estimates
        FROM work_tasks t JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id
        LEFT JOIN users u ON u.id=t.assignee_id AND u."tenantId"=t.tenant_id WHERE t.status<>'DONE'
        GROUP BY t.assignee_id,u.name ORDER BY count(*) DESC,t.assignee_id LIMIT 100
        """,scope));
      result.put("reports",db.queryForList("""
        WITH RECURSIVE reports(id) AS (SELECT employee_id FROM org_reporting_lines WHERE tenant_id=? AND manager_id=? AND revoked_at IS NULL
          UNION SELECT r.employee_id FROM org_reporting_lines r JOIN reports a ON r.manager_id=a.id WHERE r.tenant_id=? AND r.revoked_at IS NULL)
        SELECT u.id,u.name FROM users u JOIN reports r ON r.id=u.id WHERE u."tenantId"=? ORDER BY u.name,u.id LIMIT 100
        """,u.tenantId(),u.id(),u.tenantId(),u.tenantId()));
    }
    if(view.equals("MANAGER") || view.equals("DIRECTOR")) result.put("teams",summary(cte,scope,false));
    if(Set.of("DIRECTOR","VP","CEO").contains(view)) result.put("departments",summary(cte,scope,true));
    if(view.equals("VP")) result.put("resourceGaps",db.queryForList(cte+"""
      SELECT d.id,d.name,count(*) FILTER(WHERE t.assignee_id IS NULL) AS unassigned,
        count(*) FILTER(WHERE t.remaining_hours IS NULL) AS missing_estimates,coalesce(sum(t.remaining_hours),0) AS remaining_hours
      FROM visible p JOIN org_teams ot ON ot.id=p.team_id AND ot.tenant_id=p.tenant_id
      JOIN org_departments d ON d.id=ot.department_id AND d.tenant_id=ot.tenant_id
      JOIN work_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id WHERE t.status<>'DONE'
      GROUP BY d.id,d.name ORDER BY d.name,d.id LIMIT 100
      """,scope));
    if(view.equals("CEO")) result.put("dependencies",db.queryForList(cte+"""
      SELECT t.id,p.name AS dependent_project,pr.name AS prerequisite_project,pre.title,pre.status
      FROM work_dependencies dep JOIN work_tasks t ON t.id=dep.task_id AND t.tenant_id=dep.tenant_id
      JOIN work_tasks pre ON pre.id=dep.depends_on_id AND pre.tenant_id=dep.tenant_id
      JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id
      JOIN visible pr ON pr.id=pre.project_id AND pr.tenant_id=pre.tenant_id
      JOIN org_teams a ON a.id=p.team_id AND a.tenant_id=p.tenant_id
      JOIN org_teams b ON b.id=pr.team_id AND b.tenant_id=pr.tenant_id
      WHERE a.department_id<>b.department_id AND pre.status<>'DONE' ORDER BY p.name,t.id LIMIT 100
      """,scope));
    return result;
  }
  private List<Map<String,Object>> summary(String cte,Object[] scope,boolean department) {
    String group=department?"d":"ot";
    return db.queryForList(cte+"SELECT "+group+".id,"+group+".name,count(DISTINCT p.id) AS projects,count(t.id) AS tasks,"+
      "count(t.id) FILTER(WHERE t.status='BLOCKED') AS blocked,count(t.id) FILTER(WHERE t.status='DONE') AS completed "+
      "FROM visible p JOIN org_teams ot ON ot.id=p.team_id AND ot.tenant_id=p.tenant_id "+
      "JOIN org_departments d ON d.id=ot.department_id AND d.tenant_id=ot.tenant_id "+
      "LEFT JOIN work_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id GROUP BY "+group+".id,"+group+".name ORDER BY "+group+".name,"+group+".id LIMIT 100",scope);
  }
}
