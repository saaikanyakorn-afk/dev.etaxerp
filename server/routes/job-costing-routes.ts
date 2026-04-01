import type { Express } from "express";
import { db } from "../db";
import { constructionProjects, projectUnits, projectCostAllocations, companies } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireModule } from "../route-middleware";
import { insertConstructionProjectSchema, insertProjectUnitSchema, insertProjectCostAllocationSchema } from "@shared/schema";

async function verifyTenantAccess(companyId: number, user: any): Promise<boolean> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (company && company.tenantId && company.tenantId !== user.tenantId) return false;
  return true;
}

export function registerJobCostingRoutes(app: Express) {

  app.get("/api/job-costing/projects", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const page = Number(req.query.page) || 1;
      const offset = (page - 1) * limit;
      const statusFilter = req.query.status as string | undefined;

      const rows = await db.execute(sql`
        SELECT cp.*,
          COALESCE((SELECT SUM(amount::numeric) FROM project_cost_allocations WHERE project_id = cp.id), 0) AS total_cost,
          COALESCE((SELECT COUNT(*) FROM project_units WHERE project_id = cp.id), 0) AS unit_count
        FROM construction_projects cp
        WHERE cp.company_id = ${companyId}
        ${statusFilter && statusFilter !== "all" ? sql`AND cp.status = ${statusFilter}` : sql``}
        ORDER BY cp.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalResult = await db.execute(sql`SELECT COUNT(*)::int AS total FROM construction_projects WHERE company_id = ${companyId} ${statusFilter && statusFilter !== "all" ? sql`AND status = ${statusFilter}` : sql``}`);
      const total = (totalResult.rows as any[])[0]?.total || 0;

      res.json({ data: rows.rows, total, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/job-costing/projects/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [project] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
      if (!project) return res.status(404).json({ message: "ไม่พบโปรเจค" });

      const user = req.user as any;
      if (!(await verifyTenantAccess(project.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const units = await db.select().from(projectUnits).where(eq(projectUnits.projectId, id));

      const costs = await db.execute(sql`
        SELECT pca.*, pu.unit_code
        FROM project_cost_allocations pca
        LEFT JOIN project_units pu ON pu.id = pca.unit_id
        WHERE pca.project_id = ${id}
        ORDER BY pca.created_at DESC
      `);

      const summary = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount::numeric), 0) AS total_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'material' THEN amount::numeric ELSE 0 END), 0) AS material_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'labor' THEN amount::numeric ELSE 0 END), 0) AS labor_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'subcontract' THEN amount::numeric ELSE 0 END), 0) AS subcontract_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'equipment' THEN amount::numeric ELSE 0 END), 0) AS equipment_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'overhead' THEN amount::numeric ELSE 0 END), 0) AS overhead_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'other' THEN amount::numeric ELSE 0 END), 0) AS other_cost
        FROM project_cost_allocations
        WHERE project_id = ${id}
      `);

      const unitCosts = await db.execute(sql`
        SELECT pu.id, pu.unit_code, pu.unit_type, pu.area_size, pu.selling_price, pu.status, pu.buyer_name,
          COALESCE(SUM(pca.amount::numeric), 0) AS total_cost
        FROM project_units pu
        LEFT JOIN project_cost_allocations pca ON pca.unit_id = pu.id
        WHERE pu.project_id = ${id}
        GROUP BY pu.id
        ORDER BY pu.unit_code
      `);

      res.json({
        project,
        units,
        costs: costs.rows,
        summary: (summary.rows as any[])[0],
        unitCosts: unitCosts.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/job-costing/projects", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = insertConstructionProjectSchema.safeParse({ ...req.body, createdBy: user.id });
      if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
      if (!(await verifyTenantAccess(parsed.data.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const [project] = await db.insert(constructionProjects).values(parsed.data).returning();
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/job-costing/projects/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [existing] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
      if (!existing) return res.status(404).json({ message: "ไม่พบโปรเจค" });
      if (!(await verifyTenantAccess(existing.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const { companyId, createdBy, ...updateData } = req.body;
      const [updated] = await db.update(constructionProjects).set({ ...updateData, updatedAt: new Date() }).where(eq(constructionProjects.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/job-costing/projects/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [existing] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
      if (!existing) return res.status(404).json({ message: "ไม่พบโปรเจค" });
      if (!(await verifyTenantAccess(existing.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      await db.delete(constructionProjects).where(eq(constructionProjects.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/job-costing/units", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = insertProjectUnitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
      if (!(await verifyTenantAccess(parsed.data.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const [unit] = await db.insert(projectUnits).values(parsed.data).returning();
      res.json(unit);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/job-costing/units/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [existing] = await db.select().from(projectUnits).where(eq(projectUnits.id, id));
      if (!existing) return res.status(404).json({ message: "ไม่พบยูนิต" });
      if (!(await verifyTenantAccess(existing.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const { companyId, projectId, ...updateData } = req.body;
      const [updated] = await db.update(projectUnits).set(updateData).where(eq(projectUnits.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/job-costing/units/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [existing] = await db.select().from(projectUnits).where(eq(projectUnits.id, id));
      if (!existing) return res.status(404).json({ message: "ไม่พบยูนิต" });
      if (!(await verifyTenantAccess(existing.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      await db.delete(projectUnits).where(eq(projectUnits.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/job-costing/costs", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = insertProjectCostAllocationSchema.safeParse({ ...req.body, createdBy: user.id });
      if (!parsed.success) return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
      if (!(await verifyTenantAccess(parsed.data.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const [cost] = await db.insert(projectCostAllocations).values(parsed.data).returning();
      res.json(cost);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/job-costing/costs/bulk", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const user = req.user as any;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "items required" });

      const results = [];
      for (const item of items) {
        const parsed = insertProjectCostAllocationSchema.safeParse({ ...item, createdBy: user.id });
        if (parsed.success) {
          const [cost] = await db.insert(projectCostAllocations).values(parsed.data).returning();
          results.push(cost);
        }
      }
      res.json({ inserted: results.length, data: results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/job-costing/costs/:id", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [existing] = await db.select().from(projectCostAllocations).where(eq(projectCostAllocations.id, id));
      if (!existing) return res.status(404).json({ message: "ไม่พบรายการ" });
      if (!(await verifyTenantAccess(existing.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      await db.delete(projectCostAllocations).where(eq(projectCostAllocations.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/job-costing/projects/:id/profit-loss", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [project] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
      if (!project) return res.status(404).json({ message: "ไม่พบโปรเจค" });
      if (!(await verifyTenantAccess(project.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const costResult = await db.execute(sql`
        SELECT
          cost_category,
          COALESCE(SUM(amount::numeric), 0) AS total
        FROM project_cost_allocations
        WHERE project_id = ${id}
        GROUP BY cost_category
        ORDER BY cost_category
      `);

      const totalCost = (costResult.rows as any[]).reduce((sum, r) => sum + Number(r.total), 0);
      const revenue = Number(project.revenueAmount) || 0;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue * 100) : 0;
      const budgetUsed = Number(project.budgetAmount) > 0 ? (totalCost / Number(project.budgetAmount) * 100) : 0;

      res.json({
        projectName: project.name,
        revenue,
        totalCost,
        profit,
        margin: Math.round(margin * 100) / 100,
        budget: Number(project.budgetAmount) || 0,
        budgetUsed: Math.round(budgetUsed * 100) / 100,
        costBreakdown: costResult.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/job-costing/projects/:id/unit-costs", requireAuth, requireModule("job-costing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const [project] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
      if (!project) return res.status(404).json({ message: "ไม่พบโปรเจค" });
      if (!(await verifyTenantAccess(project.companyId, user))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const sharedCosts = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) AS total
        FROM project_cost_allocations
        WHERE project_id = ${id} AND unit_id IS NULL
      `);
      const sharedTotal = Number((sharedCosts.rows as any[])[0]?.total || 0);

      const units = await db.execute(sql`
        SELECT pu.*,
          COALESCE(SUM(pca.amount::numeric), 0) AS direct_cost,
          COALESCE(pu.area_size::numeric, 0) AS area
        FROM project_units pu
        LEFT JOIN project_cost_allocations pca ON pca.unit_id = pu.id
        WHERE pu.project_id = ${id}
        GROUP BY pu.id
        ORDER BY pu.unit_code
      `);

      const totalArea = (units.rows as any[]).reduce((sum, u) => sum + Number(u.area || 0), 0);
      const unitCount = (units.rows as any[]).length;

      const result = (units.rows as any[]).map(u => {
        const area = Number(u.area || 0);
        const allocatedShared = totalArea > 0
          ? (area / totalArea) * sharedTotal
          : unitCount > 0 ? sharedTotal / unitCount : 0;
        const directCost = Number(u.direct_cost);
        const totalCost = directCost + allocatedShared;
        const sellingPrice = Number(u.selling_price || 0);
        const profit = sellingPrice - totalCost;
        const margin = sellingPrice > 0 ? (profit / sellingPrice * 100) : 0;

        return {
          id: u.id,
          unitCode: u.unit_code,
          unitType: u.unit_type,
          areaSize: area,
          sellingPrice,
          buyerName: u.buyer_name,
          status: u.status,
          directCost,
          allocatedSharedCost: Math.round(allocatedShared * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin: Math.round(margin * 100) / 100,
        };
      });

      res.json({ units: result, sharedCostTotal: sharedTotal, totalArea });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
