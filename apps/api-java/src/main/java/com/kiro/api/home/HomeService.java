package com.kiro.api.home;

import com.kiro.api.goal.GoalReader;
import com.kiro.api.organization.OrganizationDashboard;
import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Personal home: goals, own tasks and team load, all filtered by the viewer's organization access in SQL. */
@Service
public class HomeService {
  static final List<String> PRIMARY_ORDER = List.of("CEO", "VP", "DIRECTOR", "MANAGER", "EMPLOYEE");
  static final String METHOD = "Goals and tasks you can read. Team basis: REPORTS (everyone in your reporting subtree) when you have reports, "
      + "otherwise TEAMMATES (members of your teams). Team tasks include only projects you can read. Overdue means unfinished and due before today (UTC). "
      + GoalReader.METHOD;
  private static final String READ_PROJECT = com.kiro.api.organization.OrganizationAccess.READ;

  private final JdbcTemplate db;
  private final OrganizationService org;
  private final OrganizationDashboard dashboard;
  private final GoalReader goals;

  public HomeService(JdbcTemplate db, OrganizationService org, OrganizationDashboard dashboard, GoalReader goals) {
    this.db = db;
    this.org = org;
    this.dashboard = dashboard;
    this.goals = goals;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> home(AuthenticatedPrincipal u) {
    var views = org.views(u);
    String primary = PRIMARY_ORDER.stream().filter(views::contains).findFirst().orElse("EMPLOYEE");
    int reportCount = reports(u).size();
    String basis = reportCount > 0 ? "REPORTS" : "TEAMMATES";

    var result = new LinkedHashMap<String, Object>();
    result.put("me", me(u, primary, views, reportCount));
    result.put("goals", goals.list(u));
    result.put("myTasks", myTasks(u));
    result.put("team", Map.of("basis", basis, "people", people(u, basis)));
    result.put("scopeSummary", Map.of("view", primary, "metrics", dashboard.dashboard(u, primary).get("metrics")));
    result.put("generatedAt", Instant.now());
    result.put("method", METHOD);
    return result;
  }

  private Map<String, Object> me(AuthenticatedPrincipal u, String primary, List<String> views, int reportCount) {
    var me = new LinkedHashMap<String, Object>();
    me.put("id", u.id());
    me.put("name", db.queryForObject("SELECT coalesce(name,id) FROM users WHERE \"tenantId\"=? AND id=?", String.class, u.tenantId(), u.id()));
    me.put("primaryView", primary);
    me.put("views", views);
    me.put("teams", org.myTeams(u));
    me.put("reportCount", reportCount);
    return me;
  }

  /** Transitive reports of the viewer. */
  private List<String> reports(AuthenticatedPrincipal u) {
    return db.queryForList(REPORTS_CTE + " SELECT id FROM reports", String.class, u.tenantId(), u.id(), u.tenantId());
  }

  private static final String REPORTS_CTE = """
      WITH RECURSIVE reports(id) AS (
        SELECT r.employee_id FROM org_reporting_lines r WHERE r.tenant_id=? AND r.manager_id=? AND r.revoked_at IS NULL
        UNION SELECT r.employee_id FROM org_reporting_lines r JOIN reports a ON r.manager_id=a.id
          WHERE r.tenant_id=? AND r.revoked_at IS NULL)
      """;

  /** Team population: reports, or teammates (members of the viewer's teams, excluding the viewer). */
  private static final String TEAMMATES_CTE = """
      WITH people(id) AS (SELECT DISTINCT m.user_id FROM org_team_memberships m WHERE m.tenant_id=? AND m.revoked_at IS NULL
        AND m.team_id IN (SELECT x.team_id FROM org_team_memberships x WHERE x.tenant_id=? AND x.user_id=? AND x.revoked_at IS NULL)
        AND m.user_id<>?)
      """;

  private List<Map<String, Object>> myTasks(AuthenticatedPrincipal u) {
    var rows = db.queryForList("""
        SELECT t.id,t.title,t.status,t.due_date::text AS due_date,t.remaining_hours,p.name AS project_name,
          (SELECT coalesce(array_agg(gt.goal_id ORDER BY gt.goal_id),'{}') FROM org_goal_tasks gt
            JOIN org_goals g ON g.tenant_id=gt.tenant_id AND g.id=gt.goal_id
            WHERE gt.tenant_id=t.tenant_id AND gt.task_id=t.id AND (""" + com.kiro.api.goal.GoalAccess.READ + """
          )) AS goal_ids
        FROM work_tasks t JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id AND (""" + READ_PROJECT + """
        )
        WHERE t.tenant_id=? AND t.assignee_id=? AND t.status<>'DONE'
        ORDER BY t.due_date NULLS LAST,t.id LIMIT 100
        """, u.tenantId(), u.id(), u.tenantId(), u.id(), u.id(), u.tenantId(), u.id());
    var result = new ArrayList<Map<String, Object>>();
    for (var row : rows) {
      var t = new LinkedHashMap<String, Object>(row);
      t.put("goalIds", goalIds(row.get("goal_ids")));
      t.remove("goal_ids");
      result.add(t);
    }
    return result;
  }

  private static List<String> goalIds(Object value) {
    if (value instanceof java.sql.Array array) {
      try {
        return Arrays.stream((Object[]) array.getArray()).map(String::valueOf).toList();
      } catch (java.sql.SQLException e) {
        throw new IllegalStateException(e);
      }
    }
    return List.of();
  }

  private List<Map<String, Object>> people(AuthenticatedPrincipal u, String basis) {
    boolean reports = "REPORTS".equals(basis);
    String cte = reports ? REPORTS_CTE + ", people(id) AS (SELECT id FROM reports)" : TEAMMATES_CTE;
    // Parameter order matches the CTE text, then the project READ policy, then the tenant filter.
    Object[] cteParams = reports
        ? new Object[] {u.tenantId(), u.id(), u.tenantId()}
        : new Object[] {u.tenantId(), u.tenantId(), u.id(), u.id()};
    var people = db.queryForList(cte + """
        SELECT u.id,coalesce(u.name,u.id) AS name,
          count(vt.id) FILTER (WHERE vt.status<>'DONE') AS open_tasks,
          count(vt.id) FILTER (WHERE vt.status='IN_PROGRESS') AS in_progress,
          count(vt.id) FILTER (WHERE vt.status='BLOCKED') AS blocked,
          count(vt.id) FILTER (WHERE vt.status<>'DONE' AND vt.due_date<(now() AT TIME ZONE 'UTC')::date) AS overdue
        FROM users u JOIN people pe ON pe.id=u.id
        LEFT JOIN (SELECT t.id,t.assignee_id,t.status,t.due_date FROM work_tasks t
          JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id AND (""" + READ_PROJECT + """
          ) WHERE t.tenant_id=?) vt ON vt.assignee_id=u.id
        WHERE u."tenantId"=?
        GROUP BY u.id,u.name ORDER BY u.name,u.id LIMIT 200
        """, concat(cteParams, u.tenantId(), u.id(), u.id(), u.tenantId(), u.tenantId()));
    var current = currentTasks(u, cte, cteParams);
    var result = new ArrayList<Map<String, Object>>();
    for (var p : people) {
      var person = new LinkedHashMap<String, Object>(p);
      person.put("currentTasks", current.getOrDefault((String) p.get("id"), List.of()));
      result.add(person);
    }
    return result;
  }

  /** Up to three open tasks per person: in-progress first, then earliest due date. */
  private Map<String, List<Map<String, Object>>> currentTasks(AuthenticatedPrincipal u, String cte, Object[] cteParams) {
    var rows = db.queryForList(cte + """
        SELECT x.id,x.title,x.status,x.assignee_id,x.due_date,x.project_name FROM (
          SELECT vt.id,vt.title,vt.status,vt.assignee_id,vt.due_date::text AS due_date,vt.project_name,
            row_number() OVER (PARTITION BY vt.assignee_id ORDER BY (vt.status='IN_PROGRESS') DESC,vt.due_date NULLS LAST,vt.id) AS rn
          FROM (SELECT t.id,t.title,t.status,t.assignee_id,t.due_date,p.name AS project_name FROM work_tasks t
            JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id AND (""" + READ_PROJECT + """
            ) WHERE t.tenant_id=? AND t.status<>'DONE' AND t.assignee_id IN (SELECT id FROM people)) vt
        ) x WHERE x.rn<=3 ORDER BY x.assignee_id,x.rn
        """, concat(cteParams, u.tenantId(), u.id(), u.id(), u.tenantId()));
    var byPerson = new LinkedHashMap<String, List<Map<String, Object>>>();
    for (var r : rows) byPerson.computeIfAbsent((String) r.get("assignee_id"), k -> new ArrayList<>()).add(r);
    return byPerson;
  }

  private static Object[] concat(Object[] head, Object... tail) {
    var all = new ArrayList<Object>(Arrays.asList(head));
    all.addAll(Arrays.asList(tail));
    return all.toArray();
  }
}
