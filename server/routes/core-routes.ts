import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, desc, and, or, isNull, inArray , sql } from "drizzle-orm";
import { users, companies, employees, firmClients, permissions, tenants, accounts, tenantSubscriptions, subscriptionPlans, insertUserSchema } from "@shared/schema";
import { requireAuth, requireAdmin } from "../route-middleware";
import { hashPassword } from "../auth";
import { z } from "zod";

export function registerCoreRoutes(app: Express) {
app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const currentUser = req.user as any;
  const tenantId = currentUser.tenantId;
  const filterCompanyId = req.query.companyId ? Number(req.query.companyId) : null;

  let allUsers: any[];
  if (tenantId) {
    allUsers = await db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.id);
  } else {
    allUsers = await db.select().from(users).orderBy(users.id);
  }
  const safeUsers = allUsers.map(({ password, ...u }: any) => u);

  const empQueryCompanyIds = filterCompanyId
    ? [filterCompanyId]
    : tenantId
      ? (await db.select({ id: companies.id }).from(companies).where(eq(companies.tenantId, tenantId))).map(c => c.id)
      : [];
  const empConditions = empQueryCompanyIds.length > 0
    ? and(sql`${employees.userId} IS NOT NULL`, inArray(employees.companyId, empQueryCompanyIds))
    : sql`${employees.userId} IS NOT NULL`;
  const empLinks = await db.select({ userId: employees.userId, empId: employees.id, empName: employees.fullName }).from(employees).where(empConditions!);
  const empMap = new Map(empLinks.map(e => [e.userId, { employeeId: e.empId, employeeName: e.empName }]));
  const usersWithEmp = safeUsers.map((u: any) => ({ ...u, linkedEmployee: empMap.get(u.id) || null }));

  if (filterCompanyId) {
    const linkedUserIds = new Set(empLinks.map(e => e.userId));
    const allEmpLinks = await db.select({ userId: employees.userId }).from(employees).where(sql`${employees.userId} IS NOT NULL`);
    const allLinkedUserIds = new Set(allEmpLinks.map(e => e.userId));

    const assignedEmpIds = await db.select({ assignedTo: firmClients.assignedTo })
      .from(firmClients)
      .where(and(eq(firmClients.companyId, filterCompanyId), sql`${firmClients.assignedTo} IS NOT NULL`));
    const assignedEmpIdSet = new Set(assignedEmpIds.map(a => a.assignedTo));
    let assignedUserIds = new Set<number>();
    if (assignedEmpIdSet.size > 0) {
      const assignedEmps = await db.select({ userId: employees.userId })
        .from(employees)
        .where(and(sql`${employees.userId} IS NOT NULL`, inArray(employees.id, [...assignedEmpIdSet])));
      assignedUserIds = new Set(assignedEmps.map(e => e.userId!));
    }

    const filtered = usersWithEmp.filter((u: any) =>
      u.role === "admin" || linkedUserIds.has(u.id) || assignedUserIds.has(u.id) ||
      (Array.isArray(u.allowedCompanyIds) && u.allowedCompanyIds.includes(filterCompanyId))
    );
    return res.json(filtered);
  }

  res.json(usersWithEmp);
});

app.get("/api/users/unlinked-employees", requireAuth, requireAdmin, async (req, res) => {
  const currentUser = req.user as any;
  const tenantId = currentUser.tenantId;
  if (tenantId) {
    const tenantCompanyIds = (await db.select({ id: companies.id }).from(companies).where(eq(companies.tenantId, tenantId))).map(c => c.id);
    if (tenantCompanyIds.length === 0) return res.json([]);
    const unlinked = await db.select({ id: employees.id, fullName: employees.fullName })
      .from(employees)
      .where(and(isNull(employees.userId), inArray(employees.companyId, tenantCompanyIds)))
      .orderBy(employees.fullName);
    return res.json(unlinked);
  }
  const unlinked = await db.select({ id: employees.id, fullName: employees.fullName })
    .from(employees)
    .where(isNull(employees.userId))
    .orderBy(employees.fullName);
  res.json(unlinked);
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentUser = req.user as any;
    if (currentUser.tenantId) {
      const limitCheck = await storage.checkTenantLimit(currentUser.tenantId, "users");
      if (!limitCheck.allowed) {
        return res.status(403).json({ message: `แพ็คเกจ ${limitCheck.planName} รองรับผู้ใช้สูงสุด ${limitCheck.limit} คน (ใช้แล้ว ${limitCheck.current} คน) กรุณาอัพเกรดแพ็คเกจ` });
      }
    }
    const { hashPassword } = await import("../auth");
    const parsed = insertUserSchema.parse(req.body);
    const existing = await storage.getUserByUsername(parsed.username);
    if (existing) {
      return res.status(400).json({ message: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
    }
    parsed.password = await hashPassword(parsed.password);
    const tenantId = currentUser.tenantId;
    if (tenantId) {
      parsed.tenantId = tenantId;
    }
    const user = await storage.createUser(parsed);
    const employeeId = req.body.employeeId;
    if (tenantId) {
      const tenantCompanyIds = (await db.select({ id: companies.id }).from(companies).where(eq(companies.tenantId, tenantId))).map(c => c.id);
      if (tenantCompanyIds.length > 0) {
        if (employeeId) {
          await db.update(employees).set({ userId: user.id }).where(and(eq(employees.id, Number(employeeId)), isNull(employees.userId), inArray(employees.companyId, tenantCompanyIds)));
        } else {
          const fullName = (parsed.fullName || "").replace(/\s+/g, "");
          if (fullName) {
            const scopedEmployees = await db.select().from(employees).where(and(isNull(employees.userId), inArray(employees.companyId, tenantCompanyIds)));
            const match = scopedEmployees.find(e => (e.fullName || "").replace(/\s+/g, "") === fullName);
            if (match) {
              await db.update(employees).set({ userId: user.id }).where(eq(employees.id, match.id));
            }
          }
        }
      }
    } else {
      if (employeeId) {
        await db.update(employees).set({ userId: user.id }).where(and(eq(employees.id, Number(employeeId)), isNull(employees.userId)));
      }
    }
    const { password, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentUser = req.user as any;
    const tenantId = currentUser.tenantId;
    const userId = Number(req.params.id);
    if (tenantId) {
      const [targetUser] = await db.select({ id: users.id, tenantId: users.tenantId }).from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขผู้ใช้นี้" });
      }
    }
    const updateData: any = {};
    if (req.body.role) updateData.role = req.body.role;
    if (req.body.active !== undefined) updateData.active = req.body.active;
    if (req.body.fullName) updateData.fullName = req.body.fullName;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.password) {
      const { hashPassword } = await import("../auth");
      updateData.password = await hashPassword(req.body.password);
    }
    if (req.body.lineId !== undefined) updateData.lineId = req.body.lineId;
    if (req.body.allowedCompanyIds !== undefined) updateData.allowedCompanyIds = req.body.allowedCompanyIds;
    const user = await storage.updateUser(userId, updateData);
    if (req.body.allowedCompanyIds !== undefined) {
      const { invalidateUserAllowedCache } = await import("./route-middleware");
      invalidateUserAllowedCache(userId);
    }
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    if (req.body.employeeId !== undefined) {
      if (tenantId) {
        const tenantCompanyIds = (await db.select({ id: companies.id }).from(companies).where(eq(companies.tenantId, tenantId))).map(c => c.id);
        if (tenantCompanyIds.length > 0) {
          await db.update(employees).set({ userId: null }).where(and(eq(employees.userId, userId), inArray(employees.companyId, tenantCompanyIds)));
          if (req.body.employeeId) {
            await db.update(employees).set({ userId: userId }).where(and(eq(employees.id, Number(req.body.employeeId)), isNull(employees.userId), inArray(employees.companyId, tenantCompanyIds)));
          }
        }
      } else {
        await db.update(employees).set({ userId: null }).where(eq(employees.userId, userId));
        if (req.body.employeeId) {
          await db.update(employees).set({ userId: userId }).where(and(eq(employees.id, Number(req.body.employeeId)), isNull(employees.userId)));
        }
      }
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/permissions", requireAuth, async (_req, res) => {
  const perms = await storage.getRolePermissions();
  if (perms.length === 0) {
    await storage.initDefaultPermissions();
    const initialized = await storage.getRolePermissions();
    return res.json(initialized);
  }
  res.json(perms);
});

app.get("/api/permissions/me", requireAuth, async (req, res) => {
  const user = req.user as any;
  const { PERMISSION_MODULES, PRIMARY_ONLY_MODULES, FIRM_ONLY_MODULES, SUB_MODULES, CONFIDENTIAL_SUB_MODULES, HR_PERSONAL_SUB_MODULES, HR_ADMIN_SUB_MODULES } = await import("@shared/permissions");
  const companyId = req.query.companyId ? Number(req.query.companyId) : null;

  let isPrimary = true;
  if (companyId) {
    const company = await storage.getCompany(companyId);
    isPrimary = company?.isPrimary === true;
  }

  let tenantType = "general_business";
  if (user.tenantId) {
    const tenant = await storage.getTenant(user.tenantId);
    if (tenant) tenantType = tenant.tenantType;
  } else {
    const primaryCompany = await storage.getPrimaryCompany();
    tenantType = primaryCompany?.tenantType || "accounting_firm";
  }

  let allowedModules: string[];
  if (user.role === "admin") {
    allowedModules = PERMISSION_MODULES.map(m => m.key);
  } else {
    let perms = await storage.getRolePermissionsByRole(user.role);
    if (perms.length === 0) {
      await storage.initDefaultPermissions();
      perms = await storage.getRolePermissionsByRole(user.role);
    }
    allowedModules = perms.filter(p => p.allowed).map(p => p.moduleKey);
  }

  if (tenantType === "general_business") {
    allowedModules = allowedModules.filter(m => !FIRM_ONLY_MODULES.includes(m));
  }

  if (!isPrimary && user.role !== "admin" && user.role !== "manager") {
    const isAccountingFirm = tenantType === "accounting_firm";
    const accountantExceptions = isAccountingFirm && (user.role === "accountant") ? ["hr", "firm-mgmt"] : [];
    allowedModules = allowedModules.filter(m =>
      !PRIMARY_ONLY_MODULES.includes(m) || accountantExceptions.includes(m)
    );
  }

  const allRolePerms = user.role !== "admin" ? await storage.getRolePermissionsByRole(user.role) : [];
  const roleDeniedSubKeys = new Set(
    allRolePerms.filter(p => !p.allowed && SUB_MODULES.some(s => s.key === p.moduleKey)).map(p => p.moduleKey)
  );

  let allowedSubModules: string[] = [];
  if (user.role === "admin") {
    allowedSubModules = SUB_MODULES.filter(s => allowedModules.includes(s.parentModule)).map(s => s.key);
  } else if (user.role === "manager") {
    const userSubPerms = await storage.getUserSubPermissions(user.id);
    if (userSubPerms.length === 0) {
      allowedSubModules = SUB_MODULES
        .filter(s => allowedModules.includes(s.parentModule) && !roleDeniedSubKeys.has(s.key))
        .map(s => s.key);
    } else {
      const deniedKeys = new Set(userSubPerms.filter(p => !p.allowed).map(p => p.subModuleKey));
      allowedSubModules = SUB_MODULES
        .filter(s => allowedModules.includes(s.parentModule) && !roleDeniedSubKeys.has(s.key) && !deniedKeys.has(s.key))
        .map(s => s.key);
    }
  } else {
    const isAccountantAtFirm = tenantType === "accounting_firm" && user.role === "accountant";
    const skipConfidentialForClientHr = isAccountantAtFirm && !isPrimary;
    const userSubPerms = await storage.getUserSubPermissions(user.id);
    if (userSubPerms.length === 0) {
      allowedSubModules = SUB_MODULES
        .filter(s => {
          if (!allowedModules.includes(s.parentModule)) return false;
          if (roleDeniedSubKeys.has(s.key)) return false;
          if (CONFIDENTIAL_SUB_MODULES.includes(s.key)) {
            if (skipConfidentialForClientHr && s.parentModule === "hr") return true;
            return false;
          }
          return true;
        })
        .map(s => s.key);
    } else {
      const deniedKeys = new Set(userSubPerms.filter(p => !p.allowed).map(p => p.subModuleKey));
      const grantedKeys = new Set(userSubPerms.filter(p => p.allowed).map(p => p.subModuleKey));
      allowedSubModules = SUB_MODULES
        .filter(s => {
          if (!allowedModules.includes(s.parentModule)) return false;
          if (roleDeniedSubKeys.has(s.key)) return false;
          if (deniedKeys.has(s.key)) return false;
          if (CONFIDENTIAL_SUB_MODULES.includes(s.key)) {
            if (skipConfidentialForClientHr && s.parentModule === "hr") return true;
            return grantedKeys.has(s.key);
          }
          return true;
        })
        .map(s => s.key);
    }
  }

  if (user.role !== "admin" && user.role !== "manager" && tenantType === "accounting_firm") {
    if (isPrimary) {
      allowedSubModules = allowedSubModules.filter(k => !HR_ADMIN_SUB_MODULES.includes(k));
    } else {
      allowedSubModules = allowedSubModules.filter(k => !HR_PERSONAL_SUB_MODULES.includes(k));
    }
  }

  if (user.role === "employee" && companyId) {
    try {
      const [gs] = await db.select().from(generalSettings).where(eq(generalSettings.companyId, companyId)).limit(1);
      if (gs?.hiddenEmployeeModules) {
        const hidden: string[] = JSON.parse(gs.hiddenEmployeeModules);
        if (Array.isArray(hidden) && hidden.length > 0) {
          allowedSubModules = allowedSubModules.filter(k => !hidden.includes(k));
        }
      }
    } catch {}
  }

  if (user.tenantId) {
    try {
      const { getEnabledModulesForTenant } = await import("../route-middleware");
      const enabledModules = await getEnabledModulesForTenant(user.tenantId);
      if (enabledModules && enabledModules.length > 0) {
        const enabledSet = new Set(enabledModules);
        enabledSet.add("settings");
        allowedModules = allowedModules.filter(m => enabledSet.has(m));
      }
    } catch {}
  }

  res.json({ modules: allowedModules, subModules: allowedSubModules });
});

app.put("/api/permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, moduleKey, allowed } = req.body;
    if (!role || !moduleKey || typeof allowed !== "boolean") {
      return res.status(400).json({ message: "กรุณาระบุ role, moduleKey, allowed" });
    }
    if (role === "admin") {
      return res.status(400).json({ message: "ไม่สามารถแก้ไขสิทธิ์ของผู้ดูแลระบบได้" });
    }
    const result = await storage.setRolePermission(role, moduleKey, allowed);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/permissions/users/:id/submodules", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const perms = await storage.getUserSubPermissions(userId);
  res.json(perms);
});

app.put("/api/permissions/users/:id/submodules", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "กรุณาระบุ permissions เป็น array" });
    }
    await storage.bulkSetUserSubPermissions(userId, permissions);
    res.json({ message: "บันทึกสิทธิ์เมนูย่อยสำเร็จ" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/companies", requireAuth, async (req, res) => {
  const user = req.user as any;

  let isAccountingFirm = false;
  if (user.tenantId) {
    const [tenant] = await db.select({ tenantType: tenants.tenantType }).from(tenants).where(eq(tenants.id, user.tenantId));
    isAccountingFirm = tenant?.tenantType === "accounting_firm";
  }

  const conditions: any[] = [eq(companies.active, true)];
  if (user.tenantId) {
    conditions.push(eq(companies.tenantId, user.tenantId));
  }

  if (user.role === "superadmin" || user.role === "admin" || user.role === "manager") {
    if (isAccountingFirm) {
      const activeFcCompanyIds = await db.select({ companyId: firmClients.companyId })
        .from(firmClients)
        .innerJoin(companies, eq(firmClients.companyId, companies.id))
        .where(and(eq(companies.tenantId, user.tenantId), eq(firmClients.status, "active")));
      const fcIds = activeFcCompanyIds.map(r => r.companyId).filter(Boolean) as number[];
      const result = await db.select().from(companies)
        .where(and(...conditions, or(eq(companies.isPrimary, true), fcIds.length > 0 ? inArray(companies.id, fcIds) : sql`false`)))
        .orderBy(desc(companies.isPrimary), companies.name);
      res.json(result);
    } else {
      const result = await db.select().from(companies)
        .where(and(...conditions))
        .orderBy(desc(companies.isPrimary), companies.name);
      res.json(result);
    }
  } else {
    const companiesList = await storage.getCompaniesForUser(user.id, user.tenantId, user.role);
    res.json(companiesList);
  }
});

app.get("/api/companies/primary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    if (!tenantId) {
      const comp = await db.select().from(companies).where(eq(companies.isPrimary, true)).limit(1);
      return res.json(comp[0] || null);
    }
    const comp = await db.select().from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.isPrimary, true)))
      .limit(1);
    if (comp[0]) return res.json(comp[0]);
    const fallback = await db.select().from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.active, true)))
      .orderBy(companies.id)
      .limit(1);
    return res.json(fallback[0] || null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/companies", requireAuth, async (req, res) => {
  try {
    const currentUser = req.user as any;
    if (currentUser.tenantId) {
      const limitCheck = await storage.checkTenantLimit(currentUser.tenantId, "companies");
      if (!limitCheck.allowed) {
        return res.status(403).json({ message: `แพ็คเกจ ${limitCheck.planName} รองรับบริษัทสูงสุด ${limitCheck.limit} บริษัท (มีแล้ว ${limitCheck.current}) กรุณาอัพเกรดแพ็คเกจ` });
      }
    }
    const parsed = insertCompanySchema.parse(req.body);
    if (currentUser.tenantId && !parsed.tenantId) {
      parsed.tenantId = currentUser.tenantId;
    }
    const company = await storage.createCompany(parsed);

    // Auto-seed extra accounts based on businessType
    if (parsed.businessType) {
      try {
        const { ECOMMERCE_EXTRA_ACCOUNTS, ACCOUNTING_FIRM_EXTRA_ACCOUNTS } = await import("@shared/chart-of-accounts");
        const bt = parsed.businessType;
        let extraAccounts: typeof ECOMMERCE_EXTRA_ACCOUNTS = [];
        if (bt === "online_shop" || bt === "ecommerce") {
          extraAccounts = ECOMMERCE_EXTRA_ACCOUNTS;
        } else if (bt === "accounting" || bt === "accounting_firm" || bt === "service") {
          extraAccounts = ACCOUNTING_FIRM_EXTRA_ACCOUNTS;
        }
        if (extraAccounts.length > 0) {
          const existingAccounts = await db.select().from(accounts).where(eq(accounts.companyId, company.id));
          const existingByCode = new Map(existingAccounts.map(a => [a.code, a]));
          const parentCodes = new Set(extraAccounts.map(a => a.parentCode).filter(Boolean));
          for (const tmpl of extraAccounts) {
            if (!existingByCode.has(tmpl.code)) {
              const hasChildren = parentCodes.has(tmpl.code);
              try {
                await db.insert(accounts).values({
                  companyId: company.id, code: tmpl.code, name: tmpl.name,
                  nameTh: tmpl.nameTh, nameZh: tmpl.nameZh, type: tmpl.type,
                  parentCode: tmpl.parentCode, isHeader: hasChildren,
                });
              } catch (e: any) { /* skip if duplicate */ }
            }
          }
          // Fix isHeader flags
          const refreshed = await db.select().from(accounts).where(eq(accounts.companyId, company.id));
          const usedParents = new Set(refreshed.map(a => a.parentCode).filter(Boolean));
          for (const acc of refreshed) {
            const shouldBeHeader = usedParents.has(acc.code);
            if (acc.isHeader !== shouldBeHeader) {
              await db.update(accounts).set({ isHeader: shouldBeHeader }).where(eq(accounts.id, acc.id));
            }
          }
        }
      } catch (e: any) { console.log("Auto-seed accounts:", e.message); }
    }

    try {
      await db.insert(branches).values({ companyId: company.id, code: "00000", name: "สำนักงานใหญ่", active: true });
    } catch (e: any) { /* skip if already exists */ }

    res.status(201).json(company);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/companies/:id", requireAuth, async (req, res) => {
  const user = req.user as any;
  const id = Number(req.params.id);
  if (user.role === "client") {
    const { getUserAllowedCompanyIds } = await import("../route-middleware");
    const allowed = await getUserAllowedCompanyIds(user.id);
    if (!allowed || !allowed.includes(id)) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
  }
  const company = await storage.getCompany(id);
  if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });
  if (user.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
  res.json(company);
});

app.patch("/api/companies/:id", requireAuth, async (req, res) => {
  try {
  const companyId = Number(req.params.id);
  const user = req.user as any;
  const existing = await storage.getCompany(companyId);
  if (!existing) return res.status(404).json({ message: "ไม่พบบริษัท" });
  if (user.role !== "super_admin" && user.tenantId && existing.tenantId !== user.tenantId) {
    return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขบริษัทนี้" });
  }
  const company = await storage.updateCompany(companyId, req.body);
  if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });

  // Auto-merge extra accounts from template when businessType changes
  if (req.body.businessType) {
    try {
      const { ECOMMERCE_EXTRA_ACCOUNTS, ACCOUNTING_FIRM_EXTRA_ACCOUNTS } = await import("@shared/chart-of-accounts");
      const bt = req.body.businessType;
      let extraAccounts: typeof ECOMMERCE_EXTRA_ACCOUNTS = [];
      if (bt === "online_shop" || bt === "ecommerce") {
        extraAccounts = ECOMMERCE_EXTRA_ACCOUNTS;
      } else if (bt === "accounting" || bt === "accounting_firm" || bt === "service") {
        extraAccounts = ACCOUNTING_FIRM_EXTRA_ACCOUNTS;
      }

      if (extraAccounts.length > 0) {
        const existingAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
        const existingByCode = new Map(existingAccounts.map(a => [a.code, a]));
        const allCodes = new Set([...existingAccounts.map(a => a.code), ...extraAccounts.map(a => a.code)]);
        const parentCodes = new Set(extraAccounts.map(a => a.parentCode).filter(Boolean));
        const allParentCodes = new Set([...existingAccounts.filter(a => {
          const children = existingAccounts.filter(c => c.parentCode === a.code);
          return children.length > 0;
        }).map(a => a.code), ...parentCodes]);

        for (const tmpl of extraAccounts) {
          const existing = existingByCode.get(tmpl.code);
          if (!existing) {
            // Insert new account
            const hasChildren = parentCodes.has(tmpl.code);
            try {
              await db.insert(accounts).values({
                companyId,
                code: tmpl.code,
                name: tmpl.name,
                nameTh: tmpl.nameTh,
                nameZh: tmpl.nameZh,
                type: tmpl.type,
                parentCode: tmpl.parentCode,
                isHeader: hasChildren,
              });
            } catch (e: any) { /* skip if duplicate */ }
          } else {
            const needsUpdate = existing.name !== tmpl.name || existing.nameTh !== tmpl.nameTh;
            if (needsUpdate) {
              await db.update(accounts)
                .set({ name: tmpl.name, nameTh: tmpl.nameTh, nameZh: tmpl.nameZh })
                .where(and(eq(accounts.companyId, companyId), eq(accounts.code, tmpl.code)));
            }
          }
        }

        // Fix isHeader flags: any account that is parentCode of another is a header
        const refreshedAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
        const usedParents = new Set(refreshedAccounts.map(a => a.parentCode).filter(Boolean));
        for (const acc of refreshedAccounts) {
          const shouldBeHeader = usedParents.has(acc.code);
          if (acc.isHeader !== shouldBeHeader) {
            await db.update(accounts)
              .set({ isHeader: shouldBeHeader })
              .where(eq(accounts.id, acc.id));
          }
        }
      }
    } catch (e: any) {
      console.log("Auto-merge accounts for businessType change:", e.message);
    }
  }

  res.json(company);
  } catch (e: any) {
    console.error("PATCH /api/companies/:id error:", e.message);
    res.status(500).json({ message: "บันทึกไม่สำเร็จ: " + e.message });
  }
});

app.patch("/api/companies/:id/gps-settings", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "admin" && user.role !== "owner" && user.role !== "super_admin") {
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขตั้งค่า GPS" });
    }
    const companyId = Number(req.params.id);
    const { gpsRequired, officeLat, officeLng, gpsRadiusMeters } = req.body;
    if (gpsRequired && (!officeLat || !officeLng)) {
      const locations = await db.select().from(workLocations).where(and(eq(workLocations.companyId, companyId), eq(workLocations.active, true)));
      if (locations.length === 0) {
        return res.status(400).json({ message: "กรุณาระบุพิกัดสำนักงาน (ละติจูด/ลองจิจูด) หรือเพิ่มสาขาที่มีพิกัดก่อนเปิดใช้งาน GPS" });
      }
    }
    const updateData: any = {};
    if (gpsRequired !== undefined) updateData.gpsRequired = gpsRequired;
    if (officeLat !== undefined) updateData.officeLat = officeLat != null ? String(officeLat) : null;
    if (officeLng !== undefined) updateData.officeLng = officeLng != null ? String(officeLng) : null;
    if (gpsRadiusMeters !== undefined) updateData.gpsRadiusMeters = gpsRadiusMeters;
    const [updated] = await db.update(companies).set(updateData).where(eq(companies.id, companyId)).returning();
    if (!updated) return res.status(404).json({ message: "ไม่พบบริษัท" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.post("/api/companies/:id/set-primary", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (user.role !== "admin" && user.role !== "manager") {
    return res.status(403).json({ message: "ไม่มีสิทธิ์ตั้งบริษัทหลัก" });
  }
  const id = Number(req.params.id);
  try {
    await storage.setCompanyPrimary(id);
    const company = await storage.getCompany(id);
    res.json(company);
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
});

// HR routes registered via registerHrRoutes(app)
// ==================== Task Management Routes ====================

}
