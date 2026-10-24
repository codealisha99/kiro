-- Explicit human-reviewed links. No title matching or implicit sharing.
ALTER TABLE work_tasks ADD CONSTRAINT work_task_project_identity UNIQUE(tenant_id,project_id,id);
CREATE TABLE work_source_mappings (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, task_id TEXT NOT NULL,
 record_id TEXT NOT NULL, created_by TEXT NOT NULL, rationale VARCHAR(1000) NOT NULL,
 source_title TEXT NOT NULL, source_url TEXT, source_kind TEXT NOT NULL,
 source_observed_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,project_id,task_id) REFERENCES work_tasks(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,record_id) REFERENCES provider_records(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES users("tenantId",id)
);
CREATE UNIQUE INDEX work_source_active ON work_source_mappings(tenant_id,record_id) WHERE revoked_at IS NULL;
CREATE INDEX work_source_project ON work_source_mappings(tenant_id,project_id,created_at DESC);
