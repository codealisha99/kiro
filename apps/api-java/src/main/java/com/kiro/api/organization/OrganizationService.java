package com.kiro.api.organization;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class OrganizationService {
  private final JdbcTemplate db;
  private final ObjectMapper json;
  public OrganizationService(JdbcTemplate db,ObjectMapper json) { this.db=db; this.json=json; }
  public record NameInput(@NotBlank @Size(max=200) String name) {}
  public record TeamInput(@NotBlank @Size(max=200) String name,@NotBlank String departmentId) {}
  public record MemberInput(@NotBlank String teamId,@NotBlank String userId,boolean revoke) {}
  public record ReportingInput(@NotBlank String employeeId,@NotBlank String managerId,boolean revoke) {}
  public record RoleInput(@NotBlank @Size(max=100) String name,
      @NotNull @Pattern(regexp="EMPLOYEE|MANAGER|DIRECTOR|VP|CEO|ADMIN") String dashboard,
      @NotNull @Size(max=4) Set<@Pattern(regexp="PROJECT_READ|PROJECT_WRITE|ORG_MANAGE|INTEGRATION_MANAGE") String> permissions,
      @Min(1) Integer expectedVersion) {}
  public record BindingInput(@NotBlank String roleId,@NotBlank String userId,
      @NotNull @Pattern(regexp="COMPANY|DEPARTMENT|TEAM") String scope,String departmentId,String teamId) {}
  static String id() { return UUID.randomUUID().toString(); }
  static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
  public boolean canManage(AuthenticatedPrincipal u,String permission) {
    return "ADMIN".equals(u.roleUpper()) || db.queryForObject("""
      SELECT count(*) FROM org_role_bindings b JOIN org_role_permissions rp ON rp.role_id=b.role_id AND rp.tenant_id=b.tenant_id
      WHERE b.tenant_id=? AND b.user_id=? AND b.scope='COMPANY' AND b.revoked_at IS NULL AND rp.permission=?
      """,Long.class,u.tenantId(),u.id(),permission)>0;
  }
  public void requireManage(AuthenticatedPrincipal u,String permission) {
    if(!canManage(u,permission)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Organization permission required");
  }
  private void lock(AuthenticatedPrincipal u) { db.queryForList("SELECT id FROM \"Tenant\" WHERE id=? FOR UPDATE",u.tenantId()); }
  public void audit(AuthenticatedPrincipal u,String kind,Object payload) {
    try { db.update("INSERT INTO org_audit_events(id,tenant_id,actor_id,kind,payload) VALUES (?,?,?,?,?::jsonb)",
        id(),u.tenantId(),u.id(),kind,json.writeValueAsString(payload)); }
    catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Cannot record organization audit",e); }
  }
  private void exists(String table,AuthenticatedPrincipal u,String id) {
    if(id==null || db.queryForObject("SELECT count(*) FROM "+table+" WHERE tenant_id=? AND id=?",Long.class,u.tenantId(),id)==0)
      throw bad("Organization resource not found");
  }
  private void user(AuthenticatedPrincipal u,String id) {
    if(db.queryForObject("SELECT count(*) FROM users WHERE \"tenantId\"=? AND id=?",Long.class,u.tenantId(),id)==0) throw bad("Workspace member not found");
  }
  private void defaults(AuthenticatedPrincipal u) {
    for(String name:List.of("Employee","Manager","Director","VP","CEO","Administrator")) {
      String roleId=u.tenantId()+":role:"+name.toLowerCase();
      int inserted=db.update("INSERT INTO org_roles(id,tenant_id,name,dashboard) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
          roleId,u.tenantId(),name,name.equals("Administrator")?"ADMIN":name.toUpperCase());
      if(inserted>0) {
        var permissions=name.equals("Administrator")?List.of("ORG_MANAGE","INTEGRATION_MANAGE"):
            name.equals("Employee")?List.of("PROJECT_READ"):List.of("PROJECT_READ","PROJECT_WRITE");
        for(String p:permissions) db.update("INSERT INTO org_role_permissions(tenant_id,role_id,permission) VALUES (?,?,?)",u.tenantId(),roleId,p);
      }
    }
  }
  public Map<String,Object> setup(AuthenticatedPrincipal u) {
    boolean admin=canManage(u,"ORG_MANAGE");
    if(!admin) return Map.of("canManage",false,"canManageIntegrations",canManage(u,"INTEGRATION_MANAGE"),"views",views(u));
    defaults(u);
    return Map.of("canManage",true,"canManageIntegrations",canManage(u,"INTEGRATION_MANAGE"),"views",views(u),
      "departments",db.queryForList("SELECT * FROM org_departments WHERE tenant_id=? ORDER BY name LIMIT 500",u.tenantId()),
      "teams",db.queryForList("SELECT * FROM org_teams WHERE tenant_id=? ORDER BY name LIMIT 500",u.tenantId()),
      "users",db.queryForList("SELECT id,name,email FROM users WHERE \"tenantId\"=? ORDER BY name,id LIMIT 500",u.tenantId()),
      "memberships",db.queryForList("SELECT * FROM org_team_memberships WHERE tenant_id=? AND revoked_at IS NULL ORDER BY created_at LIMIT 1000",u.tenantId()),
      "reporting",db.queryForList("SELECT * FROM org_reporting_lines WHERE tenant_id=? AND revoked_at IS NULL ORDER BY created_at LIMIT 1000",u.tenantId()),
      "roles",db.queryForList("""
        SELECT r.*,ARRAY(SELECT permission FROM org_role_permissions p WHERE p.role_id=r.id ORDER BY permission) AS permissions
        FROM org_roles r WHERE tenant_id=? ORDER BY name
        """,u.tenantId()).stream().map(r->{try { r.put("permissions",((java.sql.Array)r.get("permissions")).getArray());return r; }
          catch(java.sql.SQLException e) { throw new IllegalStateException(e); }}).toList(),
      "bindings",db.queryForList("SELECT * FROM org_role_bindings WHERE tenant_id=? AND revoked_at IS NULL ORDER BY created_at LIMIT 1000",u.tenantId()));
  }
  public Map<String,Object> department(AuthenticatedPrincipal u,NameInput input) {
    requireManage(u,"ORG_MANAGE");String id=id();
    db.update("INSERT INTO org_departments(id,tenant_id,name) VALUES (?,?,?)",id,u.tenantId(),input.name().trim());
    audit(u,"DEPARTMENT_CREATED",Map.of("id",id,"name",input.name()));return Map.of("id",id);
  }
  public Map<String,Object> team(AuthenticatedPrincipal u,TeamInput input) {
    requireManage(u,"ORG_MANAGE"); exists("org_departments",u,input.departmentId());String id=id();
    db.update("INSERT INTO org_teams(id,tenant_id,department_id,name) VALUES (?,?,?,?)",id,u.tenantId(),input.departmentId(),input.name().trim());
    audit(u,"TEAM_CREATED",Map.of("id",id,"departmentId",input.departmentId()));return Map.of("id",id);
  }
  public Map<String,Object> membership(AuthenticatedPrincipal u,MemberInput input) {
    requireManage(u,"ORG_MANAGE");lock(u);exists("org_teams",u,input.teamId());user(u,input.userId());
    if(input.revoke()) db.update("UPDATE org_team_memberships SET revoked_at=now() WHERE tenant_id=? AND team_id=? AND user_id=? AND revoked_at IS NULL",u.tenantId(),input.teamId(),input.userId());
    else db.update("INSERT INTO org_team_memberships(id,tenant_id,team_id,user_id) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",id(),u.tenantId(),input.teamId(),input.userId());
    audit(u,"TEAM_MEMBERSHIP_CHANGED",input);return Map.of("ok",true);
  }
  public Map<String,Object> reporting(AuthenticatedPrincipal u,ReportingInput input) {
    requireManage(u,"ORG_MANAGE");lock(u);user(u,input.employeeId());user(u,input.managerId());
    if(input.revoke()) db.update("UPDATE org_reporting_lines SET revoked_at=now() WHERE tenant_id=? AND employee_id=? AND manager_id=? AND revoked_at IS NULL",u.tenantId(),input.employeeId(),input.managerId());
    else {
      long cycle=db.queryForObject("""
        WITH RECURSIVE supervisors(id) AS (SELECT ?::text UNION SELECT r.manager_id FROM org_reporting_lines r
          JOIN supervisors s ON r.employee_id=s.id WHERE r.tenant_id=? AND r.revoked_at IS NULL)
        SELECT count(*) FROM supervisors WHERE id=?
        """,Long.class,input.managerId(),u.tenantId(),input.employeeId());
      if(cycle>0) throw bad("Reporting relationship would create a cycle");
      db.update("INSERT INTO org_reporting_lines(id,tenant_id,employee_id,manager_id) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",id(),u.tenantId(),input.employeeId(),input.managerId());
    }
    audit(u,"REPORTING_CHANGED",input);return Map.of("ok",true);
  }
  public Map<String,Object> role(AuthenticatedPrincipal u,String roleId,RoleInput input) {
    requireManage(u,"ORG_MANAGE");lock(u);
    if(input.permissions().contains("PROJECT_WRITE") && !input.permissions().contains("PROJECT_READ")) throw bad("Write permission requires read permission");
    if(roleId==null) { roleId=id(); db.update("INSERT INTO org_roles(id,tenant_id,name,dashboard) VALUES (?,?,?,?)",roleId,u.tenantId(),input.name().trim(),input.dashboard()); }
    else {
      exists("org_roles",u,roleId);
      if(input.expectedVersion()==null || db.update("UPDATE org_roles SET name=?,dashboard=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",
          input.name().trim(),input.dashboard(),u.tenantId(),roleId,input.expectedVersion())==0)
        throw new ResponseStatusException(HttpStatus.CONFLICT,"Role changed; refresh before saving");
      db.update("DELETE FROM org_role_permissions WHERE tenant_id=? AND role_id=?",u.tenantId(),roleId);
    }
    for(String permission:input.permissions()) db.update("INSERT INTO org_role_permissions(tenant_id,role_id,permission) VALUES (?,?,?)",u.tenantId(),roleId,permission);
    audit(u,"ROLE_CONFIGURED",Map.of("id",roleId,"definition",input));return Map.of("id",roleId);
  }
  public Map<String,Object> bind(AuthenticatedPrincipal u,BindingInput input) {
    requireManage(u,"ORG_MANAGE");lock(u);exists("org_roles",u,input.roleId());user(u,input.userId());
    if(!Set.of("COMPANY","DEPARTMENT","TEAM").contains(input.scope())) throw bad("Invalid scope");
    if(input.scope().equals("TEAM")) exists("org_teams",u,input.teamId());
    if(input.scope().equals("DEPARTMENT")) exists("org_departments",u,input.departmentId());
    if((!input.scope().equals("TEAM") && input.teamId()!=null) || (!input.scope().equals("DEPARTMENT") && input.departmentId()!=null)) throw bad("Scope fields do not match");
    String id=id();db.update("INSERT INTO org_role_bindings(id,tenant_id,role_id,user_id,scope,department_id,team_id) VALUES (?,?,?,?,?,?,?)",
      id,u.tenantId(),input.roleId(),input.userId(),input.scope(),input.departmentId(),input.teamId());
    audit(u,"ROLE_GRANTED",Map.of("id",id,"binding",input));return Map.of("id",id);
  }
  public Map<String,Object> revoke(AuthenticatedPrincipal u,String id) {
    requireManage(u,"ORG_MANAGE");lock(u);exists("org_role_bindings",u,id);
    db.update("UPDATE org_role_bindings SET revoked_at=now() WHERE tenant_id=? AND id=? AND revoked_at IS NULL",u.tenantId(),id);
    audit(u,"ROLE_REVOKED",Map.of("id",id));return Map.of("ok",true);
  }
  public List<String> views(AuthenticatedPrincipal u) {
    var result=new LinkedHashSet<String>();result.add("EMPLOYEE");
    result.addAll(db.queryForList("SELECT DISTINCT r.dashboard FROM org_roles r JOIN org_role_bindings b ON b.role_id=r.id AND b.tenant_id=r.tenant_id WHERE b.tenant_id=? AND b.user_id=? AND b.revoked_at IS NULL AND r.dashboard<>'ADMIN' ORDER BY r.dashboard",String.class,u.tenantId(),u.id()));
    return new ArrayList<>(result);
  }
  public List<Map<String,Object>> myTeams(AuthenticatedPrincipal u) {
    if(canManage(u,"ORG_MANAGE")) return db.queryForList("SELECT id,name,department_id FROM org_teams WHERE tenant_id=? ORDER BY name LIMIT 500",u.tenantId());
    return db.queryForList("""
      SELECT t.id,t.name,t.department_id FROM org_teams t WHERE t.tenant_id=? AND (
        EXISTS (SELECT 1 FROM org_team_memberships m WHERE m.tenant_id=t.tenant_id AND m.team_id=t.id AND m.user_id=? AND m.revoked_at IS NULL)
        OR EXISTS (SELECT 1 FROM org_role_bindings b WHERE b.tenant_id=t.tenant_id AND b.user_id=? AND b.revoked_at IS NULL
          AND (b.scope='COMPANY' OR b.team_id=t.id OR b.department_id=t.department_id))) ORDER BY t.name LIMIT 500
      """,u.tenantId(),u.id(),u.id());
  }
  public Object auditHistory(AuthenticatedPrincipal u) {
    requireManage(u,"ORG_MANAGE");return db.queryForList("SELECT id,kind,actor_id,payload::text AS payload,occurred_at FROM org_audit_events WHERE tenant_id=? ORDER BY occurred_at DESC,id LIMIT 100",u.tenantId());
  }
}
