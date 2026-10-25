package com.kiro.api.integration;

import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.sql.Timestamp;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class IntegrationService {
  private final JdbcTemplate db;private final OrganizationService org;private final CredentialVault vault;
  private final ProviderGateway gateway;private final TransactionTemplate tx;private ProviderRecordIndexer indexer;
  public IntegrationService(JdbcTemplate db,OrganizationService org,CredentialVault vault,ProviderGateway gateway,PlatformTransactionManager manager) {
    this(db,org,vault,gateway,manager,null);
  }
  @org.springframework.beans.factory.annotation.Autowired
  public IntegrationService(JdbcTemplate db,OrganizationService org,CredentialVault vault,ProviderGateway gateway,PlatformTransactionManager manager,ProviderRecordIndexer indexer) {
    this.db=db;this.org=org;this.vault=vault;this.gateway=gateway;this.tx=new TransactionTemplate(manager);this.indexer=indexer;
  }
  public record ConnectionInput(@NotBlank @Pattern(regexp="github|slack|linear|hubspot|xero|bamboohr|googleanalytics|googledrive") String provider,
      @NotBlank @Size(max=200) String name,@Size(max=200) String resource,@Size(max=100) String accountId,
      @Size(max=10000) String token) {}
  public record TokenInput(@NotBlank @Size(max=10000) String token) {}
  private static final String PUBLIC="id,provider,name,resource,account_id,status,cursor,last_success_at,next_sync_at,last_error,created_at";
  public Map<String,Object> catalog(AuthenticatedPrincipal u) {
    return Map.of("canManage",org.canManage(u,"INTEGRATION_MANAGE"),"credentialStorageReady",vault.available(),"xeroOAuthConfigured",gateway.xeroOAuthConfigured(),"googleAnalyticsOAuthConfigured",gateway.googleAnalyticsOAuthConfigured(),"googleDriveOAuthConfigured",gateway.googleDriveOAuthConfigured(),"providers",List.of(
      capability("github","GitHub","Repository owner/name","","Issues and pull requests, including issue and pull request descriptions and comments","Fine-grained token: selected repository Issues read (and Pull requests read for private PRs)"),
      capability("googledrive","Google Drive","Folder ID","","Google Docs, Sheets, Slides, plain text, and text-based PDFs recursively inside the selected folder","Google OAuth: drive.readonly; files are restricted to the selected folder and indexed for the connection owner"),
      capability("googleanalytics","Google Analytics 4","Numeric property ID","","30 reporting dates ending two UTC dates ago: sessions, key events and revenue by first-user campaign. Dates use the property timezone; attribution, delayed reporting and thresholding can affect results.","OAuth: analytics.readonly with property access; offline refresh enabled"),
      capability("slack","Slack","Approved public channel ID","Workspace subdomain","Messages and permitted thread replies in one joined public channel; no DMs or private channels","Bot token: channels:read, channels:history; bot must join channel"),
      capability("linear","Linear","Team UUID","","Team issues, descriptions and comments","Personal API key restricted to the selected team; read access"),
      capability("hubspot","HubSpot","Portal ID","","Deals: name, stage, amount and currency","Private app token: crm.objects.deals.read"),
      capability("xero","Xero","Xero organization (selected after authorization)","","Invoices: number, status, total and currency","OAuth: accounting.transactions.read and offline_access; tokens refresh automatically"),
      capability("bamboohr","BambooHR","Company subdomain","","Shared employee directory; no compensation, medical or payroll data","API key for a user authorized for the directory")
    ));
  }
  private Map<String,String> capability(String id,String name,String resource,String account,String entities,String permissions) {
    return Map.of("id",id,"name",name,"resourceLabel",resource,"accountLabel",account,"entities",entities,"permissions",permissions,
      "sync","Read-only full reconciliation, one page per job; automatic polling every minute, full refresh every 15 minutes. Missing records expire only after a completed scan.",
      "visibility","Imported records are indexed as restricted knowledge documents and searchable only by the connection owner, matching the available source identity. Disconnecting hides them; deleting connection data permanently removes them.");
  }
  public List<Map<String,Object>> list(AuthenticatedPrincipal u) {
    org.requireManage(u,"INTEGRATION_MANAGE");return db.queryForList("SELECT "+PUBLIC+",(SELECT CASE WHEN c.status='READY' AND c.last_success_at>now()-interval '24 hours' THEN count(*) ELSE 0 END FROM provider_records r WHERE r.connection_id=c.id AND r.deleted_at IS NULL) AS current_records,(SELECT CASE WHEN c.status='READY' AND c.last_success_at>now()-interval '24 hours' THEN string_agg(kind||' '||n,', ' ORDER BY kind) ELSE NULL END FROM (SELECT r.kind,count(*)::text n FROM provider_records r WHERE r.connection_id=c.id AND r.deleted_at IS NULL GROUP BY r.kind) coverage) AS current_coverage,(SELECT status FROM provider_sync_runs s WHERE s.connection_id=c.id ORDER BY s.started_at DESC LIMIT 1) AS last_run_status,(SELECT error_code FROM provider_sync_runs s WHERE s.connection_id=c.id ORDER BY s.started_at DESC LIMIT 1) AS last_run_error FROM provider_connections c WHERE c.tenant_id=? AND c.owner_id=? ORDER BY c.created_at DESC LIMIT 100",u.tenantId(),u.id());
  }
  private Map<String,Object> owned(AuthenticatedPrincipal u,String id) {
    org.requireManage(u,"INTEGRATION_MANAGE");var rows=db.queryForList("SELECT "+PUBLIC+" FROM provider_connections WHERE tenant_id=? AND owner_id=? AND id=?",u.tenantId(),u.id(),id);
    if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Connection not found");return rows.getFirst();
  }
  public Map<String,Object> create(AuthenticatedPrincipal u,ConnectionInput input) {
    org.requireManage(u,"INTEGRATION_MANAGE");String account=Objects.requireNonNullElse(input.accountId(),"");String resource=Objects.requireNonNullElse(input.resource(),"");
    boolean oauthSetup=input.provider().equals("xero")&&resource.isBlank()&&(input.token()==null||input.token().isBlank());
    if(!oauthSetup)try {gateway.validate(input.provider(),resource,account);}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,e.code);}
    String id=UUID.randomUUID().toString(),sourceId=UUID.randomUUID().toString();boolean configured=input.token()!=null&&!input.token().isBlank();
    String encrypted=configured?vault.encrypt(input.token(),u.tenantId()+":"+id):null;
    tx.executeWithoutResult(t->{
      db.update("INSERT INTO provider_connections(id,tenant_id,owner_id,provider,name,resource,account_id,encrypted_token,status,provider_source_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id,u.tenantId(),u.id(),input.provider(),input.name().trim(),resource,account,encrypted,configured?"PENDING":"UNCONFIGURED",sourceId);
      db.update("INSERT INTO \"sources\"(\"id\",\"tenantId\",\"type\",\"name\",\"status\") VALUES (?,?,'PROVIDER',?,?::\"SourceStatus\")",
        sourceId,u.tenantId(),input.name().trim(),configured?"CONNECTED":"DISCONNECTED");
      org.audit(u,"CONNECTION_CREATED",Map.of("id",id,"provider",input.provider()));
    });return owned(u,id);
  }
  public record OAuthStart(String authorizationUrl) {}
  public OAuthStart startGoogleDriveOAuth(AuthenticatedPrincipal u,String id) {
    var c=owned(u,id);if(!"googledrive".equals(c.get("provider")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This connection is not Google Drive");
    if("DELETED".equals(c.get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    if(!vault.available())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure INTEGRATION_ENCRYPTION_KEY before authorizing Google Drive");
    String state=randomUrlToken(32),verifier=randomUrlToken(48);
    final String authorizationUrl;try{authorizationUrl=gateway.googleDriveAuthorizationUrl(state,verifier);}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure Google Drive OAuth client settings before authorizing");}
    String stateHash=sha256(state),encryptedVerifier=vault.encrypt(verifier,u.tenantId()+":"+id+":googledrive-pkce");
    int changed=db.update("UPDATE provider_connections SET status='OAUTH_AUTHORIZING',oauth_state_hash=?,oauth_state_expires_at=now()+interval '10 minutes',encrypted_pkce_verifier=?,encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,last_error=NULL,updated_at=now() WHERE tenant_id=? AND owner_id=? AND id=? AND provider='googledrive' AND status<>'DELETED'",stateHash,encryptedVerifier,u.tenantId(),u.id(),id);
    if(changed!=1)throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    org.audit(u,"GOOGLE_DRIVE_AUTHORIZATION_STARTED",Map.of("id",id));return new OAuthStart(authorizationUrl);
  }
  public String completeGoogleDriveOAuth(String state,String code) {
    if(state==null||state.length()>256)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Drive authorization state is invalid or expired");
    String hash=sha256(state);
    Map<String,Object> pending=tx.execute(t->{
      var rows=db.queryForList("SELECT id,tenant_id,owner_id,encrypted_pkce_verifier FROM provider_connections WHERE provider='googledrive' AND status='OAUTH_AUTHORIZING' AND oauth_state_hash=? AND oauth_state_expires_at>now() FOR UPDATE",hash);
      if(rows.isEmpty())return null;var row=rows.getFirst();
      db.update("UPDATE provider_connections SET oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE id=?",row.get("id"));return row;
    });
    if(pending==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Drive authorization state is invalid, expired, or already used");
    String id=(String)pending.get("id"),tenant=(String)pending.get("tenant_id");
    try {
      String verifier=vault.decrypt((String)pending.get("encrypted_pkce_verifier"),tenant+":"+id+":googledrive-pkce");
      var identity=db.queryForMap("SELECT email,role FROM users WHERE id=? AND \"tenantId\"=?",pending.get("owner_id"),tenant);
      var owner=new AuthenticatedPrincipal((String)pending.get("owner_id"),(String)identity.get("email"),tenant,((String)identity.get("role")).toLowerCase());
      if(!org.canManage(owner,"INTEGRATION_MANAGE"))throw new ProviderGateway.ProviderFailure("OWNER_PERMISSION_REVOKED",false,0);
      if(code==null||code.isBlank()||code.length()>4096)throw new ProviderGateway.ProviderFailure("GOOGLE_DRIVE_AUTHORIZATION_DENIED",false,0);
      var tokens=gateway.exchangeGoogleDriveCode(code,verifier);
      String access=vault.encrypt(tokens.accessToken(),tenant+":"+id),refresh=vault.encrypt(tokens.refreshToken(),tenant+":"+id+":googledrive-refresh");
      tx.executeWithoutResult(t->{
        if(db.queryForList("SELECT id FROM provider_connections WHERE tenant_id=? AND id=? AND owner_id=? AND provider='googledrive' AND status='OAUTH_AUTHORIZING' FOR UPDATE",tenant,id,pending.get("owner_id")).isEmpty())throw new ResponseStatusException(HttpStatus.GONE,"Google Drive authorization was cancelled");
        db.update("UPDATE provider_connections SET encrypted_token=?,encrypted_refresh_token=?,access_token_expires_at=now()+(? * interval '1 second'),status='PENDING',next_sync_at=now(),oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,last_error=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=? AND status='OAUTH_AUTHORIZING'",access,refresh,tokens.expiresIn(),tenant,id,pending.get("owner_id"));
      });
      db.update("UPDATE \"sources\" SET \"status\"='CONNECTED',\"deleted\"=false,\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",tenant,id);
      org.audit(owner,"GOOGLE_DRIVE_AUTHORIZATION_COMPLETED",Map.of("id",id));return id;
    } catch(Exception e) {
      String reason=e instanceof ProviderGateway.ProviderFailure f?f.code:"GOOGLE_DRIVE_OAUTH_FAILED";
      db.update("UPDATE provider_connections SET status='REAUTH',encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,last_error=?,oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND status='OAUTH_AUTHORIZING'",reason,tenant,id);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Drive authorization failed. Start a new authorization from Connected applications.");
    }
  }
  public OAuthStart startXeroOAuth(AuthenticatedPrincipal u,String id) {
    var c=owned(u,id);
    if(!"xero".equals(c.get("provider")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This connection is not Xero");
    if("DELETED".equals(c.get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    if(!vault.available())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure INTEGRATION_ENCRYPTION_KEY before authorizing Xero");
    String state=randomUrlToken(32),verifier=randomUrlToken(48);
    final String authorizationUrl;try{authorizationUrl=gateway.xeroAuthorizationUrl(state,verifier);}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure Xero OAuth client settings before authorizing");}
    String stateHash=sha256(state),encryptedVerifier=vault.encrypt(verifier,u.tenantId()+":"+id+":xero-pkce");
    int changed=tx.execute(t->{
      db.update("DELETE FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      return db.update("""
      UPDATE provider_connections SET status='OAUTH_AUTHORIZING',oauth_state_hash=?,oauth_state_expires_at=now()+interval '10 minutes',
        encrypted_pkce_verifier=?,encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,
        cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,last_error=NULL,updated_at=now()
      WHERE tenant_id=? AND owner_id=? AND id=? AND status<>'DELETED'
      """,stateHash,encryptedVerifier,u.tenantId(),u.id(),id);
    });
    if(changed!=1)throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    org.audit(u,"XERO_AUTHORIZATION_STARTED",Map.of("id",id));
    return new OAuthStart(authorizationUrl);
  }
  public String completeXeroOAuth(String state,String code) {
    if(state==null||state.length()>256)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Xero authorization state is invalid or expired");
    String hash=sha256(state);
    Map<String,Object> pending=tx.execute(t->{
      var rows=db.queryForList("SELECT id,tenant_id,owner_id,encrypted_pkce_verifier FROM provider_connections WHERE provider='xero' AND status='OAUTH_AUTHORIZING' AND oauth_state_hash=? AND oauth_state_expires_at>now() FOR UPDATE",hash);
      if(rows.isEmpty())return null;
      var row=rows.getFirst();db.update("UPDATE provider_connections SET oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE id=?",row.get("id"));return row;
    });
    if(pending==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Xero authorization state is invalid, expired, or already used");
    String id=(String)pending.get("id"),tenant=(String)pending.get("tenant_id");
    try {
      String verifier=vault.decrypt((String)pending.get("encrypted_pkce_verifier"),tenant+":"+id+":xero-pkce");
      var identity=db.queryForMap("SELECT email,role FROM users WHERE id=? AND \"tenantId\"=?",pending.get("owner_id"),tenant);
      var owner=new AuthenticatedPrincipal((String)pending.get("owner_id"),(String)identity.get("email"),tenant,((String)identity.get("role")).toLowerCase());
      if(!org.canManage(owner,"INTEGRATION_MANAGE"))throw new ProviderGateway.ProviderFailure("OWNER_PERMISSION_REVOKED",false,0);
      if(code==null||code.isBlank()||code.length()>4096)throw new ProviderGateway.ProviderFailure("XERO_AUTHORIZATION_DENIED",false,0);
      var tokens=gateway.exchangeXeroCode(code,verifier);if(tokens.expiresIn()<1)throw new ProviderGateway.ProviderFailure("XERO_OAUTH_INVALID_EXPIRY",false,0);
      var tenants=gateway.xeroTenants(tokens.accessToken());
      String access=vault.encrypt(tokens.accessToken(),tenant+":"+id),refresh=vault.encrypt(tokens.refreshToken(),tenant+":"+id+":xero-refresh");
      tx.executeWithoutResult(t->{
        if(db.queryForList("SELECT id FROM provider_connections WHERE tenant_id=? AND id=? AND owner_id=? AND status='OAUTH_AUTHORIZING' FOR UPDATE",tenant,id,pending.get("owner_id")).isEmpty())throw new ResponseStatusException(HttpStatus.GONE,"Xero authorization was cancelled");
        db.update("DELETE FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=?",tenant,id);
        tenants.forEach(x->db.update("INSERT INTO provider_oauth_tenants(tenant_id,connection_id,xero_tenant_id,tenant_name) VALUES (?,?,?,?)",tenant,id,x.tenantId(),x.tenantName()));
        db.update("UPDATE provider_connections SET encrypted_token=?,encrypted_refresh_token=?,access_token_expires_at=now()+(? * interval '1 second'),status='OAUTH_TENANT',oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=? AND status='OAUTH_AUTHORIZING'",access,refresh,tokens.expiresIn(),tenant,id,pending.get("owner_id"));
      });
      return id;
    } catch(Exception e) {
      String reason=e instanceof ProviderGateway.ProviderFailure f?f.code:"XERO_OAUTH_FAILED";
      db.update("UPDATE provider_connections SET status='REAUTH',encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,last_error=?,oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND status='OAUTH_AUTHORIZING'",reason,tenant,id);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Xero authorization failed. Start a new authorization from Connected applications.");
    }
  }
  public OAuthStart startGoogleAnalyticsOAuth(AuthenticatedPrincipal u,String id) {
    var c=owned(u,id);
    if(!"googleanalytics".equals(c.get("provider")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This connection is not Google Analytics");
    if("DELETED".equals(c.get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    if(!vault.available())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure INTEGRATION_ENCRYPTION_KEY before authorizing Google Analytics");
    try{gateway.validate("googleanalytics",(String)c.get("resource"),"");}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a numeric Google Analytics property ID before authorizing");}
    String state=randomUrlToken(32),verifier=randomUrlToken(48);
    final String authorizationUrl;try{authorizationUrl=gateway.googleAnalyticsAuthorizationUrl(state,verifier);}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure Google Analytics OAuth client settings before authorizing");}
    String stateHash=sha256(state),encryptedVerifier=vault.encrypt(verifier,u.tenantId()+":"+id+":googleanalytics-pkce");
    int changed=tx.execute(t->db.update("""
      UPDATE provider_connections SET status='OAUTH_AUTHORIZING',oauth_state_hash=?,oauth_state_expires_at=now()+interval '10 minutes',
        encrypted_pkce_verifier=?,encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,
        cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,last_error=NULL,updated_at=now()
      WHERE tenant_id=? AND owner_id=? AND id=? AND provider='googleanalytics' AND status<>'DELETED'
      """,stateHash,encryptedVerifier,u.tenantId(),u.id(),id));
    if(changed!=1)throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    org.audit(u,"GOOGLE_ANALYTICS_AUTHORIZATION_STARTED",Map.of("id",id));return new OAuthStart(authorizationUrl);
  }
  public String completeGoogleAnalyticsOAuth(String state,String code) {
    if(state==null||state.length()>256)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Analytics authorization state is invalid or expired");
    String hash=sha256(state);
    Map<String,Object> pending=tx.execute(t->{
      var rows=db.queryForList("SELECT id,tenant_id,owner_id,resource,encrypted_pkce_verifier FROM provider_connections WHERE provider='googleanalytics' AND status='OAUTH_AUTHORIZING' AND oauth_state_hash=? AND oauth_state_expires_at>now() FOR UPDATE",hash);
      if(rows.isEmpty())return null;
      var row=rows.getFirst();db.update("UPDATE provider_connections SET oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE id=?",row.get("id"));return row;
    });
    if(pending==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Analytics authorization state is invalid, expired, or already used");
    String id=(String)pending.get("id"),tenant=(String)pending.get("tenant_id");
    try {
      String verifier=vault.decrypt((String)pending.get("encrypted_pkce_verifier"),tenant+":"+id+":googleanalytics-pkce");
      var identity=db.queryForMap("SELECT email,role FROM users WHERE id=? AND \"tenantId\"=?",pending.get("owner_id"),tenant);
      var owner=new AuthenticatedPrincipal((String)pending.get("owner_id"),(String)identity.get("email"),tenant,((String)identity.get("role")).toLowerCase());
      if(!org.canManage(owner,"INTEGRATION_MANAGE"))throw new ProviderGateway.ProviderFailure("OWNER_PERMISSION_REVOKED",false,0);
      if(code==null||code.isBlank()||code.length()>4096)throw new ProviderGateway.ProviderFailure("GOOGLE_OAUTH_AUTHORIZATION_DENIED",false,0);
      var tokens=gateway.exchangeGoogleAnalyticsCode(code,verifier);
      String access=vault.encrypt(tokens.accessToken(),tenant+":"+id),refresh=vault.encrypt(tokens.refreshToken(),tenant+":"+id+":googleanalytics-refresh");
      tx.executeWithoutResult(t->{
        if(db.queryForList("SELECT id FROM provider_connections WHERE tenant_id=? AND id=? AND owner_id=? AND provider='googleanalytics' AND status='OAUTH_AUTHORIZING' FOR UPDATE",tenant,id,pending.get("owner_id")).isEmpty())throw new ResponseStatusException(HttpStatus.GONE,"Google Analytics authorization was cancelled");
        db.update("UPDATE provider_connections SET encrypted_token=?,encrypted_refresh_token=?,access_token_expires_at=now()+(? * interval '1 second'),status='PENDING',next_sync_at=now(),oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,last_error=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=? AND status='OAUTH_AUTHORIZING'",access,refresh,tokens.expiresIn(),tenant,id,pending.get("owner_id"));
      });
      db.update("UPDATE \"sources\" SET \"status\"='CONNECTED',\"deleted\"=false,\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",tenant,id);
      org.audit(owner,"GOOGLE_ANALYTICS_AUTHORIZATION_COMPLETED",Map.of("id",id,"propertyId",pending.get("resource")));return id;
    } catch(Exception e) {
      String reason=e instanceof ProviderGateway.ProviderFailure f?f.code:"GOOGLE_OAUTH_FAILED";
      db.update("UPDATE provider_connections SET status='REAUTH',encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,last_error=?,oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND status='OAUTH_AUTHORIZING'",reason,tenant,id);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Google Analytics authorization failed. Start a new authorization from Connected applications.");
    }
  }
  public List<Map<String,Object>> xeroTenants(AuthenticatedPrincipal u,String id) {
    if(!"xero".equals(owned(u,id).get("provider")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This connection is not Xero");
    return db.queryForList("SELECT xero_tenant_id,tenant_name FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=? ORDER BY tenant_name",u.tenantId(),id);
  }
  public Map<String,Object> selectXeroTenant(AuthenticatedPrincipal u,String id,String xeroTenantId) {
    var c=owned(u,id);if(!"xero".equals(c.get("provider")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This connection is not Xero");
    if("DELETED".equals(c.get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted");
    try{gateway.validate("xero",xeroTenantId,"");}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid Xero organization");}
    int selected=db.update("UPDATE provider_connections c SET resource=?,status='PENDING',next_sync_at=now(),cursor=NULL,generation=NULL,last_error=NULL,updated_at=now() WHERE c.tenant_id=? AND c.id=? AND c.owner_id=? AND c.status='OAUTH_TENANT' AND EXISTS(SELECT 1 FROM provider_oauth_tenants t WHERE t.tenant_id=c.tenant_id AND t.connection_id=c.id AND t.xero_tenant_id=?)",xeroTenantId,u.tenantId(),id,u.id(),xeroTenantId);
    if(selected!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Choose an organization returned by this Xero authorization");
    db.update("UPDATE \"sources\" SET \"status\"='CONNECTED',\"deleted\"=false,\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
    org.audit(u,"XERO_ORGANIZATION_SELECTED",Map.of("id",id,"tenantId",xeroTenantId));return owned(u,id);
  }
  private static String randomUrlToken(int bytes) {byte[] value=new byte[bytes];new SecureRandom().nextBytes(value);return Base64.getUrlEncoder().withoutPadding().encodeToString(value);}
  private static String sha256(String value) {try{return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("Secure hash unavailable");}}
  public Map<String,Object> credential(AuthenticatedPrincipal u,String id,String token) {
    if("DELETED".equals(owned(u,id).get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted; create a new connection to reconnect");
    String encrypted=vault.encrypt(token,u.tenantId()+":"+id);
    tx.executeWithoutResult(t->{
      db.update("DELETE FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      db.update("UPDATE provider_sync_runs SET status='CANCELLED',finished_at=now() WHERE tenant_id=? AND connection_id=? AND finished_at IS NULL",u.tenantId(),id);
      db.update("""
        UPDATE provider_connections SET encrypted_token=?,status='PENDING',cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,
        encrypted_refresh_token=NULL,access_token_expires_at=NULL,oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,
        next_sync_at=now(),failure_count=0,last_error=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?
        """,encrypted,u.tenantId(),id,u.id());
      db.update("UPDATE \"sources\" SET \"status\"='CONNECTED',\"deleted\"=false,\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
      org.audit(u,"CONNECTION_CREDENTIAL_REPLACED",Map.of("id",id));
    });return owned(u,id);
  }
  public Map<String,Object> disconnect(AuthenticatedPrincipal u,String id) {
    owned(u,id);tx.executeWithoutResult(t->{
      db.update("DELETE FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      db.update("UPDATE provider_sync_runs SET status='CANCELLED',finished_at=now() WHERE tenant_id=? AND connection_id=? AND finished_at IS NULL",u.tenantId(),id);
      db.update("UPDATE provider_connections SET encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,status='DISCONNECTED',oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,lease_id=NULL,lease_until=NULL,cursor=NULL,generation=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?",u.tenantId(),id,u.id());
      db.update("UPDATE \"documents\" SET \"deleted\"=true,\"updatedAt\"=now() WHERE \"sourceId\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
      db.update("UPDATE \"sources\" SET \"status\"='DISCONNECTED',\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
      org.audit(u,"CONNECTION_DISCONNECTED",Map.of("id",id));
    });return owned(u,id);
  }
  /** Permanently removes imported provider data while retaining a minimal audit tombstone. */
  public void deleteData(AuthenticatedPrincipal u,String id) {
    if("DELETED".equals(owned(u,id).get("status")))return;
    tx.executeWithoutResult(t->{
      db.update("UPDATE provider_sync_runs SET status='CANCELLED',finished_at=now(),error_code='CONNECTION_DATA_DELETED' WHERE tenant_id=? AND connection_id=? AND finished_at IS NULL",u.tenantId(),id);
      db.update("DELETE FROM work_source_mappings WHERE tenant_id=? AND record_id IN (SELECT id FROM provider_records WHERE tenant_id=? AND connection_id=?)",u.tenantId(),u.tenantId(),id);
      db.update("DELETE FROM provider_metric_observations WHERE tenant_id=? AND record_id IN (SELECT id FROM provider_records WHERE tenant_id=? AND connection_id=?)",u.tenantId(),u.tenantId(),id);
      db.update("DELETE FROM provider_financial_facts WHERE tenant_id=? AND record_id IN (SELECT id FROM provider_records WHERE tenant_id=? AND connection_id=?)",u.tenantId(),u.tenantId(),id);
      db.update("DELETE FROM provider_people_facts WHERE tenant_id=? AND record_id IN (SELECT id FROM provider_records WHERE tenant_id=? AND connection_id=?)",u.tenantId(),u.tenantId(),id);
      db.update("DELETE FROM provider_records WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      db.update("DELETE FROM \"documents\" WHERE \"sourceId\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
      db.update("UPDATE \"sources\" SET \"status\"='DISCONNECTED',\"deleted\"=true,\"updatedAt\"=now() WHERE \"id\"=(SELECT provider_source_id FROM provider_connections WHERE tenant_id=? AND id=?)",u.tenantId(),id);
      db.update("DELETE FROM provider_webhook_events WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      db.update("DELETE FROM provider_oauth_tenants WHERE tenant_id=? AND connection_id=?",u.tenantId(),id);
      db.update("UPDATE provider_connections SET encrypted_token=NULL,encrypted_refresh_token=NULL,access_token_expires_at=NULL,status='DELETED',name='Deleted connection',resource='',account_id='',cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,sync_requested=false,oauth_state_hash=NULL,oauth_state_expires_at=NULL,encrypted_pkce_verifier=NULL,last_error=NULL,next_sync_at=now()+interval '100 years',updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?",u.tenantId(),id,u.id());
      org.audit(u,"CONNECTION_DATA_DELETED",Map.of("id",id));
    });
  }
  public Object records(AuthenticatedPrincipal u,String id,int offset) {
    owned(u,id);
    return db.queryForList("""
      SELECT r.id,r.external_id,r.kind,r.title,r.status,r.source_url,r.source_updated_at,r.observed_at,
        f.amount,f.currency,h.department,h.supervisor_reference,m.metric,m.value AS metric_value,m.unit,m.period_start,m.period_end,m.campaign,m.currency AS metric_currency
      FROM provider_records r JOIN provider_connections c ON c.id=r.connection_id AND c.tenant_id=r.tenant_id
      LEFT JOIN provider_financial_facts f ON f.record_id=r.id AND f.tenant_id=r.tenant_id
      LEFT JOIN provider_people_facts h ON h.record_id=r.id AND h.tenant_id=r.tenant_id
      LEFT JOIN provider_metric_observations m ON m.record_id=r.id AND m.tenant_id=r.tenant_id
      WHERE c.tenant_id=? AND c.owner_id=? AND c.id=? AND c.status='READY'
        AND c.last_success_at>now()-interval '24 hours' AND r.deleted_at IS NULL
      ORDER BY r.external_id LIMIT 100 OFFSET ?
      """,u.tenantId(),u.id(),id,offset);
  }
  public Object runs(AuthenticatedPrincipal u,String id) {
    owned(u,id);return db.queryForList("SELECT id,status,started_at,finished_at,records_seen,error_code FROM provider_sync_runs WHERE tenant_id=? AND connection_id=? ORDER BY started_at DESC LIMIT 30",u.tenantId(),id);
  }
  public Object sync(AuthenticatedPrincipal u,String id) {
    if("DELETED".equals(owned(u,id).get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted; create a new connection to reconnect");
    // A user can refresh READY data early, but cannot bypass a provider retry deadline.
    db.update("UPDATE provider_connections SET next_sync_at=now() WHERE tenant_id=? AND id=? AND owner_id=? AND status='READY'",u.tenantId(),id,u.id());
    syncPage(id);return owned(u,id);
  }
  @Scheduled(fixedDelayString="${app.integrations.poll-interval-ms:60000}",initialDelay=60000)
  public void poll() {
    var ids=db.queryForList("""
      SELECT id FROM provider_connections WHERE encrypted_token IS NOT NULL AND status IN ('PENDING','READY','SYNCING','RETRY')
        AND (sync_requested OR next_sync_at<=now()) AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_sync_at LIMIT 10
      """,String.class);
    ids.forEach(this::syncPage);
  }
  void syncPage(String id) {
    String lease=UUID.randomUUID().toString();
    Map<String,Object> c=tx.execute(t->{
      var rows=db.queryForList("""
        SELECT * FROM provider_connections WHERE id=? AND encrypted_token IS NOT NULL
        AND status IN ('PENDING','READY','SYNCING','RETRY') AND (sync_requested OR next_sync_at<=now())
        AND (lease_until IS NULL OR lease_until<now()) FOR UPDATE SKIP LOCKED
        """,id);
      if(rows.isEmpty())return null;
      var row=rows.getFirst();
      var identity=db.queryForMap("SELECT email,role FROM users WHERE id=? AND \"tenantId\"=?",row.get("owner_id"),row.get("tenant_id"));
      var owner=new AuthenticatedPrincipal((String)row.get("owner_id"),(String)identity.get("email"),(String)row.get("tenant_id"),((String)identity.get("role")).toLowerCase());
      if(!org.canManage(owner,"INTEGRATION_MANAGE")) {
        db.update("UPDATE provider_connections SET status='FAILED',last_error='OWNER_PERMISSION_REVOKED',lease_id=NULL,lease_until=NULL WHERE id=?",id);
        db.update("UPDATE provider_sync_runs SET status='FAILED',error_code='OWNER_PERMISSION_REVOKED',finished_at=now() WHERE connection_id=? AND finished_at IS NULL",id);
        db.update("UPDATE \"documents\" SET \"deleted\"=true,\"updatedAt\"=now() WHERE \"sourceId\"=?",row.get("provider_source_id"));
        db.update("UPDATE \"sources\" SET \"status\"='ERROR',\"updatedAt\"=now() WHERE \"id\"=?",row.get("provider_source_id"));
        return null;
      }
      String generation=(String)row.get("generation");
      if ("xero".equals(row.get("provider"))) {
        db.update("UPDATE provider_webhook_events SET status='RECEIVED' WHERE connection_id=? AND status='PROCESSING'",id);
        db.update("UPDATE provider_webhook_events SET status='PROCESSING' WHERE connection_id=? AND status='RECEIVED'",id);
      }
      if(generation==null || "READY".equals(row.get("status"))) {
        generation=UUID.randomUUID().toString();row.put("generation",generation);row.put("cursor",null);
        db.update("INSERT INTO provider_sync_runs(id,tenant_id,connection_id,status) VALUES (?,?,?,'RUNNING')",generation,row.get("tenant_id"),id);
      }
      db.update("UPDATE provider_connections SET status='SYNCING',generation=?,cursor=?,sync_requested=false,lease_id=?,lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=?",generation,row.get("cursor"),lease,id);
      db.update("UPDATE \"sources\" SET \"status\"='SYNCING',\"updatedAt\"=now() WHERE \"id\"=?",row.get("provider_source_id"));
      return row;
    });
    if(c==null)return;
    try {
      String token=vault.decrypt((String)c.get("encrypted_token"),c.get("tenant_id")+":"+id);
      if(Set.of("xero","googleanalytics","googledrive").contains(c.get("provider"))&&tokenExpiresSoon(c.get("access_token_expires_at"))) {
        String storedRefresh=(String)c.get("encrypted_refresh_token");
        String provider=(String)c.get("provider"),prefix="xero".equals(provider)?"XERO":"GOOGLE"+("googledrive".equals(provider)?"_DRIVE":"");
        if(storedRefresh==null)throw new ProviderGateway.ProviderFailure(prefix+"_REFRESH_REAUTH",false,0);
        String refresh=vault.decrypt(storedRefresh,c.get("tenant_id")+":"+id+":"+provider+"-refresh");
        String accessToken,refreshToken;int expiresIn;
        if("xero".equals(provider)){var rotated=gateway.refreshXeroToken(refresh);accessToken=rotated.accessToken();refreshToken=rotated.refreshToken();expiresIn=rotated.expiresIn();}
        else if("googleanalytics".equals(provider)){var rotated=gateway.refreshGoogleAnalyticsToken(refresh);accessToken=rotated.accessToken();refreshToken=rotated.refreshToken();expiresIn=rotated.expiresIn();}
        else {var rotated=gateway.refreshGoogleDriveToken(refresh);accessToken=rotated.accessToken();refreshToken=rotated.refreshToken();expiresIn=rotated.expiresIn();}
        if(expiresIn<1)throw new ProviderGateway.ProviderFailure(prefix+"_REFRESH_OUTCOME_UNKNOWN",false,0);
        String accessCipher=vault.encrypt(accessToken,c.get("tenant_id")+":"+id);
        String refreshCipher=vault.encrypt(refreshToken,c.get("tenant_id")+":"+id+":"+provider+"-refresh");
        Integer persisted;
        try { persisted=tx.execute(t->db.update("UPDATE provider_connections SET encrypted_token=?,encrypted_refresh_token=?,access_token_expires_at=now()+(? * interval '1 second'),updated_at=now() WHERE id=? AND tenant_id=? AND lease_id=? AND status='SYNCING'",accessCipher,refreshCipher,expiresIn,id,c.get("tenant_id"),lease)); }
        catch(Exception e) { throw new ProviderGateway.ProviderFailure(prefix+"_REFRESH_OUTCOME_UNKNOWN",false,0); }
        if(persisted==null||persisted!=1)return;
        token=accessToken;
      }
      var page=gateway.fetch((String)c.get("provider"),(String)c.get("resource"),(String)c.get("account_id"),token,(String)c.get("cursor"));
      tx.executeWithoutResult(t->{
        if(db.queryForList("SELECT id FROM provider_connections WHERE id=? AND lease_id=? FOR UPDATE",id,lease).isEmpty())return;
        for(var r:page.records()) saveRecord(c,r);
        db.update("UPDATE provider_sync_runs SET records_seen=records_seen+?,status='RUNNING',error_code=NULL WHERE id=?",page.records().size(),c.get("generation"));
        if(page.nextCursor()==null) {
          db.update("UPDATE provider_records SET deleted_at=now() WHERE connection_id=? AND generation<>? AND deleted_at IS NULL",id,c.get("generation"));
          db.update("UPDATE \"documents\" SET \"deleted\"=true,\"updatedAt\"=now() WHERE \"sourceId\"=? AND \"externalId\" IN (SELECT r.id FROM provider_records r WHERE r.connection_id=? AND r.deleted_at IS NOT NULL)",c.get("provider_source_id"),id);
          db.update("UPDATE \"sources\" SET \"lastSyncAt\"=now(),\"status\"='CONNECTED',\"updatedAt\"=now() WHERE \"id\"=?",c.get("provider_source_id"));
          db.update("UPDATE provider_sync_runs SET status='SUCCEEDED',finished_at=now(),error_code=NULL WHERE id=?",c.get("generation"));
          db.update("UPDATE provider_webhook_events SET status='RECONCILED' WHERE connection_id=? AND status='PROCESSING'",id);
          boolean requested=db.queryForObject("SELECT sync_requested FROM provider_connections WHERE id=?",Boolean.class,id);
          if(requested) db.update("UPDATE provider_connections SET status='PENDING',cursor=NULL,generation=NULL,last_success_at=now(),next_sync_at=now(),failure_count=0,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=?",id);
          else db.update("UPDATE provider_connections SET status='READY',cursor=NULL,last_success_at=now(),next_sync_at=now()+interval '15 minutes',failure_count=0,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=?",id);
        } else db.update("UPDATE provider_connections SET status='PENDING',cursor=?,next_sync_at=now()+interval '60 seconds',failure_count=0,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=?",page.nextCursor(),id);
      });
    } catch(Exception e) {
      var failure=e instanceof ProviderGateway.ProviderFailure f?f:new ProviderGateway.ProviderFailure("SYNC_FAILED_RECONNECT_OR_RETRY",false,0);
      tx.executeWithoutResult(t->{
        var rows=db.queryForList("SELECT failure_count FROM provider_connections WHERE id=? AND lease_id=? FOR UPDATE",id,lease);
        if(rows.isEmpty())return;
        if("xero".equals(c.get("provider")))db.update("UPDATE provider_webhook_events SET status='RECEIVED' WHERE connection_id=? AND status='PROCESSING'",id);
        int attempts=((Number)rows.getFirst().get("failure_count")).intValue()+1;
        boolean retry=failure.retryable && attempts<5;
        boolean refreshFailure=failure.code.startsWith("XERO_REFRESH_")||failure.code.startsWith("GOOGLE_REFRESH_")||failure.code.startsWith("GOOGLE_DRIVE_REFRESH_");
        boolean auth=Set.of("PROVIDER_HTTP_401","PROVIDER_HTTP_403","PROVIDER_HTTP_404","SLACK_AUTH_OR_SCOPE_ERROR","PUBLIC_JOINED_CHANNEL_REQUIRED").contains(failure.code)||refreshFailure;
        boolean spentRefresh=refreshFailure;
        String status=retry?"RETRY":auth?"REAUTH":"FAILED";
        int delay=Math.max(failure.delaySeconds,Math.min(3600,60*(1<<Math.min(attempts,5))));
        db.update("UPDATE provider_connections SET status=?,last_error=?,failure_count=?,next_sync_at=now()+(? * interval '1 second'),encrypted_token=CASE WHEN ? THEN NULL ELSE encrypted_token END,encrypted_refresh_token=CASE WHEN ? THEN NULL ELSE encrypted_refresh_token END,access_token_expires_at=CASE WHEN ? THEN NULL ELSE access_token_expires_at END,lease_id=NULL,lease_until=NULL WHERE id=?",status,failure.code,attempts,delay,spentRefresh,spentRefresh,spentRefresh,id);
        db.update("UPDATE provider_sync_runs SET error_code=?,status=?,finished_at=CASE WHEN ? THEN NULL ELSE now() END WHERE id=?",failure.code,retry?"RETRY":status,retry,c.get("generation"));
        db.update("UPDATE \"sources\" SET \"status\"='ERROR',\"updatedAt\"=now() WHERE \"id\"=?",c.get("provider_source_id"));
        if(auth||failure.code.equals("OWNER_PERMISSION_REVOKED")) {
          db.update("UPDATE \"documents\" SET \"deleted\"=true,\"updatedAt\"=now() WHERE \"sourceId\"=?",c.get("provider_source_id"));
          db.update("UPDATE \"sources\" SET \"status\"='ERROR',\"updatedAt\"=now() WHERE \"id\"=?",c.get("provider_source_id"));
        }
      });
    }
  }
  private static boolean tokenExpiresSoon(Object value) {
    if(value==null)return false;
    Instant expires=value instanceof OffsetDateTime d?d.toInstant():value instanceof Timestamp t?t.toInstant():value instanceof Instant i?i:null;
    return expires!=null&&!expires.isAfter(Instant.now().plusSeconds(60));
  }
  private void saveRecord(Map<String,Object> c,ProviderGateway.SourceRecord r) {
    String content=providerContent(c,r);
    String id=db.queryForObject("""
      INSERT INTO provider_records(id,tenant_id,connection_id,external_id,kind,title,status,source_url,source_updated_at,generation,content)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,external_id) DO UPDATE SET
        title=EXCLUDED.title,status=EXCLUDED.status,source_url=EXCLUDED.source_url,source_updated_at=EXCLUDED.source_updated_at,
        generation=EXCLUDED.generation,content=EXCLUDED.content,observed_at=now(),deleted_at=NULL RETURNING id
      """,String.class,UUID.randomUUID().toString(),c.get("tenant_id"),c.get("id"),r.externalId(),r.kind(),
      r.title().substring(0,Math.min(r.title().length(),4000)),r.status(),r.url(),r.updatedAt(),c.get("generation"),content);
    if(indexer!=null)indexer.index((String)c.get("tenant_id"),(String)c.get("provider_source_id"),id,(String)c.get("owner_id"),r.title(),content);
    if(r.metric()!=null) {
      var m=r.metric();
      db.update("INSERT INTO provider_metric_observations(tenant_id,record_id,metric,value,unit,period_start,period_end,campaign,currency) VALUES (?,?,?,?,?,?::date,?::date,?,?) ON CONFLICT(record_id) DO UPDATE SET value=EXCLUDED.value,currency=EXCLUDED.currency",
          c.get("tenant_id"),id,m.metric(),m.value(),m.unit(),m.start(),m.end(),m.campaign(),m.currency());
    }
    if(Set.of("DEAL","INVOICE").contains(r.kind())) db.update("""
      INSERT INTO provider_financial_facts(tenant_id,record_id,amount,currency) VALUES (?,?,?,?)
      ON CONFLICT(record_id) DO UPDATE SET amount=EXCLUDED.amount,currency=EXCLUDED.currency
      """,c.get("tenant_id"),id,r.amount(),r.currency());
    if(r.kind().equals("EMPLOYEE")) db.update("""
      INSERT INTO provider_people_facts(tenant_id,record_id,department,supervisor_reference) VALUES (?,?,?,?)
      ON CONFLICT(record_id) DO UPDATE SET department=EXCLUDED.department,supervisor_reference=EXCLUDED.supervisor_reference
      """,c.get("tenant_id"),id,r.department(),r.supervisor());
  }
  private static String providerContent(Map<String,Object> connection,ProviderGateway.SourceRecord record) {
    var body=new StringBuilder("Source: ").append(connection.get("provider")).append("\nResource: ").append(connection.get("resource"))
        .append("\nRecord type: ").append(record.kind()).append("\nTitle: ").append(record.title());
    if(record.status()!=null&&!record.status().isBlank())body.append("\nStatus: ").append(record.status());
    if(record.updatedAt()!=null&&!record.updatedAt().isBlank())body.append("\nLast updated at source: ").append(record.updatedAt());
    if(record.url()!=null&&!record.url().isBlank())body.append("\nSource URL: ").append(record.url());
    if(record.amount()!=null)body.append("\nAmount: ").append(record.amount()).append(record.currency()==null?"":" "+record.currency());
    if(record.department()!=null&&!record.department().isBlank())body.append("\nDepartment: ").append(record.department());
    if(record.supervisor()!=null&&!record.supervisor().isBlank())body.append("\nSupervisor reference: ").append(record.supervisor());
    if(record.metric()!=null) {
      var metric=record.metric();body.append("\nMetric: ").append(metric.metric()).append(" = ").append(metric.value()).append(" ").append(metric.unit())
          .append("; period ").append(metric.start()).append(" through ").append(metric.end()).append("; campaign ").append(metric.campaign());
      if(metric.currency()!=null)body.append("; currency ").append(metric.currency());
    }
    if(record.content()!=null&&!record.content().isBlank())body.append("\n\nDetails:\n").append(record.content());
    return body.toString();
  }
}
