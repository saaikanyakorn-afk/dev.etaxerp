import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, inArray } from "drizzle-orm";
import { workBoardColumns, workBoardItems, workBoards, firmFolders, firmDocuments, companies, workBoardSubitems, workBoardGroups } from "@shared/schema";
import { requireAuth } from "../route-middleware";
import multer from "multer";
import path from "path";
import { decodeMulterFilename } from "../utils/safe-filename";

async function cleanupBoardSyncedDocuments() {
  try {
    const boardDocs = await db.select({ id: firmDocuments.id, folderId: firmDocuments.folderId })
      .from(firmDocuments).where(eq(firmDocuments.category, "board"));
    if (boardDocs.length === 0) return;

    const docIds = boardDocs.map(d => d.id);
    const folderIds = [...new Set(boardDocs.map(d => d.folderId).filter(Boolean))] as number[];

    await db.delete(firmDocuments).where(inArray(firmDocuments.id, docIds));
    console.log(`[Board cleanup] Deleted ${docIds.length} board-synced documents`);

    for (const fId of folderIds) {
      const remaining = await db.select({ id: firmDocuments.id }).from(firmDocuments)
        .where(eq(firmDocuments.folderId, fId)).then(r => r.length);
      if (remaining === 0) {
        await db.delete(firmFolders).where(eq(firmFolders.id, fId));
        console.log(`[Board cleanup] Deleted empty folder id=${fId}`);
      }
    }
  } catch (e: any) {
    console.error("[Board cleanup] Error:", e.message);
  }
}

export function registerWorkBoardRoutes(app: Express) {
cleanupBoardSyncedDocuments();
// ============ WORK BOARD (Monday.com-style) ============
async function verifyBoardOwnership(boardId: number, res: Response): Promise<any> {
  const board = await storage.getWorkBoard(boardId);
  if (!board) { res.status(404).json({ message: "ไม่พบบอร์ด" }); return null; }
  return board;
}

app.get("/api/work-boards", requireAuth, async (req, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  if (!companyId) return res.json([]);
  const boards = await storage.getWorkBoards(companyId);
  res.json(boards);
});

app.post("/api/work-boards", requireAuth, async (req, res) => {
  const user = req.user as any;
  const companyId = req.body.companyId ? Number(req.body.companyId) : undefined;
  if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
  const board = await storage.createWorkBoard({
    name: req.body.name || "บอร์ดใหม่",
    color: req.body.color || "#539BFF",
    companyId,
    createdBy: user.id,
  });
  await storage.createWorkBoardGroup({ boardId: board.id, name: "กลุ่มใหม่", color: "#539BFF", position: 0 });
  const defaultCols = [
    { boardId: board.id, name: "สถานะ", columnType: "status", position: 0, options: JSON.stringify({ labels: [{ label: "กำลังทำ", color: "#fdab3d" }, { label: "เสร็จแล้ว", color: "#00c875" }, { label: "ติดปัญหา", color: "#e2445c" }, { label: "รอดำเนินการ", color: "#c4c4c4" }] }) },
    { boardId: board.id, name: "ผู้รับผิดชอบ", columnType: "person", position: 1 },
    { boardId: board.id, name: "วันครบกำหนด", columnType: "date", position: 2 },
  ];
  for (const col of defaultCols) await storage.createWorkBoardColumn(col as any);
  res.json(board);
});

app.put("/api/work-boards/:id", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const updated = await storage.updateWorkBoard(board.id, { name: req.body.name, color: req.body.color });
  res.json(updated);
});

app.delete("/api/work-boards/:id", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  await storage.deleteWorkBoard(board.id);
  res.json({ success: true });
});

app.post("/api/work-boards/:id/duplicate", requireAuth, async (req, res) => {
  const user = req.user as any;
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const newBoard = await storage.duplicateWorkBoard(board.id, user.id);
  res.json(newBoard);
});

app.get("/api/work-boards/:id/data", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const [groups, columns, items] = await Promise.all([
    storage.getWorkBoardGroups(board.id),
    storage.getWorkBoardColumns(board.id),
    storage.getWorkBoardItems(board.id),
  ]);
  res.json({ board, groups, columns, items });
});

app.post("/api/work-boards/:id/groups", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const group = await storage.createWorkBoardGroup({ boardId: board.id, name: req.body.name || "กลุ่มใหม่", color: req.body.color || "#539BFF", position: req.body.position ?? 0 });
  res.json(group);
});

app.put("/api/work-board-groups/:id", requireAuth, async (req, res) => {
  const groups = await db.select().from(workBoardGroups).where(eq(workBoardGroups.id, Number(req.params.id)));
  if (!groups.length) return res.status(404).json({ message: "ไม่พบกลุ่ม" });
  const board = await verifyBoardOwnership(groups[0].boardId, res);
  if (!board) return;
  const updated = await storage.updateWorkBoardGroup(groups[0].id, req.body);
  res.json(updated);
});

app.delete("/api/work-board-groups/:id", requireAuth, async (req, res) => {
  const groups = await db.select().from(workBoardGroups).where(eq(workBoardGroups.id, Number(req.params.id)));
  if (!groups.length) return res.status(404).json({ message: "ไม่พบกลุ่ม" });
  const board = await verifyBoardOwnership(groups[0].boardId, res);
  if (!board) return;
  await storage.deleteWorkBoardGroup(groups[0].id);
  res.json({ success: true });
});

app.post("/api/work-boards/:id/columns", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const col = await storage.createWorkBoardColumn({ boardId: board.id, name: req.body.name || "คอลัมน์ใหม่", columnType: req.body.columnType || "text", options: req.body.options, position: req.body.position ?? 0 });
  res.json(col);
});

app.put("/api/work-board-columns/:id", requireAuth, async (req, res) => {
  const cols = await db.select().from(workBoardColumns).where(eq(workBoardColumns.id, Number(req.params.id)));
  if (!cols.length) return res.status(404).json({ message: "ไม่พบคอลัมน์" });
  const board = await verifyBoardOwnership(cols[0].boardId, res);
  if (!board) return;
  const updated = await storage.updateWorkBoardColumn(cols[0].id, req.body);
  res.json(updated);
});

app.put("/api/work-boards/:id/reorder-columns", requireAuth, async (req, res) => {
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const { columnIds } = req.body;
  if (!Array.isArray(columnIds)) return res.status(400).json({ message: "columnIds ต้องเป็น array" });
  for (let i = 0; i < columnIds.length; i++) {
    await db.update(workBoardColumns).set({ position: i }).where(eq(workBoardColumns.id, columnIds[i]));
  }
  res.json({ success: true });
});

app.delete("/api/work-board-columns/:id", requireAuth, async (req, res) => {
  const cols = await db.select().from(workBoardColumns).where(eq(workBoardColumns.id, Number(req.params.id)));
  if (!cols.length) return res.status(404).json({ message: "ไม่พบคอลัมน์" });
  const board = await verifyBoardOwnership(cols[0].boardId, res);
  if (!board) return;
  await storage.deleteWorkBoardColumn(cols[0].id);
  res.json({ success: true });
});

app.post("/api/work-boards/:id/items", requireAuth, async (req, res) => {
  const user = req.user as any;
  const board = await verifyBoardOwnership(Number(req.params.id), res);
  if (!board) return;
  const item = await storage.createWorkBoardItem({ boardId: board.id, name: req.body.name || "รายการใหม่", groupId: req.body.groupId, position: req.body.position ?? 0, cellValues: req.body.cellValues || "{}", createdBy: user.id });
  res.json(item);
});

app.put("/api/work-board-items/:id", requireAuth, async (req, res) => {
  const user = req.user as any;
  const items = await db.select().from(workBoardItems).where(eq(workBoardItems.id, Number(req.params.id)));
  if (!items.length) return res.status(404).json({ message: "ไม่พบรายการ" });
  const oldItem = items[0];
  const board = await verifyBoardOwnership(oldItem.boardId, res);
  if (!board) return;

  const updateData: any = { ...req.body };

  if (req.body.cellValues) {
    try {
      const columns = await db.select().from(workBoardColumns).where(eq(workBoardColumns.boardId, oldItem.boardId));
      const newCv = typeof req.body.cellValues === "string" ? JSON.parse(req.body.cellValues) : req.body.cellValues;

      const firmClientCol = columns.find((c: any) => c.columnType === "firm_client");
      if (firmClientCol) {
        const fcVal = newCv[String(firmClientCol.id)];
        updateData.firmClientId = fcVal ? Number(fcVal) : null;
      }

    } catch (e: any) {
      console.error("[Board item update] cellValues parse error:", e.message);
    }
  }

  const updated = await storage.updateWorkBoardItem(oldItem.id, updateData);
  res.json(updated);
});

app.delete("/api/work-board-items/:id", requireAuth, async (req, res) => {
  const items = await db.select().from(workBoardItems).where(eq(workBoardItems.id, Number(req.params.id)));
  if (!items.length) return res.status(404).json({ message: "ไม่พบรายการ" });
  const board = await verifyBoardOwnership(items[0].boardId, res);
  if (!board) return;
  await storage.deleteWorkBoardItem(items[0].id);
  res.json({ success: true });
});

app.get("/api/board-files-summary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = req.query.companyId ? Number(req.query.companyId) : user.companyId;
    if (!companyId) return res.json([]);
    if (user.role !== "super_admin") {
      const [company] = await db.select({ tenantId: companies.tenantId }).from(companies).where(eq(companies.id, companyId));
      if (!company || (user.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const allBoards = await db.select().from(workBoards).where(eq(workBoards.companyId, companyId));
    if (!allBoards.length) return res.json([]);

    const allBoardIds = allBoards.map(b => b.id);
    const allColumns = await db.select().from(workBoardColumns)
      .where(inArray(workBoardColumns.boardId, allBoardIds));

    const boardsWithClient = new Set(
      allColumns.filter(c => c.columnType === "firm_client").map(c => c.boardId)
    );
    const boards = allBoards.filter(b => boardsWithClient.has(b.id));
    if (!boards.length) return res.json([]);

    const boardIds = boards.map(b => b.id);
    const columns = allColumns.filter(c => boardIds.includes(c.boardId) && c.columnType === "file");
    if (!columns.length) return res.json([]);

    const items = await db.select().from(workBoardItems)
      .where(inArray(workBoardItems.boardId, boardIds));
    const groups = await db.select().from(workBoardGroups)
      .where(inArray(workBoardGroups.boardId, boardIds));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

    const itemIds = items.map(it => it.id);
    const subitems = itemIds.length > 0
      ? await db.select().from(workBoardSubitems).where(inArray(workBoardSubitems.itemId, itemIds))
      : [];
    const itemMap = Object.fromEntries(items.map(it => [it.id, it]));

    const colIdSet = new Set(columns.map(c => c.id));

    function parseCellFiles(cellValues: string | null): Record<number, any[]> {
      const cv: Record<string, any> = (() => { try { return JSON.parse(cellValues || "{}"); } catch { return {}; } })();
      const fileCells: Record<number, any[]> = {};
      for (const [key, raw] of Object.entries(cv)) {
        const colId = Number(key);
        if (!colIdSet.has(colId) || !raw) continue;
        try {
          const p = typeof raw === "string" ? JSON.parse(raw) : raw;
          const arr = Array.isArray(p) ? p : (p?.name || p?.fileName) ? [p] : [];
          if (arr.length) fileCells[colId] = arr;
        } catch {}
      }
      return fileCells;
    }

    const parsedItems = items.map(item => ({ ...item, fileCells: parseCellFiles(item.cellValues) }));
    const parsedSubitems = subitems.map(sub => {
      const parent = itemMap[sub.itemId];
      return { ...sub, boardId: parent?.boardId, groupId: parent?.groupId, parentName: parent?.name, fileCells: parseCellFiles(sub.cellValues) };
    });

    const result = boards.map(board => {
      const boardCols = columns.filter(c => c.boardId === board.id);
      if (!boardCols.length) return null;
      const boardItems = parsedItems.filter(it => it.boardId === board.id);

      const boardSubs = parsedSubitems.filter(s => s.boardId === board.id);

      const folders = boardCols.map(col => {
        const filesInCol: any[] = [];
        for (const item of boardItems) {
          const cellFiles = item.fileCells[col.id];
          if (!cellFiles) continue;
          for (const f of cellFiles) {
            const name = f.name || f.fileName || "unknown";
            const url = f.url || f.path || "";
            if (!url) continue;
            const group = item.groupId ? groupMap[item.groupId] : null;
            filesInCol.push({
              name,
              url,
              itemName: item.name,
              itemId: item.id,
              groupName: group?.name || null,
              groupColor: group?.color || null,
            });
          }
        }
        for (const sub of boardSubs) {
          const cellFiles = sub.fileCells[col.id];
          if (!cellFiles) continue;
          for (const f of cellFiles) {
            const name = f.name || f.fileName || "unknown";
            const url = f.url || f.path || "";
            if (!url) continue;
            const group = sub.groupId ? groupMap[sub.groupId] : null;
            filesInCol.push({
              name,
              url,
              itemName: `${sub.parentName} › ${sub.name}`,
              itemId: sub.itemId,
              subitemId: sub.id,
              groupName: group?.name || null,
              groupColor: group?.color || null,
            });
          }
        }
        return { columnId: col.id, columnName: col.name, files: filesInCol };
      }).filter(f => f.files.length > 0);

      if (!folders.length) return null;
      return {
        boardId: board.id,
        boardName: board.name,
        boardColor: board.color,
        totalFiles: folders.reduce((s, f) => s + f.files.length, 0),
        folders,
      };
    }).filter(Boolean);

    res.json(result);
  } catch (e: any) {
    console.error("[Board files summary] Error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

const wbFileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post("/api/work-board-files/upload", requireAuth, wbFileUpload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "ไม่พบไฟล์" });
    const { saveBufferLocally } = await import("../replit_integrations/object_storage/routes");
    const { objectPath } = saveBufferLocally(req.file.buffer, req.file.mimetype || "application/octet-stream", req.file.originalname);
    res.json({ url: objectPath, fileName: decodeMulterFilename(req.file.originalname) });
  } catch (e: any) {
    console.error("Work board file upload error:", e);
    res.status(500).json({ message: e.message });
  }
});

}
