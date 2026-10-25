-- One-time, idempotent optimization; no operational data/formula changes.
CREATE INDEX IF NOT EXISTS idx_daily_inputs_field_date ON daily_inputs (field_code, operating_date);
