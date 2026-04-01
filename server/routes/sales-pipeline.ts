import type { Express } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { pipelineDeals, pipelineActivities, insertPipelineDealSchema } from "@shared/schema";
import { requireAuth, requireModule , checkDocOwnership} from "../route-middleware";

const PIPELINE_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const STAGE_PROBABILITY: Record<string, number> = {
  lead: 10,
  qualified: 30,
  proposal: 50,
  negotiation: 70,
  won: 100,
  lost: 0,
};

const stageEnum = z.enum(PIPELINE_STAGES);

const createDealSchema = z.object({
  companyId: z.number(),
  title: z.string().min(1),
  contactId: z.number().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  dealValue: z.string().optional().default("0"),
  stage: stageEnum.optional().default("lead"),
  expectedCloseDate: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
});

const updateDealSchema = z.object({
  title: z.string().min(1).optional(),
  contactId: z.number().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  dealValue: z.string().optional(),
  stage: stageEnum.optional(),
  expectedCloseDate: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  quotationId: z.number().optional().nullable(),
});

export function registerSalesPipelineRoutes(app: Express) {
  app.get("/api/pipeline/deals", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const conditions: any[] = [eq(pipelineDeals.companyId, companyId)];

      if (req.query.assignedTo) {
        conditions.push(eq(pipelineDeals.assignedTo, String(req.query.assignedTo)));
      }
      if (req.query.dateFrom) {
        conditions.push(gte(pipelineDeals.createdAt, new Date(String(req.query.dateFrom))));
      }
      if (req.query.dateTo) {
        conditions.push(lte(pipelineDeals.createdAt, new Date(String(req.query.dateTo))));
      }
      if (req.query.minValue) {
        conditions.push(gte(pipelineDeals.dealValue, String(req.query.minValue)));
      }
      if (req.query.maxValue) {
        conditions.push(lte(pipelineDeals.dealValue, String(req.query.maxValue)));
      }

      const deals = await db.select().from(pipelineDeals)
        .where(and(...conditions))
        .orderBy(desc(pipelineDeals.updatedAt));

      res.json(deals);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/pipeline/deals/:id", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [deal] = await db.select().from(pipelineDeals)
        .where(and(eq(pipelineDeals.id, Number(req.params.id)), eq(pipelineDeals.companyId, companyId)));
      if (!deal) return res.status(404).json({ message: "Deal not found" });
      res.json(deal);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/pipeline/deals", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = createDealSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const data = {
        ...parsed.data,
        createdBy: user.id,
        probability: STAGE_PROBABILITY[parsed.data.stage || "lead"] ?? 10,
      };

      const [deal] = await db.insert(pipelineDeals).values(data).returning();

      await db.insert(pipelineActivities).values({
        dealId: deal.id,
        type: "created",
        description: `สร้าง Deal "${deal.title}"`,
        toStage: deal.stage,
        userId: user.id,
        userName: user.username || user.username,
      });

      res.json(deal);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/pipeline/deals/:id", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const user = req.user as any;
      const dealId = Number(req.params.id);
      const companyId = Number(req.query.companyId || req.body.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const parsed = updateDealSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const scopeCondition = and(eq(pipelineDeals.id, dealId), eq(pipelineDeals.companyId, companyId));

      const [existing] = await db.select().from(pipelineDeals).where(scopeCondition);
      if (!existing) return res.status(404).json({ message: "Deal not found" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }

      const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

      if (parsed.data.stage && parsed.data.stage !== existing.stage) {
        updateData.probability = STAGE_PROBABILITY[parsed.data.stage] ?? existing.probability;
        if (parsed.data.stage === "won" || parsed.data.stage === "lost") {
          updateData.closedAt = new Date();
        }

        await db.insert(pipelineActivities).values({
          dealId,
          type: "stage_change",
          description: `เปลี่ยนสถานะจาก "${existing.stage}" เป็น "${parsed.data.stage}"`,
          fromStage: existing.stage,
          toStage: parsed.data.stage,
          userId: user.id,
          userName: user.username || user.username,
        });
      }

      const [updated] = await db.update(pipelineDeals).set(updateData)
        .where(scopeCondition).returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/pipeline/deals/:id", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [existing] = await db.select().from(pipelineDeals)
        .where(and(eq(pipelineDeals.id, Number(req.params.id)), eq(pipelineDeals.companyId, companyId)));
      if (!existing) return res.status(404).json({ message: "Deal not found" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }

      await db.delete(pipelineDeals).where(eq(pipelineDeals.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/pipeline/deals/:id/activities", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [deal] = await db.select().from(pipelineDeals)
        .where(and(eq(pipelineDeals.id, Number(req.params.id)), eq(pipelineDeals.companyId, companyId)));
      if (!deal) return res.status(404).json({ message: "Deal not found" });

      const activities = await db.select().from(pipelineActivities)
        .where(eq(pipelineActivities.dealId, Number(req.params.id)))
        .orderBy(desc(pipelineActivities.createdAt));
      res.json(activities);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/pipeline/deals/:id/activities", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = Number(req.query.companyId || req.body.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [deal] = await db.select().from(pipelineDeals)
        .where(and(eq(pipelineDeals.id, Number(req.params.id)), eq(pipelineDeals.companyId, companyId)));
      if (!deal) return res.status(404).json({ message: "Deal not found" });

      const descSchema = z.object({
        type: z.string().optional().default("note"),
        description: z.string().min(1),
      });
      const parsed = descSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error" });
      }

      const [activity] = await db.insert(pipelineActivities).values({
        dealId: Number(req.params.id),
        type: parsed.data.type,
        description: parsed.data.description,
        userId: user.id,
        userName: user.username || user.username,
      }).returning();
      res.json(activity);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/pipeline/analytics", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const allDeals = await db.select().from(pipelineDeals)
        .where(eq(pipelineDeals.companyId, companyId));

      const stageStats: Record<string, { count: number; totalValue: number }> = {};
      for (const s of PIPELINE_STAGES) {
        stageStats[s] = { count: 0, totalValue: 0 };
      }

      let totalDeals = 0;
      let wonCount = 0;
      let lostCount = 0;
      let closedDeals: { createdAt: Date | null; closedAt: Date | null }[] = [];

      for (const d of allDeals) {
        totalDeals++;
        const stage = d.stage || "lead";
        if (stageStats[stage]) {
          stageStats[stage].count++;
          stageStats[stage].totalValue += parseFloat(String(d.dealValue || "0"));
        }
        if (stage === "won") {
          wonCount++;
          if (d.createdAt && d.closedAt) {
            closedDeals.push({ createdAt: d.createdAt, closedAt: d.closedAt });
          }
        }
        if (stage === "lost") lostCount++;
      }

      const decidedCount = wonCount + lostCount;
      const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

      let avgDealCycleDays = 0;
      if (closedDeals.length > 0) {
        const totalDays = closedDeals.reduce((sum, d) => {
          const created = new Date(d.createdAt!);
          const closed = new Date(d.closedAt!);
          return sum + (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgDealCycleDays = Math.round(totalDays / closedDeals.length);
      }

      const totalPipelineValue = Object.entries(stageStats)
        .filter(([key]) => key !== "won" && key !== "lost")
        .reduce((sum, [, v]) => sum + v.totalValue, 0);

      res.json({
        totalDeals,
        totalPipelineValue,
        wonCount,
        lostCount,
        winRate,
        avgDealCycleDays,
        stageStats,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/pipeline/deals/:id/create-quotation", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId || req.body.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const dealId = Number(req.params.id);
      const [deal] = await db.select().from(pipelineDeals)
        .where(and(eq(pipelineDeals.id, dealId), eq(pipelineDeals.companyId, companyId)));
      if (!deal) return res.status(404).json({ message: "Deal not found" });

      res.json({
        prefill: {
          customerName: deal.contactName || "",
          customerPhone: deal.contactPhone || "",
          customerEmail: deal.contactEmail || "",
          contactId: deal.contactId,
          salesperson: deal.assignedTo || "",
          notes: `จาก Pipeline Deal: ${deal.title}`,
          dealId: deal.id,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
