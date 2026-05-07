// stamp_url migration — executed 2026-05-06 ~10:30
// Reason: add stamp_url column to document_settings for company stamp image (ตรายาง) on WHT cert (ใบ 50 ทวิ) print page
// Verified: Phase 1c confirmed column exists on production DB
export async function runStampUrlMigration(_db: any) {}

// 2026-05-07 — general_settings.bot_api_key: per-company BOT API key for exchange rate fetching
// Pure DDL — no flag, no backup needed (additive only, no data loss)
export async function runBotApiKeyMigration(db: any) {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS bot_api_key TEXT`));
    console.log("[migration] ✅ general_settings.bot_api_key ready");
  } catch (e: any) {
    console.error("[migration] ❌ runBotApiKeyMigration FAILED:", e.message);
  }
}

// 2026-05-07 — sales_credit_notes etax columns for e-Tax Invoice credit note sending
// ONE-TIME migration — guarded by system_config flag
export async function runSalesCreditNoteEtaxMigration(db: any) {
  const FLAG = "ADD_ETAX_COLUMNS_TO_SALES_CREDIT_NOTES_20260507";
  try {
    const { sql } = await import("drizzle-orm");
    const flag = await db.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = '${FLAG}' LIMIT 1`));
    if ((flag.rows || []).length > 0) return;
    await db.execute(sql.raw(`ALTER TABLE sales_credit_notes ADD COLUMN IF NOT EXISTS etax_sent_at TIMESTAMP`));
    await db.execute(sql.raw(`ALTER TABLE sales_credit_notes ADD COLUMN IF NOT EXISTS etax_sent_to TEXT`));
    await db.execute(sql.raw(`ALTER TABLE sales_credit_notes ADD COLUMN IF NOT EXISTS etax_sent_cc TEXT`));
    await db.execute(sql.raw(`ALTER TABLE sales_credit_notes ADD COLUMN IF NOT EXISTS etax_message_id TEXT`));
    await db.execute(sql.raw(`INSERT INTO system_config (config_key, config_value) VALUES ('${FLAG}', 'done_${new Date().toISOString()}') ON CONFLICT (config_key) DO NOTHING`));
    console.log("[migration] ✅ sales_credit_notes etax columns ready");
  } catch (e: any) {
    console.error("[migration] ❌ runSalesCreditNoteEtaxMigration FAILED:", e.message);
  }
}
