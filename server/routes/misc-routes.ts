import type { Express } from "express";
import { db } from "../db";
import { eq, and, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../route-middleware";
import { getTimingLog, getTimingSummary, clearTimingLog } from "./report-cache";
import { getMaintenanceStatus, activateNow, liftMaintenance, isMaintenanceMode, createSchedule, rescheduleSchedule, cancelSchedule, hasCompletedMaintenanceToday, getScheduleHistory } from "../maintenance";
import { execSync } from "child_process";

function getGitVersion(): { hash: string; shortHash: string; date: string; message: string } {
  if (process.env.NODE_ENV === "production") {
    try {
      const fs = require("fs");
      const versionPath = require("path").join(__dirname, "..", "version.json");
      if (fs.existsSync(versionPath)) {
        return JSON.parse(fs.readFileSync(versionPath, "utf-8"));
      }
    } catch {}
  }
  try {
    const shortHash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf-8" }).trim();
    const hash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    const date = execSync('git log -1 --format="%ci"', { encoding: "utf-8" }).trim();
    const message = execSync('git log -1 --format="%s"', { encoding: "utf-8" }).trim();
    return { hash, shortHash, date, message };
  } catch {
    return { hash: "unknown", shortHash: "unknown", date: new Date().toISOString(), message: "" };
  }
}
const BUILD_VERSION = getGitVersion();


export function registerMiscRoutes(app: Express) {
app.get("/api/version", (_req, res) => {
  res.json(BUILD_VERSION);
});

app.get("/api/share-base-url", (req, res) => {
  const host = req.get("host") || "";
  if (host.includes(".replit.app") || process.env.NODE_ENV === "production") {
    res.json({ url: `${req.protocol}://${host}` });
  } else {
    const replId = process.env.REPL_ID;
    if (replId) {
      res.json({ url: `https://${replId}.replit.app` });
    } else {
      res.json({ url: `${req.protocol}://${host}` });
    }
  }
});

app.get("/api/public-config", (_req, res) => {
  res.json({ recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || "" });
});

app.get("/api/maintenance/status", async (_req, res) => {
  try {
    const status = await getMaintenanceStatus();
    res.json(status);
  } catch (e: any) {
    const s = getMaintenanceState();
    res.json({ enabled: s.enabled, message: s.message, scheduledAt: s.scheduledAt, scheduledEnd: s.scheduledEnd });
  }
});

app.get("/api/maintenance/cancelled-alerts", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const rows = await db.select().from(maintenanceSchedules)
      .where(and(
        eq(maintenanceSchedules.status, "cancelled"),
        eq(maintenanceSchedules.createdByUserId, user.id),
        eq(maintenanceSchedules.cancelledNotified, false),
        isNotNull(maintenanceSchedules.cancelledByCloneUser),
      ));
    res.json({ alerts: rows.map(r => ({
      id: r.id,
      scheduledAt: r.scheduledAt?.toISOString(),
      message: r.message,
      cancelledByCloneUser: r.cancelledByCloneUser,
      cancelledAt: r.liftedAt?.toISOString(),
    }))});
  } catch (e: any) {
    res.json({ alerts: [] });
  }
});

app.post("/api/maintenance/cancelled-alerts/dismiss", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { ids } = req.body || {};
    if (ids && Array.isArray(ids)) {
      for (const id of ids) {
        await db.update(maintenanceSchedules)
          .set({ cancelledNotified: true })
          .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.createdByUserId, user.id)));
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

function destroyOtherSessions(req: any) {
  if (req.sessionStore && typeof (req.sessionStore as any).all === "function") {
    (req.sessionStore as any).all((err: any, sessions: any) => {
      if (err || !sessions) return;
      const currentSid = req.sessionID;
      const sessionEntries = Array.isArray(sessions) ? sessions : Object.entries(sessions);
      for (const entry of sessionEntries) {
        const [sid] = Array.isArray(entry) ? entry : [entry];
        if (sid !== currentSid) {
          req.sessionStore.destroy(sid, () => {});
        }
      }
    });
  }
}

app.post("/api/maintenance/enable", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const { message } = req.body;
    const result = await activateNow({
      message,
      enabledBy: user.fullName || user.username,
      enabledByUserId: user.id,
      source: "manual",
    });
    if (!result.success) return res.status(400).json(result);
    destroyOtherSessions(req);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/maintenance/disable", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const cloning = await isCloneInProgress();
    if (cloning) {
      return res.status(403).json({
        success: false,
        message: "ไม่สามารถปิดโหมดปรับปรุงได้ — กำลังมีการ Clone Database อยู่ กรุณารอให้เสร็จก่อน",
      });
    }
    const user = req.user as any;
    const result = await liftMaintenance(user.fullName || user.username);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/maintenance/schedule", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const user = req.user as any;
    const { startAt, message } = req.body;
    if (!startAt) return res.status(400).json({ message: "กรุณาระบุเวลาเริ่มต้น" });
    const result = await createSchedule({
      scheduledAt: new Date(startAt),
      message,
      createdBy: user.fullName || user.username,
      createdByUserId: user.id,
      source: "manual",
    });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/maintenance/reschedule", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { startAt, message } = req.body;
    if (!startAt) return res.status(400).json({ message: "กรุณาระบุเวลาใหม่" });
    const result = await rescheduleSchedule(new Date(startAt), message);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/maintenance/cancel", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await cancelSchedule();
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/maintenance/history", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const history = await getScheduleHistory(20);
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/maintenance/today-completed", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const completed = await hasCompletedMaintenanceToday();
    res.json({ completedToday: completed });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/report-timing/log", requireAuth, requireAdmin, (_req, res) => {
  res.json(getTimingLog());
});
app.get("/api/report-timing/summary", requireAuth, requireAdmin, (_req, res) => {
  res.json(getTimingSummary());
});
app.post("/api/report-timing/clear", requireAuth, requireAdmin, (_req, res) => {
  clearTimingLog();
  res.json({ success: true, message: "Timing log cleared" });
});
}
