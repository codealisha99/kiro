package com.kiro.api.work;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.security.AuthenticatedPrincipal;
import java.math.BigDecimal;
import java.time.LocalDate;
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
import static com.kiro.api.work.WorkDtos.*;

@Testcontainers(disabledWithoutDocker=true)
class WorkPostgresTest {
  @Container static final PostgreSQLContainer<?> pg=new PostgreSQLContainer<>(
      DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
  static JdbcTemplate db;
  static WorkService work;
  static WorkInsightEngine engine;
  static TransactionTemplate tx;
  static AuthenticatedPrincipal owner=new AuthenticatedPrincipal("owner","owner@test","org","employee");
  static AuthenticatedPrincipal reader=new AuthenticatedPrincipal("reader","reader@test","org","employee");
  static AuthenticatedPrincipal admin=new AuthenticatedPrincipal("admin","admin@test","org","admin");
  static AuthenticatedPrincipal outsider=new AuthenticatedPrincipal("outsider","out@test","other","admin");

  @BeforeAll static void setup() {
    var ds=new DriverManagerDataSource(pg.getJdbcUrl()+"&stringtype=unspecified",pg.getUsername(),pg.getPassword());
    Flyway.configure().dataSource(ds).load().migrate();
    db=new JdbcTemplate(ds);
    var manager=new DataSourceTransactionManager(ds); tx=new TransactionTemplate(manager);
    engine=new WorkInsightEngine(db,manager);
    work=new WorkService(db,new ObjectMapper().findAndRegisterModules(),engine);
    db.execute("INSERT INTO \"Tenant\"(id,name) VALUES ('org','Test'),('other','Other')");
    for(var u:List.of(owner,reader,admin,outsider))
      db.update("INSERT INTO users(id,\"tenantId\",email,role) VALUES (?,?,?,?)",u.id(),u.tenantId(),u.email(),u.roleUpper());
  }

  @BeforeEach void reset() {
    db.execute("TRUNCATE work_insights,work_events,work_dependencies,work_tasks,work_project_grants,work_projects CASCADE");
  }
  String project(String name) { return tx.execute(t -> (String)work.createProject(owner,new ProjectInput(name)).get("id")); }
  Map<String,Object> task(String p,String title,String status,LocalDate due,BigDecimal hours) {
    return tx.execute(t -> work.saveTask(owner,p,null,new TaskInput(title,status,null,hours,due,null)));
  }
  @Test void accessIsExplicitAndRevocationAppliesToAllReads() {
    String p=project("Secret"); task(p,"Private deadline","BLOCKED",LocalDate.now().minusDays(1),BigDecimal.TEN);
    for(var denied:List.of(reader,admin,outsider)) {
      assertTrue(work.projects(denied,0).isEmpty());
      assertTrue(work.insightList(denied,0).isEmpty());
      assertEquals(0L,((Map<?,?>)work.overview(denied).get("metrics")).get("total_tasks"));
      assertThrows(ResponseStatusException.class,()->tx.execute(t->work.detail(denied,p,0)));
    }
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),false));
    assertEquals(1,work.projects(reader,0).size());
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.saveTask(reader,p,null,
        new TaskInput("Denied","TODO",null,null,null,null))));
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),true));
    assertTrue(work.projects(reader,0).isEmpty());
    assertTrue(work.insightList(reader,0).isEmpty());
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.history(reader,p,0)));
  }

  @Test void deterministicMetricsAndInsightLifecyclePreserveEvidence() {
    String p=project("Delivery");
    var task=task(p,"Finish migration","BLOCKED",LocalDate.now().minusDays(1),BigDecimal.TEN);
    task(p,"Unknown effort","TODO",null,null);
    var m=(Map<?,?>)work.overview(owner).get("metrics");
    assertEquals(2L,m.get("total_tasks")); assertEquals(1L,m.get("missing_estimates"));
    assertEquals(0,new BigDecimal("10").compareTo((BigDecimal)m.get("estimated_remaining_hours")));
    engine.scheduledRefresh(); engine.scheduledRefresh();
    assertEquals(4,work.insightList(owner,0).size()); // three on blocked task, one unassigned
    tx.execute(t->work.saveTask(owner,p,(String)task.get("id"),new TaskInput("Finish migration","DONE",owner.id(),
        BigDecimal.ZERO,LocalDate.now(),1)));
    var history=work.insightList(owner,0);
    assertEquals(3,history.stream().filter(i->i.get("resolved_at")!=null).count());
    assertTrue(history.stream().allMatch(i->i.get("evidence_version").equals(1)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.saveTask(owner,p,(String)task.get("id"),
        new TaskInput("Stale","TODO",null,null,null,1))));
    assertEquals(4,tx.execute(t->work.history(owner,p,0)).size());
  }

  @Test void graphCannotTraverseHiddenNodesOrLeakHistoricalReferences() {
    String a=project("Visible"); String b=project("Hidden");
    String x=(String)task(a,"Public task","TODO",null,null).get("id");
    String y=(String)task(b,"Secret task","TODO",null,null).get("id");
    String z=(String)task(a,"Downstream","TODO",null,null).get("id");
    tx.execute(t->work.dependency(owner,y,new DependencyInput(x,"Needs review")));
    tx.execute(t->work.dependency(owner,z,new DependencyInput(y,"Sensitive dependency")));
    assertEquals(2,tx.execute(t->work.impact(owner,x)).size());
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.dependency(owner,x,new DependencyInput(z,"Cycle"))));
    tx.execute(t->work.grant(owner,a,new GrantInput(reader.id(),"READ"),false));
    assertTrue(tx.execute(t->work.impact(reader,x)).isEmpty());
    assertFalse(tx.execute(t->work.history(reader,a,0)).stream().anyMatch(e->"DEPENDENCY_ADDED".equals(e.get("kind"))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.impact(outsider,x)));
  }

  @Test void foreignTenantAssignmentsAndGrantsAreRejected() {
    String p=project("Isolation");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.grant(owner,p,new GrantInput(outsider.id(),"WRITE"),false)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.saveTask(owner,p,null,
        new TaskInput("Invalid","TODO",outsider.id(),null,null,null))));
    assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->db.update(
        "INSERT INTO work_projects(id,tenant_id,name,owner_id) VALUES ('invalid','org','Invalid','outsider')"));
  }
  @Test void scenariosKeepEvidenceAndNeverGuessMissingEffort() {
    String p=project("Planning");
    var due=LocalDate.now().plusDays(7);
    var t=task(p,"Release","TODO",due,new BigDecimal("12"));
    var request=new ScenarioInput("Add feature",LocalDate.now(),due,new BigDecimal("16"),new BigDecimal("8"),"Assume 16 project hours available");
    var s=tx.execute(status->work.scenario(owner,p,request));
    assertEquals("EXCEEDS_ASSUMED_CAPACITY",s.get("assessment"));
    assertEquals(0,new BigDecimal("-4").compareTo((BigDecimal)s.get("remaining_assumed_hours")));
    assertThrows(ResponseStatusException.class,()->work.scenarioResult(admin,(String)s.get("id")));
    tx.execute(status->work.saveTask(owner,p,(String)t.get("id"),new TaskInput("Release","DONE",null,BigDecimal.ZERO,due,1)));
    assertEquals("EXCEEDS_ASSUMED_CAPACITY",work.scenarioResult(owner,(String)s.get("id")).get("assessment"));
    task(p,"Unknown","TODO",null,null);
    var incomplete=tx.execute(status->work.scenario(owner,p,request));
    assertEquals("INSUFFICIENT_DATA",incomplete.get("assessment"));
    assertNull(incomplete.get("remaining_assumed_hours"));
  }

  @Test void triageRequiresWriteAccessAndPreservesAuditableDecisions() {
    String p=project("Triage");
    task(p,"Review blocker","BLOCKED",null,BigDecimal.ONE);
    var insight=work.insightList(owner,0).getFirst();
    String id=(String)insight.get("id");
    var acknowledge=new InsightTriageInput("ACKNOWLEDGED",null,1);
    for(var denied:List.of(reader,admin,outsider))
      assertThrows(ResponseStatusException.class,()->tx.execute(t->work.triageInsight(denied,id,acknowledge)));
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),false));
    assertEquals(403,assertThrows(ResponseStatusException.class,
        ()->tx.execute(t->work.triageInsight(reader,id,acknowledge))).getStatusCode().value());
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"WRITE"),false));
    var acknowledged=tx.execute(t->work.triageInsight(reader,id,acknowledge));
    assertEquals("ACKNOWLEDGED",acknowledged.get("triage_status"));
    assertEquals(reader.id(),acknowledged.get("triaged_by"));
    assertEquals(409,assertThrows(ResponseStatusException.class,
        ()->tx.execute(t->work.triageInsight(owner,id,acknowledge))).getStatusCode().value());
    assertEquals(400,assertThrows(ResponseStatusException.class,
        ()->tx.execute(t->work.triageInsight(owner,id,new InsightTriageInput("DISMISSED","  ",2)))).getStatusCode().value());
    tx.execute(t->work.triageInsight(owner,id,new InsightTriageInput("DISMISSED","Accepted for this milestone",2)));
    engine.scheduledRefresh(); engine.scheduledRefresh();
    assertEquals("DISMISSED",db.queryForMap("SELECT * FROM work_insights WHERE id=?",id).get("triage_status"));
    assertEquals(2,tx.execute(t->work.history(owner,p,0)).stream().filter(e->"INSIGHT_TRIAGED".equals(e.get("kind"))).count());
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"WRITE"),true));
    assertEquals(404,assertThrows(ResponseStatusException.class,
        ()->tx.execute(t->work.triageInsight(reader,id,new InsightTriageInput("OPEN",null,3)))).getStatusCode().value());
  }

  @Test void sourceChangesReopenTriageAndResolutionCannotBeOverridden() {
    String p=project("Reassessment");
    var task=task(p,"Review blocker","BLOCKED",null,BigDecimal.ONE);
    String taskId=(String)task.get("id");
    var insight=work.insightList(owner,0).stream().filter(i->"BLOCKED".equals(i.get("rule"))).findFirst().orElseThrow();
    String id=(String)insight.get("id");
    tx.execute(t->work.triageInsight(owner,id,new InsightTriageInput("DISMISSED","Known temporary blocker",1)));
    tx.execute(t->work.saveTask(owner,p,taskId,new TaskInput("Changed blocker","BLOCKED",null,BigDecimal.TEN,null,1)));
    var reopened=db.queryForMap("SELECT * FROM work_insights WHERE id=?",id);
    assertEquals("OPEN",reopened.get("triage_status"));
    assertEquals(3,reopened.get("triage_version"));
    assertEquals(1,reopened.get("evidence_version"));
    assertEquals(1,tx.execute(t->work.history(owner,p,0)).stream().filter(e->"INSIGHTS_REASSESSED".equals(e.get("kind"))).count());
    tx.execute(t->work.saveTask(owner,p,taskId,new TaskInput("Done","DONE",null,BigDecimal.ZERO,null,2)));
    assertEquals(409,assertThrows(ResponseStatusException.class,
        ()->tx.execute(t->work.triageInsight(owner,id,new InsightTriageInput("OPEN",null,3)))).getStatusCode().value());
    tx.execute(t->work.saveTask(owner,p,taskId,new TaskInput("New blocker","BLOCKED",null,BigDecimal.ONE,null,3)));
    assertEquals(2,work.insightList(owner,0).stream().filter(i->"BLOCKED".equals(i.get("rule"))).count());
  }
}
