import { sql } from "drizzle-orm";

export async function runStampUrlMigration(db: any) {
  try {
    await db.execute(sql.raw(`ALTER TABLE document_settings ADD COLUMN IF NOT EXISTS stamp_url text`));
    console.log("[migration] stamp_url column ready");
  } catch (e: any) {
    console.error("[migration] stamp_url failed:", e.message);
  }
}
