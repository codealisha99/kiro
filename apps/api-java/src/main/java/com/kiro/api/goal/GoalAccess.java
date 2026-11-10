package com.kiro.api.goal;

/**
 * Goal visibility and write rules as SQL predicates. Alias {@code g} is the goal. Every predicate
 * binds two parameters, tenant and viewer id, in that order; the viewer is bound once as
 * {@code (SELECT ?::text AS user_id) viewer} and referenced by name everywhere else.
 */
public final class GoalAccess {
  private GoalAccess() {}

  /** Viewer holds a non-revoked binding (optionally with one of {@code perms}) whose coverage matches. */
  static String binding(String tenant, String perms, String coverage) {
    String join = perms == null ? "" : " JOIN org_role_permissions rp ON rp.tenant_id=b.tenant_id AND rp.role_id=b.role_id";
    String perm = perms == null ? "" : " AND rp.permission IN (" + perms + ")";
    return "EXISTS (SELECT 1 FROM org_role_bindings b" + join + " WHERE b.tenant_id=" + tenant
        + " AND b.user_id=viewer.user_id AND b.revoked_at IS NULL" + perm + " AND (" + coverage + "))";
  }

  /** Person expression lies in the viewer's transitive reporting subtree (UNION dedupes; no depth column). */
  static String manages(String tenant, String person) {
    return "EXISTS (WITH RECURSIVE reports(id) AS ("
        + " SELECT r.employee_id FROM org_reporting_lines r WHERE r.tenant_id=" + tenant
        + " AND r.manager_id=viewer.user_id AND r.revoked_at IS NULL"
        + " UNION SELECT r.employee_id FROM org_reporting_lines r JOIN reports a ON r.manager_id=a.id"
        + " WHERE r.tenant_id=" + tenant + " AND r.revoked_at IS NULL)"
        + " SELECT 1 FROM reports WHERE id=" + person + ")";
  }

  static String teamDeptOf(String tenant, String team) {
    return "(SELECT t.department_id FROM org_teams t WHERE t.tenant_id=" + tenant + " AND t.id=" + team + ")";
  }

  /** Binding coverage for an owner's teams (team or department of any team the owner belongs to). */
  static String ownerTeamCoverage(String tenant, String owner) {
    return "(b.scope='TEAM' AND EXISTS (SELECT 1 FROM org_team_memberships om WHERE om.tenant_id=" + tenant
        + " AND om.user_id=" + owner + " AND om.revoked_at IS NULL AND om.team_id=b.team_id)) OR"
        + " (b.scope='DEPARTMENT' AND EXISTS (SELECT 1 FROM org_team_memberships om"
        + " JOIN org_teams ot ON ot.tenant_id=om.tenant_id AND ot.id=om.team_id"
        + " WHERE om.tenant_id=" + tenant + " AND om.user_id=" + owner
        + " AND om.revoked_at IS NULL AND ot.department_id=b.department_id))";
  }

  private static final String COMPANY = "b.scope='COMPANY'";
  private static final String DEPT_OF_GOAL = "b.scope='DEPARTMENT' AND b.department_id=g.department_id";
  private static final String TEAM_OF_GOAL = "(b.scope='TEAM' AND b.team_id=g.team_id) OR (b.scope='DEPARTMENT' AND b.department_id="
      + teamDeptOf("g.tenant_id", "g.team_id") + ")";

  /** Viewer may read the goal. Owner, company-wide readers, members, managers and bindings each grant read. */
  public static final String READ = String.join(" ",
      "g.tenant_id=? AND EXISTS (SELECT 1 FROM (SELECT ?::text AS user_id) viewer WHERE (",
      "g.owner_id=viewer.user_id",
      "OR " + binding("g.tenant_id", null, COMPANY),
      "OR g.scope='COMPANY'",
      "OR (g.scope='DEPARTMENT' AND (EXISTS (SELECT 1 FROM org_team_memberships m JOIN org_teams t",
      "  ON t.tenant_id=m.tenant_id AND t.id=m.team_id",
      "  WHERE m.tenant_id=g.tenant_id AND m.user_id=viewer.user_id AND m.revoked_at IS NULL AND t.department_id=g.department_id)",
      "  OR " + binding("g.tenant_id", null, DEPT_OF_GOAL) + "))",
      "OR (g.scope='TEAM' AND (EXISTS (SELECT 1 FROM org_team_memberships m WHERE m.tenant_id=g.tenant_id",
      "  AND m.team_id=g.team_id AND m.user_id=viewer.user_id AND m.revoked_at IS NULL)",
      "  OR " + binding("g.tenant_id", null, TEAM_OF_GOAL),
      "  OR EXISTS (SELECT 1 FROM org_team_memberships m WHERE m.tenant_id=g.tenant_id AND m.team_id=g.team_id",
      "    AND m.revoked_at IS NULL AND " + manages("g.tenant_id", "m.user_id") + ")))",
      "OR (g.scope='PERSON' AND (" + manages("g.tenant_id", "g.owner_id"),
      "  OR " + binding("g.tenant_id", null, ownerTeamCoverage("g.tenant_id", "g.owner_id")) + "))))");

  /** Viewer may edit the goal: owner always, otherwise PROJECT_WRITE through a covering binding (see plan). */
  public static final String WRITE = writeRule(true);

  /** Same as WRITE without the owner clause. Creating a non-PERSON goal needs a covering binding, not ownership. */
  public static final String WRITE_BY_BINDING = writeRule(false);

  private static String writeRule(boolean ownerClause) {
    var alternatives = new java.util.ArrayList<String>();
    if (ownerClause) alternatives.add("g.owner_id=viewer.user_id");
    alternatives.add("(g.scope='COMPANY' AND " + binding("g.tenant_id", "'PROJECT_WRITE','ORG_MANAGE'", COMPANY) + ")");
    alternatives.add("(g.scope='DEPARTMENT' AND " + binding("g.tenant_id", "'PROJECT_WRITE'", COMPANY + " OR (" + DEPT_OF_GOAL + ")") + ")");
    alternatives.add("(g.scope='TEAM' AND " + binding("g.tenant_id", "'PROJECT_WRITE'", COMPANY + " OR (" + TEAM_OF_GOAL + ")") + ")");
    alternatives.add("(g.scope='PERSON' AND (" + manages("g.tenant_id", "g.owner_id") + " OR "
        + binding("g.tenant_id", "'PROJECT_WRITE'", COMPANY + " OR (" + ownerTeamCoverage("g.tenant_id", "g.owner_id") + ")") + "))");
    return "g.tenant_id=? AND EXISTS (SELECT 1 FROM (SELECT ?::text AS user_id) viewer WHERE ("
        + String.join(" OR ", alternatives) + "))";
  }
}
