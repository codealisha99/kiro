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
      SELECT r.*,f.amount AS finance_amount,f.currency AS finance_currency,p.department AS source_department,
        p.supervisor_reference AS source_supervisor_reference,m.metric AS source_metric,m.value AS source_metric_value,
        m.unit AS source_metric_unit,m.period_start AS source_period_start,m.period_end AS source_period_end,
        m.campaign AS source_campaign
      FROM provider_records r JOIN provider_connections c ON c.id=r.connection_id AND c.tenant_id=r.tenant_id
      LEFT JOIN provider_financial_facts f ON f.tenant_id=r.tenant_id AND f.record_id=r.id
      LEFT JOIN provider_people_facts p ON p.tenant_id=r.tenant_id AND p.record_id=r.id
      LEFT JOIN provider_metric_observations m ON m.tenant_id=r.tenant_id AND m.record_id=r.id
      WHERE r.tenant_id=? AND r.id=? AND c.owner_id=? AND c.status='READY' AND c.last_success_at>now()-interval '24 hours'
        AND r.deleted_at IS NULL FOR UPDATE OF c,r
      """,u.tenantId(),input.recordId(),u.id());
    if(sources.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Current owned source record not found");
    var r=sources.getFirst();
    if(!Set.of("ISSUE","TASK","PULL_REQUEST","MESSAGE","DEAL","INVOICE","EMPLOYEE","MARKETING_METRIC").contains(r.get("kind")))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This provider record type cannot be shared with project work");
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
      INSERT INTO work_source_mappings(id,tenant_id,project_id,task_id,record_id,created_by,rationale,source_title,source_url,source_kind,source_observed_at,
        source_amount,source_currency,source_department,source_supervisor_reference,source_metric,source_metric_value,source_metric_unit,source_period_start,source_period_end,source_campaign)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?)
      """,id,u.tenantId(),projectId,taskId,input.recordId(),u.id(),input.rationale().trim(),r.get("title"),r.get("source_url"),r.get("kind"),r.get("observed_at"),
      r.get("finance_amount"),r.get("finance_currency"),r.get("source_department"),r.get("source_supervisor_reference"),r.get("source_metric"),
      r.get("source_metric_value"),r.get("source_metric_unit"),r.get("source_period_start"),r.get("source_period_end"),r.get("source_campaign"));
    audit(u,projectId,taskId,id,"SOURCE_LINKED");return Map.of("id",id,"taskId",taskId);
  }
  public List<Map<String,Object>> list(AuthenticatedPrincipal u,String projectId,int offset) {
    work.project(u,projectId,false);
    return db.queryForList("""
      SELECT m.id,m.task_id,m.source_title,m.source_url,m.source_kind,m.rationale,m.source_observed_at,m.created_at,
        m.source_amount,m.source_currency,m.source_department,m.source_supervisor_reference,m.source_metric,m.source_metric_value,
        m.source_metric_unit,m.source_period_start,m.source_period_end,m.source_campaign,
        CASE WHEN r.deleted_at IS NOT NULL THEN 'REMOVED'
          WHEN c.status<>'READY' OR c.last_success_at<now()-interval '24 hours' THEN 'UNAVAILABLE'
          WHEN r.title<>m.source_title OR r.source_url IS DISTINCT FROM m.source_url
            OR f.amount IS DISTINCT FROM m.source_amount OR f.currency IS DISTINCT FROM m.source_currency
            OR p.department IS DISTINCT FROM m.source_department OR p.supervisor_reference IS DISTINCT FROM m.source_supervisor_reference
            OR mo.metric IS DISTINCT FROM m.source_metric OR mo.value IS DISTINCT FROM m.source_metric_value
            OR mo.unit IS DISTINCT FROM m.source_metric_unit OR mo.period_start IS DISTINCT FROM m.source_period_start
            OR mo.period_end IS DISTINCT FROM m.source_period_end OR mo.campaign IS DISTINCT FROM m.source_campaign THEN 'CHANGED'
          ELSE 'CURRENT' END AS freshness
      FROM work_source_mappings m JOIN provider_records r ON r.id=m.record_id AND r.tenant_id=m.tenant_id
      JOIN provider_connections c ON c.id=r.connection_id AND c.tenant_id=r.tenant_id
      LEFT JOIN provider_financial_facts f ON f.tenant_id=r.tenant_id AND f.record_id=r.id
      LEFT JOIN provider_people_facts p ON p.tenant_id=r.tenant_id AND p.record_id=r.id
      LEFT JOIN provider_metric_observations mo ON mo.tenant_id=r.tenant_id AND mo.record_id=r.id
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
