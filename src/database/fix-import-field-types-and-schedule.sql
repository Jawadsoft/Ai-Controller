-- Fix invalid import_field_mappings.field_type values and allow schedule frequency 'test'
-- Safe to re-run (idempotent)
--
-- Production may still use legacy constraint values (text, array). Drop the constraint
-- before normalizing rows to the app schema (string, number, date, boolean, json).

BEGIN;

-- ============================================================
-- 1) Drop legacy field_type check constraint first
--    (required before updating rows to new values like 'string')
-- ============================================================
ALTER TABLE import_field_mappings
  DROP CONSTRAINT IF EXISTS import_field_mappings_field_type_check;

-- ============================================================
-- 2) Normalize existing field_type values
-- ============================================================
UPDATE import_field_mappings
SET field_type = CASE
  WHEN LOWER(TRIM(field_type)) IN ('string', 'str', 'varchar', 'char', 'text', 'uuid') THEN 'string'
  WHEN LOWER(TRIM(field_type)) IN ('number', 'numeric', 'decimal', 'float', 'double', 'money', 'currency', 'integer', 'int', 'bigint', 'smallint') THEN 'number'
  WHEN LOWER(TRIM(field_type)) IN ('boolean', 'bool', 'bit') THEN 'boolean'
  WHEN LOWER(TRIM(field_type)) IN ('date', 'datetime', 'timestamp', 'timestamptz', 'time') THEN 'date'
  WHEN LOWER(TRIM(field_type)) IN ('json', 'jsonb', 'array') THEN 'json'
  WHEN field_type IS NULL OR TRIM(field_type) = '' THEN 'string'
  ELSE 'string'
END,
updated_at = NOW()
WHERE field_type IS NULL
   OR TRIM(field_type) = ''
   OR LOWER(TRIM(field_type)) NOT IN ('string', 'number', 'date', 'boolean', 'json');

-- ============================================================
-- 3) Recreate field_type check constraint (app-compatible values)
-- ============================================================
ALTER TABLE import_field_mappings
  ADD CONSTRAINT import_field_mappings_field_type_check
  CHECK (field_type IN ('string', 'number', 'date', 'boolean', 'json'));

-- ============================================================
-- 4) Allow schedule frequency 'test' (UI uses Test 2 minutes)
-- ============================================================
ALTER TABLE import_schedule_settings
  DROP CONSTRAINT IF EXISTS import_schedule_settings_frequency_check;

ALTER TABLE import_schedule_settings
  ADD CONSTRAINT import_schedule_settings_frequency_check
  CHECK (frequency IN ('manual', 'test', 'hourly', 'daily', 'weekly', 'monthly'));

COMMIT;
