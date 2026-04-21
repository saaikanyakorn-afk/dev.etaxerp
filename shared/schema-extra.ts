import { pgTable, serial, integer, text, varchar, decimal, date, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { companies, users, tenants, subscriptionPlans } from "./schema";

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
