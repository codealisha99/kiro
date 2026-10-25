ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_status_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_status_check CHECK(status IN (
  'UNCONFIGURED','PENDING','SYNCING','READY','RETRY','FAILED','REAUTH','DISCONNECTED','DELETED','OAUTH_AUTHORIZING','OAUTH_TENANT'
));
ALTER TABLE provider_connections ADD COLUMN encrypted_refresh_token TEXT;
ALTER TABLE provider_connections ADD COLUMN access_token_expires_at TIMESTAMPTZ;
ALTER TABLE provider_connections ADD COLUMN oauth_state_hash TEXT;
ALTER TABLE provider_connections ADD COLUMN oauth_state_expires_at TIMESTAMPTZ;
ALTER TABLE provider_connections ADD COLUMN encrypted_pkce_verifier TEXT;
CREATE TABLE provider_oauth_tenants (
  tenant_id TEXT NOT NULL, connection_id TEXT NOT NULL, xero_tenant_id TEXT NOT NULL, tenant_name TEXT NOT NULL,
  PRIMARY KEY(tenant_id,connection_id,xero_tenant_id),
  FOREIGN KEY(tenant_id,connection_id) REFERENCES provider_connections(tenant_id,id) ON DELETE CASCADE
);
