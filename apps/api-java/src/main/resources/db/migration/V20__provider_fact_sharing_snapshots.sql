ALTER TABLE work_source_mappings
  ADD COLUMN source_amount NUMERIC(20,4),
  ADD COLUMN source_currency VARCHAR(10),
  ADD COLUMN source_department TEXT,
  ADD COLUMN source_supervisor_reference TEXT,
  ADD COLUMN source_metric VARCHAR(60),
  ADD COLUMN source_metric_value NUMERIC(24,6),
  ADD COLUMN source_metric_unit VARCHAR(40),
  ADD COLUMN source_period_start DATE,
  ADD COLUMN source_period_end DATE,
  ADD COLUMN source_campaign TEXT;
