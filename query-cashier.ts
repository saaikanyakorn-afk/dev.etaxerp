import { db } from "./server/db";
import { machines } from "@shared/schema";
import { eq } from "drizzle-orm";
import pg from "pg";

async function main() {
  const [m] = await db.select().from(machines).where(eq(machines.id, 2));
  const pool = new pg.Pool({ host: "deep-main.hopto.org", port: parseInt(m.dbPort), database: m.dbName, user: m.dbUser, password: m.dbPassword, connectionTimeoutMillis: 8000 });
  const client = await pool.connect();
  
  const r = await client.query(`
    SELECT u.id, u.username, u.full_name, u.role, e.company_id,
           (SELECT COUNT(*) FROM user_sub_permissions WHERE user_id = u.id) as sub_perm_count
    FROM users u JOIN employees e ON e.user_id = u.id
    WHERE u.role = 'cashier' AND e.company_id = 3953 LIMIT 5
  `);
  console.log("Cashiers at company 3953:");
  console.log(JSON.stringify(r.rows, null, 2));
  
  client.release();
  await pool.end();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
