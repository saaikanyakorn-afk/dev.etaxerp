import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { companies, employees, workBoards, workBoardItems, workBoardColumns, workStatusBoards, workStatusColumns, workStatusRows, attendanceRecords, otRecords } from "@shared/schema";
import { requireAuth, checkDocOwnership } from "../route-middleware";
import OpenAI from "openai";

export function registerAiPerformanceRoutes(app: Express) {
// ============ AI Performance Evaluation ============

// ============ AI Performance Evaluation ============
app.get("/api/evaluation-periods", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const periods = await storage.getEvaluationPeriods(companyId);
    res.json(periods);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/evaluation-periods/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const period = await storage.getEvaluationPeriod(Number(req.params.id));
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    res.json(period);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/evaluation-periods", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [verifyCompany] = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.tenantId, user.tenantId)));
    if (!verifyCompany) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const data = { ...req.body, companyId, createdBy: user.id };
    console.log("[EVAL-CREATE] data:", JSON.stringify(data));
    const period = await storage.createEvaluationPeriod(data);
    console.log("[EVAL-CREATE] result:", JSON.stringify(period));
    res.json(period);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch("/api/evaluation-periods/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const existing = await storage.getEvaluationPeriod(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [existingCompany] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
    if (!existingCompany || existingCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const { companyId, ...updateData } = req.body;
    const period = await storage.updateEvaluationPeriod(Number(req.params.id), updateData);
    res.json(period);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/evaluation-periods/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const existing = await storage.getEvaluationPeriod(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [existingCompany] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
    if (!existingCompany || existingCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    await storage.deleteEvaluationPeriod(Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/evaluation-results", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const periodId = Number(req.query.periodId);
    if (!periodId) return res.status(400).json({ message: "periodId is required" });
    const period = await storage.getEvaluationPeriod(periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const results = await storage.getEvaluationResults(periodId);
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch("/api/evaluation-results/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const existing = await storage.getEvaluationResult(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "ไม่พบผลประเมิน" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const period = await storage.getEvaluationPeriod(existing.periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const result = await storage.updateEvaluationResult(Number(req.params.id), req.body);
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/evaluation-periods/:id/run-ai", requireAuth, async (req, res) => {
  try {
    if (!openai) return res.status(500).json({ message: "OpenAI API key not configured" });
    const user = req.user as any;
    const periodId = Number(req.params.id);
    const period = await storage.getEvaluationPeriod(periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const companyId = period.companyId;
    const companyEmps = await db.select().from(employees).where(eq(employees.active, true));

    const empIds = companyEmps.map(e => e.id);
    const startDate = period.startDate;
    const endDate = period.endDate;

    const allAttendance = empIds.length > 0
      ? await db.select().from(attendanceRecords)
          .where(and(gte(attendanceRecords.date, startDate), lte(attendanceRecords.date, endDate), inArray(attendanceRecords.employeeId, empIds)))
      : [];

    const allOT = empIds.length > 0
      ? await db.select().from(otRecords)
          .where(and(gte(otRecords.date, startDate), lte(otRecords.date, endDate), inArray(otRecords.employeeId, empIds)))
      : [];

    const boards = await db.select().from(workBoards).where(eq(workBoards.companyId, companyId));
    const boardIds = boards.map(b => b.id);
    let allBoardItems: any[] = [];
    let allBoardColumns: any[] = [];
    if (boardIds.length > 0) {
      allBoardItems = await db.select().from(workBoardItems).where(inArray(workBoardItems.boardId, boardIds));
      allBoardColumns = await db.select().from(workBoardColumns).where(inArray(workBoardColumns.boardId, boardIds));
    }

    const statusWorkBoards = await db.select().from(workStatusBoards).where(eq(workStatusBoards.tenantId, user.tenantId));
    const statusBoardIds = statusWorkBoards.map(b => b.id);
    let allStatusRows: any[] = [];
    let allStatusCells: any[] = [];
    let allStatusColumns: any[] = [];
    if (statusBoardIds.length > 0) {
      allStatusRows = await db.select().from(workStatusRows).where(inArray(workStatusRows.boardId, statusBoardIds));
      allStatusCells = await db.select().from(workStatusCells).where(inArray(workStatusCells.rowId, allStatusRows.map(r => r.id)));
      allStatusColumns = await db.select().from(workStatusColumns).where(inArray(workStatusColumns.boardId, statusBoardIds));
    }

    const salaryRules = (period.salaryRules || []) as any[];
    const defaultRules = salaryRules.length > 0 ? salaryRules : [
      { minScore: 4.5, maxScore: 5.0, increasePercent: 8, bonusMonths: 3, grade: "A+" },
      { minScore: 4.0, maxScore: 4.49, increasePercent: 6, bonusMonths: 2.5, grade: "A" },
      { minScore: 3.5, maxScore: 3.99, increasePercent: 4, bonusMonths: 2, grade: "B+" },
      { minScore: 3.0, maxScore: 3.49, increasePercent: 3, bonusMonths: 1.5, grade: "B" },
      { minScore: 2.5, maxScore: 2.99, increasePercent: 2, bonusMonths: 1, grade: "C+" },
      { minScore: 2.0, maxScore: 2.49, increasePercent: 0, bonusMonths: 0.5, grade: "C" },
      { minScore: 0, maxScore: 1.99, increasePercent: 0, bonusMonths: 0, grade: "D" },
    ];

    if (salaryRules.length === 0) {
      await storage.updateEvaluationPeriod(periodId, { salaryRules: defaultRules as any });
    }

    await storage.deleteEvaluationResultsByPeriod(periodId);

    const personColumn = allBoardColumns.find((c: any) => c.columnType === "person");
    const statusColumn = allBoardColumns.find((c: any) => c.columnType === "status");
    const dateColumn = allBoardColumns.find((c: any) => c.columnType === "date");

    const statusPersonCol = allStatusColumns.find((c: any) => c.columnType === "person");
    const statusStatusCol = allStatusColumns.find((c: any) => c.columnType === "status");

    for (const emp of companyEmps) {
      const empAttendance = allAttendance.filter(a => a.employeeId === emp.id);
      const empOT = allOT.filter(o => o.employeeId === emp.id);

      const totalWorkDays = empAttendance.length;
      const presentDays = empAttendance.filter(a => a.status === "present" || a.status === "late").length;
      const lateDays = empAttendance.filter(a => a.status === "late").length;
      const absentDays = empAttendance.filter(a => a.status === "absent").length;
      const leaveDays = empAttendance.filter(a => a.status === "leave").length;
      const totalOTHours = empOT.reduce((s, o) => s + parseFloat(String(o.hours || "0")), 0);
      const attendanceRate = totalWorkDays > 0 ? (presentDays / totalWorkDays * 100) : 0;

      let tasksAssigned = 0;
      let tasksCompleted = 0;
      let taskNames: string[] = [];

      if (personColumn) {
        const empItems = allBoardItems.filter((item: any) => {
          try {
            const cv = JSON.parse(item.cellValues || "{}");
            const personVal = cv[String(personColumn.id)];
            return personVal && (String(personVal) === String(emp.id) || String(personVal) === emp.fullName);
          } catch { return false; }
        });
        tasksAssigned += empItems.length;
        empItems.forEach((item: any) => {
          taskNames.push(item.name);
          try {
            const cv = JSON.parse(item.cellValues || "{}");
            if (statusColumn) {
              const sv = cv[String(statusColumn.id)];
              if (sv && (sv === "เสร็จแล้ว" || sv === "Done" || sv === "completed" || sv === "สำเร็จ")) {
                tasksCompleted++;
              }
            }
          } catch {}
        });
      }

      if (statusPersonCol) {
        const empStatusRows = allStatusRows.filter((row: any) => {
          const cells = allStatusCells.filter(c => c.rowId === row.id && c.columnId === statusPersonCol.id);
          return cells.some(c => c.value && (String(c.value) === String(emp.id) || String(c.value) === emp.fullName));
        });
        tasksAssigned += empStatusRows.length;
        empStatusRows.forEach((row: any) => {
          taskNames.push(row.title || "");
          if (statusStatusCol) {
            const statusCell = allStatusCells.find(c => c.rowId === row.id && c.columnId === statusStatusCol.id);
            if (statusCell?.value && (statusCell.value === "เสร็จแล้ว" || statusCell.value === "Done" || statusCell.value === "completed" || statusCell.value === "สำเร็จ")) {
              tasksCompleted++;
            }
          }
        });
      }

      const taskCompletionRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned * 100) : 0;

      const metricsData = {
        totalWorkDays, presentDays, lateDays, absentDays, leaveDays,
        attendanceRate: attendanceRate.toFixed(1),
        totalOTHours: totalOTHours.toFixed(1),
        tasksAssigned, tasksCompleted,
        taskCompletionRate: taskCompletionRate.toFixed(1),
        taskNames: taskNames.slice(0, 20),
      };

      const prompt = `คุณเป็นผู้เชี่ยวชาญด้าน HR ของสำนักงานบัญชี ให้ประเมินผลงานพนักงานต่อไปนี้ โดยอิงจากข้อมูลจริง

ข้อมูลพนักงาน:
- ชื่อ: ${emp.fullName}
- ตำแหน่ง: ${emp.position || "พนักงานบัญชี"}
- แผนก: ${emp.department || "บัญชี"}

ข้อมูลช่วงประเมิน (${startDate} ถึง ${endDate}):
- วันทำงานทั้งหมด: ${totalWorkDays} วัน
- มาทำงาน: ${presentDays} วัน (${attendanceRate.toFixed(1)}%)
- มาสาย: ${lateDays} วัน
- ขาดงาน: ${absentDays} วัน
- ลางาน: ${leaveDays} วัน
- ชั่วโมง OT: ${totalOTHours.toFixed(1)} ชม.
- งานที่ได้รับมอบหมาย: ${tasksAssigned} งาน
- งานที่เสร็จสมบูรณ์: ${tasksCompleted} งาน (${taskCompletionRate.toFixed(1)}%)
- รายการงาน: ${taskNames.slice(0, 10).join(", ") || "ไม่มีข้อมูล"}

ให้ประเมินใน 5 หัวข้อ คะแนน 1-5 (ทศนิยม 1 ตำแหน่ง):
1. ความรับผิดชอบและการมาทำงาน (น้ำหนัก 20%)
2. คุณภาพและปริมาณงาน (น้ำหนัก 30%)
3. การทำงานตรงเวลา/ส่งงานทันกำหนด (น้ำหนัก 25%)
4. ความร่วมมือและการทำงานเป็นทีม (น้ำหนัก 15%)
5. การพัฒนาตนเองและความคิดริเริ่ม (น้ำหนัก 10%)

ตอบเป็น JSON เท่านั้น ในรูปแบบ:
{
"scores": [
  {"name": "ความรับผิดชอบและการมาทำงาน", "weight": 20, "score": 4.0, "reason": "..."},
  {"name": "คุณภาพและปริมาณงาน", "weight": 30, "score": 3.5, "reason": "..."},
  {"name": "การทำงานตรงเวลา", "weight": 25, "score": 4.0, "reason": "..."},
  {"name": "ความร่วมมือและการทำงานเป็นทีม", "weight": 15, "score": 3.5, "reason": "..."},
  {"name": "การพัฒนาตนเองและความคิดริเริ่ม", "weight": 10, "score": 3.0, "reason": "..."}
],
"totalScore": 3.65,
"summary": "สรุปผลการประเมินโดยรวม 2-3 ประโยค",
"strengths": "จุดแข็ง 2-3 ข้อ",
"improvements": "ข้อเสนอแนะเพื่อพัฒนา 2-3 ข้อ"
}`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const aiResult = JSON.parse(response.choices[0].message.content || "{}");
        const totalScore = parseFloat(aiResult.totalScore || "0");

        const rule = defaultRules.find((r: any) => totalScore >= r.minScore && totalScore <= r.maxScore) || defaultRules[defaultRules.length - 1];
        const currentSalary = parseFloat(String(emp.baseSalary || "0"));
        const increasePercent = (rule as any).increasePercent || 0;
        const newSalary = currentSalary * (1 + increasePercent / 100);
        const bonusMonths = (rule as any).bonusMonths || 0;
        const bonusAmount = currentSalary * bonusMonths;

        const resultData = {
          periodId,
          employeeId: emp.id,
          scores: aiResult.scores || [],
          totalScore: totalScore.toFixed(2),
          grade: (rule as any).grade || "C",
          aiSummary: String(aiResult.summary || "").replace(/\0/g, ""),
          strengths: String(aiResult.strengths || "").replace(/\0/g, ""),
          improvements: String(aiResult.improvements || "").replace(/\0/g, ""),
          currentSalary: currentSalary.toFixed(2),
          recommendedIncrease: increasePercent.toFixed(2),
          newSalary: newSalary.toFixed(2),
          bonusMonths: bonusMonths.toFixed(2),
          bonusAmount: bonusAmount.toFixed(2),
          status: "draft",
          metricsData: metricsData as any,
        };
        console.log("[EVAL-AI] Saving result for", emp.fullName, "score:", totalScore.toFixed(2), "grade:", (rule as any).grade);
        await storage.createEvaluationResult(resultData);
      } catch (aiErr: any) {
        console.error("[EVAL-AI] Error for employee", emp.id, emp.fullName, ":", aiErr.message);
        await storage.createEvaluationResult({
          periodId,
          employeeId: emp.id,
          scores: [],
          totalScore: "0",
          grade: "N/A",
          aiSummary: `AI ประเมินไม่สำเร็จ: ${String(aiErr.message).substring(0, 200)}`,
          strengths: "",
          improvements: "",
          currentSalary: String(emp.baseSalary || "0"),
          recommendedIncrease: "0",
          newSalary: String(emp.baseSalary || "0"),
          bonusMonths: "0",
          bonusAmount: "0",
          status: "error",
          metricsData: {} as any,
        });
      }
    }

    await storage.updateEvaluationPeriod(periodId, { status: "evaluated" });
    const results = await storage.getEvaluationResults(periodId);
    res.json({ success: true, resultsCount: results.length, results });
  } catch (err: any) { console.error('[EVAL-AI] Outer error:', err); res.status(500).json({ message: err.message }); }
});

app.post("/api/evaluation-periods/:id/approve", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const periodId = Number(req.params.id);
    const period = await storage.getEvaluationPeriod(periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const results = await storage.getEvaluationResults(periodId);
    for (const r of results) {
      if (r.status === "draft") {
        await storage.updateEvaluationResult(r.id, { status: "approved" });
      }
    }
    await storage.updateEvaluationPeriod(periodId, { status: "approved" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/evaluation-periods/:id/apply-salary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const periodId = Number(req.params.id);
    const period = await storage.getEvaluationPeriod(periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const results = await storage.getEvaluationResults(periodId);
    const eligible = results.filter(r => r.status === "approved" || r.status === "bonus_applied");
    let appliedCount = 0;
    for (const r of eligible) {
      if (parseFloat(String(r.newSalary || "0")) > 0 && parseFloat(String(r.recommendedIncrease || "0")) > 0) {
        await db.update(employees).set({ baseSalary: String(r.newSalary) }).where(eq(employees.id, r.employeeId));
        appliedCount++;
      }
      const newStatus = r.status === "bonus_applied" ? "applied" : "salary_applied";
      await storage.updateEvaluationResult(r.id, { status: newStatus });
    }
    const allResults = await storage.getEvaluationResults(periodId);
    const allDone = allResults.every(r => r.status === "applied" || r.status === "error");
    if (allDone) await storage.updateEvaluationPeriod(periodId, { status: "applied" });
    else await storage.updateEvaluationPeriod(periodId, { status: "salary_applied" });
    res.json({ success: true, appliedCount });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/evaluation-periods/:id/apply-bonus", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const periodId = Number(req.params.id);
    const period = await storage.getEvaluationPeriod(periodId);
    if (!period) return res.status(404).json({ message: "ไม่พบรอบประเมิน" });
    const [periodCompany] = await db.select().from(companies).where(eq(companies.id, period.companyId));
    if (!periodCompany || periodCompany.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const results = await storage.getEvaluationResults(periodId);
    const eligible = results.filter(r => r.status === "approved" || r.status === "salary_applied");
    let appliedCount = 0;
    const bonusDetails: any[] = [];
    for (const r of eligible) {
      const bonusAmt = parseFloat(String(r.bonusAmount || "0"));
      if (bonusAmt > 0) {
        appliedCount++;
        bonusDetails.push({ employeeId: r.employeeId, bonusAmount: bonusAmt, bonusMonths: r.bonusMonths });
      }
      const newStatus = r.status === "salary_applied" ? "applied" : "bonus_applied";
      await storage.updateEvaluationResult(r.id, { status: newStatus });
    }
    const allResults = await storage.getEvaluationResults(periodId);
    const allDone = allResults.every(r => r.status === "applied" || r.status === "error");
    if (allDone) await storage.updateEvaluationPeriod(periodId, { status: "applied" });
    else await storage.updateEvaluationPeriod(periodId, { status: "bonus_applied" });
    res.json({ success: true, appliedCount, bonusDetails });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
