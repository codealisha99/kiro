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
    db.execute("TRUNCATE work_insights,work_events,work_dependencies,work_tasks,work_project_grants,work_projects,work_commitments CASCADE");
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
  String scenario(String p,String name) {
    return tx.execute(t->(String)work.scenario(owner,p,new ScenarioInput(name,LocalDate.now(),LocalDate.now().plusDays(7),BigDecimal.TEN,BigDecimal.ONE,"Synthetic planning assumption")).get("id"));
  }
  @Test void comparisonsRequireSameProjectPeriodAndCurrentAccess() {
    String p=project("Planning"),other=project("Other");
    String a=scenario(p,"First"),b=scenario(p,"Second"),foreign=scenario(other,"Other");
    var readTx=new TransactionTemplate(tx.getTransactionManager());readTx.setReadOnly(true);
    assertEquals(2,readTx.execute(t->work.scenarioList(owner,p)).size());
    assertEquals(2,readTx.execute(t->work.compareScenarios(owner,p,new ScenarioCompareInput(List.of(a,b)))).size());
    assertEquals(2,tx.execute(t->work.compareScenarios(owner,p,new ScenarioCompareInput(List.of(a,b)))).size());
    for(var ids:List.of(List.of(a,a),List.of(a,foreign)))
      assertThrows(ResponseStatusException.class,()->tx.execute(t->work.compareScenarios(owner,p,new ScenarioCompareInput(ids))));
    db.update("UPDATE work_scenarios SET period_end=period_end+1 WHERE id=?",b);
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.compareScenarios(owner,p,new ScenarioCompareInput(List.of(a,b)))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.scenarioList(outsider,p)));
  }
  @Test void approvalsRequireIndependentWriterAndNotificationsRespectRevocation() {
    String p=project("Approval"),s=scenario(p,"Feature");
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"WRITE"),false));
    tx.execute(t->work.requestScenarioApproval(owner,s));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.requestScenarioApproval(owner,s)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.decideScenarioApproval(owner,s,new ScenarioApprovalInput("APPROVED",null,1))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.decideScenarioApproval(outsider,s,new ScenarioApprovalInput("APPROVED",null,1))));
    String notification=(String)work.notifications(reader).getFirst().get("id");
    assertTrue(work.notifications(admin).isEmpty());
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.markNotificationRead(admin,notification)));
    tx.execute(t->work.markNotificationRead(reader,notification));
    assertNotNull(work.notifications(reader).getFirst().get("read_at"));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.decideScenarioApproval(reader,s,new ScenarioApprovalInput("REJECTED"," ",1))));
    tx.execute(t->work.decideScenarioApproval(reader,s,new ScenarioApprovalInput("APPROVED","Reviewed",1)));
    assertEquals("APPROVED",((Map<?,?>)work.scenarioResult(owner,s).get("approval")).get("status"));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.decideScenarioApproval(reader,s,new ScenarioApprovalInput("REJECTED","Stale",1))));
    assertEquals(1,work.notifications(owner).size());
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"WRITE"),true));
    assertTrue(work.notifications(reader).isEmpty());
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.markNotificationRead(reader,notification)));
    assertThrows(ResponseStatusException.class,()->work.scenarioResult(reader,s));
    assertEquals(2L,db.queryForObject("SELECT count(*) FROM work_events WHERE kind IN ('SCENARIO_APPROVAL_REQUESTED','SCENARIO_APPROVAL_DECIDED')",Long.class));
  }
  @Test void outcomesHaveOptimisticVersionsAndRetainPriorValuesInHistory() {
    String p=project("Outcomes"),s=scenario(p,"Feature");
    var first=new ScenarioOutcomeInput("IN_PROGRESS",null,"Started",0);
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.saveScenarioOutcome(reader,s,first)));
    tx.execute(t->work.saveScenarioOutcome(owner,s,first));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->work.saveScenarioOutcome(owner,s,first)));
    tx.execute(t->work.saveScenarioOutcome(owner,s,new ScenarioOutcomeInput("DELIVERED",BigDecimal.TEN,"Measured completion",1)));
    assertEquals("DELIVERED",((Map<?,?>)work.scenarioResult(owner,s).get("outcome")).get("status"));
    assertEquals(2L,db.queryForObject("SELECT count(*) FROM work_events WHERE kind='SCENARIO_OUTCOME_RECORDED'",Long.class));
  }

  @Test void sourceMappingRequiresOwnershipWriteAccessAndExplicitSharing() {
    String p=project("Mapped work");
    tx.execute(t->work.grant(owner,p,new GrantInput(admin.id(),"WRITE"),false));
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),false));
    var sources=new WorkSourceService(db,work,new com.kiro.api.organization.OrganizationService(db,new ObjectMapper()));
    String c=UUID.randomUUID().toString(),r=UUID.randomUUID().toString();
    db.update("INSERT INTO provider_connections(id,tenant_id,owner_id,provider,name,resource,status,last_success_at) VALUES (?,'org','admin','linear','Synthetic','team','READY',now())",c);
    db.update("INSERT INTO provider_records(id,tenant_id,connection_id,external_id,kind,title,generation) VALUES (?,'org',?,'external-1','TASK','Shared issue','generation')",r,c);
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.map(admin,p,new WorkSourceService.MappingInput(r,null,"Related",false))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.map(outsider,p,new WorkSourceService.MappingInput(r,null,"Related",true))));
    tx.execute(t->sources.map(admin,p,new WorkSourceService.MappingInput(r,null,"Verified task reference",true)));
    var mapped=tx.execute(t->sources.list(reader,p,0)).getFirst();
    assertEquals("CURRENT",mapped.get("freshness"));
    assertEquals(1L,db.queryForObject("SELECT count(*) FROM work_tasks WHERE project_id=?",Long.class,p));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.map(admin,p,new WorkSourceService.MappingInput(r,null,"Duplicate",true))));
    assertEquals(1L,db.queryForObject("SELECT count(*) FROM work_tasks WHERE project_id=?",Long.class,p));
    db.update("UPDATE provider_records SET title='Provider edited title' WHERE id=?",r);
    assertEquals("CHANGED",tx.execute(t->sources.list(reader,p,0)).getFirst().get("freshness"));
    assertEquals("Shared issue",db.queryForObject("SELECT title FROM work_tasks WHERE project_id=?",String.class,p));
    db.update("UPDATE provider_connections SET status='DISCONNECTED' WHERE id=?",c);
    assertEquals("UNAVAILABLE",tx.execute(t->sources.list(reader,p,0)).getFirst().get("freshness"));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.revoke(reader,p,(String)mapped.get("id"))));
    tx.execute(t->sources.revoke(owner,p,(String)mapped.get("id")));
    assertTrue(tx.execute(t->sources.list(reader,p,0)).isEmpty());
    assertEquals(1L,db.queryForObject("SELECT count(*) FROM work_tasks WHERE project_id=?",Long.class,p));
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),true));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.list(reader,p,0)));
  }

  @Test void providerFactsRequireReviewAndRemainInSourceUnitsAfterSharing() {
    String p=project("Finance and people mapping");
    tx.execute(t->work.grant(owner,p,new GrantInput(admin.id(),"WRITE"),false));
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),false));
    var sources=new WorkSourceService(db,work,new com.kiro.api.organization.OrganizationService(db,new ObjectMapper()));
    String c=UUID.randomUUID().toString();
    db.update("INSERT INTO provider_connections(id,tenant_id,owner_id,provider,name,resource,status,last_success_at) VALUES (?,'org','admin','hubspot','Synthetic','portal','READY',now())",c);
    Map<String,String> records=new LinkedHashMap<>();
    for(String kind:List.of("DEAL","INVOICE","EMPLOYEE","MARKETING_METRIC")) {
      String id=UUID.randomUUID().toString(); records.put(kind,id);
      db.update("INSERT INTO provider_records(id,tenant_id,connection_id,external_id,kind,title,generation) VALUES (?,'org',?,?,?,?,'generation')",
          id,c,"external-"+kind,kind,"Shared "+kind);
    }
    db.update("INSERT INTO provider_financial_facts(tenant_id,record_id,amount,currency) VALUES ('org',?,?,?),( 'org',?,?,?)",
        records.get("DEAL"),new BigDecimal("1200.00"),"USD",records.get("INVOICE"),new BigDecimal("950.00"),"GBP");
    db.update("INSERT INTO provider_people_facts(tenant_id,record_id,department,supervisor_reference) VALUES ('org',?,?,?)",
        records.get("EMPLOYEE"),"Engineering","manager-7");
    db.update("INSERT INTO provider_metric_observations(tenant_id,record_id,metric,value,unit,period_start,period_end,campaign,currency) VALUES ('org',?,?,?,?,?,?,?,?)",
        records.get("MARKETING_METRIC"),"conversions",new BigDecimal("17"),"count",LocalDate.of(2026,1,1),LocalDate.of(2026,1,31),"launch","USD");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.map(admin,p,
        new WorkSourceService.MappingInput(records.get("INVOICE"),null,"Invoice for launch",false))));
    assertEquals(0L,db.queryForObject("SELECT count(*) FROM work_source_mappings",Long.class));
    for(var entry:records.entrySet()) tx.execute(t->sources.map(admin,p,
        new WorkSourceService.MappingInput(entry.getValue(),null,"Reviewed project relationship",true)));

    var visible=tx.execute(t->sources.list(reader,p,0));
    assertEquals(4,visible.size());
    var deal=visible.stream().filter(x->"DEAL".equals(x.get("source_kind"))).findFirst().orElseThrow();
    var invoice=visible.stream().filter(x->"INVOICE".equals(x.get("source_kind"))).findFirst().orElseThrow();
    assertEquals("1200.0000",deal.get("source_amount").toString());
    assertEquals("USD",deal.get("source_currency"));
    assertEquals("950.0000",invoice.get("source_amount").toString());
    assertEquals("GBP",invoice.get("source_currency"));
    var employee=visible.stream().filter(x->"EMPLOYEE".equals(x.get("source_kind"))).findFirst().orElseThrow();
    assertEquals("Engineering",employee.get("source_department"));
    assertEquals("manager-7",employee.get("source_supervisor_reference"));
    var marketing=visible.stream().filter(x->"MARKETING_METRIC".equals(x.get("source_kind"))).findFirst().orElseThrow();
    assertEquals("conversions",marketing.get("source_metric"));
    assertEquals(new BigDecimal("17.000000"),marketing.get("source_metric_value"));
    assertEquals("launch",marketing.get("source_campaign"));

    db.update("UPDATE provider_financial_facts SET amount=1300 WHERE record_id=?",records.get("DEAL"));
    var changed=tx.execute(t->sources.list(reader,p,0)).stream().filter(x->"DEAL".equals(x.get("source_kind"))).findFirst().orElseThrow();
    assertEquals("CHANGED",changed.get("freshness"));
    assertEquals("1200.0000",changed.get("source_amount").toString());
    tx.execute(t->work.grant(owner,p,new GrantInput(reader.id(),"READ"),true));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->sources.list(reader,p,0)));
  }

  PlanningService planning() {return new PlanningService(db,work,new ObjectMapper().findAndRegisterModules());}
  @Test void crossProjectCommitmentsStayScopedAndNeverDiscloseHiddenWork() {
    var plan=planning();
    String home=project("Home"),laboratory=project("Laboratory");
    String hidden=tx.execute(t->(String)work.createProject(reader,new ProjectInput("Hidden")).get("id"));
    var borrowed=new PlanningService.Commitment(reader.id(),LocalDate.now(),LocalDate.now().plusDays(7),
        new BigDecimal("10"),"Borrowed hours","Shell team covers scripting",laboratory);
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.commitment(reader,home,borrowed)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.commitment(owner,home,
        new PlanningService.Commitment(reader.id(),LocalDate.now(),LocalDate.now().plusDays(7),BigDecimal.TEN,"Unreachable","Assignee lacks project access yet",null))));
    tx.execute(t->work.grant(owner,home,new GrantInput(reader.id(),"READ"),false));
    String id=(String)((Map<?,?>)tx.execute(t->plan.commitment(owner,home,borrowed))).get("id");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.commitment(owner,home,
        new PlanningService.Commitment(reader.id(),LocalDate.now(),LocalDate.now().plusDays(7),BigDecimal.TEN,"Second placement","Overlaps the first window",null))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.commitment(owner,home,
        new PlanningService.Commitment(reader.id(),LocalDate.now(),LocalDate.now().plusDays(7),BigDecimal.TEN,"Concealed source","Recorder cannot read it",hidden))));
    assertEquals(1,((List<?>)tx.execute(t->plan.list(owner,home)).get("commitments")).size());
    assertTrue(((List<?>)tx.execute(t->plan.list(reader,home)).get("commitments")).size()==1);
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.list(reader,laboratory)));
    tx.execute(t->work.grant(owner,laboratory,new GrantInput(reader.id(),"READ"),false));
    String sid=(String)((Map<?,?>)tx.execute(t->plan.commitment(owner,laboratory,
        new PlanningService.Commitment(reader.id(),LocalDate.now(),LocalDate.now().plusDays(3),new BigDecimal("6"),"Lab shift","Committed from the other workstream",null)))).get("id");
    tx.execute(t->work.saveTask(owner,home,null,new TaskInput("Borrowed feature","TODO",reader.id(),new BigDecimal("8"),LocalDate.now().plusDays(3),null)));
    var ownerRows=((List<?>)tx.execute(t->plan.capacity(owner,home,LocalDate.now(),LocalDate.now().plusDays(7))).get("people"));
    Map<?,?> peer=(Map<?,?>)ownerRows.getFirst();
    assertEquals(0,new BigDecimal("10").compareTo((BigDecimal)peer.get("committed_hours")));
    assertEquals(0,new BigDecimal("6").compareTo((BigDecimal)peer.get("visible_cross_hours")));
    assertEquals(0,BigDecimal.ZERO.compareTo((BigDecimal)peer.get("other_committed_hours")));
    assertEquals(0,new BigDecimal("80").compareTo((BigDecimal)peer.get("allocation_load_percent")));
    tx.execute(t->work.grant(owner,home,new GrantInput(admin.id(),"READ"),false));
    var adminRows=((List<?>)tx.execute(t->plan.capacity(admin,home,LocalDate.now(),LocalDate.now().plusDays(7))).get("people"));
    Map<?,?> guarded=(Map<?,?>)adminRows.getFirst();
    assertEquals(0,new BigDecimal("6").compareTo((BigDecimal)guarded.get("other_committed_hours")));
    assertEquals(0,BigDecimal.ZERO.compareTo((BigDecimal)guarded.get("visible_cross_hours")));
    tx.execute(t->plan.revoke(owner,home,"commitment",id));
    assertTrue(((List<?>)tx.execute(t->plan.list(owner,home)).get("commitments")).isEmpty());
    assertEquals(3L,db.queryForObject("SELECT count(*) FROM work_events WHERE kind='COMMITMENT_DECLARED' OR kind='PLANNING_RECORD_REVOKED'",Long.class));
    assertEquals(1L,db.queryForObject("SELECT count(*) FROM work_commitments WHERE revoked_at IS NOT NULL",Long.class));
  }
  @Test void planningLinksAreScopedAndSubtaskCyclesAreRejected() {
    var plan=planning();String p=project("Planning"),other=project("Other");
    String a=(String)task(p,"Parent","TODO",LocalDate.now(),BigDecimal.ONE).get("id");
    String b=(String)task(p,"Child","TODO",LocalDate.now(),BigDecimal.ONE).get("id");
    String foreign=(String)task(other,"Foreign","TODO",null,null).get("id");
    var goal=new PlanningService.Goal("Launch","customers",BigDecimal.TEN,BigDecimal.ONE,LocalDate.now(),"Manual validated count",0);
    String g=(String)((Map<?,?>)tx.execute(t->plan.goal(owner,p,null,goal))).get("id");
    String initiative=(String)((Map<?,?>)tx.execute(t->plan.initiative(owner,p,new PlanningService.Initiative("Launch",g,"Adoption")))).get("id");
    String milestone=(String)((Map<?,?>)tx.execute(t->plan.milestone(owner,p,new PlanningService.Milestone("Release",initiative,LocalDate.now())))).get("id");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.initiative(owner,other,new PlanningService.Initiative("Invalid",g,"Hidden goal"))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.taskPlan(owner,p,a,new PlanningService.TaskPlan(foreign,null,"NORMAL",null,0))));
    tx.execute(t->plan.taskPlan(owner,p,b,new PlanningService.TaskPlan(a,milestone,"HIGH","Java",0)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.taskPlan(owner,p,a,new PlanningService.TaskPlan(b,null,"NORMAL",null,0))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.taskPlan(owner,p,b,new PlanningService.TaskPlan(null,null,"NORMAL",null,0))));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.list(outsider,p)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.goal(owner,p,g,goal)));
    var revised=new PlanningService.Goal("Launch","customers",BigDecimal.TEN,BigDecimal.TEN,LocalDate.now(),"Updated count",1);
    tx.execute(t->plan.goal(owner,p,g,revised));
    assertEquals(2L,db.queryForObject("SELECT count(*) FROM work_events WHERE kind='GOAL_RECORDED'",Long.class));
  }
  @Test void capacityUsesExactDeclaredWindowAndWithholdsIncompleteConclusions() {
    var plan=planning();String p=project("Capacity");LocalDate start=LocalDate.now(),end=start.plusDays(7);
    tx.execute(t->work.saveTask(owner,p,null,new TaskInput("Assigned","TODO",owner.id(),new BigDecimal("12"),end,null)));
    var allocation=new PlanningService.Availability(owner.id(),start,end,new BigDecimal("8"),"Eight hours after leave");
    String allocationId=(String)((Map<?,?>)tx.execute(t->plan.availability(owner,p,allocation))).get("id");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.availability(owner,p,allocation)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.availability(owner,p,new PlanningService.Availability(outsider.id(),start,end,BigDecimal.TEN,"Invalid"))));
    var rows=(List<?>)tx.execute(t->plan.capacity(owner,p,start,end)).get("people");
    assertEquals(0,new BigDecimal("150").compareTo((BigDecimal)((Map<?,?>)rows.getFirst()).get("allocation_load_percent")));
    var different=(List<?>)tx.execute(t->plan.capacity(owner,p,start,end.plusDays(1))).get("people");
    assertNull(((Map<?,?>)different.getFirst()).get("allocation_load_percent"));
    tx.execute(t->work.saveTask(owner,p,null,new TaskInput("Unknown","TODO",owner.id(),null,null,null)));
    var incomplete=(List<?>)tx.execute(t->plan.capacity(owner,p,start,end)).get("people");
    assertNull(((Map<?,?>)incomplete.getFirst()).get("allocation_load_percent"));
    tx.execute(t->plan.revoke(owner,p,"availability",allocationId));
    assertTrue(((List<?>)tx.execute(t->plan.list(owner,p)).get("availability")).isEmpty());
  }
  @Test void actualEffortIsAuditedAndCannotExceedDailyCalendarHours() {
    var plan=planning();String p=project("Actuals");String a=(String)task(p,"Task","TODO",null,null).get("id");
    var entry=new PlanningService.TimeEntry(a,LocalDate.now(),new BigDecimal("16"),"Recorded work");
    String key=(String)((Map<?,?>)tx.execute(t->plan.time(owner,p,entry))).get("id");
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.time(owner,p,entry)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.time(reader,p,entry)));
    assertThrows(ResponseStatusException.class,()->tx.execute(t->plan.time(owner,p,new PlanningService.TimeEntry(a,LocalDate.now().plusDays(1),BigDecimal.ONE,"Future"))));
    tx.execute(t->plan.revoke(owner,p,"time",key));
    assertTrue(((List<?>)tx.execute(t->plan.list(owner,p)).get("time_entries")).isEmpty());
    tx.execute(t->plan.time(owner,p,entry));
    assertEquals(2L,db.queryForObject("SELECT count(*) FROM work_time_entries",Long.class));
  }

}
