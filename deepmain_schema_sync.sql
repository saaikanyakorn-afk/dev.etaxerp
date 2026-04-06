-- ============================================
-- E-Tax Center: Deep-Main Schema Sync
-- Date: 2026-04-06
-- ============================================
-- Only production-relevant column
-- Backup: DONE
-- ============================================

-- tax_invoices: customer_branch_id (used in tax invoice forms)
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS customer_branch_id text;
