// =============================================================================
// schema-extra.ts — PURPOSE & USAGE GUIDE
// =============================================================================
// PRIMARY USE: Table definitions that cannot go in schema.ts (cherry-pick safe).
//
// SECONDARY USE: Batch operations that TOUCH existing data content.
//   When a task requires modifying existing rows (UPDATE, recalculate, re-generate)
//   and it is too much for พี่ทราย to click manually — Kai can write a one-time
//   block here. Because this CHANGES existing data, the procedure is stricter:
//
//   Procedure (must follow in order — no shortcuts):
//     1. BACKUP first — dump the target table(s) to a .sql file BEFORE any change.
//        File naming: db/backups/YYYY-MM-DD_<table>_before_<reason>.sql
//     2. UPDATE HISTORY — before the manipulation closes (before flagging done),
//        write an entry to db/schema-history.md recording:
//          - What changed (which table, which columns, what transformation)
//          - Where the backup file is (path)
//          - When it ran (datetime)
//          - Why it was needed (reason/ticket)
//     3. FLAG COMPLETED — only after backup exists and history is updated,
//        insert the system_config flag to prevent re-run.
//     4. Comment out the block → push clean in the next cycle.
//
//   Example skeleton:
//     const FLAG = "BATCH_REGENERATE_PDF_2026_XX_XX";
//     const done = await db.query.systemConfig.findFirst({ where: eq(..., FLAG) });
//     if (!done) {
//       // Step 1: backup is done MANUALLY before deploying this block
//       const invoices = await db.select().from(invoices).where(...);
//       for (const inv of invoices) { await generatePdf(inv.id); }
//       // Step 2: history entry written to db/schema-history.md before this line
//       await db.insert(systemConfig).values({ configKey: FLAG, configValue: "done" });
//     }
//
//   Rule: NEVER flag completed before backup .sql exists and history is updated.
//   Rule: NEVER leave an active batch block in production after it has run.
//   Rule: Always guard with system_config flag — idempotent, runs exactly once.
//
// TERTIARY USE: ADD COLUMN migrations for feature-specific tables.
//   When a feature needs new columns on existing tables and MUST NOT touch
//   index.ts, use this pattern (no index.ts change needed):
//
//   Pattern:
//     1. Export a migration function from this file.
//     2. Call it top-level from the most relevant route file (fires on first load).
//     3. Pure DDL (ADD COLUMN IF NOT EXISTS) needs no flag — already idempotent.
//        Pure DDL also does NOT need a backup — it only adds structure, no data loss.
//     4. If the function also does a data backfill (UPDATE existing rows), that part
//        MUST follow the full SECONDARY USE procedure:
//          a. Backup target table to db/backups/YYYY-MM-DD_<table>_before_<reason>.sql
//          b. Update db/schema-history.md (what/where/when/why)
//          c. THEN insert the system_config flag to close the backfill.
//     5. After production verified: comment out the block with date/time/reason.
//
//   Example skeleton:
//     export async function runXxxColumnsMigration(db: any) {
//       // Pure DDL — no flag, no backup needed
//       await db.execute(sql.raw(`ALTER TABLE xxx ADD COLUMN IF NOT EXISTS col TEXT`));
//       // Data backfill — backup + history MUST exist before this block runs
//       const FLAG = "BACKFILL_XXX_YYYY-MM-DD";
//       const done = await db.execute(sql`SELECT 1 FROM system_config WHERE config_key = ${FLAG}`);
//       if (!(done.rows || []).length) {
//         // backup: db/backups/YYYY-MM-DD_xxx_before_backfill_col.sql ✓
//         // history: db/schema-history.md updated ✓
//         await db.execute(sql.raw(`UPDATE xxx SET col = ... WHERE col IS NULL`));
//         await db.execute(sql.raw(`INSERT INTO system_config(config_key,config_value) VALUES('${FLAG}','done')`));
//       }
//     }
//
//   Caller side (in the relevant route file, NOT index.ts):
//     import { runXxxColumnsMigration } from "@shared/schema-extra";
//     runXxxColumnsMigration(db);  // top-level call, fires when route module loads
//
//   Rule: NEVER use DROP COLUMN, ALTER TYPE, or RENAME — additive only.
//   Rule: NEVER touch index.ts for feature column additions.
//   Rule: Backfill = data change = same backup+history rules as SECONDARY USE.
//
// =============================================================================
// MASTER RULE: Production Database Manipulation Checklist
// =============================================================================
//   ANY change to production DB — no matter how small — must follow this order:
//
//   1. VERIFY FIRST — query production DB to confirm current state before coding.
//      (Another agent may have already made the change behind your back.)
//   ── If the change will TOUCH existing data content (UPDATE/backfill) ──────────
//   1b. BACKUP TARGET TABLE — dump to db/backups/YYYY-MM-DD_<table>_before_<reason>.sql
//       BEFORE writing any migration code. No backup = no proceed.
//   ────────────────────────────────────────────────────────────────────────────
//   2. DEPLOY DB-ONLY FIRST — push ONLY the schema-extra migration function and
//      its route-file caller. No other changes in the same deploy.
//   3. CONFIRM IT RAN ONCE — login to production DB and query system_config for
//      the flag key. If the flag row exists, the migration ran successfully.
//      Do NOT grep server logs. If Node.js logging is needed, write a temporary
//      console.log block in code to display on screen, then remove it afterward.
//      Then ask พี่ช้าง to STOP the production server.
//   4. VERIFY PRODUCTION DB — query production to confirm columns/data are correct.
//   ── If the change touched existing data content ───────────────────────────────
//   4b. UPDATE HISTORY — write entry to db/schema-history.md:
//         - What changed (table, columns, transformation)
//         - Backup file path
//         - Datetime it ran
//         - Reason / ticket
//       This MUST happen before flagging complete.
//   ────────────────────────────────────────────────────────────────────────────
//   5. COMMENT OUT THE BLOCK — in schema-extra.ts, comment out the migration block
//      with the date/time it ran and the reason (e.g., // Ran 2026-05-01 14:30 UTC).
//   6. PUSH CLEAN — push the commented-out schema-extra.ts to production, rebuild.
//   7. CONTINUE CHECKLIST — proceed with the remaining steps of the full fix batch.
// =============================================================================

import { pgTable, serial, integer, text, varchar, decimal, date, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { companies, users, tenants, subscriptionPlans, employees } from "./schema";

export const employeeHourSettings = pgTable("employee_hour_settings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull().unique(),
  attendanceType: text("attendance_type").notNull().default("time_based"),
  defaultHoursPerDay: decimal("default_hours_per_day", { precision: 4, scale: 1 }).default("8.0"),
});

export const insertEmployeeHourSettingsSchema = createInsertSchema(employeeHourSettings).omit({ id: true });
export type InsertEmployeeHourSettings = z.infer<typeof insertEmployeeHourSettingsSchema>;
export type EmployeeHourSettings = typeof employeeHourSettings.$inferSelect;

export const employeeCounters = pgTable("employee_counters", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  prefix: varchar("prefix", { length: 2 }).notNull(),
  lastNumber: integer("last_number").notNull().default(0),
});

export const insertEmployeeCounterSchema = createInsertSchema(employeeCounters).omit({ id: true });
export type InsertEmployeeCounter = z.infer<typeof insertEmployeeCounterSchema>;
export type EmployeeCounter = typeof employeeCounters.$inferSelect;

export const expenseDailyBatches = pgTable("expense_daily_batches", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  batchNo: text("batch_no").notNull(),
  batchDate: date("batch_date").notNull(),
  totalExpenses: integer("total_expenses").notNull().default(0),
  totalSubtotal: decimal("total_subtotal", { precision: 15, scale: 2 }).default("0"),
  totalVat: decimal("total_vat", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  totalWht: decimal("total_wht", { precision: 15, scale: 2 }).default("0"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseDailyBatchSchema = createInsertSchema(expenseDailyBatches).omit({ id: true, createdAt: true });
export type InsertExpenseDailyBatch = z.infer<typeof insertExpenseDailyBatchSchema>;
export type ExpenseDailyBatch = typeof expenseDailyBatches.$inferSelect;

export const pdfImportTemplates = pgTable("pdf_import_templates", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  detectKeywords: text("detect_keywords").array().notNull(),
  fieldRules: jsonb("field_rules").notNull(),
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  defaultVatType: text("default_vat_type").default("vat7"),
  active: boolean("active").default(true),
  priority: integer("priority").default(0),
  isBuiltIn: boolean("is_built_in").default(false),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPdfImportTemplateSchema = createInsertSchema(pdfImportTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPdfImportTemplate = z.infer<typeof insertPdfImportTemplateSchema>;
export type PdfImportTemplate = typeof pdfImportTemplates.$inferSelect;

export const subscriptionPaymentOrders = pgTable("subscription_payment_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  setupFeeAmount: decimal("setup_fee_amount", { precision: 10, scale: 2 }).default("0"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  status: text("status").notNull().default("pending"),
  orderType: text("order_type").notNull().default("renewal"),
  promptpayRef: text("promptpay_ref"),
  slipImageUrl: text("slip_image_url"),
  confirmedByUserId: integer("confirmed_by_user_id"),
  confirmedAt: timestamp("confirmed_at"),
  invoiceNumber: text("invoice_number"),
  taxInvoiceId: integer("tax_invoice_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionPaymentOrderSchema = createInsertSchema(subscriptionPaymentOrders).omit({ id: true, createdAt: true });
export type InsertSubscriptionPaymentOrder = z.infer<typeof insertSubscriptionPaymentOrderSchema>;
export type SubscriptionPaymentOrder = typeof subscriptionPaymentOrders.$inferSelect;

export const subscriptionAddons = pgTable("subscription_addons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  featureFlag: text("feature_flag").notNull(),
  icon: text("icon"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionAddonSchema = createInsertSchema(subscriptionAddons).omit({ id: true, createdAt: true });
export type InsertSubscriptionAddon = z.infer<typeof insertSubscriptionAddonSchema>;
export type SubscriptionAddon = typeof subscriptionAddons.$inferSelect;

export const tenantAddonSubscriptions = pgTable("tenant_addon_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  addonId: integer("addon_id").references(() => subscriptionAddons.id).notNull(),
  status: text("status").notNull().default("active"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantAddonSubscriptionSchema = createInsertSchema(tenantAddonSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenantAddonSubscription = z.infer<typeof insertTenantAddonSubscriptionSchema>;
export type TenantAddonSubscription = typeof tenantAddonSubscriptions.$inferSelect;

export const modulePlans = pgTable("module_plans", {
  id: serial("id").primaryKey(),
  moduleKey: text("module_key").notNull(),
  tier: text("tier").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  maxUsers: integer("max_users").notNull().default(1),
  maxDocuments: integer("max_documents").notNull().default(100),
  maxCompanies: integer("max_companies").notNull().default(1),
  limits: text("limits"),
  features: text("features").array(),
  popular: boolean("popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertModulePlanSchema = createInsertSchema(modulePlans).omit({ id: true, createdAt: true });
export type InsertModulePlan = z.infer<typeof insertModulePlanSchema>;
export type ModulePlan = typeof modulePlans.$inferSelect;

export const tenantModuleSubscriptions = pgTable("tenant_module_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  moduleKey: text("module_key").notNull(),
  modulePlanId: integer("module_plan_id").references(() => modulePlans.id).notNull(),
  tier: text("tier").notNull(),
  status: text("status").notNull().default("trial"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTenantModuleSubscriptionSchema = createInsertSchema(tenantModuleSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenantModuleSubscription = z.infer<typeof insertTenantModuleSubscriptionSchema>;
export type TenantModuleSubscription = typeof tenantModuleSubscriptions.$inferSelect;

// ─── One-time Data Migrations ────────────────────────────────────────────────
// NOTE: Completed migrations are kept here as commented-out history for audit.
// Workflow: write migration → hook → verify in DB → comment out → push.

/* ── DONE 2026-04-27T00:28:27Z: Clear wrong etax_sent_to=csemail on invoice 459 ──
 * Verified: FLAG = done_2026-04-27T00:28:27.087Z in system_config
 *           tax_invoices id=459 RE2604250044: etax_sent_to=null, etax_sent_cc=null ✅
 * Backup: backup_tax_invoices_20260426 on deep-main (1 row)
 *
 * const FIX_ETAX_SENT_TO_KEY = "FIX_ETAX_SENT_TO_INVOICE_459_20260426";
 *
 * export async function fixEtaxSentToInvoice459(db: any) {
 *   try {
 *     const flagRows = await db.execute(sql`
 *       SELECT config_value FROM system_config
 *       WHERE config_key = ${FIX_ETAX_SENT_TO_KEY} LIMIT 1
 *     `);
 *     if ((flagRows.rows || []).length > 0) {
 *       console.log("[DataFix] Invoice-459 fix already applied — skipping.");
 *       return;
 *     }
 *   } catch (err: any) {
 *     console.error("[DataFix] ❌ flag-check error:", err.message);
 *     return;
 *   }
 *   try {
 *     await db.transaction(async (tx: any) => {
 *       const result = await tx.execute(sql`
 *         UPDATE tax_invoices
 *         SET etax_sent_to = NULL, etax_sent_cc = NULL
 *         WHERE id = 459 AND etax_sent_to = 'csemail@etax.teda.th'
 *       `);
 *       const affected = result.rowCount ?? result.count ?? 0;
 *       console.log(`[DataFix] UPDATE affected ${affected} row(s) on invoice id=459`);
 *       await tx.execute(sql`
 *         INSERT INTO system_config (config_key, config_value, description)
 *         VALUES (${FIX_ETAX_SENT_TO_KEY}, ${"done_" + new Date().toISOString()},
 *           'Clear wrong etax_sent_to=csemail on invoice 459 RE2604250044. Backup: backup_tax_invoices_20260426')
 *         ON CONFLICT (config_key) DO NOTHING
 *       `);
 *     });
 *     console.log("[DataFix] ✅ Invoice 459 etax_sent_to/cc cleared to NULL — flag set.");
 *   } catch (err: any) {
 *     console.error("[DataFix] ❌ transaction failed — no changes committed:", err.message);
 *   }
 * }
 */

/* ── DONE 2026-04-21: Seed account 5210470 (Company Registration Fee) ──
 * Verified: 453 / 453 prod companies on deep-main have code 5210470.
 * Flag: SEED_ACCOUNT_5210470_ALL_COMPANIES = done_2026-04-21T06:11:34.193Z
 *
 * const MIGRATION_KEY_5210470 = "SEED_ACCOUNT_5210470_ALL_COMPANIES";
 *
 * export async function seedAccount5210470(db: any) {
 *   try {
 *     const flagRows = await db.execute(sql`
 *       SELECT config_value FROM system_config
 *       WHERE config_key = ${MIGRATION_KEY_5210470} LIMIT 1
 *     `);
 *     if ((flagRows.rows || []).length > 0) return;
 *
 *     await db.execute(sql`
 *       INSERT INTO accounts (
 *         company_id, code, name, name_th, name_zh,
 *         type, parent_code, active, is_header
 *       )
 *       SELECT DISTINCT
 *         a.company_id,
 *         '5210470',
 *         'Company Registration Fee',
 *         'ค่าธรรมเนียมจัดตั้งบริษัท',
 *         '公司注册费',
 *         'expense', '521', true, false
 *       FROM accounts a
 *       WHERE a.company_id IS NOT NULL
 *         AND NOT EXISTS (
 *           SELECT 1 FROM accounts b
 *           WHERE b.company_id = a.company_id AND b.code = '5210470'
 *         )
 *     `);
 *
 *     await db.execute(sql`
 *       INSERT INTO system_config (config_key, config_value, description)
 *       VALUES (
 *         ${MIGRATION_KEY_5210470},
 *         ${"done_" + new Date().toISOString()},
 *         'Seed account 5210470 (Company Registration Fee) to all existing companies'
 *       )
 *       ON CONFLICT (config_key) DO NOTHING
 *     `);
 *
 *     console.log("[Migration] ✅ Account 5210470 seeded to all companies");
 *   } catch (err: any) {
 *     console.error("[Migration] ❌ seedAccount5210470:", err.message);
 *   }
 * }
 */

// ── ADD bank_name + bank_account_no to payment_methods (2026-04-29) ────────
const BANK_INFO_MIGRATION_KEY = "ADD_BANK_INFO_TO_PAYMENT_METHODS_2026-04-29";

export async function runBankInfoToPaymentMethodsMigration(db: any) {
  try {
    const flagRows = await db.execute(sql`
      SELECT 1 FROM system_config WHERE config_key = ${BANK_INFO_MIGRATION_KEY} LIMIT 1
    `);
    if ((flagRows.rows || []).length > 0) return;
    await db.execute(sql`ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_name text`);
    await db.execute(sql`ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_account_no text`);
    await db.execute(sql`
      INSERT INTO system_config (config_key, config_value)
      VALUES (${BANK_INFO_MIGRATION_KEY}, 'done')
      ON CONFLICT (config_key) DO NOTHING
    `);
    console.log("[migration] ✅ bank_name + bank_account_no added to payment_methods");
  } catch (e: any) {
    console.warn("[migration] bank_info:", e.message);
  }
}
