package com.kiro.api.goal;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kiro.api.goal.GoalDtos.*;
import com.kiro.api.home.HomeService;
import com.kiro.api.organization.*;
import com.kiro.api.organization.OrganizationService.*;
import com.kiro.api.security.AuthenticatedPrincipal;
import com.kiro.api.work.*;
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

@Testcontainers(disabledWithoutDocker = true)
class GoalPostgresTest {
  @Container static final PostgreSQLContainer<?> pg = new PostgreSQLContainer<>(
      DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
  static JdbcTemplate db;
  static TransactionTemplate tx;
  static OrganizationService org;
  static OrganizationDashboard dashboard;
  static WorkService work;
  static GoalReader reader;
  static GoalService goals;
  static HomeService home;
  static OrganizationGraph graph;
  static OrganizationQueryRouter router;

  static AuthenticatedPrincipal admin = new AuthenticatedPrincipal("admin", "a@test", "org", "admin");
  static AuthenticatedPrincipal ceo = new AuthenticatedPrincipal("ceo", "c@test", "org", "employee");
  static AuthenticatedPrincipal manager = new AuthenticatedPrincipal("manager", "m@test", "org", "employee");
  static AuthenticatedPrincipal employee = new AuthenticatedPrincipal("employee", "e@test", "org", "employee");
  static AuthenticatedPrincipal peer = new AuthenticatedPrincipal("peer", "p@test", "org", "employee");
  static AuthenticatedPrincipal deep = new AuthenticatedPrincipal("deep", "d@test", "org", "employee");
  static AuthenticatedPrincipal outsider = new AuthenticatedPrincipal("outsider", "x@test", "other", "admin");
  static String dept;
  static String team;

  @BeforeAll
  static void setup() {
    var ds = new DriverManagerDataSource(pg.getJdbcUrl() + "&stringtype=unspecified", pg.getUsername(), pg.getPassword());
    Flyway.configure().dataSource(ds).load().migrate();
    db = new JdbcTemplate(ds);
    var tm = new DataSourceTransactionManager(ds);
    tx = new TransactionTemplate(tm);
    var json = new ObjectMapper().findAndRegisterModules();
    org = new OrganizationService(db, json);
    dashboard = new OrganizationDashboard(db, org);
    work = new WorkService(db, json, new WorkInsightEngine(db, tm));
    reader = new GoalReader(db);
    goals = new GoalService(db, org, reader);
    home = new HomeService(db, org, dashboard, reader);
    graph = new OrganizationGraph(db, org);
    router = new OrganizationQueryRouter(org, dashboard, reader);
    db.execute("INSERT INTO \"Tenant\"(id,name) VALUES ('org','Synthetic'),('other','Other')");
    for (var u : List.of(admin, ceo, manager, employee, peer, deep, outsider)) {
      db.update("INSERT INTO users(id,\"tenantId\",email,role,name) VALUES (?,?,?,?,?)",
          u.id(), u.tenantId(), u.email(), u.roleUpper(), u.id().toUpperCase());
    }
  }

  /** Fresh organization for every test: departments, team, hierarchy and the CEO's company binding. */
  @BeforeEach
  void seed() {
    db.execute("""
        TRUNCATE org_goal_checkins,org_goal_tasks,org_goals,org_audit_events,org_reporting_lines,org_team_memberships,
          org_role_bindings,org_teams,org_departments,org_roles,work_projects CASCADE
        """);
    tx.executeWithoutResult(s -> {
      org.setup(admin);
      dept = (String) org.department(admin, new NameInput("Engineering")).get("id");
      team = (String) org.team(admin, new TeamInput("Delivery", dept)).get("id");
      org.membership(admin, new MemberInput(team, employee.id(), false));
      org.membership(admin, new MemberInput(team, peer.id(), false));
      org.reporting(admin, new ReportingInput(employee.id(), manager.id(), false));
      org.reporting(admin, new ReportingInput(deep.id(), employee.id(), false));
      org.bind(admin, new BindingInput("org:role:ceo", ceo.id(), "COMPANY", null, null));
    });
  }

  static GoalInput goal(String scope, String dept, String team, AuthenticatedPrincipal owner, String parent,
      String title, String measure, Integer start, Integer target, Integer current) {
    return new GoalInput(scope, dept, team, owner.id(), parent, title, null, measure, "units",
        start == null ? null : BigDecimal.valueOf(start), target == null ? null : BigDecimal.valueOf(target),
        current == null ? null : BigDecimal.valueOf(current), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31),
        null, null);
  }

  static String create(AuthenticatedPrincipal u, GoalInput in) {
    return (String) tx.execute(s -> goals.create(u, in)).get("id");
  }

  static Map<String, Object> view(AuthenticatedPrincipal u, String id) {
    return reader.detail(u, id);
  }

  static List<String> titles(List<Map<String, Object>> rows) {
    return rows.stream().map(r -> (String) r.get("title")).toList();
  }

  static GoalInput update(GoalInput in, int expectedVersion, String status) {
    return new GoalInput(in.scope(), in.departmentId(), in.teamId(), in.ownerId(), in.parentId(), in.title(),
        in.description(), in.measure(), in.unit(), in.startValue(), in.targetValue(), in.currentValue(),
        in.startDate(), in.dueDate(), status, expectedVersion);
  }

  @Test
  void employeeSeesOwnPersonTeamAndCompanyGoalsButNotPeersPersonGoal() {
    String arr = create(ceo, goal("COMPANY", null, null, ceo, null, "Company ARR", "METRIC", 0, 100, 40));
    create(ceo, goal("DEPARTMENT", dept, null, ceo, null, "Eng reliability", "TASKS", null, null, null));
    create(ceo, goal("TEAM", null, team, ceo, null, "Ship v2", "TASKS", null, null, null));
    String peerGoal = create(ceo, goal("PERSON", null, null, peer, null, "Peer private", "TASKS", null, null, null));
    create(employee, goal("PERSON", null, null, employee, null, "Employee own", "TASKS", null, null, null));

    var visible = titles(reader.list(employee));
    assertTrue(visible.containsAll(List.of("Company ARR", "Eng reliability", "Ship v2", "Employee own")));
    assertFalse(visible.contains("Peer private"));
    assertThrows(ResponseStatusException.class, () -> view(employee, peerGoal));
    assertEquals(0, reader.list(outsider).size());
    assertNotNull(arr);
    assertTrue(db.queryForObject("SELECT count(*) FROM org_audit_events WHERE kind='GOAL_CREATED'", Long.class) >= 5);
  }

  @Test
  void managerSeesTransitiveReportsPersonGoalsOnly() {
    create(ceo, goal("PERSON", null, null, deep, null, "Deep private", "TASKS", null, null, null));
    create(ceo, goal("PERSON", null, null, peer, null, "Peer private", "TASKS", null, null, null));
    var visible = titles(reader.list(manager));
    assertTrue(visible.contains("Deep private"));
    assertFalse(visible.contains("Peer private"));
    assertTrue(titles(reader.list(employee)).contains("Deep private"));
  }

  @Test
  void managerSeesUnrestrictedProjectsOfReportsButNotRestrictedOnes() {
    String open = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep open")).get("id"));
    tx.execute(s -> work.organizationalScope(deep, open, team, false));
    String locked = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep locked")).get("id"));
    String peerOpen = (String) tx.execute(s -> work.createProject(peer, new WorkDtos.ProjectInput("Peer open")).get("id"));
    tx.execute(s -> work.organizationalScope(peer, peerOpen, team, false));
    var names = work.projects(manager, 0).stream().map(p -> (String) p.get("name")).toList();
    assertTrue(names.contains("Deep open"));
    assertFalse(names.contains("Deep locked"));
    assertFalse(names.contains("Peer open"));
    assertNotNull(locked);
  }

  @Test
  void restrictedTaskLinkedToGoalIsCountedButNotListedForOthers() {
    String locked = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep locked")).get("id"));
    tx.execute(s -> work.saveTask(deep, locked, null, new WorkDtos.TaskInput("Secret task", "TODO", null, null, null, null)));
    String taskId = db.queryForObject("SELECT id FROM work_tasks WHERE project_id=?", String.class, locked);
    String g = create(ceo, goal("PERSON", null, null, deep, null, "Deep private", "TASKS", null, null, null));
    tx.execute(s -> goals.link(deep, g, new TaskLinkInput(taskId, false)));
    var managerView = view(manager, g);
    assertEquals(1, managerView.get("taskCount"));
    assertEquals(List.of(), managerView.get("tasks"));
  }

  @Test
  void writeRulesRequireBindingsForDepartmentAndTeamScopes() {
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(employee, goal("DEPARTMENT", dept, null, employee, null, "Denied", "TASKS", null, null, null))));
    assertEquals(0L, db.queryForObject("SELECT count(*) FROM org_goals WHERE title='Denied'", Long.class));

    tx.execute(s -> org.bind(admin, new BindingInput("org:role:manager", manager.id(), "TEAM", null, team)));
    create(manager, goal("TEAM", null, team, employee, null, "Team by manager", "TASKS", null, null, null));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(manager, goal("DEPARTMENT", dept, null, manager, null, "Dept denied", "TASKS", null, null, null))));
    assertEquals(List.of("TEAM", "PERSON"), reader.options(manager).get("scopes"));
  }

  @Test
  void readOnlyEditorsGetForbiddenAndStaleVersionsConflict() {
    String arr = create(ceo, goal("COMPANY", null, null, ceo, null, "Company ARR", "METRIC", 0, 100, 40));
    var input = goal("COMPANY", null, null, ceo, null, "Company ARR", "METRIC", 0, 100, 40);
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.update(employee, arr, update(input, 1, null))));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.update(ceo, arr, update(input, 99, null))));
    var updated = tx.execute(s -> goals.update(ceo, arr, update(input, 1, null)));
    assertEquals(2, updated.get("version"));
    assertEquals(true, updated.get("canEdit"));
    var checkin = tx.execute(s -> goals.checkin(ceo, arr, new CheckinInput(BigDecimal.valueOf(55), "Renewals closed")));
    assertEquals(0, new BigDecimal("55").compareTo((BigDecimal) checkin.get("currentValue")));
    assertEquals(0.55, (Double) checkin.get("progress"), 1e-9);
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.checkin(employee, arr, new CheckinInput(BigDecimal.ONE, "No"))));
  }

  @Test
  void cyclesAndUnreadableParentsAreRejected() {
    String parent = create(ceo, goal("COMPANY", null, null, ceo, null, "Parent", "CHILDREN", null, null, null));
    String child = create(ceo, withParent(goal("COMPANY", null, null, ceo, null, "Child", "CHILDREN", null, null, null), parent));
    var parentInput = goal("COMPANY", null, null, ceo, child, "Parent", "CHILDREN", null, null, null);
    assertThrows(ResponseStatusException.class, () -> tx.execute(s -> goals.update(ceo, parent, update(parentInput, 1, null))));
    var selfInput = goal("COMPANY", null, null, ceo, parent, "Parent", "CHILDREN", null, null, null);
    assertThrows(ResponseStatusException.class, () -> tx.execute(s -> goals.update(ceo, parent, update(selfInput, 1, null))));

    String peerGoal = create(ceo, goal("PERSON", null, null, peer, null, "Peer private", "TASKS", null, null, null));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(employee, withParent(goal("PERSON", null, null, employee, null, "Hidden parent", "TASKS", null, null, null), peerGoal))));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(ceo, goal("PERSON", null, null, outsider, null, "Foreign owner", "TASKS", null, null, null))));
  }

  static GoalInput withParent(GoalInput in, String parent) {
    return new GoalInput(in.scope(), in.departmentId(), in.teamId(), in.ownerId(), parent, in.title(), in.description(),
        in.measure(), in.unit(), in.startValue(), in.targetValue(), in.currentValue(), in.startDate(), in.dueDate(),
        in.status(), in.expectedVersion());
  }

  @Test
  void progressRollsUpFromMetricTasksAndChildrenAndIgnoresCancelled() {
    String parent = create(ceo, goal("COMPANY", null, null, ceo, null, "Rollup", "CHILDREN", null, null, null));
    create(ceo, withParent(goal("COMPANY", null, null, ceo, null, "ARR", "METRIC", 0, 100, 40), parent));
    String ship = create(ceo, withParent(goal("TEAM", null, team, ceo, null, "Ship", "TASKS", null, null, null), parent));
    String old = create(ceo, withParent(goal("COMPANY", null, null, ceo, null, "Old", "METRIC", 0, 100, 100), parent));
    var oldInput = withParent(goal("COMPANY", null, null, ceo, null, "Old", "METRIC", 0, 100, 100), parent);
    tx.execute(s -> goals.update(ceo, old, update(oldInput, 1, "CANCELLED")));

    tx.execute(s -> work.createProject(ceo, new WorkDtos.ProjectInput("Ship project")));
    String project = db.queryForObject("SELECT id FROM work_projects WHERE name='Ship project'", String.class);
    tx.execute(s -> work.saveTask(ceo, project, null, new WorkDtos.TaskInput("Done thing", "DONE", null, null, null, null)));
    tx.execute(s -> work.saveTask(ceo, project, null, new WorkDtos.TaskInput("Open thing", "TODO", null, null, null, null)));
    for (String title : List.of("Done thing", "Open thing")) {
      String t = db.queryForObject("SELECT id FROM work_tasks WHERE title=?", String.class, title);
      tx.execute(s -> goals.link(ceo, ship, new TaskLinkInput(t, false)));
    }

    var rollup = view(ceo, parent);
    assertEquals(0.45, (Double) rollup.get("progress"), 1e-9);
    var shipView = view(ceo, ship);
    assertEquals(0.5, (Double) shipView.get("progress"), 1e-9);
    assertEquals(2, shipView.get("taskCount"));
    assertEquals(1, shipView.get("doneTaskCount"));
    assertEquals(0, BigDecimal.ONE.compareTo((BigDecimal) shipView.get("remaining")));
    assertEquals(3, ((List<?>) view(ceo, parent).get("children")).size());
  }

  @Test
  void homeUsesReportsForManagersAndTeammatesOtherwise() {
    String open = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep open")).get("id"));
    tx.execute(s -> work.organizationalScope(deep, open, team, false));
    String locked = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep locked")).get("id"));
    tx.execute(s -> work.saveTask(deep, open, null, new WorkDtos.TaskInput("Deep visible", "BLOCKED", deep.id(), null, null, null)));
    tx.execute(s -> work.saveTask(deep, locked, null, new WorkDtos.TaskInput("Deep secret", "TODO", deep.id(), null, null, null)));

    var managerHome = home.home(manager);
    var teamView = (Map<?, ?>) managerHome.get("team");
    assertEquals("REPORTS", teamView.get("basis"));
    var people = ((List<?>) teamView.get("people")).stream().map(p -> (Map<?, ?>) p).toList();
    var ids = people.stream().map(p -> p.get("id")).toList();
    assertTrue(ids.containsAll(List.of(employee.id(), deep.id())));
    assertFalse(ids.contains(manager.id()));
    var deepRow = people.stream().filter(p -> deep.id().equals(p.get("id"))).findFirst().orElseThrow();
    assertEquals(1L, deepRow.get("blocked"));
    assertEquals(1L, deepRow.get("open_tasks"));
    assertEquals(List.of("Deep visible"), ((List<?>) deepRow.get("currentTasks")).stream()
        .map(t -> ((Map<?, ?>) t).get("title")).toList());

    var employeeHome = home.home(employee);
    var employeeTeam = (Map<?, ?>) employeeHome.get("team");
    assertEquals("REPORTS", employeeTeam.get("basis"));
    var peerHome = home.home(peer);
    var peerTeam = (Map<?, ?>) peerHome.get("team");
    assertEquals("TEAMMATES", peerTeam.get("basis"));
    var mates = ((List<?>) peerTeam.get("people")).stream().map(p -> ((Map<?, ?>) p).get("id")).toList();
    assertEquals(List.of(employee.id()), mates);
  }

  @Test
  void ownersCannotMoveTheirGoalIntoABroaderScopeWithoutABinding() {
    var mine = goal("PERSON", null, null, employee, null, "Personal", "TASKS", null, null, null);
    String g = create(employee, mine);
    var widened = goal("COMPANY", null, null, employee, null, "Personal", "TASKS", null, null, null);
    assertThrows(ResponseStatusException.class, () -> tx.execute(s -> goals.update(employee, g, update(widened, 1, null))));
    var toTeam = goal("TEAM", null, team, employee, null, "Personal", "TASKS", null, null, null);
    assertThrows(ResponseStatusException.class, () -> tx.execute(s -> goals.update(employee, g, update(toTeam, 1, null))));
    assertEquals("PERSON", db.queryForObject("SELECT scope FROM org_goals WHERE id=?", String.class, g));
    assertFalse(titles(reader.list(peer)).contains("Personal"));

    // Editing an assigned goal in place stays allowed for its owner.
    var assigned = goal("COMPANY", null, null, employee, null, "Assigned", "TASKS", null, null, null);
    String a = create(ceo, assigned);
    var renamed = goal("COMPANY", null, null, employee, null, "Assigned, renamed", "TASKS", null, null, null);
    assertEquals("Assigned, renamed", tx.execute(s -> goals.update(employee, a, update(renamed, 1, null))).get("title"));
  }

  @Test
  void teammatesSharingSeveralTeamsAreCountedOnce() {
    String second = (String) tx.execute(s -> org.team(admin, new TeamInput("Platform", dept)).get("id"));
    tx.execute(s -> org.membership(admin, new MemberInput(second, employee.id(), false)));
    tx.execute(s -> org.membership(admin, new MemberInput(second, peer.id(), false)));
    String open = (String) tx.execute(s -> work.createProject(employee, new WorkDtos.ProjectInput("Shared")).get("id"));
    tx.execute(s -> work.organizationalScope(employee, open, team, false));
    tx.execute(s -> work.saveTask(employee, open, null, new WorkDtos.TaskInput("Only task", "IN_PROGRESS", employee.id(), null, null, null)));

    var people = ((List<?>) ((Map<?, ?>) home.home(peer).get("team")).get("people")).stream().map(p -> (Map<?, ?>) p).toList();
    assertEquals(1, people.size());
    assertEquals(1L, people.getFirst().get("open_tasks"));
    assertEquals(1L, people.getFirst().get("in_progress"));
  }

  @Test
  void myTasksCarryReadableGoalIds() {
    String open = (String) tx.execute(s -> work.createProject(deep, new WorkDtos.ProjectInput("Deep open")).get("id"));
    tx.execute(s -> work.organizationalScope(deep, open, team, false));
    tx.execute(s -> work.saveTask(deep, open, null, new WorkDtos.TaskInput("For employee", "TODO", employee.id(), null, null, null)));
    String task = db.queryForObject("SELECT id FROM work_tasks WHERE title='For employee'", String.class);
    String own = create(employee, goal("PERSON", null, null, employee, null, "Employee own", "TASKS", null, null, null));
    String hidden = create(ceo, goal("PERSON", null, null, peer, null, "Peer private", "TASKS", null, null, null));
    tx.execute(s -> goals.link(employee, own, new TaskLinkInput(task, false)));
    tx.execute(s -> goals.link(ceo, hidden, new TaskLinkInput(task, false)));

    var mine = (List<?>) home.home(employee).get("myTasks");
    assertEquals(1, mine.size());
    var row = (Map<?, ?>) mine.getFirst();
    assertEquals(List.of(own), row.get("goalIds"));
    assertEquals("PERSON", ((Map<?, ?>) ((List<?>) home.home(employee).get("goals")).stream()
        .filter(g -> own.equals(((Map<?, ?>) g).get("id"))).findFirst().orElseThrow()).get("scope"));
  }

  @Test
  void graphAndChatRouteExposeOnlyReadableGoals() {
    String arr = create(ceo, goal("COMPANY", null, null, ceo, null, "Company ARR", "METRIC", 0, 100, 40));
    create(ceo, withParent(goal("TEAM", null, team, ceo, null, "Ship v2", "TASKS", null, null, null), arr));
    create(ceo, goal("PERSON", null, null, peer, null, "Peer private", "TASKS", null, null, null));

    var nodes = graph.graph(employee).toString();
    assertTrue(nodes.contains("Company ARR"));
    assertFalse(nodes.contains("Peer private"));
    assertTrue(graph.graph(employee).toString().contains("ALIGNS_TO"));

    var answer = router.route(employee, "How far are we from our goals?").orElseThrow();
    assertEquals("structured_work", answer.get("route"));
    var routed = (List<?>) answer.get("goals");
    assertTrue(routed.stream().map(g -> ((Map<?, ?>) g).get("title")).toList().contains("Company ARR"));
    assertFalse(answer.toString().contains("Peer private"));
    assertTrue(router.route(employee, "What is the leave policy for goals?").isEmpty());
  }

  @Test
  void optionsScopeToBindingsAndOwnTeamAndReports() {
    var ceoOptions = reader.options(ceo);
    assertTrue(((List<?>) ceoOptions.get("scopes")).containsAll(List.of("COMPANY", "DEPARTMENT", "TEAM", "PERSON")));
    assertEquals(List.of("PERSON"), reader.options(employee).get("scopes"));
    var people = ((List<?>) reader.options(employee).get("people")).stream().map(p -> ((Map<?, ?>) p).get("id")).toList();
    assertTrue(people.containsAll(List.of(employee.id(), deep.id())));
    assertFalse(people.contains(peer.id()));
  }

  @Test
  void invalidInputsAreRejectedWith400() {
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(ceo, goal("TEAM", null, null, ceo, null, "No team", "TASKS", null, null, null))));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(ceo, goal("COMPANY", null, null, ceo, null, "Flat metric", "METRIC", 5, 5, 5))));
    assertThrows(ResponseStatusException.class,
        () -> tx.execute(s -> goals.create(ceo, new GoalInput("COMPANY", null, null, ceo.id(), null, "Backwards", null,
            "TASKS", null, null, null, null, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 4, 1), null, null))));
  }
}
