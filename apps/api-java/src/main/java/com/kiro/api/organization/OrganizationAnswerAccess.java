package com.kiro.api.organization;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Conservative replay authorization for aggregate answers, including reporting metadata. */
@Service
public class OrganizationAnswerAccess {
  private final JdbcTemplate db;
  public OrganizationAnswerAccess(JdbcTemplate db) { this.db=db; }
  public String fingerprint(AuthenticatedPrincipal u) {
    var parts=new ArrayList<Object>();
    parts.add(List.of(u.tenantId(),u.id(),u.roleUpper()));
    parts.add(db.queryForList("SELECT p.id FROM work_projects p WHERE "+OrganizationAccess.READ+" ORDER BY p.id",
        String.class,u.tenantId(),u.id(),u.id()));
    // Permission, assignment, and hierarchy changes invalidate the original aggregate snapshot.
    parts.add(db.queryForList("SELECT b.id,r.version FROM org_role_bindings b JOIN org_roles r ON r.id=b.role_id AND r.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.user_id=? AND b.revoked_at IS NULL ORDER BY b.id",u.tenantId(),u.id()));
    parts.add(db.queryForList("SELECT id FROM org_reporting_lines WHERE tenant_id=? AND revoked_at IS NULL ORDER BY id",String.class,u.tenantId()));
    parts.add(db.queryForList("SELECT id FROM work_tasks WHERE tenant_id=? AND assignee_id=? ORDER BY id",String.class,u.tenantId(),u.id()));
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(parts.toString().getBytes(StandardCharsets.UTF_8))); }
    catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
  }
  public boolean canReplay(AuthenticatedPrincipal u,Map<String,Object> metadata) {
    return metadata!=null && fingerprint(u).equals(metadata.get("authorizationFingerprint"));
  }
}
