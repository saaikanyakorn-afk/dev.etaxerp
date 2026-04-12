import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, count , sql } from "drizzle-orm";
import { employees, purchaseInvoices, expenses, notifications, accounts, companies, journalLines } from "@shared/schema";
import { requireAuth, requireModule, checkDocOwnership } from "../route-middleware";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { getChartOfAccounts } from "@shared/chart-of-accounts";
import { makeStorageFilename, decodeMulterFilename } from "../utils/safe-filename";

export function registerWorkStatusRoutes(app: Express) {
// ===== Work Status Tracking (ติดตามสถานะงานบัญชี) =====

// Get or create board for a month/year
app.get("/api/work-status/board", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const month = Number(req.query.month);
    const yearBe = Number(req.query.yearBe);
    if (!month || !yearBe) return res.status(400).json({ message: "กรุณาระบุเดือนและปี" });
    
    let board = await storage.getWorkStatusBoard(user.tenantId, month, yearBe);
    if (!board) {
      board = await storage.createWorkStatusBoard({
        tenantId: user.tenantId,
        month,
        yearBe,
        createdBy: user.id,
      });
      const defaultCols = [
        { key: "receive_docs", label: "รับเอกสาร", fieldType: "status", sortOrder: 0 },
        { key: "record_entries", label: "บันทึกบัญชี", fieldType: "status", sortOrder: 1 },
        { key: "vat_pp30", label: "ภ.พ.30", fieldType: "status", sortOrder: 2 },
        { key: "wht_pnd", label: "ภ.ง.ด.", fieldType: "status", sortOrder: 3 },
        { key: "social_security", label: "ประกันสังคม", fieldType: "status", sortOrder: 4 },
        { key: "close_books", label: "ปิดงบ", fieldType: "status", sortOrder: 5 },
        { key: "deliver", label: "ส่งงาน", fieldType: "status", sortOrder: 6 },
      ];
      for (const col of defaultCols) {
        await storage.createWorkStatusColumn({ ...col, boardId: board.id });
      }
      const allClients = await storage.getFirmClients(user.tenantId);
      for (const client of allClients) {
        await storage.createWorkStatusRow({
          boardId: board.id,
          firmClientId: client.id,
          assignedEmployeeId: client.assignedTo || null,
          overallStatus: "not_started",
        });
      }
    }
    
    const columns = await storage.getWorkStatusColumns(board.id);
    
    const isManager = user.role === "admin" || user.role === "super_admin" || user.role === "owner" || user.role === "manager";
    const empFilter = !isManager && user.employeeId ? user.employeeId : undefined;
    const allClients = await storage.getFirmClients(user.tenantId, empFilter);

    const allRowsForSync = await storage.getWorkStatusRows(board.id);
    const syncUpdates: Array<{ id: number; data: any }> = [];
    for (const row of allRowsForSync) {
      if (row.firmClientId) {
        const client = allClients.find((c: any) => c.id === row.firmClientId);
        if (client && client.assignedTo !== row.assignedEmployeeId) {
          syncUpdates.push({ id: row.id, data: { assignedEmployeeId: client.assignedTo || null } });
        }
      }
    }
    if (syncUpdates.length > 0) {
      await storage.batchUpdateWorkStatusRows(syncUpdates);
    }

    let employeeFilter: number | undefined;
    if (!isManager && user.employeeId) {
      employeeFilter = user.employeeId;
    }
    const rows = syncUpdates.length > 0
      ? await storage.getWorkStatusRows(board.id, employeeFilter)
      : (employeeFilter ? allRowsForSync.filter(r => r.assignedEmployeeId === employeeFilter) : allRowsForSync);

    const rowIds = rows.map(r => r.id);
    const [allCells, allAttachments] = await Promise.all([
      storage.getWorkStatusCellsByRowIds(rowIds),
      storage.getWorkStatusAttachmentsByRowIds(rowIds),
    ]);

    const cellsByRow = new Map<number, any[]>();
    for (const cell of allCells) {
      const arr = cellsByRow.get(cell.rowId) || [];
      arr.push(cell);
      cellsByRow.set(cell.rowId, arr);
    }
    const attachmentsByRow = new Map<number, any[]>();
    for (const att of allAttachments) {
      if (att.rowId) {
        const arr = attachmentsByRow.get(att.rowId) || [];
        arr.push(att);
        attachmentsByRow.set(att.rowId, arr);
      }
    }

    const rowsWithCells = rows.map(row => ({
      ...row,
      cells: cellsByRow.get(row.id) || [],
      attachments: attachmentsByRow.get(row.id) || [],
    }));

    const now = new Date();
    const boardYearCe = yearBe - 543;
    const deadlinePnd = new Date(boardYearCe, month, board.deadlineDayPnd || 7);
    const deadlineVat = new Date(boardYearCe, month, board.deadlineDayVat || 15);
    const latestDeadline = deadlineVat > deadlinePnd ? deadlineVat : deadlinePnd;
    const isOverdue = now > latestDeadline;

    if (isOverdue) {
      const statusCols = columns.filter((c: any) => c.fieldType === "status");
      const overdueUpdates: Array<{ id: number; data: any }> = [];
      for (const row of rowsWithCells) {
        if (row.overallStatus !== "completed" && row.overallStatus !== "overdue") {
          const allDone = statusCols.length > 0 && statusCols.every((col: any) => {
            const cell = row.cells?.find((c: any) => c.columnId === col.id);
            return cell?.valueStatus === "completed";
          });
          if (!allDone) {
            overdueUpdates.push({ id: row.id, data: { overallStatus: "overdue" } });
            row.overallStatus = "overdue";
          }
        }
      }
      if (overdueUpdates.length > 0) {
        await storage.batchUpdateWorkStatusRows(overdueUpdates);
      }
    }

    const allEmployees = await storage.getEmployees(user.tenantId);
    const groups = await storage.getWorkStatusGroups(board.id);
    
    res.json({ board, columns, groups, rows: rowsWithCells, clients: allClients, employees: allEmployees, isManager });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/board/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updateSchema = z.object({ 
      deadlineDay: z.number().min(1).max(31).optional(), 
      notifyDaysBefore: z.number().min(1).max(30).optional(),
      deadlineDayPnd: z.number().min(1).max(31).optional(),
      notifyDaysBeforePnd: z.number().min(1).max(30).optional(),
      deadlineDayVat: z.number().min(1).max(31).optional(),
      notifyDaysBeforeVat: z.number().min(1).max(30).optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    const board = await storage.updateWorkStatusBoard(id, parsed.data);
    res.json(board);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Work Status Groups
app.post("/api/work-status/groups", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const { boardId, name, color } = req.body;
    if (!boardId || !name) return res.status(400).json({ message: "กรุณาระบุชื่อกรุ๊ป" });
    const existing = await storage.getWorkStatusGroups(boardId);
    const group = await storage.createWorkStatusGroup({ boardId, name, color: color || "#05b187", sortOrder: existing.length, isCollapsed: false });
    res.status(201).json(group);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/groups/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const group = await storage.updateWorkStatusGroup(id, req.body);
    res.json(group);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/work-status/groups/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await storage.deleteWorkStatusGroup(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk actions for rows
app.post("/api/work-status/rows/bulk", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const { action, rowIds, targetGroupId } = req.body;
    if (!action || !rowIds || !Array.isArray(rowIds) || rowIds.length === 0) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (action === "move") {
      for (const id of rowIds) {
        await storage.updateWorkStatusRow(id, { groupId: targetGroupId || null });
      }
      res.json({ success: true, message: `ย้าย ${rowIds.length} รายการสำเร็จ` });
    } else if (action === "copy") {
      for (const id of rowIds) {
        const row = await storage.getWorkStatusRow(id);
        if (row) {
          const newRow = await storage.createWorkStatusRow({
            boardId: row.boardId,
            groupId: targetGroupId ?? row.groupId,
            firmClientId: row.firmClientId,
            parentRowId: null,
            label: row.label,
            sortOrder: row.sortOrder,
            assignedEmployeeId: row.assignedEmployeeId,
            deadline: row.deadline,
            overallStatus: row.overallStatus,
            employeeNote: row.employeeNote,
            managerNote: row.managerNote,
          });
          const cells = await storage.getWorkStatusCells(id);
          for (const cell of cells) {
            await storage.upsertWorkStatusCell(newRow.id, cell.columnId, {
              valueText: cell.valueText,
              valueDate: cell.valueDate,
              valueBool: cell.valueBool,
              valueStatus: cell.valueStatus,
            });
          }
        }
      }
      res.json({ success: true, message: `คัดลอก ${rowIds.length} รายการสำเร็จ` });
    } else if (action === "delete") {
      for (const id of rowIds) {
        await storage.deleteWorkStatusRow(id);
      }
      res.json({ success: true, message: `ลบ ${rowIds.length} รายการสำเร็จ` });
    } else {
      return res.status(400).json({ message: "action ไม่ถูกต้อง" });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/work-status/columns", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const parsed = insertWorkStatusColumnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
    const col = await storage.createWorkStatusColumn(parsed.data);
    res.status(201).json(col);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/columns/reorder", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const { columnIds } = req.body;
    if (!Array.isArray(columnIds)) return res.status(400).json({ message: "columnIds ต้องเป็น array" });
    for (let i = 0; i < columnIds.length; i++) {
      await storage.updateWorkStatusColumn(columnIds[i], { sortOrder: i });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/columns/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const col = await storage.updateWorkStatusColumn(id, req.body);
    res.json(col);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/work-status/columns/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await storage.deleteWorkStatusColumn(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/work-status/rows", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const row = await storage.createWorkStatusRow(req.body);
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/rows/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rowUpdateSchema = z.object({
      assignedEmployeeId: z.number().nullable().optional(),
      overallStatus: z.string().optional(),
      employeeNote: z.string().optional(),
      managerNote: z.string().optional(),
    });
    const parsed = rowUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    const row = await storage.updateWorkStatusRow(id, parsed.data);
    if (parsed.data.assignedEmployeeId !== undefined && row.firmClientId) {
      await storage.updateFirmClient(row.firmClientId, { assignedTo: parsed.data.assignedEmployeeId });
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/work-status/rows/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await storage.deleteWorkStatusRow(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/work-status/cells", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const cellSchema = z.object({
      rowId: z.number(),
      columnId: z.number(),
      valueStatus: z.string().optional(),
      valueDate: z.string().optional(),
      valueText: z.string().optional(),
      valueBool: z.boolean().optional(),
    });
    const parsed = cellSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    const { rowId, columnId, ...data } = parsed.data;
    const user = req.user as any;
    const cell = await storage.upsertWorkStatusCell(rowId, columnId, { ...data, updatedBy: user.id });
    
    if (data.valueStatus) {
      const row = await storage.getWorkStatusRow(rowId);
      if (row) {
        const allCells = await storage.getWorkStatusCells(rowId);
        const board = await storage.getWorkStatusBoardById(row.boardId);
        const cols = await storage.getWorkStatusColumns(row.boardId);
        const statusCols = cols.filter((c: any) => c.fieldType === "status");
        if (statusCols.length > 0) {
          const allCompleted = statusCols.every((col: any) => {
            const c = allCells.find((cl: any) => cl.columnId === col.id);
            return c?.value === "completed";
          });
          const anyInProgress = statusCols.some((col: any) => {
            const c = allCells.find((cl: any) => cl.columnId === col.id);
            return c?.value === "in_progress";
          });
          if (allCompleted) {
            await storage.updateWorkStatusRow(rowId, { overallStatus: "completed" });
          } else if (anyInProgress || data.valueStatus === "in_progress") {
            const now = new Date();
            const deadlineDay = board?.deadlineDay || 15;
            const boardYearCe = (board?.yearBe || 2569) - 543;
            const boardMonth = board?.month || 1;
            const deadlineDate = new Date(boardYearCe, boardMonth, deadlineDay);
            if (now > deadlineDate) {
              await storage.updateWorkStatusRow(rowId, { overallStatus: "overdue" });
            } else {
              await storage.updateWorkStatusRow(rowId, { overallStatus: "in_progress" });
            }
          }
        }
      }
    }
    
    res.json(cell);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const uploadWorkStatus = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post("/api/work-status/import-excel", requireAuth, requireModule("firm-mgmt"), uploadWorkStatus.single("file"), async (req, res) => {
  try {
    const user = req.user as any;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ Excel" });
    const boardId = Number(req.body.boardId);
    if (!boardId) return res.status(400).json({ message: "กรุณาระบุ boardId" });

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (jsonData.length === 0) return res.status(400).json({ message: "ไฟล์ไม่มีข้อมูล" });

    const headers = Object.keys(jsonData[0]);
    const taxIdCol = headers.find(h => /tax.?id|เลขผู้เสียภาษี|เลขประจำตัวผู้เสียภาษี|tax_id|taxId/i.test(h));
    if (!taxIdCol) return res.status(400).json({ message: "ไม่พบคอลัมน์เลขผู้เสียภาษีในไฟล์ กรุณาใส่คอลัมน์ชื่อ 'เลขผู้เสียภาษี' หรือ 'taxId'" });

    const dataColumns = headers.filter(h => h !== taxIdCol);
    if (dataColumns.length === 0) return res.status(400).json({ message: "ไม่พบคอลัมน์ข้อมูลอื่นนอกจากเลขผู้เสียภาษี" });

    const preview = req.body.preview === "true" || req.body.preview === true;

    const allClients = await storage.getFirmClients(user.tenantId);
    const clientByTaxId = new Map<string, any>();
    for (const c of allClients) {
      if (c.taxId) clientByTaxId.set(c.taxId.replace(/-/g, "").trim(), c);
    }

    const rows = await storage.getWorkStatusRows(boardId);
    const rowByClientId = new Map<number, any>();
    for (const r of rows) {
      if (r.firmClientId) rowByClientId.set(r.firmClientId, r);
    }

    const matchResults: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const row of jsonData) {
      const rawTaxId = String(row[taxIdCol] || "").replace(/-/g, "").trim();
      const client = clientByTaxId.get(rawTaxId);
      const boardRow = client ? rowByClientId.get(client.id) : null;

      if (client && boardRow) {
        matchedCount++;
        const values: Record<string, string> = {};
        for (const col of dataColumns) {
          values[col] = String(row[col] || "");
        }
        matchResults.push({
          taxId: rawTaxId,
          clientName: client.name,
          clientId: client.id,
          rowId: boardRow.id,
          matched: true,
          values,
        });
      } else {
        unmatchedCount++;
        matchResults.push({
          taxId: rawTaxId,
          clientName: null,
          clientId: null,
          rowId: null,
          matched: false,
          values: {},
        });
      }
    }

    if (preview) {
      return res.json({
        preview: true,
        totalRows: jsonData.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        dataColumns,
        results: matchResults,
      });
    }

    const existingColumns = await storage.getWorkStatusColumns(boardId);
    const maxSort = existingColumns.reduce((m, c) => Math.max(m, c.sortOrder), 0);

    const columnMap = new Map<string, number>();
    for (let i = 0; i < dataColumns.length; i++) {
      const colName = dataColumns[i];
      const existCol = existingColumns.find(c => c.key === `import_${colName.replace(/\s+/g, "_").toLowerCase()}` || c.label === colName);
      if (existCol) {
        columnMap.set(colName, existCol.id);
      } else {
        const newCol = await storage.createWorkStatusColumn({
          boardId,
          key: `import_${colName.replace(/\s+/g, "_").toLowerCase()}`,
          label: colName,
          fieldType: "text",
          sortOrder: maxSort + i + 1,
        });
        columnMap.set(colName, newCol.id);
      }
    }

    let updatedCells = 0;
    for (const match of matchResults) {
      if (!match.matched || !match.rowId) continue;
      for (const [colName, value] of Object.entries(match.values)) {
        const columnId = columnMap.get(colName);
        if (columnId && value) {
          await storage.upsertWorkStatusCell(match.rowId, columnId, {
            valueText: String(value),
            updatedBy: user.id,
          });
          updatedCells++;
        }
      }
    }

    res.json({
      success: true,
      totalRows: jsonData.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      columnsCreated: dataColumns.length - existingColumns.filter(c => dataColumns.some(d => c.label === d)).length,
      cellsUpdated: updatedCells,
      unmatchedTaxIds: matchResults.filter(r => !r.matched).map(r => r.taxId),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/work-status/attachments", requireAuth, requireModule("firm-mgmt"), uploadWorkStatus.single("file"), async (req, res) => {
  try {
    const user = req.user as any;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "ไม่พบไฟล์" });
    
    const cellId = req.body.cellId ? Number(req.body.cellId) : null;
    const rowId = req.body.rowId ? Number(req.body.rowId) : null;
    
    let fileUrl = "";
    {
      const { saveBufferToPath } = await import("../replit_integrations/object_storage/routes");
      const { safeFilename: safeWsName } = makeStorageFilename(file.originalname);
      const key = `work-status/${safeWsName}`;
      saveBufferToPath(file.buffer, key);
      fileUrl = key;
    }
    
    const attachment = await storage.createWorkStatusAttachment({
      cellId,
      rowId,
      fileName: decodeMulterFilename(file.originalname),
      fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: user.id,
    });
    res.status(201).json(attachment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/work-status/attachments/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await storage.deleteWorkStatusAttachment(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Firm Folders & Documents (คลังเอกสาร)
app.get("/api/firm-folders", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
    const excludeBoard = req.query.excludeBoard === "1";
    let folders = await storage.getFirmFolders(user.tenantId, companyId);
    if (excludeBoard) {
      const boardFolderIds = new Set(
        (await db.select({ folderId: firmDocuments.folderId }).from(firmDocuments)
          .where(and(eq(firmDocuments.tenantId, user.tenantId), eq(firmDocuments.category, "board")))
        ).map(r => r.folderId).filter(Boolean)
      );
      folders = folders.filter(f => !boardFolderIds.has(f.id));
    }
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/firm-folders", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const { name, parentId, icon, color, companyId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "กรุณาระบุชื่อโฟลเดอร์" });
    if (parentId) {
      const cid = companyId ? Number(companyId) : undefined;
      const folders = await storage.getFirmFolders(user.tenantId, cid);
      const parent = folders.find(f => f.id === parentId);
      if (!parent) return res.status(404).json({ message: "ไม่พบโฟลเดอร์หลัก" });
    }
    const folder = await storage.createFirmFolder({
      tenantId: user.tenantId,
      companyId: companyId ? Number(companyId) : null,
      parentId: parentId || null,
      name: name.trim(),
      icon: icon || null,
      color: color || null,
      sortOrder: 0,
    });
    res.status(201).json(folder);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/firm-folders/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const folders = await storage.getFirmFolders(user.tenantId);
    if (!folders.find(f => f.id === id)) return res.status(404).json({ message: "ไม่พบโฟลเดอร์" });
    const { name, icon, color } = req.body;
    const folder = await storage.updateFirmFolder(id, { name, icon, color });
    res.json(folder);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/firm-folders/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const folders = await storage.getFirmFolders(user.tenantId);
    if (!folders.find(f => f.id === id)) return res.status(404).json({ message: "ไม่พบโฟลเดอร์" });
    await storage.deleteFirmFolder(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/firm-documents", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const category = req.query.category as string | undefined;
    const folderId = req.query.folderId as string | undefined;
    const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
    const excludeBoard = req.query.excludeBoard === "1";
    if (folderId !== undefined) {
      let docs = await storage.getFirmDocumentsByFolder(user.tenantId, folderId === "null" ? null : Number(folderId), companyId);
      if (excludeBoard) docs = docs.filter(d => d.category !== "board");
      return res.json(docs);
    }
    if (category === "board") {
      const docs = await storage.getFirmDocuments(user.tenantId, "board", companyId);
      return res.json(docs);
    }
    let docs = await storage.getFirmDocuments(user.tenantId, category, companyId);
    if (excludeBoard) docs = docs.filter(d => d.category !== "board");
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const uploadFirmDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/api/firm-documents", requireAuth, requireModule("firm-mgmt"), uploadFirmDoc.single("file"), async (req, res) => {
  try {
    const user = req.user as any;
    const { category, name, description, linkUrl, linkType, sortOrder, folderId, companyId } = req.body;
    const file = req.file;

    if (!name || !name.trim()) return res.status(400).json({ message: "กรุณาระบุชื่อเอกสาร" });
    if (!file && !linkUrl) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์หรือระบุลิงก์" });
    if (folderId) {
      const folders = await storage.getFirmFolders(user.tenantId);
      if (!folders.find((f: any) => f.id === Number(folderId))) return res.status(400).json({ message: "โฟลเดอร์ไม่ถูกต้อง" });
    }

    let fileUrl = undefined;
    let fileName = undefined;
    let fileSize = undefined;
    let mimeType = undefined;

    if (file) {
      {
        const { saveBufferToPath } = await import("../replit_integrations/object_storage/routes");
        const { safeFilename: safeFdName } = makeStorageFilename(file.originalname);
        const key = `firm-documents/${safeFdName}`;
        saveBufferToPath(file.buffer, key);
        fileUrl = key;
      }
      fileName = decodeMulterFilename(file.originalname);
      fileSize = file.size;
      mimeType = file.mimetype;
    }

    const doc = await storage.createFirmDocument({
      tenantId: user.tenantId,
      companyId: companyId ? Number(companyId) : null,
      folderId: folderId ? Number(folderId) : null,
      category: category || "general",
      name,
      description: description || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      mimeType: mimeType || null,
      linkUrl: linkUrl || null,
      linkType: linkType || null,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      uploadedBy: user.id,
    });
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/firm-documents/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const docs = await storage.getFirmDocuments(user.tenantId);
    const existing = docs.find(d => d.id === id);
    if (!existing) return res.status(404).json({ message: "ไม่พบเอกสาร" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const { name, description, linkUrl } = req.body;
    const doc = await storage.updateFirmDocument(id, { name, description, linkUrl });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/firm-documents/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const docs = await storage.getFirmDocuments(user.tenantId);
    const existing = docs.find(d => d.id === id);
    if (!existing) return res.status(404).json({ message: "ไม่พบเอกสาร" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    await storage.deleteFirmDocument(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/firm-documents/download/:id", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const docs = await storage.getFirmDocuments((req.user as any).tenantId);
    const doc = docs.find(d => d.id === id);
    if (!doc || !doc.fileUrl) return res.status(404).json({ message: "ไม่พบไฟล์" });

    const isInline = req.query.inline === "1";
    const disposition = isInline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(doc.fileName || "file");

    const { getLocalFilePath, readFromPath, getFullLocalPath } = await import("../replit_integrations/object_storage/routes");
    const fileId = doc.fileUrl.replace(/.*\//, "");
    const localPath = getLocalFilePath(fileId);
    if (localPath) {
      res.setHeader("Content-Disposition", `${disposition}; filename="${encodedName}"`);
      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      fs.createReadStream(localPath).pipe(res);
    } else {
      const fileData = readFromPath(doc.fileUrl);
      if (fileData) {
        res.setHeader("Content-Disposition", `${disposition}; filename="${encodedName}"`);
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.send(fileData);
      } else {
        const fullLocal = getFullLocalPath(`firm-documents/${path.basename(doc.fileUrl)}`);
        if (fs.existsSync(fullLocal)) {
          res.download(fullLocal, doc.fileName || "file");
        } else {
          res.status(404).json({ message: "ไม่พบไฟล์" });
        }
      }
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/accounting-attachments", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const docType = req.query.docType as string | undefined;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const buildConditions = () => {
      const conds: any[] = [
        sql`attached_url IS NOT NULL`,
        sql`attached_url != ''`,
        sql`company_id = ${companyId}`,
      ];
      return conds;
    };

    const results: any[] = [];

    if (!docType || docType === "ap") {
      const conds = buildConditions();
      const apRows = await db.select({
        id: purchaseInvoices.id,
        companyId: purchaseInvoices.companyId,
        docNo: purchaseInvoices.apNo,
        docDate: purchaseInvoices.apDate,
        vendorName: purchaseInvoices.vendorName,
        totalAmount: purchaseInvoices.totalAmount,
        attachedUrl: purchaseInvoices.attachedUrl,
        status: purchaseInvoices.status,
        createdAt: purchaseInvoices.createdAt,
      }).from(purchaseInvoices).where(and(...conds));
      apRows.forEach((r: any) => results.push({ ...r, docType: "ap" }));
    }

    if (!docType || docType === "expense") {
      const conds = buildConditions();
      const expRows = await db.select({
        id: expenses.id,
        companyId: expenses.companyId,
        docNo: expenses.expNo,
        docDate: expenses.expDate,
        vendorName: expenses.vendorName,
        totalAmount: expenses.totalAmount,
        attachedUrl: expenses.attachedUrl,
        status: expenses.status,
        createdAt: expenses.createdAt,
      }).from(expenses).where(and(...conds));
      expRows.forEach((r: any) => results.push({ ...r, docType: "expense" }));
    }

    results.sort((a, b) => {
      const da = a.docDate || "";
      const db2 = b.docDate || "";
      return da > db2 ? -1 : da < db2 ? 1 : 0;
    });

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/work-status/export", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const month = Number(req.query.month);
    const yearBe = Number(req.query.yearBe);
    const board = await storage.getWorkStatusBoard(user.tenantId, month, yearBe);
    if (!board) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    
    const columns = await storage.getWorkStatusColumns(board.id);
    const rows = await storage.getWorkStatusRows(board.id);
    const allClients = await storage.getFirmClients(user.tenantId);
    const allEmployees = await storage.getEmployees(user.tenantId);
    
    const statusMap: Record<string, string> = {
      not_started: "ยังไม่เริ่ม",
      in_progress: "กำลังทำ",
      completed: "เสร็จแล้ว",
      overdue: "เกินกำหนด",
      waiting: "รอคิว",
    };
    
    const headerRow = ["ลูกค้า", "ผู้รับผิดชอบ", ...columns.map(c => c.label), "โน้ตพนักงาน", "โน้ตผู้จัดการ"];
    const dataRows = await Promise.all(rows.map(async (row) => {
      const client = allClients.find((c: any) => c.id === row.firmClientId);
      const emp = allEmployees.find((e: any) => e.id === row.assignedEmployeeId);
      const cells = await storage.getWorkStatusCells(row.id);
      const cellValues = columns.map(col => {
        const cell = cells.find(c => c.columnId === col.id);
        if (!cell) return "";
        if (col.fieldType === "status") return statusMap[cell.valueStatus || ""] || cell.valueStatus || "";
        if (col.fieldType === "date") return cell.valueDate || "";
        if (col.fieldType === "checkbox") return cell.valueBool ? "✓" : "";
        return cell.valueText || "";
      });
      return [client?.name || "", emp?.fullName || "", ...cellValues, row.employeeNote || "", row.managerNote || ""];
    }));
    
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${month}-${yearBe}`);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Disposition", `attachment; filename=work-status-${month}-${yearBe}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(Buffer.from(buf));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/work-status/send-notifications", requireAuth, requireModule("firm-mgmt"), async (req, res) => {
  try {
    const user = req.user as any;
    const month = Number(req.body.month);
    const yearBe = Number(req.body.yearBe);
    const board = await storage.getWorkStatusBoard(user.tenantId, month, yearBe);
    if (!board) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    
    const rows = await storage.getWorkStatusRows(board.id);
    const allClients = await storage.getFirmClients(user.tenantId);
    const columns = await storage.getWorkStatusColumns(board.id);
    
    const pndKeys = ["wht_pnd", "social_security"];
    const vatKeys = ["vat_pp30"];
    
    const now = new Date();
    const boardYearCe = yearBe - 543;
    const deadlinePnd = new Date(boardYearCe, month, board.deadlineDayPnd || 7);
    const deadlineVat = new Date(boardYearCe, month, board.deadlineDayVat || 15);
    const notifyPndDate = new Date(deadlinePnd);
    notifyPndDate.setDate(notifyPndDate.getDate() - (board.notifyDaysBeforePnd || 3));
    const notifyVatDate = new Date(deadlineVat);
    notifyVatDate.setDate(notifyVatDate.getDate() - (board.notifyDaysBeforeVat || 3));
    
    const shouldNotifyPnd = now >= notifyPndDate;
    const shouldNotifyVat = now >= notifyVatDate;
    
    let notified = 0;
    for (const row of rows) {
      if (row.overallStatus === "completed") continue;
      const cells = await storage.getWorkStatusCells(row.id);
      const client = allClients.find((c: any) => c.id === row.firmClientId);
      
      if (shouldNotifyPnd) {
        const pndCols = columns.filter(col => col.fieldType === "status" && pndKeys.includes(col.key));
        const incompletePnd = pndCols.filter(col => {
          const cell = cells.find(c => c.columnId === col.id);
          return !cell || cell.valueStatus !== "completed";
        });
        if (incompletePnd.length > 0 && row.assignedEmployeeId) {
          const taskList = incompletePnd.map(c => c.label).join(", ");
          const emp = await db.select().from(employees).where(eq(employees.id, row.assignedEmployeeId));
          if (emp[0]?.userId) {
            await db.insert(notifications).values({
              companyId: user.companyId || 1, tenantId: user.tenantId, userId: emp[0].userId,
              type: "work_status_reminder",
              title: `ภงด./ประกันสังคม ค้าง: ${client?.name || ""}`,
              message: `ลูกค้า ${client?.name || ""} ยังไม่เสร็จ: ${taskList} กำหนด ${board.deadlineDayPnd || 7}/${month + 1 > 12 ? 1 : month + 1}/${yearBe} (${month}/${yearBe})`,
              link: "/firm-mgmt/workflow",
            });
            notified++;
          }
        }
      }
      
      if (shouldNotifyVat) {
        const vatCols = columns.filter(col => col.fieldType === "status" && vatKeys.includes(col.key));
        const incompleteVat = vatCols.filter(col => {
          const cell = cells.find(c => c.columnId === col.id);
          return !cell || cell.valueStatus !== "completed";
        });
        if (incompleteVat.length > 0 && row.assignedEmployeeId) {
          const taskList = incompleteVat.map(c => c.label).join(", ");
          const emp = await db.select().from(employees).where(eq(employees.id, row.assignedEmployeeId));
          if (emp[0]?.userId) {
            await db.insert(notifications).values({
              companyId: user.companyId || 1, tenantId: user.tenantId, userId: emp[0].userId,
              type: "work_status_reminder",
              title: `ภ.พ.30 ค้าง: ${client?.name || ""}`,
              message: `ลูกค้า ${client?.name || ""} ยังไม่เสร็จ: ${taskList} กำหนด ${board.deadlineDayVat || 15}/${month + 1 > 12 ? 1 : month + 1}/${yearBe} (${month}/${yearBe})`,
              link: "/firm-mgmt/workflow",
            });
            notified++;
          }
        }
      }
      
      const otherCols = columns.filter(col => col.fieldType === "status" && !pndKeys.includes(col.key) && !vatKeys.includes(col.key));
      const incompleteOther = otherCols.filter(col => {
        const cell = cells.find(c => c.columnId === col.id);
        return !cell || cell.valueStatus !== "completed";
      });
      if (incompleteOther.length > 0 && row.assignedEmployeeId) {
        const taskList = incompleteOther.map(c => c.label).join(", ");
        const emp = await db.select().from(employees).where(eq(employees.id, row.assignedEmployeeId));
        if (emp[0]?.userId) {
          await db.insert(notifications).values({
            companyId: user.companyId || 1, tenantId: user.tenantId, userId: emp[0].userId,
            type: "work_status_reminder",
            title: `งานค้าง: ${client?.name || ""}`,
            message: `ลูกค้า ${client?.name || ""} ยังไม่เสร็จ: ${taskList} (${month}/${yearBe})`,
            link: "/firm-mgmt/workflow",
          });
          notified++;
        }
      }
    }
    
    res.json({ message: `ส่งแจ้งเตือนแล้ว ${notified} รายการ` });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/accounts", requireAuth, async (req, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  const accts = await storage.getAccounts(companyId);
  res.json(accts);
});

app.post("/api/accounts", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const parsed = insertAccountSchema.parse(req.body);
    const account = await storage.createAccount(parsed);
    res.status(201).json(account);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/accounts/:id", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user as any;
    const [existing] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!existing) return res.status(404).json({ message: "ไม่พบบัญชี" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (user.role !== "super_admin" && existing.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขบัญชีนี้" });
    }
    const { code, name, nameTh, nameZh, type, parentCode, active } = req.body;
    const [updated] = await db.update(accounts).set({
      ...(code !== undefined && { code }),
      ...(name !== undefined && { name }),
      ...(nameTh !== undefined && { nameTh }),
      ...(nameZh !== undefined && { nameZh }),
      ...(type !== undefined && { type }),
      ...(parentCode !== undefined && { parentCode }),
      ...(active !== undefined && { active }),
    }).where(eq(accounts.id, id)).returning();
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/accounts/:id", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user as any;
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!acc) return res.status(404).json({ message: "ไม่พบบัญชี" });
    if (user.role !== "super_admin" && acc.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, acc.companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์ลบบัญชีนี้" });
    }
    const [usedInJournal] = await db.select({ count: sql<number>`count(*)` }).from(journalLines).where(eq(journalLines.accountId, id));
    if (usedInJournal && Number(usedInJournal.count) > 0) {
      return res.status(400).json({ message: "ไม่สามารถลบบัญชีนี้ได้ เนื่องจากมีการใช้งานในรายการบัญชี" });
    }
    await db.delete(accounts).where(eq(accounts.id, id));
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.post("/api/accounts/seed-standard", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, template: tpl } = req.body;
    if (!companyId) return res.status(400).json({ message: "กรุณาเลือกบริษัท" });
    const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.companyId, companyId)).limit(1);
    if (existing.length > 0) return res.status(400).json({ message: "บริษัทนี้มีผังบัญชีอยู่แล้ว" });
    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });
    const { getChartOfAccounts } = await import("@shared/chart-of-accounts");
    const templateAccounts = getChartOfAccounts(tpl || company.businessType || "general");
    if (templateAccounts.length === 0) return res.status(400).json({ message: "ไม่พบผังบัญชีมาตรฐาน" });
    const chartAccounts = templateAccounts.map((acc) => ({
      companyId,
      code: acc.code,
      name: acc.name,
      nameTh: acc.nameTh,
      nameZh: acc.nameZh,
      type: acc.type,
      parentCode: acc.parentCode,
      isHeader: acc.isHeader,
    }));
    await db.insert(accounts).values(chartAccounts);
    await storage.seedDefaultFormulas(companyId, tpl || company.businessType || "general");
    res.json({ success: true, count: chartAccounts.length });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

}
