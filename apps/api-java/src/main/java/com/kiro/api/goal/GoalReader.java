package com.kiro.api.goal;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Read side of goals: every goal list is filtered by {@link GoalAccess#READ} inside SQL. */
@Service
public class GoalReader {
  // Ceiling on the tenant-wide numeric scan used for CHILDREN rollups. Beyond this, child rollups are partial.
  // ponytail: single bounded scan per request, add a materialized rollup if tenants exceed this.
  static final int MAX_TENANT_GOALS = 2000;
  static final int MAX_VISIBLE = 500;
  static final int MAX_ANCESTOR_DEPTH = 20;
  public static final String METHOD = "Progress is computed on read from 0 to 1, or null without data. METRIC: (current - start) / (target - start), clamped. "
      + "TASKS: DONE linked tasks over all linked tasks. CHILDREN: mean of non-cancelled children's progress. "
      + "Expected is the elapsed share of the start-to-due window. Health: CANCELLED, ACHIEVED, NO_DATA, then OFF_TRACK past due, "
      + "then the gap to expected: ON_TRACK up to 10 points behind, AT_RISK up to 25 points behind, otherwise OFF_TRACK. "
      + "The 10 and 25 point thresholds are this product's own convention, not an industry standard. "
      + "Only goals you can read are listed; task counts and child progress are aggregates over the tenant and may include goals you cannot read.";

  private final JdbcTemplate db;

  public GoalReader(JdbcTemplate db) { this.db = db; }

  static LocalDate today() { return LocalDate.now(ZoneOffset.UTC); }

  /** Readable goals only, as goal objects. */
  @Transactional(readOnly = true)
  public List<Map<String, Object>> list(AuthenticatedPrincipal u) {
    return decorate(u, rows(u, "", new Object[0]));
  }

  @Transactional(readOnly = true)
  public Map<String, Object> detail(AuthenticatedPrincipal u, String id) {
    var found = decorate(u, rows(u, " AND g.id=?", id));
    if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found");
    var result = new LinkedHashMap<String, Object>(found.getFirst());
    result.put("checkins", db.queryForList("""
        SELECT c.id,c.author_id,coalesce(au.name,c.author_id) AS author_name,c.value,c.note,c.created_at
        FROM org_goal_checkins c LEFT JOIN users au ON au."tenantId"=c.tenant_id AND au.id=c.author_id
        WHERE c.tenant_id=? AND c.goal_id=? ORDER BY c.created_at DESC,c.id LIMIT 50
        """, u.tenantId(), id));
    result.put("tasks", db.queryForList("""
        SELECT t.id,t.title,t.status,t.assignee_id,t.due_date::text AS due_date,p.name AS project_name
        FROM org_goal_tasks gt JOIN work_tasks t ON t.tenant_id=gt.tenant_id AND t.id=gt.task_id
        JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id AND (""" + com.kiro.api.organization.OrganizationAccess.READ + """
        ) WHERE gt.tenant_id=? AND gt.goal_id=? ORDER BY t.due_date NULLS LAST,t.id LIMIT 100
        """, u.tenantId(), u.id(), u.id(), u.tenantId(), id));
    result.put("children", decorate(u, rows(u, " AND g.parent_id=?", id)));
    result.put("ancestors", ancestors(u, (String) found.getFirst().get("parentId")));
    result.put("method", METHOD);
    return result;
  }

  /** Nearest first. The chain stops at the first ancestor the viewer cannot read. */
  private List<Map<String, Object>> ancestors(AuthenticatedPrincipal u, String parentId) {
    var chain = new ArrayList<Map<String, Object>>();
    var seen = new HashSet<String>();
    String next = parentId;
    while (next != null && chain.size() < MAX_ANCESTOR_DEPTH && seen.add(next)) {
      var parent = decorate(u, rows(u, " AND g.id=?", next));
      if (parent.isEmpty()) break;
      chain.add(parent.getFirst());
      next = (String) parent.getFirst().get("parentId");
    }
    return chain;
  }

  /** Dashboard scope options: what the viewer may create goals for. */
  @Transactional(readOnly = true)
  public Map<String, Object> options(AuthenticatedPrincipal u) {
    String t = u.tenantId();
    boolean companyGoals = db.queryForObject("SELECT count(*) FROM (SELECT ?::text AS user_id) viewer WHERE "
        + GoalAccess.binding("?", "'PROJECT_WRITE','ORG_MANAGE'", "b.scope='COMPANY'"), Long.class, u.id(), t) > 0;
    var departments = db.queryForList("""
        SELECT d.id,d.name FROM org_departments d, (SELECT ?::text AS user_id) viewer WHERE d.tenant_id=? AND """ + " "
        + GoalAccess.binding("d.tenant_id", "'PROJECT_WRITE'", "b.scope='COMPANY' OR (b.scope='DEPARTMENT' AND b.department_id=d.id)")
        + " ORDER BY d.name,d.id LIMIT 500", u.id(), t);
    var teams = db.queryForList("""
        SELECT tm.id,tm.name,tm.department_id FROM org_teams tm, (SELECT ?::text AS user_id) viewer WHERE tm.tenant_id=? AND """ + " "
        + GoalAccess.binding("tm.tenant_id", "'PROJECT_WRITE'", "b.scope='COMPANY' OR (b.scope='DEPARTMENT' AND b.department_id="
            + GoalAccess.teamDeptOf("tm.tenant_id", "tm.id") + ") OR (b.scope='TEAM' AND b.team_id=tm.id)")
        + " ORDER BY tm.name,tm.id LIMIT 500", u.id(), t);
    var people = db.queryForList("""
        SELECT u.id,u.name FROM users u, (SELECT ?::text AS user_id) viewer WHERE u."tenantId"=? AND (u.id=viewer.user_id OR """ + " "
        + GoalAccess.manages("u.\"tenantId\"", "u.id") + " OR "
        + GoalAccess.binding("u.\"tenantId\"", "'PROJECT_WRITE'", "b.scope='COMPANY' OR " + "(" + GoalAccess.ownerTeamCoverage("u.\"tenantId\"", "u.id") + ")")
        + ") ORDER BY u.name,u.id LIMIT 500", u.id(), t);
    var scopes = new ArrayList<String>();
    if (companyGoals) scopes.add("COMPANY");
    if (!departments.isEmpty()) scopes.add("DEPARTMENT");
    if (!teams.isEmpty()) scopes.add("TEAM");
    scopes.add("PERSON");
    var result = new LinkedHashMap<String, Object>();
    result.put("scopes", scopes);
    result.put("departments", departments);
    result.put("teams", teams);
    result.put("people", people);
    return result;
  }

  /** Chat summary: readable goals only. */
  @Transactional(readOnly = true)
  public Map<String, Object> summary(AuthenticatedPrincipal u) {
    var goals = list(u);
    var result = new LinkedHashMap<String, Object>();
    result.put("goals", goals);
    result.put("goalCount", goals.size());
    result.put("calculatedAt", java.time.Instant.now());
    result.put("method", METHOD);
    return result;
  }

  /** Raw readable rows: SELECT list (with canEdit) plus READ, then extra predicate params. */
  List<Map<String, Object>> rows(AuthenticatedPrincipal u, String extra, Object... extraParams) {
    String sql = """
        SELECT g.id,g.scope,g.department_id,g.team_id,g.owner_id,g.parent_id,g.title,g.description,g.measure,g.unit,
          g.start_value,g.target_value,g.current_value,g.start_date::text AS start_date,g.due_date::text AS due_date,
          g.status,g.version,ou.name AS owner_name,
          CASE g.scope WHEN 'COMPANY' THEN 'Company' WHEN 'DEPARTMENT' THEN d.name WHEN 'TEAM' THEN tm.name ELSE ou.name END AS scope_name,
          (""" + GoalAccess.WRITE + """
          ) AS can_edit
        FROM org_goals g
        LEFT JOIN users ou ON ou."tenantId"=g.tenant_id AND ou.id=g.owner_id
        LEFT JOIN org_departments d ON d.tenant_id=g.tenant_id AND d.id=g.department_id
        LEFT JOIN org_teams tm ON tm.tenant_id=g.tenant_id AND tm.id=g.team_id
        WHERE """ + " " + GoalAccess.READ + extra + " " + """
        ORDER BY g.due_date,g.id LIMIT 500
        """;
    var params = new ArrayList<Object>(List.of(u.tenantId(), u.id(), u.tenantId(), u.id()));
    params.addAll(Arrays.asList(extraParams));
    return db.queryForList(sql, params.toArray());
  }

  /** Attaches progress, expected, health and counts computed from the tenant-wide numeric rollup. */
  List<Map<String, Object>> decorate(AuthenticatedPrincipal u, List<Map<String, Object>> visible) {
    if (visible.isEmpty()) return List.of();
    var math = db.queryForList("""
        SELECT g.id,g.parent_id,g.status,g.measure,g.start_value,g.target_value,g.current_value,g.start_date,g.due_date,
          (SELECT count(*) FROM org_goal_tasks gt WHERE gt.tenant_id=g.tenant_id AND gt.goal_id=g.id) AS task_count,
          (SELECT count(*) FROM org_goal_tasks gt JOIN work_tasks t ON t.tenant_id=gt.tenant_id AND t.id=gt.task_id
            WHERE gt.tenant_id=g.tenant_id AND gt.goal_id=g.id AND t.status='DONE') AS done_count,
          (SELECT count(*) FROM org_goals c WHERE c.tenant_id=g.tenant_id AND c.parent_id=g.id AND c.status<>'CANCELLED') AS child_count
        FROM org_goals g WHERE g.tenant_id=? ORDER BY g.id LIMIT""" + " " + MAX_TENANT_GOALS, u.tenantId());
    var progress = GoalRollup.progressById(math);
    var byId = new HashMap<String, Map<String, Object>>();
    for (var m : math) byId.put((String) m.get("id"), m);
    var today = today();
    var result = new ArrayList<Map<String, Object>>();
    for (var row : visible) {
      String id = (String) row.get("id");
      var m = byId.getOrDefault(id, Map.of());
      var start = LocalDate.parse((String) row.get("start_date"));
      var due = LocalDate.parse((String) row.get("due_date"));
      Double p = progress.get(id);
      double expected = GoalProgress.expected(start, due, today);
      int tasks = GoalRollup.num(m, "task_count"), done = GoalRollup.num(m, "done_count");
      var g = new LinkedHashMap<String, Object>();
      g.put("id", id);
      g.put("scope", row.get("scope"));
      g.put("scopeName", row.get("scope_name"));
      g.put("title", row.get("title"));
      g.put("description", row.get("description"));
      g.put("ownerId", row.get("owner_id"));
      g.put("ownerName", row.get("owner_name"));
      g.put("departmentId", row.get("department_id"));
      g.put("teamId", row.get("team_id"));
      g.put("parentId", row.get("parent_id"));
      g.put("measure", row.get("measure"));
      g.put("unit", row.get("unit"));
      g.put("startValue", row.get("start_value"));
      g.put("targetValue", row.get("target_value"));
      g.put("currentValue", row.get("current_value"));
      g.put("startDate", row.get("start_date"));
      g.put("dueDate", row.get("due_date"));
      g.put("status", row.get("status"));
      g.put("progress", p);
      g.put("expected", expected);
      g.put("health", GoalProgress.health((String) row.get("status"), p, expected, due, today));
      g.put("remaining", GoalProgress.remaining((String) row.get("measure"), GoalRollup.dec(row, "start_value"), GoalRollup.dec(row, "target_value"),
          GoalRollup.dec(row, "current_value"), tasks, done));
      g.put("taskCount", tasks);
      g.put("doneTaskCount", done);
      g.put("childCount", GoalRollup.num(m, "child_count"));
      g.put("canEdit", Boolean.TRUE.equals(row.get("can_edit")));
      g.put("mine", u.id().equals(row.get("owner_id")));
      g.put("version", row.get("version"));
      result.add(g);
    }
    return result;
  }
}
