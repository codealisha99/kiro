CREATE TABLE work_commitments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_project_id TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours NUMERIC(10,2) NOT NULL CHECK(hours>0),
  title VARCHAR(200) NOT NULL,
  rationale VARCHAR(1000) NOT NULL,
  created_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CHECK(period_end>=period_start),
  CHECK(source_project_id IS NULL OR source_project_id<>project_id),
  FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
  FOREIGN KEY(tenant_id,source_project_id) REFERENCES work_projects(tenant_id,id),
  FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES users("tenantId",id)
);
CREATE INDEX work_commitments_person ON work_commitments(tenant_id,user_id,period_start,period_end) WHERE revoked_at IS NULL;
