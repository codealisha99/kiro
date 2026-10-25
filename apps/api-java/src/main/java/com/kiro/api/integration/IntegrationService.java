package com.kiro.api.integration;

import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
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
  private final ProviderGateway gateway;private final TransactionTemplate tx;
  public IntegrationService(JdbcTemplate db,OrganizationService org,CredentialVault vault,ProviderGateway gateway,PlatformTransactionManager manager) {
    this.db=db;this.org=org;this.vault=vault;this.gateway=gateway;this.tx=new TransactionTemplate(manager);
  }
  public record ConnectionInput(@NotBlank @Pattern(regexp="github|slack|linear|hubspot|xero|bamboohr|googleanalytics") String provider,
      @NotBlank @Size(max=200) String name,@NotBlank @Size(max=200) String resource,@Size(max=100) String accountId,
      @Size(max=10000) String token) {}
  public record TokenInput(@NotBlank @Size(max=10000) String token) {}
  private static final String PUBLIC="id,provider,name,resource,account_id,status,cursor,last_success_at,next_sync_at,last_error,created_at";
  public Map<String,Object> catalog(AuthenticatedPrincipal u) {
    return Map.of("canManage",org.canManage(u,"INTEGRATION_MANAGE"),"credentialStorageReady",vault.available(),"providers",List.of(
      capability("github","GitHub","Repository owner/name","","Issues and pull requests","Fine-grained token: selected repository Issues read (and Pull requests read for private PRs)"),
      capability("googleanalytics","Google Analytics 4","Numeric property ID","","30 reporting dates ending two UTC dates ago: sessions, key events and revenue by first-user campaign. Dates use the property timezone; attribution, delayed reporting and thresholding can affect results.","OAuth access token: analytics.readonly with property access; reconnect after expiry"),
      capability("slack","Slack","Approved public channel ID","Workspace subdomain","Messages in one joined public channel; no DMs, private channels or thread replies","Bot token: channels:read, channels:history; bot must join channel"),
      capability("linear","Linear","Team UUID","","Team issues","Personal API key restricted to the selected team; read access"),
      capability("hubspot","HubSpot","Portal ID","","Deals: name, stage, amount and currency","Private app token: crm.objects.deals.read"),
      capability("xero","Xero","Xero tenant UUID","","Invoices: number, status, total and currency","OAuth access token: accounting.transactions.read; reconnect after expiry"),
      capability("bamboohr","BambooHR","Company subdomain","","Shared employee directory; no compensation, medical or payroll data","API key for a user authorized for the directory")
    ));
  }
  private Map<String,String> capability(String id,String name,String resource,String account,String entities,String permissions) {
    return Map.of("id",id,"name",name,"resourceLabel",resource,"accountLabel",account,"entities",entities,"permissions",permissions,
      "sync","Read-only full reconciliation, one page per job; automatic polling every minute, full refresh every 15 minutes. Missing records expire only after a completed scan.",
      "visibility","Visible only to the connection owner with integration management permission; not included in RAG or shared dashboards.");
  }
  public List<Map<String,Object>> list(AuthenticatedPrincipal u) {
    org.requireManage(u,"INTEGRATION_MANAGE");return db.queryForList("SELECT "+PUBLIC+" FROM provider_connections WHERE tenant_id=? AND owner_id=? ORDER BY created_at DESC LIMIT 100",u.tenantId(),u.id());
  }
  private Map<String,Object> owned(AuthenticatedPrincipal u,String id) {
    org.requireManage(u,"INTEGRATION_MANAGE");var rows=db.queryForList("SELECT "+PUBLIC+" FROM provider_connections WHERE tenant_id=? AND owner_id=? AND id=?",u.tenantId(),u.id(),id);
    if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Connection not found");return rows.getFirst();
  }
  public Map<String,Object> create(AuthenticatedPrincipal u,ConnectionInput input) {
    org.requireManage(u,"INTEGRATION_MANAGE");String account=Objects.requireNonNullElse(input.accountId(),"");
    try {gateway.validate(input.provider(),input.resource(),account);}catch(ProviderGateway.ProviderFailure e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,e.code);}
    String id=UUID.randomUUID().toString();boolean configured=input.token()!=null&&!input.token().isBlank();
    String encrypted=configured?vault.encrypt(input.token(),u.tenantId()+":"+id):null;
    tx.executeWithoutResult(t->{
      db.update("INSERT INTO provider_connections(id,tenant_id,owner_id,provider,name,resource,account_id,encrypted_token,status) VALUES (?,?,?,?,?,?,?,?,?)",
        id,u.tenantId(),u.id(),input.provider(),input.name().trim(),input.resource(),account,encrypted,configured?"PENDING":"UNCONFIGURED");
      org.audit(u,"CONNECTION_CREATED",Map.of("id",id,"provider",input.provider()));
    });return owned(u,id);
  }
  public Map<String,Object> credential(AuthenticatedPrincipal u,String id,String token) {
    if("DELETED".equals(owned(u,id).get("status")))throw new ResponseStatusException(HttpStatus.GONE,"Connection data was permanently deleted; create a new connection to reconnect");
    String encrypted=vault.encrypt(token,u.tenantId()+":"+id);
    tx.executeWithoutResult(t->{
      db.update("UPDATE provider_sync_runs SET status='CANCELLED',finished_at=now() WHERE tenant_id=? AND connection_id=? AND finished_at IS NULL",u.tenantId(),id);
      db.update("""
        UPDATE provider_connections SET encrypted_token=?,status='PENDING',cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,
        next_sync_at=now(),failure_count=0,last_error=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?
        """,encrypted,u.tenantId(),id,u.id());
      org.audit(u,"CONNECTION_CREDENTIAL_REPLACED",Map.of("id",id));
    });return owned(u,id);
  }
  public Map<String,Object> disconnect(AuthenticatedPrincipal u,String id) {
    owned(u,id);tx.executeWithoutResult(t->{
      db.update("UPDATE provider_sync_runs SET status='CANCELLED',finished_at=now() WHERE tenant_id=? AND connection_id=? AND finished_at IS NULL",u.tenantId(),id);
      db.update("UPDATE provider_connections SET encrypted_token=NULL,status='DISCONNECTED',lease_id=NULL,lease_until=NULL,cursor=NULL,generation=NULL,updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?",u.tenantId(),id,u.id());
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
      db.update("UPDATE provider_connections SET encrypted_token=NULL,status='DELETED',name='Deleted connection',resource='',account_id='',cursor=NULL,generation=NULL,lease_id=NULL,lease_until=NULL,last_error=NULL,next_sync_at=now()+interval '100 years',updated_at=now() WHERE tenant_id=? AND id=? AND owner_id=?",u.tenantId(),id,u.id());
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
        AND next_sync_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_sync_at LIMIT 10
      """,String.class);
    ids.forEach(this::syncPage);
  }
  void syncPage(String id) {
    String lease=UUID.randomUUID().toString();
    Map<String,Object> c=tx.execute(t->{
      var rows=db.queryForList("""
        SELECT * FROM provider_connections WHERE id=? AND encrypted_token IS NOT NULL
        AND status IN ('PENDING','READY','SYNCING','RETRY') AND next_sync_at<=now()
        AND (lease_until IS NULL OR lease_until<now()) FOR UPDATE SKIP LOCKED
        """,id);
      if(rows.isEmpty())return null;
      var row=rows.getFirst();
      var identity=db.queryForMap("SELECT email,role FROM users WHERE id=? AND \"tenantId\"=?",row.get("owner_id"),row.get("tenant_id"));
      var owner=new AuthenticatedPrincipal((String)row.get("owner_id"),(String)identity.get("email"),(String)row.get("tenant_id"),((String)identity.get("role")).toLowerCase());
      if(!org.canManage(owner,"INTEGRATION_MANAGE")) {
        db.update("UPDATE provider_connections SET status='FAILED',last_error='OWNER_PERMISSION_REVOKED',lease_id=NULL,lease_until=NULL WHERE id=?",id);
        db.update("UPDATE provider_sync_runs SET status='FAILED',error_code='OWNER_PERMISSION_REVOKED',finished_at=now() WHERE connection_id=? AND finished_at IS NULL",id);
        return null;
      }
      String generation=(String)row.get("generation");
      if(generation==null || "READY".equals(row.get("status"))) {
        generation=UUID.randomUUID().toString();row.put("generation",generation);row.put("cursor",null);
        db.update("INSERT INTO provider_sync_runs(id,tenant_id,connection_id,status) VALUES (?,?,?,'RUNNING')",generation,row.get("tenant_id"),id);
      }
      db.update("UPDATE provider_connections SET status='SYNCING',generation=?,cursor=?,lease_id=?,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=?",generation,row.get("cursor"),lease,id);
      return row;
    });
    if(c==null)return;
    try {
      String token=vault.decrypt((String)c.get("encrypted_token"),c.get("tenant_id")+":"+id);
      var page=gateway.fetch((String)c.get("provider"),(String)c.get("resource"),(String)c.get("account_id"),token,(String)c.get("cursor"));
      tx.executeWithoutResult(t->{
        if(db.queryForList("SELECT id FROM provider_connections WHERE id=? AND lease_id=? FOR UPDATE",id,lease).isEmpty())return;
        for(var r:page.records()) saveRecord(c,r);
        db.update("UPDATE provider_sync_runs SET records_seen=records_seen+?,status='RUNNING',error_code=NULL WHERE id=?",page.records().size(),c.get("generation"));
        if(page.nextCursor()==null) {
          db.update("UPDATE provider_records SET deleted_at=now() WHERE connection_id=? AND generation<>? AND deleted_at IS NULL",id,c.get("generation"));
          db.update("UPDATE provider_sync_runs SET status='SUCCEEDED',finished_at=now(),error_code=NULL WHERE id=?",c.get("generation"));
          db.update("UPDATE provider_connections SET status='READY',cursor=NULL,last_success_at=now(),next_sync_at=now()+interval '15 minutes',failure_count=0,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=?",id);
        } else db.update("UPDATE provider_connections SET status='PENDING',cursor=?,next_sync_at=now()+interval '60 seconds',failure_count=0,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=?",page.nextCursor(),id);
      });
    } catch(Exception e) {
      var failure=e instanceof ProviderGateway.ProviderFailure f?f:new ProviderGateway.ProviderFailure("SYNC_FAILED_RECONNECT_OR_RETRY",false,0);
      tx.executeWithoutResult(t->{
        var rows=db.queryForList("SELECT failure_count FROM provider_connections WHERE id=? AND lease_id=? FOR UPDATE",id,lease);
        if(rows.isEmpty())return;
        int attempts=((Number)rows.getFirst().get("failure_count")).intValue()+1;
        boolean retry=failure.retryable && attempts<5;
        boolean auth=Set.of("PROVIDER_HTTP_401","PROVIDER_HTTP_403","PROVIDER_HTTP_404","SLACK_AUTH_OR_SCOPE_ERROR","PUBLIC_JOINED_CHANNEL_REQUIRED").contains(failure.code);
        String status=retry?"RETRY":auth?"REAUTH":"FAILED";
        int delay=Math.max(failure.delaySeconds,Math.min(3600,60*(1<<Math.min(attempts,5))));
        db.update("UPDATE provider_connections SET status=?,last_error=?,failure_count=?,next_sync_at=now()+(? * interval '1 second'),lease_id=NULL,lease_until=NULL WHERE id=?",status,failure.code,attempts,delay,id);
        db.update("UPDATE provider_sync_runs SET error_code=?,status=?,finished_at=CASE WHEN ? THEN NULL ELSE now() END WHERE id=?",failure.code,retry?"RETRY":status,retry,c.get("generation"));
      });
    }
  }
  private void saveRecord(Map<String,Object> c,ProviderGateway.SourceRecord r) {
    String id=db.queryForObject("""
      INSERT INTO provider_records(id,tenant_id,connection_id,external_id,kind,title,status,source_url,source_updated_at,generation)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,external_id) DO UPDATE SET
        title=EXCLUDED.title,status=EXCLUDED.status,source_url=EXCLUDED.source_url,source_updated_at=EXCLUDED.source_updated_at,
        generation=EXCLUDED.generation,observed_at=now(),deleted_at=NULL RETURNING id
      """,String.class,UUID.randomUUID().toString(),c.get("tenant_id"),c.get("id"),r.externalId(),r.kind(),
      r.title().substring(0,Math.min(r.title().length(),4000)),r.status(),r.url(),r.updatedAt(),c.get("generation"));
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
}
