import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { tenantSubscriptions, subscriptionPlans } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const companyTenantCache = new Map<number, { tenantId: number | null; ts: number }>();
const userAllowedCache = new Map<number, { ids: number[] | null; ts: number }>();
const enabledModulesCache = new Map<number, { modules: string[] | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getEnabledModulesForTenant(tenantId: number): Promise<string[] | null> {
  const cached = enabledModulesCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.modules;
  try {
    const [sub] = await db.select({ planId: tenantSubscriptions.planId })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .orderBy(desc(tenantSubscriptions.createdAt))
      .limit(1);
    let modules: string[] | null = null;
    if (sub) {
      const [plan] = await db.select({ enabledModules: subscriptionPlans.enabledModules })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, sub.planId));
      modules = plan?.enabledModules || null;
    }
    enabledModulesCache.set(tenantId, { modules, ts: Date.now() });
    return modules;
  } catch {
    return null;
  }
}

export async function getCompanyTenantId(companyId: number): Promise<number | null> {
  const cached = companyTenantCache.get(companyId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tenantId;
  const company = await storage.getCompany(companyId);
  const tenantId = company?.tenantId ?? null;
  companyTenantCache.set(companyId, { tenantId, ts: Date.now() });
  return tenantId;
}

export async function getUserAllowedCompanyIds(userId: number): Promise<number[] | null> {
  const cached = userAllowedCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.ids;
  const user = await storage.getUser(userId);
  const ids = user?.allowedCompanyIds ?? null;
  userAllowedCache.set(userId, { ids, ts: Date.now() });
  return ids;
}

export function invalidateUserAllowedCache(userId: number) {
  userAllowedCache.delete(userId);
}

export function tenantGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return next();
  const user = req.user as any;
  if (user.role === "super_admin" || user.role === "superadmin") return next();

  const rawId = req.query.companyId || req.body?.companyId || req.params?.companyId;
  if (!rawId) return next();
  const companyId = Number(rawId);
  if (!companyId || isNaN(companyId)) return next();

  (async () => {
    if (user.tenantId) {
      const tenantId = await getCompanyTenantId(companyId);
      if (tenantId !== null && tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้" });
      }
    }

    const RESTRICTED_ROLES = ["client", "employee", "accountant", "manager"];
    if (RESTRICTED_ROLES.includes(user.role)) {
      const allowedIds = await getUserAllowedCompanyIds(user.id);
      if (allowedIds && allowedIds.length > 0) {
        if (!allowedIds.includes(companyId)) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้" });
        }
      } else if (user.role === "client") {
        return res.status(403).json({ message: "ยังไม่ได้กำหนดบริษัทที่เข้าถึงได้" });
      }
    }

    next();
  })().catch(() => {
    res.status(500).json({ message: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
  });
}

export async function checkDocOwnership(
  docCompanyId: number | null | undefined,
  user: any,
): Promise<{ allowed: boolean; message?: string }> {
  if (!docCompanyId) return { allowed: true };
  if (!user) return { allowed: false, message: "กรุณาเข้าสู่ระบบ" };
  if (user.role === "super_admin" || user.role === "superadmin") return { allowed: true };

  if (user.tenantId) {
    const tenantId = await getCompanyTenantId(docCompanyId);
    if (tenantId !== null && tenantId !== user.tenantId) {
      return { allowed: false, message: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" };
    }
  }

  const RESTRICTED_ROLES2 = ["client", "employee", "accountant", "manager"];
  if (RESTRICTED_ROLES2.includes(user.role)) {
    const allowedIds = await getUserAllowedCompanyIds(user.id);
    if (allowedIds && allowedIds.length > 0) {
      if (!allowedIds.includes(docCompanyId)) {
        return { allowed: false, message: "ไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้" };
      }
    }
  }

  return { allowed: true };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user || user.role !== "super_admin") {
    return res.status(403).json({ message: "เฉพาะเจ้าของแพลตฟอร์มเท่านั้น" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });
    }
    next();
  };
}

export function requireModule(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });

    const { PRIMARY_ONLY_MODULES, FIRM_ONLY_MODULES, hasPermission } = await import("@shared/permissions");

    let tenantType = "accounting_firm";
    if (user.tenantId) {
      const tenant = await storage.getTenant(user.tenantId);
      tenantType = tenant?.tenantType || "accounting_firm";
    } else {
      const primaryCompany = await storage.getPrimaryCompany();
      tenantType = primaryCompany?.tenantType || "accounting_firm";
    }
    if (tenantType === "general_business" && FIRM_ONLY_MODULES.includes(moduleKey)) {
      return res.status(403).json({ message: "ฟีเจอร์นี้ใช้ได้เฉพาะสำนักงานบัญชี" });
    }

    if (user.tenantId && moduleKey !== "settings") {
      const enabledModules = await getEnabledModulesForTenant(user.tenantId);
      if (enabledModules && enabledModules.length > 0 && !enabledModules.includes(moduleKey)) {
        return res.status(403).json({ message: "แพ็คเกจของคุณไม่รองรับฟีเจอร์นี้" });
      }
    }

    switch (user.role) {
      case "admin":
      case "super_admin":
        return next();

      case "client_external":
        if (moduleKey === "etax-hub") return next();
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });

      case "manager":
      case "accountant":
      case "employee":
      case "cashier":
      case "client": {
        if (PRIMARY_ONLY_MODULES.includes(moduleKey)) {
          const managerHrException = user.role === "manager" && moduleKey === "hr";
          const managerSettingsException = user.role === "manager" && moduleKey === "settings";
          if (!managerHrException && !managerSettingsException) {
            const companyId = req.query.companyId ? Number(req.query.companyId) : null;
            if (companyId) {
              const company = await storage.getCompany(companyId);
              if (!company?.isPrimary) {
                return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้ในบริษัทลูกค้า" });
              }
            }
          }
        }

        const perms = await storage.getRolePermissionsByRole(user.role);
        if (perms.length === 0) {
          if (hasPermission(user.role, moduleKey)) return next();
          return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });
        }
        const perm = perms.find(p => p.moduleKey === moduleKey);
        if (perm && perm.allowed) return next();
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });
      }

      default: {
        const errMsg = `[requireModule] Unhandled role "${user.role}" for userId=${user.id}, module="${moduleKey}", path=${req.path}`;
        console.error(errMsg);
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง — role ไม่รู้จัก", debug: errMsg });
      }
    }
  };
}

export function requireAnyModule(...moduleKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });

    switch (user.role) {
      case "admin":
      case "super_admin":
        return next();

      case "manager":
      case "accountant":
      case "employee":
      case "cashier":
      case "client":
      case "client_external": {
        const { hasPermission } = await import("@shared/permissions");
        const perms = await storage.getRolePermissionsByRole(user.role);
        for (const moduleKey of moduleKeys) {
          if (perms.length === 0) {
            if (hasPermission(user.role, moduleKey)) return next();
          } else {
            const perm = perms.find(p => p.moduleKey === moduleKey);
            if (perm && perm.allowed) return next();
          }
        }
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });
      }

      default: {
        const errMsg = `[requireAnyModule] Unhandled role "${user.role}" for userId=${user.id}, modules=[${moduleKeys.join(",")}], path=${req.path}`;
        console.error(errMsg);
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง — role ไม่รู้จัก", debug: errMsg });
      }
    }
  };
}
