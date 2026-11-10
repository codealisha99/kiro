-- Goals, check-ins and goal-task links. Scope columns follow the role-binding rule.
CREATE TABLE org_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id),
  scope TEXT NOT NULL CHECK (scope IN ('COMPANY', 'DEPARTMENT', 'TEAM', 'PERSON')),
  department_id TEXT,
  team_id TEXT,
  owner_id TEXT NOT NULL,
  parent_id TEXT,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  description VARCHAR(2000),
  measure TEXT NOT NULL CHECK (measure IN ('METRIC', 'TASKS', 'CHILDREN')),
  unit VARCHAR(40),
  start_value NUMERIC(14,2),
  target_value NUMERIC(14,2),
  current_value NUMERIC(14,2),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL CHECK (due_date >= start_date),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACHIEVED', 'CANCELLED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK ((scope IN ('COMPANY', 'PERSON') AND department_id IS NULL AND team_id IS NULL) OR
         (scope = 'DEPARTMENT' AND department_id IS NOT NULL AND team_id IS NULL) OR
         (scope = 'TEAM' AND team_id IS NOT NULL AND department_id IS NULL)),
  CHECK (measure <> 'METRIC' OR (start_value IS NOT NULL AND target_value IS NOT NULL
         AND current_value IS NOT NULL AND target_value <> start_value)),
  CHECK (parent_id IS NULL OR parent_id <> id),
  FOREIGN KEY (tenant_id, owner_id) REFERENCES users("tenantId", id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES org_departments(tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES org_teams(tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES org_goals(tenant_id, id)
);
CREATE INDEX org_goals_owner ON org_goals(tenant_id, owner_id);
CREATE INDEX org_goals_parent ON org_goals(tenant_id, parent_id);

CREATE TABLE org_goal_tasks (
  tenant_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  PRIMARY KEY (goal_id, task_id),
  FOREIGN KEY (tenant_id, goal_id) REFERENCES org_goals(tenant_id, id),
  FOREIGN KEY (tenant_id, task_id) REFERENCES work_tasks(tenant_id, id)
);
CREATE INDEX org_goal_tasks_task ON org_goal_tasks(tenant_id, task_id);

CREATE TABLE org_goal_checkins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  value NUMERIC(14,2),
  note VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, goal_id) REFERENCES org_goals(tenant_id, id),
  FOREIGN KEY (tenant_id, author_id) REFERENCES users("tenantId", id)
);
CREATE INDEX org_goal_checkins_goal ON org_goal_checkins(tenant_id, goal_id, created_at);
