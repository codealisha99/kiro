package com.kiro.api.work;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.integration.*;
import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true)
class WorkActionPostgresTest {
 @Container static final PostgreSQLContainer<?> pg=new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
 static JdbcTemplate db;static WorkService work;static WorkActionService actions;static TransactionTemplate tx;static ProviderGateway gateway;
 static final AuthenticatedPrincipal owner=new AuthenticatedPrincipal("owner","o@test","org","admin");
 static final AuthenticatedPrincipal editor=new AuthenticatedPrincipal("editor","e@test","org","employee");
 static final AuthenticatedPrincipal reader=new AuthenticatedPrincipal("reader","r@test","org","employee");
 static final AuthenticatedPrincipal outsider=new AuthenticatedPrincipal("outsider","x@test","other","admin");
 String project,connection;
 @BeforeAll static void setup() {
  var ds=new DriverManagerDataSource(pg.getJdbcUrl()+"&stringtype=unspecified",pg.getUsername(),pg.getPassword());
  Flyway.configure().dataSource(ds).load().migrate();db=new JdbcTemplate(ds);var tm=new DataSourceTransactionManager(ds);tx=new TransactionTemplate(tm);
  var json=new ObjectMapper().findAndRegisterModules();work=new WorkService(db,json,new WorkInsightEngine(db,tm));gateway=mock(ProviderGateway.class);
  actions=new WorkActionService(db,work,new OrganizationService(db,json),new CredentialVault(Base64.getEncoder().encodeToString(new byte[32])),gateway,tm);
  db.execute("INSERT INTO \"Tenant\"(id,name) VALUES ('org','Synthetic'),('other','Other')");
  for(var u:List.of(owner,editor,reader,outsider))db.update("INSERT INTO users(id,\"tenantId\",email,role) VALUES (?,?,?,?)",u.id(),u.tenantId(),u.email(),u.roleUpper());
 }
 @BeforeEach void prepare() {
  reset(gateway);db.execute("TRUNCATE work_projects,provider_connections CASCADE");
  project=tx.execute(t->(String)work.createProject(owner,new WorkDtos.ProjectInput("Synthetic action project")).get("id"));
  tx.execute(t->work.grant(owner,project,new WorkDtos.GrantInput(editor.id(),"WRITE"),false));
  tx.execute(t->work.grant(owner,project,new WorkDtos.GrantInput(reader.id(),"READ"),false));
  connection=UUID.randomUUID().toString();var vault=new CredentialVault(Base64.getEncoder().encodeToString(new byte[32]));
  db.update("INSERT INTO provider_connections(id,tenant_id,owner_id,provider,name,resource,status,encrypted_token,last_success_at) VALUES (?,'org','owner','github','Synthetic','example/repo','READY',?,now())",connection,vault.encrypt("synthetic-token","org:"+connection));
 }
 String propose() {return (String)((Map<?,?>)actions.propose(owner,project,new WorkActionService.Proposal(connection,"Reviewed title","Exact body","Evidence and risks",true))).get("id");}
 void approve(String id) {actions.decide(editor,project,id,new WorkActionService.Decision(1,true,"Reviewed"));}
 @Test void independentApprovalAndExecutionAreEnforcedAndIdempotent() {
  String id=propose();
  assertThrows(ResponseStatusException.class,()->actions.execute(owner,project,id,new WorkActionService.Execution(1,true)));
  assertThrows(ResponseStatusException.class,()->actions.decide(owner,project,id,new WorkActionService.Decision(1,true,"Self")));
  assertThrows(ResponseStatusException.class,()->actions.decide(reader,project,id,new WorkActionService.Decision(1,true,"Reader")));
  assertThrows(ResponseStatusException.class,()->actions.list(outsider,project,0));
  approve(id);
  assertThrows(ResponseStatusException.class,()->actions.execute(editor,project,id,new WorkActionService.Execution(2,true)));
  when(gateway.createGitHubIssue("example/repo","synthetic-token","Reviewed title","Exact body",id)).thenReturn(Map.of("externalId","123","url","https://github.com/example/repo/issues/1"));
  assertEquals("EXECUTED",((Map<?,?>)actions.execute(owner,project,id,new WorkActionService.Execution(2,true))).get("status"));
  assertThrows(ResponseStatusException.class,()->actions.execute(owner,project,id,new WorkActionService.Execution(2,true)));
  verify(gateway,times(1)).createGitHubIssue(anyString(),anyString(),anyString(),anyString(),anyString());
  assertFalse(actions.list(reader,project,0).toString().contains("synthetic-token"));
  assertEquals(4L,db.queryForObject("SELECT count(*) FROM work_events WHERE kind='PROVIDER_ACTION'",Long.class));
 }
 @Test void revokedApproverAndDisconnectedCredentialsPreventProviderCalls() {
  String id=propose();approve(id);
  tx.execute(t->work.grant(owner,project,new WorkDtos.GrantInput(editor.id(),"WRITE"),true));
  assertThrows(ResponseStatusException.class,()->actions.execute(owner,project,id,new WorkActionService.Execution(2,true)));
  tx.execute(t->work.grant(owner,project,new WorkDtos.GrantInput(editor.id(),"WRITE"),false));
  db.update("UPDATE provider_connections SET status='DISCONNECTED',encrypted_token=NULL WHERE id=?",connection);
  assertThrows(ResponseStatusException.class,()->actions.execute(owner,project,id,new WorkActionService.Execution(2,true)));
  verifyNoInteractions(gateway);
 }
 @Test void ambiguousProviderResultIsNeverAutomaticallyRetried() {
  String id=propose();approve(id);
  when(gateway.createGitHubIssue(anyString(),anyString(),anyString(),anyString(),anyString())).thenThrow(new ProviderGateway.ProviderFailure("PROVIDER_TIMEOUT",true,60));
  assertEquals("UNKNOWN",((Map<?,?>)actions.execute(owner,project,id,new WorkActionService.Execution(2,true))).get("status"));
  assertThrows(ResponseStatusException.class,()->actions.execute(owner,project,id,new WorkActionService.Execution(4,true)));
  actions.recoverInterruptedExecutions();verify(gateway,times(1)).createGitHubIssue(anyString(),anyString(),anyString(),anyString(),anyString());
 }
 @Test void recoveryMarksAnInterruptedAttemptUnknownWithoutSendingAnything() {
  String id=propose();approve(id);
  db.update("UPDATE work_actions SET status='EXECUTING',started_at=now()-interval '3 minutes' WHERE id=?",id);
  actions.recoverInterruptedExecutions();assertEquals("UNKNOWN",actions.list(owner,project,0).getFirst().get("status"));verifyNoInteractions(gateway);
 }
}
