package com.kiro.api.organization;
import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.work.*;
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
import static com.kiro.api.organization.OrganizationService.*;

@Testcontainers(disabledWithoutDocker=true)
class OrganizationPostgresTest {
 @Container static final PostgreSQLContainer<?> pg=new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
 static JdbcTemplate db;static OrganizationService org;static OrganizationDashboard dashboard;static WorkService work;static TransactionTemplate tx;
 static AuthenticatedPrincipal admin=new AuthenticatedPrincipal("admin","a@test","org","admin");
 static AuthenticatedPrincipal employee=new AuthenticatedPrincipal("employee","e@test","org","employee");
 static AuthenticatedPrincipal manager=new AuthenticatedPrincipal("manager","m@test","org","employee");
 static AuthenticatedPrincipal outsider=new AuthenticatedPrincipal("outsider","x@test","other","admin");
 @BeforeAll static void setup() {
  var ds=new DriverManagerDataSource(pg.getJdbcUrl()+"&stringtype=unspecified",pg.getUsername(),pg.getPassword());
  Flyway.configure().dataSource(ds).load().migrate();db=new JdbcTemplate(ds);var tm=new DataSourceTransactionManager(ds);tx=new TransactionTemplate(tm);
  var json=new ObjectMapper().findAndRegisterModules();org=new OrganizationService(db,json);dashboard=new OrganizationDashboard(db,org);work=new WorkService(db,json,new WorkInsightEngine(db,tm));
  db.execute("INSERT INTO \"Tenant\"(id,name) VALUES ('org','Synthetic'),('other','Other')");
  for(var u:List.of(admin,employee,manager,outsider))db.update("INSERT INTO users(id,\"tenantId\",email,role) VALUES (?,?,?,?)",u.id(),u.tenantId(),u.email(),u.roleUpper());
 }
 @BeforeEach void reset() {db.execute("TRUNCATE org_roles,org_departments,org_audit_events,org_reporting_lines,work_projects CASCADE");org.setup(admin);}
 String department(String name) {return (String)org.department(admin,new NameInput(name)).get("id");}
 String team(String d) {return (String)org.team(admin,new TeamInput("Delivery",d)).get("id");}
 String project(String team,boolean restricted) {
  String p=tx.execute(t->(String)work.createProject(admin,new WorkDtos.ProjectInput("Launch")).get("id"));
  tx.execute(t->work.organizationalScope(admin,p,team,restricted));return p;
 }
 @Test void rolesAreScopedAndRestrictedProjectsRemainPrivateAcrossAllReads() {
  String d=department("Engineering"),t=team(d),p=project(t,false),secret=project(t,true);
  tx.execute(x->work.saveTask(admin,p,null,new WorkDtos.TaskInput("Release","BLOCKED",null,null,null,null)));
  tx.execute(x->work.saveTask(admin,secret,null,new WorkDtos.TaskInput("Sensitive","BLOCKED",null,null,null,null)));
  assertTrue(work.projects(manager,0).isEmpty());
  var binding=tx.execute(x->org.bind(admin,new BindingInput("org:role:manager",manager.id(),"TEAM",null,t)));
  assertEquals(1,work.projects(manager,0).size());
  assertEquals(1L,((Map<?,?>)work.overview(manager).get("metrics")).get("total_tasks"));
  assertEquals(2,work.insightList(manager,0).size());
  assertThrows(ResponseStatusException.class,()->tx.execute(x->work.detail(manager,secret,0)));
  assertTrue((Boolean)((Map<?,?>)tx.execute(x->work.detail(manager,p,0)).get("project")).get("can_write"));
  assertThrows(ResponseStatusException.class,()->dashboard.dashboard(manager,"CEO"));
  assertTrue(dashboard.dashboard(manager,"MANAGER").containsKey("workload"));
  tx.execute(x->org.revoke(admin,(String)binding.get("id")));
  assertTrue(work.projects(manager,0).isEmpty());assertTrue(work.insightList(manager,0).isEmpty());
  assertThrows(ResponseStatusException.class,()->dashboard.dashboard(manager,"MANAGER"));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->work.history(manager,p,0)));
 }
 @Test void teamMembersGetReadOnlyAccessAndPersonalDashboardUsesAssignments() {
  String t=team(department("Product")),p=project(t,false);
  tx.execute(x->org.membership(admin,new MemberInput(t,employee.id(),false)));
  tx.execute(x->work.saveTask(admin,p,null,new WorkDtos.TaskInput("Mine","TODO",employee.id(),null,null,null)));
  tx.execute(x->work.saveTask(admin,p,null,new WorkDtos.TaskInput("Other","TODO",admin.id(),null,null,null)));
  assertEquals(1L,((Map<?,?>)dashboard.dashboard(employee,"EMPLOYEE").get("metrics")).get("tasks"));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->work.saveTask(employee,p,null,new WorkDtos.TaskInput("Denied","TODO",null,null,null,null))));
  tx.execute(x->org.membership(admin,new MemberInput(t,employee.id(),true)));
  assertEquals(0L,((Map<?,?>)dashboard.dashboard(employee,"EMPLOYEE").get("metrics")).get("tasks"));
 }
 @Test void hierarchyAllowsMultipleManagersButRejectsCyclesAndForeignTenantIds() {
  tx.execute(x->org.reporting(admin,new ReportingInput(employee.id(),manager.id(),false)));
  tx.execute(x->org.reporting(admin,new ReportingInput(employee.id(),admin.id(),false)));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->org.reporting(admin,new ReportingInput(manager.id(),employee.id(),false))));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->org.reporting(admin,new ReportingInput(employee.id(),outsider.id(),false))));
  assertThrows(ResponseStatusException.class,()->org.department(employee,new NameInput("Denied")));
  String t=team(department("Product"));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->org.bind(outsider,new BindingInput("org:role:ceo",outsider.id(),"TEAM",null,t))));
 }
 @Test void changingRolePermissionsImmediatelyRevokesWritesAndPreservesAudit() {
  String t=team(department("Engineering")),p=project(t,false);
  tx.execute(x->org.bind(admin,new BindingInput("org:role:director",manager.id(),"DEPARTMENT",(String)db.queryForMap("SELECT department_id FROM org_teams WHERE id=?",t).get("department_id"),null)));
  assertTrue(dashboard.dashboard(manager,"DIRECTOR").containsKey("teams"));
  tx.execute(x->org.role(admin,"org:role:director",new RoleInput("Read-only director","DIRECTOR",Set.of("PROJECT_READ"),1)));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->work.saveTask(manager,p,null,new WorkDtos.TaskInput("Denied","TODO",null,null,null,null))));
  assertThrows(ResponseStatusException.class,()->tx.execute(x->org.role(admin,"org:role:director",new RoleInput("Stale","DIRECTOR",Set.of("PROJECT_READ"),1))));
  assertTrue(db.queryForObject("SELECT count(*) FROM org_audit_events WHERE kind='ROLE_CONFIGURED'",Long.class)>0);
 }
 @Test void executiveViewsUseOnlyGrantedDepartmentsAndNeverImplicitAdminBusinessAccess() {
  String d=department("Sales"),p=project(team(d),false);project(team(department("Other")),false);
  for(String role:List.of("vp","ceo"))tx.execute(x->org.bind(admin,new BindingInput("org:role:"+role,manager.id(),"DEPARTMENT",d,null)));
  for(String view:List.of("VP","CEO"))assertEquals(1,((List<?>)dashboard.dashboard(manager,view).get("projects")).size());
  assertTrue(work.projects(outsider,0).isEmpty());
  assertThrows(ResponseStatusException.class,()->tx.execute(x->work.detail(outsider,p,0)));
 }
 @Test void savedAggregateAuthorizationChangesAfterProjectOrRoleRevocation() {
  String t=team(department("Replay")),p=project(t,false);
  var access=new OrganizationAnswerAccess(db);
  var binding=tx.execute(x->org.bind(admin,new BindingInput("org:role:manager",manager.id(),"TEAM",null,t)));
  var saved=Map.<String,Object>of("authorizationFingerprint",access.fingerprint(manager));
  assertTrue(access.canReplay(manager,saved));
  assertFalse(access.canReplay(outsider,saved));
  assertFalse(access.canReplay(manager,null));
  tx.execute(x->work.organizationalScope(admin,p,t,true));
  assertFalse(access.canReplay(manager,saved));
  tx.execute(x->work.organizationalScope(admin,p,t,false));
  assertTrue(access.canReplay(manager,saved));
  tx.execute(x->org.revoke(admin,(String)binding.get("id")));
  assertFalse(access.canReplay(manager,saved));
 }

 @Test void graphAndHistoricalMetricsExcludeHiddenProjectsAndHandleNoCompletions() {
  var graph=new OrganizationGraph(db,org);var metrics=new OrganizationMetrics(db,org);
  var empty=metrics.metrics(employee,4);
  assertNull(((Map<?,?>)empty.get("summary")).get("on_time_rate"));
  assertEquals(4,((List<?>)empty.get("weekly")).size());
  String d=department("Graph"),t=team(d),p=project(t,false),secret=project(t,true);
  tx.execute(x->org.bind(admin,new BindingInput("org:role:manager",manager.id(),"TEAM",null,t)));
  tx.execute(x->work.saveTask(admin,p,null,new WorkDtos.TaskInput("Visible work","TODO",null,null,null,null)));
  tx.execute(x->work.saveTask(admin,secret,null,new WorkDtos.TaskInput("Hidden work","TODO",null,null,null,null)));
  var nodes=graph.graph(manager).toString();assertTrue(nodes.contains("Visible work"));assertFalse(nodes.contains("Hidden work"));
  var result=metrics.metrics(manager,2);
  assertEquals(1L,((Map<?,?>)result.get("summary")).get("open_tasks"));
  assertFalse(graph.graph(outsider).toString().contains("Visible work"));
  assertThrows(ResponseStatusException.class,()->metrics.metrics(manager,0));
 }

}
