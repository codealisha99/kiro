CREATE TABLE work_actions (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, connection_id TEXT NOT NULL,
 requested_by TEXT NOT NULL, approved_by TEXT, decided_at TIMESTAMPTZ,
 title VARCHAR(200) NOT NULL, body VARCHAR(10000) NOT NULL, rationale VARCHAR(1000) NOT NULL,
 repository TEXT NOT NULL, decision_reason VARCHAR(1000),
 status TEXT NOT NULL CHECK(status IN ('PROPOSED','APPROVED','REJECTED','EXECUTING','EXECUTED','FAILED','UNKNOWN')),
 version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
 external_id TEXT, external_url TEXT, error_code VARCHAR(200),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES provider_connections(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES users("tenantId",id),
 FOREIGN KEY(tenant_id,approved_by) REFERENCES users("tenantId",id),
 CHECK(approved_by IS NULL OR approved_by<>requested_by)
);
CREATE INDEX work_actions_scope ON work_actions(tenant_id,project_id,created_at DESC);
