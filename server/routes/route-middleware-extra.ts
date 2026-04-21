/**
 * route-middleware-extra.ts
 * Extends route-middleware.ts (protected) without modifying it —
 * same pattern as schema-extra.ts extends schema.ts.
 *
 * Adds user-level module unlocking: if a user has explicit sub-permissions
 * for a module that the tenant plan has not enabled, we include that module
 * so the user can access it (e.g. employee นุช with inventory sub-perms).
 */

import { getEnabledModulesForTenant } from "../route-middleware";
import { db } from "../db";
import { userSubPermissions } from "@shared/schema";
import { SUB_MODULES } from "@shared/permissions";
import { eq } from "drizzle-orm";

/**
 * Returns the tenant's enabled modules PLUS any extra modules that
 * the given user has explicit sub-permissions for (allowed = true).
 * Returns null if the tenant has no plan restriction at all.
 */
export async function getEnabledModulesWithUserOverride(
  tenantId: number,
  userId: number
): Promise<string[] | null> {
  const baseModules = await getEnabledModulesForTenant(tenantId);

  // If null → no plan restriction, all modules allowed — nothing to extend.
  if (!baseModules || baseModules.length === 0) return baseModules;

  try {
    const userPerms = await db
      .select({ subModuleKey: userSubPermissions.subModuleKey, allowed: userSubPermissions.allowed })
      .from(userSubPermissions)
      .where(eq(userSubPermissions.userId, userId));

    if (!userPerms.length) return baseModules;

    const enabledSet = new Set(baseModules);

    userPerms
      .filter((p) => p.allowed)
      .forEach((p) => {
        const subMod = SUB_MODULES.find((s) => s.key === p.subModuleKey);
        if (subMod) enabledSet.add(subMod.parentModule);
      });

    return Array.from(enabledSet);
  } catch {
    return baseModules;
  }
}
