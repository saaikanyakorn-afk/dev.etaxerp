# Next Agent Handoff (updated 2026-05-11)

Read this file first before touching anything.

---

## ROLES

- **พี่ช้าง** = Technical Authority — all production pushes require explicit authorization from พี่ช้าง
- **พี่ทราย** = Business Owner — tests on dev screen, approves UX/business behavior, cannot authorize production push

---

## What was done this session (2026-05-11) — ENTRY #008: Inventory fixes

### 1. Deactivate/Reactivate buttons (inventory-list.tsx)
- XCircle (amber) = deactivate active product per row
- CheckCircle2 (green) = reactivate inactive product per row
- พี่ทราย tested ✓

### 2. Stock Card fixed — was always returning 400 error
Root cause: `server/routes/products-routes.ts` had 4 dynamic imports using `"./inventory-costing"` (wrong path — file is at `server/inventory-costing.ts` not `server/routes/inventory-costing.ts`). All inventory report APIs (stock-card, valuation, movement-summary, slow-moving) returned 400.
- Fixed: changed all 4 to `"../inventory-costing"` ✅

### 3. Stock movements backfilled for company 3684
- 1,093 `initial` stock_movements (2026-04-23) from warehouse_stock_levels
- 1 `sale_deduct` for TIV6900001 (product 3775, -1 unit, 2026-05-11)
- product_stock = 81, warehouse_stock_levels warehouse 32 = 76

### 4. Product Excel import now creates stock_movements
- `products-routes.ts` import route: INSERT `initial` movement for each warehouse stock set (delta from prev qty)

### 5. Silent catch fixed (sales-docs-routes.ts)
- Invoice deduction (line ~1018) and TIV deduction (line ~2041): `.catch(() => {})` → now `.catch((err) => console.error(...))`

### 6. Bulk permanent delete — show referenced documents
- Backend: added docs query (QT/SO/IV/TIV/receipt/PO/AP/POS/GR/GIQ) for skipped products, returns `docs: string[]`
- Frontend (inventory-list.tsx): shows ↳ doc list under each skipped product in dialog

### 7. Bulk permanent delete — stock_movements no longer blocks deletion
- Removed `stock_movements` from FK ref check (it is audit history, not a document)
- Added `DELETE FROM stock_movements WHERE product_id = ANY(...)` inside delete transaction (cascade cleanup)
- พี่ทราย tested all flows ✓

---

## NEXT STEPS (waiting for พี่ช้าง authorization)

### Files to push (same set as ENTRY #007 + new fixes):
- `shared/schema-extra.ts` — active_products/inactive_products DDL + migration
- `server/storage.ts` — syncProductSplit helper
- `server/routes/products-routes.ts` — all fixes this session + ENTRY #007
- `server/routes/sales-docs-routes.ts` — silent catch fix
- `client/src/pages/inventory/inventory-list.tsx` — deactivate/reactivate buttons + delete dialog with docs

### After push to production:
1. Verify `[migration] ✅ active_products + inactive_products tables ready` in prod logs
2. Update `db/schema-history.md` ENTRY #007 + ENTRY #008 with production timestamp

---

## Previous session context (ENTRY #007 — Product Split, 2026-05-10)

### Architecture
- `products` = master registry (34 FK tables point here — no FK changes)
- `active_products` + `inactive_products` = satellite 1:1 via FK ON DELETE CASCADE
- `syncProductSplit(id, isActive)` in storage.ts syncs on every CUD

### Migration status on dev DB
- active_products: 2,019 rows; inactive_products: 5 rows; orphans: 0; FK integrity: intact

### ENTRY #006 cleanup (pending)
One-time block in products-routes.ts (orphan stock_movements deletion, FLAG `ORPHAN_STOCK_MOVEMENT_CLEANUP_20260509`) runs automatically on first import. After it runs:
1. Verify `stock_movements id=1463` gone from prod
2. Comment out cleanup block → push clean
3. Update `db/schema-history.md` ENTRY #006

---

## Permanent delete policy (confirmed by พี่ทราย 2026-05-11)
| Case | Behavior |
|---|---|
| Product has document references (IV/TIV/QT/SO/PO/AP/POS/GR) | Cannot delete — shows which documents |
| Product has only stock_movements (no docs) | Can delete — movements cascade-deleted |
| Product has no references | Can delete immediately |
