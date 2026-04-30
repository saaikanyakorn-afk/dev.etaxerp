/**
 * index-extra.ts
 * Called AFTER index.ts starts — same pattern as schema-extra.ts extends schema.ts.
 * Registers override routes before the protected core-routes handlers.
 * Express first-match-wins: register here BEFORE registerCoreRoutes in routes.ts.
 */

import type { Express } from "express";
import { requireAuth, getEnabledModulesForTenant } from "./route-middleware";
import { db } from "./db";
import { userSubPermissions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { SUB_MODULES } from "@shared/permissions";

export function registerIndexExtraRoutes(app: Express) {
  // ===========================================================================
  // TEMP PRE-FLIGHT VERIFY — remove after reading result
  // Checks which warehouse columns exist in production + backfill flag status.
  // ===========================================================================
  app.get("/api/preflight/warehouse-columns", requireAuth, async (req: any, res) => {
    try {
      const { sql } = await import("drizzle-orm");
      const cols = await db.execute(sql.raw(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE (table_name = 'goods_receivings'      AND column_name = 'warehouse_id')
           OR (table_name = 'goods_receiving_items' AND column_name = 'warehouse_id')
           OR (table_name = 'sales_credit_notes'    AND column_name IN ('return_to_stock','return_warehouse_id'))
           OR (table_name = 'ecommerce_orders'      AND column_name = 'warehouse_id')
           OR (table_name = 'manufacturing_orders'  AND column_name IN ('source_warehouse_id','target_warehouse_id'))
           OR (table_name = 'general_settings'      AND column_name = 'inventory_triggers')
        ORDER BY table_name, column_name
      `));
      const flag = await db.execute(sql.raw(`
        SELECT config_key, config_value
        FROM system_config
        WHERE config_key = 'WAREHOUSE_STOCK_BACKFILL_DONE'
      `));
      const expected = [
        "goods_receivings.warehouse_id",
        "goods_receiving_items.warehouse_id",
        "sales_credit_notes.return_to_stock",
        "sales_credit_notes.return_warehouse_id",
        "ecommerce_orders.warehouse_id",
        "manufacturing_orders.source_warehouse_id",
        "manufacturing_orders.target_warehouse_id",
        "general_settings.inventory_triggers",
      ];
      const found = (cols.rows as any[]).map((r) => `${r.table_name}.${r.column_name}`);
      const missing = expected.filter((e) => !found.includes(e));
      res.json({
        found,
        missing,
        backfillFlag: (flag.rows as any[])[0] ?? null,
        allColumnsExist: missing.length === 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // ===========================================================================
  // END TEMP PRE-FLIGHT VERIFY
  // ===========================================================================

  /**
   * Override /api/permissions/me — runs BEFORE the protected version in core-routes.ts.
   * Returns modules that include any module the user has explicit sub-permissions for,
   * regardless of what the tenant subscription plan enables.
   * This is the bypass for employees (e.g. นุช) who have inventory sub-perms
   * but whose tenant plan does not list inventory in enabledModules.
   */
  app.get("/api/permissions/me-extra", requireAuth, async (req: any, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
      // 1. Get all modules user has explicit sub-permissions for
      const userPerms = await db
        .select({ subModuleKey: userSubPermissions.subModuleKey, allowed: userSubPermissions.allowed })
        .from(userSubPermissions)
        .where(eq(userSubPermissions.userId, user.id));

      const subPermModules = new Set<string>();
      userPerms
        .filter((p) => p.allowed)
        .forEach((p) => {
          const subMod = SUB_MODULES.find((s) => s.key === p.subModuleKey);
          if (subMod) subPermModules.add(subMod.parentModule);
        });

      // 2. Get tenant plan modules
      let planModules: string[] | null = null;
      if (user.tenantId) {
        planModules = await getEnabledModulesForTenant(user.tenantId);
      }

      // 3. Merge: plan modules + sub-perm unlocked modules
      let mergedModules: string[];
      if (planModules && planModules.length > 0) {
        const mergedSet = new Set([...planModules, ...subPermModules]);
        mergedSet.add("settings");
        mergedModules = Array.from(mergedSet);
      } else {
        mergedModules = subPermModules.size > 0 ? Array.from(subPermModules) : [];
      }

      // 4. Get sub-modules allowed for user
      const subModules = userPerms
        .filter((p) => p.allowed)
        .map((p) => p.subModuleKey);

      res.json({ modules: mergedModules, subModules });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
