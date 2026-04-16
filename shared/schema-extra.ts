import { pgTable, serial, integer, text, varchar, decimal, date, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { companies, users } from "./schema";

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
