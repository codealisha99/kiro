package com.kiro.api.organization;

/** One SQL policy shared by work lists, graph traversal, evidence and dashboards. */
public final class OrganizationAccess {
  private OrganizationAccess() {}
  private static String organizational(String permission) {
    return """
      NOT p.restricted AND EXISTS (
        SELECT 1 FROM org_role_bindings b JOIN org_role_permissions rp
          ON rp.role_id=b.role_id AND rp.tenant_id=b.tenant_id
        WHERE b.tenant_id=p.tenant_id AND b.user_id=viewer.user_id AND b.revoked_at IS NULL
          AND rp.permission='%s' AND (b.scope='COMPANY' OR
          (b.scope='TEAM' AND b.team_id=p.team_id) OR (b.scope='DEPARTMENT' AND EXISTS (
            SELECT 1 FROM org_teams ot WHERE ot.tenant_id=p.tenant_id AND ot.id=p.team_id AND ot.department_id=b.department_id))))
      """.formatted(permission);
  }
  public static final String READ = """
      p.tenant_id=? AND (p.owner_id=? OR EXISTS (SELECT 1 FROM (SELECT ?::text AS user_id) viewer WHERE
        EXISTS (SELECT 1 FROM work_project_grants g WHERE g.tenant_id=p.tenant_id AND g.project_id=p.id
          AND g.user_id=viewer.user_id AND g.revoked_at IS NULL)
        OR (NOT p.restricted AND EXISTS (SELECT 1 FROM org_team_memberships m WHERE m.tenant_id=p.tenant_id
          AND m.team_id=p.team_id AND m.user_id=viewer.user_id AND m.revoked_at IS NULL)) OR
      """+organizational("PROJECT_READ")+"))";
  public static final String WRITE = """
      p.tenant_id=? AND (p.owner_id=? OR EXISTS (SELECT 1 FROM (SELECT ?::text AS user_id) viewer WHERE
        EXISTS (SELECT 1 FROM work_project_grants g WHERE g.tenant_id=p.tenant_id AND g.project_id=p.id
          AND g.user_id=viewer.user_id AND g.permission='WRITE' AND g.revoked_at IS NULL) OR
      """+organizational("PROJECT_WRITE")+"))";
}
