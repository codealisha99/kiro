package com.kiro.api.integration;
import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true)
class IntegrationPostgresTest {
 @Container static final PostgreSQLContainer<?> pg=new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
 static JdbcTemplate db;static IntegrationService service;static OrganizationService org;static CredentialVault vault;
 static final AtomicReference<ProviderGateway.Transport> remote=new AtomicReference<>();
 static AuthenticatedPrincipal owner=new AuthenticatedPrincipal("owner","owner@test","org","admin");
 static AuthenticatedPrincipal otherAdmin=new AuthenticatedPrincipal("otherAdmin","admin@test","org","admin");
 static AuthenticatedPrincipal outsider=new AuthenticatedPrincipal("outsider","out@test","other","admin");
 @BeforeAll static void setup() {
  var ds=new DriverManagerDataSource(pg.getJdbcUrl()+"&stringtype=unspecified",pg.getUsername(),pg.getPassword());Flyway.configure().dataSource(ds).load().migrate();
  db=new JdbcTemplate(ds);var json=new ObjectMapper().findAndRegisterModules();org=new OrganizationService(db,json);
  vault=new CredentialVault(Base64.getEncoder().encodeToString(new byte[32]));
  service=new IntegrationService(db,org,vault,new ProviderGateway(json,r->remote.get().send(r),"client-id","client-secret","https://kiro.example/integrations/xero/callback"),new DataSourceTransactionManager(ds));
  db.execute("INSERT INTO \"Tenant\"(id,name) VALUES ('org','Synthetic'),('other','Other')");
  for(var u:List.of(owner,otherAdmin,outsider))db.update("INSERT INTO users(id,\"tenantId\",email,role) VALUES (?,?,?,?)",u.id(),u.tenantId(),u.email(),u.roleUpper());
 }
 @BeforeEach void reset() {db.execute("TRUNCATE provider_connections,org_audit_events CASCADE");reply(200,"[]");}
 void reply(int status,String body) {remote.set(r->new ProviderGateway.Reply(status,body,"120"));}
 String connection(String token) {return (String)service.create(owner,new IntegrationService.ConnectionInput("github","Synthetic","a/b","",token)).get("id");}
 void due(String id) {db.update("UPDATE provider_connections SET next_sync_at=now() WHERE id=?",id);}
 String status(String id) {return (String)service.list(owner).stream().filter(c->id.equals(c.get("id"))).findFirst().orElseThrow().get("status");}
 @Test void configurationWithoutCredentialsNeverClaimsConnectedAndTokensAreEncrypted() {
  String id=connection(null);service.sync(owner,id);assertEquals("UNCONFIGURED",status(id));
  assertEquals(0L,db.queryForObject("SELECT count(*) FROM provider_sync_runs",Long.class));
  service.credential(owner,id,"secret-test-token");
  assertFalse(db.queryForObject("SELECT encrypted_token FROM provider_connections WHERE id=?",String.class,id).contains("secret-test-token"));
  assertFalse(service.list(owner).toString().contains("secret-test-token"));
  assertFalse(org.auditHistory(owner).toString().contains("secret-test-token"));
 }
 @Test void marketingMetricsPersistWithUnitsPeriodsAndPrivateOwnership() {
  String id=(String)service.create(owner,new IntegrationService.ConnectionInput("googleanalytics","Synthetic campaign","123","","test-token")).get("id");
  reply(200,"{\"rowCount\":1,\"rows\":[{\"dimensionValues\":[{\"value\":\"Launch\"}],\"metricValues\":[{\"value\":\"100\"},{\"value\":\"5\"},{\"value\":\"12.50\"}]}],\"metadata\":{\"currencyCode\":\"USD\"}}");
  service.sync(owner,id);assertEquals("READY",status(id));
  assertEquals(3,((List<?>)service.records(owner,id,0)).size());
  assertEquals(3L,db.queryForObject("SELECT count(*) FROM provider_metric_observations",Long.class));
  service.sync(owner,id);assertEquals(3L,db.queryForObject("SELECT count(*) FROM provider_metric_observations",Long.class));
  assertThrows(ResponseStatusException.class,()->service.records(otherAdmin,id,0));
 }
 @Test void fullReconciliationIsIdempotentAndExpiresMissingRecords() {
  String id=connection("secret-test-token");reply(200,"[{\"id\":1,\"title\":\"Task\",\"state\":\"open\"}]");service.sync(owner,id);
  assertEquals("READY",status(id));assertEquals(1,((List<?>)service.records(owner,id,0)).size());
  service.sync(owner,id);assertEquals(1L,db.queryForObject("SELECT count(*) FROM provider_records",Long.class));
  reply(200,"[]");service.sync(owner,id);assertTrue(((List<?>)service.records(owner,id,0)).isEmpty());
  assertEquals(1L,db.queryForObject("SELECT count(*) FROM provider_records WHERE deleted_at IS NOT NULL",Long.class));
  assertEquals(3L,db.queryForObject("SELECT count(*) FROM provider_sync_runs WHERE status='SUCCEEDED'",Long.class));
 }
 @Test void rateLimitWaitsAndAuthFailuresHidePreviouslyImportedRecords() {
  String id=connection("secret-test-token");reply(429,"sensitive provider error");service.sync(owner,id);assertEquals("RETRY",status(id));
  assertFalse(service.list(owner).toString().contains("sensitive provider error"));
  reply(200,"[{\"id\":1,\"title\":\"Task\"}]");service.sync(owner,id);assertEquals("RETRY",status(id));
  due(id);service.sync(owner,id);assertEquals("READY",status(id));
  reply(403,"private content");service.sync(owner,id);assertEquals("REAUTH",status(id));assertTrue(((List<?>)service.records(owner,id,0)).isEmpty());
 }
 @Test void connectionOwnershipIsRequiredEvenForAnotherAdministrator() {
  String id=connection("secret-test-token");service.sync(owner,id);
  for(var denied:List.of(otherAdmin,outsider)) {
   assertTrue(service.list(denied).isEmpty());
   assertThrows(ResponseStatusException.class,()->service.records(denied,id,0));
   assertThrows(ResponseStatusException.class,()->service.runs(denied,id));
   assertThrows(ResponseStatusException.class,()->service.credential(denied,id,"replacement"));
   assertThrows(ResponseStatusException.class,()->service.sync(denied,id));
  }
 }
 @Test void disconnectDuringFetchDiscardsInFlightResultsAndDeletesCredential() {
  String id=connection("secret-test-token");remote.set(r->{service.disconnect(owner,id);return new ProviderGateway.Reply(200,"[{\"id\":1,\"title\":\"Late result\"}]","60");});
  service.sync(owner,id);assertEquals("DISCONNECTED",status(id));assertEquals(0L,db.queryForObject("SELECT count(*) FROM provider_records",Long.class));
  assertNull(db.queryForMap("SELECT encrypted_token FROM provider_connections WHERE id=?",id).get("encrypted_token"));
  assertEquals("CANCELLED",db.queryForObject("SELECT status FROM provider_sync_runs",String.class));
 }
 @Test void permanentDataDeletionIsOwnerScopedAndRemovesImportedFacts() {
  String id=(String)service.create(owner,new IntegrationService.ConnectionInput("googleanalytics","Synthetic campaign","123","","test-token")).get("id");
  reply(200,"{\"rowCount\":1,\"rows\":[{\"dimensionValues\":[{\"value\":\"Launch\"}],\"metricValues\":[{\"value\":\"100\"},{\"value\":\"5\"},{\"value\":\"12.50\"}]}],\"metadata\":{\"currencyCode\":\"USD\"}}");
  service.sync(owner,id);assertEquals(3L,db.queryForObject("SELECT count(*) FROM provider_metric_observations",Long.class));
  assertThrows(ResponseStatusException.class,()->service.deleteData(otherAdmin,id));
  service.deleteData(owner,id);
  assertEquals("DELETED",status(id));assertEquals(0L,db.queryForObject("SELECT count(*) FROM provider_records",Long.class));
  assertEquals(0L,db.queryForObject("SELECT count(*) FROM provider_metric_observations",Long.class));
  assertNull(db.queryForObject("SELECT encrypted_token FROM provider_connections WHERE id=?",String.class,id));
  assertTrue(org.auditHistory(owner).toString().contains("CONNECTION_DATA_DELETED"));
  assertThrows(ResponseStatusException.class,()->service.credential(owner,id,"replacement"));
  assertThrows(ResponseStatusException.class,()->service.sync(owner,id));
  service.poll();assertEquals("DELETED",status(id));
 }
 @Test void xeroOauthBindsStateOwnerAndTenantThenRotatesEncryptedRefreshToken() throws Exception {
  String id=(String)service.create(owner,new IntegrationService.ConnectionInput("xero","Xero account","","",null)).get("id");
  var started=service.startXeroOAuth(owner,id);String query=java.net.URI.create(started.authorizationUrl()).getRawQuery();
  String state=Arrays.stream(query.split("&")).filter(p->p.startsWith("state=")).map(p->java.net.URLDecoder.decode(p.substring(6),java.nio.charset.StandardCharsets.UTF_8)).findFirst().orElseThrow();
  String stateHash=Base64.getEncoder().encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(state.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  assertEquals(stateHash,db.queryForObject("SELECT oauth_state_hash FROM provider_connections WHERE id=?",String.class,id));
  assertTrue(db.queryForObject("SELECT encrypted_pkce_verifier FROM provider_connections WHERE id=?",String.class,id).contains("."));
  remote.set(r->r.uri().getHost().equals("identity.xero.com")
    ?new ProviderGateway.Reply(200,"{\"access_token\":\"xero-access-1\",\"refresh_token\":\"xero-refresh-1\",\"expires_in\":1800}","60")
    :new ProviderGateway.Reply(200,"[{\"tenantId\":\"12345678-1234-1234-1234-123456789012\",\"tenantName\":\"Example Books\"}]","60"));
  assertEquals(id,service.completeXeroOAuth(state,"one-time-code"));assertEquals("OAUTH_TENANT",status(id));
  assertFalse(db.queryForObject("SELECT encrypted_token FROM provider_connections WHERE id=?",String.class,id).contains("xero-access-1"));
  assertFalse(db.queryForObject("SELECT encrypted_refresh_token FROM provider_connections WHERE id=?",String.class,id).contains("xero-refresh-1"));
  assertThrows(ResponseStatusException.class,()->service.xeroTenants(otherAdmin,id));
  assertThrows(ResponseStatusException.class,()->service.selectXeroTenant(owner,id,"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"));
  service.selectXeroTenant(owner,id,"12345678-1234-1234-1234-123456789012");assertEquals("PENDING",status(id));
  assertThrows(ResponseStatusException.class,()->service.completeXeroOAuth(state,"replay-code"));
  db.update("UPDATE provider_connections SET access_token_expires_at=now()-interval '1 second',next_sync_at=now() WHERE id=?",id);
  var requests=new ArrayList<java.net.http.HttpRequest>();
  remote.set(r->{requests.add(r);if(r.uri().getHost().equals("identity.xero.com"))return new ProviderGateway.Reply(200,"{\"access_token\":\"xero-access-2\",\"refresh_token\":\"xero-refresh-2\",\"expires_in\":1800}","60");
    assertEquals("Bearer xero-access-2",r.headers().firstValue("Authorization").orElseThrow());
    return new ProviderGateway.Reply(200,"{\"Invoices\":[]}","60");});
  service.sync(owner,id);assertEquals("READY",status(id));assertEquals(2,requests.size());
  assertTrue(db.queryForObject("SELECT encrypted_refresh_token FROM provider_connections WHERE id=?",String.class,id).length()>30);
  assertFalse(db.queryForObject("SELECT encrypted_refresh_token FROM provider_connections WHERE id=?",String.class,id).contains("xero-refresh-2"));
 }
 @Test void partialScanWithholdsRecordsAndContinuesStoredCursor() {
  String id=connection("secret-test-token");var records=new ArrayList<String>();for(int i=0;i<100;i++)records.add("{\"id\":"+i+",\"title\":\"Task\"}");
  reply(200,"["+String.join(",",records)+"]");service.sync(owner,id);assertEquals("PENDING",status(id));
  assertEquals("2",db.queryForObject("SELECT cursor FROM provider_connections WHERE id=?",String.class,id));
  assertTrue(((List<?>)service.records(owner,id,0)).isEmpty());
  remote.set(r->{assertTrue(r.uri().toString().endsWith("page=2"));return new ProviderGateway.Reply(200,"[]","60");});due(id);service.sync(owner,id);
  assertEquals("READY",status(id));assertEquals(100,((List<?>)service.records(owner,id,0)).size());
 }
 @Test void backgroundSyncStopsWhenOwnerLosesIntegrationPermission() {
  String id=connection("secret-test-token");
  db.update("UPDATE users SET role='EMPLOYEE' WHERE id='owner'");
  try {
   remote.set(r->{fail("Revoked owner must not contact the provider");return null;});
   service.syncPage(id);
   assertEquals("FAILED",db.queryForObject("SELECT status FROM provider_connections WHERE id=?",String.class,id));
   assertEquals("OWNER_PERMISSION_REVOKED",db.queryForObject("SELECT last_error FROM provider_connections WHERE id=?",String.class,id));
   assertEquals(0L,db.queryForObject("SELECT count(*) FROM provider_records",Long.class));
  } finally { db.update("UPDATE users SET role='ADMIN' WHERE id='owner'"); }
 }
}
