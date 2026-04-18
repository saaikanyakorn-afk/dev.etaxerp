import { db } from "./db";
import { sql } from "drizzle-orm";

const MIGRATION_KEY = "MIGRATION_SYS_ADMINS_LINE_DISPLAY_NAME_DONE";

export async function runOneTimeLineDisplayNameMigration() {
  try {
    const flagRows = await db.execute(sql`SELECT config_value FROM system_config WHERE config_key = ${MIGRATION_KEY} LIMIT 1`);
    if ((flagRows.rows || []).length > 0) return;

    console.log("[OneTimeMigration] Adding sys_admins.line_display_name...");
    await db.execute(sql`ALTER TABLE sys_admins ADD COLUMN IF NOT EXISTS line_display_name TEXT`);

    await db.execute(sql`
      INSERT INTO system_config (config_key, config_value, description)
      VALUES (${MIGRATION_KEY}, ${"done_" + new Date().toISOString()}, 'Add line_display_name to sys_admins for human-readable LINE label')
      ON CONFLICT (config_key) DO NOTHING
    `);
    console.log("[OneTimeMigration] ✅ sys_admins.line_display_name added");
  } catch (err: any) {
    console.error("[OneTimeMigration] ❌ line_display_name error:", err.message);
  }
}
