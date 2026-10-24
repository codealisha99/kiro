CREATE TABLE work_goals (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, name VARCHAR(200) NOT NULL,
 unit VARCHAR(40) NOT NULL, target NUMERIC(14,2) NOT NULL CHECK(target>0), observed NUMERIC(14,2) NOT NULL CHECK(observed>=0),
 due_date DATE, rationale VARCHAR(1000) NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id)
);
CREATE TABLE work_initiatives (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, goal_id TEXT,
 name VARCHAR(200) NOT NULL, outcome VARCHAR(1000) NOT NULL, UNIQUE(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,project_id,goal_id) REFERENCES work_goals(tenant_id,project_id,id)
);
CREATE TABLE work_milestones (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, initiative_id TEXT,
 name VARCHAR(200) NOT NULL, due_date DATE NOT NULL, UNIQUE(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,project_id,initiative_id) REFERENCES work_initiatives(tenant_id,project_id,id)
);
CREATE TABLE work_task_planning (
 tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, task_id TEXT PRIMARY KEY,
 parent_task_id TEXT, milestone_id TEXT, priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
 required_skill VARCHAR(100), version INTEGER NOT NULL DEFAULT 1, CHECK(task_id<>parent_task_id),
 FOREIGN KEY(tenant_id,project_id,task_id) REFERENCES work_tasks(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id,parent_task_id) REFERENCES work_tasks(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id,milestone_id) REFERENCES work_milestones(tenant_id,project_id,id)
);
CREATE TABLE work_availability (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
 period_start DATE NOT NULL, period_end DATE NOT NULL, hours NUMERIC(10,2) NOT NULL CHECK(hours>=0),
 rationale VARCHAR(1000) NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ,
 CHECK(period_end>=period_start),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES users("tenantId",id)
);
CREATE INDEX work_availability_scope ON work_availability(tenant_id,project_id,period_start,period_end) WHERE revoked_at IS NULL;
CREATE TABLE work_skills (
 tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, user_id TEXT NOT NULL, skill VARCHAR(100) NOT NULL,
 evidence VARCHAR(1000) NOT NULL, recorded_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id,user_id,skill),
 FOREIGN KEY(tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id),
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES users("tenantId",id)
);
CREATE TABLE work_time_entries (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, task_id TEXT NOT NULL,
 user_id TEXT NOT NULL, worked_on DATE NOT NULL, hours NUMERIC(8,2) NOT NULL CHECK(hours>0 AND hours<=24),
 note VARCHAR(1000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), voided_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,project_id,task_id) REFERENCES work_tasks(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id)
);
CREATE INDEX work_time_scope ON work_time_entries(tenant_id,project_id,worked_on);
