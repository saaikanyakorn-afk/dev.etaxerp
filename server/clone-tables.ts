import { Pool } from "pg";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

export interface TableInfo {
  pgName: string;
  displayName: string;
}

export const STATIC_TABLES: TableInfo[] = [
  { pgName: "tenants", displayName: "Tenants (ผู้เช่า)" },
  { pgName: "companies", displayName: "Companies (บริษัท)" },
  { pgName: "departments", displayName: "Departments (แผนก)" },
  { pgName: "branches", displayName: "Branches (สาขา)" },
  { pgName: "users", displayName: "Users (ผู้ใช้)" },
  { pgName: "employees", displayName: "Employees (พนักงาน)" },
  { pgName: "work_locations", displayName: "Work Locations (สถานที่ทำงาน)" },
  { pgName: "role_permissions", displayName: "Role Permissions (สิทธิ์)" },
  { pgName: "user_sub_permissions", displayName: "User Sub-Permissions" },
  { pgName: "firm_clients", displayName: "Firm Clients (ลูกค้าสำนักงาน)" },
  { pgName: "firm_client_team", displayName: "Firm Client Team" },
  { pgName: "tenant_subscriptions", displayName: "Subscriptions (แพ็กเกจ)" },
  { pgName: "subscription_plans", displayName: "Subscription Plans" },
  { pgName: "white_label_settings", displayName: "White Label Settings" },
  { pgName: "company_folder_codes", displayName: "Company Folder Codes" },
  { pgName: "store_folder_codes", displayName: "Store Folder Codes" },
  { pgName: "tenant_platform_credentials", displayName: "Platform Credentials" },
  { pgName: "accounts", displayName: "Chart of Accounts (ผังบัญชี)" },
  { pgName: "accounting_formulas", displayName: "Accounting Formulas" },
  { pgName: "accounting_formula_lines", displayName: "Accounting Formula Lines" },
  { pgName: "payment_methods", displayName: "Payment Methods (วิธีชำระเงิน)" },
  { pgName: "petty_cash_funds", displayName: "Petty Cash Funds (กองทุนเงินสดย่อย)" },
  { pgName: "document_settings", displayName: "Document Settings (ตั้งค่าเอกสาร)" },
  { pgName: "financial_statement_settings", displayName: "Financial Statement Settings" },
  { pgName: "vat_product_dictionary", displayName: "VAT Product Dictionary" },
  { pgName: "closed_periods", displayName: "Closed Periods (งวดปิดบัญชี)" },
  { pgName: "commission_rules", displayName: "Commission Rules (กฎค่าคอม)" },
  { pgName: "products", displayName: "Products (สินค้า)" },
  { pgName: "product_bundles", displayName: "Product Bundles (ชุดสินค้า)" },
  { pgName: "bom_headers", displayName: "BOM Headers" },
  { pgName: "bom_lines", displayName: "BOM Lines" },
  { pgName: "product_mappings", displayName: "Product Mappings" },
  { pgName: "ecommerce_product_mappings", displayName: "E-commerce Product Mappings" },
  { pgName: "promotions", displayName: "Promotions (โปรโมชั่น)" },
  { pgName: "promotion_rules", displayName: "Promotion Rules" },
  { pgName: "warehouses", displayName: "Warehouses (คลังสินค้า)" },
  { pgName: "warehouse_zones", displayName: "Warehouse Zones" },
  { pgName: "warehouse_bins", displayName: "Warehouse Bins" },
  { pgName: "product_bin_assignments", displayName: "Product Bin Assignments" },
  { pgName: "stock_sync_settings", displayName: "Stock Sync Settings" },
  { pgName: "contacts", displayName: "Contacts (ผู้ติดต่อ)" },
  { pgName: "customers", displayName: "Customers (ลูกค้า)" },
  { pgName: "contact_settings", displayName: "Contact Settings" },
  { pgName: "line_recipients", displayName: "LINE Recipients" },
  { pgName: "line_group_mappings", displayName: "LINE Group Mappings" },
  { pgName: "work_schedules", displayName: "Work Schedules (ตารางงาน)" },
  { pgName: "ot_settings", displayName: "OT Settings" },
  { pgName: "holidays", displayName: "Holidays (วันหยุด)" },
  { pgName: "general_settings", displayName: "General Settings (ตั้งค่าทั่วไป)" },
  { pgName: "evaluation_periods", displayName: "Evaluation Periods" },
  { pgName: "restaurant_areas", displayName: "Restaurant Areas" },
  { pgName: "restaurant_tables", displayName: "Restaurant Tables" },
  { pgName: "menu_categories", displayName: "Menu Categories (หมวดเมนู)" },
  { pgName: "menu_items", displayName: "Menu Items (รายการเมนู)" },
  { pgName: "menu_modifier_groups", displayName: "Menu Modifier Groups" },
  { pgName: "menu_modifier_options", displayName: "Menu Modifier Options" },
  { pgName: "menu_item_modifiers", displayName: "Menu Item Modifiers" },
  { pgName: "api_keys", displayName: "API Keys" },
  { pgName: "facebook_pages", displayName: "Facebook Pages" },
  { pgName: "packing_cameras", displayName: "Packing Cameras" },
  { pgName: "chat_auto_rules", displayName: "Chat Auto Rules" },
  { pgName: "review_auto_replies", displayName: "Review Auto Replies" },
  { pgName: "landing_content", displayName: "Landing Content" },
  { pgName: "schema_version", displayName: "Schema Version" },
];

export const TRANSACTION_TABLES: TableInfo[] = [
  { pgName: "quotations", displayName: "Quotations (ใบเสนอราคา)" },
  { pgName: "quotation_items", displayName: "Quotation Items" },
  { pgName: "sales_orders", displayName: "Sales Orders (ใบสั่งขาย)" },
  { pgName: "sales_order_items", displayName: "Sales Order Items" },
  { pgName: "invoices", displayName: "Invoices (ใบแจ้งหนี้)" },
  { pgName: "invoice_items", displayName: "Invoice Items" },
  { pgName: "tax_invoices", displayName: "Tax Invoices (ใบกำกับภาษี)" },
  { pgName: "tax_invoice_items", displayName: "Tax Invoice Items" },
  { pgName: "receipts", displayName: "Receipts (ใบเสร็จ)" },
  { pgName: "receipt_items", displayName: "Receipt Items" },
  { pgName: "receipt_linked_docs", displayName: "Receipt Linked Docs" },
  { pgName: "billing_notes", displayName: "Billing Notes (ใบวางบิล)" },
  { pgName: "billing_note_linked_docs", displayName: "Billing Note Linked Docs" },
  { pgName: "deposit_receipts", displayName: "Deposit Receipts (ใบรับมัดจำ)" },
  { pgName: "deposit_deductions", displayName: "Deposit Deductions" },
  { pgName: "sales_credit_notes", displayName: "Credit Notes (ใบลดหนี้)" },
  { pgName: "sales_credit_note_items", displayName: "Credit Note Items" },
  { pgName: "purchase_requests", displayName: "Purchase Requests (ใบขอซื้อ)" },
  { pgName: "purchase_request_items", displayName: "Purchase Request Items" },
  { pgName: "purchase_orders", displayName: "Purchase Orders (ใบสั่งซื้อ)" },
  { pgName: "purchase_order_items", displayName: "Purchase Order Items" },
  { pgName: "purchase_invoices", displayName: "Purchase Invoices (ใบแจ้งหนี้ซื้อ)" },
  { pgName: "purchase_invoice_items", displayName: "Purchase Invoice Items" },
  { pgName: "expenses", displayName: "Expenses (ค่าใช้จ่าย)" },
  { pgName: "expense_items", displayName: "Expense Items" },
  { pgName: "purchase_deposits", displayName: "Purchase Deposits (มัดจำซื้อ)" },
  { pgName: "purchase_deposit_deductions", displayName: "Purchase Deposit Deductions" },
  { pgName: "purchase_debit_notes", displayName: "Debit Notes (ใบเพิ่มหนี้)" },
  { pgName: "purchase_debit_note_items", displayName: "Debit Note Items" },
  { pgName: "bid_comparisons", displayName: "Bid Comparisons (ใบเปรียบเทียบราคา)" },
  { pgName: "bid_comparison_items", displayName: "Bid Comparison Items" },
  { pgName: "bid_vendors", displayName: "Bid Vendors" },
  { pgName: "supplier_quotes", displayName: "Supplier Quotes" },
  { pgName: "supplier_quote_items", displayName: "Supplier Quote Items" },
  { pgName: "journal_entries", displayName: "Journal Entries (สมุดรายวัน)" },
  { pgName: "journal_lines", displayName: "Journal Lines" },
  { pgName: "payment_vouchers", displayName: "Payment Vouchers (ใบสำคัญจ่าย)" },
  { pgName: "payment_voucher_linked_docs", displayName: "Payment Voucher Linked Docs" },
  { pgName: "withholding_tax_certs", displayName: "WHT Certificates (หนังสือรับรองหักภาษี)" },
  { pgName: "wht_cert_items", displayName: "WHT Cert Items" },
  { pgName: "bank_statements", displayName: "Bank Statements (รายการธนาคาร)" },
  { pgName: "petty_cash_transactions", displayName: "Petty Cash Transactions" },
  { pgName: "vat_closings", displayName: "VAT Closings (ปิดภาษี)" },
  { pgName: "financial_notes", displayName: "Financial Notes" },
  { pgName: "commission_records", displayName: "Commission Records" },
  { pgName: "product_stock", displayName: "Product Stock (สต็อกสินค้า)" },
  { pgName: "stock_movements", displayName: "Stock Movements" },
  { pgName: "stock_transfers", displayName: "Stock Transfers" },
  { pgName: "stock_transfer_items", displayName: "Stock Transfer Items" },
  { pgName: "goods_receivings", displayName: "Goods Receivings (ใบรับสินค้า)" },
  { pgName: "goods_receiving_items", displayName: "Goods Receiving Items" },
  { pgName: "goods_requisitions", displayName: "Goods Requisitions" },
  { pgName: "goods_requisition_items", displayName: "Goods Requisition Items" },
  { pgName: "fulfillment_batches", displayName: "Fulfillment Batches" },
  { pgName: "fulfillment_items", displayName: "Fulfillment Items" },
  { pgName: "picking_waves", displayName: "Picking Waves" },
  { pgName: "picking_wave_items", displayName: "Picking Wave Items" },
  { pgName: "attendance_records", displayName: "Attendance (ลงเวลา)" },
  { pgName: "ot_records", displayName: "OT Records (ค่าล่วงเวลา)" },
  { pgName: "leave_requests", displayName: "Leave Requests (ใบลา)" },
  { pgName: "payroll_records", displayName: "Payroll (เงินเดือน)" },
  { pgName: "payroll_adjustments", displayName: "Payroll Adjustments" },
  { pgName: "evaluation_results", displayName: "Evaluation Results" },
  { pgName: "pos_sessions", displayName: "POS Sessions" },
  { pgName: "pos_transactions", displayName: "POS Transactions" },
  { pgName: "pos_transaction_items", displayName: "POS Transaction Items" },
  { pgName: "ecommerce_orders", displayName: "E-commerce Orders (คำสั่งซื้อ)" },
  { pgName: "ecommerce_order_items", displayName: "E-commerce Order Items" },
  { pgName: "ecommerce_settlements", displayName: "E-commerce Settlements" },
  { pgName: "ecommerce_settlement_items", displayName: "E-commerce Settlement Items" },
  { pgName: "ecommerce_returns", displayName: "E-commerce Returns" },
  { pgName: "ecommerce_return_items", displayName: "E-commerce Return Items" },
  { pgName: "ecommerce_import_batches", displayName: "E-commerce Import Batches" },
  { pgName: "restaurant_orders", displayName: "Restaurant Orders" },
  { pgName: "restaurant_order_items", displayName: "Restaurant Order Items" },
  { pgName: "kitchen_tickets", displayName: "Kitchen Tickets" },
  { pgName: "bill_splits", displayName: "Bill Splits" },
  { pgName: "live_sessions", displayName: "Live Sessions (ไลฟ์สด)" },
  { pgName: "live_session_products", displayName: "Live Session Products" },
  { pgName: "live_cf_orders", displayName: "Live CF Orders" },
  { pgName: "live_cf_items", displayName: "Live CF Items" },
  { pgName: "live_payments", displayName: "Live Payments" },
  { pgName: "live_agency_clients", displayName: "Live Agency Clients" },
  { pgName: "live_session_metrics", displayName: "Live Session Metrics" },
  { pgName: "live_aida_actions", displayName: "Live AIDA Actions" },
  { pgName: "live_session_reports", displayName: "Live Session Reports" },
  { pgName: "live_ad_budgets", displayName: "Live Ad Budgets" },
  { pgName: "ad_campaigns", displayName: "Ad Campaigns" },
  { pgName: "ad_spend_entries", displayName: "Ad Spend Entries" },
  { pgName: "chat_messages", displayName: "Chat Messages" },
  { pgName: "platform_chat_threads", displayName: "Platform Chat Threads" },
  { pgName: "platform_chat_messages", displayName: "Platform Chat Messages" },
  { pgName: "document_delivery_logs", displayName: "Document Delivery Logs" },
  { pgName: "sync_logs", displayName: "Sync Logs" },
  { pgName: "stock_sync_logs", displayName: "Stock Sync Logs" },
  { pgName: "activity_logs", displayName: "Activity Logs" },
  { pgName: "notifications", displayName: "Notifications (แจ้งเตือน)" },
  { pgName: "accounting_mgmt_logs", displayName: "Accounting Mgmt Logs" },
  { pgName: "tasks", displayName: "Tasks (งาน)" },
  { pgName: "task_assignees", displayName: "Task Assignees" },
  { pgName: "task_comments", displayName: "Task Comments" },
  { pgName: "task_boards", displayName: "Task Boards" },
  { pgName: "task_board_members", displayName: "Task Board Members" },
  { pgName: "task_columns", displayName: "Task Columns" },
  { pgName: "work_boards", displayName: "Work Boards" },
  { pgName: "work_board_groups", displayName: "Work Board Groups" },
  { pgName: "work_board_columns", displayName: "Work Board Columns" },
  { pgName: "work_board_items", displayName: "Work Board Items" },
  { pgName: "work_status_boards", displayName: "Work Status Boards" },
  { pgName: "work_status_columns", displayName: "Work Status Columns" },
  { pgName: "work_status_groups", displayName: "Work Status Groups" },
  { pgName: "work_status_rows", displayName: "Work Status Rows" },
  { pgName: "work_status_cells", displayName: "Work Status Cells" },
  { pgName: "work_status_attachments", displayName: "Work Status Attachments" },
  { pgName: "firm_documents", displayName: "Firm Documents" },
  { pgName: "firm_folders", displayName: "Firm Folders" },
  { pgName: "line_documents", displayName: "LINE Documents" },
  { pgName: "packing_recordings", displayName: "Packing Recordings" },
  { pgName: "demand_forecasts", displayName: "Demand Forecasts" },
  { pgName: "lucky_draw_campaigns", displayName: "Lucky Draw Campaigns" },
  { pgName: "lucky_draw_prizes", displayName: "Lucky Draw Prizes" },
  { pgName: "lucky_draw_entries", displayName: "Lucky Draw Entries" },
  { pgName: "sync_job_queue", displayName: "Sync Job Queue" },
  { pgName: "session", displayName: "Sessions" },
  { pgName: "maintenance_schedules", displayName: "Maintenance Schedules" },
  { pgName: "oauth_states", displayName: "OAuth States" },
  { pgName: "archive_ecommerce_orders", displayName: "Archive E-commerce Orders" },
  { pgName: "archive_journal_entries", displayName: "Archive Journal Entries" },
  { pgName: "archive_journal_lines", displayName: "Archive Journal Lines" },
  { pgName: "archive_runs", displayName: "Archive Runs" },
  { pgName: "ftp_archive_jobs", displayName: "FTP Archive Jobs" },
  { pgName: "ftp_archive_items", displayName: "FTP Archive Items" },
];

const SKIP_CLONE_TABLES = new Set(["session", "system_config", "schema_version", "clone_history", "machines", "machine_nics", "nic_ip_addresses", "routers", "router_domains", "router_port_forwards", "platform_domains"]);

let _cachedSchemaTables: string[] | null = null;

function getAllSchemaTables(): string[] {
  if (_cachedSchemaTables) return _cachedSchemaTables;
  try {
    const schema = require("@shared/schema");
    const names: string[] = [];
    for (const val of Object.values(schema)) {
      try {
        const config = getTableConfig(val as PgTable);
        if (config && config.name && config.columns) {
          names.push(config.name);
        }
      } catch {}
    }
    _cachedSchemaTables = names;
    console.log(`[Clone] Schema tables loaded: ${names.length} tables`);
    return names;
  } catch (err) {
    console.log(`[Clone] WARN: require("@shared/schema") failed, trying import()`, (err as any)?.message?.slice(0, 100));
    return [];
  }
}

export async function getAllSchemaTablesAsync(): Promise<string[]> {
  if (_cachedSchemaTables && _cachedSchemaTables.length > 0) return _cachedSchemaTables;
  try {
    const schema = await import("@shared/schema");
    const names: string[] = [];
    for (const val of Object.values(schema)) {
      try {
        const config = getTableConfig(val as PgTable);
        if (config && config.name && config.columns) {
          names.push(config.name);
        }
      } catch {}
    }
    _cachedSchemaTables = names;
    console.log(`[Clone] Schema tables loaded (async): ${names.length} tables`);
    return names;
  } catch {
    return [];
  }
}

export function getUnregisteredTables(): { tableName: string }[] {
  const registered = new Set([
    ...STATIC_TABLES.map(t => t.pgName),
    ...TRANSACTION_TABLES.map(t => t.pgName),
  ]);
  const allSchema = getAllSchemaTables();
  return allSchema
    .filter(t => !registered.has(t) && !SKIP_CLONE_TABLES.has(t))
    .map(t => ({ tableName: t }));
}

export async function getUnregisteredTablesAsync(): Promise<{ tableName: string }[]> {
  const registered = new Set([
    ...STATIC_TABLES.map(t => t.pgName),
    ...TRANSACTION_TABLES.map(t => t.pgName),
  ]);
  const allSchema = await getAllSchemaTablesAsync();
  return allSchema
    .filter(t => !registered.has(t) && !SKIP_CLONE_TABLES.has(t))
    .map(t => ({ tableName: t }));
}

export async function getTablesForCloneTypeAsync(cloneType: string, manualTables?: string[]): Promise<string[]> {
  const unregistered = (await getUnregisteredTablesAsync()).map(t => t.tableName);
  if (cloneType === "static") return [...STATIC_TABLES.map(t => t.pgName), ...unregistered];
  if (cloneType === "transaction") return [...TRANSACTION_TABLES.map(t => t.pgName), ...unregistered];
  if (cloneType === "all") {
    const base = [...STATIC_TABLES.map(t => t.pgName), ...TRANSACTION_TABLES.map(t => t.pgName)];
    return [...base, ...unregistered];
  }
  if (cloneType === "manual" && manualTables) {
    const allSchema = new Set(await getAllSchemaTablesAsync());
    const unregSet = new Set(unregistered);
    return manualTables.filter(t => allSchema.has(t) || unregSet.has(t));
  }
  return [];
}

export function getTablesForCloneType(cloneType: string, manualTables?: string[]): string[] {
  const unregistered = getUnregisteredTables().map(t => t.tableName);
  if (cloneType === "static") return [...STATIC_TABLES.map(t => t.pgName), ...unregistered];
  if (cloneType === "transaction") return [...TRANSACTION_TABLES.map(t => t.pgName), ...unregistered];
  if (cloneType === "all") {
    const base = [...STATIC_TABLES.map(t => t.pgName), ...TRANSACTION_TABLES.map(t => t.pgName)];
    return [...base, ...unregistered];
  }
  if (cloneType === "manual" && manualTables) {
    const allSchema = new Set(getAllSchemaTables());
    const unregSet = new Set(unregistered);
    return manualTables.filter(t => allSchema.has(t) || unregSet.has(t));
  }
  return [];
}

export async function getTableRowCounts(tableNames: string[], dbUrl: string): Promise<Map<string, number>> {
  const pool = new Pool({ connectionString: dbUrl, max: 2, idleTimeoutMillis: 5000 });
  const result = new Map<string, number>();
  try {
    for (const name of tableNames) {
      try {
        const r = await pool.query(`SELECT count(*)::int AS cnt FROM "${name}"`);
        result.set(name, r.rows[0]?.cnt || 0);
      } catch {
        result.set(name, -1);
      }
    }
  } finally {
    await pool.end();
  }
  return result;
}

export function calculateBatches(rowCount: number, batchSize: number = 500): number {
  if (rowCount <= 0) return 1;
  return Math.ceil(rowCount / batchSize);
}
