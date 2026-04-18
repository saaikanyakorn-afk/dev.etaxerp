import type { Express, Request, Response } from "express";
import { db, pool, activeDbInfo } from "../db";
import { ecomDb } from "../ecom-db";
import { storage } from "../storage";
import { eq, desc, and, notInArray, count , sql } from "drizzle-orm";
import { users, tenants, companies, cloneHistory, ecommerceOrders, ecommerceOrderItems, invoices, products, tenantSubscriptions, subscriptionPlans, rolePermissions, firmClients } from "@shared/schema";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../route-middleware";
import type { NextFunction } from "express";

function requireSuperAdminOrSysAdmin(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  if (session?.sysAdminId) {
    session.sysAdminLastActivity = Date.now();
    return next();
  }
  const user = req.user as any;
  if (user && user.role === "super_admin") {
    return next();
  }
  return res.status(401).json({ message: "ต้อง login เป็น Super Admin หรือ SysAdmin" });
}
import crypto from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { getConfig } from "../config-bootstrap";
import { hashPassword } from "../auth";
import { platformCloneProgress, setPlatformCloneProgress, cloneLockState, cloneScreenUserId, cloneScreenLastHeartbeat, setCloneScreen, setCloneScreenHeartbeat, acquireCloneLock, releaseCloneLock } from "../clone-state";
import { isMaintenanceMode, getMaintenanceStatus, activateNow, liftMaintenance, setCloneInProgress, isCloneInProgress, getCloneSessionUserId, freezeTimer, unfreezeTimer, destroyScheduleAfterClone, hasCompletedMaintenanceToday, getScheduleHistory, initMaintenanceOnStartup, getActiveSchedule, getPendingSchedule, createSchedule, rescheduleSchedule, cancelSchedule, setOnEnableCallback } from "../maintenance";
import { recordCloneHistory } from "../services/clone-history-central";

function resolveDbCredentials(machine: any): { port: number; dbName: string; dbUser: string; dbPassword: string; source: string } {
  if (machine.encContent && machine.encHostname && machine.encMacAddress && machine.encConfigDbPort) {
    try {
      const { decryptEncContent } = require("../utils/machine-crypto");
      const payload = decryptEncContent(machine.encContent, machine.encHostname, machine.encMacAddress, machine.encConfigDbPort);
      const mb = payload.mainDb;
      const mbPort = mb ? parseInt(mb.port, 10) : NaN;
      if (mb && mb.user && mb.password && mb.database && mb.port && !isNaN(mbPort) && mbPort > 0 && mbPort <= 65535) {
        return { port: mbPort, dbName: mb.database, dbUser: mb.user, dbPassword: mb.password, source: "encrypted" };
      }
    } catch {}
  }
  return {
    port: parseInt(machine.dbPort || "5432", 10),
    dbName: machine.dbName || "postgres",
    dbUser: machine.dbUser || "postgres",
    dbPassword: machine.dbPassword || "",
    source: "plaintext",
  };
}

export function registerPlatformRoutes(app: Express) {
// ========== Platform (Super Admin) Routes ==========

app.get("/api/platform/stats", requireAuth, requireSuperAdmin, async (_req, res) => {
  const stats = await storage.getTenantStats();
  res.json(stats);
});

app.delete("/api/platform/orphan-users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const currentUser = req.user as any;
    if (userId === currentUser.id) {
      return res.status(400).json({ message: "ไม่สามารถลบตัวเองได้" });
    }
    const [target] = await db.select().from(users).where(eq(users.id, userId));
    if (!target) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }
    if (target.role === "super_admin") {
      return res.status(400).json({ message: "ไม่สามารถลบ Super Admin ได้" });
    }
    const stats = await storage.getTenantStats();
    const isOrphan = stats.orphanUsers?.some((u: any) => u.id === userId);
    if (!isOrphan) {
      return res.status(400).json({ message: "ผู้ใช้นี้มี Tenant อยู่แล้ว ไม่ใช่ orphan" });
    }
    await db.delete(users).where(eq(users.id, userId));
    res.json({ message: `ลบผู้ใช้ "${target.username}" สำเร็จ` });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/tenants", requireAuth, requireSuperAdmin, async (_req, res) => {
  const stats = await storage.getTenantStats();
  res.json(stats.tenants);
});

app.post("/api/platform/tenants", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { hashPassword } = await import("./auth");
    const { name, tenantType, contactName, contactEmail, contactPhone, adminUsername, adminPassword, notes } = req.body;

    if (!name || !tenantType || !adminUsername || !adminPassword) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const existingUser = await storage.getUserByUsername(adminUsername);
    if (existingUser) {
      return res.status(400).json({ message: "ชื่อผู้ใช้ซ้ำ กรุณาใช้ชื่ออื่น" });
    }

    const hashedPw = await hashPassword(adminPassword);

    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({
        name,
        tenantType,
        status: "active",
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
      }).returning();

      const [company] = await tx.insert(companies).values({
        name,
        industry: null,
        taxId: null,
        active: true,
        isPrimary: true,
        tenantType,
        tenantId: tenant.id,
      }).returning();

      const [adminUser] = await tx.insert(users).values({
        username: adminUsername,
        password: hashedPw,
        fullName: contactName || "ผู้ดูแลระบบ",
        role: "admin",
        email: contactEmail || null,
        active: true,
        tenantId: tenant.id,
      }).returning();

      return { tenant, company, adminUser };
    });

    res.json({
      message: "สร้าง Tenant สำเร็จ",
      tenant: result.tenant,
      company: { id: result.company.id, name: result.company.name },
      admin: { id: result.adminUser.id, username: adminUsername },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/platform/tenants/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status, name, contactName, contactEmail, contactPhone, notes } = req.body;
  const updated = await storage.updateTenant(id, { 
    ...(status && { status }),
    ...(name && { name }),
    ...(contactName !== undefined && { contactName }),
    ...(contactEmail !== undefined && { contactEmail }),
    ...(contactPhone !== undefined && { contactPhone }),
    ...(notes !== undefined && { notes }),
  });
  if (!updated) return res.status(404).json({ message: "ไม่พบ Tenant" });
  res.json(updated);
});

app.get("/api/platform/tenants/:tenantId/users", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const tenantUsers = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      email: users.email,
    }).from(users).where(eq(users.tenantId, tenantId));
    res.json(tenantUsers);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== GitHub Management ==========

function execGit(cmd: string, timeoutMs = 30000): string {
  return execSync(cmd, { cwd: process.cwd(), stdio: "pipe", timeout: timeoutMs }).toString().trim();
}

app.get("/api/platform/github/local-info", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const cwd = process.cwd();
    const exec = (cmd: string) => {
      try { return execSync(cmd, { cwd, stdio: "pipe", timeout: 15000, maxBuffer: 10 * 1024 * 1024 }).toString().trim(); } catch (e: any) { console.error(`[github-info] cmd failed: ${cmd}`, e.message); return ""; }
    };

    const localBranch = exec("git branch --show-current");
    const localCommit = exec("git rev-parse --short HEAD");
    const localCommitFull = exec("git rev-parse HEAD");
    const lastCommitDate = exec("git log -1 --format=%ci");
    const lastCommitMsg = exec("git log -1 --format=%s");
    const lastCommitAuthor = exec("git log -1 --format=%an");
    const totalCommits = exec("git rev-list --count HEAD");
    const version = (() => { try { return fs.readFileSync(path.join(cwd, "VERSION"), "utf-8").trim(); } catch { return "1.0.0"; } })();

    const tsFiles = exec("find client/src server shared \\( -name '*.ts' -o -name '*.tsx' \\) 2>/dev/null | wc -l");
    const totalLines = exec("find client/src server shared \\( -name '*.ts' -o -name '*.tsx' \\) -print0 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1 | awk '{print $1}'");
    const fileCount = exec("git ls-files | wc -l");

    const topFileRaw = exec("find client/src server shared -name '*.ts' -o -name '*.tsx' 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | grep -v ' total$' | head -1");
    const topMatch = topFileRaw.match(/^\s*(\d+)\s+(.+)$/);
    const maxFileLines = topMatch ? Number(topMatch[1]) : 0;
    const maxFileName = topMatch ? topMatch[2] : "";

    res.json({
      branch: localBranch,
      commit: localCommit,
      commitFull: localCommitFull,
      lastCommitDate,
      lastCommitMsg,
      lastCommitAuthor,
      totalCommits: Number(totalCommits) || 0,
      version,
      tsFiles: Number(tsFiles) || 0,
      totalLines: Number(totalLines) || 0,
      trackedFiles: Number(fileCount) || 0,
      maxFileLines,
      maxFileName,
    });
  } catch (err: any) {
    console.error("[github-local-info] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/github/remote-info", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const cwd = process.cwd();
    const exec = (cmd: string) => {
      try { return execSync(cmd, { cwd, stdio: "pipe", timeout: 15000, maxBuffer: 10 * 1024 * 1024 }).toString().trim(); } catch (e: any) { console.error(`[github-info] cmd failed: ${cmd}`, e.message); return ""; }
    };

    const remoteUrl = exec("git remote get-url github 2>/dev/null") || "";
    const safeRemoteUrl = remoteUrl.replace(/\/\/[^@]+@/, "//***@");
    const hasRemote = !!remoteUrl;

    let githubBranch = "";
    let githubCommit = "";
    let githubCommitDate = "";
    let githubCommitMsg = "";
    let githubReachable = false;
    let behindCount = 0;
    let aheadCount = 0;

    if (hasRemote) {
      try {
        execSync("git fetch github main --quiet", { cwd, stdio: "pipe", timeout: 20000 });
        githubReachable = true;
        githubBranch = "main";
        githubCommit = exec("git rev-parse --short github/main");
        githubCommitDate = exec("git log -1 --format=%ci github/main");
        githubCommitMsg = exec("git log -1 --format=%s github/main");
        behindCount = Number(exec("git rev-list --count HEAD..github/main")) || 0;
        aheadCount = Number(exec("git rev-list --count github/main..HEAD")) || 0;
      } catch {
        githubReachable = false;
      }
    }

    res.json({
      remoteUrl: safeRemoteUrl,
      hasRemote,
      reachable: githubReachable,
      branch: githubBranch,
      commit: githubCommit,
      commitDate: githubCommitDate,
      commitMsg: githubCommitMsg,
      behindCount,
      aheadCount,
    });
  } catch (err: any) {
    console.error("[github-remote-info] Error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/github/push", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const cwd = process.cwd();
    const commitMsg = req.body.commitMessage || `Manual push ${new Date().toISOString().slice(0, 10)}`;

    const remoteUrl = (() => { try { return execSync("git remote get-url github", { cwd, stdio: "pipe" }).toString().trim(); } catch { return ""; } })();
    if (!remoteUrl) return res.status(400).json({ message: "GitHub remote 'github' not configured" });

    const versionFile = path.join(cwd, "VERSION");
    let version = "1.0.0";
    try { version = fs.readFileSync(versionFile, "utf-8").trim(); } catch {}
    let [major, minor, patch] = version.split(".").map(Number);
    patch = (patch || 0) + 1;
    if (patch > 9) { patch = 0; minor++; }
    if (minor > 9) { minor = 0; major++; }
    const newVersion = `${major}.${minor}.${patch}`;
    const tag = `v${newVersion}`;
    const fullMsg = `${tag} — ${commitMsg}`;

    fs.writeFileSync(versionFile, newVersion + "\n");
    try { execSync('git config user.email "etax-center@replit.dev" && git config user.name "E-Tax Center"', { cwd, stdio: "pipe" }); } catch {}
    execSync(`git add VERSION && git commit -m "Bump version to ${newVersion}"`, { cwd, stdio: "pipe" });

    execSync("git checkout --orphan deploy-temp", { cwd, stdio: "pipe" });
    execSync("git add -A", { cwd, stdio: "pipe" });
    execSync(`git commit -m "${fullMsg.replace(/"/g, '\\"')}"`, { cwd, stdio: "pipe" });
    execSync(`git tag -f ${tag}`, { cwd, stdio: "pipe" });
    execSync(`git push ${remoteUrl} deploy-temp:main --force`, { cwd, stdio: "pipe", timeout: 120000 });
    execSync(`git push ${remoteUrl} ${tag} --force`, { cwd, stdio: "pipe", timeout: 30000 });
    execSync("git checkout replit-agent", { cwd, stdio: "pipe" });
    execSync("git branch -D deploy-temp", { cwd, stdio: "pipe" });

    res.json({ success: true, version: newVersion, tag, message: fullMsg });
  } catch (err: any) {
    try { execSync("git checkout replit-agent", { cwd: process.cwd(), stdio: "pipe" }); } catch {}
    try { execSync("git branch -D deploy-temp", { cwd: process.cwd(), stdio: "pipe" }); } catch {}
    res.status(500).json({ message: `Push failed: ${err.message}` });
  }
});

app.post("/api/platform/github/pull", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const cwd = process.cwd();
    const archiver = (await import("archiver")).default;

    const remoteUrl = (() => { try { return execSync("git remote get-url github", { cwd, stdio: "pipe" }).toString().trim(); } catch { return ""; } })();
    if (!remoteUrl) return res.status(400).json({ message: "GitHub remote 'github' not configured" });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-pull-"));
    const cloneDir = path.join(tmpDir, "repo");

    try {
      execSync(`git clone --depth 1 ${remoteUrl} "${cloneDir}"`, { stdio: "pipe", timeout: 120000 });

      const commitHash = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: cloneDir, stdio: "pipe" }).toString().trim(); } catch { return "unknown"; } })();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `etax-github-${commitHash}-${timestamp}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);
      archive.glob("**/*", {
        cwd: cloneDir,
        ignore: [".git/**", "node_modules/**"],
        dot: true,
      });
      await archive.finalize();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ message: `Pull failed: ${err.message}` });
    }
  }
});

app.get("/api/platform/github/largest-files", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const cwd = process.cwd();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const raw = execSync(
      `find client/src server shared -name '*.ts' -o -name '*.tsx' 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -${limit + 1}`,
      { cwd, stdio: "pipe", timeout: 30000 }
    ).toString().trim();

    const files: { lines: number; file: string }[] = [];
    for (const line of raw.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match && !match[2].includes("total")) {
        files.push({ lines: Number(match[1]), file: match[2] });
      }
    }

    res.json({ files: files.slice(0, limit) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/platform/github/token", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string" || token.trim().length < 10) {
      return res.status(400).json({ message: "Invalid token" });
    }
    const cwd = process.cwd();
    const currentUrl = (() => { try { return execSync("git remote get-url github", { cwd, stdio: "pipe" }).toString().trim(); } catch { return ""; } })();
    if (!currentUrl) return res.status(400).json({ message: "GitHub remote 'github' not configured" });

    const newUrl = currentUrl.replace(/\/\/[^@]+@/, `//${token.trim().includes(":") ? token.trim() : `pat:${token.trim()}`}@`);
    execSync(`git remote set-url github "${newUrl}"`, { cwd, stdio: "pipe" });

    const verify = (() => { try { execSync("git ls-remote --heads github 2>&1", { cwd, stdio: "pipe", timeout: 15000 }); return true; } catch { return false; } })();

    res.json({ success: true, reachable: verify });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/github/token-info", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const cwd = process.cwd();
    const remoteUrl = (() => { try { return execSync("git remote get-url github", { cwd, stdio: "pipe" }).toString().trim(); } catch { return ""; } })();
    if (!remoteUrl) return res.json({ hasToken: false });

    const match = remoteUrl.match(/\/\/([^@]+)@/);
    if (!match) return res.json({ hasToken: false });

    const credPart = match[1];
    const token = credPart.includes(":") ? credPart.split(":").pop()! : credPart;
    const masked = token.length > 8 ? token.slice(0, 4) + "•".repeat(token.length - 8) + token.slice(-4) : "•".repeat(token.length);

    let expiresAt: string | null = null;
    let scopes: string | null = null;
    let githubUser: string | null = null;
    let tokenType: string = "unknown";
    let rateLimit: { limit: number; remaining: number; reset: string } | null = null;
    try {
      const resp = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}`, "User-Agent": "etax-center" },
      });
      const expHeader = resp.headers.get("github-authentication-token-expiration");
      if (expHeader) expiresAt = expHeader;
      const scopeHeader = resp.headers.get("x-oauth-scopes");
      if (scopeHeader !== null) {
        scopes = scopeHeader;
        tokenType = "classic";
      } else {
        tokenType = token.startsWith("github_pat_") ? "fine-grained" : "classic";
      }
      const rlLimit = resp.headers.get("x-ratelimit-limit");
      const rlRemaining = resp.headers.get("x-ratelimit-remaining");
      const rlReset = resp.headers.get("x-ratelimit-reset");
      if (rlLimit && rlRemaining && rlReset) {
        rateLimit = { limit: Number(rlLimit), remaining: Number(rlRemaining), reset: new Date(Number(rlReset) * 1000).toISOString() };
      }
      if (resp.ok) {
        const userData = await resp.json();
        githubUser = userData.login || null;
      }
    } catch {}

    res.json({ hasToken: true, masked, full: token, expiresAt, scopes, githubUser, tokenType, rateLimit });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ========== Database Backup & Clone ==========

app.get("/api/platform/clone-progress", requireAuth, requireAdmin, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json(platformCloneProgress);
});

app.get("/api/platform/clone-history", requireAuth, requireAdmin, async (_req, res) => {
  try {
    let rows: any[] = [];
    let source = "local";

    const { getTargetUrl, ensureTargetLoaded } = await import("../services/clone-history-central");
    await ensureTargetLoaded();
    const centralUrl = await getTargetUrl();

    if (centralUrl) {
      const pgLib = await import("pg");
      const pool = new pgLib.default.Pool({ connectionString: centralUrl, max: 1, connectionTimeoutMillis: 5000 });
      try {
        const result = await pool.query(
          `SELECT session_id, clone_type, direction, table_name, row_count, host_duration_ms, remote_duration_ms,
                  status, error_message, batch_index, total_batches, started_at, completed_at, created_by,
                  dump_file_size, dump_speed, restore_speed, source_machine
           FROM clone_history ORDER BY started_at DESC LIMIT 200`
        );
        rows = result.rows.map(r => ({
          sessionId: r.session_id, cloneType: r.clone_type, direction: r.direction || "us_to_th",
          tableName: r.table_name, rowCount: r.row_count, hostDurationMs: r.host_duration_ms,
          remoteDurationMs: r.remote_duration_ms, status: r.status, errorMessage: r.error_message,
          startedAt: r.started_at, completedAt: r.completed_at, createdBy: r.created_by,
          sourceMachine: r.source_machine,
        }));
        source = "central";
        await pool.end();
      } catch {
        try { await pool.end(); } catch {}
      }
    }

    if (rows.length === 0) {
      const localRows = await db.select().from(cloneHistory).orderBy(desc(cloneHistory.startedAt)).limit(200);
      rows = localRows;
      source = "local";
    }

    const sessionMap = new Map<string, any>();
    for (const r of rows) {
      if (!sessionMap.has(r.sessionId)) {
        sessionMap.set(r.sessionId, {
          sessionId: r.sessionId,
          cloneType: r.cloneType,
          direction: r.direction || "us_to_th",
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          status: r.status,
          createdBy: r.createdBy,
          sourceMachine: r.sourceMachine,
          tables: [],
        });
      }
      const session = sessionMap.get(r.sessionId)!;
      session.tables.push({
        tableName: r.tableName,
        rowCount: r.rowCount,
        hostDurationMs: r.hostDurationMs,
        remoteDurationMs: r.remoteDurationMs,
        status: r.status,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      });
      if (r.completedAt && (!session.completedAt || r.completedAt > session.completedAt)) {
        session.completedAt = r.completedAt;
      }
      if (r.status === "error") session.status = "error";
    }
    res.json({ source, sessions: Array.from(sessionMap.values()).slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/clone-reset", requireAuth, requireAdmin, (_req, res) => {
  setPlatformCloneProgress({ status: "idle", percent: 0 });
  res.json({ success: true });
});

app.get("/api/platform/clone-last-failed", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const lastSession = await db.select()
      .from(cloneHistory)
      .orderBy(desc(cloneHistory.completedAt))
      .limit(1);

    if (!lastSession.length) return res.json({ hasFailedTable: false });

    const sessionId = lastSession[0].sessionId;
    const sessionRows = await db.select()
      .from(cloneHistory)
      .where(eq(cloneHistory.sessionId, sessionId));

    const failedTables = sessionRows.filter(r => r.status === "error");

    if (failedTables.length) {
      const lastFailed = failedTables[failedTables.length - 1];
      return res.json({
        hasFailedTable: true,
        sessionId,
        tableName: lastFailed.tableName,
        errorMessage: lastFailed.errorMessage,
        failedAt: lastFailed.completedAt,
        totalFailed: failedTables.length,
        totalTables: sessionRows.length,
      });
    }

    const checkMissing = req.query.checkMissing === "true";
    const targetKey = (req.query.targetDb as string) || "";
    if (checkMissing && targetKey) {
      const targetUrlMap: Record<string, string | undefined> = {
        dev: getConfig("DB_MAIN_URL"),
        pdt: getConfig("DB_PROD_URL"),
        test: getConfig("DB_TEST_URL", "DATABASE_URL_TEST"),
      };
      const sourceUrl = process.env.DATABASE_URL;
      const targetUrl = targetUrlMap[targetKey];
      if (sourceUrl && targetUrl) {
        const pg2 = (await import("pg")).default;
        const sourcePool = new pg2.Pool({ connectionString: sourceUrl, max: 2, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 });
        const targetPool = new pg2.Pool({ connectionString: targetUrl, max: 2, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 });
        try {
          const [srcRes, tgtRes] = await Promise.all([
            sourcePool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"),
            targetPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"),
          ]);
          const srcTables = new Set(srcRes.rows.map((r: any) => r.table_name));
          const tgtTables = new Set(tgtRes.rows.map((r: any) => r.table_name));
          const skipTables = new Set(["system_config", "session"]);
          const missingTables = [...srcTables].filter(t => !tgtTables.has(t) && !skipTables.has(t)).sort();
          if (missingTables.length > 0) {
            return res.json({
              hasFailedTable: true,
              hasMissingTables: true,
              sessionId,
              tableName: missingTables[0],
              missingTables,
              errorMessage: `การ Clone ครั้งก่อนถูกขัดจังหวะ — มี ${missingTables.length} ตารางที่ยังไม่ได้ Clone`,
              failedAt: lastSession[0].completedAt,
              totalFailed: missingTables.length,
              totalTables: sessionRows.length + missingTables.length,
            });
          }
        } catch (connErr: any) {
          console.log(`[clone-last-failed] Missing table check failed (non-fatal): ${connErr.message?.slice(0, 120)}`);
        } finally {
          await sourcePool.end().catch(() => {});
          await targetPool.end().catch(() => {});
        }
      }
    }

    return res.json({ hasFailedTable: false });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/clone-incomplete-alert", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const { isMaintenanceMode } = await import("./maintenance");

    const lastSession = await db.select()
      .from(cloneHistory)
      .orderBy(desc(cloneHistory.completedAt))
      .limit(1);

    if (!lastSession.length) return res.json({ hasIncomplete: false });

    const sessionId = lastSession[0].sessionId;
    const sessionRows = await db.select()
      .from(cloneHistory)
      .where(eq(cloneHistory.sessionId, sessionId));

    const failedTables = sessionRows.filter(r => r.status === "error");
    const allSuccess = sessionRows.every(r => r.status === "success" || r.status === "dropped" || r.status === "dismissed");

    if (allSuccess && failedTables.length === 0) {
      return res.json({ hasIncomplete: false });
    }

    const maintenanceLocked = isMaintenanceMode();
    const currentTarget = (await import("./db")).activeDbInfo.target;

    const cloneDirection = lastSession[0].direction || "us_to_th";
    const cloneTarget = cloneDirection === "us_to_th" ? "thailand" : "usa";
    const halfBakedOnActiveDb = cloneTarget === currentTarget;

    const missingTableNames = failedTables.map(r => r.tableName);
    const lastError = failedTables[failedTables.length - 1];

    return res.json({
      hasIncomplete: true,
      sessionId,
      halfBakedOnActiveDb,
      maintenanceLocked,
      currentTarget,
      cloneTarget,
      cloneDirection,
      failedTables: missingTableNames,
      totalFailed: failedTables.length,
      totalTables: sessionRows.length,
      lastError: lastError ? {
        tableName: lastError.tableName,
        errorMessage: lastError.errorMessage,
        failedAt: lastError.completedAt,
      } : null,
      completedAt: lastSession[0].completedAt,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/clone-switch-back", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { emergencySwitchToSource } = await import("./db");
    const { liftMaintenance, setCloneInProgress, cancelHalfBakedTimeout } = await import("./maintenance");

    cancelHalfBakedTimeout();

    const result = await emergencySwitchToSource();
    if (!result.success) {
      return res.status(500).json({ message: `ไม่สามารถสลับฐานข้อมูลได้: ${result.error}` });
    }

    await setCloneInProgress(0, false);
    await liftMaintenance((req.user as any)?.fullName || "Platform User" + " (switch back after half-baked clone)");
    setCloneScreen(null);
    releaseCloneLock();
    setPlatformCloneProgress({ status: "idle", percent: 0, step: "" });

    console.log(`[Clone Switch-Back] Platform user switched DB back to source (USA) after half-baked clone`);
    res.json({ success: true, message: "สลับฐานข้อมูลกลับไปต้นทางเรียบร้อย ระบบเปิดใช้งานปกติแล้ว" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/clone-dismiss-incomplete", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { isMaintenanceMode } = await import("./maintenance");
    const currentTarget = (await import("./db")).activeDbInfo.target;

    const lastSession = await db.select()
      .from(cloneHistory)
      .orderBy(desc(cloneHistory.completedAt))
      .limit(1);

    if (lastSession.length) {
      const sessionId = lastSession[0].sessionId;
      const cloneDirection = lastSession[0].direction || "us_to_th";
      const cloneTarget = cloneDirection === "us_to_th" ? "thailand" : "usa";

      if (cloneTarget === currentTarget && isMaintenanceMode()) {
        return res.status(400).json({
          message: "ไม่สามารถปิดแจ้งเตือนได้ — Clone ไม่สมบูรณ์บนฐานข้อมูลที่ใช้งานอยู่ ต้องสลับ DB กลับก่อน"
        });
      }

      const { cancelHalfBakedTimeout } = await import("./maintenance");
      cancelHalfBakedTimeout();

      await db.update(cloneHistory)
        .set({ status: "dismissed" })
        .where(and(
          eq(cloneHistory.sessionId, sessionId),
          eq(cloneHistory.status, "error"),
        ));
    }

    console.log(`[Clone Dismiss] Platform user dismissed incomplete clone alert`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/clone-dismiss-failed", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId, tableName } = req.body || {};
    if (!sessionId) return res.status(400).json({ message: "ต้องระบุ sessionId" });

    if (tableName) {
      await db.update(cloneHistory)
        .set({ status: "dismissed" })
        .where(and(
          eq(cloneHistory.sessionId, sessionId),
          eq(cloneHistory.tableName, tableName),
          eq(cloneHistory.status, "error"),
        ));
      console.log(`[Clone] Dismissed failed table: ${tableName} in session ${sessionId}`);
    } else {
      await db.update(cloneHistory)
        .set({ status: "dismissed" })
        .where(and(
          eq(cloneHistory.sessionId, sessionId),
          eq(cloneHistory.status, "error"),
        ));
      console.log(`[Clone] Dismissed all failed tables in session ${sessionId}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/clone-space-check", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const tables = (req.query.tables as string || "").split(",").filter(Boolean);
    if (!tables.length) return res.json({ ok: true, message: "ไม่มีตารางที่เลือก" });

    const sourceUrl = process.env.DATABASE_URL;
    const targetKey = (req.query.targetDb as string) || "test";
    const targetUrlMap: Record<string, string | undefined> = {
      dev: getConfig("DB_MAIN_URL"),
      pdt: getConfig("DB_PROD_URL"),
      test: getConfig("DB_TEST_URL", "DATABASE_URL_TEST"),
    };
    const targetUrl = targetUrlMap[targetKey];
    if (!sourceUrl || !targetUrl) return res.status(400).json({ ok: false, message: `Database URL not configured (source or target '${targetKey}')` });

    const pg2 = (await import("pg")).default;

    const sourcePool = new pg2.Pool({ connectionString: sourceUrl, max: 2, idleTimeoutMillis: 5000 });
    let largestTableBytes = 0;
    let totalSelectedBytes = 0;
    let largestTableName = "";
    try {
      for (const t of tables) {
        try {
          const r = await sourcePool.query(`SELECT pg_total_relation_size(quote_ident($1)) AS size_bytes`, [t]);
          const bytes = parseInt(r.rows[0]?.size_bytes) || 0;
          totalSelectedBytes += bytes;
          if (bytes > largestTableBytes) {
            largestTableBytes = bytes;
            largestTableName = t;
          }
        } catch {}
      }
    } finally { await sourcePool.end(); }

    const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
    const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

    const makeEmptyResult = (ok: boolean, msg: string) => ({
      ok,
      source: {
        totalSelectedBytes, totalSelectedMB: formatMB(totalSelectedBytes), totalSelectedGB: formatGB(totalSelectedBytes),
        largestTableName, largestTableBytes, largestTableMB: formatMB(largestTableBytes), largestTableGB: formatGB(largestTableBytes),
        tableCount: tables.length,
      },
      target: { dbSizeBytes: 0, dbSizeGB: "0.00", freeBytes: 0, freeGB: "0.00", hasDiskInfo: false, diskCheckMethod: "none" },
      swap: { requiredBytes: 0, requiredMB: "0.0", requiredGB: "0.00", explanation: "" },
      message: msg,
    });

    let targetDbSizeBytes = 0;
    let targetFreeBytes = 0;
    let hasDiskInfo = false;
    let diskCheckMethod = "pg_database_size";
    let targetOS = "unknown";
    const targetPool = new pg2.Pool({ connectionString: targetUrl, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 30000 });
    try {
      const dbSizeRes = await targetPool.query(`SELECT pg_database_size(current_database()) AS db_size`);
      targetDbSizeBytes = parseInt(dbSizeRes.rows[0]?.db_size) || 0;

      const versionRes = await targetPool.query(`SELECT version() AS ver`);
      const verStr = (versionRes.rows[0]?.ver || "").toLowerCase();
      const isWindows = verStr.includes("windows") || verStr.includes("visual c++") || verStr.includes("mingw");
      const isLinux = !isWindows && (verStr.includes("linux") || verStr.includes("debian") || verStr.includes("ubuntu"));
      targetOS = isWindows ? "windows" : isLinux ? "linux" : "unknown";
      console.log(`[clone-space-check] Target OS detected: ${targetOS} (${verStr.slice(0, 80)})`);

      const dataDir = (await targetPool.query(`SELECT setting FROM pg_settings WHERE name = 'data_directory'`)).rows[0]?.setting || "";
      console.log(`[clone-space-check] Target data_directory: ${dataDir}`);

      try {
        const tmpTable = `_disk_check_${Date.now()}`;
        await targetPool.query(`CREATE TEMP TABLE "${tmpTable}" (raw text)`);

        if (isWindows) {
          const driveLetter = dataDir.charAt(0).toUpperCase();
          const cmd = `powershell -NoProfile -Command "(Get-PSDrive ${driveLetter}).Free"`;
          console.log(`[clone-space-check] Running Windows disk check: ${cmd}`);
          await targetPool.query(`COPY "${tmpTable}" FROM PROGRAM '${cmd.replace(/'/g, "''")}'`);
        } else {
          const mountPoint = dataDir || "/";
          const cmd = `df -B1 "${mountPoint}" | tail -1 | awk '{print $4}'`;
          console.log(`[clone-space-check] Running Linux disk check: ${cmd}`);
          await targetPool.query(`COPY "${tmpTable}" FROM PROGRAM '${cmd.replace(/'/g, "''")}'`);
        }

        const diskRes = await targetPool.query(`SELECT raw FROM "${tmpTable}" LIMIT 5`);
        for (const row of diskRes.rows) {
          const val = parseInt((row.raw || "").trim());
          if (val > 0) {
            targetFreeBytes = val;
            hasDiskInfo = true;
            diskCheckMethod = isWindows ? "powershell" : "df";
            break;
          }
        }
        await targetPool.query(`DROP TABLE IF EXISTS "${tmpTable}"`);
        console.log(`[clone-space-check] Disk free: ${formatGB(targetFreeBytes)} GB (${targetFreeBytes} bytes) via ${diskCheckMethod}`);
      } catch (diskErr: any) {
        console.log(`[clone-space-check] COPY TO PROGRAM disk check failed (non-fatal): ${diskErr.message?.slice(0, 120)}`);
      }
    } catch (e: any) {
      await targetPool.end().catch(() => {});
      return res.json(makeEmptyResult(false, `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ปลายทาง: ${(e.message || "").slice(0, 100)}`));
    } finally { await targetPool.end().catch(() => {}); }

    const requiredBytes = largestTableBytes * 1.5;
    const isSpaceOk = !hasDiskInfo || targetFreeBytes > requiredBytes;

    const freeLabel = hasDiskInfo
      ? (parseFloat(formatGB(targetFreeBytes)) > 1 ? formatGB(targetFreeBytes) + " GB" : formatMB(targetFreeBytes) + " MB")
      : "ไม่ทราบ";
    const requiredLabel = parseFloat(formatGB(requiredBytes)) > 1 ? formatGB(requiredBytes) + " GB" : formatMB(requiredBytes) + " MB";

    let message: string;
    if (!hasDiskInfo) {
      message = `เชื่อมต่อปลายทางสำเร็จ (${targetOS}) — ไม่สามารถตรวจสอบพื้นที่ว่างได้ — DB: ${formatGB(targetDbSizeBytes)} GB, ตารางใหญ่สุด: ${largestTableName}`;
    } else if (isSpaceOk) {
      message = `พื้นที่ว่างเพียงพอ — ว่าง ${freeLabel}, ต้องการ ${requiredLabel} (${targetOS})`;
    } else {
      message = `พื้นที่ว่างไม่เพียงพอ — ว่าง ${freeLabel}, ต้องการ ${requiredLabel} (${targetOS})`;
    }

    res.json({
      ok: isSpaceOk,
      source: {
        totalSelectedBytes, totalSelectedMB: formatMB(totalSelectedBytes), totalSelectedGB: formatGB(totalSelectedBytes),
        largestTableName, largestTableBytes, largestTableMB: formatMB(largestTableBytes), largestTableGB: formatGB(largestTableBytes),
        tableCount: tables.length,
      },
      target: {
        dbSizeBytes: targetDbSizeBytes, dbSizeGB: formatGB(targetDbSizeBytes),
        freeBytes: targetFreeBytes, freeGB: formatGB(targetFreeBytes),
        hasDiskInfo, diskCheckMethod, targetOS,
      },
      swap: {
        requiredBytes: Math.round(requiredBytes), requiredMB: formatMB(requiredBytes), requiredGB: formatGB(requiredBytes),
        explanation: `Swap strategy ต้องการพื้นที่เพิ่มชั่วคราว = ตารางที่ใหญ่ที่สุด (${largestTableName}: ${formatMB(largestTableBytes)} MB) × 1.5`,
      },
      message,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get("/api/platform/clone-tables", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const sourceUrl = process.env.DATABASE_URL;
    if (!sourceUrl) return res.status(400).json({ message: "DATABASE_URL not set" });

    const { STATIC_TABLES, TRANSACTION_TABLES, getTableRowCounts, getUnregisteredTablesAsync } = await import("./clone-tables");
    const unregistered = await getUnregisteredTablesAsync();
    const allNames = [
      ...STATIC_TABLES.map(t => t.pgName),
      ...TRANSACTION_TABLES.map(t => t.pgName),
      ...unregistered.map(t => t.tableName),
    ];
    const counts = await getTableRowCounts(allNames, sourceUrl);

    const staticList = STATIC_TABLES.map(t => ({
      pgName: t.pgName, displayName: t.displayName, rowCount: counts.get(t.pgName) ?? -1,
    }));
    const transactionList = TRANSACTION_TABLES.map(t => ({
      pgName: t.pgName, displayName: t.displayName, rowCount: counts.get(t.pgName) ?? -1,
    }));
    const unregisteredList = unregistered.map(t => ({
      pgName: t.tableName, displayName: t.tableName, rowCount: counts.get(t.tableName) ?? -1,
    }));

    res.json({ static: staticList, transaction: transactionList, unregistered: unregisteredList });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/clone-estimate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tables = (req.query.tables as string || "").split(",").filter(Boolean);
    if (!tables.length) return res.json({ estimates: [], totalMs: 0, hasEnoughData: false });

    const cloneType = (req.query.cloneType as string) || null;
    const recentSessions = await db.execute(sql`
      SELECT session_id,
             count(*)::int AS table_count,
             EXTRACT(EPOCH FROM (max(completed_at) - min(started_at)))::int * 1000 AS wall_clock_ms
      FROM clone_history
      WHERE status = 'success'
        AND completed_at IS NOT NULL
        AND started_at IS NOT NULL
        AND (${cloneType}::text IS NULL OR clone_type = ${cloneType})
      GROUP BY session_id
      HAVING count(*) >= ${Math.floor(tables.length * 0.8)}
      ORDER BY max(completed_at) DESC
      LIMIT 3
    `);

    const sessionRows = (recentSessions as any).rows || recentSessions;
    if (sessionRows.length >= 1) {
      const avgWallClockMs = Math.round(
        sessionRows.reduce((s: number, r: any) => s + Number(r.wall_clock_ms || 0), 0) / sessionRows.length
      );
      const perTableMs = Math.round(avgWallClockMs / (sessionRows[0].table_count || tables.length));
      const totalMs = perTableMs * tables.length;
      const estimates = tables.map(tableName => ({ tableName, avgMs: perTableMs, records: sessionRows.length }));
      return res.json({ estimates, totalMs, hasEnoughData: true, method: "session_wall_clock" });
    }

    const MIN_RECORDS = 3;
    const estimates: { tableName: string; avgMs: number | null; records: number }[] = [];
    const knownAvgs: number[] = [];
    const unknownIndices: number[] = [];

    for (const tableName of tables) {
      const records = await db.select()
        .from(cloneHistory)
        .where(and(
          eq(cloneHistory.tableName, tableName),
          eq(cloneHistory.status, "success")
        ))
        .orderBy(desc(cloneHistory.completedAt))
        .limit(5);

      if (records.length >= MIN_RECORDS) {
        const avgMs = Math.round(records.reduce((s, r) => s + (r.hostDurationMs || 0) + (r.remoteDurationMs || 0), 0) / records.length);
        estimates.push({ tableName, avgMs, records: records.length });
        knownAvgs.push(avgMs);
      } else {
        estimates.push({ tableName, avgMs: null, records: records.length });
        unknownIndices.push(estimates.length - 1);
      }
    }

    const fallbackAvg = knownAvgs.length > 0
      ? Math.round(knownAvgs.reduce((a, b) => a + b, 0) / knownAvgs.length)
      : 0;

    for (const idx of unknownIndices) {
      estimates[idx].avgMs = fallbackAvg;
    }

    const totalMs = estimates.reduce((s, e) => s + (e.avgMs || 0), 0);
    const hasEnoughData = knownAvgs.length >= Math.ceil(tables.length * 0.5);

    res.json({ estimates, totalMs, hasEnoughData, method: "per_table" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/clone-screen-enter", requireAuth, requireSuperAdmin, async (req, res) => {
  const user = req.user as any;
  if (cloneScreenUserId && cloneScreenUserId !== user.id) {
    return res.status(409).json({ message: "มีผู้ดูแลระบบอีกท่านกำลังใช้หน้า Clone อยู่", lockedBy: cloneScreenUserId });
  }

  const { ensureTargetLoaded } = await import("../services/clone-history-central");
  await ensureTargetLoaded();

  setCloneScreen(user.id, Date.now());
  console.log(`[Clone Screen] User #${user.id} entered clone screen (no maintenance lock yet)`);
  res.json({ success: true });
});

app.post("/api/platform/clone-screen-leave", requireAuth, requireSuperAdmin, async (req, res) => {
  const user = req.user as any;
  if (cloneScreenUserId === user.id && !cloneLockState.isRunning) {
    setCloneScreen(null, 0);
    console.log(`[Clone Screen] User #${user.id} left clone screen`);
  }
  res.json({ success: true });
});

app.post("/api/platform/clone-screen-heartbeat", requireAuth, requireSuperAdmin, (req, res) => {
  const user = req.user as any;
  if (cloneScreenUserId === user.id) {
    setCloneScreenHeartbeat(Date.now());
  }
  res.json({ success: true });
});

app.get("/api/platform/clone-screen-lock", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    locked: !!cloneScreenUserId,
    lockedBy: cloneScreenUserId,
    cloneLock: {
      isRunning: cloneLockState.isRunning,
      initiator: cloneLockState.initiator,
      targetDb: cloneLockState.targetDb,
      startedAt: cloneLockState.startedAt,
    },
  });
});

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB`;
}

app.post("/api/platform/sync-config", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { targetDb, direction } = req.body || {};
    const isReverse = direction === "th_to_us";
    const sourceUrl = isReverse
      ? (targetDb === "pdt" ? getConfig("DB_PROD_URL") : targetDb === "dev" ? getConfig("DB_MAIN_URL") : getConfig("DB_TEST_URL", "DATABASE_URL_TEST"))
      : process.env.DATABASE_URL!;
    const targetUrlMap: Record<string, string | undefined> = {
      dev: getConfig("DB_MAIN_URL"),
      pdt: getConfig("DB_PROD_URL"),
      test: getConfig("DB_TEST_URL", "DATABASE_URL_TEST"),
    };
    const targetUrl = isReverse ? process.env.DATABASE_URL! : targetUrlMap[targetDb];

    if (!sourceUrl || !targetUrl) {
      return res.status(400).json({ message: `ไม่พบ URL สำหรับ source/target '${targetDb}'` });
    }

    const pg2 = (await import("pg")).default;
    const srcPool = new pg2.Pool({ connectionString: sourceUrl, max: 2, connectionTimeoutMillis: 30000 });
    const dstPool = new pg2.Pool({ connectionString: targetUrl, max: 2, connectionTimeoutMillis: 30000 });

    try {
      const tableCheck = await dstPool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_config')`);
      if (!tableCheck.rows[0].exists) {
        const createSql = await srcPool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
          FROM information_schema.columns WHERE table_name = 'system_config' ORDER BY ordinal_position
        `);
        if (createSql.rows.length === 0) {
          return res.status(400).json({ message: "ตาราง system_config ไม่มีใน source DB" });
        }
        const cols = createSql.rows.map((c: any) => {
          let type = c.data_type === "character varying" ? `varchar(${c.character_maximum_length || 255})` : c.data_type;
          const nullable = c.is_nullable === "NO" ? " NOT NULL" : "";
          const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
          return `"${c.column_name}" ${type}${nullable}${def}`;
        }).join(", ");
        await dstPool.query(`CREATE TABLE IF NOT EXISTS system_config (${cols})`);
        console.log("[Sync Config] Created system_config table on target");
      }

      const srcRows = await srcPool.query(`SELECT * FROM system_config`);
      if (srcRows.rows.length === 0) {
        return res.json({ ok: true, synced: 0, message: "ไม่มี config ใน source DB" });
      }

      await dstPool.query(`DELETE FROM system_config`);

      let synced = 0;
      const syncedKeys: string[] = [];
      for (const row of srcRows.rows) {
        const keys = Object.keys(row);
        const vals = keys.map((_, i) => `$${i + 1}`);
        await dstPool.query(
          `INSERT INTO system_config (${keys.map(k => `"${k}"`).join(", ")}) VALUES (${vals.join(", ")})`,
          keys.map(k => row[k])
        );
        synced++;
        if (row.config_key) syncedKeys.push(row.config_key);
      }

      console.log(`[Sync Config] Synced ${synced} config entries to ${targetDb} (${isReverse ? "TH→US" : "US→TH"}): ${syncedKeys.join(", ")}`);
      return res.json({ ok: true, synced, keys: syncedKeys, message: `Sync สำเร็จ ${synced} รายการ` });
    } finally {
      await srcPool.end().catch(() => {});
      await dstPool.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[Sync Config] Error:", err);
    return res.status(500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
});

app.post("/api/platform/clone-db", requireAuth, requireSuperAdmin, async (req, res) => {
  const user = req.user as any;
  const userName = user.fullName || user.username;
  const userId = user.id;
  const sessionId = `clone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  const { cloneType, tables: manualTables, targetDb: targetDbKey, direction } = req.body || {};
  if (!cloneType || !["static", "transaction", "manual"].includes(cloneType)) {
    return res.status(400).json({ message: "cloneType ต้องเป็น static, transaction หรือ manual" });
  }
  const isReverse = direction === "th_to_us";

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ message: "DATABASE_URL ต้องตั้งค่า" });
    }
    try {
      const { isFtpArchiveRunning } = await import("./services/ftp-archive");
      if (isFtpArchiveRunning()) {
        return res.status(409).json({ message: "FTP Archive กำลังทำงานอยู่ กรุณารอให้เสร็จก่อน Clone" });
      }
    } catch {}

    const lockResult = acquireCloneLock("user", targetDbKey || "test", userId);
    if (!lockResult.acquired) {
      return res.status(409).json({ message: lockResult.reason || "กำลัง Clone อยู่แล้ว กรุณารอให้เสร็จก่อน" });
    }

    const { getTablesForCloneTypeAsync } = await import("./clone-tables");
    const tablesToClone = await getTablesForCloneTypeAsync(cloneType, manualTables);
    if (!tablesToClone.length) {
      releaseCloneLock();
      return res.status(400).json({ message: "ไม่มีตารางที่เลือก" });
    }

    const cloneTypeThai = cloneType === "static" ? "Static Data" : cloneType === "transaction" ? "Transaction Data" : "Manual";
    setPlatformCloneProgress({ status: "running", percent: 0, step: "เตรียมระบบ...", startedAt: Date.now(), completedTables: [], cloneType });
    console.log(`[Clone] Started by ${userName} (user #${userId}), type: ${cloneType}, tables: ${tablesToClone.length}`);

    const existingActive = await getActiveSchedule();
    if (existingActive && existingActive.source !== "clone_database") {
      setPlatformCloneProgress({ status: "idle", percent: 0 });
      releaseCloneLock();
      return res.status(409).json({ message: "ระบบอยู่ในโหมดปรับปรุงจากหน้าอื่นอยู่แล้ว" });
    }

    setPlatformCloneProgress({ status: "running", percent: 2, step: "เปิดโหมดปรับปรุง..." });
    const maintResult = await activateNow({
      message: `ระบบกำลัง Clone ฐานข้อมูล (${cloneTypeThai}) กรุณารอสักครู่`,
      enabledBy: userName,
      enabledByUserId: userId,
      source: "clone_database",
      bypassDailyLimit: true,
    });
    if (!maintResult.success) {
      const activeSchedule = await getActiveSchedule();
      if (!activeSchedule || (activeSchedule.source !== "clone_database")) {
        setPlatformCloneProgress({ status: "error", percent: 0, error: maintResult.message || "ไม่สามารถเปิดโหมดปรับปรุงได้" });
        releaseCloneLock();
        return res.status(400).json({ message: maintResult.message || "ไม่สามารถเปิดโหมดปรับปรุงได้" });
      }
    }
    await setCloneInProgress(userId, true);

    res.json({ success: true, sessionId, tableCount: tablesToClone.length });

    const resolvedTargetKey = targetDbKey || "test";
    const cloneTargetUrlMap: Record<string, string | undefined> = {
      dev: getConfig("DB_MAIN_URL"),
      pdt: getConfig("DB_PROD_URL"),
      test: getConfig("DB_TEST_URL", "DATABASE_URL_TEST"),
    };
    const remoteUrl = cloneTargetUrlMap[resolvedTargetKey];
    if (!remoteUrl) {
      setPlatformCloneProgress({ status: "error", percent: 0, error: `ไม่พบ URL สำหรับ target '${resolvedTargetKey}'` });
      releaseCloneLock();
      try { await setCloneInProgress(userId, false); } catch {}
      return;
    }
    const sourceUrl = isReverse ? remoteUrl : process.env.DATABASE_URL!;
    const targetUrl = isReverse ? process.env.DATABASE_URL! : remoteUrl;
    const targetLabels: Record<string, string> = { dev: "Dev (Thailand)", pdt: "Production (Thailand)", test: "Test/Backup" };
    const dirLabel = isReverse
      ? `TH→US (${targetLabels[resolvedTargetKey] || resolvedTargetKey} → Replit)`
      : `Target: ${targetLabels[resolvedTargetKey] || resolvedTargetKey}`;
    console.log(`[Clone] ${dirLabel}`);
    const { promisify } = await import("util");
    const { exec } = await import("child_process");
    const execAsync = promisify(exec);
    const pg2 = (await import("pg")).default;

    const replitDbUrl = process.env.DATABASE_URL!;

    try {
      setPlatformCloneProgress({ status: "running", percent: 5, step: "ทดสอบเชื่อมต่อเซิร์ฟเวอร์ปลายทาง..." });
      const testPool = new pg2.Pool({ connectionString: targetUrl, connectionTimeoutMillis: 30000 });
      try { await testPool.query("SELECT 1"); } catch (e: any) {
        throw new Error("ฐานข้อมูลปลายทาง ไม่พร้อมใช้งาน: " + (e.message || "").slice(0, 100));
      } finally { await testPool.end().catch(() => {}); }

      const totalTables = tablesToClone.length;
      let completedTables = 0;

      const { STATIC_TABLES } = await import("./clone-tables");
      const staticTableNames = new Set(STATIC_TABLES.map(t => t.pgName));

      setPlatformCloneProgress({ ...platformCloneProgress, status: "running", percent: 6, step: "นับจำนวนข้อมูลทุกตาราง..." });
      console.log(`[Clone] Pre-counting ${totalTables} tables...`);
      const rowCounts = new Map<string, number>();
      try {
        const countQuery = tablesToClone.map(t => `SELECT '${t}' AS t, count(*)::int AS c FROM "${t}"`).join(" UNION ALL\n") + ";";
        const countSqlFile = path.join(os.tmpdir(), `clone-count-${sessionId}.sql`);
        fs.writeFileSync(countSqlFile, countQuery);
        const countRes = await execAsync(`psql "${sourceUrl}" -t -A -F'|' -f "${countSqlFile}"`, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
        try { fs.unlinkSync(countSqlFile); } catch {}
        for (const line of countRes.stdout.trim().split("\n")) {
          const [tbl, cnt] = line.split("|");
          if (tbl) rowCounts.set(tbl, parseInt(cnt) || 0);
        }
        setPlatformCloneProgress({ ...platformCloneProgress, percent: 7, step: `นับเสร็จ ${rowCounts.size}/${totalTables} ตาราง` });
      } catch (countErr) {
        console.log(`[Clone] Batch count failed, falling back to individual counts:`, (countErr as any).message?.slice(0, 200));
        let counted = 0;
        for (const t of tablesToClone) {
          try {
            const r = await execAsync(`psql "${sourceUrl}" -t -A -c "SELECT count(*) FROM \\"${t}\\""`, { timeout: 15000 });
            rowCounts.set(t, parseInt(r.stdout.trim()) || 0);
          } catch { rowCounts.set(t, 0); }
          counted++;
          if (counted % 5 === 0 || counted === totalTables) {
            setPlatformCloneProgress({ ...platformCloneProgress, percent: 6 + Math.round((counted / totalTables) * 2), step: `นับข้อมูล ${counted}/${totalTables} ตาราง...` });
          }
        }
      }
      console.log(`[Clone] Row counts ready: ${rowCounts.size} tables`);

      const BATCH_THRESHOLD = 500;
      const MAX_TABLES_PER_BATCH = 15;
      interface CloneBatch { tables: string[]; totalRows: number; label: string; }
      const batches: CloneBatch[] = [];
      const largeTables: string[] = [];
      const smallTables: string[] = [];

      for (const t of tablesToClone) {
        const rc = rowCounts.get(t) || 0;
        if (rc > BATCH_THRESHOLD) {
          largeTables.push(t);
        } else {
          smallTables.push(t);
        }
      }

      for (let i = 0; i < smallTables.length; i += MAX_TABLES_PER_BATCH) {
        const chunk = smallTables.slice(i, i + MAX_TABLES_PER_BATCH);
        const totalRows = chunk.reduce((s, t) => s + (rowCounts.get(t) || 0), 0);
        batches.push({ tables: chunk, totalRows, label: `Batch ${batches.length + 1} (${chunk.length} ตาราง, ${totalRows} rows)` });
      }
      for (const t of largeTables) {
        batches.push({ tables: [t], totalRows: rowCounts.get(t) || 0, label: t });
      }

      const totalBatches = batches.length;
      const smallCount = smallTables.length;
      const largeCount = largeTables.length;
      console.log(`[Clone] Optimized: ${totalTables} tables → ${totalBatches} batches (${smallCount} small batched, ${largeCount} large individual)`);
      setPlatformCloneProgress({ ...platformCloneProgress, percent: 8, step: `${totalTables} ตาราง → ${totalBatches} batches (ลดการเชื่อมต่อ ${Math.round((1 - totalBatches / totalTables) * 100)}%)` });

      for (let bi = 0; bi < totalBatches; bi++) {
        const batch = batches[bi];
        const batchStart = Date.now();
        const overallPct = Math.round(10 + (bi / totalBatches) * 85);
        const dumpFile = path.join(os.tmpdir(), `clone_batch_${bi}.sql`);
        const batchTableNames = batch.tables;
        const isSingleTable = batchTableNames.length === 1;
        const displayName = isSingleTable ? batchTableNames[0] : batch.label;
        const isStaticBatch = batchTableNames.every(t => staticTableNames.has(t));
        const timeoutSec = isStaticBatch ? 300 : 7200;
        const batchRowCount = batch.totalRows;

        const updateProgress = (phase: string, extra?: Record<string, any>) => {
          const elapsedSec = Math.round((Date.now() - batchStart) / 1000);
          const remainingSec = Math.max(0, timeoutSec - elapsedSec);
          setPlatformCloneProgress({
            ...platformCloneProgress,
            status: "running", percent: overallPct,
            step: `[${bi + 1}/${totalBatches}] ${displayName} — ${phase}`,
            currentTable: displayName,
            tableIndex: bi + 1,
            totalTables: totalBatches,
            tableElapsedSec: elapsedSec,
            autoTimeoutSec: remainingSec,
            ...(extra || {}),
          });
        };

        try {
          updateProgress(`Dump (${batchTableNames.length} ตาราง, ${batchRowCount.toLocaleString()} rows)...`, { rowCount: batchRowCount, batchPhase: "dump" });
          console.log(`[Clone] ${overallPct}% — Batch ${bi + 1}/${totalBatches}: ${displayName} (${batchTableNames.length} tables, ${batchRowCount} rows)`);

          const tableFlags = batchTableNames.map(t => `--table="${t}"`).join(" ");
          const hostStart = Date.now();
          let dumpSpeedTimer: ReturnType<typeof setInterval> | null = null;

          try {
            let lastDumpSize = 0;
            dumpSpeedTimer = setInterval(() => {
              try {
                const stat = fs.statSync(dumpFile);
                const currentSize = stat.size;
                const bytesPerSec = currentSize - lastDumpSize;
                lastDumpSize = currentSize;
                const elapsedMs = Date.now() - hostStart;
                const avgSpeed = Math.round(currentSize / (elapsedMs / 1000));
                updateProgress(`Dump (${(currentSize / 1024).toFixed(0)} KB, ${formatSpeed(bytesPerSec)}/s)`, {
                  rowCount: batchRowCount, batchPhase: "dump",
                  transferSpeed: bytesPerSec, avgTransferSpeed: avgSpeed, transferredBytes: currentSize,
                });
              } catch {}
            }, 1000);
            await execAsync(`pg_dump "${sourceUrl}" --no-owner --no-acl --clean --if-exists ${tableFlags} > ${dumpFile}`, { timeout: timeoutSec * 1000 });
            if (dumpSpeedTimer) { clearInterval(dumpSpeedTimer); dumpSpeedTimer = null; }
          } catch (dumpErr: any) {
            if (dumpSpeedTimer) { clearInterval(dumpSpeedTimer); dumpSpeedTimer = null; }
            const errMsg = (dumpErr.message || "") + (dumpErr.stderr || "");
            const isTableNotFound = /no matching tables were found/i.test(errMsg);

            if (isTableNotFound && isSingleTable) {
              const hostDurationMs = Date.now() - hostStart;
              const tableName = batchTableNames[0];
              console.log(`[Clone] ${tableName} — not found in source, dropping from target`);
              updateProgress("ไม่มีในต้นทาง — กำลังลบจากปลายทาง...");
              const remoteStart = Date.now();
              try {
                const dropPool = new pg2.Pool({ connectionString: targetUrl, connectionTimeoutMillis: 30000 });
                try { await dropPool.query(`DROP TABLE IF EXISTS "${tableName}"`); } finally { await dropPool.end().catch(() => {}); }
              } catch {}
              const remoteDurationMs = Date.now() - remoteStart;
              try { await recordCloneHistory({ sessionId, cloneType, direction: direction || "us_to_th", tableName, rowCount: 0, hostDurationMs, remoteDurationMs, status: "dropped", errorMessage: "Not in source — dropped from target", batchIndex: 0, totalBatches: 1, startedAt: new Date(batchStart), completedAt: new Date(), createdBy: userId }); } catch {}
              if (!platformCloneProgress.completedTables) platformCloneProgress.completedTables = [];
              platformCloneProgress.completedTables.push({ tableName, status: "dropped", rowCount: 0, durationMs: hostDurationMs + remoteDurationMs });
              try { fs.unlinkSync(dumpFile); } catch {}
              completedTables++;
              continue;
            }

            const hostDurationMs2 = Date.now() - hostStart;
            console.log(`[Clone] ERROR dumping batch ${bi + 1} (${batchTableNames.join(", ")}):`, (dumpErr.message || "").slice(0, 200));
            for (const t of batchTableNames) {
              try { await recordCloneHistory({ sessionId, cloneType, direction: direction || "us_to_th", tableName: t, rowCount: rowCounts.get(t) || 0, hostDurationMs: hostDurationMs2, remoteDurationMs: 0, status: "error", errorMessage: `Batch dump failed: ${(dumpErr.message || "").slice(0, 300)}`, batchIndex: bi, totalBatches, startedAt: new Date(batchStart), completedAt: new Date(), createdBy: userId }); } catch {}
              if (!platformCloneProgress.completedTables) platformCloneProgress.completedTables = [];
              platformCloneProgress.completedTables.push({ tableName: t, status: "error", rowCount: rowCounts.get(t) || 0, durationMs: hostDurationMs2, errorMessage: "Dump failed" });
            }
            try { fs.unlinkSync(dumpFile); } catch {}
            completedTables += batchTableNames.length;
            continue;
          }

          const hostDurationMs = Date.now() - hostStart;
          let dumpFileSize = 0;
          try { dumpFileSize = fs.statSync(dumpFile).size; } catch {}
          const dumpSpeed = hostDurationMs > 0 ? Math.round(dumpFileSize / (hostDurationMs / 1000)) : 0;
          console.log(`[Clone] Dump batch ${bi + 1}: ${batchTableNames.length} tables, ${(dumpFileSize / 1024).toFixed(0)} KB in ${hostDurationMs}ms (${formatSpeed(dumpSpeed)}/s)`);

          updateProgress(`Restore → ปลายทาง (${batchTableNames.length} ตาราง, ${(dumpFileSize / 1024).toFixed(0)} KB)...`, {
            rowCount: batchRowCount, batchPhase: "restore", dumpFileSize, dumpSpeed,
          });

          const remoteStart = Date.now();
          let restoreSpeedTimer: ReturnType<typeof setInterval> | null = null;

          try {
            const restoreCmd = `psql "${targetUrl}" -v ON_ERROR_STOP=0 -c "SET session_replication_role = replica;" -f ${dumpFile}`;
            restoreSpeedTimer = setInterval(() => {
              const elapsedMs = Date.now() - remoteStart;
              const elapsedSec = Math.max(1, elapsedMs / 1000);
              const estimatedSpeed = Math.round(dumpFileSize / elapsedSec);
              updateProgress(`Restore → ปลายทาง (${(dumpFileSize / 1024).toFixed(0)} KB, ${formatSpeed(estimatedSpeed)}/s, ${Math.round(elapsedSec)}s)`, {
                rowCount: batchRowCount, batchPhase: "restore", dumpFileSize,
                transferSpeed: estimatedSpeed, transferredBytes: dumpFileSize,
                restoreElapsedSec: Math.round(elapsedSec),
              });
            }, 1000);
            await execAsync(restoreCmd, { timeout: timeoutSec * 1000, maxBuffer: 50 * 1024 * 1024 });
            if (restoreSpeedTimer) { clearInterval(restoreSpeedTimer); restoreSpeedTimer = null; }
            await execAsync(`psql "${targetUrl}" -c "SET session_replication_role = DEFAULT;"`, { timeout: 10000 }).catch(() => {});
          } catch (restoreErr: any) {
            if (restoreSpeedTimer) { clearInterval(restoreSpeedTimer); restoreSpeedTimer = null; }
            await execAsync(`psql "${targetUrl}" -c "SET session_replication_role = DEFAULT;"`, { timeout: 10000 }).catch(() => {});
            const remoteDurationMs = Date.now() - remoteStart;
            console.log(`[Clone] ERROR restoring batch ${bi + 1}:`, (restoreErr.message || "").slice(0, 200));
            for (const t of batchTableNames) {
              try { await recordCloneHistory({ sessionId, cloneType, direction: direction || "us_to_th", tableName: t, rowCount: rowCounts.get(t) || 0, hostDurationMs, remoteDurationMs, status: "error", errorMessage: `Batch restore failed: ${(restoreErr.message || "").slice(0, 300)}`, batchIndex: bi, totalBatches, startedAt: new Date(batchStart), completedAt: new Date(), createdBy: userId }); } catch {}
              if (!platformCloneProgress.completedTables) platformCloneProgress.completedTables = [];
              platformCloneProgress.completedTables.push({ tableName: t, status: "error", rowCount: rowCounts.get(t) || 0, durationMs: hostDurationMs + remoteDurationMs, errorMessage: "Restore failed" });
            }
            try { fs.unlinkSync(dumpFile); } catch {}
            completedTables += batchTableNames.length;
            continue;
          }

          const remoteDurationMs = Date.now() - remoteStart;
          try { fs.unlinkSync(dumpFile); } catch {}

          const restoreSpeed = remoteDurationMs > 0 ? Math.round(dumpFileSize / (remoteDurationMs / 1000)) : 0;
          const perTableDumpMs = Math.round(hostDurationMs / batchTableNames.length);
          const perTableRestoreMs = Math.round(remoteDurationMs / batchTableNames.length);
          const perTableDumpSize = Math.round(dumpFileSize / batchTableNames.length);

          const verifyPool = new pg2.Pool({ connectionString: targetUrl, max: 2, connectionTimeoutMillis: 30000 });
          const verifyResults = new Map<string, { targetCount: number; sourceCount: number; status: string }>();
          try {
            for (const t of batchTableNames) {
              const srcCount = rowCounts.get(t) || 0;
              try {
                const r = await verifyPool.query(`SELECT count(*)::int AS c FROM "${t}"`);
                const tgtCount = r.rows[0]?.c || 0;
                const status = (srcCount > 0 && tgtCount === 0) ? "data_lost" :
                  (srcCount > 0 && tgtCount < srcCount * 0.5) ? "partial" : "verified";
                verifyResults.set(t, { targetCount: tgtCount, sourceCount: srcCount, status });
                if (status !== "verified") {
                  console.log(`[Clone] ⚠ VERIFY ${t}: source=${srcCount} target=${tgtCount} → ${status}`);
                }
              } catch (verErr) {
                verifyResults.set(t, { targetCount: -1, sourceCount: srcCount, status: "verify_error" });
              }
            }
          } catch {} finally { await verifyPool.end().catch(() => {}); }

          for (const t of batchTableNames) {
            const tRows = rowCounts.get(t) || 0;
            const vr = verifyResults.get(t);
            const isDataLost = vr && (vr.status === "data_lost" || vr.status === "partial");
            const finalStatus = isDataLost ? "error" : "success";
            const errMsg = isDataLost ? `Restore silent failure: source=${vr!.sourceCount} target=${vr!.targetCount} (${vr!.status})` : undefined;
            try {
              await recordCloneHistory({
                sessionId, cloneType, direction: direction || "us_to_th", tableName: t, rowCount: tRows,
                hostDurationMs: isSingleTable ? hostDurationMs : perTableDumpMs,
                remoteDurationMs: isSingleTable ? remoteDurationMs : perTableRestoreMs,
                status: finalStatus, batchIndex: bi, totalBatches,
                startedAt: new Date(batchStart), completedAt: new Date(),
                createdBy: userId,
                dumpFileSize: isSingleTable ? dumpFileSize : perTableDumpSize,
                dumpSpeed, restoreSpeed,
                ...(errMsg ? { errorMessage: errMsg } : {}),
              });
            } catch (histErr) { console.log(`[Clone] WARN: could not record history for ${t}:`, histErr); }
            if (!platformCloneProgress.completedTables) platformCloneProgress.completedTables = [];
            platformCloneProgress.completedTables.push({
              tableName: t, status: finalStatus, rowCount: tRows,
              durationMs: isSingleTable ? hostDurationMs + remoteDurationMs : perTableDumpMs + perTableRestoreMs,
              dumpFileSize: isSingleTable ? dumpFileSize : perTableDumpSize, dumpSpeed, restoreSpeed,
              ...(isDataLost ? { errorMessage: errMsg, targetCount: vr!.targetCount } : {}),
            });
            if (isDataLost) {
              console.log(`[Clone] ❌ ${t}: DATA LOSS DETECTED — source=${vr!.sourceCount} target=${vr!.targetCount}`);
            }
          }
          completedTables += batchTableNames.length;
          console.log(`[Clone] ✓ Batch ${bi + 1} — ${batchTableNames.length} tables, ${batchRowCount} rows, ${(dumpFileSize / 1024).toFixed(0)} KB, dump ${formatSpeed(dumpSpeed)}/s (${hostDurationMs}ms), restore ${formatSpeed(restoreSpeed)}/s (${remoteDurationMs}ms)`);

        } catch (batchErr: any) {
          console.log(`[Clone] UNEXPECTED ERROR on batch ${bi + 1}:`, (batchErr as any).message?.slice(0, 300));
          for (const t of batchTableNames) {
            try {
              await execAsync(`psql "${targetUrl}" -c "DELETE FROM \\"${t}\\""`, { timeout: 30000 }).catch(() => {});
            } catch {}
            try { await recordCloneHistory({ sessionId, cloneType, direction: direction || "us_to_th", tableName: t, rowCount: 0, hostDurationMs: 0, remoteDurationMs: 0, status: "error", errorMessage: `Unexpected: ${((batchErr as any).message || "").slice(0, 300)}`, batchIndex: bi, totalBatches: 1, startedAt: new Date(batchStart), completedAt: new Date(), createdBy: userId }); } catch {}
            if (!platformCloneProgress.completedTables) platformCloneProgress.completedTables = [];
            platformCloneProgress.completedTables.push({ tableName: t, status: "error", rowCount: 0, durationMs: Date.now() - batchStart, errorMessage: "Unexpected error" });
          }
          try { fs.unlinkSync(dumpFile); } catch {}
          completedTables += batchTableNames.length;
          continue;
        }
      }

      try {
        const KEEP_PER_TABLE = 5;
        const allTables = await db.selectDistinct({ tableName: cloneHistory.tableName }).from(cloneHistory);
        let purgedTotal = 0;
        for (const { tableName: tn } of allTables) {
          const kept = await db.select({ id: cloneHistory.id })
            .from(cloneHistory)
            .where(and(eq(cloneHistory.tableName, tn), eq(cloneHistory.status, "success")))
            .orderBy(desc(cloneHistory.completedAt))
            .limit(KEEP_PER_TABLE);
          const keptIds = kept.map(r => r.id);
          if (keptIds.length === KEEP_PER_TABLE) {
            const oldRows = await db.delete(cloneHistory)
              .where(and(
                eq(cloneHistory.tableName, tn),
                eq(cloneHistory.status, "success"),
                notInArray(cloneHistory.id, keptIds)
              )).returning({ id: cloneHistory.id });
            purgedTotal += oldRows.length;
          }
        }
        if (purgedTotal > 0) console.log(`[Clone] Auto-purge: removed ${purgedTotal} old history records (kept last ${KEEP_PER_TABLE} per table)`);
      } catch (purgeErr: any) {
        console.log(`[Clone] WARN: auto-purge failed: ${purgeErr.message}`);
      }

      await setCloneInProgress(userId, false);
      await liftMaintenance(userName + " (clone auto-lift)");
      await destroyScheduleAfterClone();
      setCloneScreen(null);
      releaseCloneLock();
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      const dataLostTables = (platformCloneProgress.completedTables || []).filter((t: any) => t.status === "error" && t.errorMessage?.includes("silent failure"));
      if (dataLostTables.length > 0) {
        setPlatformCloneProgress({ status: "complete", percent: 100, step: `เสร็จ ${completedTables}/${totalTables} ตาราง (${durationSec}s) ⚠ ${dataLostTables.length} ตารางข้อมูลไม่ครบ!` });
        console.log(`[Clone] 100% COMPLETE with ${dataLostTables.length} DATA LOSS warnings — ${completedTables}/${totalTables} tables, ${durationSec}s`);
      } else {
        setPlatformCloneProgress({ status: "complete", percent: 100, step: `เสร็จสมบูรณ์! ${completedTables}/${totalTables} ตาราง (${durationSec}s)` });
        console.log(`[Clone] 100% COMPLETE — ${completedTables}/${totalTables} tables, ${durationSec}s`);
      }

    } catch (cloneErr: any) {
      const errMsg = cloneErr.message?.slice(0, 300) || "Clone failed";
      console.log("[Clone] ERROR:", errMsg);
      setPlatformCloneProgress({ status: "error", percent: 0, error: errMsg });
      try { await setCloneInProgress(userId, false); } catch {}
      try { await liftMaintenance(userName + " (clone error auto-lift)"); } catch {}
      setCloneScreen(null);
      releaseCloneLock();
      
      try {
        const { rescheduleForCloneFailure } = await import("./maintenance");
        await rescheduleForCloneFailure(userName, userId);
      } catch {}
    }
  } catch (err: any) {
    console.log("[Clone] FATAL:", err.message);
    setPlatformCloneProgress({ status: "error", percent: 0, error: err.message });
    try { await setCloneInProgress(userId, false); } catch {}
    try { await liftMaintenance(userName + " (clone fatal auto-lift)"); } catch {}
    setCloneScreen(null);
    releaseCloneLock();
    try {
      const { rescheduleForCloneFailure } = await import("./maintenance");
      await rescheduleForCloneFailure(userName, userId);
    } catch {}
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
});

app.get("/api/platform/export-db", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(400).json({ message: "DATABASE_URL not configured" });

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `etax_backup_${dateStr}.sql`;
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pg_dump = spawn("pg_dump", [dbUrl, "--no-owner", "--no-acl", "--clean", "--if-exists"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    pg_dump.stdout.pipe(res);

    pg_dump.stderr.on("data", (data: Buffer) => {
      console.warn("[export-db] pg_dump stderr:", data.toString().slice(0, 200));
    });

    pg_dump.on("error", (err: Error) => {
      if (!res.headersSent) {
        res.status(500).json({ message: "pg_dump failed: " + err.message });
      }
    });

    pg_dump.on("close", (code: number) => {
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ message: `pg_dump exited with code ${code}` });
      }
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
});

app.post("/api/platform/backup-database", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { lineUserId } = req.body;
    if (!lineUserId || typeof lineUserId !== "string" || lineUserId.trim().length === 0) {
      return res.status(400).json({ message: "กรุณาระบุ LINE User ID" });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!lineToken) {
      return res.status(400).json({ message: "ยังไม่ได้ตั้งค่า LINE Channel Access Token" });
    }

    const { execSync } = await import("child_process");
    const tmpDir = path.join(os.tmpdir(), "db-backup");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const sqlFile = path.join(tmpDir, `etax_backup_${timestamp}.sql`);
    const zipFile = path.join(tmpDir, `etax_backup_${timestamp}.zip`);

    const cleanup = () => {
      try { if (fs.existsSync(sqlFile)) fs.unlinkSync(sqlFile); } catch {}
      try { if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile); } catch {}
    };

    const otp = crypto.randomBytes(4).toString("hex").toUpperCase();

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(500).json({ message: "ไม่พบการตั้งค่าฐานข้อมูล" });

    try {
      execSync(`pg_dump "${dbUrl}" --no-owner --no-privileges -f "${sqlFile}"`, {
        timeout: 120000,
        stdio: "pipe",
      });

      const archiver = (await import("archiver")).default;
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipFile);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);
        archive.file(sqlFile, { name: path.basename(sqlFile) });
        archive.finalize();
      });

      if (fs.existsSync(sqlFile)) fs.unlinkSync(sqlFile);
    } catch (cmdErr: any) {
      cleanup();
      throw cmdErr;
    }

    const lineMessage = `🔐 รหัสผ่านสำรองข้อมูล\n\nรหัสผ่านสำหรับเปิดไฟล์สำรองข้อมูลระบบ E-Tax Center:\n\n📋 OTP: ${otp}\n\n⏰ สร้างเมื่อ: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\n⚠️ รหัสนี้ใช้ได้ครั้งเดียว กรุณาเก็บรักษาให้ดี`;

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: lineUserId.trim(),
        messages: [{ type: "text", text: lineMessage }],
      }),
    });

    if (!lineResponse.ok) {
      const errText = await lineResponse.text();
      cleanup();
      return res.status(400).json({ message: `ส่งรหัสผ่านทาง LINE ไม่สำเร็จ: ${errText}` });
    }

    const zipStream = fs.createReadStream(zipFile);
    const zipSize = fs.statSync(zipFile).size;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="etax_backup_${timestamp}.zip"`);
    res.setHeader("Content-Length", zipSize.toString());
    zipStream.pipe(res);
    zipStream.on("end", () => { try { fs.unlinkSync(zipFile); } catch {} });
    zipStream.on("error", () => { cleanup(); });
  } catch (err: any) {
    res.status(500).json({ message: `สำรองข้อมูลไม่สำเร็จ: ${err.message}` });
  }
});

// ========== Seed Routes ==========

app.post("/api/seed-platform", async (_req, res) => {
  try {
    const { hashPassword } = await import("./auth");

    const existingSuper = await storage.getUserByUsername("platform");
    if (existingSuper) {
      return res.json({ message: "Super Admin ถูกสร้างแล้ว" });
    }

    const password = await hashPassword("platform123");
    await storage.createUser({
      username: "platform",
      password,
      fullName: "เจ้าของแพลตฟอร์ม",
      role: "super_admin",
      email: "platform@etax.co.th",
      active: true,
      tenantId: null,
    });

    res.json({
      message: "สร้าง Super Admin เรียบร้อย",
      user: { username: "platform", password: "platform123" },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/seed", async (_req, res) => {
  try {
    const { hashPassword } = await import("./auth");

    const existingAdmin = await storage.getUserByUsername("admin");
    if (existingAdmin) {
      return res.json({ message: "ข้อมูลตัวอย่างถูกสร้างแล้ว" });
    }

    const adminPassword = await hashPassword("admin123");
    const admin = await storage.createUser({
      username: "admin",
      password: adminPassword,
      fullName: "ผู้ดูแลระบบ",
      role: "admin",
      email: "admin@etax.co.th",
      active: true,
    });

    await storage.createEmployee({
      userId: admin.id,
      employeeCode: "EMP001",
      fullName: "ผู้ดูแลระบบ",
      position: "Senior Accountant",
      department: "บัญชี",
      baseSalary: "35000",
      startDate: "2024-01-01",
      active: true,
    });

    const companiesData = [
      { name: "TechStart Innovations", industry: "Technology", taxId: "1234567890123", active: true },
      { name: "GreenEarth Logistics", industry: "Logistics", taxId: "9876543210123", active: true },
      { name: "Urban Retail Group", industry: "Retail", taxId: "5555666677778", active: true },
    ];
    for (const c of companiesData) {
      await storage.createCompany(c);
    }

    const firmClientsData = [
      { name: "บริษัท กาแฟไทย จำกัด", contactPerson: "คุณสมชาย", phone: "02-123-4567", invoiceCount: 1248, serviceFee: "15600", status: "synced", billingStatus: "paid" },
      { name: "ร้านอาหาร สบายดี", contactPerson: "คุณสมหญิง", phone: "02-234-5678", invoiceCount: 450, serviceFee: "5000", status: "pending_sync", billingStatus: "pending" },
      { name: "บจก. ไอที โซลูชั่น", contactPerson: "คุณวิชัย", phone: "02-345-6789", invoiceCount: 890, serviceFee: "12000", status: "synced", billingStatus: "paid" },
      { name: "หจก. ขนส่ง รวดเร็ว", contactPerson: "คุณประเสริฐ", phone: "02-456-7890", invoiceCount: 120, serviceFee: "3000", status: "pending_review", billingStatus: "pending" },
    ];
    for (const c of firmClientsData) {
      await storage.createFirmClient(c);
    }

    res.json({ message: "สร้างข้อมูลตัวอย่างเรียบร้อย", admin: { username: "admin", password: "admin123" } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/seed-demo", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { hashPassword } = await import("./auth");

    const existingDemo = await storage.getUserByUsername("demo_reviewer");
    if (existingDemo) {
      return res.json({ message: "Demo account already exists", credentials: { username: "demo_reviewer", password: "demo2026!" } });
    }

    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.name, "Demo E-Commerce Store")).limit(1);
    let tenantId: number;
    if (existingTenant) {
      tenantId = existingTenant.id;
    } else {
      const [newTenant] = await db.insert(tenants).values({
        name: "Demo E-Commerce Store",
        tenantType: "general_business",
        status: "active",
        contactName: "Demo Reviewer",
        contactEmail: "demo@etaxcenter.com",
      }).returning();
      tenantId = newTenant.id;
    }

    const demoPassword = await hashPassword("demo2026!");
    const demoUser = await storage.createUser({
      username: "demo_reviewer",
      password: demoPassword,
      fullName: "Platform Reviewer (Demo)",
      fullNameEn: "Platform Reviewer",
      role: "admin",
      email: "demo@etaxcenter.com",
      active: true,
      tenantId: tenantId,
    });

    const demoCompany = await storage.createCompany({
      name: "บริษัท เดโม่ อีคอมเมิร์ซ จำกัด",
      nameEn: "Demo E-Commerce Co., Ltd.",
      industry: "E-Commerce",
      taxId: "0105500000001",
      address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
      addressEn: "123 Sukhumvit Road, Klongtoey, Bangkok 10110",
      phone: "02-000-0000",
      email: "demo@etaxcenter.com",
      active: true,
      tenantType: "general_business",
      businessType: "mixed",
      baseCurrency: "THB",
      vatRegistered: true,
      tenantId: tenantId,
    });

    await storage.setCompanyPrimary(demoCompany.id);

    const platforms = [
      { platform: "shopee", shopName: "DemoShop-Shopee", shopId: "DEMO_SHOPEE_001", status: "connected" },
      { platform: "lazada", shopName: "DemoShop-Lazada", shopId: "DEMO_LAZADA_001", status: "connected" },
      { platform: "tiktok", shopName: "DemoShop-TikTok", shopId: "DEMO_TIKTOK_001", status: "connected" },
    ];
    const connectionIds: Record<string, number> = {};
    for (const p of platforms) {
      const [conn] = await ecomDb.insert(ecommerceConnections).values({
        companyId: demoCompany.id,
        platform: p.platform,
        shopName: p.shopName,
        shopId: p.shopId,
        status: p.status,
        lastSyncAt: new Date(),
      }).returning();
      connectionIds[p.platform] = conn.id;
    }

    const demoProducts = await Promise.all([
      storage.createProduct({ name: "เสื้อยืดคอกลม สีดำ", code: "SHIRT-BLK-001", price: "350", cost: "150", companyId: demoCompany.id, active: true, vatType: "vat7", productType: "simple" }),
      storage.createProduct({ name: "กางเกงขายาว สีกรม", code: "PANTS-NVY-001", price: "590", cost: "250", companyId: demoCompany.id, active: true, vatType: "vat7", productType: "simple" }),
      storage.createProduct({ name: "รองเท้าผ้าใบ สีขาว", code: "SHOE-WHT-001", price: "1290", cost: "550", companyId: demoCompany.id, active: true, vatType: "vat7", productType: "simple" }),
      storage.createProduct({ name: "กระเป๋าสะพาย หนัง PU", code: "BAG-PU-001", price: "890", cost: "380", companyId: demoCompany.id, active: true, vatType: "vat7", productType: "simple" }),
      storage.createProduct({ name: "หมวกแก๊ป โลโก้", code: "CAP-LOGO-001", price: "290", cost: "120", companyId: demoCompany.id, active: true, vatType: "vat7", productType: "simple" }),
    ]);

    const buyerNames = ["สมชาย ใจดี", "สมหญิง รักษ์ไทย", "วิชัย ศรีสุข", "พรทิพย์ สวัสดี", "อนุชา เจริญกิจ",
      "จิราพร มั่นคง", "ธนกร สุขใจ", "กมลวรรณ ดีเลิศ", "ศิริพร ภักดี", "ปิยะ สมบูรณ์"];
    const statuses = ["pending", "confirmed", "shipping", "delivered", "delivered", "delivered"];
    const carriers = ["Kerry Express", "Flash Express", "J&T Express", "Thailand Post", "DHL"];

    let orderCount = 0;
    for (const [platform, connId] of Object.entries(connectionIds)) {
      for (let i = 0; i < 15; i++) {
        const buyer = buyerNames[Math.floor(Math.random() * buyerNames.length)];
        const product = demoProducts[Math.floor(Math.random() * demoProducts.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        const price = Number(product.price);
        const subtotal = price * qty;
        const shipping = Math.floor(Math.random() * 80) + 20;
        const commission = Math.round(subtotal * 0.04);
        const total = subtotal + shipping;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const dayOffset = Math.floor(Math.random() * 30);
        const placedAt = new Date(Date.now() - dayOffset * 86400000);

        const [order] = await ecomDb.insert(ecommerceOrders).values({
          companyId: demoCompany.id,
          connectionId: connId,
          platform: platform,
          platformOrderId: `${platform.toUpperCase()}-DEMO-${String(orderCount + 1).padStart(6, "0")}`,
          orderNo: `ORD-${String(orderCount + 1).padStart(6, "0")}`,
          status: status,
          buyerName: buyer,
          buyerPhone: `08${Math.floor(Math.random() * 90000000 + 10000000)}`,
          buyerAddress: `${Math.floor(Math.random() * 999) + 1} ถ.สุขุมวิท กรุงเทพฯ`,
          subtotal: String(subtotal),
          shippingFee: String(shipping),
          totalAmount: String(total),
          commissionFee: String(commission),
          netIncome: String(total - commission - shipping),
          trackingNo: status === "shipping" || status === "delivered" ? `TH${Math.floor(Math.random() * 9000000000 + 1000000000)}` : null,
          shippingProvider: status === "shipping" || status === "delivered" ? carriers[Math.floor(Math.random() * carriers.length)] : null,
          paymentMethod: "online",
          currency: "THB",
          placedAt: placedAt,
          shippedAt: status === "shipping" || status === "delivered" ? new Date(placedAt.getTime() + 86400000) : null,
          deliveredAt: status === "delivered" ? new Date(placedAt.getTime() + 3 * 86400000) : null,
          settlementStatus: status === "delivered" ? "settled" : "pending",
        }).returning();

        await ecomDb.insert(ecommerceOrderItems).values({
          orderId: order.id,
          productId: product.id,
          platformSku: product.sku,
          name: product.name,
          qty: String(qty),
          price: String(price),
          total: String(subtotal),
        });
        orderCount++;
      }
    }

    // Seed extra demo data: customers, returns, settlements, tax invoices
    const { seedDemoExtraData } = await import("./seed-demo-extra");
    const extraStats = await seedDemoExtraData(demoCompany.id, demoUser.id, connectionIds, demoProducts);

    res.json({
      message: "Demo account created successfully — พร้อมบันทึกวิดีโอสาธิต",
      credentials: { username: "demo_reviewer", password: "demo2026!" },
      summary: {
        company: demoCompany.name,
        connections: Object.keys(connectionIds).length,
        orders: orderCount,
        products: demoProducts.length,
        ...extraStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/seed-general", async (_req, res) => {
  try {
    const { hashPassword } = await import("./auth");

    const existingUser = await storage.getUserByUsername("bizowner");
    if (existingUser) {
      return res.json({ message: "ข้อมูลบริษัททั่วไปถูกสร้างแล้ว" });
    }

    const password = await hashPassword("biz123");
    const bizUser = await storage.createUser({
      username: "bizowner",
      password: password,
      fullName: "เจ้าของกิจการ",
      role: "admin",
      email: "owner@mybiz.co.th",
      active: true,
    });

    const bizCompany = await storage.createCompany({
      name: "บริษัท ร้านค้าออนไลน์ จำกัด",
      industry: "E-Commerce",
      taxId: "1112223334445",
      active: true,
      tenantType: "general_business",
    });

    await storage.setCompanyPrimary(bizCompany.id);

    await storage.createEmployee({
      userId: bizUser.id,
      employeeCode: "BIZ001",
      fullName: "เจ้าของกิจการ",
      position: "เจ้าของ",
      department: "บริหาร",
      baseSalary: "50000",
      startDate: "2024-01-01",
      active: true,
    } as any);

    res.json({ 
      message: "สร้างข้อมูลบริษัททั่วไปเรียบร้อย (primary company ถูกเปลี่ยนเป็น general_business)", 
      user: { username: "bizowner", password: "biz123" },
      note: "คำเตือน: primary company ถูกเปลี่ยนเป็นบริษัททั่วไป — ผู้ใช้ทุกคนจะไม่เห็นเมนูจัดการลูกค้า หากต้องการกลับไปโหมดสำนักงานบัญชี ให้ตั้ง primary กลับไปที่บริษัทเดิม"
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/tenant-overview", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const currentUser = req.user as any;
    const isSuperAdmin = currentUser.role === "super_admin" || currentUser.role === "superadmin";

    const allTenants = isSuperAdmin
      ? await db.select().from(tenants).orderBy(tenants.id)
      : currentUser.tenantId
        ? await db.select().from(tenants).where(eq(tenants.id, currentUser.tenantId))
        : [];

    const allCompanies = isSuperAdmin
      ? await db.select().from(companies).orderBy(companies.id)
      : currentUser.tenantId
        ? await db.select().from(companies).where(eq(companies.tenantId, currentUser.tenantId))
        : [];

    const tenantIds = allTenants.map(t => t.id);
    const allUsers = tenantIds.length > 0
      ? await db.select({
          id: users.id, tenantId: users.tenantId, role: users.role,
          fullName: users.fullName, username: users.username,
          allowedCompanyIds: users.allowedCompanyIds,
        }).from(users).where(sql`${users.tenantId} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    const allSubs = tenantIds.length > 0
      ? await db.select({
          tenantId: tenantSubscriptions.tenantId,
          planId: tenantSubscriptions.planId,
          status: tenantSubscriptions.status,
          trialEndsAt: tenantSubscriptions.trialEndsAt,
        }).from(tenantSubscriptions).where(sql`${tenantSubscriptions.tenantId} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    const allPlans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.id);

    const companyIds = allCompanies.map(c => c.id);
    const firmClientCounts = companyIds.length > 0
      ? await db.select({
          companyId: firmClients.companyId,
          cnt: count(),
        }).from(firmClients)
        .where(sql`${firmClients.companyId} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`,`)})`)
        .groupBy(firmClients.companyId)
      : [];

    const firmMap = new Map(firmClientCounts.map(f => [f.companyId, Number(f.cnt)]));
    const planMap = new Map(allPlans.map(p => [p.id, p]));

    const result = allTenants.map(tenant => {
      const tCompanies = allCompanies.filter(c => c.tenantId === tenant.id);
      const tUsers = allUsers.filter(u => u.tenantId === tenant.id);
      const tSub = allSubs.find(s => s.tenantId === tenant.id);
      const plan = tSub ? planMap.get(tSub.planId) : null;

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          tenantType: tenant.tenantType,
          status: tenant.status,
          contactName: tenant.contactName,
          contactPhone: tenant.contactPhone,
          contactEmail: tenant.contactEmail,
        },
        subscription: tSub ? {
          status: tSub.status,
          planName: plan?.name || "ไม่ทราบ",
          planCode: plan?.code || null,
          trialEndsAt: tSub.trialEndsAt,
          enabledModules: plan?.enabledModules || [],
        } : null,
        companies: tCompanies.map(c => ({
          id: c.id,
          name: c.name,
          firmClientCount: firmMap.get(c.id) || 0,
        })),
        users: tUsers.map(u => ({
          id: u.id,
          fullName: u.fullName,
          username: u.username,
          role: u.role,
          companyAccess: u.allowedCompanyIds || [],
        })),
        stats: {
          companyCount: tCompanies.length,
          userCount: tUsers.length,
          adminCount: tUsers.filter(u => u.role === "admin" || u.role === "super_admin").length,
        },
      };
    });

    const securityAudit = {
      checkDocOwnershipCoverage: "130+ endpoints",
      companyIdFilterPattern: "All list endpoints filter by companyId",
      tenantIsolation: "tenantId checked in checkDocOwnership for cross-tenant access",
      allowedCompanyIds: "Non-admin roles restricted to specific companies via allowedCompanyIds",
      knownFixedIssues: [
        { endpoint: "GET /api/pos/staff", issue: "ข้อมูลพนักงาน POS ข้ามบริษัท (tenantId→companyId)", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "GET /api/ecommerce/orders/:id", issue: "ดูออเดอร์ข้ามบริษัทโดยไม่มี ownership check", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "POST /api/ecommerce/orders", issue: "สร้างออเดอร์ไม่เช็ค tenant/company", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "PATCH /api/ecommerce/orders/:id", issue: "แก้ไขออเดอร์ไม่เช็คเจ้าของ", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "GET /api/ecommerce/orders/:id/items", issue: "ดูรายการสินค้าออเดอร์ข้ามบริษัท", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "GET /api/attendance/:employeeId", issue: "ดูเวลาพนักงานข้ามบริษัท", status: "แก้ไขแล้ว", fixDate: "2026-04" },
        { endpoint: "GET /api/leaves/:employeeId", issue: "ดูลาพนักงานข้ามบริษัท", status: "แก้ไขแล้ว", fixDate: "2026-04" },
      ],
      recommendations: [
        "ตรวจสอบ allowedCompanyIds ทุกครั้งที่สร้าง endpoint ใหม่",
        "ใช้ checkDocOwnership() สำหรับ endpoint ที่ดึงข้อมูลด้วย ID",
        "List endpoint ต้อง filter ด้วย companyId เสมอ",
        "ใช้ @> operator สำหรับ array contains (allowedCompanyIds)",
      ],
    };

    res.json({ tenants: result, securityAudit, moduleList: (await import("@shared/permissions")).PERMISSION_MODULES.map(m => ({ key: m.key, label: m.label })) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== Machines (Server Registry) ==========

app.get("/api/platform/machines", requireSuperAdminOrSysAdmin, async (_req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const rows = await db.select().from(machinesTable).orderBy(machinesTable.id);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable, insertMachineSchema } = await import("@shared/schema");
    const parsed = insertMachineSchema.parse(req.body);
    if (!parsed.sysadminFolder || !parsed.sysadminFolder.trim()) {
      parsed.sysadminFolder = "srv-" + crypto.randomBytes(4).toString("hex");
    }
    const [row] = await db.insert(machinesTable).values(parsed).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/machines/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, code: _code, createdAt: _ca, ...updates } = req.body;
    if (!updates.sysadminFolder || !String(updates.sysadminFolder).trim()) {
      const [existing] = await db.select({ f: machinesTable.sysadminFolder }).from(machinesTable).where(eq(machinesTable.id, id));
      if (existing && (!existing.f || !existing.f.trim())) {
        updates.sysadminFolder = "srv-" + crypto.randomBytes(4).toString("hex");
      } else {
        delete updates.sysadminFolder;
      }
    }
    const [row] = await db.update(machinesTable).set({ ...updates, updatedAt: new Date() }).where(eq(machinesTable.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบเครื่องนี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/platform/machines/:id/nics", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { machineNics } = await import("@shared/schema");
    const machineId = Number(req.params.id);
    const rows = await db.select().from(machineNics).where(eq(machineNics.machineId, machineId)).orderBy(machineNics.nicName);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/:id/nics", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machineNics } = await import("@shared/schema");
    const machineId = Number(req.params.id);
    const { nicName, macAddress, ipAddress, subnetMask, forwardedFor, forwardedPort, routerId, notes } = req.body;
    if (!nicName || !ipAddress) return res.status(400).json({ message: "ต้องระบุชื่อ NIC และ IP Address" });
    const [row] = await db.insert(machineNics).values({
      machineId, nicName, macAddress: macAddress || null, ipAddress,
      subnetMask: subnetMask || "255.255.255.0",
      forwardedFor: forwardedFor || null, forwardedPort: forwardedPort || null,
      routerId: routerId ? Number(routerId) : null,
      notes: notes || null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/machine-nics/:nicId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machineNics } = await import("@shared/schema");
    const nicId = Number(req.params.nicId);
    const { id: _id, machineId: _mid, createdAt: _ca, ...updates } = req.body;
    const [row] = await db.update(machineNics).set(updates).where(eq(machineNics.id, nicId)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ NIC นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/machine-nics/:nicId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machineNics } = await import("@shared/schema");
    const nicId = Number(req.params.nicId);
    const [row] = await db.delete(machineNics).where(eq(machineNics.id, nicId)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ NIC นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/all-nics", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { machineNics } = await import("@shared/schema");
    const rows = await db.select().from(machineNics).orderBy(machineNics.machineId, machineNics.nicName);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/platform/machines/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [row] = await db.delete(machinesTable).where(eq(machinesTable.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบเครื่องนี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/:id/test-db", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, id));
    if (!machine) return res.status(404).json({ message: "ไม่พบเครื่องนี้" });

    const creds = resolveDbCredentials(machine);
    const port = creds.port;
    const dbName = creds.dbName;
    const dbUser = creds.dbUser;
    const dbPassword = creds.dbPassword;

    const isValidHost = (v: string | null | undefined): v is string => {
      if (!v || !v.trim()) return false;
      const lower = v.trim().toLowerCase();
      if (lower.includes("n/a") || lower === "dynamic" || lower === "-" || lower === "none") return false;
      return true;
    };

    const isPrivateIp = (ip: string): boolean => {
      return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(ip.trim());
    };

    const hasCredentials = !!(dbUser && dbPassword);
    const paths: { label: string; host: string }[] = [];
    const skippedPaths: { label: string; host: string; reason: string }[] = [];

    if (isValidHost(machine.lanIp)) {
      if (isPrivateIp(machine.lanIp)) {
        skippedPaths.push({ label: "LAN", host: machine.lanIp, reason: "Private IP — ทดสอบได้เฉพาะจากเครือข่ายเดียวกัน" });
      } else {
        paths.push({ label: "LAN", host: machine.lanIp });
      }
    }
    if (isValidHost(machine.wanIp)) paths.push({ label: "WAN IP", host: machine.wanIp });
    if (isValidHost(machine.fqdn)) paths.push({ label: "FQDN", host: machine.fqdn });
    if (isValidHost(machine.domainName) && machine.domainName !== machine.fqdn) paths.push({ label: "Domain", host: machine.domainName });

    if (paths.length === 0 && skippedPaths.length === 0) {
      return res.json({ paths: [], skipped: [], anyAlive: false, incomplete: true, error: "ไม่มี host (LAN IP / WAN IP / FQDN / Domain) — ข้อมูลเซิร์ฟเวอร์ไม่ครบ" });
    }

    if (!hasCredentials) {
      return res.json({ paths: [], skipped: skippedPaths, anyAlive: false, incomplete: true, error: "ไม่มี DB credentials (user/password) — ข้อมูลเซิร์ฟเวอร์ไม่ครบ" });
    }

    if (paths.length === 0) {
      return res.json({ paths: [], skipped: skippedPaths, anyAlive: false, incomplete: false, error: "มีเฉพาะ LAN IP — ทดสอบจากภายนอกไม่ได้" });
    }

    const { default: pg } = await import("pg");

    const testOne = async (p: { label: string; host: string }) => {
      const start = Date.now();
      const client = new pg.Client({
        host: p.host,
        port,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        connectionTimeoutMillis: 5000,
        query_timeout: 3000,
      });
      try {
        await client.connect();
        const result = await client.query("SELECT version()");
        const latency = Date.now() - start;
        const version = result.rows[0]?.version || "connected";
        await client.end();
        return { label: p.label, host: p.host, port, alive: true, latency, version };
      } catch (err: any) {
        const latency = Date.now() - start;
        try { await client.end(); } catch {}
        return { label: p.label, host: p.host, port, alive: false, latency, error: err.message };
      }
    };

    const results = await Promise.all(paths.map(testOne));
    const anyAlive = results.some(r => r.alive);
    res.json({ paths: results, skipped: skippedPaths, anyAlive, incomplete: false, machineName: machine.localName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/benchmark-all", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const allMachines = await db.select().from(machinesTable);
    const { default: pg } = await import("pg");

    const isValidHost = (v: string | null | undefined): v is string => {
      if (!v || !v.trim()) return false;
      const lower = v.trim().toLowerCase();
      return !(lower.includes("n/a") || lower === "dynamic" || lower === "-" || lower === "none");
    };
    const isPrivateIp = (ip: string) => /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(ip.trim());

    const testOne = async (host: string, port: number, dbName: string, dbUser: string, dbPassword: string) => {
      const start = Date.now();
      const client = new pg.Client({ host, port, database: dbName, user: dbUser, password: dbPassword, connectionTimeoutMillis: 5000, query_timeout: 3000 });
      try {
        await client.connect();
        const result = await client.query("SELECT version()");
        const latency = Date.now() - start;
        const version = result.rows[0]?.version || "connected";
        await client.end();
        return { alive: true, latency, version };
      } catch (err: any) {
        try { await client.end(); } catch {}
        return { alive: false, latency: Date.now() - start, error: err.message };
      }
    };

    const results: any[] = [];

    await Promise.all(allMachines.map(async (m) => {
      const creds = resolveDbCredentials(m);
      const port = creds.port;
      const dbName = creds.dbName;
      const dbUser = creds.dbUser;
      const dbPassword = creds.dbPassword;
      if (!dbUser || !dbPassword) {
        results.push({ machineId: m.id, machineName: m.localName, role: m.role, incomplete: true });
        return;
      }

      const paths: { label: string; host: string; skipped?: boolean; reason?: string }[] = [];
      if (isValidHost(m.lanIp)) {
        if (isPrivateIp(m.lanIp)) paths.push({ label: "LAN", host: m.lanIp, skipped: true, reason: "Private IP" });
        else paths.push({ label: "LAN", host: m.lanIp });
      }
      if (isValidHost(m.wanIp)) paths.push({ label: "WAN", host: m.wanIp });
      if (isValidHost(m.fqdn)) paths.push({ label: "FQDN", host: m.fqdn });
      if (isValidHost(m.domainName) && m.domainName !== m.fqdn) paths.push({ label: "Domain", host: m.domainName });

      const testablePaths = paths.filter(p => !p.skipped);
      const skippedPaths = paths.filter(p => p.skipped);

      if (testablePaths.length === 0) {
        results.push({ machineId: m.id, machineName: m.localName, role: m.role, incomplete: false, paths: [], skipped: skippedPaths, bestLatency: null });
        return;
      }

      const pathResults = await Promise.all(testablePaths.map(async (p) => {
        const r = await testOne(p.host, port, dbName, dbUser, dbPassword);
        return { label: p.label, host: p.host, port, ...r };
      }));

      const alivePaths = pathResults.filter(p => p.alive);
      const bestLatency = alivePaths.length > 0 ? Math.min(...alivePaths.map(p => p.latency)) : null;
      const bestPath = alivePaths.find(p => p.latency === bestLatency) || null;

      results.push({
        machineId: m.id,
        machineName: m.localName,
        role: m.role,
        incomplete: false,
        paths: pathResults,
        skipped: skippedPaths,
        bestLatency,
        bestPath: bestPath ? { label: bestPath.label, host: bestPath.host, latency: bestPath.latency, version: bestPath.version } : null,
      });
    }));

    results.sort((a, b) => {
      if (a.bestLatency === null && b.bestLatency === null) return 0;
      if (a.bestLatency === null) return 1;
      if (b.bestLatency === null) return -1;
      return a.bestLatency - b.bestLatency;
    });

    res.json({ results });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/:id/benchmark-query", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machines: machinesTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { rowCount = 10000 } = req.body;
    const safeRowCount = Math.min(Math.max(rowCount, 1000), 1000000);

    const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, id));
    if (!machine) return res.status(404).json({ message: "ไม่พบเครื่องนี้" });

    const host = machine.domainName || machine.fqdn || machine.wanIp || machine.lanIp;
    const creds = resolveDbCredentials(machine);
    const port = creds.port;
    const dbName = creds.dbName;
    const dbUser = creds.dbUser;
    const dbPassword = creds.dbPassword;

    if (!host || !dbUser || !dbPassword) {
      return res.json({ success: false, error: "ข้อมูล DB ไม่ครบ" });
    }

    const { default: pg } = await import("pg");
    const client = new pg.Client({ host, port, database: dbName, user: dbUser, password: dbPassword, connectionTimeoutMillis: 8000 });

    try {
      const t0 = Date.now();
      await client.connect();
      const connectTime = Date.now() - t0;

      const benchmarks: { name: string; duration: number; rows?: number }[] = [];
      const tableName = `_benchmark_${Date.now()}`;

      const t1 = Date.now();
      await client.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, val1 TEXT, val2 INTEGER, val3 NUMERIC(12,2), created_at TIMESTAMP DEFAULT NOW())`);
      benchmarks.push({ name: "CREATE TABLE", duration: Date.now() - t1 });

      const t2 = Date.now();
      const batchSize = 1000;
      for (let i = 0; i < safeRowCount; i += batchSize) {
        const count = Math.min(batchSize, safeRowCount - i);
        await client.query(`INSERT INTO ${tableName} (val1, val2, val3) SELECT md5(random()::text), (random()*1000000)::int, (random()*99999)::numeric(12,2) FROM generate_series(1, $1)`, [count]);
      }
      benchmarks.push({ name: `INSERT ${safeRowCount.toLocaleString()} rows`, duration: Date.now() - t2, rows: safeRowCount });

      const t3 = Date.now();
      const countResult = await client.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      benchmarks.push({ name: "SELECT COUNT(*)", duration: Date.now() - t3, rows: parseInt(countResult.rows[0].cnt) });

      const t4 = Date.now();
      await client.query(`SELECT val2, COUNT(*), AVG(val3), MAX(val3), MIN(val3) FROM ${tableName} GROUP BY val2 ORDER BY COUNT(*) DESC LIMIT 100`);
      benchmarks.push({ name: "GROUP BY + AGG + ORDER", duration: Date.now() - t4 });

      const t5 = Date.now();
      await client.query(`SELECT a.id, a.val1, b.val3 FROM ${tableName} a JOIN ${tableName} b ON a.val2 = b.val2 LIMIT 1000`);
      benchmarks.push({ name: "SELF JOIN (LIMIT 1000)", duration: Date.now() - t5 });

      const t6 = Date.now();
      await client.query(`SELECT val1, val3 FROM ${tableName} WHERE val2 BETWEEN 100000 AND 200000 ORDER BY val3 DESC LIMIT 500`);
      benchmarks.push({ name: "RANGE FILTER + SORT", duration: Date.now() - t6 });

      const t7 = Date.now();
      await client.query(`DROP TABLE IF EXISTS ${tableName}`);
      benchmarks.push({ name: "DROP TABLE", duration: Date.now() - t7 });

      const totalTime = Date.now() - t0;
      await client.end();

      res.json({
        success: true,
        host,
        port,
        connectTime,
        totalTime,
        rowCount: safeRowCount,
        benchmarks,
        version: (await (async () => { const c2 = new pg.Client({ host, port, database: dbName, user: dbUser, password: dbPassword, connectionTimeoutMillis: 3000 }); try { await c2.connect(); const r = await c2.query("SELECT version()"); await c2.end(); return r.rows[0]?.version?.match(/PostgreSQL [\d.]+/)?.[0] || ""; } catch { return ""; } })()),
      });
    } catch (benchErr: any) {
      try { await client.query(`DROP TABLE IF EXISTS _benchmark_${Date.now()}`); } catch {}
      try { await client.end(); } catch {}
      res.json({ success: false, error: benchErr.message });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/generate-config", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { hostname, macAddress, configDbPort, configDbName, machineId, mainDbHost, mainDbPort, mainDbName, mainDbUser, mainDbPassword } = req.body;
    if (!hostname || !macAddress) {
      return res.status(400).json({ message: "ต้องระบุ hostname และ MAC address" });
    }
    const { generateConfigDbCredentials, generateFullEncContent } = await import("../utils/machine-crypto");
    const creds = generateConfigDbCredentials();
    const encPort = configDbPort || "5432";

    const configDb = {
      host: "127.0.0.1",
      port: encPort,
      database: configDbName || "etax_config",
      user: creds.username,
      password: creds.password,
    };

    let mainDb: { host: string; port: string; database: string; user: string; password: string } | undefined;

    if (machineId) {
      const { machines: machinesTable } = await import("@shared/schema");
      const [existingMachine] = await db.select().from(machinesTable).where(eq(machinesTable.id, Number(machineId)));

      if (mainDbUser && mainDbPassword && mainDbName) {
        mainDb = {
          host: mainDbHost || "127.0.0.1",
          port: mainDbPort || existingMachine?.dbPort || "5432",
          database: mainDbName,
          user: mainDbUser,
          password: mainDbPassword,
        };
      } else if (existingMachine?.dbUser && existingMachine?.dbPassword && existingMachine?.dbName) {
        mainDb = {
          host: mainDbHost || "127.0.0.1",
          port: existingMachine.dbPort || "5432",
          database: existingMachine.dbName,
          user: existingMachine.dbUser,
          password: existingMachine.dbPassword,
        };
      }
    }

    const { encryptedContent, keyPreview } = generateFullEncContent(
      hostname, macAddress, encPort, configDb, mainDb
    );

    if (machineId) {
      const { machines: machinesTable } = await import("@shared/schema");
      await db.update(machinesTable).set({
        encHostname: hostname.trim(),
        encMacAddress: macAddress.trim(),
        encConfigDbPort: encPort,
        encConfigDbName: configDbName || "etax_config",
        encConfigDbUser: creds.username,
        encConfigDbPassword: creds.password,
        encContent: encryptedContent,
        encGeneratedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(machinesTable.id, Number(machineId)));
    }

    res.json({
      configDbUser: creds.username,
      configDbPassword: creds.password,
      encryptedContent,
      keyPreview,
      hostname: hostname.trim(),
      macAddress: macAddress.trim(),
      hasMainDb: !!mainDb,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/machines/test-decrypt", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { hostname, macAddress, dbPort, encryptedContent } = req.body;
    if (!hostname || !macAddress || !dbPort || !encryptedContent) {
      return res.status(400).json({ message: "ต้องระบุ hostname, MAC address, DB port และ encrypted content" });
    }
    const { deriveKey, decrypt } = await import("../utils/machine-crypto");
    const key = deriveKey(hostname, macAddress, dbPort);
    const decrypted = decrypt(encryptedContent, key);
    const config = JSON.parse(decrypted);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(400).json({ success: false, message: "Decrypt ไม่สำเร็จ — hostname, MAC address หรือ port ไม่ตรงกัน" });
  }
});

app.get("/api/platform/db-health-events", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { getConfigDbUrl } = await import("../config-bootstrap");
    const configUrl = getConfigDbUrl();
    if (!configUrl) return res.json({ available: false, events: [], message: "Config DB not configured" });

    const pg = await import("pg");
    const checkPool = new pg.default.Pool({ connectionString: configUrl, max: 1, connectionTimeoutMillis: 3000 });
    try {
      const tableCheck = await checkPool.query("SELECT to_regclass('public.db_health_events') AS tbl");
      if (!tableCheck.rows[0]?.tbl) {
        await checkPool.end();
        return res.json({ available: false, events: [], message: "db_health_events table not found" });
      }
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const result = await checkPool.query(
        "SELECT id, event_type, event_time, consecutive_failures, cumulative_failures, down_seconds, recovery_method, error_message, database_label, notes FROM db_health_events ORDER BY event_time DESC LIMIT $1",
        [limit]
      );
      await checkPool.end();
      res.json({ available: true, events: result.rows });
    } catch (err: any) {
      await checkPool.end().catch(() => {});
      res.json({ available: false, events: [], message: err.message });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/clone-history-target", requireSuperAdminOrSysAdmin, async (_req, res) => {
  try {
    const { getTargetMachineInfo } = await import("../services/clone-history-central");
    const info = getTargetMachineInfo();
    res.json(info || { machineId: 0, machineName: null, consecutiveFailDays: 0, lastCheckDate: null });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch("/api/platform/clone-history-target", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { machineId } = req.body;
    if (!machineId || typeof machineId !== "number") {
      return res.status(400).json({ message: "กรุณาระบุ machineId" });
    }
    const { machines: machinesTable } = await import("@shared/schema");
    const target = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
    if (target.length === 0) return res.status(404).json({ message: "ไม่พบเซิร์ฟเวอร์ที่เลือก" });

    const m = target[0];
    if (m.serverType === "app") {
      return res.status(400).json({ message: "ไม่สามารถเลือก App Server ได้ — ต้องเป็นเซิร์ฟเวอร์ที่มี Database" });
    }

    const { setTargetMachine } = await import("../services/clone-history-central");
    await setTargetMachine(machineId, m.localName);
    res.json({ success: true, machineId, machineName: m.localName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/routers", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { routers: routersTable } = await import("@shared/schema");
    const rows = await db.select().from(routersTable).orderBy(routersTable.name);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/routers", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routers: routersTable } = await import("@shared/schema");
    const [row] = await db.insert(routersTable).values(req.body).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/routers/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routers: routersTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, createdAt: _ca, ...updates } = req.body;
    const [row] = await db.update(routersTable).set({ ...updates, updatedAt: new Date() }).where(eq(routersTable.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Router นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/routers/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routers: routersTable } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [row] = await db.delete(routersTable).where(eq(routersTable.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Router นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/routers/:id/domains", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { routerDomains } = await import("@shared/schema");
    const routerId = Number(req.params.id);
    const rows = await db.select().from(routerDomains).where(eq(routerDomains.routerId, routerId)).orderBy(routerDomains.domainName);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/routers/:id/domains", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerDomains } = await import("@shared/schema");
    const routerId = Number(req.params.id);
    const { domainName, noipManageUrl, noipUsername, noipPassword, notes } = req.body;
    if (!domainName) return res.status(400).json({ message: "ต้องระบุ Domain Name" });
    const [row] = await db.insert(routerDomains).values({
      routerId, domainName, noipManageUrl: noipManageUrl || null,
      noipUsername: noipUsername || null, noipPassword: noipPassword || null,
      notes: notes || null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/router-domains/:domainId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerDomains } = await import("@shared/schema");
    const domainId = Number(req.params.domainId);
    const { id: _id, routerId: _rid, createdAt: _ca, ...updates } = req.body;
    const [row] = await db.update(routerDomains).set(updates).where(eq(routerDomains.id, domainId)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Domain นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/router-domains/:domainId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerDomains } = await import("@shared/schema");
    const domainId = Number(req.params.domainId);
    const [row] = await db.delete(routerDomains).where(eq(routerDomains.id, domainId)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Domain นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/all-router-domains", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerDomains } = await import("@shared/schema");
    const rows = await db.select().from(routerDomains).orderBy(routerDomains.routerId, routerDomains.domainName);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/domains", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { platformDomains } = await import("@shared/schema");
    const rows = await db.select().from(platformDomains).orderBy(platformDomains.domainName);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/domains", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformDomains } = await import("@shared/schema");
    const { domainName, provider, manageUrl, username, password, routerId, isRouterManaged, machineId, purpose, port, notes } = req.body;
    if (!domainName) return res.status(400).json({ message: "ต้องระบุ Domain Name" });
    if (isRouterManaged && routerId) {
      await db.update(platformDomains).set({ isRouterManaged: false }).where(
        sql`${platformDomains.routerId} = ${routerId} AND ${platformDomains.isRouterManaged} = true`
      );
    }
    const [row] = await db.insert(platformDomains).values({
      domainName, provider: provider || "noip", manageUrl: manageUrl || null,
      username: username || null, password: password || null,
      routerId: routerId || null, isRouterManaged: isRouterManaged || false,
      machineId: machineId || null, purpose: purpose || null,
      port: port || null, notes: notes || null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/domains/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformDomains } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, createdAt: _ca, ...updates } = req.body;
    if (updates.isRouterManaged && updates.routerId) {
      await db.update(platformDomains).set({ isRouterManaged: false }).where(
        sql`${platformDomains.routerId} = ${updates.routerId} AND ${platformDomains.isRouterManaged} = true AND ${platformDomains.id} != ${id}`
      );
    }
    const [row] = await db.update(platformDomains).set({ ...updates, updatedAt: new Date() }).where(eq(platformDomains.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Domain นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/domains/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformDomains } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [row] = await db.delete(platformDomains).where(eq(platformDomains.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Domain นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/nics/:nicId/ips", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nicIpAddresses } = await import("@shared/schema");
    const nicId = Number(req.params.nicId);
    const rows = await db.select().from(nicIpAddresses).where(eq(nicIpAddresses.nicId, nicId)).orderBy(nicIpAddresses.id);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/all-nic-ips", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { nicIpAddresses } = await import("@shared/schema");
    const rows = await db.select().from(nicIpAddresses).orderBy(nicIpAddresses.nicId, nicIpAddresses.id);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

function isValidIPv4Server(ip: string): boolean {
  if (typeof ip !== "string") return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return false;
  return m.slice(1).every(p => { const n = Number(p); return n >= 0 && n <= 255; });
}

app.post("/api/platform/nics/:nicId/ips", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nicIpAddresses } = await import("@shared/schema");
    const nicId = Number(req.params.nicId);
    const { ipAddress, subnetMask, label, isPrimary } = req.body;
    if (!ipAddress) return res.status(400).json({ message: "ต้องระบุ IP Address" });
    if (!isValidIPv4Server(ipAddress)) return res.status(400).json({ message: `IP Address "${ipAddress}" ไม่ใช่รูปแบบ IPv4 ที่ถูกต้อง` });
    const finalMask = subnetMask || "255.255.255.0";
    if (!isValidIPv4Server(finalMask)) return res.status(400).json({ message: `Subnet Mask "${finalMask}" ไม่ถูกต้อง` });
    if (isPrimary) {
      await db.update(nicIpAddresses).set({ isPrimary: false }).where(
        sql`${nicIpAddresses.nicId} = ${nicId} AND ${nicIpAddresses.isPrimary} = true`
      );
    }
    const [row] = await db.insert(nicIpAddresses).values({
      nicId, ipAddress, subnetMask: subnetMask || "255.255.255.0",
      label: label || null, isPrimary: isPrimary || false,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/nic-ips/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nicIpAddresses } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, createdAt: _ca, ...updates } = req.body;
    if (updates.ipAddress !== undefined && !isValidIPv4Server(updates.ipAddress)) return res.status(400).json({ message: `IP Address "${updates.ipAddress}" ไม่ถูกต้อง` });
    if (updates.subnetMask !== undefined && !isValidIPv4Server(updates.subnetMask)) return res.status(400).json({ message: `Subnet Mask "${updates.subnetMask}" ไม่ถูกต้อง` });
    if (updates.isPrimary) {
      const existing = await db.select().from(nicIpAddresses).where(eq(nicIpAddresses.id, id));
      if (existing.length > 0) {
        await db.update(nicIpAddresses).set({ isPrimary: false }).where(
          sql`${nicIpAddresses.nicId} = ${existing[0].nicId} AND ${nicIpAddresses.isPrimary} = true AND ${nicIpAddresses.id} != ${id}`
        );
      }
    }
    const [row] = await db.update(nicIpAddresses).set(updates).where(eq(nicIpAddresses.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ IP นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/nic-ips/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nicIpAddresses } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [row] = await db.delete(nicIpAddresses).where(eq(nicIpAddresses.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ IP นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/locations", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { platformLocations } = await import("@shared/schema");
    const rows = await db.select().from(platformLocations).orderBy(platformLocations.locationType, platformLocations.name);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/locations", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformLocations } = await import("@shared/schema");
    const { name, locationType, parentId, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: "ต้องระบุชื่อ Location" });
    const [row] = await db.insert(platformLocations).values({
      name, locationType: locationType || "company",
      parentId: parentId || null,
      address: address || null, notes: notes || null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/locations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformLocations } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...updates } = req.body;
    updates.updatedAt = new Date();
    const [row] = await db.update(platformLocations).set(updates).where(eq(platformLocations.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Location นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/locations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { platformLocations } = await import("@shared/schema");
    const { routers } = await import("@shared/schema");
    const { machines } = await import("@shared/schema");
    const id = Number(req.params.id);
    await db.update(routers).set({ locationId: null }).where(eq(routers.locationId, id));
    await db.update(machines).set({ locationId: null }).where(eq(machines.locationId, id));
    const children = await db.select().from(platformLocations).where(eq(platformLocations.parentId, id));
    for (const child of children) {
      await db.update(platformLocations).set({ parentId: null }).where(eq(platformLocations.id, child.id));
    }
    const [row] = await db.delete(platformLocations).where(eq(platformLocations.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Location นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/all-port-forwards", requireSuperAdminOrSysAdmin, async (req, res) => {
  try {
    const { routerPortForwards } = await import("@shared/schema");
    const rows = await db.select().from(routerPortForwards).orderBy(routerPortForwards.routerId, routerPortForwards.externalPort);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/routers/:routerId/port-forwards", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerPortForwards } = await import("@shared/schema");
    const routerId = Number(req.params.routerId);
    const { externalPort, lanIp, internalPort, protocol, purpose, notes } = req.body;
    if (!externalPort || !lanIp) return res.status(400).json({ message: "ต้องระบุ External Port และ LAN IP" });
    const [row] = await db.insert(routerPortForwards).values({
      routerId, externalPort, lanIp,
      internalPort: internalPort || null,
      protocol: protocol || "TCP",
      purpose: purpose || null,
      notes: notes || null,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/platform/port-forwards/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerPortForwards } = await import("@shared/schema");
    const id = Number(req.params.id);
    const { id: _id, routerId: _rid, createdAt: _ca, ...updates } = req.body;
    const [row] = await db.update(routerPortForwards).set(updates).where(eq(routerPortForwards.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Port Forward นี้" });
    res.json(row);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/platform/port-forwards/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { routerPortForwards } = await import("@shared/schema");
    const id = Number(req.params.id);
    const [row] = await db.delete(routerPortForwards).where(eq(routerPortForwards.id, id)).returning();
    if (!row) return res.status(404).json({ message: "ไม่พบ Port Forward นี้" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/platform/server-identity", requireSuperAdminOrSysAdmin, async (_req, res) => {
  try {
    const machineName = process.env.MACHINE_NAME || os.hostname();
    const nets = os.networkInterfaces();
    const localIps: { iface: string; ip: string; mac: string; family: string; internal: boolean }[] = [];
    for (const [name, ifaces] of Object.entries(nets)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.family === "IPv4") {
          localIps.push({ iface: name, ip: iface.address, mac: iface.mac, family: iface.family, internal: iface.internal });
        }
      }
    }

    const { machines: machinesTable, machineNics, nicIpAddresses } = await import("@shared/schema");
    const allMachines = await db.select().from(machinesTable);
    let matchedMachine: any = null;
    let matchMethod = "";

    // 1. MACHINE_NAME env var → match encHostname / localName / windowsName
    if (process.env.MACHINE_NAME) {
      matchedMachine = allMachines.find(m =>
        m.encHostname === process.env.MACHINE_NAME ||
        m.localName === process.env.MACHINE_NAME ||
        m.windowsName === process.env.MACHINE_NAME
      );
      if (matchedMachine) matchMethod = "MACHINE_NAME env";
    }

    // 2. os.hostname() → match windowsName / localName
    if (!matchedMachine) {
      const hn = os.hostname();
      matchedMachine = allMachines.find(m =>
        m.windowsName === hn || m.localName === hn
      );
      if (matchedMachine) matchMethod = "os.hostname()";
    }

    // 3. Replit environment → find machine with os='cloud' and role='dev_source'
    if (!matchedMachine && (process.env.REPL_ID || process.env.REPL_SLUG)) {
      matchedMachine = allMachines.find(m => m.os === "cloud" && m.role === "dev_source");
      if (matchedMachine) matchMethod = "Replit env (REPL_ID)";
    }

    // 4. NIC IP matching → machine_nics table
    if (!matchedMachine) {
      const externalIps = localIps.filter(i => !i.internal).map(i => i.ip);
      if (externalIps.length > 0) {
        const allNics = await db.select().from(machineNics);
        const allNicIps = await db.select().from(nicIpAddresses);
        for (const nic of allNics) {
          const nicIps = [nic.ipAddress, ...allNicIps.filter(ip => ip.nicId === nic.id).map(ip => ip.ipAddress)];
          if (nicIps.some(ip => externalIps.includes(ip))) {
            matchedMachine = allMachines.find(m => m.id === nic.machineId);
            if (matchedMachine) { matchMethod = "NIC IP match"; break; }
          }
        }
      }
    }

    // 5. machines.lanIp direct match
    if (!matchedMachine) {
      const externalIps = localIps.filter(i => !i.internal).map(i => i.ip);
      matchedMachine = allMachines.find(m => m.lanIp && externalIps.includes(m.lanIp));
      if (matchedMachine) matchMethod = "machines.lanIp match";
    }

    res.json({
      machineName,
      hostname: os.hostname(),
      localIps,
      matchedMachineId: matchedMachine?.id || null,
      matchedMachineName: matchedMachine?.localName || null,
      matchMethod: matchMethod || null,
      isCloud: !!(process.env.REPL_ID || process.env.REPL_SLUG),
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/platform/verify-infra-password", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    const secret = process.env.INFRA_MASTER_PASSWORD || "deep-sysadmin-2024";
    if (password === secret) {
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
