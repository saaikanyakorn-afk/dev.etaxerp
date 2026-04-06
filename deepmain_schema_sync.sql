-- ============================================
-- E-Tax Center: Deep-Main Schema Sync
-- Date: 2026-04-06
-- ============================================
-- 12 missing columns found on deep-main
-- Backup: DONE (saved .sql file)
-- Safe: All use IF NOT EXISTS / nullable / have defaults
-- ============================================

-- 1. clone_history
ALTER TABLE clone_history ADD COLUMN IF NOT EXISTS source_machine text;
ALTER TABLE clone_history ADD COLUMN IF NOT EXISTS synced_to_central boolean DEFAULT false;

-- 2. machine_nics
ALTER TABLE machine_nics ADD COLUMN IF NOT EXISTS router_id integer;

-- 3. machines (5 columns)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS env_content text;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS target_db_machine_id integer;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS internet_type text NOT NULL DEFAULT 'dynamic';
ALTER TABLE machines ADD COLUMN IF NOT EXISTS physical_location text;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS router_id integer;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS location_id integer;

-- 4. routers
ALTER TABLE routers ADD COLUMN IF NOT EXISTS location_id integer;

-- 5. tax_invoices (accounting-related)
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS customer_branch_id text;

-- ============================================
-- VERIFY: Run after applying
-- ============================================
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (table_name, column_name) IN (
--     ('clone_history','source_machine'),
--     ('clone_history','synced_to_central'),
--     ('machine_nics','router_id'),
--     ('machines','env_content'),
--     ('machines','is_official'),
--     ('machines','target_db_machine_id'),
--     ('machines','internet_type'),
--     ('machines','physical_location'),
--     ('machines','router_id'),
--     ('machines','location_id'),
--     ('routers','location_id'),
--     ('tax_invoices','customer_branch_id')
--   )
-- ORDER BY table_name, column_name;
-- Expected: 12 rows
