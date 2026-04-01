import type { Express } from "express";
import { requireAuth } from "../route-middleware";
import { db } from "../db";
import { eq, and, desc, isNull, gt } from "drizzle-orm";
import { firmLinks, tenants, companies, users } from "@shared/schema";
import crypto from "crypto";

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
}

export function registerFirmLinkRoutes(app: Express) {
  app.post("/api/firm-links/generate", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = Number(req.body.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      if (!company.length) return res.status(404).json({ message: "ไม่พบบริษัท" });

      if (!user.tenantId) return res.status(403).json({ message: "ไม่สามารถสร้างรหัสเชิญได้" });
      if (company[0].tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const existing = await db.select().from(firmLinks)
        .where(and(
          eq(firmLinks.clientCompanyId, companyId),
          eq(firmLinks.status, "pending"),
          gt(firmLinks.expiresAt!, new Date()),
        )).limit(1);

      if (existing.length) {
        return res.json({ inviteCode: existing[0].inviteCode, expiresAt: existing[0].expiresAt, existing: true });
      }

      const inviteCode = generateInviteCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [link] = await db.insert(firmLinks).values({
        inviteCode,
        clientTenantId: user.tenantId,
        clientCompanyId: companyId,
        status: "pending",
        expiresAt,
        createdByUserId: user.id,
      }).returning();

      res.json({ inviteCode: link.inviteCode, expiresAt: link.expiresAt, existing: false });
    } catch (e: any) {
      console.error("[firm-link] generate error:", e);
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.post("/api/firm-links/accept", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ message: "กรุณาระบุรหัสเชิญ" });

      const tenant = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      if (!tenant.length || tenant[0].tenantType !== "accounting_firm") {
        return res.status(403).json({ message: "เฉพาะสำนักงานบัญชีเท่านั้น" });
      }

      const [link] = await db.select().from(firmLinks)
        .where(and(
          eq(firmLinks.inviteCode, inviteCode.toUpperCase().trim()),
          eq(firmLinks.status, "pending"),
        )).limit(1);

      if (!link) return res.status(404).json({ message: "ไม่พบรหัสเชิญ หรือหมดอายุแล้ว" });

      if (link.expiresAt && new Date() > link.expiresAt) {
        await db.update(firmLinks).set({ status: "expired" }).where(eq(firmLinks.id, link.id));
        return res.status(400).json({ message: "รหัสเชิญหมดอายุแล้ว" });
      }

      if (link.clientTenantId === user.tenantId) {
        return res.status(400).json({ message: "ไม่สามารถเชื่อมกับตัวเองได้" });
      }

      const [company] = await db.select().from(companies).where(eq(companies.id, link.clientCompanyId)).limit(1);

      const [updated] = await db.update(firmLinks).set({
        firmTenantId: user.tenantId,
        status: "linked",
        linkedAt: new Date(),
        acceptedByUserId: user.id,
      }).where(eq(firmLinks.id, link.id)).returning();

      res.json({
        message: "เชื่อมต่อสำเร็จ",
        link: updated,
        companyName: company?.name || "ไม่ทราบชื่อ",
      });
    } catch (e: any) {
      console.error("[firm-link] accept error:", e);
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.get("/api/firm-links/my-links", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.tenantId) return res.json([]);

      const links = await db.select({
        id: firmLinks.id,
        inviteCode: firmLinks.inviteCode,
        status: firmLinks.status,
        accessLevel: firmLinks.accessLevel,
        linkedAt: firmLinks.linkedAt,
        createdAt: firmLinks.createdAt,
        expiresAt: firmLinks.expiresAt,
        clientTenantId: firmLinks.clientTenantId,
        firmTenantId: firmLinks.firmTenantId,
        clientCompanyId: firmLinks.clientCompanyId,
        companyName: companies.name,
        clientTenantName: tenants.name,
      }).from(firmLinks)
        .leftJoin(companies, eq(companies.id, firmLinks.clientCompanyId))
        .leftJoin(tenants, eq(tenants.id, firmLinks.clientTenantId))
        .where(eq(firmLinks.clientTenantId, user.tenantId))
        .orderBy(desc(firmLinks.createdAt));

      res.json(links);
    } catch (e: any) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.get("/api/firm-links/linked-clients", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.tenantId) return res.json([]);

      const tenant = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      if (!tenant.length || tenant[0].tenantType !== "accounting_firm") {
        return res.json([]);
      }

      const links = await db.select({
        id: firmLinks.id,
        status: firmLinks.status,
        accessLevel: firmLinks.accessLevel,
        linkedAt: firmLinks.linkedAt,
        clientCompanyId: firmLinks.clientCompanyId,
        clientTenantId: firmLinks.clientTenantId,
        companyName: companies.name,
        companyTaxId: companies.taxId,
        clientTenantName: tenants.name,
      }).from(firmLinks)
        .leftJoin(companies, eq(companies.id, firmLinks.clientCompanyId))
        .leftJoin(tenants, eq(tenants.id, firmLinks.clientTenantId))
        .where(and(
          eq(firmLinks.firmTenantId, user.tenantId),
          eq(firmLinks.status, "linked"),
        ))
        .orderBy(desc(firmLinks.linkedAt));

      res.json(links);
    } catch (e: any) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.post("/api/firm-links/:id/revoke", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const linkId = Number(req.params.id);

      const [link] = await db.select().from(firmLinks).where(eq(firmLinks.id, linkId)).limit(1);
      if (!link) return res.status(404).json({ message: "ไม่พบรายการ" });

      if (link.clientTenantId !== user.tenantId && link.firmTenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const [updated] = await db.update(firmLinks).set({ status: "revoked" })
        .where(eq(firmLinks.id, linkId)).returning();

      res.json({ message: "ยกเลิกการเชื่อมต่อแล้ว", link: updated });
    } catch (e: any) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.post("/api/firm-links/:id/access-level", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const linkId = Number(req.params.id);
      const { accessLevel } = req.body;
      if (!["readonly", "full"].includes(accessLevel)) {
        return res.status(400).json({ message: "accessLevel ต้องเป็น readonly หรือ full" });
      }

      const [link] = await db.select().from(firmLinks).where(eq(firmLinks.id, linkId)).limit(1);
      if (!link) return res.status(404).json({ message: "ไม่พบรายการ" });

      if (link.clientTenantId !== user.tenantId) {
        return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้นที่ปรับสิทธิ์ได้" });
      }

      const [updated] = await db.update(firmLinks).set({ accessLevel })
        .where(eq(firmLinks.id, linkId)).returning();

      res.json({ message: "อัปเดตสิทธิ์แล้ว", link: updated });
    } catch (e: any) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });
}
