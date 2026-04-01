import { db } from "./db";
import { stockMovements, productBundles, bomHeaders, bomLines, productMappings, ecommerceProductMappings, products } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

interface RecalcResult {
  created: number;
  deleted: number;
  errors: string[];
}

async function getMovingAvgCosts(companyId: number, productIds: number[]): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  if (productIds.length === 0) return costMap;

  const uniqueIds = Array.from(new Set(productIds));

  const rows = await db.select({
    productId: stockMovements.productId,
    totalQty: sql<string>`COALESCE(SUM(CASE WHEN CAST(${stockMovements.quantity} AS numeric) > 0 THEN CAST(${stockMovements.quantity} AS numeric) ELSE 0 END), 0)`,
    totalCostSum: sql<string>`COALESCE(SUM(CASE WHEN CAST(${stockMovements.quantity} AS numeric) > 0 THEN CAST(${stockMovements.totalCost} AS numeric) ELSE 0 END), 0)`,
  }).from(stockMovements)
    .where(and(
      eq(stockMovements.companyId, companyId),
      inArray(stockMovements.productId, uniqueIds),
      sql`${stockMovements.movementType} IN ('goods_in', 'goods_receipt', 'production_in', 'adjustment', 'initial')`,
    ))
    .groupBy(stockMovements.productId);

  for (const row of rows) {
    const qty = parseFloat(row.totalQty) || 0;
    const cost = parseFloat(row.totalCostSum) || 0;
    if (qty > 0) {
      costMap.set(row.productId, Math.round((cost / qty) * 100) / 100);
    }
  }

  for (const pid of uniqueIds) {
    if (!costMap.has(pid)) {
      const [prod] = await db.select({ cost: products.cost }).from(products)
        .where(eq(products.id, pid));
      costMap.set(pid, parseFloat(prod?.cost || "0") || 0);
    }
  }

  return costMap;
}

export async function recalcBundleStock(companyId: number, bundleProductId?: number): Promise<RecalcResult> {
  const result: RecalcResult = { created: 0, deleted: 0, errors: [] };

  const allBundles = bundleProductId
    ? await db.select().from(productBundles).where(eq(productBundles.bundleProductId, bundleProductId))
    : await db.select().from(productBundles);

  if (allBundles.length === 0) return result;

  const bundleProductIds = Array.from(new Set(allBundles.map(b => b.bundleProductId)));
  const bundleMap = new Map<number, { componentProductId: number; qty: number }[]>();
  for (const b of allBundles) {
    if (!bundleMap.has(b.bundleProductId)) bundleMap.set(b.bundleProductId, []);
    bundleMap.get(b.bundleProductId)!.push({
      componentProductId: b.componentProductId,
      qty: parseFloat(b.qty),
    });
  }

  const bundleProds = await db.select({ id: products.id, companyId: products.companyId }).from(products)
    .where(and(
      inArray(products.id, bundleProductIds),
      eq(products.companyId, companyId)
    ));
  const validBundleIds = bundleProds.map(p => p.id);

  if (validBundleIds.length === 0) return result;

  const sourceMovements = await db.select().from(stockMovements)
    .where(and(
      inArray(stockMovements.productId, validBundleIds),
      sql`CAST(${stockMovements.quantity} AS numeric) < 0`,
      eq(stockMovements.companyId, companyId),
      sql`${stockMovements.movementType} NOT IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));

  const sourceMovementIds = sourceMovements.map(m => m.id);

  const deleteConditions: any[] = [
    eq(stockMovements.companyId, companyId),
    sql`${stockMovements.movementType} IN ('bundle_deduct', 'bundle_offset')`,
  ];
  if (sourceMovementIds.length > 0) {
    deleteConditions.push(inArray(stockMovements.referenceId, sourceMovementIds));
  } else if (bundleProductId) {
    return result;
  }

  const existingDeductions = await db.select({ id: stockMovements.id }).from(stockMovements)
    .where(and(...deleteConditions));
  const toDelete = existingDeductions.map(d => d.id);
  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      await db.delete(stockMovements).where(inArray(stockMovements.id, batch));
      result.deleted += batch.length;
    }
  }

  const allComponentIds = new Set<number>();
  for (const comps of bundleMap.values()) {
    for (const c of comps) allComponentIds.add(c.componentProductId);
  }
  const costMap = await getMovingAvgCosts(companyId, Array.from(allComponentIds));

  const toInsert: any[] = [];
  for (const mov of sourceMovements) {
    const components = bundleMap.get(mov.productId);
    if (!components) continue;
    const soldQty = Math.abs(parseFloat(mov.quantity));

    let bundleTotalCost = 0;
    for (const comp of components) {
      const deductQty = soldQty * comp.qty;
      const uc = costMap.get(comp.componentProductId) || 0;
      bundleTotalCost += deductQty * uc;
    }

    toInsert.push({
      companyId,
      productId: mov.productId,
      movementType: "bundle_offset",
      quantity: String(soldQty),
      unitCost: String(Math.round((bundleTotalCost / soldQty) * 100) / 100),
      totalCost: String(Math.round(bundleTotalCost * 100) / 100),
      referenceType: "bundle_offset",
      referenceId: mov.id,
      referenceNo: `BUNDLE-OFFSET#${mov.referenceNo || mov.id}`,
      notes: `ชดเชยสต็อกชุด (Virtual Bundle) - โอนไปสินค้าย่อย`,
      createdBy: mov.createdBy,
      createdAt: mov.createdAt,
    });

    for (const comp of components) {
      const deductQty = soldQty * comp.qty;
      const uc = costMap.get(comp.componentProductId) || 0;
      const tc = Math.round(deductQty * uc * 100) / 100;
      toInsert.push({
        companyId,
        productId: comp.componentProductId,
        movementType: "bundle_deduct",
        quantity: String(-deductQty),
        unitCost: String(uc),
        totalCost: String(-tc),
        referenceType: "bundle_deduct",
        referenceId: mov.id,
        referenceNo: `BUNDLE#${mov.referenceNo || mov.id}`,
        notes: `ตัดสต็อกจากชุด (Bundle) - ${mov.referenceNo || ""}`,
        createdBy: mov.createdBy,
        createdAt: mov.createdAt,
      });
    }
  }

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      await db.insert(stockMovements).values(batch);
      result.created += batch.length;
    }
  }

  return result;
}

export async function recalcBomStock(companyId: number, bomProductId?: number): Promise<RecalcResult> {
  const result: RecalcResult = { created: 0, deleted: 0, errors: [] };

  const bomConditions: any[] = [eq(bomHeaders.companyId, companyId)];
  if (bomProductId) bomConditions.push(eq(bomHeaders.productId, bomProductId));

  const boms = await db.select().from(bomHeaders).where(and(...bomConditions));
  if (boms.length === 0) return result;

  const bomIds = boms.map(b => b.id);
  const allLines = await db.select().from(bomLines).where(inArray(bomLines.bomId, bomIds));

  const bomLineMap = new Map<number, { componentProductId: number; qty: number; costOverride: number | null }[]>();
  for (const line of allLines) {
    if (!bomLineMap.has(line.bomId)) bomLineMap.set(line.bomId, []);
    bomLineMap.get(line.bomId)!.push({
      componentProductId: line.componentProductId,
      qty: parseFloat(line.qty),
      costOverride: line.costOverride ? parseFloat(line.costOverride) : null,
    });
  }

  const bomProductMap = new Map<number, { bomId: number; yieldQty: number }>();
  for (const bom of boms) {
    bomProductMap.set(bom.productId, { bomId: bom.id, yieldQty: parseFloat(bom.yieldQty) });
  }

  const bomProductIds = boms.map(b => b.productId);

  const sourceMovements = await db.select().from(stockMovements)
    .where(and(
      inArray(stockMovements.productId, bomProductIds),
      sql`CAST(${stockMovements.quantity} AS numeric) < 0`,
      eq(stockMovements.companyId, companyId),
      sql`${stockMovements.movementType} NOT IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));

  const sourceMovementIds = sourceMovements.map(m => m.id);

  if (sourceMovementIds.length > 0) {
    const existingConsumptions = await db.select({ id: stockMovements.id }).from(stockMovements)
      .where(and(
        eq(stockMovements.movementType, "bom_consume"),
        eq(stockMovements.companyId, companyId),
        inArray(stockMovements.referenceId, sourceMovementIds)
      ));
    const toDelete = existingConsumptions.map(d => d.id);
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = toDelete.slice(i, i + 500);
        await db.delete(stockMovements).where(inArray(stockMovements.id, batch));
        result.deleted += batch.length;
      }
    }
  } else if (!bomProductId) {
    const existingConsumptions = await db.select({ id: stockMovements.id }).from(stockMovements)
      .where(and(
        eq(stockMovements.movementType, "bom_consume"),
        eq(stockMovements.companyId, companyId)
      ));
    const toDelete = existingConsumptions.map(d => d.id);
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = toDelete.slice(i, i + 500);
        await db.delete(stockMovements).where(inArray(stockMovements.id, batch));
        result.deleted += batch.length;
      }
    }
  }

  const allComponentIds = new Set<number>();
  for (const lines of bomLineMap.values()) {
    for (const l of lines) allComponentIds.add(l.componentProductId);
  }
  const costMap = await getMovingAvgCosts(companyId, Array.from(allComponentIds));

  const toInsert: any[] = [];
  for (const mov of sourceMovements) {
    const bomInfo = bomProductMap.get(mov.productId);
    if (!bomInfo) continue;
    const lines = bomLineMap.get(bomInfo.bomId);
    if (!lines) continue;

    const soldQty = Math.abs(parseFloat(mov.quantity));
    const batches = soldQty / bomInfo.yieldQty;

    for (const line of lines) {
      const deductQty = batches * line.qty;
      const uc = line.costOverride ?? (costMap.get(line.componentProductId) || 0);
      const tc = Math.round(deductQty * uc * 100) / 100;
      toInsert.push({
        companyId,
        productId: line.componentProductId,
        movementType: "bom_consume",
        quantity: String(-deductQty),
        unitCost: String(uc),
        totalCost: String(-tc),
        referenceType: "bom_consume",
        referenceId: mov.id,
        referenceNo: `BOM#${mov.referenceNo || mov.id}`,
        notes: `ตัดวัตถุดิบจาก BOM - ${mov.referenceNo || ""}`,
        createdBy: mov.createdBy,
        createdAt: mov.createdAt,
      });
    }
  }

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      await db.insert(stockMovements).values(batch);
      result.created += batch.length;
    }
  }

  return result;
}

export async function recalcMappingStock(companyId: number, sellProductId?: number): Promise<RecalcResult> {
  const result: RecalcResult = { created: 0, deleted: 0, errors: [] };

  const mapConditions: any[] = [eq(productMappings.companyId, companyId)];
  if (sellProductId) mapConditions.push(eq(productMappings.sellProductId, sellProductId));

  const mappings = await db.select().from(productMappings).where(and(...mapConditions));

  if (mappings.length === 0) return result;

  const sellToComponents = new Map<number, { buyProductId: number; rate: number }[]>();
  for (const m of mappings) {
    if (!sellToComponents.has(m.sellProductId)) sellToComponents.set(m.sellProductId, []);
    sellToComponents.get(m.sellProductId)!.push({
      buyProductId: m.buyProductId,
      rate: parseFloat(m.conversionRate),
    });
  }

  const sellProductIds = Array.from(sellToComponents.keys());
  if (sellProductIds.length === 0) return result;

  const sourceMovements = await db.select().from(stockMovements)
    .where(and(
      inArray(stockMovements.productId, sellProductIds),
      sql`CAST(${stockMovements.quantity} AS numeric) < 0`,
      eq(stockMovements.companyId, companyId),
      sql`${stockMovements.movementType} NOT IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));

  const sourceMovementIds = sourceMovements.map(m => m.id);

  if (sourceMovementIds.length > 0) {
    const existingConversions = await db.select({ id: stockMovements.id }).from(stockMovements)
      .where(and(
        eq(stockMovements.movementType, "mapping_convert"),
        eq(stockMovements.companyId, companyId),
        inArray(stockMovements.referenceId, sourceMovementIds)
      ));
    const toDelete = existingConversions.map(d => d.id);
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = toDelete.slice(i, i + 500);
        await db.delete(stockMovements).where(inArray(stockMovements.id, batch));
        result.deleted += batch.length;
      }
    }
  } else if (!sellProductId) {
    const existingConversions = await db.select({ id: stockMovements.id }).from(stockMovements)
      .where(and(
        eq(stockMovements.movementType, "mapping_convert"),
        eq(stockMovements.companyId, companyId)
      ));
    const toDelete = existingConversions.map(d => d.id);
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = toDelete.slice(i, i + 500);
        await db.delete(stockMovements).where(inArray(stockMovements.id, batch));
        result.deleted += batch.length;
      }
    }
  }

  const allBuyProductIds = new Set<number>();
  for (const comps of sellToComponents.values()) {
    for (const c of comps) allBuyProductIds.add(c.buyProductId);
  }
  const costMap = await getMovingAvgCosts(companyId, Array.from(allBuyProductIds));

  const toInsert: any[] = [];
  for (const mov of sourceMovements) {
    const comps = sellToComponents.get(mov.productId);
    if (!comps) continue;
    const soldQty = Math.abs(parseFloat(mov.quantity));

    for (const comp of comps) {
      const deductQty = soldQty * comp.rate;
      const uc = costMap.get(comp.buyProductId) || 0;
      const tc = Math.round(deductQty * uc * 100) / 100;
      toInsert.push({
        companyId,
        productId: comp.buyProductId,
        movementType: "mapping_convert",
        quantity: String(-deductQty),
        unitCost: String(uc),
        totalCost: String(-tc),
        referenceType: "mapping_convert",
        referenceId: mov.id,
        referenceNo: `MAP#${mov.referenceNo || mov.id}`,
        notes: `ตัดสต็อกจาก SKU Mapping - ${mov.referenceNo || ""}`,
        createdBy: mov.createdBy,
        createdAt: mov.createdAt,
      });
    }
  }

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      await db.insert(stockMovements).values(batch);
      result.created += batch.length;
    }
  }

  return result;
}

export async function recalcAllStock(companyId: number): Promise<{
  bundle: RecalcResult;
  bom: RecalcResult;
  mapping: RecalcResult;
}> {
  const bundle = await recalcBundleStock(companyId);
  const bom = await recalcBomStock(companyId);
  const mapping = await recalcMappingStock(companyId);
  return { bundle, bom, mapping };
}
