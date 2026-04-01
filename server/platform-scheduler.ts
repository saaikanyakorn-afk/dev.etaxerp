import { db } from "./db";
import { ecommerceConnections, tenantPlatformCredentials, syncLogs, companies, otRecords } from "@shared/schema";
import { eq, and, lt, isNotNull, sql } from "drizzle-orm";
import { getAdapter } from "./platforms";
import type { PlatformCredentials } from "./platforms";

const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD = 15 * 60 * 1000;

let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

export async function refreshExpiringTokens() {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() + TOKEN_REFRESH_THRESHOLD);

    const expiringConns = await db.select()
      .from(ecommerceConnections)
      .where(and(
        eq(ecommerceConnections.status, "connected"),
        isNotNull(ecommerceConnections.refreshToken),
        lt(ecommerceConnections.tokenExpiresAt, threshold),
      ));

    if (expiringConns.length === 0) return;

    console.log(`[Platform Scheduler] Found ${expiringConns.length} connections needing token refresh`);

    for (const conn of expiringConns) {
      try {
        const adapter = getAdapter(conn.platform);
        if (!adapter) continue;
        if (!conn.refreshToken) continue;

        const [comp] = await db.select().from(companies).where(eq(companies.id, conn.companyId));
        if (!comp?.tenantId) continue;

        const [cred] = await db.select().from(tenantPlatformCredentials)
          .where(and(
            eq(tenantPlatformCredentials.tenantId, comp.tenantId),
            eq(tenantPlatformCredentials.platform, conn.platform),
            eq(tenantPlatformCredentials.active, true),
          ));

        if (!cred) continue;

        const credentials: PlatformCredentials = {
          appId: cred.appId,
          appSecret: cred.appSecret,
          region: cred.region || "TH",
          sandbox: cred.sandbox || false,
          extra: cred.extra ? JSON.parse(cred.extra) : {},
        };

        const tokenResult = await adapter.refreshToken(credentials, conn.refreshToken, conn.shopId || undefined);
        const tokenExpiresAt = new Date(Date.now() + (tokenResult.expiresIn || 3600) * 1000);

        await db.update(ecommerceConnections).set({
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken || conn.refreshToken,
          tokenExpiresAt,
          status: "connected",
        }).where(eq(ecommerceConnections.id, conn.id));

        console.log(`[Platform Scheduler] Refreshed token for ${conn.platform} connection #${conn.id}`);
      } catch (err: any) {
        console.error(`[Platform Scheduler] Failed to refresh token for connection #${conn.id}: ${err.message}`);

        await db.update(ecommerceConnections).set({
          status: "error",
        }).where(eq(ecommerceConnections.id, conn.id));
      }
    }
  } catch (err: any) {
    console.error("[Platform Scheduler] Token refresh error:", err.message);
  }
}

const OT_AUTO_APPROVE_INTERVAL = 15 * 60 * 1000;
const OT_AUTO_APPROVE_HOURS = 24;

async function autoApproveExpiredOt() {
  try {
    const cutoff = new Date(Date.now() - OT_AUTO_APPROVE_HOURS * 60 * 60 * 1000);
    
    const pendingOts = await db.select().from(otRecords)
      .where(and(
        eq(otRecords.status, "pending"),
        lt(otRecords.endTime, cutoff),
      ));

    if (pendingOts.length === 0) return;

    for (const ot of pendingOts) {
      await db.update(otRecords)
        .set({ status: "approved" })
        .where(eq(otRecords.id, ot.id));
    }

    console.log(`[OT Auto-Approve] อนุมัติอัตโนมัติ ${pendingOts.length} รายการ (เกิน ${OT_AUTO_APPROVE_HOURS} ชม.)`);
  } catch (err: any) {
    console.error("[OT Auto-Approve] Error:", err.message);
  }
}

let otAutoApproveIntervalId: ReturnType<typeof setInterval> | null = null;
let ftpArchiveIntervalId: ReturnType<typeof setInterval> | null = null;
let ftpRevertDoneToday = false;

function getBangkokTime() {
  const now = new Date();
  const bangkokOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const bangkokMinutes = (utcMinutes + bangkokOffset) % 1440;
  const currentTime = `${String(Math.floor(bangkokMinutes / 60)).padStart(2, "0")}:${String(bangkokMinutes % 60).padStart(2, "0")}`;
  return { bangkokMinutes, currentTime };
}

async function runScheduledFtpArchive() {
  try {
    const { getArchiveSettings, runArchiveJob, updateArchivedLinks, checkStaleTransfers, revertArchivedFiles, resumePendingItems } = await import("./services/ftp-archive");
    const settings = await getArchiveSettings();
    if (!settings) return;

    const { bangkokMinutes, currentTime } = getBangkokTime();

    if (settings.testMode) {
      const revertHour = 18;
      const revertMin = revertHour * 60;
      if (Math.abs(bangkokMinutes - revertMin) < 5 && !ftpRevertDoneToday) {
        ftpRevertDoneToday = true;
        console.log(`[FTP Archive TEST MODE] Running scheduled revert at ${currentTime} (Bangkok time)`);
        const result = await revertArchivedFiles();
        console.log(`[FTP Archive TEST MODE] Revert complete: ${result.message}`);
        return;
      }
      if (bangkokMinutes < 60) {
        ftpRevertDoneToday = false;
      }
    }

    if (!settings.enabled) return;

    const resumeResult = await resumePendingItems();
    if (resumeResult.jobId > 0) {
      console.log(`[FTP Archive] Auto-resume result: ${resumeResult.message}`);
    }

    const linksUpdated = await updateArchivedLinks();
    if (linksUpdated > 0) {
      console.log(`[FTP Archive] Updated ${linksUpdated} document links`);
    }

    const schedules = [settings.scheduleTime1 || "02:00", settings.scheduleTime2 || "14:00"];
    const isScheduledTime = schedules.some(s => {
      const [h, m] = s.split(":").map(Number);
      const schedMin = h * 60 + m;
      return Math.abs(bangkokMinutes - schedMin) < 5;
    });

    if (!isScheduledTime) return;

    console.log(`[FTP Archive] Running scheduled archive at ${currentTime} (Bangkok time)`);
    const result = await runArchiveJob();
    console.log(`[FTP Archive] Job completed: ${result.message}`);

    await checkStaleTransfers();
  } catch (err: any) {
    console.error("[FTP Archive] Scheduled job error:", err.message);
  }
}

export function startPlatformScheduler() {
  if (refreshIntervalId) return;

  console.log("[Platform Scheduler] Starting automatic token refresh (every 30 min)");

  refreshExpiringTokens();

  refreshIntervalId = setInterval(refreshExpiringTokens, TOKEN_REFRESH_INTERVAL);

  import("./services/ftp-archive").then(async (m) => {
    await m.migrateFtpSettingsToSystemConfig().catch(() => {});
    const recovered = await m.recoverOrphanedTransfers();
    if (recovered > 0) {
      console.log(`[FTP Archive] Startup recovery: ${recovered} orphaned items reset to pending`);
    }
  }).catch(() => {});
  console.log("[FTP Archive] Starting archive scheduler (checks every 5 min)");
  ftpArchiveIntervalId = setInterval(runScheduledFtpArchive, 5 * 60 * 1000);

  console.log("[OT Auto-Approve] Starting auto-approve scheduler (checks every 15 min, threshold: 24h)");
  autoApproveExpiredOt();
  otAutoApproveIntervalId = setInterval(autoApproveExpiredOt, OT_AUTO_APPROVE_INTERVAL);
}

export function stopPlatformScheduler() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log("[Platform Scheduler] Stopped");
  }
  if (ftpArchiveIntervalId) {
    clearInterval(ftpArchiveIntervalId);
    ftpArchiveIntervalId = null;
    console.log("[FTP Archive] Stopped");
  }
  if (otAutoApproveIntervalId) {
    clearInterval(otAutoApproveIntervalId);
    otAutoApproveIntervalId = null;
    console.log("[OT Auto-Approve] Stopped");
  }
}
