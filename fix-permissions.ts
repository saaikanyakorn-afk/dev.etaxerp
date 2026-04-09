import { db } from "./server/db";
import { rolePermissions } from "./shared/schema";
import { eq, and } from "drizzle-orm";
import { PERMISSION_MODULES } from "./shared/permissions";

async function fixPermissions() {
  const allRoles = ["admin", "manager", "accountant", "employee", "cashier", "client"];
  let fixed = 0;
  let inserted = 0;

  for (const mod of PERMISSION_MODULES) {
    for (const role of allRoles) {
      const shouldAllow = mod.allowedRoles.includes(role as any);
      const [rec] = await db.select().from(rolePermissions)
        .where(and(eq(rolePermissions.role, role), eq(rolePermissions.moduleKey, mod.key)));
      if (rec && rec.allowed !== shouldAllow) {
        await db.update(rolePermissions)
          .set({ allowed: shouldAllow })
          .where(and(eq(rolePermissions.role, role), eq(rolePermissions.moduleKey, mod.key)));
        console.log(`[FIX] ${role} / ${mod.key}: ${rec.allowed} → ${shouldAllow}`);
        fixed++;
      } else if (!rec) {
        await db.insert(rolePermissions).values({ role, moduleKey: mod.key, allowed: shouldAllow });
        console.log(`[ADD] ${role} / ${mod.key}: ${shouldAllow}`);
        inserted++;
      }
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Inserted: ${inserted}`);
  process.exit(0);
}

fixPermissions().catch(e => { console.error(e); process.exit(1); });
