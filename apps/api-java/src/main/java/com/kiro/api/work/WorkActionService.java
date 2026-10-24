package com.kiro.api.work;
import com.kiro.api.integration.*;
import com.kiro.api.organization.*;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
@Service
public class WorkActionService {
 private final JdbcTemplate db;private final WorkService work;private final OrganizationService org;
 private final CredentialVault vault;private final ProviderGateway gateway;private final TransactionTemplate tx;
 public WorkActionService(JdbcTemplate db,WorkService work,OrganizationService org,CredentialVault vault,ProviderGateway gateway,PlatformTransactionManager tm) {
  this.db=db;this.work=work;this.org=org;this.vault=vault;this.gateway=gateway;this.tx=new TransactionTemplate(tm);
 }
 public record Proposal(@NotBlank String connectionId,@NotBlank @Size(max=200) String title,@NotBlank @Size(max=10000) String body,@NotBlank @Size(max=1000) String rationale,@AssertTrue boolean confirmExternalSharing) {}
 public record Decision(@NotNull @Min(1) Integer expectedVersion,boolean approve,@NotBlank @Size(max=1000) String reason) {}
 public record Execution(@NotNull @Min(1) Integer expectedVersion,@AssertTrue boolean confirmExecution) {}
 private ResponseStatusException conflict(String message) {return new ResponseStatusException(HttpStatus.CONFLICT,message);}
 private Map<String,Object> action(AuthenticatedPrincipal u,String p,String id) {
  work.project(u,p,false);
  var rows=db.queryForList("SELECT * FROM work_actions WHERE tenant_id=? AND project_id=? AND id=? FOR UPDATE",u.tenantId(),p,id);
  if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Action not found");return rows.getFirst();
 }
 private Map<String,Object> connection(AuthenticatedPrincipal u,String id) {
  org.requireManage(u,"INTEGRATION_MANAGE");
  var rows=db.queryForList("SELECT * FROM provider_connections WHERE tenant_id=? AND id=? AND owner_id=? AND provider='github' FOR UPDATE",u.tenantId(),id,u.id());
  if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Owned GitHub connection not found");return rows.getFirst();
 }
 private void audit(AuthenticatedPrincipal u,String p,String id,String state) {
  db.update("INSERT INTO work_events(id,tenant_id,project_id,actor_id,kind,payload) VALUES (?,?,?,?,?,jsonb_build_object('actionId',?::text,'state',?::text))",UUID.randomUUID().toString(),u.tenantId(),p,u.id(),"PROVIDER_ACTION",id,state);
 }
 public List<Map<String,Object>> list(AuthenticatedPrincipal u,String p,int offset) {
  return tx.execute(t->{work.project(u,p,false);return db.queryForList("SELECT * FROM work_actions WHERE tenant_id=? AND project_id=? ORDER BY created_at DESC,id LIMIT 100 OFFSET ?",u.tenantId(),p,offset);});
 }
 public Object propose(AuthenticatedPrincipal u,String p,Proposal b) {
  return tx.execute(t->{work.project(u,p,true);var c=connection(u,b.connectionId());
   if(!b.confirmExternalSharing())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Confirm publishing the proposed content to this repository");
   String id=UUID.randomUUID().toString();
   db.update("INSERT INTO work_actions(id,tenant_id,project_id,connection_id,requested_by,title,body,rationale,repository,status) VALUES (?,?,?,?,?,?,?,?,?,'PROPOSED')",id,u.tenantId(),p,b.connectionId(),u.id(),b.title().trim(),b.body(),b.rationale(),c.get("resource"));
   audit(u,p,id,"PROPOSED");return Map.of("id",id);
  });
 }
 public Object decide(AuthenticatedPrincipal u,String p,String id,Decision b) {
  return tx.execute(t->{work.project(u,p,true);var a=action(u,p,id);
   if(u.id().equals(a.get("requested_by")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"A different project editor must review this action");
   if(!"PROPOSED".equals(a.get("status")) || !b.expectedVersion().equals(a.get("version")))throw conflict("Proposal already decided; refresh");
   String status=b.approve()?"APPROVED":"REJECTED";
   db.update("UPDATE work_actions SET status=?,approved_by=?,decided_at=now(),decision_reason=?,version=version+1 WHERE id=?",status,u.id(),b.reason(),id);
   audit(u,p,id,status);return Map.of("status",status);
  });
 }
 public Object execute(AuthenticatedPrincipal u,String p,String id,Execution b) {
  if(!b.confirmExecution())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Confirm this external action");
  var claimed=tx.execute(t->{work.project(u,p,true);var a=action(u,p,id);
   if(!"APPROVED".equals(a.get("status")) || !b.expectedVersion().equals(a.get("version")))throw conflict("Action is not awaiting execution; do not repeat an uncertain request");
   if(!u.id().equals(a.get("requested_by")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the proposing connection owner may execute");
   if(db.queryForObject("SELECT count(*) FROM work_projects p WHERE "+OrganizationAccess.WRITE+" AND p.id=?",Long.class,u.tenantId(),a.get("approved_by"),a.get("approved_by"),p)==0)
     throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Approver no longer has project write access; obtain a new proposal and approval");
   var c=connection(u,(String)a.get("connection_id"));
   if(!"READY".equals(c.get("status")) || c.get("encrypted_token")==null || !c.get("resource").equals(a.get("repository")))throw conflict("Connection is not ready for the approved repository");
   String token=vault.decrypt((String)c.get("encrypted_token"),u.tenantId()+":"+c.get("id"));
   db.update("UPDATE work_actions SET status='EXECUTING',started_at=now(),version=version+1 WHERE id=?",id);
   audit(u,p,id,"EXECUTING");a.put("token",token);return a;
  });
  String state="EXECUTED",error=null;Map<String,String> result=Map.of();
  try {result=gateway.createGitHubIssue((String)claimed.get("repository"),(String)claimed.get("token"),(String)claimed.get("title"),(String)claimed.get("body"),id);}
  catch(Exception e) {
   // A network error or provider 5xx may have occurred after the write. Never retry it automatically.
   error=e instanceof ProviderGateway.ProviderFailure f?f.code:"PROVIDER_RESULT_UNKNOWN";
   state=Set.of("PROVIDER_HTTP_400","PROVIDER_HTTP_401","PROVIDER_HTTP_403","PROVIDER_HTTP_404","PROVIDER_HTTP_422","PROVIDER_HTTP_429").contains(error)?"FAILED":"UNKNOWN";
  } finally {claimed.remove("token");}
  String finalState=state,finalError=error;var finalResult=result;
  tx.executeWithoutResult(t->{db.update("UPDATE work_actions SET status=?,finished_at=now(),external_id=?,external_url=?,error_code=?,version=version+1 WHERE id=? AND status='EXECUTING'",finalState,finalResult.get("externalId"),finalResult.get("url"),finalError,id);audit(u,p,id,finalState);});
  return Map.of("status",state,"result",result,"error",error==null?"":error);
 }
}
