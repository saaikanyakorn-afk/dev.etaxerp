# Next Agent Handoff (updated 2026-05-10)

Read this file first before touching anything.

---

## ROLES

- **พี่ช้าง** = Technical Authority — all production pushes require explicit authorization from พี่ช้าง
- **พี่ทราย** = Business Owner — tests on dev screen, approves UX/business behavior, cannot authorize production push

---

## What was done this session (2026-05-10) — ENTRY #007: Product Split

### Architecture

`products` table stays as the master registry (middle-man/supertype). All 34 FK tables continue pointing to `products.id` — no FK changes needed.

Two new satellite tables (`active_products`, `inactive_products`) each hold a 1:1 row keyed to `products.id` via FK with `ON DELETE CASCADE`.

### Files changed (NOT yet pushed to production)

**`shared/schema-extra.ts`**
- Added `activeProducts` + `inactiveProducts` Drizzle table definitions
- Added `runProductSplitMigration()` — DDL (idempotent) + one-time backfill guarded by FLAG `PRODUCT_SPLIT_MIGRATION_20260510`
- All try/catch removed — errors throw immediately, no silent fallbacks

**`server/storage.ts`**
- Added `syncProductSplit(id, isActive)` — 3-step transaction (DELETE target → plain INSERT → DELETE source). No ON CONFLICT masking.
- `createProduct` → calls `syncProductSplit` after INSERT ✅
- `updateProduct` → calls `syncProductSplit` after UPDATE ✅
- `deleteProduct` (soft deactivate) → calls `syncProductSplit(id, false)` ✅
- `bulkCreateProducts` (import path) → **bug fixed**: was missing syncProductSplit entirely, now loops and syncs each created product ✅

### Migration status on dev DB

- active_products: 2,019 rows (matches products.active=true)
- inactive_products: 5 rows (matches products.active=false)
- Orphans: 0, overlap: 0, FK integrity: intact

### Test results on dev (21/21 passed)

All paths tested: createProduct, createProduct(inactive), bulkCreate(3), import-duplicate-update, import-duplicate-blocked, deactivate, re-activate, soft-delete, delete-inactive-duplicates CASCADE, bulk-permanent-delete CASCADE, invoice FK intact, stock_movements FK intact, no overlap, count match, no orphans.

---

## Permanent Delete Policy (confirmed by พี่ทราย, 2026-05-10)

| Case | Behavior |
|---|---|
| Product has NO document references | Any user with inventory access can permanently delete |
| Product HAS document references | Cannot delete — system skips and shows document names |

No role restriction beyond module access. No code changes needed.

---

## NEXT STEPS (in order)

1. **พี่ทราย tests on dev screen** — every product screen: create, edit, deactivate, re-activate, import (new + duplicate), delete inactive, check lists
2. **พี่ทราย confirms** everything works as expected on screen
3. **พี่ช้าง authorizes** production push
4. **Kai pushes** the following files only (never push schema.ts, index.ts, App.tsx):
   - `shared/schema-extra.ts`
   - `server/storage.ts`
   - `server/routes/products-routes.ts`
5. After push: verify `runProductSplitMigration()` runs on production DB (check logs for `[migration] ✅ active_products + inactive_products tables ready`)
6. Update `db/schema-history.md` ENTRY #007 with production timestamp

---

## ENTRY #006 cleanup — still pending

One-time cleanup block in `products-routes.ts` (orphan stock_movements deletion, FLAG `ORPHAN_STOCK_MOVEMENT_CLEANUP_20260509`) will run automatically on first use of import screen in production. After it runs:
1. Verify `stock_movements id=1463` is gone from production DB
2. Comment out the cleanup block
3. Push clean `products-routes.ts`
4. Update `db/schema-history.md` ENTRY #006
