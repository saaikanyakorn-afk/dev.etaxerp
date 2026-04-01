import { type Express, type Request, type Response } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import archiver from "archiver";
import JSZip from "jszip";
import { db } from "../db";
import { legacyCompanies, legacyChartOfAccounts, legacyContacts, legacyDocuments, legacyDocumentItems, legacyGlEntries, legacyGlLines } from "@shared/schema";
import { eq, sql, and, desc, asc, ilike } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

interface ParsedCSV {
  filename: string;
  tableName: string;
  columns: string[];
  rows: Record<string, string>[];
}

function parseCSVBuffer(buffer: Buffer, filename: string): ParsedCSV {
  const tableName = filename.replace(/\.csv$/i, "").replace(/\s+/g, "_").toLowerCase();

  let content = buffer.toString("utf-8");
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  });

  const columns = records.length > 0 ? Object.keys(records[0]) : [];

  return {
    filename,
    tableName,
    columns,
    rows: records,
  };
}

function mergePaginatedTables(tables: ParsedCSV[]): ParsedCSV[] {
  const groups: Record<string, ParsedCSV[]> = {};
  for (const t of tables) {
    const baseName = t.tableName.replace(/_p\d+of\d+.*$/i, "");
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push(t);
  }
  return Object.entries(groups).map(([name, parts]) => {
    if (parts.length === 1) return { ...parts[0], tableName: name };
    parts.sort((a, b) => {
      const am = a.tableName.match(/_p(\d+)of\d+$/i);
      const bm = b.tableName.match(/_p(\d+)of\d+$/i);
      return (am ? parseInt(am[1]) : 0) - (bm ? parseInt(bm[1]) : 0);
    });
    const allRows = parts.flatMap(p => p.rows);
    const allCols = new Set(parts.flatMap(p => p.columns));
    return { filename: parts[0].filename, tableName: name, columns: [...allCols], rows: allRows };
  });
}

function extractCompanyInfo(tables: ParsedCSV[]): { companyId: string; companyName: string; taxId: string; address: string; phone: string; email: string } {
  const settingsNames = ["company_setting", "companysetting", "company", "setting", "settings"];
  const settings = tables.find(t => settingsNames.some(s => t.tableName.toLowerCase().includes(s)));
  if (settings && settings.rows.length > 0) {
    const row = settings.rows[0];
    const nameFields = ["company_name", "companyName", "name_th", "name", "ชื่อบริษัท", "company_name_th"];
    const idFields = ["id", "company_id", "companyId", "comp_id"];
    const taxFields = ["tax_id", "taxId", "tax_no", "เลขผู้เสียภาษี"];
    const addressFields = ["address", "address_th", "ที่อยู่"];
    const phoneFields = ["phone", "tel", "telephone", "โทร"];
    const emailFields = ["email", "อีเมล"];
    const foundName = nameFields.find(f => row[f] && row[f].trim());
    const foundId = idFields.find(f => row[f] && row[f].trim());
    const foundTax = taxFields.find(f => row[f] && row[f].trim());
    const foundAddr = addressFields.find(f => row[f] && row[f].trim());
    const foundPhone = phoneFields.find(f => row[f] && row[f].trim());
    const foundEmail = emailFields.find(f => row[f] && row[f].trim());
    return {
      companyId: foundId ? row[foundId] : "",
      companyName: foundName ? row[foundName] : "",
      taxId: foundTax ? row[foundTax] : "",
      address: foundAddr ? row[foundAddr] : "",
      phone: foundPhone ? row[foundPhone] : "",
      email: foundEmail ? row[foundEmail] : "",
    };
  }

  for (const t of tables) {
    if (t.rows.length > 0) {
      const row = t.rows[0];
      if (row["company_id"]) {
        const nameFromAny = row["company_name"] || row["name_th"] || "";
        return { companyId: row["company_id"], companyName: nameFromAny, taxId: "", address: "", phone: "", email: "" };
      }
    }
  }

  return { companyId: "unknown", companyName: "", taxId: "", address: "", phone: "", email: "" };
}

function getDateRange(tables: ParsedCSV[]): { from: string; to: string } {
  let allDates: string[] = [];

  for (const t of tables) {
    for (const row of t.rows) {
      const dateFields = ["date", "doc_date", "created_at", "gl_date", "bill_date", "payment_date"];
      for (const f of dateFields) {
        if (row[f] && row[f].match(/^\d{4}[-/]\d{2}[-/]\d{2}/)) {
          allDates.push(row[f].substring(0, 10));
        }
      }
    }
  }

  if (allDates.length === 0) return { from: "-", to: "-" };
  allDates.sort();
  return { from: allDates[0], to: allDates[allDates.length - 1] };
}

function extractChartOfAccounts(tables: ParsedCSV[]): Array<{
  accountCode: string;
  accountName: string;
  accountType: string;
  parentCode: string;
  level: number;
  isHeader: boolean;
  normalBalance: string;
  category: string;
  rawData: Record<string, string>;
}> {
  const coaPatterns = ["chart_of_account", "chartofaccount", "coa"];
  const coaTables = tables.filter(t => {
    const baseName = t.tableName.replace(/_p\d+of\d+.*$/, "").toLowerCase();
    return coaPatterns.some(s => baseName === s || baseName.startsWith(s + "_"));
  });
  if (coaTables.length === 0) return [];
  const coaTable = { ...coaTables[0], rows: coaTables.flatMap(t => t.rows) };

  return coaTable.rows.map(row => {
    const codeFields = ["account_code", "accountCode", "code", "acct_code", "acc_code", "รหัสบัญชี"];
    const nameFields = ["account_name", "accountName", "name", "acct_name", "acc_name", "name_th", "ชื่อบัญชี"];
    const typeFields = ["account_type", "accountType", "type", "acct_type", "ประเภท"];
    const parentFields = ["parent_code", "parentCode", "parent_id", "parent"];
    const levelFields = ["level", "acct_level", "ระดับ"];
    const headerFields = ["is_header", "isHeader", "header", "is_control"];
    const balanceFields = ["normal_balance", "normalBalance", "balance_type", "dr_cr"];
    const categoryFields = ["category", "group", "acct_group", "หมวด"];

    const code = codeFields.find(f => row[f]?.trim()) ? row[codeFields.find(f => row[f]?.trim())!] : "";
    const name = nameFields.find(f => row[f]?.trim()) ? row[nameFields.find(f => row[f]?.trim())!] : "";
    const type = typeFields.find(f => row[f]?.trim()) ? row[typeFields.find(f => row[f]?.trim())!] : "";
    const parent = parentFields.find(f => row[f]?.trim()) ? row[parentFields.find(f => row[f]?.trim())!] : "";
    const lvl = levelFields.find(f => row[f]?.trim()) ? parseInt(row[levelFields.find(f => row[f]?.trim())!]) || 1 : 1;
    const hdr = headerFields.find(f => row[f]?.trim()) ? ["1", "true", "yes"].includes(row[headerFields.find(f => row[f]?.trim())!].toLowerCase()) : false;
    const bal = balanceFields.find(f => row[f]?.trim()) ? row[balanceFields.find(f => row[f]?.trim())!] : "";
    const cat = categoryFields.find(f => row[f]?.trim()) ? row[categoryFields.find(f => row[f]?.trim())!] : "";

    return {
      accountCode: code.trim(),
      accountName: name.trim(),
      accountType: type.trim(),
      parentCode: parent.trim(),
      level: lvl,
      isHeader: hdr || (code.length <= 3),
      normalBalance: bal.trim(),
      category: cat.trim(),
      rawData: row,
    };
  }).filter(a => a.accountCode);
}

function extractContacts(tables: ParsedCSV[]): Array<{
  contactCode: string;
  contactName: string;
  contactType: string;
  taxId: string;
  branchNo: string;
  address: string;
  phone: string;
  email: string;
  rawData: Record<string, string>;
}> {
  const contactPatterns = ["contact", "contacts"];
  const contactTables = tables.filter(t => {
    const baseName = t.tableName.replace(/_p\d+of\d+.*$/, "").replace(/_etax$/, "").toLowerCase();
    return contactPatterns.some(s => baseName === s);
  });
  if (contactTables.length === 0) return [];
  const contactTable = { ...contactTables[0], rows: contactTables.flatMap(t => t.rows) };

  return contactTable.rows.map(row => {
    const codeFields = ["contact_code", "code", "contactCode", "cust_code", "vendor_code", "รหัส"];
    const nameFields = ["contact_name", "name", "contactName", "name_th", "company_name", "ชื่อ"];
    const typeFields = ["contact_type", "type", "contactType", "ประเภท"];
    const taxFields = ["tax_id", "taxId", "tax_no", "เลขภาษี", "เลขผู้เสียภาษี"];
    const branchFields = ["branch_no", "branchNo", "branch", "สาขา"];
    const addressFields = ["address", "addr", "ที่อยู่"];
    const phoneFields = ["phone", "tel", "telephone", "mobile", "โทร"];
    const emailFields = ["email", "e_mail", "อีเมล"];

    const findVal = (fields: string[]) => {
      const f = fields.find(f => row[f]?.trim());
      return f ? row[f].trim() : "";
    };

    return {
      contactCode: findVal(codeFields),
      contactName: findVal(nameFields),
      contactType: findVal(typeFields),
      taxId: findVal(taxFields),
      branchNo: findVal(branchFields),
      address: findVal(addressFields),
      phone: findVal(phoneFields),
      email: findVal(emailFields),
      rawData: row,
    };
  }).filter(c => c.contactName);
}

const DOC_TYPE_MAP: Record<string, { docType: string; noField: string[]; dateField: string[]; contactField: string[]; totalField: string[]; subtotalField: string[]; vatField: string[]; statusField: string[]; descField: string[] }> = {
  quotation: { docType: "quotation", noField: ["quotation_no", "doc_no", "no"], dateField: ["quotation_date", "date", "doc_date"], contactField: ["contact_name", "customer_name", "name"], totalField: ["grand_total", "total", "net_total", "amount"], subtotalField: ["total", "subtotal", "sub_total", "before_vat"], vatField: ["vat", "vat_amount", "vat_total", "tax"], statusField: ["status", "state"], descField: ["description", "remark", "note"] },
  bill: { docType: "bill", noField: ["bill_no", "invoice_no", "doc_no", "no"], dateField: ["bill_date", "invoice_date", "date", "doc_date"], contactField: ["contact_name", "customer_name", "name"], totalField: ["grand_total", "total", "net_total"], subtotalField: ["total", "subtotal", "sub_total", "before_vat"], vatField: ["vat", "vat_amount", "vat_total", "tax"], statusField: ["status", "state"], descField: ["description", "remark"] },
  bn: { docType: "bn", noField: ["bn_no", "billing_note_no", "doc_no", "no"], dateField: ["bn_date", "billing_date", "date", "doc_date"], contactField: ["contact_name", "customer_name", "name"], totalField: ["grand_total", "total", "net_total"], subtotalField: ["total", "subtotal"], vatField: ["vat", "vat_amount"], statusField: ["status"], descField: ["description", "remark"] },
  receipt: { docType: "receipt", noField: ["receipt_no", "doc_no", "no"], dateField: ["receipt_date", "date", "doc_date"], contactField: ["contact_name", "customer_name", "name"], totalField: ["grand_total", "total", "net_total", "amount"], subtotalField: ["total", "subtotal"], vatField: ["vat", "vat_amount"], statusField: ["status"], descField: ["description", "remark"] },
  po: { docType: "po", noField: ["po_no", "purchase_order_no", "doc_no", "no"], dateField: ["po_date", "date", "doc_date"], contactField: ["contact_name", "vendor_name", "supplier_name", "name"], totalField: ["grand_total", "total", "net_total"], subtotalField: ["total", "subtotal"], vatField: ["vat", "vat_amount"], statusField: ["status"], descField: ["description", "remark"] },
  expense: { docType: "expense", noField: ["expense_no", "doc_no", "no"], dateField: ["expense_date", "date", "doc_date"], contactField: ["contact_name", "vendor_name", "description", "name"], totalField: ["grand_total", "total", "net_total", "amount"], subtotalField: ["total", "subtotal"], vatField: ["vat", "vat_amount"], statusField: ["status"], descField: ["description", "remark", "note"] },
  payment: { docType: "payment", noField: ["payment_no", "doc_no", "no"], dateField: ["payment_date", "date", "doc_date"], contactField: ["contact_name", "vendor_name", "payee_name", "name"], totalField: ["grand_total", "total", "net_total", "amount"], subtotalField: ["total", "subtotal"], vatField: ["vat", "vat_amount"], statusField: ["status"], descField: ["description", "remark"] },
  wht: { docType: "wht", noField: ["wht_no", "doc_no", "no"], dateField: ["wht_date", "date", "doc_date"], contactField: ["contact_name", "payee_name", "name"], totalField: ["total", "wht_total", "amount", "grand_total"], subtotalField: ["base_amount", "income_amount"], vatField: [], statusField: ["status"], descField: ["description", "remark", "income_type"] },
};

const ITEM_TABLE_MAP: Record<string, string> = {
  quotation_item: "quotation", bill_item: "bill", bn_item: "bn", receipt_item: "receipt",
  po_item: "po", expense_item: "expense", payment_item: "payment", wht_item: "wht",
};

function normalizeTableName(name: string): string {
  return name.replace(/_p\d+of\d+.*$/i, "").toLowerCase();
}

const DOC_ID_FIELDS: Record<string, string[]> = {
  quotation: ["quotation_id", "id"],
  bill: ["bill_id", "id"],
  bn: ["bn_id", "billing_note_id", "id"],
  receipt: ["receipt_id", "id"],
  po: ["po_id", "purchase_order_id", "id"],
  expense: ["expense_id", "id"],
  payment: ["payment_id", "id"],
  wht: ["wht_id", "id"],
};

function extractDocuments(tables: ParsedCSV[]): {
  docs: Array<{ docType: string; sourceId: string; docNo: string; docDate: string; contactName: string; grandTotal: string; subtotal: string; vatAmount: string; status: string; description: string; contactCode: string; rawData: Record<string, string> }>;
  items: Array<{ docType: string; parentSourceId: string; parentDocNo: string; lineNo: number; itemCode: string; itemName: string; description: string; quantity: string; unitPrice: string; amount: string; unit: string; rawData: Record<string, string> }>
} {
  const docs: any[] = [];
  const items: any[] = [];
  const fv = (row: Record<string, string>, fields: string[]) => { for (const f of fields) { if (row[f]?.trim()) return row[f].trim(); } return ""; };

  for (const t of tables) {
    const baseName = normalizeTableName(t.tableName);

    if (DOC_TYPE_MAP[baseName]) {
      const cfg = DOC_TYPE_MAP[baseName];
      for (const row of t.rows) {
        const docNo = fv(row, cfg.noField);
        const sourceId = fv(row, ["id", `${baseName}_id`]);
        if (!docNo && !sourceId) continue;
        docs.push({
          docType: cfg.docType,
          sourceId,
          docNo,
          docDate: fv(row, cfg.dateField),
          contactName: fv(row, cfg.contactField),
          grandTotal: fv(row, cfg.totalField),
          subtotal: fv(row, cfg.subtotalField),
          vatAmount: fv(row, cfg.vatField),
          status: fv(row, cfg.statusField),
          description: fv(row, cfg.descField),
          contactCode: fv(row, ["contact_code", "code", "vendor_code", "customer_code"]),
          rawData: row,
        });
      }
    }

    if (ITEM_TABLE_MAP[baseName]) {
      const parentType = ITEM_TABLE_MAP[baseName];
      const parentIdFields = DOC_ID_FIELDS[parentType] || ["id"];
      for (let i = 0; i < t.rows.length; i++) {
        const row = t.rows[i];
        const parentSourceId = fv(row, parentIdFields.map(f => f === "id" ? `${parentType}_id` : f));
        const parentDocNo = fv(row, DOC_TYPE_MAP[parentType]?.noField || ["doc_no", "no"]);
        items.push({
          docType: parentType,
          parentSourceId,
          parentDocNo,
          lineNo: parseInt(fv(row, ["line_no", "seq", "no", "item_no"]) || String(i + 1)) || (i + 1),
          itemCode: fv(row, ["item_code", "product_code", "code", "sku"]),
          itemName: fv(row, ["item_name", "product_name", "name", "description"]),
          description: fv(row, ["description", "remark", "note", "detail"]),
          quantity: fv(row, ["quantity", "qty", "amount_qty"]),
          unitPrice: fv(row, ["unit_price", "price", "rate", "cost"]),
          amount: fv(row, ["amount", "total", "line_total", "net_amount"]),
          unit: fv(row, ["unit", "unit_name", "uom"]),
          rawData: row,
        });
      }
    }
  }

  return { docs, items };
}

function extractGlData(tables: ParsedCSV[]): {
  entries: Array<{ glNo: string; glDate: string; description: string; reference: string; journalBook: string; totalDebit: string; totalCredit: string; status: string; rawData: Record<string, string> }>;
  lines: Array<{ glNo: string; glDate: string; accountCode: string; accountName: string; debit: string; credit: string; description: string; reference: string; journalBook: string; rawData: Record<string, string> }>
} {
  const entries: any[] = [];
  const lines: any[] = [];
  const fv = (row: Record<string, string>, fields: string[]) => { for (const f of fields) { if (row[f]?.trim()) return row[f].trim(); } return ""; };

  for (const t of tables) {
    const baseName = normalizeTableName(t.tableName);

    if (baseName === "gl" || baseName === "journal" || baseName === "journal_entry" || baseName === "gl_entry") {
      for (const row of t.rows) {
        const glNo = fv(row, ["gl_no", "journal_no", "doc_no", "no", "entry_no"]);
        if (!glNo) continue;
        entries.push({
          glNo,
          glDate: fv(row, ["gl_date", "journal_date", "date", "entry_date", "doc_date"]),
          description: fv(row, ["description", "remark", "note", "memo"]),
          reference: fv(row, ["reference", "ref", "ref_no", "doc_ref"]),
          journalBook: fv(row, ["journal_book", "book", "book_type", "journal_type"]),
          totalDebit: fv(row, ["total_debit", "debit_total", "debit"]),
          totalCredit: fv(row, ["total_credit", "credit_total", "credit"]),
          status: fv(row, ["status", "state"]),
          rawData: row,
        });
      }
    }

    if (baseName === "gl_tran" || baseName === "gl_transaction" || baseName === "journal_item" || baseName === "journal_line" || baseName === "gl_line" || baseName === "gl_detail" || baseName === "gl_report") {
      for (const row of t.rows) {
        lines.push({
          glNo: fv(row, ["gl_no", "journal_no", "entry_no", "doc_no"]),
          glDate: fv(row, ["gl_date", "journal_date", "date", "entry_date"]),
          accountCode: fv(row, ["account_code", "code", "acct_code", "account_no"]),
          accountName: fv(row, ["account_name", "name", "acct_name"]),
          debit: fv(row, ["debit", "debit_amount", "dr"]),
          credit: fv(row, ["credit", "credit_amount", "cr"]),
          description: fv(row, ["description", "remark", "note", "memo", "detail"]),
          reference: fv(row, ["reference", "ref", "ref_no"]),
          journalBook: fv(row, ["journal_book", "book", "book_type"]),
          rawData: row,
        });
      }
    }
  }

  return { entries, lines };
}

async function importParsedDataToDb(parsed: ParsedCSV[], userId: number | null) {
  const companyInfo = extractCompanyInfo(parsed);
  const dateRange = getDateRange(parsed);
  const totalRows = parsed.reduce((sum, t) => sum + t.rows.length, 0);

  const accounts = extractChartOfAccounts(parsed);
  const contacts = extractContacts(parsed);
  const { docs, items } = extractDocuments(parsed);
  const glData = extractGlData(parsed);

  const result = await db.transaction(async (tx) => {
    let company;
    let isUpdate = false;

    if (companyInfo.companyId && userId) {
      const [existing] = await tx.select()
        .from(legacyCompanies)
        .where(sql`${legacyCompanies.sourceId} = ${companyInfo.companyId} AND ${legacyCompanies.importedBy} = ${userId}`)
        .limit(1);

      if (existing) {
        isUpdate = true;
        await tx.delete(legacyGlLines).where(eq(legacyGlLines.legacyCompanyId, existing.id));
        await tx.delete(legacyGlEntries).where(eq(legacyGlEntries.legacyCompanyId, existing.id));
        await tx.delete(legacyDocuments).where(eq(legacyDocuments.legacyCompanyId, existing.id));
        await tx.delete(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, existing.id));
        await tx.delete(legacyContacts).where(eq(legacyContacts.legacyCompanyId, existing.id));

        const [updated] = await tx.update(legacyCompanies)
          .set({
            name: companyInfo.companyName || existing.name,
            taxId: companyInfo.taxId || existing.taxId,
            address: companyInfo.address || existing.address,
            phone: companyInfo.phone || existing.phone,
            email: companyInfo.email || existing.email,
            dateRangeFrom: dateRange.from !== "-" ? dateRange.from : existing.dateRangeFrom,
            dateRangeTo: dateRange.to !== "-" ? dateRange.to : existing.dateRangeTo,
            tableCount: parsed.length,
            totalRows,
            importedAt: new Date(),
            metadata: {
              tables: parsed.map(t => ({ name: t.tableName, rowCount: t.rows.length, columns: t.columns })),
            },
          })
          .where(eq(legacyCompanies.id, existing.id))
          .returning();
        company = updated;
      }
    }

    if (!company) {
      const [created] = await tx.insert(legacyCompanies).values({
        sourceId: companyInfo.companyId || null,
        name: companyInfo.companyName || `Company ${companyInfo.companyId || "Unknown"}`,
        taxId: companyInfo.taxId || null,
        address: companyInfo.address || null,
        phone: companyInfo.phone || null,
        email: companyInfo.email || null,
        importedBy: userId || null,
        dateRangeFrom: dateRange.from !== "-" ? dateRange.from : null,
        dateRangeTo: dateRange.to !== "-" ? dateRange.to : null,
        tableCount: parsed.length,
        totalRows,
        metadata: {
          tables: parsed.map(t => ({ name: t.tableName, rowCount: t.rows.length, columns: t.columns })),
        },
      }).returning();
      company = created;
    }

    let accountsInserted = 0;
    if (accounts.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < accounts.length; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        await tx.insert(legacyChartOfAccounts).values(
          batch.map(a => ({
            legacyCompanyId: company.id,
            accountCode: a.accountCode,
            accountName: a.accountName,
            accountType: a.accountType || null,
            parentCode: a.parentCode || null,
            level: a.level,
            isHeader: a.isHeader,
            normalBalance: a.normalBalance || null,
            category: a.category || null,
            rawData: a.rawData,
          }))
        );
        accountsInserted += batch.length;
      }
    }

    let contactsInserted = 0;
    if (contacts.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        await tx.insert(legacyContacts).values(
          batch.map(c => ({
            legacyCompanyId: company.id,
            contactCode: c.contactCode || null,
            contactName: c.contactName,
            contactType: c.contactType || null,
            taxId: c.taxId || null,
            branchNo: c.branchNo || null,
            address: c.address || null,
            phone: c.phone || null,
            email: c.email || null,
            rawData: c.rawData,
          }))
        );
        contactsInserted += batch.length;
      }
    }

    let documentsInserted = 0;
    let documentItemsInserted = 0;
    if (docs.length > 0) {
      const docNoToId: Record<string, number> = {};
      const sourceIdToId: Record<string, number> = {};
      const batchSize = 500;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const inserted = await tx.insert(legacyDocuments).values(
          batch.map(d => ({
            legacyCompanyId: company.id,
            docType: d.docType,
            docNo: d.docNo || null,
            docDate: d.docDate || null,
            contactName: d.contactName || null,
            contactCode: d.contactCode || null,
            description: d.description || null,
            subtotal: d.subtotal || null,
            vatAmount: d.vatAmount || null,
            grandTotal: d.grandTotal || null,
            status: d.status || null,
            rawData: d.rawData,
          }))
        ).returning({ id: legacyDocuments.id, docNo: legacyDocuments.docNo, docType: legacyDocuments.docType });
        for (let j = 0; j < inserted.length; j++) {
          const ins = inserted[j];
          const orig = batch[j];
          if (ins.docNo) docNoToId[`${ins.docType}:${ins.docNo}`] = ins.id;
          if (orig.sourceId) sourceIdToId[`${ins.docType}:${orig.sourceId}`] = ins.id;
        }
        documentsInserted += batch.length;
      }

      if (items.length > 0) {
        const itemsWithParent = items.map(it => {
          const bySourceId = it.parentSourceId ? sourceIdToId[`${it.docType}:${it.parentSourceId}`] : null;
          const byDocNo = it.parentDocNo ? docNoToId[`${it.docType}:${it.parentDocNo}`] : null;
          return { ...it, legacyDocumentId: bySourceId || byDocNo || null };
        }).filter(it => it.legacyDocumentId);

        for (let i = 0; i < itemsWithParent.length; i += batchSize) {
          const batch = itemsWithParent.slice(i, i + batchSize);
          await tx.insert(legacyDocumentItems).values(
            batch.map(it => ({
              legacyDocumentId: it.legacyDocumentId!,
              lineNo: it.lineNo,
              itemCode: it.itemCode || null,
              itemName: it.itemName || null,
              description: it.description || null,
              quantity: it.quantity || null,
              unitPrice: it.unitPrice || null,
              amount: it.amount || null,
              unit: it.unit || null,
              rawData: it.rawData,
            }))
          );
          documentItemsInserted += batch.length;
        }
      }
    }

    let glEntriesInserted = 0;
    let glLinesInserted = 0;
    if (glData.entries.length > 0) {
      const glNoToId: Record<string, number> = {};
      const batchSize = 500;
      for (let i = 0; i < glData.entries.length; i += batchSize) {
        const batch = glData.entries.slice(i, i + batchSize);
        const inserted = await tx.insert(legacyGlEntries).values(
          batch.map(e => ({
            legacyCompanyId: company.id,
            glNo: e.glNo || null,
            glDate: e.glDate || null,
            description: e.description || null,
            reference: e.reference || null,
            journalBook: e.journalBook || null,
            totalDebit: e.totalDebit || null,
            totalCredit: e.totalCredit || null,
            status: e.status || null,
            rawData: e.rawData,
          }))
        ).returning({ id: legacyGlEntries.id, glNo: legacyGlEntries.glNo });
        for (const ins of inserted) {
          if (ins.glNo) glNoToId[ins.glNo] = ins.id;
        }
        glEntriesInserted += batch.length;
      }

      if (glData.lines.length > 0) {
        const linesWithParent = glData.lines.map(l => ({
          ...l,
          legacyGlEntryId: l.glNo ? glNoToId[l.glNo] || null : null,
        }));
        for (let i = 0; i < linesWithParent.length; i += batchSize) {
          const batch = linesWithParent.slice(i, i + batchSize);
          await tx.insert(legacyGlLines).values(
            batch.map(l => ({
              legacyCompanyId: company.id,
              legacyGlEntryId: l.legacyGlEntryId,
              accountCode: l.accountCode || null,
              accountName: l.accountName || null,
              debit: l.debit || null,
              credit: l.credit || null,
              description: l.description || null,
              glNo: l.glNo || null,
              glDate: l.glDate || null,
              reference: l.reference || null,
              journalBook: l.journalBook || null,
              rawData: l.rawData,
            }))
          );
          glLinesInserted += batch.length;
        }
      }
    } else if (glData.lines.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < glData.lines.length; i += batchSize) {
        const batch = glData.lines.slice(i, i + batchSize);
        await tx.insert(legacyGlLines).values(
          batch.map(l => ({
            legacyCompanyId: company.id,
            legacyGlEntryId: null,
            accountCode: l.accountCode || null,
            accountName: l.accountName || null,
            debit: l.debit || null,
            credit: l.credit || null,
            description: l.description || null,
            glNo: l.glNo || null,
            glDate: l.glDate || null,
            reference: l.reference || null,
            journalBook: l.journalBook || null,
            rawData: l.rawData,
          }))
        );
        glLinesInserted += batch.length;
      }
    }

    return {
      success: true,
      isUpdate,
      companyId: company.id,
      companyName: company.name,
      accountsInserted,
      contactsInserted,
      documentsInserted,
      documentItemsInserted,
      glEntriesInserted,
      glLinesInserted,
      tablesCount: parsed.length,
      totalRows,
    };
  });

  return result;
}

export function registerLegacyImportRoutes(app: Express) {
  app.post("/api/legacy-import/parse", upload.array("csvFiles", 100), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).send("ไม่พบไฟล์ CSV");
      }

      const parsed: ParsedCSV[] = [];
      for (const file of files) {
        try {
          const result = parseCSVBuffer(file.buffer, file.originalname);
          parsed.push(result);
        } catch (err: any) {
          console.warn(`Failed to parse ${file.originalname}:`, err.message);
        }
      }

      if (parsed.length === 0) {
        return res.status(400).send("ไม่สามารถอ่านไฟล์ CSV ได้");
      }

      const { companyId, companyName } = extractCompanyInfo(parsed);
      const dateRange = getDateRange(parsed);

      return res.json({
        companyId,
        companyName,
        tables: parsed.map(t => ({
          name: t.tableName,
          rowCount: t.rows.length,
          columns: t.columns,
          sampleRows: t.rows.slice(0, 3),
        })),
        totalRows: parsed.reduce((sum, t) => sum + t.rows.length, 0),
        dateRange,
      });
    } catch (err: any) {
      console.error("Legacy import parse error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.post("/api/legacy-import/generate-zip", upload.array("csvFiles", 100), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).send("ไม่พบไฟล์ CSV");
      }

      const parsed: ParsedCSV[] = [];
      for (const file of files) {
        try {
          const result = parseCSVBuffer(file.buffer, file.originalname);
          parsed.push(result);
        } catch (err: any) {
          console.warn(`Failed to parse ${file.originalname}:`, err.message);
        }
      }

      const { companyId, companyName } = extractCompanyInfo(parsed);

      const manifest = {
        version: "1.0",
        source: "TRCloud",
        exportedAt: new Date().toISOString(),
        companyId,
        companyName,
        tables: parsed.map(t => ({
          name: t.tableName,
          filename: `${t.tableName}.json`,
          rowCount: t.rows.length,
          columns: t.columns,
        })),
        totalRows: parsed.reduce((sum, t) => sum + t.rows.length, 0),
        dateRange: getDateRange(parsed),
      };

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="TRCloud_${companyId}.zip"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

      for (const table of parsed) {
        const tableData = {
          tableName: table.tableName,
          columns: table.columns,
          rowCount: table.rows.length,
          rows: table.rows,
        };
        archive.append(JSON.stringify(tableData), { name: `data/${table.tableName}.json` });
      }

      await archive.finalize();
    } catch (err: any) {
      console.error("Legacy import generate-zip error:", err);
      if (!res.headersSent) {
        return res.status(500).send(err.message);
      }
    }
  });

  app.post("/api/legacy-import/import-to-db", upload.array("csvFiles", 100), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).send("ไม่พบไฟล์ CSV");
      }

      const parsed: ParsedCSV[] = [];
      for (const file of files) {
        try {
          const result = parseCSVBuffer(file.buffer, file.originalname);
          parsed.push(result);
        } catch (err: any) {
          console.warn(`Failed to parse ${file.originalname}:`, err.message);
        }
      }

      if (parsed.length === 0) {
        return res.status(400).send("ไม่สามารถอ่านไฟล์ CSV ได้");
      }

      const result = await importParsedDataToDb(parsed, (req.user as any)?.id);
      return res.json(result);
    } catch (err: any) {
      console.error("Legacy import-to-db error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.post("/api/legacy-import/import-zip-to-db", upload.single("zipFile"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const file = req.file;
      if (!file) {
        return res.status(400).send("ไม่พบไฟล์ ZIP");
      }

      const zip = await JSZip.loadAsync(file.buffer);
      const parsed: ParsedCSV[] = [];

      const csvEntries = Object.entries(zip.files).filter(([name]) =>
        name.endsWith(".csv") && !name.startsWith("__MACOSX")
      );

      if (csvEntries.length > 0) {
        for (const [name, entry] of csvEntries) {
          if (entry.dir) continue;
          try {
            const buffer = Buffer.from(await entry.async("nodebuffer"));
            const result = parseCSVBuffer(buffer, name.split("/").pop() || name);
            parsed.push(result);
          } catch (err: any) {
            console.warn(`Failed to parse CSV ${name} from ZIP:`, err.message);
          }
        }
      } else {
        const manifestFile = zip.file("manifest.json");
        if (!manifestFile) {
          return res.status(400).send("ZIP ไม่ถูกต้อง — ไม่พบไฟล์ CSV หรือ manifest.json");
        }
        const manifest = JSON.parse(await manifestFile.async("string"));
        for (const tbl of (manifest.tables || [])) {
          const dataFile = zip.file(`data/${tbl.name}.json`);
          if (dataFile) {
            try {
              const data = JSON.parse(await dataFile.async("string"));
              parsed.push({
                filename: `${tbl.name}.json`,
                tableName: tbl.name,
                columns: data.columns || (data.rows?.[0] ? Object.keys(data.rows[0]) : []),
                rows: data.rows || [],
              });
            } catch (err: any) {
              console.warn(`Failed to parse JSON table ${tbl.name} from ZIP:`, err.message);
            }
          }
        }
      }

      if (parsed.length === 0) {
        return res.status(400).send("ไม่พบข้อมูลใน ZIP ที่สามารถนำเข้าได้");
      }

      const result = await importParsedDataToDb(parsed, (req.user as any)?.id);
      return res.json(result);
    } catch (err: any) {
      console.error("Legacy import-zip-to-db error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/companies", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const user = req.user as any;
      const isSuperAdmin = user?.role === "super_admin";

      let rows;
      if (isSuperAdmin) {
        rows = await db.select().from(legacyCompanies).orderBy(sql`${legacyCompanies.importedAt} DESC`);
      } else {
        rows = await db.select().from(legacyCompanies)
          .where(eq(legacyCompanies.importedBy, user.id))
          .orderBy(sql`${legacyCompanies.importedAt} DESC`);
      }
      return res.json(rows);
    } catch (err: any) {
      console.error("Legacy companies list error:", err);
      return res.status(500).send(err.message);
    }
  });

  async function verifyLegacyCompanyAccess(req: Request, legacyCompanyId: number): Promise<boolean> {
    const user = req.user as any;
    if (!user) return false;
    if (user.role === "super_admin") return true;
    const [company] = await db.select({ id: legacyCompanies.id })
      .from(legacyCompanies)
      .where(eq(legacyCompanies.id, legacyCompanyId))
      .limit(1);
    if (!company) return false;
    const [owned] = await db.select({ id: legacyCompanies.id })
      .from(legacyCompanies)
      .where(sql`${legacyCompanies.id} = ${legacyCompanyId} AND ${legacyCompanies.importedBy} = ${user.id}`)
      .limit(1);
    return !!owned;
  }

  app.get("/api/legacy-import/chart-of-accounts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const legacyCompanyId = parseInt(req.query.legacyCompanyId as string);
      if (!legacyCompanyId) {
        return res.status(400).send("กรุณาระบุ legacyCompanyId");
      }

      const hasAccess = await verifyLegacyCompanyAccess(req, legacyCompanyId);
      if (!hasAccess) {
        return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }

      const rows = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, legacyCompanyId));
      return res.json(rows);
    } catch (err: any) {
      console.error("Legacy chart-of-accounts error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/contacts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const legacyCompanyId = parseInt(req.query.legacyCompanyId as string);
      if (!legacyCompanyId) {
        return res.status(400).send("กรุณาระบุ legacyCompanyId");
      }

      const hasAccess = await verifyLegacyCompanyAccess(req, legacyCompanyId);
      if (!hasAccess) {
        return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }

      const rows = await db.select().from(legacyContacts).where(eq(legacyContacts.legacyCompanyId, legacyCompanyId));
      return res.json(rows);
    } catch (err: any) {
      console.error("Legacy contacts error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const legacyCompanyId = parseInt(req.query.legacyCompanyId as string);
      const docType = req.query.docType as string;
      if (!legacyCompanyId || !docType) {
        return res.status(400).send("กรุณาระบุ legacyCompanyId และ docType");
      }

      const hasAccess = await verifyLegacyCompanyAccess(req, legacyCompanyId);
      if (!hasAccess) {
        return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }

      const rows = await db.select().from(legacyDocuments)
        .where(sql`${legacyDocuments.legacyCompanyId} = ${legacyCompanyId} AND ${legacyDocuments.docType} = ${docType}`)
        .orderBy(sql`${legacyDocuments.docDate} DESC NULLS LAST, ${legacyDocuments.id} DESC`);
      return res.json(rows);
    } catch (err: any) {
      console.error("Legacy documents error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/documents/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const id = parseInt(req.params.id);
      if (!id) return res.status(400).send("Invalid ID");

      const [doc] = await db.select().from(legacyDocuments).where(eq(legacyDocuments.id, id)).limit(1);
      if (!doc) return res.status(404).send("ไม่พบเอกสาร");

      const hasAccess = await verifyLegacyCompanyAccess(req, doc.legacyCompanyId);
      if (!hasAccess) {
        return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }

      const items = await db.select().from(legacyDocumentItems)
        .where(eq(legacyDocumentItems.legacyDocumentId, id))
        .orderBy(legacyDocumentItems.lineNo);

      return res.json({ document: doc, items });
    } catch (err: any) {
      console.error("Legacy document detail error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.delete("/api/legacy-import/companies/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const id = parseInt(req.params.id);
      if (!id) return res.status(400).send("Invalid ID");

      const hasAccess = await verifyLegacyCompanyAccess(req, id);
      if (!hasAccess) {
        return res.status(403).send("ไม่มีสิทธิ์ลบข้อมูลนี้");
      }

      await db.delete(legacyCompanies).where(eq(legacyCompanies.id, id));

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Legacy company delete error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.post("/api/legacy-import/read-zip", upload.single("zipFile"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const file = req.file;
      if (!file) {
        return res.status(400).send("ไม่พบไฟล์ ZIP");
      }

      const zip = await JSZip.loadAsync(file.buffer);
      const manifestFile = zip.file("manifest.json");

      if (manifestFile) {
        const manifest = JSON.parse(await manifestFile.async("string"));

        let companyId = manifest.companyId || "";
        let companyName = manifest.companyName || "";

        if (!companyName || companyName === "unknown") {
          const settingsNames = ["company_setting", "companysetting"];
          for (const tbl of (manifest.tables || [])) {
            const baseName = tbl.name.replace(/_p\d+of\d+.*$/i, "");
            if (settingsNames.some(s => baseName.toLowerCase().includes(s))) {
              const dataFile = zip.file(`data/${tbl.name}.json`);
              if (dataFile) {
                try {
                  const data = JSON.parse(await dataFile.async("string"));
                  if (data.rows && data.rows.length > 0) {
                    const row = data.rows[0];
                    const nameKeys = ["company_name", "companyName", "name_th", "name", "company_name_th"];
                    const idKeys = ["id", "company_id", "companyId"];
                    for (const k of nameKeys) { if (row[k]?.trim()) { companyName = row[k].trim(); break; } }
                    if (!companyId) { for (const k of idKeys) { if (row[k]?.trim()) { companyId = row[k].trim(); break; } } }
                  }
                } catch {}
              }
              break;
            }
          }
        }

        return res.json({
          companyId,
          companyName,
          tables: (manifest.tables || []).map((t: any) => ({
            name: t.name,
            rowCount: t.rowCount,
            columns: t.columns,
          })),
          totalRows: manifest.totalRows || 0,
        });
      }

      const csvEntries = Object.entries(zip.files).filter(([name]) =>
        name.endsWith(".csv") && !name.startsWith("__MACOSX") && !zip.files[name].dir
      );

      if (csvEntries.length === 0) {
        return res.status(400).send("ZIP ไม่ถูกต้อง — ไม่พบไฟล์ CSV หรือ manifest.json");
      }

      const parsed: ParsedCSV[] = [];
      for (const [name, entry] of csvEntries) {
        try {
          const buffer = Buffer.from(await entry.async("nodebuffer"));
          const result = parseCSVBuffer(buffer, name.split("/").pop() || name);
          parsed.push(result);
        } catch (err: any) {
          console.warn(`Failed to parse CSV ${name} from ZIP:`, err.message);
        }
      }

      if (parsed.length === 0) {
        return res.status(400).send("ไม่สามารถอ่านไฟล์ CSV จาก ZIP ได้");
      }

      const merged = mergePaginatedTables(parsed);
      const companyInfo = extractCompanyInfo(merged);
      const dateRange = getDateRange(merged);
      const totalRows = merged.reduce((sum, t) => sum + t.rows.length, 0);

      return res.json({
        companyId: companyInfo.companyId || "",
        companyName: companyInfo.companyName || "",
        dateRange,
        tables: merged.map(t => ({
          name: t.tableName,
          rowCount: t.rows.length,
          columns: t.columns,
        })),
        totalRows,
      });
    } catch (err: any) {
      console.error("Legacy import read-zip error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.post("/api/legacy-import/read-zip-table", upload.single("zipFile"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) {
        return res.status(401).send("Unauthorized");
      }

      const file = req.file;
      if (!file) {
        return res.status(400).send("ไม่พบไฟล์ ZIP");
      }

      const tableName = req.body.tableName;
      const page = parseInt(req.body.page || "1");
      const search = (req.body.search || "").toLowerCase();
      const allRows = req.body.all === "true";
      const pageSize = allRows ? 10000 : 50;

      if (!tableName) {
        return res.status(400).send("กรุณาระบุชื่อตาราง");
      }

      const zip = await JSZip.loadAsync(file.buffer);
      const dataFile = zip.file(`data/${tableName}.json`);
      if (!dataFile) {
        return res.status(404).send(`ไม่พบตาราง ${tableName} ใน ZIP`);
      }

      const tableData = JSON.parse(await dataFile.async("string"));
      let rows: Record<string, string>[] = tableData.rows || [];

      if (search) {
        rows = rows.filter(row =>
          Object.values(row).some(v =>
            String(v).toLowerCase().includes(search)
          )
        );
      }

      const totalRows = rows.length;
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
      const safePage = Math.max(1, Math.min(page, totalPages));
      const start = (safePage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);

      return res.json({
        name: tableName,
        columns: tableData.columns || [],
        rows: pageRows,
        totalRows,
        page: safePage,
        totalPages,
      });
    } catch (err: any) {
      console.error("Legacy import read-zip-table error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/gl-entries", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const search = (req.query.search as string || "").trim();
      const page = parseInt(req.query.page as string || "1");
      const pageSize = 30;

      let conditions = sql`${legacyGlEntries.legacyCompanyId} = ${companyId}`;
      if (search) {
        conditions = sql`${conditions} AND (
          ${legacyGlEntries.glNo} ILIKE ${'%' + search + '%'} OR
          ${legacyGlEntries.description} ILIKE ${'%' + search + '%'} OR
          ${legacyGlEntries.reference} ILIKE ${'%' + search + '%'}
        )`;
      }

      const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyGlEntries).where(conditions);
      const total = countResult?.count || 0;
      const entries = await db.select().from(legacyGlEntries).where(conditions).orderBy(desc(legacyGlEntries.glDate), desc(legacyGlEntries.id)).limit(pageSize).offset((page - 1) * pageSize);

      return res.json({ entries, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    } catch (err: any) {
      console.error("Legacy GL entries error:", err);
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/gl-entry/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const id = parseInt(req.params.id);
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!id) return res.status(400).send("Invalid id");
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");

      const [entry] = await db.select().from(legacyGlEntries).where(and(eq(legacyGlEntries.id, id), eq(legacyGlEntries.legacyCompanyId, companyId))).limit(1);
      if (!entry) return res.status(404).send("Not found");

      const lines = await db.select().from(legacyGlLines).where(and(eq(legacyGlLines.legacyGlEntryId, id), eq(legacyGlLines.legacyCompanyId, companyId))).orderBy(asc(legacyGlLines.id));
      return res.json({ entry, lines });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/gl-lines", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const accountCode = req.query.accountCode as string || "";
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      let conditions = sql`${legacyGlLines.legacyCompanyId} = ${companyId}`;
      if (accountCode) {
        conditions = sql`${conditions} AND ${legacyGlLines.accountCode} = ${accountCode}`;
      }
      if (startDate) {
        conditions = sql`${conditions} AND ${legacyGlLines.glDate} >= ${startDate}`;
      }
      if (endDate) {
        conditions = sql`${conditions} AND ${legacyGlLines.glDate} <= ${endDate}`;
      }

      const lines = await db.select().from(legacyGlLines).where(conditions).orderBy(asc(legacyGlLines.glDate), asc(legacyGlLines.id));
      return res.json(lines);
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/reports/trial-balance", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      const allLines = await db.select({
        accountCode: legacyGlLines.accountCode,
        accountName: legacyGlLines.accountName,
        debit: legacyGlLines.debit,
        credit: legacyGlLines.credit,
        glDate: legacyGlLines.glDate,
      }).from(legacyGlLines).where(eq(legacyGlLines.legacyCompanyId, companyId));

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, companyId));
      const acctMap: Record<string, { name: string; type: string }> = {};
      for (const a of accounts) {
        if (a.accountCode) acctMap[a.accountCode] = { name: a.accountName || "", type: a.accountType || "" };
      }

      const tbMap: Record<string, { openingDebit: number; openingCredit: number; movementDebit: number; movementCredit: number }> = {};

      for (const line of allLines) {
        const code = line.accountCode || "unknown";
        if (!tbMap[code]) tbMap[code] = { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0 };
        const dr = parseFloat(line.debit || "0") || 0;
        const cr = parseFloat(line.credit || "0") || 0;
        const d = line.glDate || "";

        if (startDate && d < startDate) {
          tbMap[code].openingDebit += dr;
          tbMap[code].openingCredit += cr;
        } else if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
          tbMap[code].movementDebit += dr;
          tbMap[code].movementCredit += cr;
        }
      }

      const rows = Object.entries(tbMap)
        .filter(([_, v]) => v.openingDebit || v.openingCredit || v.movementDebit || v.movementCredit)
        .map(([code, v]) => {
          const acct = acctMap[code];
          const closingDebit = v.openingDebit + v.movementDebit;
          const closingCredit = v.openingCredit + v.movementCredit;
          return {
            accountCode: code,
            accountName: acct?.name || code,
            accountType: acct?.type || "",
            openingDebit: v.openingDebit,
            openingCredit: v.openingCredit,
            movementDebit: v.movementDebit,
            movementCredit: v.movementCredit,
            closingDebit,
            closingCredit,
          };
        })
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      const totals = rows.reduce((t, r) => ({
        openingDebit: t.openingDebit + r.openingDebit,
        openingCredit: t.openingCredit + r.openingCredit,
        movementDebit: t.movementDebit + r.movementDebit,
        movementCredit: t.movementCredit + r.movementCredit,
        closingDebit: t.closingDebit + r.closingDebit,
        closingCredit: t.closingCredit + r.closingCredit,
      }), { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 });

      return res.json({ rows, totals });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/reports/general-ledger", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const accountCode = req.query.accountCode as string || "";
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      let conditions = sql`${legacyGlLines.legacyCompanyId} = ${companyId}`;
      if (accountCode) conditions = sql`${conditions} AND ${legacyGlLines.accountCode} = ${accountCode}`;

      const allLines = await db.select().from(legacyGlLines).where(conditions).orderBy(asc(legacyGlLines.glDate), asc(legacyGlLines.id));

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, companyId));
      const acctMap: Record<string, { name: string; type: string; normalBalance: string }> = {};
      for (const a of accounts) {
        if (a.accountCode) acctMap[a.accountCode] = { name: a.accountName || "", type: a.accountType || "", normalBalance: a.normalBalance || "debit" };
      }

      const grouped: Record<string, typeof allLines> = {};
      for (const line of allLines) {
        const code = line.accountCode || "unknown";
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(line);
      }

      const result = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([code, lines]) => {
        const acct = acctMap[code];
        const isDebitNormal = !acct?.type || ["asset", "expense"].includes(acct.type) || acct.normalBalance === "debit";

        let beginBalance = 0;
        const periodLines: any[] = [];

        for (const line of lines) {
          const d = line.glDate || "";
          const dr = parseFloat(line.debit || "0") || 0;
          const cr = parseFloat(line.credit || "0") || 0;

          if (startDate && d < startDate) {
            beginBalance += isDebitNormal ? (dr - cr) : (cr - dr);
          } else if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
            periodLines.push({
              entryDate: d,
              reference: line.glNo || line.reference || "",
              entryDescription: line.description || "",
              journalBook: line.journalBook || "",
              debit: dr,
              credit: cr,
            });
          }
        }

        let runningBalance = beginBalance;
        const computedLines = periodLines.map(l => {
          runningBalance += isDebitNormal ? (l.debit - l.credit) : (l.credit - l.debit);
          return { ...l, balance: runningBalance };
        });

        return {
          accountCode: code,
          accountName: acct?.name || code,
          beginBalance,
          endBalance: runningBalance,
          lines: computedLines,
        };
      }).filter(a => a.beginBalance !== 0 || a.lines.length > 0);

      return res.json(result);
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/reports/income-statement", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      let conditions = sql`${legacyGlLines.legacyCompanyId} = ${companyId}`;
      if (startDate) conditions = sql`${conditions} AND ${legacyGlLines.glDate} >= ${startDate}`;
      if (endDate) conditions = sql`${conditions} AND ${legacyGlLines.glDate} <= ${endDate}`;

      const lines = await db.select({
        accountCode: legacyGlLines.accountCode,
        accountName: legacyGlLines.accountName,
        debit: legacyGlLines.debit,
        credit: legacyGlLines.credit,
      }).from(legacyGlLines).where(conditions);

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, companyId));
      const acctMap: Record<string, { name: string; type: string }> = {};
      for (const a of accounts) {
        if (a.accountCode) acctMap[a.accountCode] = { name: a.accountName || "", type: a.accountType || "" };
      }

      const balMap: Record<string, { debit: number; credit: number }> = {};
      for (const line of lines) {
        const code = line.accountCode || "";
        if (!balMap[code]) balMap[code] = { debit: 0, credit: 0 };
        balMap[code].debit += parseFloat(line.debit || "0") || 0;
        balMap[code].credit += parseFloat(line.credit || "0") || 0;
      }

      const revenues: any[] = [];
      const expenses: any[] = [];
      for (const [code, bal] of Object.entries(balMap)) {
        const acct = acctMap[code];
        const type = acct?.type || "";
        const balance = type === "revenue" ? (bal.credit - bal.debit) : (bal.debit - bal.credit);
        if (balance === 0 && type !== "revenue" && type !== "expense") continue;
        const row = { code, name: acct?.name || code, nameTh: acct?.name || code, balance, totalDebit: bal.debit, totalCredit: bal.credit };
        if (type === "revenue" || code.startsWith("4")) revenues.push(row);
        else if (type === "expense" || code.startsWith("5")) expenses.push(row);
      }

      revenues.sort((a, b) => a.code.localeCompare(b.code));
      expenses.sort((a, b) => a.code.localeCompare(b.code));

      const totalRevenue = revenues.reduce((s, r) => s + r.balance, 0);
      const totalExpense = expenses.reduce((s, r) => s + r.balance, 0);

      return res.json({ revenues, expenses, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/reports/balance-sheet", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const asOfDate = req.query.asOfDate as string || "";

      let conditions = sql`${legacyGlLines.legacyCompanyId} = ${companyId}`;
      if (asOfDate) conditions = sql`${conditions} AND ${legacyGlLines.glDate} <= ${asOfDate}`;

      const lines = await db.select({
        accountCode: legacyGlLines.accountCode,
        accountName: legacyGlLines.accountName,
        debit: legacyGlLines.debit,
        credit: legacyGlLines.credit,
      }).from(legacyGlLines).where(conditions);

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, companyId));
      const acctMap: Record<string, { name: string; type: string }> = {};
      for (const a of accounts) {
        if (a.accountCode) acctMap[a.accountCode] = { name: a.accountName || "", type: a.accountType || "" };
      }

      const balMap: Record<string, { debit: number; credit: number }> = {};
      for (const line of lines) {
        const code = line.accountCode || "";
        if (!balMap[code]) balMap[code] = { debit: 0, credit: 0 };
        balMap[code].debit += parseFloat(line.debit || "0") || 0;
        balMap[code].credit += parseFloat(line.credit || "0") || 0;
      }

      const assets: any[] = [];
      const liabilities: any[] = [];
      const equity: any[] = [];

      for (const [code, bal] of Object.entries(balMap)) {
        const acct = acctMap[code];
        const type = acct?.type || "";
        let balance: number;
        if (type === "asset" || code.startsWith("1")) {
          balance = bal.debit - bal.credit;
          if (balance !== 0) assets.push({ code, name: acct?.name || code, nameTh: acct?.name || code, balance });
        } else if (type === "liability" || code.startsWith("2")) {
          balance = bal.credit - bal.debit;
          if (balance !== 0) liabilities.push({ code, name: acct?.name || code, nameTh: acct?.name || code, balance });
        } else if (type === "equity" || code.startsWith("3")) {
          balance = bal.credit - bal.debit;
          if (balance !== 0) equity.push({ code, name: acct?.name || code, nameTh: acct?.name || code, balance });
        }
      }

      const revExpLines = Object.entries(balMap).filter(([code]) => {
        const type = acctMap[code]?.type || "";
        return type === "revenue" || type === "expense" || code.startsWith("4") || code.startsWith("5");
      });
      let retainedEarnings = 0;
      for (const [code, bal] of revExpLines) {
        const type = acctMap[code]?.type || "";
        if (type === "revenue" || code.startsWith("4")) retainedEarnings += bal.credit - bal.debit;
        else retainedEarnings -= bal.debit - bal.credit;
      }
      if (retainedEarnings !== 0) {
        equity.push({ code: "RE", name: "กำไร(ขาดทุน)สะสม", nameTh: "กำไร(ขาดทุน)สะสม", balance: retainedEarnings });
      }

      assets.sort((a, b) => a.code.localeCompare(b.code));
      liabilities.sort((a, b) => a.code.localeCompare(b.code));
      equity.sort((a, b) => a.code.localeCompare(b.code));

      const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
      const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
      const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

      return res.json({
        assets, liabilities, equity,
        totalAssets, totalLiabilities, totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/reports/tax-summary", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      let conditions = sql`${legacyGlLines.legacyCompanyId} = ${companyId}`;
      if (startDate) conditions = sql`${conditions} AND ${legacyGlLines.glDate} >= ${startDate}`;
      if (endDate) conditions = sql`${conditions} AND ${legacyGlLines.glDate} <= ${endDate}`;

      const lines = await db.select({
        accountCode: legacyGlLines.accountCode,
        accountName: legacyGlLines.accountName,
        debit: legacyGlLines.debit,
        credit: legacyGlLines.credit,
        glDate: legacyGlLines.glDate,
        glNo: legacyGlLines.glNo,
        description: legacyGlLines.description,
      }).from(legacyGlLines).where(conditions);

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, companyId));
      const acctMap: Record<string, string> = {};
      for (const a of accounts) {
        if (a.accountCode) acctMap[a.accountCode] = a.accountName || "";
      }

      const vatOutputLines = lines.filter(l => {
        const code = l.accountCode || "";
        const name = (acctMap[code] || l.accountName || "").toLowerCase();
        return name.includes("ภาษีขาย") || name.includes("vat output") || name.includes("output vat") || name.includes("output tax");
      });

      const vatInputLines = lines.filter(l => {
        const code = l.accountCode || "";
        const name = (acctMap[code] || l.accountName || "").toLowerCase();
        return name.includes("ภาษีซื้อ") || name.includes("vat input") || name.includes("input vat") || name.includes("input tax");
      });

      const whtLines = lines.filter(l => {
        const code = l.accountCode || "";
        const name = (acctMap[code] || l.accountName || "").toLowerCase();
        return name.includes("ภาษีหัก") || name.includes("withholding") || name.includes("wht") || name.includes("หัก ณ ที่จ่าย");
      });

      const totalOutputVat = vatOutputLines.reduce((s, l) => s + (parseFloat(l.credit || "0") || 0) - (parseFloat(l.debit || "0") || 0), 0);
      const totalInputVat = vatInputLines.reduce((s, l) => s + (parseFloat(l.debit || "0") || 0) - (parseFloat(l.credit || "0") || 0), 0);
      const totalWht = whtLines.reduce((s, l) => s + (parseFloat(l.debit || "0") || 0) - (parseFloat(l.credit || "0") || 0), 0);

      return res.json({
        vatOutput: { total: totalOutputVat, lines: vatOutputLines.slice(0, 500) },
        vatInput: { total: totalInputVat, lines: vatInputLines.slice(0, 500) },
        wht: { total: totalWht, lines: whtLines.slice(0, 500) },
        netVat: totalOutputVat - totalInputVat,
      });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/companies/:id/archive", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const id = parseInt(req.params.id);
      if (!id) return res.status(400).send("Invalid ID");
      const hasAccess = await verifyLegacyCompanyAccess(req, id);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");

      const [company] = await db.select().from(legacyCompanies).where(eq(legacyCompanies.id, id)).limit(1);
      if (!company) return res.status(404).send("ไม่พบบริษัท");

      const accounts = await db.select().from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, id));
      const contacts = await db.select().from(legacyContacts).where(eq(legacyContacts.legacyCompanyId, id));
      const documents = await db.select().from(legacyDocuments).where(eq(legacyDocuments.legacyCompanyId, id));
      const docIds = documents.map(d => d.id);
      let documentItems: any[] = [];
      if (docIds.length > 0) {
        for (let i = 0; i < docIds.length; i += 500) {
          const batch = docIds.slice(i, i + 500);
          const items = await db.select().from(legacyDocumentItems).where(sql`${legacyDocumentItems.legacyDocumentId} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
          documentItems.push(...items);
        }
      }
      const glEntries = await db.select().from(legacyGlEntries).where(eq(legacyGlEntries.legacyCompanyId, id));
      const glLines = await db.select().from(legacyGlLines).where(eq(legacyGlLines.legacyCompanyId, id));

      const tables: { name: string; columns: string[]; rows: any[]; rowCount: number }[] = [];

      if (accounts.length > 0) {
        const rows = accounts.map(a => a.rawData || { account_code: a.accountCode, account_name: a.accountName, account_type: a.accountType, parent_code: a.parentCode, level: String(a.level), is_header: String(a.isHeader), normal_balance: a.normalBalance, category: a.category });
        tables.push({ name: "chart_of_account", columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows, rowCount: rows.length });
      }
      if (contacts.length > 0) {
        const rows = contacts.map(c => c.rawData || { contact_code: c.contactCode, contact_name: c.contactName, contact_type: c.contactType, tax_id: c.taxId, branch_no: c.branchNo, address: c.address, phone: c.phone, email: c.email });
        tables.push({ name: "contact", columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows, rowCount: rows.length });
      }

      const docTypes = [...new Set(documents.map(d => d.docType))];
      for (const dt of docTypes) {
        const dtDocs = documents.filter(d => d.docType === dt);
        const rows = dtDocs.map(d => d.rawData || { doc_no: d.docNo, doc_date: d.docDate, contact_name: d.contactName, grand_total: d.grandTotal, subtotal: d.subtotal, vat_amount: d.vatAmount, status: d.status, description: d.description });
        tables.push({ name: dt, columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows, rowCount: rows.length });

        const dtItems = documentItems.filter(it => dtDocs.some(d => d.id === it.legacyDocumentId));
        if (dtItems.length > 0) {
          const docIdMap = new Map(dtDocs.map(d => [d.id, d.docNo]));
          const itemRows = dtItems.map(it => {
            if (it.rawData) return it.rawData;
            const parentDocNo = docIdMap.get(it.legacyDocumentId) || "";
            return { doc_no: parentDocNo, item_code: it.itemCode, item_name: it.itemName, description: it.description, quantity: it.quantity, unit_price: it.unitPrice, amount: it.amount, unit: it.unit };
          });
          tables.push({ name: `${dt}_item`, columns: itemRows.length > 0 ? Object.keys(itemRows[0]) : [], rows: itemRows, rowCount: itemRows.length });
        }
      }

      if (glEntries.length > 0) {
        const rows = glEntries.map(e => e.rawData || { gl_no: e.glNo, gl_date: e.glDate, description: e.description, reference: e.reference, journal_book: e.journalBook, total_debit: e.totalDebit, total_credit: e.totalCredit, status: e.status });
        tables.push({ name: "gl", columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows, rowCount: rows.length });
      }
      if (glLines.length > 0) {
        const rows = glLines.map(l => l.rawData || { gl_no: l.glNo, gl_date: l.glDate, account_code: l.accountCode, account_name: l.accountName, debit: l.debit, credit: l.credit, description: l.description, reference: l.reference, journal_book: l.journalBook });
        tables.push({ name: "gl_tran", columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows, rowCount: rows.length });
      }

      const companySettingRow: Record<string, string> = {
        id: company.sourceId || String(company.id),
        company_name: company.name || "",
        tax_id: company.taxId || "",
        address: company.address || "",
        phone: company.phone || "",
        email: company.email || "",
      };
      tables.unshift({ name: "company_setting", columns: Object.keys(companySettingRow), rows: [companySettingRow], rowCount: 1 });

      const manifest = {
        version: "1.0",
        source: "E-Tax Center Archive",
        exportedAt: new Date().toISOString(),
        companyId: company.sourceId || String(company.id),
        companyName: company.name,
        tables: tables.map(t => ({ name: t.name, filename: `${t.name}.json`, rowCount: t.rowCount, columns: t.columns })),
        totalRows: tables.reduce((s, t) => s + t.rowCount, 0),
        dateRange: { from: company.dateRangeFrom || "-", to: company.dateRangeTo || "-" },
      };

      const safeName = (company.name || "company").replace(/[^ก-๙a-zA-Z0-9]/g, "_").substring(0, 50);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="Archive_${company.sourceId || company.id}_${safeName}.zip"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      for (const table of tables) {
        archive.append(JSON.stringify({ tableName: table.name, columns: table.columns, rowCount: table.rowCount, rows: table.rows }), { name: `data/${table.name}.json` });
      }
      await archive.finalize();
    } catch (err: any) {
      console.error("Legacy archive error:", err);
      if (!res.headersSent) return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/companies/:id/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const id = parseInt(req.params.id);
      if (!id) return res.status(400).send("Invalid ID");
      const hasAccess = await verifyLegacyCompanyAccess(req, id);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");

      const [accounts] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyChartOfAccounts).where(eq(legacyChartOfAccounts.legacyCompanyId, id));
      const [contactsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyContacts).where(eq(legacyContacts.legacyCompanyId, id));
      const [docsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyDocuments).where(eq(legacyDocuments.legacyCompanyId, id));
      const [glCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyGlEntries).where(eq(legacyGlEntries.legacyCompanyId, id));
      const [glLineCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyGlLines).where(eq(legacyGlLines.legacyCompanyId, id));

      return res.json({
        accounts: accounts?.count || 0,
        contacts: contactsCount?.count || 0,
        documents: docsCount?.count || 0,
        glEntries: glCount?.count || 0,
        glLines: glLineCount?.count || 0,
      });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });

  app.get("/api/legacy-import/gl-summary", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
      const companyId = parseInt(req.query.legacyCompanyId as string);
      if (!companyId) return res.status(400).send("Missing legacyCompanyId");
      const hasAccess = await verifyLegacyCompanyAccess(req, companyId);
      if (!hasAccess) return res.status(403).send("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");

      const [entryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyGlEntries).where(eq(legacyGlEntries.legacyCompanyId, companyId));
      const [lineCount] = await db.select({ count: sql<number>`count(*)::int` }).from(legacyGlLines).where(eq(legacyGlLines.legacyCompanyId, companyId));

      return res.json({ entries: entryCount?.count || 0, lines: lineCount?.count || 0 });
    } catch (err: any) {
      return res.status(500).send(err.message);
    }
  });
}
