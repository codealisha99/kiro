package com.kiro.api.organization;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Deterministic departmental and historical work metrics. Every figure is computed only from recorded data inside the caller's authorized scope; missing inputs stay null. */
@Service
public class OrganizationMetrics {
  private final JdbcTemplate db;private final OrganizationService org;

  public OrganizationMetrics(JdbcTemplate db,OrganizationService org) {this.db=db;this.org=org;}

  @Transactional(readOnly=true)
  public Map<String,Object> metrics(AuthenticatedPrincipal u,Integer weeksParam) {
    int weeks=weeksParam==null?8:weeksParam;
    if(weeks<1||weeks>12) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"weeks must be between 1 and 12");
    Object[] scope={u.tenantId(),u.id(),u.id()};
    int shift=weeks-1;
    String cte="WITH visible AS (SELECT p.* FROM work_projects p WHERE "+OrganizationAccess.READ+"),\n"+
      "win AS (SELECT (date_trunc('week',(now() AT TIME ZONE 'UTC'))::date - "+shift+"*7) AS window_start)\n";
    var result=new LinkedHashMap<String,Object>();
    result.put("generatedAt",Instant.now());
    result.put("weeks",weeks);
    result.put("method","Metrics use only recorded data in the authorized scope, over the ISO weeks in the reported window. Throughput counts tasks completed per ISO week. Elapsed delivery time is the median days between task creation and completion for tasks completed in the window. Delivery divides completed tasks that finished by their due date by completed tasks with a due date. Recorded effort sums non-voided time entries; planned capacity prorates declared availability and cross-project commitments across the overlapping days of the window. Effort, allocations and commitments are separate scoped observations, not company-wide employee utilization. Prorating assumes hours are evenly distributed across calendar dates. Missing completion dates leave rates unknown.");
    result.put("summary",summary(cte,scope));
    result.put("weekly",weekly(cte,scope,shift));
    var views=new HashSet<>(org.views(u));
    boolean orgVisible=views.stream().anyMatch(Set.of("MANAGER","DIRECTOR","VP","CEO")::contains);
    if(orgVisible) result.put("teams",breakdown(cte,scope,"ot"));
    if(views.contains("DIRECTOR")||views.contains("VP")||views.contains("CEO")) result.put("departments",breakdown(cte,scope,"d"));
    if(views.contains("MANAGER")) result.put("people",utilization(cte,scope));
    return result;
  }

  private Map<String,Object> summary(String cte,Object[] scope) {
    return db.queryForMap(cte+"""
      SELECT count(*) FILTER (WHERE t.status<>'DONE') AS open_tasks,
        count(*) FILTER (WHERE t.status='BLOCKED') AS blocked,
        count(*) FILTER (WHERE t.status<>'DONE' AND t.due_date<(now() AT TIME ZONE 'UTC')::date) AS overdue,
        count(*) FILTER (WHERE t.status<>'DONE' AND t.remaining_hours IS NULL) AS missing_estimates,
        coalesce(sum(t.remaining_hours) FILTER (WHERE t.status<>'DONE'),0) AS remaining_hours,
        count(*) FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at>=win.window_start) AS completed_window,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (t.completed_at-t.created_at))/86400.0)
          FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at>=win.window_start) AS median_cycle_days,
        count(*) FILTER (WHERE t.status='DONE' AND t.completed_at>=win.window_start AND t.due_date IS NOT NULL
            AND t.due_date>=(t.completed_at AT TIME ZONE 'UTC')::date)::float /
          nullif(count(*) FILTER (WHERE t.status='DONE' AND t.completed_at>=win.window_start AND t.due_date IS NOT NULL),0) AS on_time_rate,
        (SELECT count(*) FROM work_insights i JOIN visible p ON p.id=i.project_id AND p.tenant_id=i.tenant_id WHERE i.resolved_at IS NULL) AS open_insights,
        (SELECT coalesce(sum(e.hours),0) FROM work_time_entries e
          JOIN work_tasks t ON t.id=e.task_id AND t.tenant_id=e.tenant_id
          JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id CROSS JOIN win
          WHERE e.voided_at IS NULL AND e.worked_on>=win.window_start AND e.worked_on<=(now() AT TIME ZONE 'UTC')::date) AS actual_hours,
        (SELECT coalesce(sum(a.hours*((least(a.period_end,(now() AT TIME ZONE 'UTC')::date)-greatest(a.period_start,win.window_start)+1)::float /
              (a.period_end-a.period_start+1))),0)
          FROM work_availability a CROSS JOIN win
          WHERE a.revoked_at IS NULL AND a.period_end>=win.window_start AND a.period_start<=(now() AT TIME ZONE 'UTC')::date
            AND EXISTS(SELECT 1 FROM visible q WHERE q.id=a.project_id AND q.tenant_id=a.tenant_id)) AS allocated_hours,
        (SELECT coalesce(sum(c.hours*((least(c.period_end,(now() AT TIME ZONE 'UTC')::date)-greatest(c.period_start,win.window_start)+1)::float /
              (c.period_end-c.period_start+1))),0)
          FROM work_commitments c CROSS JOIN win
          WHERE c.revoked_at IS NULL AND c.period_end>=win.window_start AND c.period_start<=(now() AT TIME ZONE 'UTC')::date
            AND EXISTS(SELECT 1 FROM visible q WHERE q.id=c.project_id AND q.tenant_id=c.tenant_id)) AS committed_hours
      FROM work_tasks t JOIN visible p ON p.id=t.project_id AND p.tenant_id=t.tenant_id CROSS JOIN win""",scope);
  }

  private List<Map<String,Object>> weekly(String cte,Object[] scope,int shift) {
    return db.queryForList(cte+"""
      , weeks AS (SELECT generate_series(
          date_trunc('week',(now() AT TIME ZONE 'UTC'))::date - $D*7,
          date_trunc('week',(now() AT TIME ZONE 'UTC'))::date,interval '7 days') AS week_start)
      SELECT w.week_start::date AS week_start,count(t.id) AS completed
      FROM weeks w
      LEFT JOIN (work_tasks t JOIN visible q ON q.id=t.project_id AND q.tenant_id=t.tenant_id)
        ON date_trunc('week',(t.completed_at AT TIME ZONE 'UTC'))=w.week_start::timestamp
      GROUP BY w.week_start ORDER BY w.week_start"""
      .replace("$D",String.valueOf(shift)),scope);
  }

  private List<Map<String,Object>> breakdown(String cte,Object[] scope,String group) {
    String join=group.equals("d")
      ?" JOIN org_departments "+group+" ON "+group+".id=ot.department_id AND "+group+".tenant_id=ot.tenant_id":"";
    return db.queryForList(cte+"SELECT "+group+".id,"+group+".name,\n"+
      "  count(DISTINCT p.id) AS projects,count(t.id) AS tasks,\n"+
      "  count(t.id) FILTER (WHERE t.status='DONE') AS completed,\n"+
      "  count(t.id) FILTER (WHERE t.status='DONE' AND t.completed_at>=win.window_start) AS completed_window,\n"+
      "  count(t.id) FILTER (WHERE t.status='BLOCKED') AS blocked,\n"+
      "  count(t.id) FILTER (WHERE t.status<>'DONE' AND t.due_date<(now() AT TIME ZONE 'UTC')::date) AS overdue,\n"+
      "  coalesce(sum(t.remaining_hours) FILTER (WHERE t.status<>'DONE'),0) AS remaining_hours\n"+
      "FROM visible p JOIN org_teams ot ON ot.id=p.team_id AND ot.tenant_id=p.tenant_id"+join+"\n"+
      "LEFT JOIN work_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id CROSS JOIN win\n"+
      "GROUP BY "+group+".id,"+group+".name ORDER BY "+group+".name,"+group+".id LIMIT 100",scope);
  }

  private List<Map<String,Object>> utilization(String cte,Object[] scope) {
    return db.queryForList(cte+"""
      SELECT DISTINCT u.id,u.email,coalesce(u.name,u.email,u.id) AS name,
        (SELECT count(*) FROM work_tasks t JOIN visible q ON q.id=t.project_id AND q.tenant_id=t.tenant_id
          WHERE t.assignee_id=u.id AND t.status<>'DONE') AS open_tasks,
        (SELECT coalesce(sum(t.remaining_hours),0) FROM work_tasks t JOIN visible q ON q.id=t.project_id AND q.tenant_id=t.tenant_id
          WHERE t.assignee_id=u.id AND t.status<>'DONE') AS remaining_hours,
        (SELECT coalesce(sum(e.hours),0) FROM work_time_entries e
          JOIN work_tasks t ON t.id=e.task_id AND t.tenant_id=e.tenant_id
          JOIN visible q ON q.id=t.project_id AND q.tenant_id=t.tenant_id CROSS JOIN win
          WHERE e.user_id=u.id AND e.voided_at IS NULL AND e.worked_on>=win.window_start
            AND e.worked_on<=(now() AT TIME ZONE 'UTC')::date) AS actual_hours,
        (SELECT coalesce(sum(a.hours*((least(a.period_end,(now() AT TIME ZONE 'UTC')::date)-greatest(a.period_start,win.window_start)+1)::float /
              (a.period_end-a.period_start+1))),0)
          FROM work_availability a CROSS JOIN win
          WHERE a.user_id=u.id AND a.revoked_at IS NULL AND a.period_end>=win.window_start
            AND a.period_start<=(now() AT TIME ZONE 'UTC')::date
            AND EXISTS(SELECT 1 FROM visible q WHERE q.id=a.project_id AND q.tenant_id=a.tenant_id)) AS allocated_hours,
        (SELECT coalesce(sum(c.hours*((least(c.period_end,(now() AT TIME ZONE 'UTC')::date)-greatest(c.period_start,win.window_start)+1)::float /
              (c.period_end-c.period_start+1))),0)
          FROM work_commitments c CROSS JOIN win
          WHERE c.user_id=u.id AND c.revoked_at IS NULL AND c.period_end>=win.window_start
            AND c.period_start<=(now() AT TIME ZONE 'UTC')::date
            AND EXISTS(SELECT 1 FROM visible q WHERE q.id=c.project_id AND q.tenant_id=c.tenant_id)) AS committed_hours
      FROM visible p JOIN users u ON u."tenantId"=p.tenant_id
      WHERE p.owner_id=u.id
        OR EXISTS(SELECT 1 FROM work_tasks t WHERE t.project_id=p.id AND t.tenant_id=p.tenant_id AND t.assignee_id=u.id)
        OR EXISTS(SELECT 1 FROM work_availability a WHERE a.project_id=p.id AND a.tenant_id=p.tenant_id AND a.user_id=u.id AND a.revoked_at IS NULL)
        OR EXISTS(SELECT 1 FROM work_commitments c WHERE c.project_id=p.id AND c.tenant_id=p.tenant_id AND c.user_id=u.id AND c.revoked_at IS NULL)
      ORDER BY name,u.id LIMIT 100""",scope);
  }
}
