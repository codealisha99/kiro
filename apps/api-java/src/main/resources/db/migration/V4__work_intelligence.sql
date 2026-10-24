-- Additive structured work model. Existing documents, tenants and identities are preserved.
ALTER TABLE users ADD CONSTRAINT users_tenant_identity UNIQUE ("tenantId", id);

CREATE TABLE work_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id),
  name VARCHAR(200) NOT NULL CHECK (length(trim(name)) > 0),
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, owner_id) REFERENCES users("tenantId", id)
);
-- Business access is explicit; the legacy ADMIN role confers no implicit project access.
CREATE TABLE work_project_grants (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('READ', 'WRITE')),
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  id TEXT PRIMARY KEY,
  FOREIGN KEY (tenant_id, project_id) REFERENCES work_projects(tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users("tenantId", id),
  FOREIGN KEY (tenant_id, granted_by) REFERENCES users("tenantId", id)
);
CREATE UNIQUE INDEX work_active_grant ON work_project_grants(project_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX work_grant_scope ON work_project_grants(tenant_id, user_id, project_id) WHERE revoked_at IS NULL;

CREATE TABLE work_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE')),
  assignee_id TEXT,
  remaining_hours NUMERIC(10,2) CHECK (remaining_hours >= 0),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES work_projects(tenant_id, id),
  FOREIGN KEY (tenant_id, assignee_id) REFERENCES users("tenantId", id),
  CHECK ((status = 'DONE') = (completed_at IS NOT NULL))
);
CREATE INDEX work_tasks_project ON work_tasks(tenant_id, project_id, status, due_date);
CREATE TABLE work_dependencies (
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  rationale VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, task_id, depends_on_id),
  CHECK (task_id <> depends_on_id),
  FOREIGN KEY (tenant_id, task_id) REFERENCES work_tasks(tenant_id, id),
  FOREIGN KEY (tenant_id, depends_on_id) REFERENCES work_tasks(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES users("tenantId", id)
);
CREATE INDEX work_dependency_reverse ON work_dependencies(tenant_id, depends_on_id);
CREATE TABLE work_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  task_id TEXT,
  -- Immutable snapshots of variable event payloads, not the primary fact store.
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, project_id) REFERENCES work_projects(tenant_id, id),
  FOREIGN KEY (tenant_id, actor_id) REFERENCES users("tenantId", id)
);
CREATE INDEX work_events_history ON work_events(tenant_id, project_id, occurred_at DESC);
CREATE TABLE work_insights (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  rule TEXT NOT NULL CHECK (rule IN ('OVERDUE', 'BLOCKED', 'UNASSIGNED')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  evidence_version INTEGER NOT NULL,
  evidence_due_date DATE,
  evidence_status TEXT NOT NULL,
  FOREIGN KEY (tenant_id, project_id) REFERENCES work_projects(tenant_id, id),
  FOREIGN KEY (tenant_id, task_id) REFERENCES work_tasks(tenant_id, id)
);
CREATE UNIQUE INDEX work_active_insight ON work_insights(task_id, rule) WHERE resolved_at IS NULL;
CREATE INDEX work_insight_scope ON work_insights(tenant_id, project_id, detected_at DESC);

CREATE TABLE work_scenarios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  name VARCHAR(200) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  available_hours NUMERIC(10,2) NOT NULL CHECK (available_hours > 0),
  proposed_hours NUMERIC(10,2) NOT NULL CHECK (proposed_hours >= 0),
  rationale VARCHAR(1000) NOT NULL,
  known_remaining_hours NUMERIC(14,2) NOT NULL,
  missing_estimates INTEGER NOT NULL,
  undated_tasks INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES work_projects(tenant_id, id),
  FOREIGN KEY (tenant_id, author_id) REFERENCES users("tenantId", id)
);
CREATE TABLE work_scenario_evidence (
  tenant_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_version INTEGER NOT NULL,
  remaining_hours NUMERIC(10,2),
  due_date DATE,
  PRIMARY KEY (scenario_id, task_id),
  FOREIGN KEY (tenant_id, scenario_id) REFERENCES work_scenarios(tenant_id, id),
  FOREIGN KEY (tenant_id, task_id) REFERENCES work_tasks(tenant_id, id)
);
CREATE INDEX work_scenarios_scope ON work_scenarios(tenant_id, project_id, created_at DESC);
