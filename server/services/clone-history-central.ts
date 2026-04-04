import pg from "pg";
import { db } from "../db";
import { cloneHistory, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const GITHUB_OWNER = "saaikanyakorn-afk";
const GITHUB_REPO = "etaxcenter";
const GITHUB_TARGET_FILE = "clone-target.json";
const GITHUB_BRANCH = "main";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 7;

let centralPool: pg.Pool | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let machineName: string = "unknown";
let consecutiveFailDays = 0;
let lastCheckDate: string | null = null;
let alertSentForCurrentStreak = false;

let activeTarget: { machineId: number; url: string; name: string; updatedAt: string } = {
  machineId: 0, url: "", name: "", updatedAt: "",
};

function getMachineName(): string {
  if (machineName !== "unknown") return machineName;
  try {
    if (process.env.REPL_SLUG) {
      machineName = `replit-${process.env.REPL_SLUG}`;
    } else if (process.env.DB_MAIN_HOST) {
      machineName = process.env.DB_MAIN_HOST;
    } else {
      machineName = require("os").hostname();
    }
  } catch {
    machineName = "unknown";
  }
  return machineName;
}

function getGitHubPat(): string {
  return process.env.GITHUB_PAT || "";
}

async function fetchTargetFromGitHub(): Promise<boolean> {
  const pat = getGitHubPat();
  if (!pat) {
    console.log("[CloneHistoryCentral] GITHUB_PAT not set — cannot fetch target from GitHub");
    return false;
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_TARGET_FILE}?ref=${GITHUB_BRANCH}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "etax-center",
      },
    });

    if (resp.status === 404) {
      console.log("[CloneHistoryCentral] clone-target.json not found on GitHub — no target configured yet");
      return false;
    }

    if (!resp.ok) {
      console.log(`[CloneHistoryCentral] GitHub API error: ${resp.status} ${resp.statusText}`);
      return false;
    }

    const data = await resp.json() as any;
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const target = JSON.parse(content);

    if (!target.machineId || !target.url || !target.name) {
      console.log("[CloneHistoryCentral] clone-target.json missing required fields");
      return false;
    }

    const oldId = activeTarget.machineId;
    activeTarget = {
      machineId: target.machineId,
      url: target.url,
      name: target.name,
      updatedAt: target.updatedAt || "",
    };

    if (centralPool && oldId !== target.machineId) {
      centralPool.end().catch(() => {});
      centralPool = null;
    }

    console.log(`[CloneHistoryCentral] ✓ Target from GitHub: ${target.name} (ID ${target.machineId}, updated ${target.updatedAt || "unknown"})`);
    return true;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Failed to fetch from GitHub: ${err.message?.slice(0, 150)}`);
    return false;
  }
}

async function getFileSha(): Promise<string | null> {
  const pat = getGitHubPat();
  if (!pat) return null;

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_TARGET_FILE}?ref=${GITHUB_BRANCH}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "etax-center",
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return data.sha || null;
  } catch {
    return null;
  }
}

async function pushTargetToGitHub(machineId: number, connectionUrl: string, machineName: string): Promise<boolean> {
  const pat = getGitHubPat();
  if (!pat) {
    console.log("[CloneHistoryCentral] GITHUB_PAT not set — cannot push target to GitHub");
    return false;
  }

  const now = new Date().toISOString();
  const payload = {
    machineId,
    url: connectionUrl,
    name: machineName,
    updatedAt: now,
    updatedBy: getMachineName(),
  };

  const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n").toString("base64");
  const sha = await getFileSha();

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_TARGET_FILE}`;
    const body: any = {
      message: `Clone target → ${machineName} (ID ${machineId})`,
      content,
      branch: GITHUB_BRANCH,
    };
    if (sha) body.sha = sha;

    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "etax-center",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.log(`[CloneHistoryCentral] GitHub push failed: ${resp.status} ${errText.slice(0, 200)}`);
      return false;
    }

    console.log(`[CloneHistoryCentral] ✓ Pushed clone-target.json to GitHub: ${machineName} (ID ${machineId})`);
    return true;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] GitHub push error: ${err.message?.slice(0, 150)}`);
    return false;
  }
}

export async function setTargetMachine(machineId: number, connectionUrl: string, targetName: string): Promise<void> {
  const pushed = await pushTargetToGitHub(machineId, connectionUrl, targetName);
  if (!pushed) {
    throw new Error("ไม่สามารถบันทึก clone-target.json ไป GitHub ได้ — กรุณาตรวจสอบ GITHUB_PAT และการเชื่อมต่อ");
  }

  activeTarget = {
    machineId,
    url: connectionUrl,
    name: targetName,
    updatedAt: new Date().toISOString(),
  };

  if (centralPool) {
    centralPool.end().catch(() => {});
    centralPool = null;
  }
  consecutiveFailDays = 0;
  alertSentForCurrentStreak = false;
  lastCheckDate = null;

  console.log(`[CloneHistoryCentral] Target changed → ${targetName} (ID ${machineId}), pushed to GitHub for all servers`);
}

export function getTargetMachineInfo(): { machineId: number; machineName: string; consecutiveFailDays: number; lastCheckDate: string | null; updatedAt: string } | null {
  if (!activeTarget.machineId) return null;
  return {
    machineId: activeTarget.machineId,
    machineName: activeTarget.name,
    consecutiveFailDays,
    lastCheckDate,
    updatedAt: activeTarget.updatedAt,
  };
}

export function getTargetUrl(): string | null {
  return activeTarget.url || null;
}

async function getCentralPool(): Promise<pg.Pool | null> {
  if (centralPool) return centralPool;

  const url = getTargetUrl();
  if (!url) return null;

  centralPool = new pg.Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
  });

  centralPool.on("error", (err) => {
    console.log(`[CloneHistoryCentral] Pool error (non-fatal): ${err.message?.slice(0, 120)}`);
    centralPool = null;
  });

  return centralPool;
}

async function ensureCentralTable(pool: pg.Pool): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clone_history (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        clone_type TEXT NOT NULL,
        direction TEXT DEFAULT 'us_to_th',
        table_name TEXT NOT NULL,
        row_count INTEGER DEFAULT 0,
        host_duration_ms INTEGER DEFAULT 0,
        remote_duration_ms INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        batch_index INTEGER DEFAULT 0,
        total_batches INTEGER DEFAULT 1,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_by INTEGER,
        dump_file_size INTEGER DEFAULT 0,
        dump_speed INTEGER DEFAULT 0,
        restore_speed INTEGER DEFAULT 0,
        source_machine TEXT,
        synced_to_central BOOLEAN DEFAULT FALSE
      )
    `);
    return true;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Failed to ensure table: ${err.message?.slice(0, 120)}`);
    return false;
  }
}

async function sendToCentral(rows: any[]): Promise<boolean> {
  if (rows.length === 0) return true;

  const pool = await getCentralPool();
  if (!pool) return false;

  try {
    await pool.query("SELECT 1");
  } catch {
    centralPool = null;
    return false;
  }

  const ok = await ensureCentralTable(pool);
  if (!ok) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO clone_history
         (session_id, clone_type, direction, table_name, row_count, host_duration_ms, remote_duration_ms,
          status, error_message, batch_index, total_batches, started_at, completed_at, created_by,
          dump_file_size, dump_speed, restore_speed, source_machine, synced_to_central)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,TRUE)`,
        [
          row.sessionId, row.cloneType, row.direction, row.tableName, row.rowCount || 0,
          row.hostDurationMs || 0, row.remoteDurationMs || 0,
          row.status, row.errorMessage || null, row.batchIndex || 0, row.totalBatches || 1,
          row.startedAt, row.completedAt || null, row.createdBy || null,
          row.dumpFileSize || 0, row.dumpSpeed || 0, row.restoreSpeed || 0,
          row.sourceMachine || getMachineName(),
        ]
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.log(`[CloneHistoryCentral] Send failed: ${err.message?.slice(0, 150)}`);
    centralPool = null;
    return false;
  } finally {
    client.release();
  }
}

export async function recordCloneHistory(values: any): Promise<void> {
  const machine = getMachineName();
  const enriched = { ...values, sourceMachine: machine, syncedToCentral: false };

  try {
    await db.insert(cloneHistory).values(enriched);
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Local insert failed: ${err.message?.slice(0, 120)}`);
  }

  const sent = await sendToCentral([enriched]);
  if (sent) {
    try {
      await db.update(cloneHistory)
        .set({ syncedToCentral: true })
        .where(
          and(
            eq(cloneHistory.sessionId, values.sessionId),
            eq(cloneHistory.tableName, values.tableName)
          )
        );
    } catch {}
  }
}

async function sendAlertEmail(): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      console.log("[CloneHistoryCentral] Cannot send alert — RESEND_API_KEY or RESEND_FROM_EMAIL not set");
      return;
    }

    const platformUsers = await db.select({ email: users.email, fullName: users.fullName })
      .from(users)
      .where(eq(users.role, "super_admin"));

    const emails = platformUsers.map(u => u.email).filter(Boolean);
    if (emails.length === 0) {
      console.log("[CloneHistoryCentral] No platform users found for alert");
      return;
    }

    const targetName = activeTarget.name || "Unknown";

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    for (const email of emails) {
      try {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `⚠ Clone History Sync Failed — ${consecutiveFailDays} วันติดต่อกัน`,
          html: `
            <h2>⚠ Clone History Sync Alert</h2>
            <p>ระบบไม่สามารถส่ง Clone History ไปยังเซิร์ฟเวอร์กลาง <strong>${targetName}</strong> ได้ติดต่อกัน <strong>${consecutiveFailDays} วัน</strong></p>
            <p>มี clone records ที่ค้างอยู่บนเครื่อง <strong>${getMachineName()}</strong> และยังไม่ได้ sync</p>
            <h3>สิ่งที่ต้องตรวจสอบ:</h3>
            <ul>
              <li>เซิร์ฟเวอร์ ${targetName} ออนไลน์อยู่หรือไม่</li>
              <li>เปลี่ยนเซิร์ฟเวอร์เป้าหมายในหน้า "เซิร์ฟเวอร์ฐานข้อมูล"</li>
            </ul>
            <p style="color:#999;font-size:12px;">ส่งจาก E-Tax Center Platform — ${new Date().toISOString()}</p>
          `,
        });
        console.log(`[CloneHistoryCentral] Alert sent to ${email}`);
      } catch (emailErr: any) {
        console.log(`[CloneHistoryCentral] Failed to send alert to ${email}: ${emailErr.message?.slice(0, 100)}`);
      }
    }

    alertSentForCurrentStreak = true;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Alert email error: ${err.message?.slice(0, 120)}`);
  }
}

async function dailyFlushCheck(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastCheckDate === today) return;

  try {
    const pendingResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(cloneHistory)
      .where(eq(cloneHistory.syncedToCentral, false));

    const pendingCount = pendingResult[0]?.count || 0;

    if (pendingCount === 0) {
      lastCheckDate = today;
      return;
    }

    console.log(`[CloneHistoryCentral] ${pendingCount} pending records — attempting sync...`);

    const pending = await db.select()
      .from(cloneHistory)
      .where(eq(cloneHistory.syncedToCentral, false))
      .limit(200);

    const sent = await sendToCentral(pending);

    if (sent) {
      const ids = pending.map(r => r.id);
      for (const id of ids) {
        try {
          await db.update(cloneHistory)
            .set({ syncedToCentral: true })
            .where(eq(cloneHistory.id, id));
        } catch {}
      }
      console.log(`[CloneHistoryCentral] ✓ Flushed ${pending.length} records to central`);
      consecutiveFailDays = 0;
      alertSentForCurrentStreak = false;
    } else {
      consecutiveFailDays++;
      console.log(`[CloneHistoryCentral] ✗ Central unreachable (day ${consecutiveFailDays}/${MAX_CONSECUTIVE_FAILURES})`);

      if (consecutiveFailDays >= MAX_CONSECUTIVE_FAILURES && !alertSentForCurrentStreak) {
        await sendAlertEmail();
      }
    }

    lastCheckDate = today;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Daily check error: ${err.message?.slice(0, 120)}`);
  }
}

export async function ensureTargetLoaded(): Promise<void> {
  if (activeTarget.machineId > 0) return;
  await fetchTargetFromGitHub();
}

export function startCentralHistorySync(): void {
  if (flushTimer) return;

  console.log(`[CloneHistoryCentral] Sync scheduler started (checks once per day, alerts after ${MAX_CONSECUTIVE_FAILURES} consecutive failures)`);

  setTimeout(() => dailyFlushCheck(), 30_000);

  flushTimer = setInterval(() => dailyFlushCheck(), CHECK_INTERVAL_MS);
}

export function stopCentralHistorySync(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (centralPool) {
    centralPool.end().catch(() => {});
    centralPool = null;
  }
}
