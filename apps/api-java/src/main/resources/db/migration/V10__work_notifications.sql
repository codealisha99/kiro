CREATE TABLE work_notifications (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('SCENARIO_APPROVAL_REQUESTED','SCENARIO_APPROVAL_DECIDED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 read_at TIMESTAMPTZ,
 UNIQUE (tenant_id,recipient_id,resource_id,kind),
 FOREIGN KEY (tenant_id,recipient_id) REFERENCES users("tenantId",id),
 FOREIGN KEY (tenant_id,project_id) REFERENCES work_projects(tenant_id,id),
 FOREIGN KEY (tenant_id,resource_id) REFERENCES work_scenarios(tenant_id,id)
);
CREATE INDEX work_notification_inbox ON work_notifications(tenant_id,recipient_id,created_at DESC);
