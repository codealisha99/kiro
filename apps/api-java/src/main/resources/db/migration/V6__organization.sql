CREATE TABLE org_departments (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES "Tenant"(id), name VARCHAR(200) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE org_teams (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES "Tenant"(id), department_id TEXT NOT NULL,
 name VARCHAR(200) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,department_id) REFERENCES org_departments(tenant_id,id), UNIQUE(tenant_id,department_id,name)
);
CREATE TABLE org_team_memberships (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,team_id) REFERENCES org_teams(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id)
);
CREATE UNIQUE INDEX org_active_member ON org_team_memberships(team_id,user_id) WHERE revoked_at IS NULL;
CREATE INDEX org_member_scope ON org_team_memberships(tenant_id,user_id) WHERE revoked_at IS NULL;
CREATE TABLE org_reporting_lines (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, employee_id TEXT NOT NULL, manager_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ,
 CHECK(employee_id<>manager_id), FOREIGN KEY(tenant_id,employee_id) REFERENCES users("tenantId",id),
 FOREIGN KEY(tenant_id,manager_id) REFERENCES users("tenantId",id)
);
CREATE UNIQUE INDEX org_active_reporting ON org_reporting_lines(employee_id,manager_id) WHERE revoked_at IS NULL;
CREATE TABLE org_roles (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES "Tenant"(id), name VARCHAR(100) NOT NULL,
 dashboard TEXT NOT NULL CHECK(dashboard IN ('EMPLOYEE','MANAGER','DIRECTOR','VP','CEO','ADMIN')),
 version INTEGER NOT NULL DEFAULT 1, UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE org_role_permissions (
 tenant_id TEXT NOT NULL, role_id TEXT NOT NULL,
 permission TEXT NOT NULL CHECK(permission IN ('PROJECT_READ','PROJECT_WRITE','ORG_MANAGE','INTEGRATION_MANAGE')),
 PRIMARY KEY(role_id,permission), FOREIGN KEY(tenant_id,role_id) REFERENCES org_roles(tenant_id,id)
);
CREATE TABLE org_role_bindings (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, role_id TEXT NOT NULL, user_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('COMPANY','DEPARTMENT','TEAM')), department_id TEXT, team_id TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ,
 CHECK((scope='COMPANY' AND department_id IS NULL AND team_id IS NULL) OR
       (scope='DEPARTMENT' AND department_id IS NOT NULL AND team_id IS NULL) OR
       (scope='TEAM' AND team_id IS NOT NULL AND department_id IS NULL)),
 FOREIGN KEY(tenant_id,role_id) REFERENCES org_roles(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users("tenantId",id),
 FOREIGN KEY(tenant_id,department_id) REFERENCES org_departments(tenant_id,id),
 FOREIGN KEY(tenant_id,team_id) REFERENCES org_teams(tenant_id,id)
);
CREATE INDEX org_role_scope ON org_role_bindings(tenant_id,user_id) WHERE revoked_at IS NULL;
CREATE TABLE org_audit_events (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL, kind TEXT NOT NULL,
 payload JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES users("tenantId",id)
);
CREATE INDEX org_audit_history ON org_audit_events(tenant_id,occurred_at DESC);
ALTER TABLE work_projects ADD COLUMN team_id TEXT, ADD COLUMN restricted BOOLEAN NOT NULL DEFAULT true,
 ADD CONSTRAINT work_project_team FOREIGN KEY(tenant_id,team_id) REFERENCES org_teams(tenant_id,id);
