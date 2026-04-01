import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { requireAuth } from "../route-middleware";
import { z } from "zod";
import { hashPassword, comparePasswords } from "../auth";

export function registerUserRoutes(app: Express) {
// ========== User Avatar Route ==========

app.put("/api/auth/me/avatar", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({ avatarUrl: z.string().nullable() });
    const { avatarUrl } = schema.parse(req.body);
    const [updated] = await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id)).returning();
    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ========== User Profile / Signature Routes ==========

app.get("/api/auth/me/signature", requireAuth, async (req, res) => {
  const user = req.user as any;
  res.json({
    signatureUrl: user.signatureUrl || null,
    signatureName: user.signatureName || user.fullName,
    signatureNameEn: user.signatureNameEn || null,
    signatureNameZh: user.signatureNameZh || null,
    signatureTitle: user.signatureTitle || null,
    signatureTitleEn: user.signatureTitleEn || null,
    signatureTitleZh: user.signatureTitleZh || null,
  });
});

app.put("/api/auth/me/signature", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const sigSchema = z.object({
      signatureUrl: z.string().nullable().optional(),
      signatureName: z.string().nullable().optional(),
      signatureNameEn: z.string().nullable().optional(),
      signatureNameZh: z.string().nullable().optional(),
      signatureTitle: z.string().nullable().optional(),
      signatureTitleEn: z.string().nullable().optional(),
      signatureTitleZh: z.string().nullable().optional(),
    });
    const validated = sigSchema.parse(req.body);
    const updated = await storage.updateUserSignature(user.id, validated);
    res.json({
      signatureUrl: updated.signatureUrl,
      signatureName: updated.signatureName,
      signatureNameEn: updated.signatureNameEn,
      signatureNameZh: updated.signatureNameZh,
      signatureTitle: updated.signatureTitle,
      signatureTitleEn: updated.signatureTitleEn,
      signatureTitleZh: updated.signatureTitleZh,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ========== User Profile Update Routes ==========

app.put("/api/auth/me/profile", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      fullName: z.string().min(1, "กรุณาระบุชื่อเต็ม"),
      email: z.string().email("อีเมลไม่ถูกต้อง").nullable().optional(),
    });
    const validated = schema.parse(req.body);
    const [updated] = await db.update(users).set({
      fullName: validated.fullName,
      email: validated.email ?? user.email,
    }).where(eq(users.id, user.id)).returning();
    res.json({ fullName: updated.fullName, email: updated.email });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/auth/me/username", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      newUsername: z.string().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร"),
      currentPassword: z.string().min(1, "กรุณาระบุรหัสผ่านเพื่อยืนยัน"),
    });
    const validated = schema.parse(req.body);
    const dbUser = await storage.getUserByUsername(user.username);
    if (!dbUser) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const isMatch = await comparePasswords(validated.currentPassword, dbUser.password);
    if (!isMatch) return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    const existing = await storage.getUserByUsername(validated.newUsername);
    if (existing && existing.id !== user.id) return res.status(400).json({ message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" });
    await db.update(users).set({ username: validated.newUsername }).where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/auth/me/password", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      currentPassword: z.string().min(1, "กรุณาระบุรหัสผ่านปัจจุบัน"),
      newPassword: z.string().min(4, "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร"),
    });
    const validated = schema.parse(req.body);
    const dbUser = await storage.getUserByUsername(user.username);
    if (!dbUser) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const isMatch = await comparePasswords(validated.currentPassword, dbUser.password);
    if (!isMatch) return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    const hashed = await hashPassword(validated.newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.post("/api/admin/reset-password", requireAuth, async (req, res) => {
  try {
    const adminUser = req.user as any;
    if (!["admin", "super_admin"].includes(adminUser.role)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const schema = z.object({
      userId: z.number(),
      newPassword: z.string().min(4, "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร"),
    });
    const validated = schema.parse(req.body);
    const [targetUser] = await db.select().from(users).where(eq(users.id, validated.userId)).limit(1);
    if (!targetUser) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    if (adminUser.role !== "super_admin") {
      if (targetUser.tenantId !== adminUser.tenantId) {
        return res.status(403).json({ message: "ไม่สามารถรีเซ็ตรหัสผ่านผู้ใช้ต่าง Tenant ได้" });
      }
      if (targetUser.role === "super_admin") {
        return res.status(403).json({ message: "ไม่สามารถรีเซ็ตรหัสผ่าน Super Admin ได้" });
      }
    }
    const hashed = await hashPassword(validated.newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, validated.userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

}
