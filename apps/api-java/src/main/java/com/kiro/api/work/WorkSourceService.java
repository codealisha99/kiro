package com.kiro.api.work;

import com.kiro.api.organization.OrganizationService;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Transactional
public class WorkSourceService {
  private final JdbcTemplate db; private final WorkService work; private final OrganizationService org;
  public WorkSourceService(JdbcTemplate db,WorkService work,OrganizationService org) { this.db=db;this.work=work;this.org=org; }
  public record MappingInput(@NotBlank String recordId,@Size(max=100) String taskId,
      @NotBlank @Size(max=1000) String rationale,@AssertTrue boolean shareWithProject) {}
  public Object map(AuthenticatedPrincipal u,String projectId,MappingInput input) {
    org.requireManage(u,"INTEGRATION_MANAGE");work.project(u,projectId,true);
    if(!input.shareWithProject()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Confirm sharing with the project audience");
    var sources=db.queryForList("""
      SELECT r.* FROM provider_records r JOIN provider_connections c ON c.id=r.connection_id AND c.tenant_id=r.tenant_id
      WHERE r.tenant_id=? AND r.id=? AND c.owner_id=? AND c.status='READY' AND c.last_success_at>now()-interval '24 hours'
        AND r.deleted_at IS NULL FOR UPDATE OF c,r
      """,u.tenantId(),input.recordId(),u.id());
    if(sources.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Current owned source record not found");
    var r=sources.getFirst();
    if(!Set.of("ISSUE","TASK","PULL_REQUEST","MESSAGE").contains(r.get("kind")))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Only work issues, pull requests and approved messages can be linked here");
    if(db.queryForObject("SELECT count(*) FROM work_source_mappings WHERE tenant_id=? AND record_id=? AND revoked_at IS NULL",Long.class,u.tenantId(),input.recordId())>0)
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Source is already linked; revoke its existing mapping before correcting it");
    String taskId=input.taskId();
    if(taskId==null || taskId.isBlank()) {
      String title=(String)r.get("title");
      if(title.isBlank()) title="Imported work item";
      taskId=(String)work.saveTask(u,projectId,null,new WorkDtos.TaskInput(title.substring(0,Math.min(200,title.length())),"TODO",null,null,null,null)).get("id");
    } else if(db.queryForObject("SELECT count(*) FROM work_tasks WHERE tenant_id=? AND project_id=? AND id=?",Long.class,u.tenantId(),projectId,taskId)==0)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Task not found in target project");
    String id=UUID.randomUUID().toString();
    db.update("""
      INSERT INTO work_source_mappings(id,tenant_id,project_id,task_id,record_id,created_by,rationale,source_title,source_url,source_kind,source_observed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      """,id,u.tenantId(),projectId,taskId,input.recordId(),u.id(),input.rationale().trim(),r.get("title"),r.get("source_url"),r.get("kind"),r.get("observed_at"));
    audit(u,projectId,taskId,id,"SOURCE_LINKED");return Map.of("id",id,"taskId",taskId);
  }
  public List<Map<String,Object>> list(AuthenticatedPrincipal u,String projectId,int offset) {
    work.project(u,projectId,false);
    return db.queryForList("""
      SELECT m.id,m.task_id,m.source_title,m.source_url,m.source_kind,m.rationale,m.source_observed_at,m.created_at,
        CASE WHEN r.deleted_at IS NOT NULL THEN 'REMOVED'
          WHEN c.status<>'READY' OR c.last_success_at<now()-interval '24 hours' THEN 'UNAVAILABLE'
          WHEN r.title<>m.source_title OR r.source_url IS DISTINCT FROM m.source_url THEN 'CHANGED'
          ELSE 'CURRENT' END AS freshness
      FROM work_source_mappings m JOIN provider_records r ON r.id=m.record_id AND r.tenant_id=m.tenant_id
      JOIN provider_connections c ON c.id=r.connection_id AND c.tenant_id=r.tenant_id
      WHERE m.tenant_id=? AND m.project_id=? AND m.revoked_at IS NULL ORDER BY m.created_at DESC,m.id LIMIT 100 OFFSET ?
      """,u.tenantId(),projectId,offset);
  }
  public Object revoke(AuthenticatedPrincipal u,String projectId,String id) {
    work.project(u,projectId,true);
    var rows=db.queryForList("UPDATE work_source_mappings SET revoked_at=now() WHERE tenant_id=? AND project_id=? AND id=? AND revoked_at IS NULL RETURNING task_id",u.tenantId(),projectId,id);
    if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Mapping not found");
    audit(u,projectId,(String)rows.getFirst().get("task_id"),id,"SOURCE_UNLINKED");return Map.of("ok",true);
  }
  private void audit(AuthenticatedPrincipal u,String projectId,String taskId,String mapping,String kind) {
    db.update("INSERT INTO work_events(id,tenant_id,project_id,actor_id,kind,task_id,payload) VALUES (?,?,?,?,?,?,jsonb_build_object('mappingId',?::text))",
        UUID.randomUUID().toString(),u.tenantId(),projectId,u.id(),kind,taskId,mapping);
  }
}
