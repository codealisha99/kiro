ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_status_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_status_check
  CHECK(status IN ('UNCONFIGURED','PENDING','SYNCING','READY','RETRY','FAILED','REAUTH','DISCONNECTED','DELETED'));
