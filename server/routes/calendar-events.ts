import type { Express } from "express";
import { db } from "../db";
import { calendarEvents, users, holidays } from "@shared/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function registerCalendarRoutes(app: Express) {
  app.get("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { start, end, companyId } = req.query;
      if (!start || !end) return res.status(400).json({ error: "start and end required" });

      const cid = companyId ? Number(companyId) : user.companyId;
      const conditions = [
        lte(calendarEvents.startDate, new Date(end as string)),
        gte(calendarEvents.endDate, new Date(start as string)),
      ];
      if (cid) conditions.push(eq(calendarEvents.companyId, cid));
      if (user.tenantId) conditions.push(eq(calendarEvents.tenantId, user.tenantId));

      const events = await db.select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startDate: calendarEvents.startDate,
        endDate: calendarEvents.endDate,
        allDay: calendarEvents.allDay,
        color: calendarEvents.color,
        category: calendarEvents.category,
        userId: calendarEvents.userId,
        creatorName: users.fullName,
        companyId: calendarEvents.companyId,
        createdAt: calendarEvents.createdAt,
      }).from(calendarEvents)
        .innerJoin(users, eq(users.id, calendarEvents.userId))
        .where(and(...conditions));

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      const holidayConditions: any[] = [
        gte(holidays.date, startDate.toISOString().slice(0, 10)),
        lte(holidays.date, endDate.toISOString().slice(0, 10)),
      ];
      if (cid) holidayConditions.push(eq(holidays.companyId, cid));
      if (user.tenantId) holidayConditions.push(eq(holidays.tenantId, user.tenantId));

      const holidayRows = await db.select().from(holidays)
        .where(and(...holidayConditions));

      const holidayEvents = holidayRows.map(h => ({
        id: -h.id,
        title: `🏖 ${h.name}`,
        description: h.description || `วันหยุด${h.holidayType === "national" ? "ราชการ" : h.holidayType === "company" ? "บริษัท" : "พิเศษ"}`,
        startDate: new Date(h.date),
        endDate: new Date(h.date),
        allDay: true,
        color: "#f94d4d",
        category: "holiday",
        userId: h.createdBy,
        creatorName: "HR",
        companyId: h.companyId,
        createdAt: h.createdAt,
        source: "hr_holiday" as const,
      }));

      res.json([...events.map(e => ({ ...e, source: "calendar" as const })), ...holidayEvents]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { title, description, startDate, endDate, allDay, color, category, companyId } = req.body;
      if (!title || !startDate || !endDate) return res.status(400).json({ error: "title, startDate, endDate required" });

      const [event] = await db.insert(calendarEvents).values({
        tenantId: user.tenantId,
        companyId: companyId || user.companyId,
        userId: user.id,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        allDay: allDay || false,
        color: color || "#fb9678",
        category: category || "general",
      }).returning();

      res.json(event);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.userId !== user.id && user.role !== "admin" && user.role !== "manager") {
        return res.status(403).json({ error: "Not authorized" });
      }
      if (user.tenantId && existing.tenantId !== user.tenantId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { title, description, startDate, endDate, allDay, color, category } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (startDate !== undefined) updates.startDate = new Date(startDate);
      if (endDate !== undefined) updates.endDate = new Date(endDate);
      if (allDay !== undefined) updates.allDay = allDay;
      if (color !== undefined) updates.color = color;
      if (category !== undefined) updates.category = category;

      const [event] = await db.update(calendarEvents)
        .set(updates)
        .where(eq(calendarEvents.id, id))
        .returning();

      res.json(event);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.userId !== user.id && user.role !== "admin" && user.role !== "manager") {
        return res.status(403).json({ error: "Not authorized" });
      }
      if (user.tenantId && existing.tenantId !== user.tenantId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
