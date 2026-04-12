import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, desc, and, isNull, asc, ilike, inArray, count , sql } from "drizzle-orm";
import { employees, firmClients, firmClientTeam, companies, contacts, accounts, workBoards, workBoardItems, workBoardColumns, contracts, accountingFormulaLines, accountingFormulas, paymentMethods, invoices, quotations, receipts, expenses, products, firmClientImportLogs, workStatusRows, workBoardGroups, clientUploadLinks, insertFirmClientSchema } from "@shared/schema";
import { requireAuth, requireAdmin, requireModule } from "../route-middleware";
import { logActivity, isDbConnectionError, deleteCompaniesCascade } from "../route-helpers";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getChartOfAccounts } from "@shared/chart-of-accounts";
import { CHART_TO_BUSINESS_TYPE } from "@shared/accounting-formulas";
import { decodeMulterFilename } from "../utils/safe-filename";

export function registerFirmRoutes(app: Express) {
app.get("/api/firm-clients", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  const user = req.user as any;
  const isManager = user.role === "admin" || user.role === "super_admin" || user.role === "owner" || user.role === "manager";
  const employeeFilter = !isManager && user.employeeId ? user.employeeId : undefined;
  const clients = await storage.getFirmClients(user.tenantId, employeeFilter);
  res.json(clients);
});

app.get("/api/firm-clients/teams/all", requireAuth, requireModule("firm-mgmt"), async (_req, res) => {
  const allTeamsResult = await db.select({
    firmClientId: firmClientTeam.firmClientId,
    employeeId: firmClientTeam.employeeId,
    role: firmClientTeam.role,
    nickname: employees.nickname,
    fullName: employees.fullName,
    position: employees.position,
  }).from(firmClientTeam)
    .innerJoin(employees, eq(firmClientTeam.employeeId, employees.id));
  res.json(allTeamsResult);
});

app.post("/api/firm-clients", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const currentUser = req.user as any;
    const parsed = insertFirmClientSchema.parse(req.body);
    const template = parsed.chartTemplate || "standard";
    const businessType = req.body.businessType || CHART_TO_BUSINESS_TYPE[template] || "mixed";

    const existingByName = await db.select({ id: firmClients.id, name: firmClients.name }).from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(and(eq(companies.tenantId, currentUser.tenantId), ilike(firmClients.name, parsed.name)))
      .limit(1);
    if (existingByName.length > 0) {
      return res.status(409).json({ message: `ลูกค้า "${parsed.name}" มีอยู่ในระบบแล้ว`, field: "name" });
    }
    if (parsed.taxId && parsed.taxId.trim()) {
      const existingByTaxId = await db.select({ id: firmClients.id, name: firmClients.name }).from(firmClients)
        .innerJoin(companies, eq(firmClients.companyId, companies.id))
        .where(and(eq(companies.tenantId, currentUser.tenantId), eq(firmClients.taxId, parsed.taxId.trim())))
        .limit(1);
      if (existingByTaxId.length > 0) {
        return res.status(409).json({ message: `เลขประจำตัวผู้เสียภาษี "${parsed.taxId}" ซ้ำกับลูกค้า "${existingByTaxId[0].name}"`, field: "taxId" });
      }
    }

    const [firmCompany] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, currentUser.tenantId), eq(companies.isPrimary, true)))
      .limit(1);

    const result = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        name: parsed.name,
        nameEn: parsed.nameEn || null,
        nameZh: parsed.nameZh || null,
        taxId: parsed.taxId || null,
        address: parsed.address || null,
        addressEn: parsed.addressEn || null,
        addressZh: parsed.addressZh || null,
        phone: parsed.phone || null,
        industry: null,
        active: true,
        businessType,
        tenantId: currentUser.tenantId || null,
      }).returning();

      let linkedContactId: number | null = null;
      if (firmCompany) {
        let existingContact: any = null;
        if (parsed.taxId && parsed.taxId.trim()) {
          const [byTax] = await tx.select().from(contacts)
            .where(and(eq(contacts.companyId, firmCompany.id), eq(contacts.taxId, parsed.taxId.trim()), eq(contacts.active, true))).limit(1);
          existingContact = byTax || null;
        }
        if (!existingContact) {
          const [byName] = await tx.select().from(contacts)
            .where(and(eq(contacts.companyId, firmCompany.id), ilike(contacts.name, parsed.name), eq(contacts.active, true))).limit(1);
          existingContact = byName || null;
        }
        if (existingContact) {
          linkedContactId = existingContact.id;
        } else {
          const contactCode = await storage.getNextContactCode(firmCompany.id);
          const [contact] = await tx.insert(contacts).values({
            companyId: firmCompany.id,
            code: contactCode,
            name: parsed.name,
            nameEn: parsed.nameEn || null,
            nameZh: parsed.nameZh || null,
            type: "customer",
            taxId: parsed.taxId || null,
            branch: parsed.branch || "สำนักงานใหญ่",
            address: parsed.address || null,
            addressEn: parsed.addressEn || null,
            addressZh: parsed.addressZh || null,
            phone: parsed.phone || null,
            email: parsed.email || null,
            contactPerson: parsed.contactPerson || null,
            active: true,
          }).returning();
          linkedContactId = contact.id;
        }
      }

      const [client] = await tx.insert(firmClients).values({
        ...parsed,
        companyId: company.id,
        contactId: linkedContactId,
      }).returning();

      const templateAccounts = getChartOfAccounts(template);
      if (templateAccounts.length > 0) {
        const chartAccounts = templateAccounts.map((acc) => ({
          companyId: company.id,
          code: acc.code,
          name: acc.name,
          nameTh: acc.nameTh,
          nameZh: acc.nameZh,
          type: acc.type,
          parentCode: acc.parentCode,
          isHeader: acc.isHeader,
        }));
        await tx.insert(accounts).values(chartAccounts);
      }

      return { client, companyId: company.id };
    });

    await storage.seedDefaultFormulas(result.companyId, businessType);

    try {
      const tenantBoards = await db.select({ id: workBoards.id })
        .from(workBoards)
        .innerJoin(companies, eq(workBoards.companyId, companies.id))
        .where(eq(companies.tenantId, currentUser.tenantId));
      const boardIds = tenantBoards.map(b => b.id);

      for (const boardId of boardIds) {
        const existingItem = await db.select({ id: workBoardItems.id })
          .from(workBoardItems)
          .where(and(eq(workBoardItems.boardId, boardId), eq(workBoardItems.name, parsed.name)))
          .limit(1);
        if (existingItem.length > 0) continue;

        const groups = await db.select({ id: workBoardGroups.id })
          .from(workBoardGroups)
          .where(eq(workBoardGroups.boardId, boardId))
          .orderBy(asc(workBoardGroups.position))
          .limit(1);
        if (groups.length === 0) continue;

        const personCols = await db.select({ id: workBoardColumns.id })
          .from(workBoardColumns)
          .where(and(eq(workBoardColumns.boardId, boardId), eq(workBoardColumns.columnType, "person")));
        const taxIdCols = await db.select({ id: workBoardColumns.id })
          .from(workBoardColumns)
          .where(and(eq(workBoardColumns.boardId, boardId), eq(workBoardColumns.name, "เลขผู้เสียภาษี")));

        const cellValues: Record<string, string> = {};
        if (personCols.length > 0 && result.client.assignedTo) {
          cellValues[String(personCols[0].id)] = String(result.client.assignedTo);
        }
        if (taxIdCols.length > 0 && parsed.taxId) {
          cellValues[String(taxIdCols[0].id)] = parsed.taxId;
        }

        const lastItem = await db.select({ position: workBoardItems.position })
          .from(workBoardItems)
          .where(and(eq(workBoardItems.boardId, boardId), eq(workBoardItems.groupId, groups[0].id)))
          .orderBy(desc(workBoardItems.position)).limit(1);
        const nextPos = lastItem.length > 0 ? lastItem[0].position + 1 : 0;

        await db.insert(workBoardItems).values({
          boardId,
          groupId: groups[0].id,
          name: parsed.name,
          position: nextPos,
          createdBy: currentUser.id,
          firmClientId: result.client.id,
          cellValues: JSON.stringify(cellValues),
        });
      }
      if (boardIds.length > 0) {
        console.log(`[Auto-sync] New firm client "${parsed.name}" added to ${boardIds.length} board(s)`);
      }
    } catch (boardErr: any) {
      console.error("[Auto-sync] Board insert error:", boardErr.message);
    }

    res.status(201).json(result.client);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    if (isDbConnectionError(err)) {
      return res.status(503).json({ message: "ฐานข้อมูลไม่พร้อมให้บริการชั่วคราว กรุณาลองใหม่อีกครั้ง" });
    }
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/firm-clients/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  const { businessType, ...clientData } = req.body;
  const clientId = Number(req.params.id);
  let client: any;
  if (Object.keys(clientData).length > 0) {
    client = await storage.updateFirmClient(clientId, clientData);
  } else {
    client = await storage.getFirmClient(clientId);
  }
  if (!client) return res.status(404).json({ message: "ไม่พบลูกค้า" });
  if (businessType && client.companyId) {
    await storage.updateCompany(client.companyId, { businessType });
    try {
      const { ECOMMERCE_EXTRA_ACCOUNTS, ACCOUNTING_FIRM_EXTRA_ACCOUNTS, GAS_STATION_EXTRA_ACCOUNTS } = await import("@shared/chart-of-accounts");
      let extraAccounts: typeof ECOMMERCE_EXTRA_ACCOUNTS = [];
      if (businessType === "ecommerce" || businessType === "online_shop") {
        extraAccounts = ECOMMERCE_EXTRA_ACCOUNTS;
      } else if (businessType === "accounting" || businessType === "accounting_firm" || businessType === "service") {
        extraAccounts = ACCOUNTING_FIRM_EXTRA_ACCOUNTS;
      } else if (businessType === "gas_station") {
        extraAccounts = GAS_STATION_EXTRA_ACCOUNTS;
      }
      if (extraAccounts.length > 0) {
        const existingAccounts = await db.select().from(accounts).where(eq(accounts.companyId, client.companyId));
        const existingByCode = new Map(existingAccounts.map(a => [a.code, a]));
        const parentCodes = new Set(extraAccounts.map(a => a.parentCode).filter(Boolean));
        let added = 0;
        for (const tmpl of extraAccounts) {
          if (!existingByCode.has(tmpl.code)) {
            const hasChildren = parentCodes.has(tmpl.code);
            try {
              await db.insert(accounts).values({
                companyId: client.companyId, code: tmpl.code, name: tmpl.name,
                nameTh: tmpl.nameTh, nameZh: tmpl.nameZh, type: tmpl.type,
                parentCode: tmpl.parentCode, isHeader: hasChildren,
              });
              added++;
            } catch (e: any) { /* skip duplicate */ }
          }
        }
        if (added > 0) {
          const refreshed = await db.select().from(accounts).where(eq(accounts.companyId, client.companyId));
          const usedParents = new Set(refreshed.map(a => a.parentCode).filter(Boolean));
          for (const acc of refreshed) {
            const shouldBeHeader = usedParents.has(acc.code);
            if (acc.isHeader !== shouldBeHeader) {
              await db.update(accounts).set({ isHeader: shouldBeHeader }).where(eq(accounts.id, acc.id));
            }
          }
        }
      }
    } catch (e: any) { console.log("Auto-seed extra accounts on businessType change:", e.message); }
  }
  if (clientData.assignedTo !== undefined) {
    const wsrPromise = db.update(workStatusRows)
      .set({ assignedEmployeeId: clientData.assignedTo || null })
      .where(eq(workStatusRows.firmClientId, clientId));

    const boardSyncPromise = (async () => {
      if (!client.companyId) return;
      try {
        const user = req.user as any;
        const tenantBoards = await db.select({ id: workBoards.id })
          .from(workBoards)
          .innerJoin(companies, eq(workBoards.companyId, companies.id))
          .where(eq(companies.tenantId, user.tenantId));
        const boardIds = tenantBoards.map(b => b.id);
        if (boardIds.length === 0) return;

        const [personCols, matchingItems] = await Promise.all([
          db.select({ id: workBoardColumns.id, boardId: workBoardColumns.boardId })
            .from(workBoardColumns)
            .where(and(
              inArray(workBoardColumns.boardId, boardIds),
              eq(workBoardColumns.columnType, "person")
            )),
          db.select({ id: workBoardItems.id, cellValues: workBoardItems.cellValues, boardId: workBoardItems.boardId })
            .from(workBoardItems)
            .where(and(
              inArray(workBoardItems.boardId, boardIds),
              eq(workBoardItems.name, client.name)
            )),
        ]);

        if (personCols.length === 0 || matchingItems.length === 0) return;
        const personColByBoard = new Map(personCols.map(p => [p.boardId, p]));
        const updates = matchingItems.map(item => {
          const pCol = personColByBoard.get(item.boardId);
          if (!pCol) return null;
          const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
          cv[String(pCol.id)] = clientData.assignedTo ? String(clientData.assignedTo) : "";
          return db.update(workBoardItems).set({ cellValues: JSON.stringify(cv) }).where(eq(workBoardItems.id, item.id));
        }).filter(Boolean);
        if (updates.length > 0) await Promise.all(updates);
      } catch (syncErr: any) {
        console.error("[firm-clients] board sync error:", syncErr.message);
      }
    })();

    await Promise.all([wsrPromise, boardSyncPromise]);
  }
  if (client.contactId) {
    const syncFields: Record<string, any> = {};
    if (clientData.name !== undefined) syncFields.name = clientData.name;
    if (clientData.nameEn !== undefined) syncFields.nameEn = clientData.nameEn;
    if (clientData.nameZh !== undefined) syncFields.nameZh = clientData.nameZh;
    if (clientData.taxId !== undefined) syncFields.taxId = clientData.taxId;
    if (clientData.branch !== undefined) syncFields.branch = clientData.branch;
    if (clientData.address !== undefined) syncFields.address = clientData.address;
    if (clientData.addressEn !== undefined) syncFields.addressEn = clientData.addressEn;
    if (clientData.addressZh !== undefined) syncFields.addressZh = clientData.addressZh;
    if (clientData.phone !== undefined) syncFields.phone = clientData.phone;
    if (clientData.email !== undefined) syncFields.email = clientData.email;
    if (clientData.contactPerson !== undefined) syncFields.contactPerson = clientData.contactPerson;
    if (Object.keys(syncFields).length > 0) {
      await db.update(contacts).set(syncFields).where(eq(contacts.id, client.contactId));
    }
  }
  res.json(client);
});

app.post("/api/firm-clients/backfill-contacts", requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentUser = req.user as any;
    const [firmCompany] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, currentUser.tenantId), eq(companies.isPrimary, true)))
      .limit(1);
    if (!firmCompany) return res.status(400).json({ message: "ไม่พบบริษัทหลักของสำนักงาน" });

    const unlinked = await db.select().from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(and(eq(companies.tenantId, currentUser.tenantId), sql`${firmClients.contactId} IS NULL`));

    let created = 0;
    let matched = 0;
    for (const row of unlinked) {
      const fc = row.firm_clients;
      let existingContact = null;
      if (fc.taxId && fc.taxId.trim()) {
        const [byTax] = await db.select().from(contacts)
          .where(and(eq(contacts.companyId, firmCompany.id), eq(contacts.taxId, fc.taxId.trim()), eq(contacts.type, "customer")))
          .limit(1);
        existingContact = byTax || null;
      }
      if (!existingContact) {
        const [byName] = await db.select().from(contacts)
          .where(and(eq(contacts.companyId, firmCompany.id), ilike(contacts.name, fc.name), eq(contacts.type, "customer")))
          .limit(1);
        existingContact = byName || null;
      }

      if (existingContact) {
        await db.update(firmClients).set({ contactId: existingContact.id }).where(eq(firmClients.id, fc.id));
        matched++;
      } else {
        const contactCode = await storage.getNextContactCode(firmCompany.id);
        const [newContact] = await db.insert(contacts).values({
          companyId: firmCompany.id,
          code: contactCode,
          name: fc.name,
          nameEn: fc.nameEn || null,
          nameZh: fc.nameZh || null,
          type: "customer",
          taxId: fc.taxId || null,
          branch: fc.branch || "สำนักงานใหญ่",
          address: fc.address || null,
          addressEn: fc.addressEn || null,
          addressZh: fc.addressZh || null,
          phone: fc.phone || null,
          email: fc.email || null,
          contactPerson: fc.contactPerson || null,
          active: true,
        }).returning();
        await db.update(firmClients).set({ contactId: newContact.id }).where(eq(firmClients.id, fc.id));
        created++;
      }
    }

    res.json({ success: true, total: unlinked.length, matched, created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/firm-clients/bulk-delete", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "กรุณาระบุรายการ" });
    const safeIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (safeIds.length === 0) return res.status(400).json({ message: "ไม่มีรายการที่ถูกต้อง" });

    const BATCH_SIZE = 50;
    let totalDeleted = 0;
    for (let i = 0; i < safeIds.length; i += BATCH_SIZE) {
      const batch = safeIds.slice(i, i + BATCH_SIZE);
      try {
        await db.execute(sql`DELETE FROM line_group_mappings WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        await db.execute(sql`UPDATE line_documents SET firm_client_id = NULL WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        const uploadLinks = await db.select({ id: clientUploadLinks.id }).from(clientUploadLinks)
          .where(inArray(clientUploadLinks.firmClientId, batch));
        if (uploadLinks.length > 0) {
          const ulIds = uploadLinks.map(l => l.id);
          await db.execute(sql`DELETE FROM client_upload_files WHERE upload_link_id IN ${sql.raw("(" + ulIds.join(",") + ")")}`).catch(() => {});
        }
        await db.execute(sql`DELETE FROM client_upload_links WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        await db.execute(sql`DELETE FROM contracts WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        await db.execute(sql`UPDATE work_board_items SET firm_client_id = NULL WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        const linkedRows = await db.select({ id: workStatusRows.id }).from(workStatusRows)
          .where(inArray(workStatusRows.firmClientId, batch));
        if (linkedRows.length > 0) {
          const rowIds = linkedRows.map(r => r.id);
          await db.execute(sql`DELETE FROM work_status_cells WHERE row_id IN ${sql.raw("(" + rowIds.join(",") + ")")}`).catch(() => {});
          await db.execute(sql`DELETE FROM work_status_attachments WHERE row_id IN ${sql.raw("(" + rowIds.join(",") + ")")}`).catch(() => {});
          await db.execute(sql`DELETE FROM work_status_rows WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        }
        await db.execute(sql`DELETE FROM firm_client_team WHERE firm_client_id IN ${sql.raw("(" + batch.join(",") + ")")}`).catch(() => {});
        const fcCompanies = await db.select({ id: firmClients.id, companyId: firmClients.companyId })
          .from(firmClients).where(inArray(firmClients.id, batch));
        await db.delete(firmClients).where(inArray(firmClients.id, batch));
        const orphanIds: number[] = [];
        for (const fc of fcCompanies) {
          if (!fc.companyId) continue;
          const [still] = await db.select({ cnt: sql<number>`count(*)` })
            .from(firmClients).where(eq(firmClients.companyId, fc.companyId));
          if (Number(still?.cnt || 0) === 0) {
            const [comp] = await db.select({ isPrimary: companies.isPrimary }).from(companies).where(eq(companies.id, fc.companyId));
            if (comp && !comp.isPrimary) orphanIds.push(fc.companyId);
          }
        }
        if (orphanIds.length > 0) await deleteCompaniesCascade(orphanIds);
        totalDeleted += batch.length;
      } catch (batchErr: any) {
        console.error(`[bulk-delete] batch ${i} error:`, batchErr.message);
        throw batchErr;
      }
    }

    logActivity({ companyId: Number(req.query.companyId) || 0, tenantId: user.tenantId, userId: user.id, userName: user.username, action: "bulk_delete", entityType: "firm_client", entityId: safeIds.join(","), entityName: `ลบลูกค้า ${totalDeleted} รายการ` }).catch(() => {});
    res.json({ success: true, deleted: totalDeleted });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/firm-clients/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const client = await db.select({ id: firmClients.id, name: firmClients.name, companyId: firmClients.companyId })
      .from(firmClients).where(eq(firmClients.id, id)).then(r => r[0]);
    if (!client) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    if (user.tenantId && client.companyId) {
      const [comp] = await db.select({ tenantId: companies.tenantId }).from(companies).where(eq(companies.id, client.companyId));
      if (comp && comp.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    await storage.deleteFirmClient(id);
    if (client.companyId) {
      const [still] = await db.select({ cnt: sql<number>`count(*)` })
        .from(firmClients).where(eq(firmClients.companyId, client.companyId));
      if (Number(still?.cnt || 0) === 0) {
        const [comp] = await db.select({ isPrimary: companies.isPrimary }).from(companies).where(eq(companies.id, client.companyId));
        if (comp && !comp.isPrimary) {
          await deleteCompaniesCascade([client.companyId]);
        }
      }
    }
    logActivity({
      companyId: client.companyId || 0,
      tenantId: user.tenantId || undefined,
      userId: user.id,
      userName: user.username,
      action: "delete",
      entityType: "firm_client",
      entityId: String(id),
      entityName: client.name || "",
    }).catch(() => {});
    res.json({ message: "ลบสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "ไม่สามารถลบได้" });
  }
});

app.post("/api/firm-clients/deduplicate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const allFc = await db.select({ id: firmClients.id, name: firmClients.name, companyId: firmClients.companyId })
      .from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId))
      .orderBy(firmClients.id);

    const nameFirst: Record<string, number> = {};
    const dupeIds: number[] = [];
    const dupeToOrig: Record<number, number> = {};

    for (const fc of allFc) {
      const key = (fc.name || "").toLowerCase();
      if (nameFirst[key]) {
        dupeIds.push(fc.id);
        dupeToOrig[fc.id] = nameFirst[key];
      } else {
        nameFirst[key] = fc.id;
      }
    }

    if (dupeIds.length === 0) {
      return res.json({ message: "ไม่พบรายการซ้ำ", removed: 0 });
    }

    console.log(`[dedup] Found ${dupeIds.length} duplicates to remove for tenant ${user.tenantId}`);

    for (const dupeId of dupeIds) {
      const origId = dupeToOrig[dupeId];
      await db.execute(sql`UPDATE work_status_rows SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE firm_client_team SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE line_group_mappings SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE line_documents SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE contracts SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE work_board_items SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`UPDATE client_upload_links SET firm_client_id = ${origId} WHERE firm_client_id = ${dupeId}`).catch(() => {});
    }

    for (const dupeId of dupeIds) {
      await db.execute(sql`DELETE FROM firm_client_team WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`DELETE FROM line_group_mappings WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`DELETE FROM contracts WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.execute(sql`DELETE FROM client_upload_links WHERE firm_client_id = ${dupeId}`).catch(() => {});
      await db.delete(firmClients).where(eq(firmClients.id, dupeId));
    }

    const orphanCompanyIds: number[] = [];
    for (const dupeId of dupeIds) {
      const fc = allFc.find(f => f.id === dupeId);
      if (fc?.companyId) {
        const [companyUsed] = await db.select({ cnt: sql<number>`count(*)` })
          .from(firmClients).where(eq(firmClients.companyId, fc.companyId));
        if (Number(companyUsed?.cnt || 0) === 0) {
          const [comp] = await db.select({ isPrimary: companies.isPrimary }).from(companies).where(eq(companies.id, fc.companyId));
          if (comp && !comp.isPrimary) orphanCompanyIds.push(fc.companyId);
        }
      }
    }

    const remainingCount = allFc.length - dupeIds.length;

    const orphanCompanies = await db.execute(sql`
      SELECT c.id FROM companies c
      WHERE c.tenant_id = ${user.tenantId}
        AND c.is_primary = false
        AND NOT EXISTS (SELECT 1 FROM firm_clients fc WHERE fc.company_id = c.id)
    `);
    for (const oc of (orphanCompanies as any).rows || orphanCompanies || []) {
      if (!orphanCompanyIds.includes(oc.id)) orphanCompanyIds.push(oc.id);
    }

    const uniqueOrphanIds = [...new Set(orphanCompanyIds)];
    let orphansCleaned = 0;
    if (uniqueOrphanIds.length > 0) {
      const cascadeResult = await deleteCompaniesCascade(uniqueOrphanIds);
      orphansCleaned = cascadeResult.deleted;
      if (cascadeResult.errors.length > 0) {
        console.error(`[dedup] CASCADE errors:`, cascadeResult.errors);
      }
    }

    console.log(`[dedup] Done: removed ${dupeIds.length} dupes, ${orphansCleaned} orphan companies, remaining ${remainingCount}`);

    const dupeNames = dupeIds.map(id => allFc.find(f => f.id === id)?.name).filter(Boolean).join(", ");
    logActivity({
      companyId: 0,
      tenantId: user.tenantId || undefined,
      userId: user.id,
      userName: user.username,
      action: "delete",
      entityType: "firm_client",
      entityId: dupeIds.join(","),
      entityName: "dedup",
      details: `ลบลูกค้าซ้ำ ${dupeIds.length} ราย: ${dupeNames.substring(0, 500)}`,
    }).catch(() => {});

    const orphanMsg = orphansCleaned > 0 ? ` ลบบริษัทขยะ ${orphansCleaned} รายการ` : "";
    res.json({ 
      message: `ลบรายการซ้ำ ${dupeIds.length} รายการสำเร็จ${orphanMsg} เหลือลูกค้า ${remainingCount} ราย`,
      removed: dupeIds.length,
      remaining: remainingCount,
      orphansCleaned
    });
  } catch (err: any) {
    console.error("Deduplicate error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/firm-clients/cleanup-orphan-companies", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const dryRun = req.query.dryRun === "true";
    const tenantFilter = user.tenantId ? sql`AND c.tenant_id = ${user.tenantId}` : sql``;

    const orphanRows: any = await db.execute(sql`
      SELECT c.id, c.name FROM companies c
      WHERE c.is_primary = false
        AND c.active = true
        AND NOT EXISTS (SELECT 1 FROM firm_clients fc WHERE fc.company_id = c.id AND fc.status = 'active')
        ${tenantFilter}
    `);
    const orphans = (orphanRows as any).rows || orphanRows;

    if (!orphans || orphans.length === 0) {
      return res.json({ message: "ไม่พบบริษัทขยะ", deleted: 0, skipped: 0, details: [] });
    }

    const safeToDelete: any[] = [];
    const skipped: any[] = [];

    for (const oc of orphans) {
      const checks = await Promise.all([
        db.execute(sql`SELECT count(*)::int as cnt FROM journal_entries WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM invoices WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM quotations WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM tax_invoices WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM receipts WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM expenses WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM purchase_orders WHERE company_id = ${oc.id}`),
        db.execute(sql`SELECT count(*)::int as cnt FROM employees WHERE company_id = ${oc.id}`),
      ]);
      const hasData = checks.some((r: any) => {
        const row = (r as any).rows?.[0] || (r as any)[0];
        return Number(row?.cnt || 0) > 0;
      });

      if (hasData) {
        skipped.push({ id: oc.id, name: oc.name, reason: "มีข้อมูลผูกอยู่" });
      } else {
        safeToDelete.push({ id: oc.id, name: oc.name });
      }
    }

    if (dryRun) {
      return res.json({
        message: `พบบริษัทขยะ ${orphans.length} ราย — ลบได้อย่างปลอดภัย ${safeToDelete.length} ราย, ข้าม ${skipped.length} ราย (มีข้อมูลผูก)`,
        canDelete: safeToDelete.length,
        skipped: skipped.length,
        details: { safeToDelete, skipped },
      });
    }

    let deleted = 0;
    const idsToDelete = safeToDelete.map((o: any) => Number(o.id));
    if (idsToDelete.length > 0) {
      const idList = idsToDelete.join(',');
      try {
        const fkTablesResult: any = await db.execute(sql`
          SELECT DISTINCT tc.table_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'companies' AND ccu.column_name = 'id'
            AND tc.table_name != 'companies'
        `);
        const fkTableNames = ((fkTablesResult as any).rows || fkTablesResult).map((r: any) => r.table_name);

        for (const tbl of fkTableNames) {
          await db.execute(sql.raw(`DELETE FROM "${tbl}" WHERE company_id IN (${idList})`)).catch(() => {});
        }
        await db.execute(sql.raw(`DELETE FROM companies WHERE id IN (${idList})`));
        deleted = idsToDelete.length;
      } catch (e: any) {
        console.error("Cleanup orphan companies error:", e.message);
        return res.status(500).json({ message: "ลบไม่สำเร็จ: " + e.message });
      }
    }

    console.log(`[cleanup-orphans] Deleted ${deleted} safe orphan companies, skipped ${skipped.length} (have data)`);

    logActivity({
      companyId: 0,
      tenantId: user.tenantId || undefined,
      userId: user.id,
      userName: user.username,
      action: "delete",
      entityType: "company",
      entityId: String(deleted),
      entityName: "cleanup-orphans",
      details: `ลบบริษัทขยะ ${deleted} ราย (ข้าม ${skipped.length} ราย)`,
    }).catch(() => {});
    res.json({ message: `ลบสำเร็จ ${deleted} ราย, ข้าม ${skipped.length} ราย (มีข้อมูลผูก)`, deleted, skipped: skipped.length, details: { deleted: safeToDelete, skipped } });
  } catch (err: any) {
    console.error("Cleanup orphan companies error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/firm-clients/reset-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    req.setTimeout(300000);
    res.setTimeout(300000);
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบ tenantId" });

    const [firmCompany] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, user.tenantId), eq(companies.isPrimary, true)))
      .limit(1);

    const allFc = await db.select({ id: firmClients.id, companyId: firmClients.companyId, contactId: firmClients.contactId })
      .from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId));

    if (allFc.length === 0) {
      return res.json({ message: "ไม่พบลูกค้าสำนักงาน", deleted: 0 });
    }

    const fcIds = allFc.map(f => f.id);
    const childCompanyIds = allFc.map(f => f.companyId);
    const contactIds = allFc.filter(f => f.contactId).map(f => f.contactId!);

    console.log(`[reset-all] Deleting ${fcIds.length} firm_clients, ${childCompanyIds.length} companies, ${contactIds.length} contacts for tenant ${user.tenantId}...`);

    await db.execute(sql`DELETE FROM work_status_cells WHERE row_id IN (SELECT id FROM work_status_rows WHERE firm_client_id = ANY(${fcIds}))`).catch(() => {});
    await db.execute(sql`DELETE FROM work_status_attachments WHERE row_id IN (SELECT id FROM work_status_rows WHERE firm_client_id = ANY(${fcIds}))`).catch(() => {});
    await db.execute(sql`DELETE FROM work_status_rows WHERE firm_client_id = ANY(${fcIds})`).catch(() => {});

    await db.execute(sql`DELETE FROM firm_clients WHERE id = ANY(${fcIds})`);

    if (contactIds.length > 0) {
      await db.execute(sql`DELETE FROM contacts WHERE id = ANY(${contactIds})`).catch(() => {});
    }
    if (firmCompany) {
      await db.execute(sql`DELETE FROM contacts WHERE company_id = ${firmCompany.id} AND type = 'customer'`).catch(() => {});
    }

    if (childCompanyIds.length > 0) {
      await db.execute(sql`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(${childCompanyIds}))`).catch(() => {});
      await db.execute(sql`DELETE FROM journal_entries WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM accounting_formulas WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM accounting_formula_lines WHERE formula_id IN (SELECT id FROM accounting_formulas WHERE company_id = ANY(${childCompanyIds}))`).catch(() => {});
      await db.execute(sql`DELETE FROM document_settings WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM accounts WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM contacts WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM products WHERE company_id = ANY(${childCompanyIds})`).catch(() => {});
      await db.execute(sql`DELETE FROM companies WHERE id = ANY(${childCompanyIds})`).catch(() => {});
    }

    const tenantCondition = sql`AND c.tenant_id = ${user.tenantId}`;
    await db.execute(sql`
      DELETE FROM companies WHERE id IN (
        SELECT c.id FROM companies c
        WHERE c.is_primary = false
          AND NOT EXISTS (SELECT 1 FROM firm_clients fc WHERE fc.company_id = c.id)
          ${tenantCondition}
      )
    `).catch(() => {});

    console.log(`[reset-all] Done: deleted ${fcIds.length} firm_clients + ${childCompanyIds.length} companies + contacts`);

    logActivity({
      companyId: firmCompany?.id || 0,
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.username,
      action: "delete",
      entityType: "firm_client",
      entityId: String(fcIds.length),
      entityName: "reset-all",
      details: `ลบลูกค้าทั้งหมด ${fcIds.length} ราย พร้อมบริษัท ${childCompanyIds.length} และรายชื่อคู่ค้า ${contactIds.length}`,
    }).catch(() => {});

    res.json({
      message: `ลบลูกค้าทั้งหมด ${fcIds.length} ราย พร้อมบริษัท ${childCompanyIds.length} และรายชื่อคู่ค้าสำเร็จ`,
      deleted: fcIds.length,
      companiesDeleted: childCompanyIds.length,
      contactsDeleted: contactIds.length,
    });
  } catch (err: any) {
    console.error("[reset-all] error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/firm-clients/sync-contacts/preview", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const [firmCompany] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, user.tenantId), eq(companies.isPrimary, true)))
      .limit(1);
    if (!firmCompany) return res.status(400).json({ message: "ไม่พบบริษัทหลักของสำนักงาน" });

    const existingFc = await db.select({ id: firmClients.id, name: firmClients.name, contactId: firmClients.contactId, taxId: firmClients.taxId })
      .from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId));

    const allCustomerContacts = await db.select({ id: contacts.id, name: contacts.name, taxId: contacts.taxId }).from(contacts)
      .where(and(eq(contacts.companyId, firmCompany.id), eq(contacts.type, "customer"), eq(contacts.active, true)));

    const fcContactIds = new Set(existingFc.filter(f => f.contactId).map(f => f.contactId!));
    const fcNames = new Set(existingFc.map(f => f.name?.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean));
    const fcTaxIds = new Set(existingFc.filter(f => f.taxId && f.taxId.length >= 10).map(f => f.taxId!));

    const toCreate = allCustomerContacts.filter(c => {
      if (fcContactIds.has(c.id)) return false;
      const normName = c.name?.trim().toLowerCase().replace(/\s+/g, " ") || "";
      if (normName && fcNames.has(normName)) return false;
      if (c.taxId && c.taxId.length >= 10 && fcTaxIds.has(c.taxId)) return false;
      return true;
    });

    const unlinkedFc = existingFc.filter(f => !f.contactId);

    res.json({
      existingFirmClients: existingFc.length,
      existingContacts: allCustomerContacts.length,
      willCreate: toCreate.length,
      willLink: unlinkedFc.length,
      summary: `พบลูกค้าสำนักงาน ${existingFc.length} ราย, คู่ค้า ${allCustomerContacts.length} ราย → จะสร้างลูกค้าใหม่ ${toCreate.length} ราย, เชื่อมโยง ${unlinkedFc.length} ราย`,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/firm-clients/sync-contacts", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const [firmCompany] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, user.tenantId), eq(companies.isPrimary, true)))
      .limit(1);
    if (!firmCompany) return res.status(400).json({ message: "ไม่พบบริษัทหลักของสำนักงาน" });

    const allFc = await db.select({
      id: firmClients.id,
      name: firmClients.name,
      contactId: firmClients.contactId,
      taxId: firmClients.taxId,
      branch: firmClients.branch,
      address: firmClients.address,
      phone: firmClients.phone,
      email: firmClients.email,
      contactPerson: firmClients.contactPerson,
      nameEn: firmClients.nameEn,
      nameZh: firmClients.nameZh,
      addressEn: firmClients.addressEn,
      addressZh: firmClients.addressZh,
    }).from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId))
      .orderBy(firmClients.id);

    // Step 1: Split shared contacts (1 contact used by multiple firm_clients)
    const contactIdUsage: Record<number, number[]> = {};
    for (const fc of allFc) {
      if (fc.contactId) {
        (contactIdUsage[fc.contactId] ||= []).push(fc.id);
      }
    }
    let splitCreated = 0;
    for (const [, fcIds] of Object.entries(contactIdUsage)) {
      if (fcIds.length <= 1) continue;
      for (let i = 1; i < fcIds.length; i++) {
        const fc = allFc.find(f => f.id === fcIds[i]);
        if (!fc) continue;
        const contactCode = await storage.getNextContactCode(firmCompany.id);
        const [newContact] = await db.insert(contacts).values({
          companyId: firmCompany.id,
          code: contactCode,
          name: fc.name,
          nameEn: fc.nameEn || null,
          nameZh: fc.nameZh || null,
          type: "customer",
          taxId: fc.taxId || null,
          branch: fc.branch || "สำนักงานใหญ่",
          address: fc.address || null,
          addressEn: fc.addressEn || null,
          addressZh: fc.addressZh || null,
          phone: fc.phone || null,
          email: fc.email || null,
          contactPerson: fc.contactPerson || null,
          active: true,
        }).returning();
        await db.update(firmClients).set({ contactId: newContact.id }).where(eq(firmClients.id, fc.id));
        splitCreated++;
      }
    }

    // Step 2: Create firm_clients from contacts that don't have one yet (BEFORE any cleanup)
    const fcAfterSplit = await db.select({ contactId: firmClients.contactId, name: firmClients.name, taxId: firmClients.taxId })
      .from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId));
    const fcContactIds = new Set(fcAfterSplit.filter(f => f.contactId).map(f => f.contactId!));
    const fcNames = new Set(fcAfterSplit.map(f => f.name?.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean));
    const fcTaxIds = new Set(fcAfterSplit.filter(f => f.taxId && f.taxId.length >= 10).map(f => f.taxId!));

    const allCustomerContacts = await db.select().from(contacts)
      .where(and(eq(contacts.companyId, firmCompany.id), eq(contacts.type, "customer"), eq(contacts.active, true)));
    console.log(`[sync-contacts] Found ${allCustomerContacts.length} customer contacts at primary company ${firmCompany.id}, ${fcAfterSplit.length} existing firm_clients`);
    const toCreate = allCustomerContacts.filter(c => {
      if (fcContactIds.has(c.id)) return false;
      const normName = c.name?.trim().toLowerCase().replace(/\s+/g, " ") || "";
      if (normName && fcNames.has(normName)) return false;
      if (c.taxId && c.taxId.length >= 10 && fcTaxIds.has(c.taxId)) return false;
      return true;
    });

    const { STANDARD_CHART_OF_ACCOUNTS } = await import("@shared/chart-of-accounts");
    let createdCount = 0;
    let skippedCount = 0;
    const SYNC_BATCH = 20;
    for (let i = 0; i < toCreate.length; i += SYNC_BATCH) {
      const batch = toCreate.slice(i, i + SYNC_BATCH);
      await db.transaction(async (tx) => {
        const newCompanies = await tx.insert(companies).values(
          batch.map(c => ({
            name: c.name || "ไม่ระบุ",
            tenantId: user.tenantId,
            isPrimary: false,
            active: true,
            taxId: c.taxId || null,
            branch: c.branch || "สำนักงานใหญ่",
            address: c.address || null,
            addressEn: c.addressEn || null,
            addressZh: c.addressZh || null,
          }))
        ).returning();

        const allAccountValues: any[] = [];
        for (const nc of newCompanies) {
          for (const a of STANDARD_CHART_OF_ACCOUNTS) {
            allAccountValues.push({
              companyId: nc.id,
              code: (a as any).code,
              name: (a as any).name,
              nameEn: (a as any).nameEn || null,
              nameZh: (a as any).nameZh || null,
              type: (a as any).type,
              isHeader: (a as any).isHeader || false,
              parentCode: (a as any).parentCode || null,
              level: (a as any).level || 1,
              active: true,
            });
          }
        }
        const ACCT_BATCH = 500;
        for (let j = 0; j < allAccountValues.length; j += ACCT_BATCH) {
          await tx.insert(accounts).values(allAccountValues.slice(j, j + ACCT_BATCH)).onConflictDoNothing();
        }

        const fcValues = batch.map((contact, idx) => ({
          companyId: newCompanies[idx].id,
          tenantId: user.tenantId,
          name: contact.name || "ไม่ระบุ",
          nameEn: contact.nameEn || null,
          nameZh: contact.nameZh || null,
          contactId: contact.id,
          status: "active" as const,
          taxId: contact.taxId || null,
          branch: contact.branch || "สำนักงานใหญ่",
          address: contact.address || null,
          addressEn: contact.addressEn || null,
          addressZh: contact.addressZh || null,
          phone: contact.phone || null,
          email: contact.email || null,
          contactPerson: contact.contactPerson || null,
        }));
        await tx.insert(firmClients).values(fcValues);
        createdCount += batch.length;
      }).catch((e) => {
        console.error(`[sync-contacts] batch error at ${i}:`, e.message);
        skippedCount += batch.length;
      });
    }

    // Step 3: Link firm_clients that have no contactId to matching contacts by name
    const unlinkedFc = await db.select({ id: firmClients.id, name: firmClients.name, contactId: firmClients.contactId })
      .from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(and(eq(companies.tenantId, user.tenantId), isNull(firmClients.contactId)));
    let linkedCount = 0;
    for (const fc of unlinkedFc) {
      const match = allCustomerContacts.find(c => c.name?.trim().toLowerCase() === fc.name?.trim().toLowerCase());
      if (match) {
        await db.update(firmClients).set({ contactId: match.id }).where(eq(firmClients.id, fc.id));
        linkedCount++;
      }
    }

    const totalFcNow = await db.select({ total: count() }).from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId));

    res.json({
      message: `Sync สำเร็จ: สร้างลูกค้าใหม่ ${createdCount} ราย${skippedCount > 0 ? `, ข้าม ${skippedCount} ราย` : ""}${splitCreated > 0 ? `, แยก contact ซ้ำ ${splitCreated} ราย` : ""}${linkedCount > 0 ? `, เชื่อมโยง ${linkedCount} ราย` : ""} — รวมทั้งหมด ${Number(totalFcNow[0]?.total || 0)} ราย`,
      createdCount,
      skippedCount,
      splitCreated,
      linkedCount,
      total: Number(totalFcNow[0]?.total || 0),
    });
  } catch (err: any) {
    console.error("[sync-contacts] error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/firm-clients/:id/team", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  const clientId = Number(req.params.id);
  const [client] = await db.select().from(firmClients).where(eq(firmClients.id, clientId));
  if (!client) return res.status(404).json({ message: "ไม่พบลูกค้า" });
  const members = await db.select({
    id: firmClientTeam.id,
    employeeId: firmClientTeam.employeeId,
    role: firmClientTeam.role,
    fullName: employees.fullName,
    position: employees.position,
    employeeCode: employees.employeeCode,
  }).from(firmClientTeam)
    .innerJoin(employees, eq(firmClientTeam.employeeId, employees.id))
    .where(eq(firmClientTeam.firmClientId, clientId));
  res.json(members);
});

app.put("/api/firm-clients/:id/team", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(firmClients).where(eq(firmClients.id, clientId));
    if (!client) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    const { employeeIds } = req.body;
    if (!Array.isArray(employeeIds)) return res.status(400).json({ message: "employeeIds ต้องเป็น array" });
    await db.delete(firmClientTeam).where(eq(firmClientTeam.firmClientId, clientId));
    if (employeeIds.length > 0) {
      await db.insert(firmClientTeam).values(
        employeeIds.map((eid: number) => ({ firmClientId: clientId, employeeId: eid, role: "member" }))
      );
    }
    const members = await db.select({
      id: firmClientTeam.id,
      employeeId: firmClientTeam.employeeId,
      role: firmClientTeam.role,
      fullName: employees.fullName,
      position: employees.position,
    }).from(firmClientTeam)
      .innerJoin(employees, eq(firmClientTeam.employeeId, employees.id))
      .where(eq(firmClientTeam.firmClientId, clientId));
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/firm-clients/import/template", async (_req, res) => {
  const wb = XLSX.utils.book_new();
  const headers = [
    "ชื่อบริษัท (ไทย)*", "ชื่อบริษัท (อังกฤษ)", "ชื่อบริษัท (จีน)",
    "สาขา (ไทย)", "สาขา (อังกฤษ)", "สาขา (จีน)",
    "ชื่อผู้ประกอบการ (ไทย)", "ชื่อผู้ประกอบการ (อังกฤษ)", "ชื่อผู้ประกอบการ (จีน)",
    "เลขประจำตัวผู้เสียภาษี", "ผู้ติดต่อ", "เบอร์โทร", "แฟกซ์", "อีเมล", "เว็บไซต์",
    "ที่อยู่ (ไทย)", "ที่อยู่ (อังกฤษ)", "ที่อยู่ (จีน)",
    "ผังบัญชี (standard/ecommerce/service/trading/none)", "จำนวนใบกำกับ/เดือน", "ค่าบริการ (บาท/เดือน)", "หัก ณ ที่จ่าย (%)", "หมายเหตุ",
  ];
  const sample = [
    "บริษัท ตัวอย่าง จำกัด", "Example Co., Ltd.", "", "สำนักงานใหญ่", "Head Office", "",
    "นายทดสอบ ตัวอย่าง", "", "", "0105500000001", "คุณสมชาย", "021234567", "", "test@example.com", "www.example.com",
    "123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10110", "", "",
    "standard", "50", "3000", "3", "",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 1.5, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="firm_clients_import_template.xlsx"');
  res.send(buf);
});

const uploadFirmClients = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const FIRM_IMPORT_COL_MAP: Record<string, string> = {
  "ชื่อบริษัท (ไทย)*": "name", "ชื่อบริษัท (อังกฤษ)": "nameEn", "ชื่อบริษัท (จีน)": "nameZh",
  "สาขา (ไทย)": "branch", "สาขา (อังกฤษ)": "branchEn", "สาขา (จีน)": "branchZh",
  "ชื่อผู้ประกอบการ (ไทย)": "ownerName", "ชื่อผู้ประกอบการ (อังกฤษ)": "ownerNameEn", "ชื่อผู้ประกอบการ (จีน)": "ownerNameZh",
  "เลขประจำตัวผู้เสียภาษี": "taxId", "ผู้ติดต่อ": "contactPerson", "เบอร์โทร": "phone",
  "แฟกซ์": "fax", "อีเมล": "email", "เว็บไซต์": "website",
  "ที่อยู่ (ไทย)": "address", "ที่อยู่ (อังกฤษ)": "addressEn", "ที่อยู่ (จีน)": "addressZh",
  "ผังบัญชี (standard/ecommerce/service/trading/none)": "chartTemplate",
  "จำนวนใบกำกับ/เดือน": "invoiceCount", "ค่าบริการ (บาท/เดือน)": "serviceFee",
  "หัก ณ ที่จ่าย (%)": "whtRate", "หมายเหตุ": "notes",
};

async function createFirmClientFromRow(mapped: any, user: any, firmCompanyId: number) {
  const template = ["standard", "ecommerce", "service", "trading", "none"].includes(mapped.chartTemplate)
    ? mapped.chartTemplate : "none";
  const businessType = CHART_TO_BUSINESS_TYPE[template] || "mixed";

  await db.transaction(async (tx) => {
    const [company] = await tx.insert(companies).values({
      name: mapped.name, nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null,
      taxId: mapped.taxId || null, address: mapped.address || null, addressEn: mapped.addressEn || null,
      addressZh: mapped.addressZh || null, phone: mapped.phone || null, industry: null, active: true,
      businessType, tenantId: user.tenantId || null,
    }).returning();

    await tx.insert(firmClients).values({
      name: mapped.name, nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null,
      branch: mapped.branch || "สำนักงานใหญ่", branchEn: mapped.branchEn || null, branchZh: mapped.branchZh || null,
      ownerName: mapped.ownerName || null, ownerNameEn: mapped.ownerNameEn || null, ownerNameZh: mapped.ownerNameZh || null,
      taxId: mapped.taxId || null, contactPerson: mapped.contactPerson || null, phone: mapped.phone || null,
      fax: mapped.fax || null, email: mapped.email || null, website: mapped.website || null,
      address: mapped.address || null, addressEn: mapped.addressEn || null, addressZh: mapped.addressZh || null,
      chartTemplate: template, invoiceCount: mapped.invoiceCount ? Number(mapped.invoiceCount) : 0,
      serviceFee: mapped.serviceFee || "0", whtRate: mapped.whtRate || "3", notes: mapped.notes || null,
      companyId: company.id,
    });

    const existingContact = await tx.select({ id: contacts.id }).from(contacts)
      .where(and(eq(contacts.companyId, firmCompanyId), ilike(contacts.name, mapped.name))).limit(1);
    if (existingContact.length === 0) {
      const maxCodeResult = await tx.select({
        maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS INTEGER)), 0)`
      }).from(contacts)
        .where(and(eq(contacts.companyId, firmCompanyId), sql`code ~ '^C\\d+$'`));
      const nextNum = (maxCodeResult[0]?.maxNum || 0) + 1;
      await tx.insert(contacts).values({
        companyId: firmCompanyId, code: `C${String(nextNum).padStart(4, "0")}`, name: mapped.name,
        nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null, type: "customer",
        taxId: mapped.taxId || null, branch: mapped.branch || "สำนักงานใหญ่",
        address: mapped.address || null, addressEn: mapped.addressEn || null, addressZh: mapped.addressZh || null,
        phone: mapped.phone || null, email: mapped.email || null, contactPerson: mapped.contactPerson || null,
      });
    }
  });
}

async function updateFirmClientFromRow(existingFc: any, mapped: any) {
  const updateData: any = {};
  if (mapped.nameEn) updateData.nameEn = mapped.nameEn;
  if (mapped.nameZh) updateData.nameZh = mapped.nameZh;
  if (mapped.branch) updateData.branch = mapped.branch;
  if (mapped.branchEn) updateData.branchEn = mapped.branchEn;
  if (mapped.branchZh) updateData.branchZh = mapped.branchZh;
  if (mapped.ownerName) updateData.ownerName = mapped.ownerName;
  if (mapped.ownerNameEn) updateData.ownerNameEn = mapped.ownerNameEn;
  if (mapped.ownerNameZh) updateData.ownerNameZh = mapped.ownerNameZh;
  if (mapped.taxId) updateData.taxId = mapped.taxId;
  if (mapped.contactPerson) updateData.contactPerson = mapped.contactPerson;
  if (mapped.phone) updateData.phone = mapped.phone;
  if (mapped.fax) updateData.fax = mapped.fax;
  if (mapped.email) updateData.email = mapped.email;
  if (mapped.website) updateData.website = mapped.website;
  if (mapped.address) updateData.address = mapped.address;
  if (mapped.addressEn) updateData.addressEn = mapped.addressEn;
  if (mapped.addressZh) updateData.addressZh = mapped.addressZh;
  if (mapped.invoiceCount) updateData.invoiceCount = Number(mapped.invoiceCount);
  if (mapped.serviceFee) updateData.serviceFee = mapped.serviceFee;
  if (mapped.whtRate) updateData.whtRate = mapped.whtRate;
  if (mapped.notes) updateData.notes = mapped.notes;
  if (Object.keys(updateData).length > 0) {
    await db.update(firmClients).set(updateData).where(eq(firmClients.id, existingFc.id));
  }
}

app.post("/api/firm-clients/import", requireAuth, requireModule("firm-mgmt"), uploadFirmClients.single("file"), async (req, res) => {
  try {
    req.setTimeout(300000);
    res.setTimeout(300000);
    if (!req.file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    const mode = (req.body?.mode || "skip") as string;
    if (!["skip", "overwrite", "replace_all"].includes(mode)) {
      return res.status(400).json({ message: "โหมดนำเข้าไม่ถูกต้อง" });
    }
    console.log(`[firm-import] Starting import mode=${mode}, file size: ${req.file.size} bytes`);
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูลในไฟล์" });
    console.log(`[firm-import] Found ${rows.length} rows to import`);

    const user = req.user as any;
    const firmPrimaryCompany = await db.select().from(companies).where(and(eq(companies.tenantId, user.tenantId), eq(companies.isPrimary, true))).then(r => r[0]);
    if (!firmPrimaryCompany) return res.status(400).json({ message: "ไม่พบบริษัทหลักของสำนักงาน" });
    const firmCompanyId = firmPrimaryCompany.id;

    let imported = 0, updated = 0, deletedCount = 0;
    const errors: string[] = [];
    const skipped: string[] = [];

    if (mode === "replace_all") {
      const existingAll = await db.select({ id: firmClients.id, companyId: firmClients.companyId }).from(firmClients)
        .innerJoin(companies, eq(firmClients.companyId, companies.id))
        .where(eq(companies.tenantId, user.tenantId));
      for (const fc of existingAll) {
        await db.delete(workStatusRows).where(eq(workStatusRows.firmClientId, fc.id));
        await db.delete(firmClientTeam).where(eq(firmClientTeam.firmClientId, fc.id));
        await db.delete(firmClients).where(eq(firmClients.id, fc.id));
        if (fc.companyId) {
          await db.delete(accounts).where(eq(accounts.companyId, fc.companyId)).catch(() => {});
          await db.delete(companies).where(eq(companies.id, fc.companyId)).catch(() => {});
        }
      }
      deletedCount = existingAll.length;
      console.log(`[firm-import] replace_all: deleted ${deletedCount} existing clients`);
      logActivity({
        companyId: firmCompanyId,
        tenantId: user.tenantId || undefined,
        userId: user.id,
        userName: user.username,
        action: "delete",
        entityType: "firm_client",
        entityId: "replace_all",
        entityName: "import_replace_all",
        details: `นำเข้าแบบแทนที่ทั้งหมด: ลบลูกค้าเดิม ${deletedCount} ราย พร้อมบริษัทและผังบัญชีที่เกี่ยวข้อง`,
      }).catch(() => {});
    }

    const existingFirmClients = await db.select({ id: firmClients.id, name: firmClients.name, taxId: firmClients.taxId }).from(firmClients)
      .innerJoin(companies, eq(firmClients.companyId, companies.id))
      .where(eq(companies.tenantId, user.tenantId));
    const existingByName: Record<string, any> = {};
    existingFirmClients.forEach(c => { if (c.name) existingByName[c.name.toLowerCase()] = c; });
    const existingNames = new Set(Object.keys(existingByName));
    const existingTaxIds = new Set(existingFirmClients.filter(c => c.taxId).map(c => c.taxId!));

    const toCreateRows: { mapped: any; rowNum: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mapped: any = {};
      for (const [excelCol, field] of Object.entries(FIRM_IMPORT_COL_MAP)) {
        mapped[field] = row[excelCol] !== undefined ? String(row[excelCol]).trim() : "";
      }
      if (!mapped.name) { errors.push(`แถว ${i + 2}: ไม่มีชื่อบริษัท`); continue; }

      const nameKey = mapped.name.toLowerCase();
      const existingFc = existingByName[nameKey];

      if (existingFc) {
        if (mode === "overwrite") {
          try {
            await updateFirmClientFromRow(existingFc, mapped);
            updated++;
            console.log(`[firm-import] Row ${i + 2} UPDATED: ${mapped.name}`);
          } catch (err: any) {
            errors.push(`แถว ${i + 2}: อัปเดตไม่สำเร็จ - ${err.message}`);
          }
        } else {
          skipped.push(`แถว ${i + 2}: "${mapped.name}" มีอยู่ในระบบแล้ว (ข้าม)`);
        }
        continue;
      }
      if (mapped.taxId && existingTaxIds.has(mapped.taxId)) {
        skipped.push(`แถว ${i + 2}: เลขภาษี "${mapped.taxId}" ซ้ำ (ข้าม)`);
        continue;
      }
      toCreateRows.push({ mapped, rowNum: i + 2 });
      existingNames.add(nameKey);
      existingByName[nameKey] = { name: mapped.name };
      if (mapped.taxId) existingTaxIds.add(mapped.taxId);
    }

    const IMPORT_BATCH = 50;
    for (let b = 0; b < toCreateRows.length; b += IMPORT_BATCH) {
      const batch = toCreateRows.slice(b, b + IMPORT_BATCH);
      try {
        await db.transaction(async (tx) => {
          const newCompanies = await tx.insert(companies).values(
            batch.map(({ mapped }) => ({
              name: mapped.name, nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null,
              taxId: mapped.taxId || null, address: mapped.address || null, addressEn: mapped.addressEn || null,
              addressZh: mapped.addressZh || null, phone: mapped.phone || null, industry: null, active: true,
              businessType: CHART_TO_BUSINESS_TYPE[
                ["standard", "ecommerce", "service", "trading", "none"].includes(mapped.chartTemplate) ? mapped.chartTemplate : "none"
              ] || "mixed",
              tenantId: user.tenantId || null,
            }))
          ).returning();

          const fcValues = batch.map(({ mapped }, idx) => {
            const template = ["standard", "ecommerce", "service", "trading", "none"].includes(mapped.chartTemplate)
              ? mapped.chartTemplate : "none";
            return {
              name: mapped.name, nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null,
              branch: mapped.branch || "สำนักงานใหญ่", branchEn: mapped.branchEn || null, branchZh: mapped.branchZh || null,
              ownerName: mapped.ownerName || null, ownerNameEn: mapped.ownerNameEn || null, ownerNameZh: mapped.ownerNameZh || null,
              taxId: mapped.taxId || null, contactPerson: mapped.contactPerson || null, phone: mapped.phone || null,
              fax: mapped.fax || null, email: mapped.email || null, website: mapped.website || null,
              address: mapped.address || null, addressEn: mapped.addressEn || null, addressZh: mapped.addressZh || null,
              chartTemplate: template, invoiceCount: mapped.invoiceCount ? Number(mapped.invoiceCount) : 0,
              serviceFee: mapped.serviceFee || "0", whtRate: mapped.whtRate || "3", notes: mapped.notes || null,
              companyId: newCompanies[idx].id,
            };
          });
          const newFcRows = await tx.insert(firmClients).values(fcValues).returning();

          const existingContacts = await tx.select({ id: contacts.id, name: contacts.name }).from(contacts)
            .where(eq(contacts.companyId, firmCompanyId));
          const existingContactNames = new Map(existingContacts.map(c => [c.name?.toLowerCase(), c.id]));
          const maxCodeResult = await tx.select({
            maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS INTEGER)), 0)`
          }).from(contacts)
            .where(and(eq(contacts.companyId, firmCompanyId), sql`code ~ '^C\\d+$'`));
          let nextNum = (maxCodeResult[0]?.maxNum || 0) + 1;

          const contactValues: any[] = [];
          const contactFcMap: number[] = [];
          for (let bIdx = 0; bIdx < batch.length; bIdx++) {
            const { mapped } = batch[bIdx];
            const nameKey = mapped.name?.toLowerCase();
            if (nameKey && existingContactNames.has(nameKey)) {
              await tx.update(firmClients).set({ contactId: existingContactNames.get(nameKey)! }).where(eq(firmClients.id, newFcRows[bIdx].id));
            } else if (nameKey) {
              contactValues.push({
                companyId: firmCompanyId, code: `C${String(nextNum).padStart(4, "0")}`, name: mapped.name,
                nameEn: mapped.nameEn || null, nameZh: mapped.nameZh || null, type: "customer" as const,
                taxId: mapped.taxId || null, branch: mapped.branch || "สำนักงานใหญ่",
                address: mapped.address || null, addressEn: mapped.addressEn || null, addressZh: mapped.addressZh || null,
                phone: mapped.phone || null, email: mapped.email || null, contactPerson: mapped.contactPerson || null,
              });
              contactFcMap.push(bIdx);
              existingContactNames.set(nameKey, -1);
              nextNum++;
            }
          }
          if (contactValues.length > 0) {
            const newContacts = await tx.insert(contacts).values(contactValues).returning();
            for (let cIdx = 0; cIdx < newContacts.length; cIdx++) {
              const bIdx = contactFcMap[cIdx];
              await tx.update(firmClients).set({ contactId: newContacts[cIdx].id }).where(eq(firmClients.id, newFcRows[bIdx].id));
            }
          }
        });
        imported += batch.length;
        console.log(`[firm-import] Batch ${b / IMPORT_BATCH + 1} OK: ${batch.length} rows`);
      } catch (err: any) {
        console.error(`[firm-import] Batch ${b / IMPORT_BATCH + 1} FAILED: ${err.message}`);
        for (const { rowNum } of batch) {
          errors.push(`แถว ${rowNum}: ${err.message}`);
        }
      }
    }

    const modeLabel = mode === "skip" ? "ข้ามซ้ำ" : mode === "overwrite" ? "อัปเดตซ้ำ" : "ล้างและนำเข้าใหม่";
    const parts = [`โหมด: ${modeLabel}`];
    if (imported > 0) parts.push(`สร้างใหม่ ${imported}`);
    if (updated > 0) parts.push(`อัปเดต ${updated}`);
    if (skipped.length > 0) parts.push(`ข้าม ${skipped.length}`);
    if (deletedCount > 0) parts.push(`ลบเก่า ${deletedCount}`);
    if (errors.length > 0) parts.push(`ผิดพลาด ${errors.length}`);
    const message = `นำเข้าสำเร็จ (${parts.join(", ")}) จากทั้งหมด ${rows.length} แถว`;

    await db.insert(firmClientImportLogs).values({
      tenantId: user.tenantId, userId: user.id, userName: user.username || user.username,
      fileName: decodeMulterFilename(req.file.originalname), mode, totalRows: rows.length,
      imported, updated, skipped: skipped.length, deleted: deletedCount,
      errorCount: errors.length, errors: errors.length > 0 ? errors.slice(0, 50) : null,
    });

    console.log(`[firm-import] Done: ${message}`);
    res.json({ message, imported, updated, deleted: deletedCount, total: rows.length, errors, skipped });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "ไม่สามารถอ่านไฟล์ได้" });
  }
});

app.get("/api/firm-clients/import-logs", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const logs = await db.select().from(firmClientImportLogs)
      .where(eq(firmClientImportLogs.tenantId, user.tenantId))
      .orderBy(desc(firmClientImportLogs.createdAt))
      .limit(50);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

}
