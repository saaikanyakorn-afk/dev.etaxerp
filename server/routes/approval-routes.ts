import { Express } from "express";
import { db } from "../db";
import { approvalSettings, approvalRequests, users, companies } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../route-middleware";
import crypto from "crypto";

function canAccessCompany(req: any, companyId: number): boolean {
  const user = req.user as any;
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const allowed = user.companyAccess || (user.companyId ? [user.companyId] : []);
  return allowed.includes(companyId);
}

function isApprover(user: any, setting: any): boolean {
  if (user.role === "super_admin") return true;
  if (setting.approverMode === "role" || setting.approverMode === "both") {
    if (setting.approverRoles?.includes(user.role)) return true;
  }
  if (setting.approverMode === "person" || setting.approverMode === "both") {
    if (setting.approverUserIds?.includes(user.id)) return true;
  }
  return false;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  QO: "ใบเสนอราคา",
  SO: "ใบสั่งขาย",
  IV: "ใบแจ้งหนี้",
  TIV: "ใบกำกับภาษี",
  RE: "ใบเสร็จรับเงิน",
  BN: "ใบวางบิล",
  PR: "ใบขอซื้อ",
  PO: "ใบสั่งซื้อ",
  AP: "ใบกำกับซื้อ",
  EXP: "ค่าใช้จ่าย",
  PV: "ใบสำคัญจ่าย",
  LEAVE: "ใบลา",
  OT: "OT",
};

const DOC_TYPE_TABLE_MAP: Record<string, string> = {
  QO: "quotations",
  SO: "sales_orders",
  IV: "invoices",
  TIV: "tax_invoices",
  RE: "receipts",
  BN: "billing_notes",
  PR: "purchase_requests",
  PO: "purchase_orders",
  AP: "purchase_invoices",
  EXP: "expenses",
  PV: "payment_vouchers",
};

const DOC_TYPE_APPROVED_STATUS: Record<string, string> = {
  QO: "approved",
  SO: "confirmed",
  IV: "open",
  TIV: "sent",
  RE: "confirmed",
  BN: "sent",
  PR: "approved",
  PO: "ordered",
  AP: "approved",
  EXP: "approved",
  PV: "approved",
};

async function sendLineNotification(
  companyId: number,
  approverLineIds: string[],
  docType: string,
  docNumber: string,
  amount: string | null,
  contactName: string | null,
  requesterName: string,
  approveUrl: string
) {
  let token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const [company] = await db
    .select({ lineChannelAccessToken: companies.lineChannelAccessToken })
    .from(companies)
    .where(eq(companies.id, companyId));
  if (company?.lineChannelAccessToken) token = company.lineChannelAccessToken;
  if (!token) return;

  const label = DOC_TYPE_LABELS[docType] || docType;
  const amountText = amount ? `฿${Number(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "-";

  const flexMessage = {
    type: "flex",
    altText: `📋 ขออนุมัติ${label} ${docNumber}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📋 ขออนุมัติเอกสาร", weight: "bold", size: "md", color: "#fb9678" },
        ],
        backgroundColor: "#FFF5F2",
        paddingAll: "15px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `${label}: ${docNumber}`, weight: "bold", size: "sm", wrap: true },
          { type: "text", text: `คู่ค้า: ${contactName || "-"}`, size: "xs", color: "#666666", margin: "sm", wrap: true },
          { type: "text", text: `จำนวนเงิน: ${amountText}`, size: "xs", color: "#666666", margin: "sm" },
          { type: "text", text: `ผู้ขอ: ${requesterName}`, size: "xs", color: "#666666", margin: "sm" },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#05b187",
                height: "sm",
                action: { type: "uri", label: "อนุมัติ", uri: `${approveUrl}?action=approve` },
              },
              {
                type: "button",
                style: "primary",
                color: "#f94d4d",
                height: "sm",
                action: { type: "uri", label: "ไม่อนุมัติ", uri: `${approveUrl}?action=reject` },
              },
            ],
          },
        ],
        paddingAll: "15px",
      },
    },
  };

  for (const lineId of approverLineIds) {
    try {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: lineId, messages: [flexMessage] }),
      });
    } catch (err) {
      console.error(`[Approval] Failed to send LINE to ${lineId}:`, (err as any).message);
    }
  }
}

export function registerApprovalRoutes(app: Express) {
  app.get("/api/approval-settings", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
      const settings = await db
        .select()
        .from(approvalSettings)
        .where(eq(approvalSettings.companyId, companyId));
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-settings", requireAuth, async (req, res) => {
    try {
      const { companyId, documentType, enabled, approverMode, approverRoles, approverUserIds } = req.body;
      if (!companyId || !documentType) return res.status(400).json({ message: "กรุณาระบุบริษัทและประเภทเอกสาร" });
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
      const user = req.user as any;
      if (!["super_admin", "admin", "manager"].includes(user?.role)) return res.status(403).json({ message: "ต้องเป็น admin หรือ manager เท่านั้น" });

      const existing = await db
        .select()
        .from(approvalSettings)
        .where(and(eq(approvalSettings.companyId, companyId), eq(approvalSettings.documentType, documentType)));

      if (existing.length > 0) {
        const [updated] = await db
          .update(approvalSettings)
          .set({
            enabled: enabled ?? true,
            approverMode: approverMode || "role",
            approverRoles: approverRoles || [],
            approverUserIds: approverUserIds || [],
            updatedAt: new Date(),
          })
          .where(eq(approvalSettings.id, existing[0].id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db
        .insert(approvalSettings)
        .values({
          companyId,
          documentType,
          enabled: enabled ?? true,
          approverMode: approverMode || "role",
          approverRoles: approverRoles || [],
          approverUserIds: approverUserIds || [],
        })
        .returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/approval-settings/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(approvalSettings).where(eq(approvalSettings.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/approval-requests", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const status = req.query.status as string | undefined;
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });

      let conditions = [eq(approvalRequests.companyId, companyId)];
      if (status) conditions.push(eq(approvalRequests.status, status));

      const requests = await db
        .select()
        .from(approvalRequests)
        .where(and(...conditions))
        .orderBy(desc(approvalRequests.requestedAt))
        .limit(200);

      const requestedByIds = [...new Set(requests.map((r) => r.requestedBy).filter(Boolean))] as number[];
      const approvedByIds = [...new Set(requests.map((r) => r.approvedBy).filter(Boolean))] as number[];
      const allUserIds = [...new Set([...requestedByIds, ...approvedByIds])];

      let userMap: Record<number, string> = {};
      if (allUserIds.length > 0) {
        const userRows = await db
          .select({ id: users.id, fullName: users.fullName, username: users.username })
          .from(users)
          .where(inArray(users.id, allUserIds));
        for (const u of userRows) {
          userMap[u.id] = u.fullName || u.username;
        }
      }

      const enriched = requests.map((r) => ({
        ...r,
        requestedByName: r.requestedBy ? userMap[r.requestedBy] || "" : "",
        approvedByName: r.approvedBy ? userMap[r.approvedBy] || "" : "",
        documentTypeLabel: DOC_TYPE_LABELS[r.documentType] || r.documentType,
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-requests", requireAuth, async (req, res) => {
    try {
      const { companyId, documentType, documentId, documentNumber, amount, contactName } = req.body;
      const userId = (req.user as any)?.id;
      if (!companyId || !documentType || !documentId) {
        return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
      }
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });

      const settings = await db
        .select()
        .from(approvalSettings)
        .where(and(eq(approvalSettings.companyId, companyId), eq(approvalSettings.documentType, documentType)));

      if (!settings.length || !settings[0].enabled) {
        return res.status(400).json({ message: "เอกสารนี้ไม่ได้เปิดการอนุมัติ" });
      }

      const existing = await db
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.companyId, companyId),
            eq(approvalRequests.documentType, documentType),
            eq(approvalRequests.documentId, documentId),
            eq(approvalRequests.status, "pending")
          )
        );
      if (existing.length > 0) {
        return res.status(400).json({ message: "เอกสารนี้มีคำขออนุมัติที่รอดำเนินการอยู่แล้ว" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const [request] = await db
        .insert(approvalRequests)
        .values({
          companyId,
          documentType,
          documentId,
          documentNumber: documentNumber || null,
          amount: amount?.toString() || null,
          contactName: contactName || null,
          requestedBy: userId,
          token,
          status: "pending",
        })
        .returning();

      const tableName = DOC_TYPE_TABLE_MAP[documentType];
      if (tableName) {
        await db.execute(
          `UPDATE ${tableName} SET status = 'pending_approval' WHERE id = ${documentId}`
        );
      }

      const setting = settings[0];
      let approverLineIds: string[] = [];

      if (setting.approverMode === "person" || setting.approverMode === "both") {
        if (setting.approverUserIds && setting.approverUserIds.length > 0) {
          const approverUsers = await db
            .select({ lineId: users.lineId })
            .from(users)
            .where(inArray(users.id, setting.approverUserIds));
          approverLineIds.push(...approverUsers.filter((u) => u.lineId).map((u) => u.lineId!));
        }
      }

      if (setting.approverMode === "role" || setting.approverMode === "both") {
        if (setting.approverRoles && setting.approverRoles.length > 0) {
          const roleUsers = await db
            .select({ lineId: users.lineId })
            .from(users)
            .where(inArray(users.role, setting.approverRoles));
          approverLineIds.push(...roleUsers.filter((u) => u.lineId).map((u) => u.lineId!));
        }
      }

      approverLineIds = [...new Set(approverLineIds)];

      if (approverLineIds.length > 0) {
        const requester = await db
          .select({ fullName: users.fullName, username: users.username })
          .from(users)
          .where(eq(users.id, userId));
        const requesterName = requester[0]?.fullName || requester[0]?.username || "ไม่ทราบ";

        const host = req.get("host") || "";
        const protocol = req.protocol;
        const baseUrl = host.includes(".replit.app") || process.env.NODE_ENV === "production"
          ? `${protocol}://${host}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const approveUrl = `${baseUrl}/approve/${token}`;

        await sendLineNotification(
          companyId,
          approverLineIds,
          documentType,
          documentNumber || "",
          amount?.toString() || null,
          contactName || null,
          requesterName,
          approveUrl
        );

        await db
          .update(approvalRequests)
          .set({ notifiedAt: new Date() })
          .where(eq(approvalRequests.id, request.id));
      }

      res.json({ ...request, message: "ส่งคำขออนุมัติเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-requests/:id/approve", requireAuth, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const user = req.user as any;
      const userId = user?.id;

      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId));

      if (!request) return res.status(404).json({ message: "ไม่พบคำขออนุมัติ" });
      if (!canAccessCompany(req, request.companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
      if (request.status !== "pending") return res.status(400).json({ message: "คำขอนี้ดำเนินการแล้ว" });

      const [setting] = await db.select().from(approvalSettings)
        .where(and(eq(approvalSettings.companyId, request.companyId), eq(approvalSettings.documentType, request.documentType)));
      if (setting && !isApprover(user, setting)) return res.status(403).json({ message: "คุณไม่ใช่ผู้อนุมัติสำหรับเอกสารประเภทนี้" });

      const [updated] = await db
        .update(approvalRequests)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
        .where(eq(approvalRequests.id, requestId))
        .returning();

      const tableName = DOC_TYPE_TABLE_MAP[request.documentType];
      const approvedStatus = DOC_TYPE_APPROVED_STATUS[request.documentType] || "approved";
      if (tableName) {
        if (request.documentType === "QO") {
          await db.execute(
            `UPDATE ${tableName} SET status = '${approvedStatus}', customer_response = 'confirmed', customer_responded_at = NOW() WHERE id = ${request.documentId}`
          );
        } else {
          await db.execute(
            `UPDATE ${tableName} SET status = '${approvedStatus}' WHERE id = ${request.documentId}`
          );
        }
      }

      res.json({ ...updated, message: "อนุมัติเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-requests/:id/reject", requireAuth, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const user = req.user as any;
      const userId = user?.id;
      const { reason } = req.body;

      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId));

      if (!request) return res.status(404).json({ message: "ไม่พบคำขออนุมัติ" });
      if (!canAccessCompany(req, request.companyId)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
      if (request.status !== "pending") return res.status(400).json({ message: "คำขอนี้ดำเนินการแล้ว" });

      const [setting] = await db.select().from(approvalSettings)
        .where(and(eq(approvalSettings.companyId, request.companyId), eq(approvalSettings.documentType, request.documentType)));
      if (setting && !isApprover(user, setting)) return res.status(403).json({ message: "คุณไม่ใช่ผู้อนุมัติสำหรับเอกสารประเภทนี้" });

      const [updated] = await db
        .update(approvalRequests)
        .set({ status: "rejected", approvedBy: userId, approvedAt: new Date(), rejectedReason: reason || null })
        .where(eq(approvalRequests.id, requestId))
        .returning();

      const tableName = DOC_TYPE_TABLE_MAP[request.documentType];
      if (tableName) {
        await db.execute(
          `UPDATE ${tableName} SET status = 'rejected' WHERE id = ${request.documentId}`
        );
      }

      res.json({ ...updated, message: "ปฏิเสธคำขอเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/approval-requests/by-token/:token", async (req, res) => {
    try {
      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.token, req.params.token));

      if (!request) return res.status(404).json({ message: "ไม่พบคำขออนุมัติ หรือลิงก์ไม่ถูกต้อง" });

      let requesterName = "";
      if (request.requestedBy) {
        const [user] = await db
          .select({ fullName: users.fullName, username: users.username })
          .from(users)
          .where(eq(users.id, request.requestedBy));
        requesterName = user?.fullName || user?.username || "";
      }

      let approverName = "";
      if (request.approvedBy) {
        const [user] = await db
          .select({ fullName: users.fullName, username: users.username })
          .from(users)
          .where(eq(users.id, request.approvedBy));
        approverName = user?.fullName || user?.username || "";
      }

      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, request.companyId));

      res.json({
        ...request,
        requesterName,
        approverName,
        companyName: company?.name || "",
        documentTypeLabel: DOC_TYPE_LABELS[request.documentType] || request.documentType,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-requests/by-token/:token/approve", async (req, res) => {
    try {
      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.token, req.params.token));

      if (!request) return res.status(404).json({ message: "ไม่พบคำขออนุมัติ" });
      if (request.status !== "pending") return res.status(400).json({ message: "คำขอนี้ดำเนินการแล้ว" });

      const userId = req.isAuthenticated?.() ? (req.user as any)?.id : null;

      const [updated] = await db
        .update(approvalRequests)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
        .where(eq(approvalRequests.id, request.id))
        .returning();

      const tableName = DOC_TYPE_TABLE_MAP[request.documentType];
      const approvedStatus = DOC_TYPE_APPROVED_STATUS[request.documentType] || "approved";
      if (tableName) {
        if (request.documentType === "QO") {
          await db.execute(
            `UPDATE ${tableName} SET status = '${approvedStatus}', customer_response = 'confirmed', customer_responded_at = NOW() WHERE id = ${request.documentId}`
          );
        } else {
          await db.execute(
            `UPDATE ${tableName} SET status = '${approvedStatus}' WHERE id = ${request.documentId}`
          );
        }
      }

      res.json({ ...updated, message: "อนุมัติเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/approval-requests/by-token/:token/reject", async (req, res) => {
    try {
      const { reason } = req.body;
      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.token, req.params.token));

      if (!request) return res.status(404).json({ message: "ไม่พบคำขออนุมัติ" });
      if (request.status !== "pending") return res.status(400).json({ message: "คำขอนี้ดำเนินการแล้ว" });

      const userId = req.isAuthenticated?.() ? (req.user as any)?.id : null;

      const [updated] = await db
        .update(approvalRequests)
        .set({ status: "rejected", approvedBy: userId, approvedAt: new Date(), rejectedReason: reason || null })
        .where(eq(approvalRequests.id, request.id))
        .returning();

      const tableName = DOC_TYPE_TABLE_MAP[request.documentType];
      if (tableName) {
        await db.execute(
          `UPDATE ${tableName} SET status = 'rejected' WHERE id = ${request.documentId}`
        );
      }

      res.json({ ...updated, message: "ปฏิเสธคำขอเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/approval-requests/for-document", requireAuth, async (req, res) => {
    try {
      const { companyId, documentType, documentId } = req.query;
      if (!companyId || !documentType || !documentId) {
        return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
      }
      if (!canAccessCompany(req, Number(companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });

      const requests = await db
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.companyId, Number(companyId)),
            eq(approvalRequests.documentType, String(documentType)),
            eq(approvalRequests.documentId, Number(documentId))
          )
        )
        .orderBy(desc(approvalRequests.requestedAt));

      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
