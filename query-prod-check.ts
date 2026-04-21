import { db } from "./server/db";
import { users, employees, userSubPermissions } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db.select({
    userId: users.id, username: users.username, fullName: users.fullName,
    role: users.role, tenantId: users.tenantId, companyId: employees.companyId,
  }).from(users).innerJoin(employees, eq(employees.userId, users.id))
    .where(eq(employees.companyId, 3953));

  console.log("=== Users at company 3953 ===");
  for (const row of rows) {
    console.log(`  userId=${row.userId} | ${row.fullName} | role=${row.role} | tenantId=${row.tenantId}`);
    const p = await db.select().from(userSubPermissions).where(eq(userSubPermissions.userId, row.userId));
    if (p.length === 0) {
      console.log(`    sub_permissions: EMPTY`);
    } else {
      for (const perm of p) console.log(`    sub_permissions: key=${perm.subModuleKey} allowed=${perm.allowed}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
