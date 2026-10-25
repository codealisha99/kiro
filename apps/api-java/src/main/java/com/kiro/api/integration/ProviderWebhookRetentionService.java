package com.kiro.api.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Bounded cleanup for completed webhook metadata; unprocessed events remain available for recovery. */
@Service
public class ProviderWebhookRetentionService {
  private static final Logger log = LoggerFactory.getLogger(ProviderWebhookRetentionService.class);
  private static final int BATCH_SIZE = 1_000;
  private static final int MAX_BATCHES_PER_RUN = 10;
  private final JdbcTemplate db;
  private final int retentionDays;
  private final TransactionTemplate tx;

  public ProviderWebhookRetentionService(JdbcTemplate db,
      @Value("${XERO_WEBHOOK_EVENT_RETENTION_DAYS:90}") int retentionDays,
      PlatformTransactionManager manager) {
    if (retentionDays < 1 || retentionDays > 3_650)
      throw new IllegalArgumentException("XERO_WEBHOOK_EVENT_RETENTION_DAYS must be between 1 and 3650");
    this.db = db;
    this.retentionDays = retentionDays;
    this.tx = new TransactionTemplate(manager);
  }

  @Scheduled(cron = "${XERO_WEBHOOK_RETENTION_CRON:0 20 2 * * *}", zone = "UTC")
  public void scheduledCleanup() {
    int removed = purgeExpired();
    if (removed > 0) log.info("Removed {} reconciled provider webhook events older than {} days", removed, retentionDays);
  }

  int purgeExpired() {
    int total = 0;
    for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
      Integer removed = tx.execute(status -> db.queryForList("""
        WITH expired AS (
          SELECT id FROM provider_webhook_events
          WHERE status='RECONCILED' AND received_at < now() - (? * interval '1 day')
          ORDER BY received_at LIMIT ? FOR UPDATE SKIP LOCKED
        )
        DELETE FROM provider_webhook_events events USING expired
        WHERE events.id=expired.id RETURNING events.id
        """, String.class, retentionDays, BATCH_SIZE).size());
      if (removed == null || removed == 0) break;
      total += removed;
      if (removed < BATCH_SIZE) break;
    }
    return total;
  }
}
