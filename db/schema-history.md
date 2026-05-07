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

**Status:** Deployed + comment-out + clean push done ✅

---

## 2026-05-07 — expenses: currency_code, exchange_rate, paid_amount (ENTRY #001)

**What changed:**
- Added `currency_code TEXT NOT NULL DEFAULT 'THB'` to `expenses`
- Added `exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1` to `expenses`
- Added `paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0` to `expenses`

**Backup location:** No backup required — additive columns only (NOT NULL with defaults, no existing rows touched)

**Migration code:** `server/schema-extra.ts` → `runExpenseCurrencyMigration()`
**Caller:** `server/routes/expense-routes.ts` (top-level call in `registerExpenseRoutes`)
**Flag:** `ADD_CURRENCY_COLUMNS_TO_EXPENSES_20260505` in `system_config`

**Reason:** Foreign currency support for expense module. currency_code stores original currency (USD, EUR, etc.), exchange_rate stores THB per 1 unit at time of entry, paid_amount tracks AP settlement balance.

**Production DB verified:** 2026-05-07 — columns absent from production before migration (45 cols, none of the 3 present)

**Status:** Done on dev ✅ — pending production run (awaiting พี่ช้าง approval)

---

## 2026-05-07 — DROP general_settings.bot_api_key (ENTRY #002 reversal / ENTRY #005 deposit)

**What changed:**
- Dropped `bot_api_key TEXT` from `general_settings` (dev DB only — column never reached production)
- Design changed: BOT API key moved to `system_config` table (platform-level, key = `BOT_API_KEY`)
- super_admin manages key via Settings > อัตราแลกเปลี่ยน screen

**Backup location:** No backup required — column was empty (no data, no constraints, dev only)

**Migration code:** `server/schema-extra.ts` → `runDropBotApiKeyMigration()` (to be commented out after verified on production)
**Caller:** `server/routes/doc-settings-routes.ts`
**Flag:** `DROP_BOT_API_KEY_FROM_GENERAL_SETTINGS_20260507` in `system_config`

**Reason:** Per-company BOT API key design was wrong. Key is platform-level — one key serves all tenants. super_admin sets it once via UI, stored in system_config. No .env file needed.

**Status:** Done on dev ✅ — pending production run (part of ENTRY #005 batch)

---

## 2026-05-07 — e-Tax Credit Note Columns (ENTRY #004)

**What changed:**
- Added `etax_sent_at TIMESTAMP` to `sales_credit_notes`
- Added `etax_sent_to TEXT` to `sales_credit_notes`
- Added `etax_sent_cc TEXT` to `sales_credit_notes`
- Added `etax_message_id TEXT` to `sales_credit_notes`

**Backup location:** No backup required — additive columns only (nullable, no existing data touched)

**Migration code:** `server/schema-extra.ts` → `runSalesCreditNoteEtaxMigration()` (commented out after verified)
**Caller:** `server/routes/etax-routes.ts` (call removed after verified)
**Flag:** `ADD_ETAX_COLUMNS_TO_SALES_CREDIT_NOTES_20260507` in `system_config` = `done_2026-05-07T07:09:58.365Z`

**Reason:** e-Tax Invoice ใบลดหนี้ feature requires tracking when and to whom an e-Tax credit note was sent via email (etax_sent_at, etax_sent_to, etax_sent_cc, etax_message_id).

**Status:** Deployed + comment-out + clean push done ✅
