ALTER TABLE provider_connections ADD COLUMN provider_source_id TEXT;
ALTER TABLE provider_records ADD COLUMN content TEXT NOT NULL DEFAULT '';

UPDATE provider_connections
SET provider_source_id = 'provider-' || id
WHERE provider_source_id IS NULL;

INSERT INTO "sources" ("id", "tenantId", "type", "name", "status", "deleted")
SELECT c.provider_source_id, c.tenant_id, 'PROVIDER', c.name,
       CASE WHEN c.status IN ('READY','PENDING','SYNCING','RETRY') THEN 'CONNECTED'::"SourceStatus" ELSE 'DISCONNECTED'::"SourceStatus" END,
       c.status IN ('DELETED','DISCONNECTED')
FROM provider_connections c
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE provider_connections ALTER COLUMN provider_source_id SET NOT NULL;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_source_fk
  FOREIGN KEY (provider_source_id) REFERENCES "sources"("id");

CREATE INDEX provider_connection_source_idx ON provider_connections(provider_source_id);
