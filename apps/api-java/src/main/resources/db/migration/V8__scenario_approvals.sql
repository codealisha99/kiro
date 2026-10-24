CREATE TABLE work_scenario_approvals (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 scenario_id TEXT NOT NULL,
 requested_by TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 decided_by TEXT,
 decided_at TIMESTAMPTZ,
 reason VARCHAR(1000),
 version INTEGER NOT NULL DEFAULT 1,
 UNIQUE (tenant_id,scenario_id),
 FOREIGN KEY (tenant_id,scenario_id) REFERENCES work_scenarios(tenant_id,id),
 FOREIGN KEY (tenant_id,requested_by) REFERENCES users("tenantId",id),
 FOREIGN KEY (tenant_id,decided_by) REFERENCES users("tenantId",id),
 CHECK ((status='PENDING' AND decided_by IS NULL AND decided_at IS NULL) OR
        (status<>'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
 CHECK (status<>'REJECTED' OR (reason IS NOT NULL AND length(trim(reason))>0))
);
CREATE INDEX work_scenario_approval_scope ON work_scenario_approvals(tenant_id,status,requested_at DESC);
