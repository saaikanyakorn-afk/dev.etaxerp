import { db } from "./db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { cloneHistory, systemConfig } from "@shared/schema";
import { getConfig } from "./config-bootstrap";
import { platformCloneProgress, setPlatformCloneProgress, cloneScreenUserId, cloneScreenLastHeartbeat, setCloneScreen, acquireCloneLock, releaseCloneLock } from "./clone-state";
import { recordCloneHistory } from "./services/clone-history-central";
import path from "path";
import os from "os";
import fs from "fs";

export async function autoResumeClone(): Promise<void> {
  const MAX_RETRIES = 5;
  const RETRY_KEY = "clone_auto_resume_retries";

  try {
    const lastSession = await db.select()
      .from(cloneHistory)
      .orderBy(desc(cloneHistory.completedAt))
      .limit(1);

    if (!lastSession.length) return;

    const sessionId = lastSession[0].sessionId;
    const sessionRows = await db.select()
      .from(cloneHistory)
      .where(eq(cloneHistory.sessionId, sessionId));

    const hasErrors = sessionRows.some(r => r.status === "error");
    if (hasErrors) {
      console.log("[Clone Auto-Resume] Last session has error tables — skipping auto-resume (needs manual recovery)");
      return;
    }

    const allSuccess = sessionRows.every(r => r.status === "success" || r.status === "dropped" || r.status === "dismissed");
    if (!allSuccess) return;

    const clonedTableNames = new Set(sessionRows.map(r => r.tableName));

    const targetKeys = ["dev", "pdt"] as const;
    const targetUrlMap: Record<string, string | undefined> = {
      dev: getConfig("DB_MAIN_URL"),
      pdt: getConfig("DB_PROD_URL"),
    };

    const sourceUrl = process.env.DATABASE_URL;
    if (!sourceUrl) return;

    const pg2 = (await import("pg")).default;

    for (const targetKey of targetKeys) {
      const targetUrl = targetUrlMap[targetKey];
      if (!targetUrl) continue;

      let srcTables: Set<string>;
      let tgtTables: Set<string>;
      const sourcePool = new pg2.Pool({ connectionString: sourceUrl, max: 2, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 });
      const targetPool = new pg2.Pool({ connectionString: targetUrl, max: 2, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 });
      try {
        const [srcRes, tgtRes] = await Promise.all([
          sourcePool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"),
          targetPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"),
        ]);
        srcTables = new Set(srcRes.rows.map((r: any) => r.table_name));
        tgtTables = new Set(tgtRes.rows.map((r: any) => r.table_name));
      } catch (connErr: any) {
        console.log(`[Clone Auto-Resume] Cannot connect to ${targetKey}: ${connErr.message?.slice(0, 100)}`);
        await sourcePool.end().catch(() => {});
        await targetPool.end().catch(() => {});
        continue;
      }
      await sourcePool.end().catch(() => {});
      await targetPool.end().catch(() => {});

      const skipTables = new Set(["system_config", "session"]);
      const missingTables = [...srcTables].filter(t => !tgtTables.has(t) && !skipTables.has(t) && clonedTableNames.has(t) === false).sort();

      const wasPartOfSession = [...srcTables].filter(t => !tgtTables.has(t) && !skipTables.has(t)).sort();

      if (wasPartOfSession.length === 0) {
        const { isMaintenanceMode, liftMaintenance, setCloneInProgress } = await import("./maintenance");
        if (isMaintenanceMode()) {
          console.log(`[Clone Auto-Resume] No missing tables on ${targetKey} but maintenance lock still active — lifting`);
          await setCloneInProgress(0, false);
          await liftMaintenance("System (Auto-Resume: no missing tables, lock stuck)");
          setCloneScreen(null);
          releaseCloneLock();
        }
        continue;
      }

      console.log(`[Clone Auto-Resume] Detected ${wasPartOfSession.length} missing tables on ${targetKey}: ${wasPartOfSession.join(", ")}`);

      let retryCount = 0;
      try {
        const retryRow = await db.select().from(systemConfig).where(eq(systemConfig.key, RETRY_KEY)).limit(1);
        if (retryRow.length) {
          const parsed = JSON.parse(retryRow[0].value || "{}");
          if (parsed.sessionId === sessionId && parsed.targetKey === targetKey) {
            retryCount = parsed.count || 0;
          }
        }
      } catch {}

      if (retryCount >= MAX_RETRIES) {
        console.log(`[Clone Auto-Resume] ⚠️ GIVING UP — ${MAX_RETRIES} retries exhausted for session ${sessionId} on ${targetKey}`);

        const { getCurrentActiveTarget, sendPlatformLineAlert, startHalfBakedTimeout,
                liftMaintenance, setCloneInProgress } = await import("./maintenance");
        const activeTarget = getCurrentActiveTarget();
        const HALF_BAKED_TIMEOUT_MS = 30 * 60 * 1000;

        const cloneTargetIsActive = (targetKey === "dev" && activeTarget === "thailand") ||
                                     (targetKey === "pdt" && activeTarget === "thailand");

        if (!cloneTargetIsActive) {
          console.log(`[Clone Auto-Resume] Half-baked clone target (${targetKey}) is NOT the active DB (${activeTarget}) — lifting maintenance`);
          await setCloneInProgress(0, false);
          await liftMaintenance("System (half-baked clone on non-active DB)");
          setCloneScreen(null);
          releaseCloneLock();
          setPlatformCloneProgress({ status: "error", percent: 0, error: `Clone ไม่สมบูรณ์ (${wasPartOfSession.length} ตาราง) — ระบบเปิดใช้งานปกติแล้ว (ฐานข้อมูลเป้าหมายไม่ใช่ DB ที่ใช้งานอยู่)` });
          await sendPlatformLineAlert(
            "⚠️ E-Tax Center: Clone Database ไม่สมบูรณ์\n" +
            `ตาราง ${wasPartOfSession.length} ตารางยังหายไป\n` +
            "แต่ฐานข้อมูลที่ Clone ไปไม่ใช่ตัวที่ใช้งานอยู่ — ระบบเปิดใช้งานปกติแล้ว\n" +
            "กรุณาเข้าระบบเพื่อ Clone ใหม่เมื่อพร้อม"
          );
        } else {
          console.log(`[Clone Auto-Resume] ⚠️ CRITICAL — Half-baked clone target (${targetKey}) IS the active DB!`);
          console.log(`[Clone Auto-Resume] Keeping maintenance lock ON. Missing tables: ${wasPartOfSession.join(", ")}`);
          console.log(`[Clone Auto-Resume] Starting ${HALF_BAKED_TIMEOUT_MS / 60000}min timeout for platform user to decide.`);
          setPlatformCloneProgress({
            status: "error", percent: 0,
            error: `⚠️ Clone ไม่สมบูรณ์บนฐานข้อมูลที่ใช้งานอยู่! ${wasPartOfSession.length} ตาราง — รอ Platform User ตัดสินใจ`,
          });
          await sendPlatformLineAlert(
            "🚨 E-Tax Center: Clone Database ไม่สมบูรณ์ (วิกฤต!)\n" +
            `ตาราง ${wasPartOfSession.length} ตารางหายไปบนฐานข้อมูลที่ใช้งานอยู่!\n` +
            "ระบบถูกล็อก รอคุณเข้ามาตัดสินใจ\n" +
            `ถ้าไม่เข้ามาภายใน ${HALF_BAKED_TIMEOUT_MS / 60000} นาที ระบบจะสลับ DB กลับไปต้นทางอัตโนมัติ\n` +
            "กรุณาเข้า E-Tax Center ทันที!"
          );
          const { emergencySwitchToSource } = await import("./db");
          startHalfBakedTimeout(HALF_BAKED_TIMEOUT_MS, async () => {
            console.log("[Clone Auto-Resume] Timeout expired — switching DB back to source (usa)");
            const switchResult = await emergencySwitchToSource();
            if (switchResult.success) {
              await setCloneInProgress(0, false);
              setCloneScreen(null);
              releaseCloneLock();
              setPlatformCloneProgress({ status: "error", percent: 0, error: "Clone ไม่สมบูรณ์ — ระบบ timeout สลับ DB กลับไปต้นทางอัตโนมัติ" });
            }
            return switchResult;
          });
        }
        return;
      }

      retryCount++;
      try {
        await db.insert(systemConfig).values({
          key: RETRY_KEY,
          value: JSON.stringify({ sessionId, targetKey, count: retryCount, lastAttempt: new Date().toISOString() }),
        }).onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: JSON.stringify({ sessionId, targetKey, count: retryCount, lastAttempt: new Date().toISOString() }) },
        });
      } catch {}

      if (cloneScreenUserId) {
        const heartbeatAge = Date.now() - cloneScreenLastHeartbeat;
        const STALE_THRESHOLD = 2 * 60 * 1000;
        if (heartbeatAge < STALE_THRESHOLD) {
          console.log(`[Clone Auto-Resume] User #${cloneScreenUserId} has clone screen open (heartbeat ${Math.round(heartbeatAge / 1000)}s ago) — deferring to manual control`);
          return;
        }
        console.log(`[Clone Auto-Resume] User #${cloneScreenUserId} screen heartbeat stale (${Math.round(heartbeatAge / 1000)}s ago) — taking over`);
        setCloneScreen(null, 0);
      }

      const lockResult = acquireCloneLock("auto-resume", targetKey, null);
      if (!lockResult.acquired) {
        console.log(`[Clone Auto-Resume] Cannot acquire lock: ${lockResult.reason} — will retry on next restart`);
        return;
      }

      console.log(`[Clone Auto-Resume] 🔄 Auto-resume attempt ${retryCount}/${MAX_RETRIES} — cloning ${wasPartOfSession.length} missing tables to ${targetKey}`);

      const resumeSessionId = `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const startedAt = Date.now();

      const { activateNow, setCloneInProgress, liftMaintenance, destroyScheduleAfterClone, getActiveSchedule } = await import("./maintenance");
      const { promisify } = await import("util");
      const { exec } = await import("child_process");
      const execAsync = promisify(exec);

      const existingActive = await getActiveSchedule();
      if (!existingActive) {
        await activateNow({
          message: `ระบบกำลัง Auto-Resume Clone (${wasPartOfSession.length} ตาราง) กรุณารอสักครู่`,
          enabledBy: "System (Auto-Resume)",
          enabledByUserId: 0,
          source: "clone_database",
          bypassDailyLimit: true,
        });
      }
      await setCloneInProgress(0, true);

      setPlatformCloneProgress({
        status: "running", percent: 0,
        step: `Auto-Resume: เตรียมระบบ...`,
        startedAt: Date.now(),
        completedTables: [],
        cloneType: "manual",
      });

      const { STATIC_TABLES } = await import("./clone-tables");
      const staticTableNames = new Set(STATIC_TABLES.map((t: any) => t.pgName));
      const BATCH_SIZE = 500;
      const totalTables = wasPartOfSession.length;
      let completedCount = 0;
      let failCount = 0;

      for (let ti = 0; ti < totalTables; ti++) {
        const tableName = wasPartOfSession[ti];
        const tableStart = Date.now();
        const overallPct = Math.round(10 + (ti / totalTables) * 85);
        const dumpFile = path.join(os.tmpdir(), `clone_resume_${tableName}.sql`);

        try {
          const isStaticTable = staticTableNames.has(tableName);
          const timeoutSec = isStaticTable ? 300 : 7200;

          setPlatformCloneProgress({
            ...platformCloneProgress,
            status: "running", percent: overallPct,
            step: `[Auto-Resume ${ti + 1}/${totalTables}] ${tableName}`,
            currentTable: tableName,
            tableIndex: ti + 1,
            totalTables,
          });

          console.log(`[Clone Auto-Resume] ${overallPct}% — Table ${ti + 1}/${totalTables}: ${tableName}`);

          let rowCount = 0;
          try {
            const countRes = await execAsync(`psql "${sourceUrl}" -t -A -c "SELECT count(*) FROM \\"${tableName}\\""`, { timeout: 30000 });
            rowCount = parseInt(countRes.stdout.trim()) || 0;
          } catch {}

          const hostStart = Date.now();
          await execAsync(`pg_dump "${sourceUrl}" --no-owner --no-acl --clean --if-exists --table="${tableName}" > ${dumpFile}`, { timeout: timeoutSec * 1000 });
          const hostDurationMs = Date.now() - hostStart;

          const remoteStart = Date.now();
          const restoreCmd = `psql "${targetUrl}" -v ON_ERROR_STOP=0 -c "SET session_replication_role = replica;" -f ${dumpFile}`;
          await execAsync(restoreCmd, { timeout: timeoutSec * 1000, maxBuffer: 50 * 1024 * 1024 });
          await execAsync(`psql "${targetUrl}" -c "SET session_replication_role = DEFAULT;"`, { timeout: 10000 }).catch(() => {});
          const remoteDurationMs = Date.now() - remoteStart;

          try { fs.unlinkSync(dumpFile); } catch {}

          try {
            await recordCloneHistory({
              sessionId: resumeSessionId, cloneType: "auto-resume", direction: "us_to_th", tableName, rowCount,
              hostDurationMs, remoteDurationMs, status: "success",
              batchIndex: 0, totalBatches: 1,
              startedAt: new Date(tableStart), completedAt: new Date(),
              createdBy: 0,
            });
          } catch {}

          completedCount++;
          console.log(`[Clone Auto-Resume] ✓ ${tableName} — ${rowCount} rows, host ${hostDurationMs}ms, remote ${remoteDurationMs}ms`);

        } catch (tableErr: any) {
          failCount++;
          console.log(`[Clone Auto-Resume] ✗ ${tableName} — ${tableErr.message?.slice(0, 200)}`);
          try {
            await recordCloneHistory({
              sessionId: resumeSessionId, cloneType: "auto-resume", direction: "us_to_th", tableName, rowCount: 0,
              hostDurationMs: 0, remoteDurationMs: 0, status: "error",
              errorMessage: `Auto-resume failed: ${(tableErr.message || "").slice(0, 400)}`,
              batchIndex: 0, totalBatches: 1,
              startedAt: new Date(tableStart), completedAt: new Date(),
              createdBy: 0,
            });
          } catch {}
          try { fs.unlinkSync(dumpFile); } catch {}
        }
      }

      const durationSec = Math.round((Date.now() - startedAt) / 1000);

      if (failCount === 0) {
        console.log(`[Clone Auto-Resume] ✅ COMPLETE — ${completedCount}/${totalTables} tables in ${durationSec}s`);
        setPlatformCloneProgress({ status: "complete", percent: 100, step: `Auto-Resume เสร็จ! ${completedCount}/${totalTables} ตาราง (${durationSec}s)` });

        try {
          await db.insert(systemConfig).values({ key: RETRY_KEY, value: JSON.stringify({ cleared: true }) })
            .onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify({ cleared: true }) } });
        } catch {}

        await setCloneInProgress(0, false);
        await liftMaintenance("System (Auto-Resume complete)");
        await destroyScheduleAfterClone();
        setCloneScreen(null);
        releaseCloneLock();
      } else {
        console.log(`[Clone Auto-Resume] ⚠️ PARTIAL — ${completedCount} ok, ${failCount} failed out of ${totalTables}. Will retry on next restart.`);
        setPlatformCloneProgress({ status: "error", percent: 0, error: `Auto-Resume: ${failCount} tables failed. Attempt ${retryCount}/${MAX_RETRIES}` });
        releaseCloneLock();
      }

      return;
    }
  } catch (err: any) {
    console.log(`[Clone Auto-Resume] Error checking for incomplete clone:`, err.message?.slice(0, 200));
    releaseCloneLock();
  }
}
