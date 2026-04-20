/**
 * ============================================================================
 * E-FILING SCHEMA DRAFT (RD Open API Integration)
 * ============================================================================
 *
 * สถานะ: DRAFT — รอพี่ช้างรีวิว ห้าม import เข้า schema.ts จนกว่าจะอนุมัติ
 * ห้าม run db:push กับไฟล์นี้
 *
 * Context:
 *   - สำนักงานลงทะเบียน ภ.อ.01.2 แล้ว (ref I021000001668, 2026-04-20)
 *   - Role: ผู้ให้บริการตัวแทน (Service Provider — sender.role = 2)
 *   - OA1- account: รอกรมสรรพากรออกให้หลังพิสูจน์ตัวตน (deadline 2026-05-20)
 *   - รองรับ: PP30, PP36, PND1, PND2, PND54, PND90/91/94 (8 แบบตาม API spec)
 *
 * Design decisions:
 *   1. OA1- credential เก็บที่ระดับ "tenant" (สำนักงาน) ไม่ใช่ "company" (ลูกค้า)
 *      เพราะ 1 OA1- ใช้ยื่นแทนลูกค้า 447 บริษัทได้
 *   2. CA Certificate เก็บ private key encrypted at rest (KMS / env-based key)
 *   3. ทุก submission บันทึก raw payload + response เพื่อ audit trail
 *   4. Consent form ของลูกค้าเป็น mandatory ก่อน enable e-filing
 *   5. Audit log แยก table append-only (ห้ามมี UPDATE/DELETE statement)
 *
 * Refs:
 *   - https://efiling.rd.go.th/rd-cms/api
 *   - Data_Format_PP30_V01.00.0000 (attached)
 *   - ภ.อ.01.2 ข้อตกลง ข้อ 2.4, 2.5, 3.4, 4.1
 * ============================================================================
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  decimal,
  jsonb,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// 1. TENANT-LEVEL: e-Filing settings (1 row per สำนักงาน)
// ============================================================================

export const efilingSettings = pgTable("efiling_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(), // FK → tenants.id

  // OA1- account จากกรมสรรพากร
  oa1Username: text("oa1_username"), // OA1-XXXXXXXXXXXXX
  oa1PasswordEnc: text("oa1_password_enc"), // AES-256 encrypted
  oa1Status: varchar("oa1_status", { length: 20 }).notNull().default("pending"),
  // pending | active | suspended | revoked

  // ภ.อ.01.2 registration tracking
  por012RefNo: text("por012_ref_no"), // เช่น "I021000001668"
  por012SubmittedAt: timestamp("por012_submitted_at"),
  por012ApprovedAt: timestamp("por012_approved_at"),
  por012Deadline: date("por012_deadline"), // 30 วัน นับจากลงทะเบียน

  // Active CA Certificate
  activeCaCertId: integer("active_ca_cert_id"), // FK → caCertificates.id

  // ETDA Electronic Delivery Service certification
  etdaCertNo: text("etda_cert_no"),
  etdaValidFrom: date("etda_valid_from"),
  etdaValidTo: date("etda_valid_to"),

  // Token cache (refresh ทุกครั้งที่ expire)
  cachedAccessToken: text("cached_access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),

  // Sender role: 1 = ผู้เสียภาษี / 2 = ผู้ให้บริการตัวแทน
  senderRole: integer("sender_role").notNull().default(2),

  // Environment: sandbox | production
  apiEnvironment: varchar("api_environment", { length: 20 })
    .notNull()
    .default("sandbox"),

  termsVersion: text("terms_version"), // version ของข้อตกลง RD ที่ตกลง
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsAcceptedBy: integer("terms_accepted_by"), // FK → users.id

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEfilingSettingsSchema = createInsertSchema(efilingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cachedAccessToken: true,
  tokenExpiresAt: true,
});
export type InsertEfilingSettings = z.infer<typeof insertEfilingSettingsSchema>;
export type EfilingSettings = typeof efilingSettings.$inferSelect;

// ============================================================================
// 2. CA Certificate vault (1 row ต่อใบ cert; rotate ได้)
// ============================================================================

export const caCertificates = pgTable(
  "ca_certificates",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),

    issuer: text("issuer").notNull(), // เช่น "TDID", "INET CA", "Thai Digital ID"
    subjectCN: text("subject_cn").notNull(),
    serialNumber: text("serial_number").notNull(),

    publicCertPem: text("public_cert_pem").notNull(),
    privateKeyEnc: text("private_key_enc").notNull(), // AES-256

    validFrom: timestamp("valid_from").notNull(),
    validTo: timestamp("valid_to").notNull(),
    revokedAt: timestamp("revoked_at"),

    notes: text("notes"),
    uploadedBy: integer("uploaded_by"), // FK → users.id
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("ca_certs_tenant_idx").on(t.tenantId),
    serialUnique: unique("ca_certs_serial_uq").on(t.tenantId, t.serialNumber),
  })
);

// ============================================================================
// 3. CLIENT-LEVEL: Consent + KYC (1 row ต่อ company ลูกค้า)
//    ตามข้อตกลง ภ.อ.01.2 ข้อ 2.5, 4.1, 4.2
// ============================================================================

export const clientEfilingConsent = pgTable(
  "client_efiling_consent",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(), // FK → companies.id

    // KYC — พิสูจน์ตัวตนลูกค้าตามมาตรฐาน ETDA
    kycStatus: varchar("kyc_status", { length: 20 }).notNull().default("pending"),
    // pending | verified | rejected | expired
    kycVerifiedAt: timestamp("kyc_verified_at"),
    kycVerifiedBy: integer("kyc_verified_by"), // FK → users.id (พนักงานพี่ทราย)
    kycMethod: varchar("kyc_method", { length: 30 }), // walk_in | video_call | nationaldigital_id
    kycDocsUrl: text("kyc_docs_url"), // เก็บภาพบัตร ปชช + หนังสือรับรอง

    // Consent — ลูกค้ายินยอมให้สำนักงานยื่นแทน
    consentDocUrl: text("consent_doc_url"), // PDF ที่ลูกค้าเซ็น
    consentedAt: timestamp("consented_at"),
    consentedBy: text("consented_by"), // ชื่อ-สกุล + เลข ปชช ผู้เซ็น
    consentedByPosition: text("consented_by_position"), // กรรมการ/ผู้รับมอบอำนาจ
    termsVersion: text("terms_version"), // version ของ ToS ที่ยินยอม

    // ขอบเขตที่ยินยอม (เลือกได้)
    allowVat: boolean("allow_vat").notNull().default(false), // ภพ.30, ภพ.36
    allowWithholding: boolean("allow_withholding").notNull().default(false), // ภงด.1, ภงด.2
    allowCorporate: boolean("allow_corporate").notNull().default(false), // ภงด.54
    allowPersonal: boolean("allow_personal").notNull().default(false), // ภงด.90/91/94
    allowDirectDebit: boolean("allow_direct_debit").notNull().default(false),

    revokedAt: timestamp("revoked_at"), // null = active
    revokedReason: text("revoked_reason"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("client_consent_company_idx").on(t.companyId),
  })
);

// ============================================================================
// 4. Bank authorization สำหรับ direct debit (ข้อ 3.3.2)
// ============================================================================

export const clientBankAuthorization = pgTable("client_bank_authorization", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),

  bankCode: varchar("bank_code", { length: 10 }).notNull(), // BBL, KBANK, SCB, ...
  bankName: text("bank_name").notNull(),
  accountNoEnc: text("account_no_enc").notNull(), // encrypted
  accountNoLast4: varchar("account_no_last4", { length: 4 }).notNull(), // เพื่อ display
  accountName: text("account_name").notNull(),

  authDocUrl: text("auth_doc_url").notNull(), // หนังสือยินยอมหักบัญชี
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"), // null = ไม่จำกัด

  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 5. Tax filing record (ทุก ภพ.30/ภงด.* ที่ยื่นผ่าน API)
// ============================================================================

export const taxFilings = pgTable(
  "tax_filings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    tenantId: integer("tenant_id").notNull(),

    // ประเภทแบบ
    formType: varchar("form_type", { length: 10 }).notNull(),
    // PP30 | PP36 | PND1 | PND2 | PND54 | PND90 | PND91 | PND94
    formVersion: text("form_version").notNull().default("1.0.0"),

    // Period
    taxMonth: integer("tax_month"), // 1-12 (null สำหรับแบบรายปี)
    taxYear: integer("tax_year").notNull(), // ปี พ.ศ.

    // Filing sequence
    filingType: varchar("filing_type", { length: 1 }).notNull().default("0"),
    // "0" = ปกติ, "1" = เพิ่มเติม
    filingNo: integer("filing_no").notNull().default(0), // 0 = ปกติ, 1+ = ครั้งที่เพิ่มเติม

    // Request/Response tracking
    requestId: text("request_id"), // เช่น "30660222100001"
    rdReferenceNo: text("rd_reference_no"), // เลขรับจากกรมสรรพากร
    payload: jsonb("payload"), // raw JSON ที่ส่งไป
    response: jsonb("response"), // raw response จาก RD

    // Status flow:
    // draft → ready → submitted → accepted | rejected → cancelled
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    statusMessage: text("status_message"),

    // Calculated totals (cache ไว้สำหรับ list view)
    totalSales: decimal("total_sales", { precision: 15, scale: 2 }),
    totalPurchases: decimal("total_purchases", { precision: 15, scale: 2 }),
    salesVat: decimal("sales_vat", { precision: 15, scale: 2 }),
    purchaseVat: decimal("purchase_vat", { precision: 15, scale: 2 }),
    netTaxPayable: decimal("net_tax_payable", { precision: 15, scale: 2 }),
    netTaxRefund: decimal("net_tax_refund", { precision: 15, scale: 2 }),

    // Refund preference (PP30): 2=ยกไปเดือนหน้า, 3=ขอคืน, 4=ไม่ขอคืน
    refundType: integer("refund_type"),

    // Approval workflow
    preparedBy: integer("prepared_by"), // FK → users.id (พนักงาน)
    preparedAt: timestamp("prepared_at"),
    approvedByClient: boolean("approved_by_client").notNull().default(false),
    clientApprovedAt: timestamp("client_approved_at"),
    clientApprovedBy: text("client_approved_by"),
    submittedBy: integer("submitted_by"), // FK → users.id (สำหรับ liability)
    submittedAt: timestamp("submitted_at"),
    acceptedAt: timestamp("accepted_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("tax_filings_company_idx").on(t.companyId),
    periodIdx: index("tax_filings_period_idx").on(
      t.companyId,
      t.formType,
      t.taxYear,
      t.taxMonth
    ),
    requestIdUnique: unique("tax_filings_request_id_uq").on(t.requestId),
    // 1 บริษัท × 1 form type × 1 period × 1 filing sequence = unique
    periodUnique: unique("tax_filings_period_uq").on(
      t.companyId,
      t.formType,
      t.taxYear,
      t.taxMonth,
      t.filingType,
      t.filingNo
    ),
  })
);

// ============================================================================
// 6. Tax payment + receipt (หลังจ่ายเงิน → ดาวน์โหลดใบเสร็จ)
// ============================================================================

export const taxPayments = pgTable("tax_payments", {
  id: serial("id").primaryKey(),
  filingId: integer("filing_id").notNull(), // FK → taxFilings.id

  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at"),

  // วิธีจ่าย
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  // direct_debit_office | direct_debit_client | bank_transfer | counter | other
  bankCode: varchar("bank_code", { length: 10 }),
  bankRef: text("bank_ref"),
  payinSlipUrl: text("payin_slip_url"), // จาก payin-form API

  // ใบเสร็จจาก receipt-form API
  receiptNo: text("receipt_no"),
  receiptPdfUrl: text("receipt_pdf_url"),
  receiptDownloadedAt: timestamp("receipt_downloaded_at"),

  // ส่งใบเสร็จให้ลูกค้า (ตามข้อตกลง 3.4)
  distributedToClientAt: timestamp("distributed_to_client_at"),
  distributionMethod: varchar("distribution_method", { length: 30 }),
  // email | client_portal | line | manual

  // เชื่อม journal entry อัตโนมัติ
  journalEntryId: integer("journal_entry_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 7. Append-only audit log (ห้าม UPDATE/DELETE — สำหรับ compliance)
// ============================================================================

export const efilingAuditLog = pgTable(
  "efiling_audit_log",
  {
    id: serial("id").primaryKey(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),

    tenantId: integer("tenant_id").notNull(),
    companyId: integer("company_id"),
    userId: integer("user_id"),

    action: varchar("action", { length: 50 }).notNull(),
    // auth_login | auth_token_refresh | submit_form | cancel_form
    // | result_query | payin_request | receipt_download | consent_grant
    // | consent_revoke | settings_change

    formType: varchar("form_type", { length: 10 }),
    filingId: integer("filing_id"),
    requestId: text("request_id"),

    ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6
    userAgent: text("user_agent"),

    // ห้ามเก็บ raw payload (PDPA) — เก็บแค่ hash
    payloadHash: varchar("payload_hash", { length: 64 }), // SHA-256
    responseCode: varchar("response_code", { length: 10 }), // เช่น I01000, E01002
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
  },
  (t) => ({
    tenantTimeIdx: index("audit_tenant_time_idx").on(t.tenantId, t.timestamp),
    companyIdx: index("audit_company_idx").on(t.companyId),
    actionIdx: index("audit_action_idx").on(t.action),
  })
);

// ============================================================================
// 8. RD response code lookup (cache จากเอกสาร RD)
// ============================================================================

export const rdResponseCodes = pgTable("rd_response_codes", {
  code: varchar("code", { length: 10 }).primaryKey(), // I01000, E01002, ...
  category: varchar("category", { length: 20 }).notNull(), // info | error
  message: text("message").notNull(),
  messageEn: text("message_en"),
  severity: varchar("severity", { length: 10 }).notNull().default("info"),
  // info | warning | error | fatal
  retryable: boolean("retryable").notNull().default(false),
  notes: text("notes"),
});

// ============================================================================
// END OF DRAFT
//
// Migration plan (เมื่อพี่ช้างอนุมัติ):
//   1. Copy ทั้งหมดเข้า schema.ts ใต้ section ใหม่ "// === E-Filing ==="
//   2. Add foreign key references จริง (tenantId → tenants.id, etc.)
//   3. npm run db:push --force
//   4. Seed rdResponseCodes จากเอกสาร RD (มี ~30 codes)
//   5. Implement IStorage methods + routes (server/routes/efiling-routes.ts)
//
// Estimate ตารางใหม่: 8 tables, ~70 columns, indexes ~10 ตัว
// ============================================================================
