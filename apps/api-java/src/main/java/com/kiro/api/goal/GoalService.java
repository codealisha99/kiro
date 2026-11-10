package com.kiro.api.goal;

import static com.kiro.api.goal.GoalDtos.*;

import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Goal writes. Each change checks {@link GoalAccess} in SQL against the stored row before and after
 * the change; a refused post-check throws and the transaction rolls back.
 */
@Service
@Transactional
public class GoalService {
  private final JdbcTemplate db;
  private final OrganizationService org;
  private final GoalReader reader;

  public GoalService(JdbcTemplate db, OrganizationService org, GoalReader reader) {
    this.db = db;
    this.org = org;
    this.reader = reader;
  }

  public Map<String, Object> create(AuthenticatedPrincipal u, GoalInput in) {
    if (in.status() != null && !"ACTIVE".equals(in.status())) throw bad("New goals start ACTIVE");
    validate(u, in, null);
    String id = UUID.randomUUID().toString();
    BigDecimal[] metric = metricValues(in);
    db.update("""
        INSERT INTO org_goals(id,tenant_id,scope,department_id,team_id,owner_id,parent_id,title,description,measure,unit,
          start_value,target_value,current_value,start_date,due_date,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')
        """, id, u.tenantId(), in.scope(), scopeDept(in), scopeTeam(in), in.ownerId(), blankToNull(in.parentId()),
        in.title().trim(), blankToNull(in.description()), in.measure(), blankToNull(in.unit()),
        metric[0], metric[1], metric[2], in.startDate(), in.dueDate());
    // Owning a PERSON goal is enough to create it; any other scope needs a covering binding.
    requireWrite(u, id, "PERSON".equals(in.scope()) ? GoalAccess.WRITE : GoalAccess.WRITE_BY_BINDING);
    org.audit(u, "GOAL_CREATED", Map.of("id", id, "scope", in.scope(), "measure", in.measure(), "ownerId", in.ownerId()));
    return view(u, id);
  }

  public Map<String, Object> update(AuthenticatedPrincipal u, String id, GoalInput in) {
    if (in.expectedVersion() == null) throw bad("expectedVersion is required");
    var current = lockedRow(u, id);
    if (!allowed(GoalAccess.WRITE, u, id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Goal edit access required");
    validate(u, in, id);
    String status = in.status() == null ? (String) current.get("status") : in.status();
    BigDecimal[] metric = metricValues(in);
    int updated = db.update("""
        UPDATE org_goals SET scope=?,department_id=?,team_id=?,owner_id=?,parent_id=?,title=?,description=?,measure=?,unit=?,
          start_value=?,target_value=?,current_value=?,start_date=?,due_date=?,status=?,version=version+1,updated_at=now()
        WHERE tenant_id=? AND id=? AND version=?
        """, in.scope(), scopeDept(in), scopeTeam(in), in.ownerId(), blankToNull(in.parentId()), in.title().trim(),
        blankToNull(in.description()), in.measure(), blankToNull(in.unit()), metric[0], metric[1],
        metric[2], in.startDate(), in.dueDate(), status, u.tenantId(), id, in.expectedVersion());
    if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Goal changed; refresh before saving");
    // Owners may edit their goal in place, but moving it to another scope, department, team or owner
    // is the same as creating it there: non-PERSON placement needs a covering binding.
    boolean moved = !Objects.equals(current.get("scope"), in.scope())
        || !Objects.equals(current.get("department_id"), scopeDept(in))
        || !Objects.equals(current.get("team_id"), scopeTeam(in))
        || !Objects.equals(current.get("owner_id"), in.ownerId());
    requireWrite(u, id, moved && !"PERSON".equals(in.scope()) ? GoalAccess.WRITE_BY_BINDING : GoalAccess.WRITE);
    org.audit(u, "GOAL_UPDATED", Map.of("id", id, "scope", in.scope(), "status", status));
    return view(u, id);
  }

  public Map<String, Object> checkin(AuthenticatedPrincipal u, String id, CheckinInput in) {
    lockedRow(u, id);
    if (!allowed(GoalAccess.WRITE, u, id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Goal edit access required");
    String measure = (String) db.queryForObject("SELECT measure FROM org_goals WHERE tenant_id=? AND id=?", String.class, u.tenantId(), id);
    if ("METRIC".equals(measure)) {
      if (in.value() == null) throw bad("Metric check-ins need a value");
      db.update("UPDATE org_goals SET current_value=?,version=version+1,updated_at=now() WHERE tenant_id=? AND id=?",
          in.value(), u.tenantId(), id);
    } else if (in.value() != null) {
      throw bad("Only metric goals take a value");
    }
    db.update("INSERT INTO org_goal_checkins(id,tenant_id,goal_id,author_id,value,note) VALUES (?,?,?,?,?,?)",
        UUID.randomUUID().toString(), u.tenantId(), id, u.id(), in.value(), in.note().trim());
    org.audit(u, "GOAL_CHECKIN", Map.of("goalId", id, "value", String.valueOf(in.value())));
    return view(u, id);
  }

  public Map<String, Object> link(AuthenticatedPrincipal u, String id, TaskLinkInput in) {
    lockedRow(u, id);
    if (!allowed(GoalAccess.WRITE, u, id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Goal edit access required");
    if (in.unlink()) {
      if (db.update("DELETE FROM org_goal_tasks WHERE tenant_id=? AND goal_id=? AND task_id=?", u.tenantId(), id, in.taskId()) == 0)
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task link not found");
      org.audit(u, "GOAL_TASK_UNLINKED", Map.of("goalId", id, "taskId", in.taskId()));
    } else {
      // The linking person must be able to read the task through the project policy.
      if (db.queryForObject("""
          SELECT count(*) FROM work_tasks t JOIN work_projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id
          WHERE t.tenant_id=? AND t.id=? AND (""" + com.kiro.api.organization.OrganizationAccess.READ + ")",
          Long.class, u.tenantId(), in.taskId(), u.tenantId(), u.id(), u.id()) == 0)
        throw bad("Task not found");
      db.update("INSERT INTO org_goal_tasks(tenant_id,goal_id,task_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
          u.tenantId(), id, in.taskId());
      org.audit(u, "GOAL_TASK_LINKED", Map.of("goalId", id, "taskId", in.taskId()));
    }
    return view(u, id);
  }

  private Map<String, Object> view(AuthenticatedPrincipal u, String id) {
    return reader.decorate(u, reader.rows(u, " AND g.id=?", id)).getFirst();
  }

  /** Locks the goal row and enforces READ (404 when unreadable, so existence is not leaked). */
  private Map<String, Object> lockedRow(AuthenticatedPrincipal u, String id) {
    var rows = db.queryForList("SELECT id,status,scope,department_id,team_id,owner_id FROM org_goals WHERE tenant_id=? AND id=? FOR UPDATE", u.tenantId(), id);
    if (rows.isEmpty() || !allowed(GoalAccess.READ, u, id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found");
    return rows.getFirst();
  }

  private boolean allowed(String predicate, AuthenticatedPrincipal u, String id) {
    return db.queryForObject("SELECT count(*) FROM org_goals g WHERE " + predicate + " AND g.id=?", Long.class,
        u.tenantId(), u.id(), id) > 0;
  }

  private void requireWrite(AuthenticatedPrincipal u, String id, String predicate) {
    if (!allowed(predicate, u, id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Goal edit access required");
  }

  /** Scope, reference, measure and date rules. Owner, department, team and parent must belong to the tenant. */
  private void validate(AuthenticatedPrincipal u, GoalInput in, String existingId) {
    switch (in.scope()) {
      case "DEPARTMENT" -> {
        if (in.departmentId() == null || in.teamId() != null) throw bad("Department goals need a department and no team");
        exists("org_departments", u, in.departmentId());
      }
      case "TEAM" -> {
        if (in.teamId() == null || in.departmentId() != null) throw bad("Team goals need a team and no department");
        exists("org_teams", u, in.teamId());
      }
      default -> {
        if (in.departmentId() != null || in.teamId() != null) throw bad("Company and person goals take no department or team");
      }
    }
    if (db.queryForObject("SELECT count(*) FROM users WHERE \"tenantId\"=? AND id=?", Long.class, u.tenantId(), in.ownerId()) == 0)
      throw bad("Workspace member not found");
    if (in.dueDate().isBefore(in.startDate())) throw bad("Due date must be on or after the start date");
    if ("METRIC".equals(in.measure())) {
      if (in.startValue() == null || in.targetValue() == null || in.currentValue() == null)
        throw bad("Metric goals need start, target and current values");
      if (in.targetValue().compareTo(in.startValue()) == 0) throw bad("Target must differ from start");
    }
    if (in.parentId() != null) validateParent(u, in.parentId(), existingId);
  }

  private void validateParent(AuthenticatedPrincipal u, String parentId, String existingId) {
    if (db.queryForObject("SELECT count(*) FROM org_goals g WHERE " + GoalAccess.READ + " AND g.id=?", Long.class,
        u.tenantId(), u.id(), parentId) == 0) throw bad("Parent goal not found");
    if (existingId == null) return;
    // Walk up from the proposed parent; reaching the goal itself would close a cycle.
    Long cycle = db.queryForObject("""
        WITH RECURSIVE anc(id,parent_id) AS (
          SELECT g.id,g.parent_id FROM org_goals g WHERE g.tenant_id=? AND g.id=?
          UNION SELECT g.id,g.parent_id FROM org_goals g JOIN anc a ON g.id=a.parent_id WHERE g.tenant_id=?)
        SELECT count(*) FROM anc WHERE id=?
        """, Long.class, u.tenantId(), parentId, u.tenantId(), existingId);
    if (cycle != null && cycle > 0) throw bad("Goal alignment would create a cycle");
  }

  private void exists(String table, AuthenticatedPrincipal u, String id) {
    if (db.queryForObject("SELECT count(*) FROM " + table + " WHERE tenant_id=? AND id=?", Long.class, u.tenantId(), id) == 0)
      throw bad("Organization resource not found");
  }

  /** Metric values are stored only for METRIC goals; other measures keep them null. */
  private static BigDecimal[] metricValues(GoalInput in) {
    if (!"METRIC".equals(in.measure())) return new BigDecimal[3];
    return new BigDecimal[] {in.startValue(), in.targetValue(), in.currentValue()};
  }

  private static String scopeDept(GoalInput in) { return "DEPARTMENT".equals(in.scope()) ? in.departmentId() : null; }

  private static String scopeTeam(GoalInput in) { return "TEAM".equals(in.scope()) ? in.teamId() : null; }

  private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

  private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
