import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { companies, quotations, salesOrders, employees, purchaseRequests, leaveRequests, otRecords } from "@shared/schema";
import { requireAuth } from "../route-middleware";

export function registerApprovalCenterRoutes(app: Express) {
// ============ Approval Center ============

app.get("/api/approval-center", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const results: any = { categories: [] };

    const userCompanies = await db.select({ id: companies.id }).from(companies)
      .where(user.tenantId ? eq(companies.tenantId, user.tenantId) : sql`false`);
    const allowedIds = userCompanies.map(c => c.id);
    if (!allowedIds.includes(companyId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const docConfigs = [
      { table: quotations, noCol: quotations.quotationNo, dateCol: quotations.quotationDate, amtCol: quotations.totalAmount, label: "ใบเสนอราคา", code: "QO", pendingStatus: "pending_approval", href: "/sales/quote", group: "sales" },
      { table: salesOrders, noCol: salesOrders.orderNo, dateCol: salesOrders.orderDate, amtCol: salesOrders.totalAmount, label: "ใบสั่งขาย", code: "SO", pendingStatus: "pending", href: "/sales/order", group: "sales" },
      { table: purchaseRequests, noCol: purchaseRequests.prNo, dateCol: purchaseRequests.prDate, amtCol: purchaseRequests.totalAmount, label: "ใบขอซื้อ", code: "PR", pendingStatus: "pending_approval", href: "/purchases/pr", group: "purchases" },
    ];

    const salesItems: any[] = [];
    const purchaseItems: any[] = [];

    for (const doc of docConfigs) {
      const [countResult] = await db.select({ total: sql<number>`count(*)::int` })
        .from(doc.table)
        .where(and(
          eq((doc.table as any).companyId, companyId),
          eq((doc.table as any).status, doc.pendingStatus),
        ));
      const totalCount = countResult?.total || 0;

      const rows = await db.select({
        id: doc.table.id,
        docNumber: doc.noCol,
        status: (doc.table as any).status,
        totalAmount: doc.amtCol,
        date: doc.dateCol,
      })
        .from(doc.table)
        .where(and(
          eq((doc.table as any).companyId, companyId),
          eq((doc.table as any).status, doc.pendingStatus),
        ))
        .orderBy(desc(doc.dateCol))
        .limit(10);

      const entry = {
        label: doc.label,
        code: doc.code,
        href: doc.href,
        count: totalCount,
        items: rows.map(r => ({
          id: r.id,
          docNumber: r.docNumber || `${doc.code}-${r.id}`,
          status: r.status,
          totalAmount: Number(r.totalAmount) || 0,
          date: r.date,
        })),
      };
      if (doc.group === "sales") salesItems.push(entry);
      else purchaseItems.push(entry);
    }

    let leaveItems: any[] = [];
    let otItems: any[] = [];
    try {
      const tenantId = user.tenantId;
      const isTenantApprover = ["admin", "super_admin", "owner"].includes(user.role);
      const isCompanyApprover = ["manager", "hr"].includes(user.role);
      if (tenantId) {
        const leaveConditions = [
          eq(leaveRequests.status, "pending"),
        ];
        if (isTenantApprover) {
          leaveConditions.push(eq(employees.tenantId, tenantId));
        } else if (isCompanyApprover) {
          leaveConditions.push(eq(employees.companyId, companyId));
        } else if (user.employeeId) {
          leaveConditions.push(eq(leaveRequests.employeeId, user.employeeId));
        }

        const pendingLeaves = await db.select({
          id: leaveRequests.id,
          leaveType: leaveRequests.leaveType,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          days: leaveRequests.days,
          reason: leaveRequests.reason,
          status: leaveRequests.status,
          employeeId: leaveRequests.employeeId,
        })
          .from(leaveRequests)
          .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
          .where(and(...leaveConditions))
          .orderBy(desc(leaveRequests.createdAt))
          .limit(50);

        for (const lv of pendingLeaves) {
          const emp = await db.select({ firstName: employees.firstName, lastName: employees.lastName })
            .from(employees).where(eq(employees.id, lv.employeeId)).limit(1);
          leaveItems.push({
            ...lv,
            employeeName: emp[0] ? `${emp[0].firstName} ${emp[0].lastName}` : `พนักงาน #${lv.employeeId}`,
            days: Number(lv.days),
          });
        }

        const otConditions = [
          eq(otRecords.status, "pending"),
        ];
        if (isTenantApprover) {
          otConditions.push(eq(employees.tenantId, tenantId));
        } else if (isCompanyApprover) {
          otConditions.push(eq(employees.companyId, companyId));
        } else if (user.employeeId) {
          otConditions.push(eq(otRecords.employeeId, user.employeeId));
        }

        const pendingOt = await db.select({
          id: otRecords.id,
          date: otRecords.date,
          otType: otRecords.otType,
          hours: otRecords.hours,
          amount: otRecords.amount,
          status: otRecords.status,
          employeeId: otRecords.employeeId,
        })
          .from(otRecords)
          .innerJoin(employees, eq(otRecords.employeeId, employees.id))
          .where(and(...otConditions))
          .orderBy(desc(otRecords.date))
          .limit(50);

        for (const ot of pendingOt) {
          const emp = await db.select({ firstName: employees.firstName, lastName: employees.lastName })
            .from(employees).where(eq(employees.id, ot.employeeId)).limit(1);
          otItems.push({
            ...ot,
            employeeName: emp[0] ? `${emp[0].firstName} ${emp[0].lastName}` : `พนักงาน #${ot.employeeId}`,
            hours: Number(ot.hours),
            amount: Number(ot.amount),
          });
        }
      }
    } catch (err) {
      // HR tables might not exist yet
    }

    const salesCount = salesItems.reduce((sum, d) => sum + d.count, 0);
    const purchaseCount = purchaseItems.reduce((sum, d) => sum + d.count, 0);
    const hrCount = leaveItems.length + otItems.length;

    results.categories = [
      { key: "sales", label: "เอกสารขาย", icon: "FileText", count: salesCount, docs: salesItems },
      { key: "purchases", label: "เอกสารซื้อ", icon: "Package", count: purchaseCount, docs: purchaseItems },
      {
        key: "hr", label: "ทรัพยากรบุคคล", icon: "Users", count: hrCount,
        docs: [
          { label: "ขอลา", code: "LEAVE", href: "/hr/leave", count: leaveItems.length, items: leaveItems },
          { label: "ขอ OT", code: "OT", href: "/hr/ot", count: otItems.length, items: otItems },
        ],
      },
    ];
    results.totalPending = salesCount + purchaseCount + hrCount;

    res.json(results);
  } catch (err: any) {
    console.error("[Approval Center]", err.message?.slice(0, 200));
    res.status(500).json({ message: "Error loading approval center" });
  }
});

}
