import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import { taskAssignees, taskComments, tasks, taskColumns, taskBoardMembers } from "@shared/schema";
import { requireAuth } from "../route-middleware";

export function registerTaskMgmtRoutes(app: Express) {
app.get("/api/task-boards", requireAuth, async (req, res) => {
  try {
    const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
    if (!companyId) return res.json([]);
    const user = req.user as any;
    const allBoards = await storage.getTaskBoards(companyId);
    const visibleBoards = [];
    for (const board of allBoards) {
      if (board.visibility === "private") {
        if (board.createdBy === user.id) {
          visibleBoards.push(board);
        } else {
          const members = await storage.getTaskBoardMembers(board.id);
          if (members.some(m => m.userId === user.id)) {
            visibleBoards.push(board);
          }
        }
      } else {
        visibleBoards.push(board);
      }
    }
    res.json(visibleBoards);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/task-boards", requireAuth, async (req, res) => {
  try {
    const companyId = req.body.companyId ? Number(req.body.companyId) : undefined;
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
    const user = req.user as any;
    const parsed = insertTaskBoardSchema.parse({ ...req.body, companyId, createdBy: user.id });
    const board = await storage.createTaskBoard(parsed);
    await storage.createTaskColumn({ boardId: board.id, name: "รอดำเนินการ", color: "#c4c4c4", sortOrder: 0, isDone: false });
    await storage.createTaskColumn({ boardId: board.id, name: "กำลังทำ", color: "#fec90f", sortOrder: 1, isDone: false });
    await storage.createTaskColumn({ boardId: board.id, name: "เสร็จแล้ว", color: "#05b187", sortOrder: 2, isDone: true });
    res.status(201).json(board);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/task-boards/:id", requireAuth, async (req, res) => {
  try {
    const board = await storage.updateTaskBoard(Number(req.params.id), req.body);
    if (!board) return res.status(404).json({ message: "ไม่พบบอร์ด" });
    res.json(board);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/task-boards/:id", requireAuth, async (req, res) => {
  try {
    const boardId = Number(req.params.id);
    const boardTasks = await storage.getTasks(boardId);
    for (const t of boardTasks) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, t.id));
      await db.delete(taskComments).where(eq(taskComments.taskId, t.id));
    }
    await db.delete(tasks).where(eq(tasks.boardId, boardId));
    await db.delete(taskColumns).where(eq(taskColumns.boardId, boardId));
    await db.delete(taskBoardMembers).where(eq(taskBoardMembers.boardId, boardId));
    await storage.deleteTaskBoard(boardId);
    res.json({ message: "ลบบอร์ดสำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/task-boards/:boardId/members", requireAuth, async (req, res) => {
  try {
    const members = await storage.getTaskBoardMembers(Number(req.params.boardId));
    res.json(members);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/task-boards/:boardId/members", requireAuth, async (req, res) => {
  try {
    const member = await storage.addTaskBoardMember({ boardId: Number(req.params.boardId), userId: req.body.userId, role: req.body.role || "member" });
    res.status(201).json(member);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/task-boards/:boardId/members/:userId", requireAuth, async (req, res) => {
  try {
    await storage.removeTaskBoardMember(Number(req.params.boardId), Number(req.params.userId));
    res.json({ message: "ลบสมาชิกสำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/task-boards/:boardId/columns", requireAuth, async (req, res) => {
  try {
    const columns = await storage.getTaskColumns(Number(req.params.boardId));
    res.json(columns);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/task-boards/:boardId/columns", requireAuth, async (req, res) => {
  try {
    const parsed = insertTaskColumnSchema.parse({ ...req.body, boardId: Number(req.params.boardId) });
    const column = await storage.createTaskColumn(parsed);
    res.status(201).json(column);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/task-columns/:id", requireAuth, async (req, res) => {
  try {
    const column = await storage.updateTaskColumn(Number(req.params.id), req.body);
    if (!column) return res.status(404).json({ message: "ไม่พบคอลัมน์" });
    res.json(column);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/task-columns/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteTaskColumn(Number(req.params.id));
    res.json({ message: "ลบคอลัมน์สำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/task-boards/:boardId/tasks", requireAuth, async (req, res) => {
  try {
    const boardId = Number(req.params.boardId);
    const allTasks = await storage.getTasks(boardId);
    const tasksWithAssignees = await Promise.all(allTasks.map(async (t) => {
      const assignees = await storage.getTaskAssignees(t.id);
      return { ...t, assignees };
    }));
    res.json(tasksWithAssignees);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const companyId = req.body.companyId ? Number(req.body.companyId) : undefined;
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
    const user = req.user as any;
    const parsed = insertTaskSchema.parse({ ...req.body, companyId, createdBy: user.id });
    const task = await storage.createTask(parsed);
    res.status(201).json(task);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const task = await storage.updateTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ message: "ไม่พบงาน" });
    res.json(task);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    await db.delete(taskComments).where(eq(taskComments.taskId, taskId));
    await storage.deleteTask(taskId);
    res.json({ message: "ลบงานสำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/tasks/:taskId/assignees", requireAuth, async (req, res) => {
  try {
    const assignees = await storage.getTaskAssignees(Number(req.params.taskId));
    res.json(assignees);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/tasks/:taskId/assignees", requireAuth, async (req, res) => {
  try {
    const assignee = await storage.addTaskAssignee({ taskId: Number(req.params.taskId), employeeId: req.body.employeeId });
    res.status(201).json(assignee);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/tasks/:taskId/assignees/:employeeId", requireAuth, async (req, res) => {
  try {
    await storage.removeTaskAssignee(Number(req.params.taskId), Number(req.params.employeeId));
    res.json({ message: "ลบผู้รับผิดชอบสำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
  try {
    const comments = await storage.getTaskComments(Number(req.params.taskId));
    res.json(comments);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const parsed = insertTaskCommentSchema.parse({ ...req.body, taskId: Number(req.params.taskId), userId: user.id });
    const comment = await storage.createTaskComment(parsed);
    res.status(201).json(comment);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/task-comments/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteTaskComment(Number(req.params.id));
    res.json({ message: "ลบความคิดเห็นสำเร็จ" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ==================== End Task Management Routes ====================
}
