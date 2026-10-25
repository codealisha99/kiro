package com.kiro.api.organization;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Typed, visibility-filtered graph of the organization and its work: every node and edge is derived strictly from the caller's authorized scope. */
@Service
public class OrganizationGraph {
  private final JdbcTemplate db;private final OrganizationService org;

  public OrganizationGraph(JdbcTemplate db,OrganizationService org) {this.db=db;this.org=org;}

  @Transactional(readOnly=true)
  public Map<String,Object> graph(AuthenticatedPrincipal u) {
    var views=new HashSet<>(org.views(u));
    boolean orgVisible=views.stream().anyMatch(Set.of("MANAGER","DIRECTOR","VP","CEO")::contains);
    String cte="WITH visible AS (SELECT p.* FROM work_projects p WHERE "+OrganizationAccess.READ+") ";
    Object[] scope={u.tenantId(),u.id(),u.id()};
    var nodes=new LinkedHashMap<String,Map<String,Object>>();
    var projects=db.queryForList(cte+"SELECT p.id,p.name,p.owner_id,p.team_id FROM visible p ORDER BY p.name,p.id LIMIT 150",scope);
    var tasks=db.queryForList(cte+"""
      SELECT t.id,t.title AS name,t.status,t.assignee_id,t.project_id,
        (SELECT q.milestone_id FROM work_task_planning q WHERE q.tenant_id=t.tenant_id AND q.task_id=t.id) AS milestone_id,
        (SELECT q.parent_task_id FROM work_task_planning q WHERE q.tenant_id=t.tenant_id AND q.task_id=t.id) AS parent_id
      FROM visible p JOIN work_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id
      ORDER BY (t.status<>'DONE') DESC,t.updated_at DESC,t.id LIMIT 150""",scope);
    var goals=db.queryForList(cte+"SELECT g.id,g.name,g.project_id FROM work_goals g JOIN visible p ON p.id=g.project_id AND p.tenant_id=g.tenant_id ORDER BY g.id LIMIT 75",scope);
    var initiatives=db.queryForList(cte+"SELECT n.id,n.name,n.project_id,n.goal_id FROM work_initiatives n JOIN visible p ON p.id=n.project_id AND p.tenant_id=n.tenant_id ORDER BY n.id LIMIT 75",scope);
    var milestones=db.queryForList(cte+"SELECT m.id,m.name,m.project_id,m.initiative_id,m.due_date FROM work_milestones m JOIN visible p ON p.id=m.project_id AND p.tenant_id=m.tenant_id ORDER BY m.due_date,m.id LIMIT 75",scope);
    var people=db.queryForList(cte+"""
      SELECT DISTINCT u.id,coalesce(u.name,u.id) AS name FROM visible p JOIN users u ON u."tenantId"=p.tenant_id
      WHERE p.owner_id=u.id
        OR EXISTS(SELECT 1 FROM work_tasks t WHERE t.project_id=p.id AND t.tenant_id=p.tenant_id AND t.assignee_id=u.id)
        OR EXISTS(SELECT 1 FROM work_project_grants g WHERE g.project_id=p.id AND g.tenant_id=p.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL)
        OR EXISTS(SELECT 1 FROM work_availability a WHERE a.project_id=p.id AND a.tenant_id=p.tenant_id AND a.user_id=u.id AND a.revoked_at IS NULL)
        OR EXISTS(SELECT 1 FROM work_commitments c WHERE c.project_id=p.id AND c.tenant_id=p.tenant_id AND c.user_id=u.id AND c.revoked_at IS NULL)
      ORDER BY u.id LIMIT 150""",scope);
    List<Map<String,Object>> teams=List.of(),departments=List.of();
    if(orgVisible) {
      teams=db.queryForList(cte+"SELECT DISTINCT ot.id,ot.name,ot.department_id FROM visible p JOIN org_teams ot ON ot.id=p.team_id AND ot.tenant_id=p.tenant_id WHERE p.team_id IS NOT NULL ORDER BY ot.id LIMIT 100",scope);
      departments=db.queryForList(cte+"""
        SELECT DISTINCT d.id,d.name FROM visible p JOIN org_teams ot ON ot.id=p.team_id AND ot.tenant_id=p.tenant_id
        JOIN org_departments d ON d.id=ot.department_id AND d.tenant_id=ot.tenant_id ORDER BY d.id LIMIT 100""",scope);
    }
    for(var p:projects) node(nodes,"project",p.get("id"),(String)p.get("name"));
    for(var t:tasks) node(nodes,"task",t.get("id"),(String)t.get("name"),Map.of("status",String.valueOf(t.get("status"))));
    for(var g:goals) node(nodes,"goal",g.get("id"),(String)g.get("name"));
    for(var i:initiatives) node(nodes,"initiative",i.get("id"),(String)i.get("name"));
    for(var m:milestones) node(nodes,"milestone",m.get("id"),(String)m.get("name"),Map.of("due_date",String.valueOf(m.get("due_date"))));
    for(var b:people) node(nodes,"person",b.get("id"),(String)b.get("name"));
    for(var t:teams) node(nodes,"team",t.get("id"),(String)t.get("name"));
    for(var d:departments) node(nodes,"department",d.get("id"),(String)d.get("name"));
    var edges=new ArrayList<Map<String,Object>>();
    for(var p:projects) {
      link(edges,nodes,"OWNS",key("person",p.get("owner_id")),key("project",p.get("id")));
      link(edges,nodes,"IN_TEAM",key("project",p.get("id")),key("team",p.get("team_id")));
    }
    for(var t:tasks) {
      String id=key("task",t.get("id"));
      link(edges,nodes,"IN_PROJECT",id,key("project",t.get("project_id")));
      link(edges,nodes,"ASSIGNED",key("person",t.get("assignee_id")),id);
      link(edges,nodes,"PLANNED_FOR",id,key("milestone",t.get("milestone_id")));
      link(edges,nodes,"SUBTASK_OF",id,key("task",t.get("parent_id")));
    }
    for(var g:goals) link(edges,nodes,"IN_PROJECT",key("goal",g.get("id")),key("project",g.get("project_id")));
    for(var i:initiatives) {
      link(edges,nodes,"IN_PROJECT",key("initiative",i.get("id")),key("project",i.get("project_id")));
      link(edges,nodes,"SUPPORTS",key("initiative",i.get("id")),key("goal",i.get("goal_id")));
    }
    for(var m:milestones) {
      link(edges,nodes,"IN_PROJECT",key("milestone",m.get("id")),key("project",m.get("project_id")));
      link(edges,nodes,"DELIVERS",key("milestone",m.get("id")),key("initiative",m.get("initiative_id")));
    }
    for(var e:db.queryForList(cte+"""
      SELECT dep.task_id,dep.depends_on_id FROM work_dependencies dep
      JOIN work_tasks a ON a.id=dep.task_id AND a.tenant_id=dep.tenant_id JOIN visible p ON p.id=a.project_id AND p.tenant_id=a.tenant_id
      JOIN work_tasks b ON b.id=dep.depends_on_id AND b.tenant_id=dep.tenant_id JOIN visible q ON q.id=b.project_id AND q.tenant_id=b.tenant_id
      ORDER BY dep.task_id,dep.depends_on_id LIMIT 300""",scope))
      link(edges,nodes,"DEPENDS_ON",key("task",e.get("task_id")),key("task",e.get("depends_on_id")));
    if(orgVisible) {
      for(var m:db.queryForList("SELECT m.user_id AS person,m.team_id AS team FROM org_team_memberships m WHERE m.tenant_id=? AND m.revoked_at IS NULL ORDER BY m.user_id,m.team_id LIMIT 400",u.tenantId()))
        link(edges,nodes,"MEMBER_OF",key("person",m.get("person")),key("team",m.get("team")));
      for(var r:db.queryForList("SELECT r.employee_id AS person,r.manager_id AS manager FROM org_reporting_lines r WHERE r.tenant_id=? AND r.revoked_at IS NULL ORDER BY r.employee_id,r.manager_id LIMIT 400",u.tenantId()))
        link(edges,nodes,"REPORTS_TO",key("person",r.get("person")),key("person",r.get("manager")));
      for(var t:teams) link(edges,nodes,"IN_DEPARTMENT",key("team",t.get("id")),key("department",t.get("department_id")));
    }
    for(var c:db.queryForList(cte+"""
      SELECT c.user_id AS person,c.project_id,c.source_project_id,c.hours,c.period_start,c.period_end,c.title
      FROM work_commitments c JOIN visible p ON p.id=c.project_id AND p.tenant_id=c.tenant_id WHERE c.revoked_at IS NULL ORDER BY c.id LIMIT 200""",scope)) {
      String label=c.get("hours")+"h · "+c.get("period_start")+" – "+c.get("period_end");
      if(c.get("source_project_id")!=null&&nodes.containsKey(key("project",c.get("source_project_id"))))
        label+=" · from "+nodes.get(key("project",c.get("source_project_id"))).get("name");
      link(edges,nodes,"COMMITTED",key("person",c.get("person")),key("project",c.get("project_id")),label);
    }
    var result=new LinkedHashMap<String,Object>();
    result.put("generatedAt",Instant.now());
    result.put("method","Typed graph of authorized records only. Nodes: readable projects and their tasks, goals, initiatives, milestones plus every person referenced by them (owner, assignee, grant, availability, commitment); team and department structure appears only for manager-level dashboards. Edges: ownership, team, assignment, planning (subtask and milestone), dependencies, hierarchy, membership, and cross-project capacity draws. Structured relations are rendered as delivered; no relationships are inferred.");
    result.put("nodes",List.copyOf(nodes.values()));
    result.put("edges",edges);
    var counts=new LinkedHashMap<String,Object>();
    counts.put("projects",projects.size());counts.put("tasks",tasks.size());counts.put("goals",goals.size());
    counts.put("initiatives",initiatives.size());counts.put("milestones",milestones.size());counts.put("people",people.size());
    counts.put("teams",teams.size());counts.put("departments",departments.size());counts.put("edges",edges.size());
    result.put("counts",counts);
    return result;
  }

  private String key(String type,Object id) {return id==null?null:type+":"+id;}

  private void node(LinkedHashMap<String,Map<String,Object>> nodes,String type,Object id,String name) {
    node(nodes,type,id,name,Map.of());
  }

  private void node(LinkedHashMap<String,Map<String,Object>> nodes,String type,Object id,String name,Map<String,Object> extra) {
    if(id==null)return;
    var n=new LinkedHashMap<String,Object>();
    n.put("id",key(type,id));n.put("type",type);n.put("name",name);n.putAll(extra);
    nodes.put((String)n.get("id"),n);
  }

  private void link(List<Map<String,Object>> edges,Map<String,Map<String,Object>> nodes,String kind,String source,String target) {
    link(edges,nodes,kind,source,target,null);
  }

  private void link(List<Map<String,Object>> edges,Map<String,Map<String,Object>> nodes,String kind,String source,String target,String label) {
    if(source==null||target==null||source.equals(target))return;
    if(!nodes.containsKey(source)||!nodes.containsKey(target))return;
    var e=new LinkedHashMap<String,Object>();
    e.put("id",edges.size());e.put("kind",kind);e.put("source",source);e.put("target",target);
    if(label!=null)e.put("label",label);
    edges.add(e);
  }
}
