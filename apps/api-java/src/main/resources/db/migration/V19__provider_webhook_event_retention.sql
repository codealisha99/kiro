CREATE INDEX provider_webhook_reconciled_retention
  ON provider_webhook_events(received_at)
  WHERE status='RECONCILED';
