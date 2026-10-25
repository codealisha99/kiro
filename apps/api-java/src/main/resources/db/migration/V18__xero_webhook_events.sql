ALTER TABLE provider_connections ADD COLUMN sync_requested BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE provider_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider = 'xero'),
  event_sequence BIGINT NOT NULL,
  resource_id TEXT NOT NULL,
  event_category VARCHAR(40) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  event_date_utc TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','PROCESSING','RECONCILED')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id,event_sequence),
  FOREIGN KEY(tenant_id,connection_id) REFERENCES provider_connections(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX provider_webhook_pending ON provider_webhook_events(connection_id,status,received_at);
