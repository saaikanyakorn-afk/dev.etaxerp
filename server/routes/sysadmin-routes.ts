import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sysAdmins, sysAdminPasswordHistory, sysAdminPasswordPolicy, sysAdminAuditLog } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { hashPassword, comparePasswords } from "../auth";

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
}

async function requireSysAdminAuth(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  if (!session.sysAdminId) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ SysAdmin" });
  }
  const policy = await getPasswordPolicy();
  if (session.sysAdminLastActivity) {
    const elapsed = Date.now() - session.sysAdminLastActivity;
    if (elapsed > policy.sessionTimeoutMinutes * 60000) {
      delete session.sysAdminId;
      delete session.sysAdminLastActivity;
      return res.status(440).json({ message: `Session หมดอายุ (ไม่มีการใช้งาน ${policy.sessionTimeoutMinutes} นาที)`, sessionExpired: true });
    }
  }
  session.sysAdminLastActivity = Date.now();

  if (policy.ipWhitelistEnabled && policy.ipWhitelist && policy.ipWhitelist.length > 0) {
    const clientIp = getClientIp(req);
    if (!policy.ipWhitelist.includes(clientIp)) {
      return res.status(403).json({ message: `IP ${clientIp} ไม่ได้อยู่ใน Whitelist` });
    }
  }

  next();
}

async function getPasswordPolicy() {
  const rows = await db.select().from(sysAdminPasswordPolicy).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(sysAdminPasswordPolicy).values({}).returning();
  return created;
}

const BANNED_PASSWORDS = new Set([
  "password", "p@ssw0rd", "p@ssword", "passw0rd", "p@ss1234",
  "qwerty123", "qwerty1!", "qwerty12", "qwert123",
  "admin123", "admin@123", "admin1234", "adm1n@123",
  "letmein1", "letme1n!", "l3tme1n!",
  "welcome1", "welc0me1", "w3lcome!",
  "changeme", "ch@ngeme", "ch@nge1t",
  "12345678", "123456789", "1234567890",
  "abcd1234", "abc12345", "abcdef1!",
  "iloveyou", "1l0vey0u",
  "trustno1", "trust@1",
  "sunshine", "sun$h1ne",
  "master12", "master1!", "m@ster12",
  "monkey12", "m0nkey1!",
  "dragon12", "dr@gon1!",
  "baseball", "b@seball", "footb@ll",
  "shadow12", "sh@dow1!",
  "michael1", "m1chael!",
  "superman", "sup3rman", "sup3rm@n",
  "test1234", "test@123", "t3st1234",
  "root1234", "r00t@123",
  "server12", "s3rver1!",
  "sysadmin", "sys@dm1n", "sysadm1n",
  "system12", "syst3m1!", "s1st3m@1",
  "etaxcenter", "et@xcenter", "3t@x1234",
]);

function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (BANNED_PASSWORDS.has(lower)) return true;
  const normalized = lower
    .replace(/@/g, "a").replace(/0/g, "o").replace(/1/g, "i")
    .replace(/3/g, "e").replace(/\$/g, "s").replace(/5/g, "s")
    .replace(/!/g, "i").replace(/\+/g, "t");
  if (BANNED_PASSWORDS.has(normalized)) return true;
  if (/^(.)\1{5,}$/.test(lower)) return true;
  if (/^(012|123|234|345|456|567|678|789|abc|bcd|cde|def)/.test(lower) && lower.length <= 10) return true;
  return false;
}

function validatePasswordStrength(password: string, policy: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}): string[] {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`รหัสผ่านต้องมีอย่างน้อย ${policy.minLength} ตัวอักษร`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)");
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("ต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)");
  }
  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push("ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&*...)");
  }
  if (isCommonPassword(password)) {
    errors.push("รหัสผ่านนี้เป็นรหัสที่คาดเดาได้ง่าย กรุณาเลือกรหัสที่ไม่ซ้ำกับรหัสที่ใช้กันทั่วไป");
  }
  return errors;
}

async function logAudit(req: Request, action: string, targetType?: string, targetId?: number, targetName?: string, details?: string) {
  try {
    const session = req.session as any;
    let username = "system";
    if (session.sysAdminId) {
      const [admin] = await db.select({ username: sysAdmins.username }).from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      if (admin) username = admin.username;
    }
    await db.insert(sysAdminAuditLog).values({
      sysAdminId: session.sysAdminId || 0,
      sysAdminUsername: username,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      targetName: targetName || null,
      details: details || null,
      ipAddress: getClientIp(req),
    });
  } catch (err) {
    console.error("[SysAdmin Audit] Failed to log:", err);
  }
}

export function registerSysAdminRoutes(app: Express) {

  app.get("/api/sysadmin/users-count", async (_req, res) => {
    try {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(sysAdmins);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/bootstrap", async (req, res) => {
    try {
      const existing = await db.select({ id: sysAdmins.id }).from(sysAdmins).limit(1);
      if (existing.length > 0) {
        return res.status(403).json({ message: "Master SysAdmin มีอยู่แล้ว ไม่สามารถ bootstrap ซ้ำได้" });
      }

      const { username, password, fullName, email } = req.body;
      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "กรุณากรอก username, password, fullName" });
      }

      const policy = await getPasswordPolicy();
      const strengthErrors = validatePasswordStrength(password, policy);
      if (strengthErrors.length > 0) {
        return res.status(400).json({ message: "รหัสผ่านไม่ผ่านเงื่อนไข", errors: strengthErrors });
      }

      const hashed = await hashPassword(password);
      const [master] = await db.insert(sysAdmins).values({
        username,
        password: hashed,
        fullName,
        email: email || null,
        isMaster: true,
        mustChangePassword: false,
        passwordExpiryDays: policy.expiryDays,
      }).returning();

      await db.insert(sysAdminPasswordHistory).values({
        sysAdminId: master.id,
        passwordHash: hashed,
      });

      await logAudit(req, "bootstrap_master", "sysadmin", master.id, master.username, "First Master SysAdmin created");
      const { password: _, ...safe } = master;
      res.status(201).json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
      }

      const [admin] = await db.select().from(sysAdmins).where(eq(sysAdmins.username, username)).limit(1);
      if (!admin) {
        await logAudit(req, "login_failed", "sysadmin", undefined, username, "User not found");
        return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }

      if (!admin.active) {
        await logAudit(req, "login_blocked", "sysadmin", admin.id, admin.username, "Account suspended");
        return res.status(403).json({ message: "บัญชีนี้ถูกระงับ" });
      }

      const policy = await getPasswordPolicy();

      if (policy.ipWhitelistEnabled && policy.ipWhitelist && policy.ipWhitelist.length > 0) {
        const clientIp = getClientIp(req);
        if (!policy.ipWhitelist.includes(clientIp)) {
          await logAudit(req, "login_blocked_ip", "sysadmin", admin.id, admin.username, `IP ${clientIp} not whitelisted`);
          return res.status(403).json({ message: `IP ${clientIp} ไม่ได้อยู่ใน Whitelist` });
        }
      }

      if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
        const remainMin = Math.ceil((new Date(admin.lockedUntil).getTime() - Date.now()) / 60000);
        await logAudit(req, "login_locked", "sysadmin", admin.id, admin.username, `Locked for ${remainMin} more minutes`);
        return res.status(423).json({ message: `บัญชีถูกล็อค กรุณารออีก ${remainMin} นาที`, locked: true });
      }

      const isMatch = await comparePasswords(password, admin.password);
      if (!isMatch) {
        const newAttempts = admin.failedLoginAttempts + 1;
        const updates: any = { failedLoginAttempts: newAttempts };
        if (newAttempts >= policy.maxFailedAttempts) {
          updates.lockedUntil = new Date(Date.now() + policy.lockoutMinutes * 60000);
          await db.update(sysAdmins).set(updates).where(eq(sysAdmins.id, admin.id));
          await logAudit(req, "account_locked", "sysadmin", admin.id, admin.username, `Locked after ${newAttempts} failed attempts`);
          return res.status(423).json({
            message: `ใส่รหัสผ่านผิด ${newAttempts} ครั้ง บัญชีถูกล็อค ${policy.lockoutMinutes} นาที`,
            locked: true,
          });
        }
        await db.update(sysAdmins).set(updates).where(eq(sysAdmins.id, admin.id));
        await logAudit(req, "login_failed", "sysadmin", admin.id, admin.username, `Wrong password (${newAttempts}/${policy.maxFailedAttempts})`);
        return res.status(401).json({
          message: `รหัสผ่านไม่ถูกต้อง (ผิด ${newAttempts}/${policy.maxFailedAttempts} ครั้ง)`,
        });
      }

      const clientIp = getClientIp(req);
      await db.update(sysAdmins).set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      }).where(eq(sysAdmins.id, admin.id));

      const session = req.session as any;
      session.sysAdminId = admin.id;
      session.sysAdminLastActivity = Date.now();

      const passwordExpired = admin.passwordChangedAt
        ? (Date.now() - new Date(admin.passwordChangedAt).getTime()) > (admin.passwordExpiryDays * 86400000)
        : true;

      await logAudit(req, "login_success", "sysadmin", admin.id, admin.username);

      const { password: _, ...safeAdmin } = admin;
      res.json({
        ...safeAdmin,
        mustChangePassword: admin.mustChangePassword || passwordExpired,
        sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
      });
    } catch (err: any) {
      console.error("[SysAdmin Login Error]", err);
      res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  });

  app.post("/api/sysadmin/logout", async (req, res) => {
    const session = req.session as any;
    if (session.sysAdminId) {
      await logAudit(req, "logout", "sysadmin", session.sysAdminId);
    }
    delete session.sysAdminId;
    delete session.sysAdminLastActivity;
    res.json({ message: "ออกจากระบบ SysAdmin สำเร็จ" });
  });

  app.get("/api/sysadmin/me", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const [admin] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      if (!admin) {
        delete session.sysAdminId;
        return res.status(401).json({ message: "SysAdmin ไม่พบในระบบ" });
      }
      const policy = await getPasswordPolicy();
      const passwordExpired = admin.passwordChangedAt
        ? (Date.now() - new Date(admin.passwordChangedAt).getTime()) > (admin.passwordExpiryDays * 86400000)
        : true;
      const { password: _, ...safeAdmin } = admin;
      res.json({
        ...safeAdmin,
        mustChangePassword: admin.mustChangePassword || passwordExpired,
        sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/change-password", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" });
      }

      const [admin] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      if (!admin) return res.status(404).json({ message: "ไม่พบ SysAdmin" });

      const isMatch = await comparePasswords(currentPassword, admin.password);
      if (!isMatch) return res.status(401).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

      const policy = await getPasswordPolicy();
      const strengthErrors = validatePasswordStrength(newPassword, policy);
      if (strengthErrors.length > 0) {
        return res.status(400).json({ message: "รหัสผ่านไม่ผ่านเงื่อนไข", errors: strengthErrors });
      }

      const history = await db.select().from(sysAdminPasswordHistory)
        .where(eq(sysAdminPasswordHistory.sysAdminId, admin.id))
        .orderBy(desc(sysAdminPasswordHistory.createdAt))
        .limit(policy.historyCount);

      for (const h of history) {
        const reused = await comparePasswords(newPassword, h.passwordHash);
        if (reused) {
          return res.status(400).json({ message: `ห้ามใช้รหัสผ่านเดิม ${policy.historyCount} ครั้งล่าสุด` });
        }
      }

      const hashed = await hashPassword(newPassword);
      await db.update(sysAdmins).set({
        password: hashed,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(eq(sysAdmins.id, admin.id));

      await db.insert(sysAdminPasswordHistory).values({
        sysAdminId: admin.id,
        passwordHash: hashed,
      });

      await logAudit(req, "change_password", "sysadmin", admin.id, admin.username);
      res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sysadmin/password-policy", requireSysAdminAuth, async (_req, res) => {
    try {
      const policy = await getPasswordPolicy();
      res.json(policy);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/sysadmin/password-policy", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const [caller] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      if (!caller?.isMaster) {
        return res.status(403).json({ message: "เฉพาะ Master SysAdmin เท่านั้นที่แก้ Password Policy ได้" });
      }

      const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecial, expiryDays, historyCount, maxFailedAttempts, lockoutMinutes, sessionTimeoutMinutes, require2fa, ipWhitelistEnabled, ipWhitelist } = req.body;
      const policy = await getPasswordPolicy();

      const [updated] = await db.update(sysAdminPasswordPolicy).set({
        minLength: minLength ?? policy.minLength,
        requireUppercase: requireUppercase ?? policy.requireUppercase,
        requireLowercase: requireLowercase ?? policy.requireLowercase,
        requireNumbers: requireNumbers ?? policy.requireNumbers,
        requireSpecial: requireSpecial ?? policy.requireSpecial,
        expiryDays: expiryDays ?? policy.expiryDays,
        historyCount: historyCount ?? policy.historyCount,
        maxFailedAttempts: maxFailedAttempts ?? policy.maxFailedAttempts,
        lockoutMinutes: lockoutMinutes ?? policy.lockoutMinutes,
        sessionTimeoutMinutes: sessionTimeoutMinutes ?? policy.sessionTimeoutMinutes,
        require2fa: require2fa ?? policy.require2fa,
        ipWhitelistEnabled: ipWhitelistEnabled ?? policy.ipWhitelistEnabled,
        ipWhitelist: ipWhitelist !== undefined ? ipWhitelist : policy.ipWhitelist,
        updatedAt: new Date(),
      }).where(eq(sysAdminPasswordPolicy.id, policy.id)).returning();

      await logAudit(req, "update_password_policy", "policy", policy.id, "password_policy", JSON.stringify({ sessionTimeoutMinutes: updated.sessionTimeoutMinutes, minLength: updated.minLength }));
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sysadmin/users", requireSysAdminAuth, async (_req, res) => {
    try {
      const admins = await db.select({
        id: sysAdmins.id,
        username: sysAdmins.username,
        fullName: sysAdmins.fullName,
        email: sysAdmins.email,
        isMaster: sysAdmins.isMaster,
        active: sysAdmins.active,
        mustChangePassword: sysAdmins.mustChangePassword,
        passwordChangedAt: sysAdmins.passwordChangedAt,
        passwordExpiryDays: sysAdmins.passwordExpiryDays,
        failedLoginAttempts: sysAdmins.failedLoginAttempts,
        lockedUntil: sysAdmins.lockedUntil,
        lastLoginAt: sysAdmins.lastLoginAt,
        lastLoginIp: sysAdmins.lastLoginIp,
        createdAt: sysAdmins.createdAt,
        createdBy: sysAdmins.createdBy,
      }).from(sysAdmins).orderBy(desc(sysAdmins.isMaster), sysAdmins.createdAt);
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/users", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const { username, password, fullName, email } = req.body;
      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
      }

      const policy = await getPasswordPolicy();
      const strengthErrors = validatePasswordStrength(password, policy);
      if (strengthErrors.length > 0) {
        return res.status(400).json({ message: "รหัสผ่านไม่ผ่านเงื่อนไข", errors: strengthErrors });
      }

      const existing = await db.select({ id: sysAdmins.id }).from(sysAdmins).where(eq(sysAdmins.username, username)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "Username นี้ถูกใช้แล้ว" });
      }

      const hashed = await hashPassword(password);
      const [created] = await db.insert(sysAdmins).values({
        username,
        password: hashed,
        fullName,
        email: email || null,
        isMaster: false,
        mustChangePassword: true,
        passwordExpiryDays: policy.expiryDays,
        createdBy: session.sysAdminId,
      }).returning();

      await db.insert(sysAdminPasswordHistory).values({
        sysAdminId: created.id,
        passwordHash: hashed,
      });

      await logAudit(req, "create_sysadmin", "sysadmin", created.id, created.username, `Created by admin id=${session.sysAdminId}`);
      const { password: _, ...safe } = created;
      res.status(201).json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/sysadmin/users/:id", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const targetId = Number(req.params.id);
      const [caller] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      const [target] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, targetId)).limit(1);

      if (!target) return res.status(404).json({ message: "ไม่พบ SysAdmin" });
      if (target.isMaster && caller?.id !== target.id) {
        return res.status(403).json({ message: "ไม่สามารถจัดการ Master SysAdmin ได้" });
      }

      const updates: any = {};
      if (req.body.fullName !== undefined) updates.fullName = req.body.fullName;
      if (req.body.email !== undefined) updates.email = req.body.email;
      if (req.body.active !== undefined && !target.isMaster) updates.active = req.body.active;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "ไม่มีข้อมูลให้อัพเดท" });
      }

      const [updated] = await db.update(sysAdmins).set(updates).where(eq(sysAdmins.id, targetId)).returning();
      await logAudit(req, "update_sysadmin", "sysadmin", targetId, target.username, JSON.stringify(updates));
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/users/:id/force-change-password", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const targetId = Number(req.params.id);
      const [caller] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      const [target] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, targetId)).limit(1);

      if (!target) return res.status(404).json({ message: "ไม่พบ SysAdmin" });
      if (target.isMaster && caller?.id !== target.id) {
        return res.status(403).json({ message: "ไม่สามารถจัดการ Master SysAdmin ได้" });
      }

      await db.update(sysAdmins).set({ mustChangePassword: true }).where(eq(sysAdmins.id, targetId));
      await logAudit(req, "force_change_password", "sysadmin", targetId, target.username);
      res.json({ message: "ตั้งค่าให้ต้องเปลี่ยนรหัสผ่านครั้งถัดไปแล้ว" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/users/:id/reset-password", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const targetId = Number(req.params.id);
      const { newPassword } = req.body;

      const [caller] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      const [target] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, targetId)).limit(1);

      if (!target) return res.status(404).json({ message: "ไม่พบ SysAdmin" });
      if (target.isMaster && caller?.id !== target.id) {
        return res.status(403).json({ message: "ไม่สามารถจัดการ Master SysAdmin ได้" });
      }

      if (!newPassword) return res.status(400).json({ message: "กรุณากรอกรหัสผ่านใหม่" });

      const policy = await getPasswordPolicy();
      const strengthErrors = validatePasswordStrength(newPassword, policy);
      if (strengthErrors.length > 0) {
        return res.status(400).json({ message: "รหัสผ่านไม่ผ่านเงื่อนไข", errors: strengthErrors });
      }

      const hashed = await hashPassword(newPassword);
      await db.update(sysAdmins).set({
        password: hashed,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(eq(sysAdmins.id, targetId));

      await db.insert(sysAdminPasswordHistory).values({
        sysAdminId: targetId,
        passwordHash: hashed,
      });

      await logAudit(req, "reset_password", "sysadmin", targetId, target.username, `Reset by admin id=${session.sysAdminId}`);
      res.json({ message: "รีเซ็ตรหัสผ่านสำเร็จ ผู้ใช้จะต้องเปลี่ยนรหัสผ่านในครั้งถัดไป" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/users/:id/unlock", requireSysAdminAuth, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const [target] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "ไม่พบ SysAdmin" });

      await db.update(sysAdmins).set({
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(eq(sysAdmins.id, targetId));

      await logAudit(req, "unlock_account", "sysadmin", targetId, target.username);
      res.json({ message: "ปลดล็อคบัญชีสำเร็จ" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/sysadmin/users/:id", requireSysAdminAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const targetId = Number(req.params.id);
      const [caller] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, session.sysAdminId)).limit(1);
      const [target] = await db.select().from(sysAdmins).where(eq(sysAdmins.id, targetId)).limit(1);

      if (!target) return res.status(404).json({ message: "ไม่พบ SysAdmin" });
      if (target.isMaster) return res.status(403).json({ message: "ไม่สามารถลบ Master SysAdmin ได้" });
      if (target.id === caller?.id) return res.status(400).json({ message: "ไม่สามารถลบตัวเองได้" });

      await logAudit(req, "delete_sysadmin", "sysadmin", targetId, target.username);
      await db.delete(sysAdminPasswordHistory).where(eq(sysAdminPasswordHistory.sysAdminId, targetId));
      await db.delete(sysAdmins).where(eq(sysAdmins.id, targetId));
      res.json({ message: "ลบ SysAdmin สำเร็จ" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sysadmin/audit-log", requireSysAdminAuth, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;

      const logs = await db.select().from(sysAdminAuditLog)
        .orderBy(desc(sysAdminAuditLog.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` }).from(sysAdminAuditLog);

      res.json({ logs, total, limit, offset });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sysadmin/setup-master", async (req, res) => {
    try {
      const existing = await db.select({ id: sysAdmins.id }).from(sysAdmins).where(eq(sysAdmins.isMaster, true)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "Master SysAdmin มีอยู่แล้ว" });
      }

      const { username, password, fullName, email } = req.body;
      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
      }

      const hashed = await hashPassword(password);
      const [master] = await db.insert(sysAdmins).values({
        username,
        password: hashed,
        fullName,
        email: email || null,
        isMaster: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        passwordExpiryDays: 90,
      }).returning();

      await db.insert(sysAdminPasswordHistory).values({
        sysAdminId: master.id,
        passwordHash: hashed,
      });

      const session = req.session as any;
      session.sysAdminId = master.id;
      session.sysAdminLastActivity = Date.now();

      await logAudit(req, "setup_master", "sysadmin", master.id, master.username, "Initial master sysadmin created");

      const { password: _, ...safe } = master;
      res.status(201).json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sysadmin/has-master", async (_req, res) => {
    try {
      const existing = await db.select({ id: sysAdmins.id }).from(sysAdmins).where(eq(sysAdmins.isMaster, true)).limit(1);
      res.json({ hasMaster: existing.length > 0 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

}
