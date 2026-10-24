CREATE TABLE provider_connections (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('github','slack','linear','hubspot','xero','bamboohr')),
 name VARCHAR(200) NOT NULL, resource TEXT NOT NULL, account_id TEXT NOT NULL DEFAULT '',
 encrypted_token TEXT,
 status TEXT NOT NULL DEFAULT 'UNCONFIGURED' CHECK(status IN ('UNCONFIGURED','PENDING','SYNCING','READY','RETRY','FAILED','REAUTH','DISCONNECTED')),
 cursor TEXT, generation TEXT, lease_id TEXT, lease_until TIMESTAMPTZ,
 next_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_success_at TIMESTAMPTZ,
 failure_count INTEGER NOT NULL DEFAULT 0, last_error VARCHAR(200),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users("tenantId",id)
);
CREATE INDEX provider_sync_due ON provider_connections(next_sync_at) WHERE encrypted_token IS NOT NULL;
CREATE TABLE provider_sync_runs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, connection_id TEXT NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
 status TEXT NOT NULL, records_seen INTEGER NOT NULL DEFAULT 0, error_code VARCHAR(200),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES provider_connections(tenant_id,id)
);
CREATE TABLE provider_records (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, connection_id TEXT NOT NULL,
 external_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT,
 source_url TEXT, source_updated_at TEXT, observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 generation TEXT NOT NULL, deleted_at TIMESTAMPTZ,
 UNIQUE(connection_id,external_id), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES provider_connections(tenant_id,id)
);
CREATE INDEX provider_record_scope ON provider_records(tenant_id,connection_id,deleted_at);
CREATE TABLE provider_financial_facts (
 tenant_id TEXT NOT NULL, record_id TEXT PRIMARY KEY, amount NUMERIC(20,4), currency VARCHAR(10),
 FOREIGN KEY(tenant_id,record_id) REFERENCES provider_records(tenant_id,id)
);
CREATE TABLE provider_people_facts (
 tenant_id TEXT NOT NULL, record_id TEXT PRIMARY KEY, department TEXT, supervisor_reference TEXT,
 FOREIGN KEY(tenant_id,record_id) REFERENCES provider_records(tenant_id,id)
);
