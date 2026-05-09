# Next Agent Handoff (updated 2026-05-09)

Read this file first. Then read push-pull-history.txt in full before touching anything.

---

## What was done this session

1. Fixed all sales/purchase form dropdowns to filter inactive products (`p.active !== false`) ✅ pushed
2. Fixed QO delete "syntax error at or near =" — removed invalid linkedSO check ✅ pushed
3. Fixed `delete-inactive-duplicates` endpoint: removed stock_movements from FK blocker, added cleanup DELETE of stock_movements in transaction, added doc details for skipped items ✅ pushed

---

## Code implemented but NOT yet pushed

**server/routes/products-routes.ts**
- Preview endpoint: fixed misleading message "จะสร้างซ้ำ" → "จะถูกข้ามโดยอัตโนมัติ ตรวจสอบว่าไม่ได้นำเข้าไฟล์ซ้ำ"
- Execute endpoint: ONE-TIME CLEANUP block (ENTRY #006) added at top of handler
  — DELETEs orphan `stock_movements` (movement_type='initial', no reference doc) for inactive duplicate products
  — Guarded by FLAG `ORPHAN_STOCK_MOVEMENT_CLEANUP_20260509` in `system_config`

**client/src/pages/inventory/inventory-list.tsx**
- Added red warning banner in preview step when inactive duplicate codes are detected

---

## Why not pushed yet

The warning and cleanup code are ready. BUT the core behavior of what happens when the import screen encounters a duplicate product code is a **business decision that must come from พี่ทราย first**.

---

## Pending: ask พี่ทราย (business question — give her clear choices)

> "ถ้า import ไฟล์สินค้าแล้วเจอรหัสที่มีอยู่ในระบบแล้ว ต้องการให้ระบบทำอะไร?
> (1) ข้ามรายการนั้นไป — ข้อมูลเก่าในระบบยังอยู่ครบ ไม่มีอะไรเปลี่ยน
> (2) แทนที่ข้อมูลเก่าด้วยข้อมูลจากไฟล์ — ชื่อ ราคา ต้นทุน จะถูกอัพเดท"

Do NOT explain the technical cost of option (2) to พี่ทราย. Just present the choices in plain language.

---

## After พี่ทราย answers

- **Option (1) skip**: backend already does this. Get พี่ช้าง authorization → push the 2 files above.
- **Option (2) replace**: design and implement the replace flow first (re-activate product, handle stock, references), then push everything together. This is significant work.

---

## ENTRY #006 cleanup — lifecycle after push

1. พี่ทราย uses import screen → cleanup runs once (FLAG written to system_config)
2. Kai connects to production DB (read-only) → verify `stock_movements id=1463` is gone
3. Comment out the cleanup block in `products-routes.ts` with: date/time executed, what it deleted, why
4. Push clean `products-routes.ts` immediately
5. Update `db/schema-history.md` ENTRY #006 — fill in timestamp and FLAG value
6. Delete or archive this handoff file
