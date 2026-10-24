CREATE TABLE work_scenario_outcomes (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 scenario_id TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS','DELIVERED','NOT_DELIVERED','CANCELLED')),
 actual_hours NUMERIC(10,2) CHECK (actual_hours IS NULL OR actual_hours >= 0),
 note VARCHAR(1000) NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 version INTEGER NOT NULL DEFAULT 1,
 UNIQUE (tenant_id,scenario_id),
 FOREIGN KEY (tenant_id,scenario_id) REFERENCES work_scenarios(tenant_id,id),
 FOREIGN KEY (tenant_id,recorded_by) REFERENCES users("tenantId",id)
);
CREATE INDEX work_scenario_outcome_scope ON work_scenario_outcomes(tenant_id,recorded_at DESC);
