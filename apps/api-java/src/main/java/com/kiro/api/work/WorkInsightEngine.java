package com.kiro.api.work;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Deterministic, idempotent rules. Facts and their observed version are persisted, never inferred by an LLM. */
@Service
public class WorkInsightEngine {
  private final JdbcTemplate db;
  private final TransactionTemplate transactions;
  public WorkInsightEngine(JdbcTemplate db, PlatformTransactionManager manager) {
    this.db=db; this.transactions=new TransactionTemplate(manager);
  }

  @Scheduled(fixedDelayString="${app.work.insight-interval-ms:60000}", initialDelay=60000)
  public void scheduledRefresh() {
    // Keyset batches bound memory; independent transactions release locks between projects.
    String after="";
    while(true) {
      var projects=db.queryForList("SELECT tenant_id,id FROM work_projects WHERE id>? ORDER BY id LIMIT 100",after);
      if(projects.isEmpty()) return;
      for(var p:projects) transactions.executeWithoutResult(tx -> refreshProject((String)p.get("tenant_id"),(String)p.get("id")));
      after=(String)projects.getLast().get("id");
    }
  }

  @Transactional
  public void refreshProject(String tenant,String project) {
    db.queryForList("SELECT id FROM work_projects WHERE tenant_id=? AND id=? FOR UPDATE",tenant,project);
    for(String rule:new String[]{"OVERDUE","BLOCKED","UNASSIGNED"}) {
      String condition=switch(rule) {
        case "OVERDUE" -> "t.status<>'DONE' AND t.due_date < (now() AT TIME ZONE 'UTC')::date";
        case "BLOCKED" -> "t.status='BLOCKED'";
        default -> "t.status<>'DONE' AND t.assignee_id IS NULL";
      };
      db.update("""
          UPDATE work_insights i SET resolved_at=now() WHERE tenant_id=? AND project_id=? AND rule=?
          AND resolved_at IS NULL AND NOT EXISTS (SELECT 1 FROM work_tasks t WHERE t.id=i.task_id AND
          """+condition+")",tenant,project,rule);
      db.update("""
          INSERT INTO work_insights(id,tenant_id,project_id,task_id,rule,evidence_version,evidence_due_date,evidence_status)
          SELECT gen_random_uuid()::text,t.tenant_id,t.project_id,t.id,?,t.version,t.due_date,t.status
          FROM work_tasks t WHERE t.tenant_id=? AND t.project_id=? AND
          """+condition+"\n"+"""
          ON CONFLICT (task_id,rule) WHERE resolved_at IS NULL
          DO UPDATE SET last_observed_at=now()
          """,rule,tenant,project);
    }
  }
}
