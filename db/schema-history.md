# Schema Change History

This file records all changes that touched existing data content in the production database.
Each entry must include: what changed, backup location, datetime, and reason.

---

## 2026-04-30 — Warehouse Column Migration (commits 3b274b63, c94edb4e, 78c5efa6)

**What changed:**
- Added `warehouse_id INTEGER` to `goods_receivings`
- Added `warehouse_id INTEGER` to `goods_receiving_items`
- Added `return_to_stock BOOLEAN DEFAULT FALSE` to `sales_credit_notes`
- Added `return_warehouse_id INTEGER` to `sales_credit_notes`
- Added `warehouse_id INTEGER` to `ecommerce_orders`
- Added `source_warehouse_id INTEGER` to `manufacturing_orders`
- Added `target_warehouse_id INTEGER` to `manufacturing_orders`
- Added `inventory_triggers JSONB DEFAULT '{}'` to `general_settings`
- Backfilled `warehouse_stock_levels` from `purchase_invoice_items`, `invoice_items`, `tax_invoice_items`

**Backup location:** `db/backups/2026-04-30_warehouse_stock_levels_before_backfill_v85.sql`
(1,094 rows backed up before backfill ran)

**Migration code:** `shared/schema-extra.ts` → `runWarehouseColumnsMigration()`
**Caller:** `server/routes/warehouse-bin-routes.ts` (top-level call)
**Flag:** `WAREHOUSE_STOCK_BACKFILL_DONE` in `system_config`

**Reason:** Three commits (3b274b63, c94edb4e, 78c5efa6) had placed ALTER TABLE blocks
directly inside `server/index.ts` (protected file). These were moved to `schema-extra.ts`
following the TERTIARY USE procedure so index.ts is no longer touched for column additions.

**Status:** Deployed — pending comment-out + clean push
