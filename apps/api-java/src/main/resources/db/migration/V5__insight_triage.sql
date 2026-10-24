-- Triage does not erase a detected condition or its original evidence.
ALTER TABLE work_insights
  ADD COLUMN triage_status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (triage_status IN ('OPEN', 'ACKNOWLEDGED', 'DISMISSED')),
  ADD COLUMN triage_reason VARCHAR(1000),
  ADD COLUMN triaged_by TEXT,
  ADD COLUMN triaged_at TIMESTAMPTZ,
  ADD COLUMN triage_version INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT work_insight_triage_actor FOREIGN KEY (tenant_id, triaged_by)
    REFERENCES users("tenantId", id),
  ADD CONSTRAINT work_insight_dismissal_reason CHECK
    (triage_status <> 'DISMISSED' OR (triage_reason IS NOT NULL AND length(trim(triage_reason)) > 0));
