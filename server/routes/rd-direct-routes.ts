import type { Express } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { companies, taxInvoices, purchaseInvoices, expenses, withholdingTaxCerts } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import { utf8ToTis620, formatThaiDate, cleanTaxId, formatBranch, fmtAmount } from "../utils/tis620";

export function registerRdDirectRoutes(app: Express) {

  app.get("/api/rd-direct/pp30", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const salesRows = await db.select().from(taxInvoices)
        .where(and(
          eq(taxInvoices.companyId, companyId),
          sql`${taxInvoices.taxInvoiceDate} >= ${startDate}`,
          sql`${taxInvoices.taxInvoiceDate} <= ${endDate}`,
          sql`${taxInvoices.status} != 'cancelled'`,
        ));

      const piRows = await db.select().from(purchaseInvoices)
        .where(and(
          eq(purchaseInvoices.companyId, companyId),
          sql`${purchaseInvoices.apDate} >= ${startDate}`,
          sql`${purchaseInvoices.apDate} <= ${endDate}`,
          sql`${purchaseInvoices.status} != 'cancelled'`,
          eq(purchaseInvoices.showInTaxReport, true),
        ));

      const expRows = await db.select().from(expenses)
        .where(and(
          eq(expenses.companyId, companyId),
          sql`${expenses.expDate} >= ${startDate}`,
          sql`${expenses.expDate} <= ${endDate}`,
          sql`${expenses.status} != 'cancelled'`,
          eq(expenses.showInTaxReport, true),
        ));

      const taxId = cleanTaxId(company.taxId);
      const branch = formatBranch(company.branch);
      const beYear = String(year + 543);
      const monthStr = String(month).padStart(2, "0");

      const salesTaxBase = salesRows.reduce((s, r) => s + parseFloat(r.subtotal || "0"), 0);
      const salesVat = salesRows.reduce((s, r) => s + parseFloat(r.vatAmount || "0"), 0);
      const piTaxBase = piRows.reduce((s, r) => s + parseFloat(r.subtotal || "0"), 0);
      const piVat = piRows.reduce((s, r) => s + parseFloat(r.vatAmount || "0"), 0);
      const expTaxBase = expRows.reduce((s, r) => s + parseFloat(r.subtotal || "0"), 0);
      const expVat = expRows.reduce((s, r) => s + parseFloat(r.vatAmount || "0"), 0);
      const purchaseTaxBase = piTaxBase + expTaxBase;
      const purchaseVat = piVat + expVat;
      const netVat = salesVat - purchaseVat;

      const fields = [
        taxId,
        branch,
        beYear,
        monthStr,
        "1",
        "1",
        fmtAmount(salesTaxBase),
        fmtAmount(salesVat),
        fmtAmount(purchaseTaxBase),
        fmtAmount(purchaseVat),
        fmtAmount(Math.abs(netVat)),
        netVat >= 0 ? "1" : "2",
      ];

      const content = fields.join("|");
      const tis620Buffer = utf8ToTis620(content);
      const fileName = `PP30_${beYear}_${monthStr}.txt`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(tis620Buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rd-direct/pnd3", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const month = String(req.query.month || "");
      const year = String(req.query.year || "");
      if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const beYear = Number(year);
      const ceYear = beYear - 543;
      const monthNum = Number(month);
      const startDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-01`;
      const lastDay = new Date(ceYear, monthNum, 0).getDate();
      const endDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const rows = await db.select().from(withholdingTaxCerts)
        .where(and(
          eq(withholdingTaxCerts.companyId, companyId),
          sql`${withholdingTaxCerts.paidDate} >= ${startDate}`,
          sql`${withholdingTaxCerts.paidDate} <= ${endDate}`,
          sql`${withholdingTaxCerts.status} != 'cancelled'`,
          eq(withholdingTaxCerts.formType, "pnd3"),
        ))
        .orderBy(withholdingTaxCerts.paidDate);

      if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูล ภ.ง.ด.3 ในช่วงเดือนที่เลือก" });

      const companyTaxId = cleanTaxId(company.taxId);
      const companyTin = companyTaxId.substring(0, 10);
      const companyBranch = formatBranch(company.branch);

      const lines: string[] = [];
      for (const cert of rows) {
        const payeeTaxId = cleanTaxId(cert.payeeTaxId);
        const payeeTin = payeeTaxId.substring(0, 10);
        const payeeBranch = formatBranch(cert.payeeBranch, 4);
        const nameParts = (cert.payeeName || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const fields = [
          companyTaxId,                          // 1: pin
          companyTaxId,                          // 2: nid
          companyTin,                            // 3: tin
          companyBranch,                         // 4: branchid
          "1",                                   // 5: indcsubmit
          "1",                                   // 6: submitno
          "1",                                   // 7: sendtype1
          "0",                                   // 8: sendtype2
          "0",                                   // 9: sendtype3
          String(beYear),                        // 10: totincyear
          String(monthNum).padStart(2, "0"),      // 11: totincmonth
          payeeTaxId,                            // 12: Rev_pin
          payeeTin,                              // 13: rcv_tin
          payeeBranch,                           // 14: branchid (4 digits)
          "",                                    // 15: v_description
          firstName,                             // 16: fName
          lastName,                              // 17: lName
          "",                                    // 18: buildname
          "",                                    // 19: mooName
          "",                                    // 20: roomNo
          "",                                    // 21: floorNo
          "",                                    // 22: addNum
          "",                                    // 23: mooNo
          "",                                    // 24: trokSoi
          "",                                    // 25: street
          "",                                    // 26: tumbolName
          "",                                    // 27: amphurName
          "",                                    // 28: provinceName
          "",                                    // 29: postcode
          "",                                    // 30: telnum
          formatThaiDate(cert.paidDate),         // 31: paydate
          cert.incomeDescription || cert.incomeType || "", // 32: inctype
          fmtAmount(cert.taxRate),               // 33: taxrate
          fmtAmount(cert.amountPaid),            // 34: payamt
          fmtAmount(cert.taxWithheld),           // 35: taxamt
          cert.whtCondition || "1",              // 36: proviso
          cert.notes || "",                      // 37: notes
        ];
        lines.push(fields.join("|"));
      }

      const content = lines.join("\r\n");
      const tis620Buffer = utf8ToTis620(content);
      const fileName = `PND3_${year}_${String(monthNum).padStart(2, "0")}.txt`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(tis620Buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rd-direct/pnd53", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const month = String(req.query.month || "");
      const year = String(req.query.year || "");
      if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const beYear = Number(year);
      const ceYear = beYear - 543;
      const monthNum = Number(month);
      const startDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-01`;
      const lastDay = new Date(ceYear, monthNum, 0).getDate();
      const endDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const rows = await db.select().from(withholdingTaxCerts)
        .where(and(
          eq(withholdingTaxCerts.companyId, companyId),
          sql`${withholdingTaxCerts.paidDate} >= ${startDate}`,
          sql`${withholdingTaxCerts.paidDate} <= ${endDate}`,
          sql`${withholdingTaxCerts.status} != 'cancelled'`,
          eq(withholdingTaxCerts.formType, "pnd53"),
        ))
        .orderBy(withholdingTaxCerts.paidDate);

      if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูล ภ.ง.ด.53 ในช่วงเดือนที่เลือก" });

      const companyTaxId = cleanTaxId(company.taxId);
      const companyTin = companyTaxId.substring(0, 10);
      const companyBranch = formatBranch(company.branch);

      const lines: string[] = [];
      for (const cert of rows) {
        const payeeTaxId = cleanTaxId(cert.payeeTaxId);
        const payeeTin = payeeTaxId.substring(0, 10);
        const payeeBranch = formatBranch(cert.payeeBranch);

        const fields = [
          companyTaxId,                          // 1: pin
          companyTaxId,                          // 2: nid
          companyTin,                            // 3: tin
          companyBranch,                         // 4: branchid
          "1",                                   // 5: indcsubmit
          "1",                                   // 6: submitno
          "1",                                   // 7: sendtype1
          "0",                                   // 8: sendtype2
          "0",                                   // 9: sendtype3
          String(beYear),                        // 10: totincyear
          String(monthNum).padStart(2, "0"),      // 11: totincmonth
          payeeTaxId,                            // 12: Rcv_nid
          payeeTin,                              // 13: rcv_tin
          payeeBranch,                           // 14: branchid
          "",                                    // 15: v_description
          cert.payeeName || "",                  // 16: cName
          "",                                    // 17: buildname
          "",                                    // 18: mooName
          "",                                    // 19: roomNo
          "",                                    // 20: floorNo
          "",                                    // 21: addNum
          "",                                    // 22: mooNo
          "",                                    // 23: trokSoi
          "",                                    // 24: street
          "",                                    // 25: tumbolName
          "",                                    // 26: amphurName
          "",                                    // 27: provinceName
          "",                                    // 28: postcode
          "",                                    // 29: telnum
          formatThaiDate(cert.paidDate),         // 30: paydate
          cert.incomeDescription || cert.incomeType || "", // 31: inctype
          fmtAmount(cert.taxRate),               // 32: taxrate
          fmtAmount(cert.amountPaid),            // 33: payamt
          fmtAmount(cert.taxWithheld),           // 34: taxamt
          cert.whtCondition || "1",              // 35: proviso
          cert.notes || "",                      // 36: notes
        ];
        lines.push(fields.join("|"));
      }

      const content = lines.join("\r\n");
      const tis620Buffer = utf8ToTis620(content);
      const fileName = `PND53_${year}_${String(monthNum).padStart(2, "0")}.txt`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(tis620Buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rd-direct/pp36", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const month = String(req.query.month || "");
      const year = String(req.query.year || "");
      if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const beYear = Number(year);
      const ceYear = beYear - 543;
      const monthNum = Number(month);
      const startDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-01`;
      const lastDay = new Date(ceYear, monthNum, 0).getDate();
      const endDate = `${ceYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const allExpRows = await db.select().from(expenses)
        .where(and(
          eq(expenses.companyId, companyId),
          sql`${expenses.expDate} >= ${startDate}`,
          sql`${expenses.expDate} <= ${endDate}`,
          sql`${expenses.status} != 'cancelled'`,
          eq(expenses.showInTaxReport, true),
          sql`COALESCE(${expenses.vatAmount}::numeric, 0) > 0`,
        ));

      const foreignExpRows = allExpRows.filter(exp => {
        const vendorTaxId = cleanTaxId(exp.vendorTaxId);
        return !vendorTaxId || vendorTaxId.length < 13;
      });

      if (foreignExpRows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูลค่าบริการต่างประเทศ (ภ.พ.36) ในช่วงเดือนที่เลือก" });

      const taxId = cleanTaxId(company.taxId);
      const branch = formatBranch(company.branch);
      const monthStr = String(monthNum).padStart(2, "0");

      const lines: string[] = [];
      for (const exp of foreignExpRows) {
        const fields = [
          taxId,
          branch,
          String(beYear),
          monthStr,
          "1",
          "1",
          exp.vendorName || "",
          formatThaiDate(exp.expDate),
          fmtAmount(exp.subtotal),
          fmtAmount(exp.vatAmount),
        ];
        lines.push(fields.join("|"));
      }

      const content = lines.join("\r\n");
      const tis620Buffer = utf8ToTis620(content);
      const fileName = `PP36_${year}_${monthStr}.txt`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(tis620Buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
