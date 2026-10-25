ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_provider_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check CHECK(provider IN ('github','slack','linear','hubspot','xero','bamboohr','googleanalytics'));
CREATE TABLE provider_metric_observations (
 tenant_id TEXT NOT NULL, record_id TEXT PRIMARY KEY, metric TEXT NOT NULL, value NUMERIC(24,6) NOT NULL,
 unit VARCHAR(40) NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL,
 campaign TEXT NOT NULL, currency VARCHAR(10),
 FOREIGN KEY(tenant_id,record_id) REFERENCES provider_records(tenant_id,id),
 CHECK(period_end>=period_start)
);
