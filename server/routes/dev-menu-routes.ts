import type { Express, Request, Response } from "express";
import { db, pool, activeDbInfo, hotSwapDatabase } from "../db";
import { eq, or, isNull, count, sum , sql } from "drizzle-orm";
import { taxInvoices, taxInvoiceItems, ftpArchiveItems, invoices, receipts, quotations, salesOrders, companies, expenses, expenseItems, accounts, contacts, products } from "@shared/schema";
import { requireAuth, requireAdmin, requireModule, requireSuperAdmin } from "../route-middleware";
import { getNextDocNo } from "../route-helpers";
import path from "path";
import fs from "fs";
import os from "os";
import OpenAI from "openai";
import { getConfig } from "../config-bootstrap";

export function registerDevMenuRoutes(app: Express) {
// ==================== Developer Menu (dev mode only) ====================
if (process.env.NODE_ENV !== "production") {
  let _testDbCache: { online: boolean; checkedAt: number; checking: boolean } = { online: false, checkedAt: 0, checking: false };
  const TEST_DB_CACHE_TTL = 600_000;
  let _mainDbCache: { dbName: string; dbHost: string; checkedAt: number } = { dbName: "", dbHost: "", checkedAt: 0 };
  const MAIN_DB_CACHE_TTL = 600_000;

  app.post("/api/dev/ftp-archive-test", async (_req, res) => {
    try {
      const { saveBufferToPath } = await import("../replit_integrations/object_storage/routes");
      const results: string[] = [];

      const testFiles = [
        { key: '.private/test-archive/test-doc-001.pdf', content: 'FTP Archive Test #1 ' + 'A'.repeat(500) },
        { key: '.private/test-archive/test-doc-002.pdf', content: 'FTP Archive Test #2 ' + 'B'.repeat(800) },
        { key: '.private/test-archive/test-doc-003.pdf', content: 'FTP Archive Test #3 ' + 'C'.repeat(300) },
      ];

      for (const f of testFiles) {
        saveBufferToPath(Buffer.from(f.content), f.key);
        results.push(`Uploaded ${f.key} (${f.content.length} bytes)`);
      }

      const tivs = await db.select().from(taxInvoices)
        .where(or(isNull(taxInvoices.attachedUrl), eq(taxInvoices.attachedUrl, '')))
        .limit(3);

      if (tivs.length < 3) {
        return res.json({ success: false, message: `Need 3 TIVs without attachments, found ${tivs.length}`, results });
      }

      for (let i = 0; i < 3; i++) {
        await db.update(taxInvoices)
          .set({ attachedUrl: testFiles[i].key })
          .where(eq(taxInvoices.id, tivs[i].id));
        results.push(`Set TIV #${tivs[i].id} attached_url = ${testFiles[i].key}`);
      }

      results.push('--- Running archive job ---');
      const { runArchiveJob, updateArchivedLinks } = await import("./services/ftp-archive");
      const archiveResult = await runArchiveJob();
      results.push(`Archive: ${JSON.stringify(archiveResult)}`);

      if (archiveResult.success) {
        const linksUpdated = await updateArchivedLinks();
        results.push(`Links updated: ${linksUpdated}`);
      }

      const verifyTivs = await db.select().from(taxInvoices)
        .where(or(...tivs.map(t => eq(taxInvoices.id, t.id))));
      for (const t of verifyTivs) {
        results.push(`TIV #${t.id} attached_url NOW = ${t.attachedUrl || 'null'}`);
      }

      res.json({ success: true, results });
    } catch (err: any) { res.status(500).json({ message: err.message, stack: err.stack?.slice(0, 500) }); }
  });

  app.post("/api/dev/ftp-archive-revert-test", async (_req, res) => {
    try {
      const { revertArchivedFiles } = await import("./services/ftp-archive");
      const result = await revertArchivedFiles();

      const { ftpArchiveItems: faiTable } = await import("@shared/schema");
      const checkItems = await db.select().from(faiTable).limit(10);
      const tivs = await db.select().from(taxInvoices)
        .where(sql`attached_url LIKE '.private/test-archive%' OR attached_url LIKE 'http%'`)
        .limit(10);

      res.json({
        revertResult: result,
        remainingItems: checkItems.length,
        tivsWithTestUrls: tivs.map(t => ({ id: t.id, url: t.attachedUrl })),
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  // ═══════════════════════════════════════════════════════
  // Sync from Production (dev only)
  // ═══════════════════════════════════════════════════════
  interface SyncProgressState {
    status: "idle" | "running" | "complete" | "error";
    currentTable: string;
    tables: Array<{ table: string; devCount: number; prodCount: number; newRows: number; status: string; error?: string }>;
    error?: string;
    startedAt?: number;
  }
  let prodSyncProgress: SyncProgressState = { status: "idle", currentTable: "", tables: [] };

  app.get("/api/dev/sync-progress", (_req, res) => {
    res.json(prodSyncProgress);
  });

  app.get("/api/dev/sync-compare", requireAuth, async (_req, res) => {
    const prodUrl = process.env.PRODUCTION_APP_URL;
    const syncKey = process.env.SYNC_API_KEY;
    if (!prodUrl || !syncKey) {
      return res.status(400).json({
        message: "ต้องตั้งค่า PRODUCTION_APP_URL และ SYNC_API_KEY ก่อน",
        configured: false,
      });
    }
    try {
      const prodRes = await fetch(`${prodUrl}/api/platform/sync-tables?key=${encodeURIComponent(syncKey)}`);
      if (!prodRes.ok) {
        return res.status(502).json({ message: `Production API error: ${prodRes.status}` });
      }
      const prodData = await prodRes.json() as { tables: Record<string, { count: number; maxId: number }> };

      const comparison: Array<{
        table: string;
        devCount: number; devMaxId: number;
        prodCount: number; prodMaxId: number;
        diff: number;
      }> = [];

      for (const t of SYNCABLE_TABLES) {
        try {
          const devR = await db.execute(sql.raw(`SELECT COUNT(*) as cnt, COALESCE(MAX(id), 0) as max_id FROM "${t}"`));
          const devRow = (devR as any).rows?.[0] || (devR as any)[0];
          const devCount = Number(devRow?.cnt || 0);
          const devMaxId = Number(devRow?.max_id || 0);
          const prod = prodData.tables[t] || { count: 0, maxId: 0 };
          comparison.push({
            table: t,
            devCount, devMaxId,
            prodCount: prod.count, prodMaxId: prod.maxId,
            diff: prod.count - devCount,
          });
        } catch {
          comparison.push({ table: t, devCount: -1, devMaxId: -1, prodCount: -1, prodMaxId: -1, diff: 0 });
        }
      }

      res.json({ configured: true, comparison });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/dev/sync-from-prod", requireAuth, requireAdmin, async (req, res) => {
    if (prodSyncProgress.status === "running") {
      return res.status(409).json({ message: "Sync กำลังทำงานอยู่แล้ว" });
    }
    const prodUrl = process.env.PRODUCTION_APP_URL;
    const syncKey = process.env.SYNC_API_KEY;
    if (!prodUrl || !syncKey) {
      return res.status(400).json({ message: "ต้องตั้งค่า PRODUCTION_APP_URL และ SYNC_API_KEY" });
    }

    const tablesToSync = (req.body.tables as string[]) || SYNCABLE_TABLES;
    const validTables = tablesToSync.filter(t => SYNCABLE_TABLES.includes(t));

    prodSyncProgress = { status: "running", currentTable: "", tables: [], startedAt: Date.now() };
    res.json({ message: "เริ่ม Sync แล้ว", tables: validTables });

    (async () => {
      try {
        for (const tableName of validTables) {
          prodSyncProgress.currentTable = tableName;
          try {
            const devR = await db.execute(sql.raw(`SELECT COUNT(*) as cnt, COALESCE(MAX(id),0) as max_id FROM "${tableName}"`));
            const devRow = (devR as any).rows?.[0] || (devR as any)[0];
            const devMaxId = Number(devRow?.max_id || 0);
            const devCount = Number(devRow?.cnt || 0);

            let totalInserted = 0;
            let afterId = devMaxId;
            let hasMore = true;

            while (hasMore) {
              const url = `${prodUrl}/api/platform/sync-export?key=${encodeURIComponent(syncKey)}&table=${tableName}&after_id=${afterId}&limit=2000`;
              const prodRes = await fetch(url);
              if (!prodRes.ok) throw new Error(`Production API: ${prodRes.status}`);
              const data = await prodRes.json() as { rows: any[]; total: number; fetched: number };

              if (data.rows.length === 0) {
                hasMore = false;
                break;
              }

              for (const row of data.rows) {
                const columns = Object.keys(row);
                const values = columns.map(c => {
                  const v = row[c];
                  if (v === null || v === undefined) return "NULL";
                  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
                  if (typeof v === "number") return String(v);
                  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
                  return `'${String(v).replace(/'/g, "''")}'`;
                });
                const insertSql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(",")}) VALUES (${values.join(",")}) ON CONFLICT (id) DO NOTHING`;
                try {
                  await db.execute(sql.raw(insertSql));
                  totalInserted++;
                } catch {}
              }

              afterId = data.rows[data.rows.length - 1].id;
              if (data.rows.length < 2000) hasMore = false;
            }

            const prodCountRes = await fetch(`${prodUrl}/api/platform/sync-tables?key=${encodeURIComponent(syncKey)}`);
            const prodCountData = await prodCountRes.json() as { tables: Record<string, { count: number }> };
            const prodCount = prodCountData.tables[tableName]?.count || 0;

            prodSyncProgress.tables.push({
              table: tableName,
              devCount,
              prodCount,
              newRows: totalInserted,
              status: "done",
            });
          } catch (e: any) {
            prodSyncProgress.tables.push({
              table: tableName,
              devCount: 0, prodCount: 0, newRows: 0,
              status: "error", error: e.message?.slice(0, 200),
            });
          }
        }

        const seqResetTables = validTables;
        for (const t of seqResetTables) {
          try {
            await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1))`));
          } catch {}
        }

        prodSyncProgress.status = "complete";
        prodSyncProgress.currentTable = "";
      } catch (e: any) {
        prodSyncProgress.status = "error";
        prodSyncProgress.error = e.message;
      }
    })();
  });


  app.get("/api/dev/db-status", async (_req, res) => {
    try {
      const target = activeDbInfo.target;
      const label = activeDbInfo.label;
      const testDbConfigured = !!process.env.DATABASE_URL_TEST;

      let connected = false;
      let dbName = _mainDbCache.dbName;
      let dbHost = _mainDbCache.dbHost;
      if (Date.now() - _mainDbCache.checkedAt > MAIN_DB_CACHE_TTL || !dbName) {
        try {
          const result = await db.execute(sql.raw("SELECT current_database() as db, inet_server_addr() as host"));
          const row = (result.rows as any[])[0];
          dbName = row?.db || "";
          dbHost = row?.host || "";
          connected = true;
          _mainDbCache = { dbName, dbHost, checkedAt: Date.now() };
        } catch {}
      } else {
        connected = true;
      }

      let testDbOnline = _testDbCache.online;
      if (testDbConfigured && Date.now() - _testDbCache.checkedAt > TEST_DB_CACHE_TTL && !_testDbCache.checking) {
        _testDbCache.checking = true;
        (async () => {
          try {
            const pg2 = (await import("pg")).default;
            const testPool = new pg2.Pool({
              connectionString: process.env.DATABASE_URL_TEST,
              connectionTimeoutMillis: 2000,
            });
            try {
              await testPool.query("SELECT 1");
              _testDbCache = { online: true, checkedAt: Date.now(), checking: false };
            } catch {
              _testDbCache = { online: false, checkedAt: Date.now(), checking: false };
            } finally {
              await testPool.end();
            }
          } catch {
            _testDbCache.checking = false;
          }
        })();
      }

      res.json({
        devMode: true,
        target,
        label,
        connected,
        dbName,
        dbHost,
        testDbConfigured,
        testDbOnline,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/dev/switch-db", requireSuperAdmin, async (req, res) => {
    try {
      const { target } = req.body;
      if (target !== "usa" && target !== "thailand") {
        return res.status(400).json({ message: "Invalid target" });
      }

      try {
        await db.execute(sql.raw("DELETE FROM session"));
      } catch {}

      const result = await hotSwapDatabase(target);
      if (!result.success) {
        return res.status(503).json({ message: result.error || "ไม่สามารถสลับฐานข้อมูลได้" });
      }

      try {
        await db.execute(sql.raw("DELETE FROM session"));
      } catch {}

      res.json({ success: true, target, message: "Database switched successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  let cloneProgress: { status: string; percent: number; error?: string } = { status: "idle", percent: 0 };

  app.get("/api/dev/clone-progress", (_req, res) => {
    res.json(cloneProgress);
  });
  app.get("/api/dev/export-db", requireAdmin, async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return res.status(400).json({ message: "DATABASE_URL not configured" });

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
      const filename = `etax_backup_${dateStr}.sql`;

      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      const pg_dump = spawn("pg_dump", [dbUrl, "--no-owner", "--no-acl", "--clean", "--if-exists"], {
        env: { ...process.env },
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


  app.post("/api/dev/clone-db", requireSuperAdmin, async (req, res) => {
    try {
      if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_TEST) {
        return res.status(400).json({ message: "Both DATABASE_URL and DATABASE_URL_TEST must be configured" });
      }

      if (cloneProgress.status === "running") {
        return res.status(409).json({ message: "Clone already in progress" });
      }

      cloneProgress = { status: "running", percent: 0 };
      res.json({ success: true, message: "Clone started: USA → Thailand" });

      const sourceUrl = process.env.DATABASE_URL;
      const targetUrl = process.env.DATABASE_URL_TEST;

      try {
        cloneProgress = { status: "running", percent: 10 };

        const pg2 = (await import("pg")).default;
        const testPool = new pg2.Pool({ connectionString: targetUrl, connectionTimeoutMillis: 5000 });
        try {
          await testPool.query("SELECT 1");
        } catch {
          cloneProgress = { status: "error", percent: 0, error: "ฐานข้อมูลทดสอบ (Thailand) ไม่พร้อมใช้งาน" };
          return;
        } finally {
          await testPool.end();
        }

        cloneProgress = { status: "running", percent: 20 };

        const { promisify } = await import("util");
        const { exec } = await import("child_process");
        const execAsync = promisify(exec);

        const dumpFile = path.join(os.tmpdir(), "etax_clone.sql");
        await execAsync(`pg_dump "${sourceUrl}" --no-owner --no-acl --clean --if-exists > ${dumpFile}`, { timeout: 120000 });
        cloneProgress = { status: "running", percent: 60 };

        await execAsync(`psql "${targetUrl}" < ${dumpFile}`, { timeout: 120000 });
        cloneProgress = { status: "running", percent: 90 };

        try {
          const fsMod = await import("fs");
          fsMod.unlinkSync(dumpFile);
        } catch {}

        cloneProgress = { status: "complete", percent: 100 };
      } catch (cloneErr: any) {
        cloneProgress = { status: "error", percent: 0, error: cloneErr.message?.slice(0, 300) || "Clone failed" };
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dev/git-status", requireAuth, async (_req, res) => {
    try {
      const localBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
      const localHash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf-8" }).trim();
      const localFullHash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
      const localDate = execSync('git log -1 --format="%ci"', { encoding: "utf-8" }).trim();
      const localMessage = execSync('git log -1 --format="%s"', { encoding: "utf-8" }).trim();

      let remoteBranch = localBranch;
      let remoteHash = "";
      let remoteDate = "";
      let remoteMessage = "";
      let behind = 0;
      let hasRemote = false;

      try {
        try { execSync("git fetch origin --quiet", { encoding: "utf-8", timeout: 10000, stdio: "pipe", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }); } catch {}
        const remoteRef = `origin/${localBranch}`;
        remoteHash = execSync(`git rev-parse --short=8 ${remoteRef}`, { encoding: "utf-8" }).trim();
        remoteDate = execSync(`git log -1 --format="%ci" ${remoteRef}`, { encoding: "utf-8" }).trim();
        remoteMessage = execSync(`git log -1 --format="%s" ${remoteRef}`, { encoding: "utf-8" }).trim();
        const behindStr = execSync(`git rev-list --count HEAD..${remoteRef}`, { encoding: "utf-8" }).trim();
        behind = parseInt(behindStr) || 0;
        hasRemote = true;
      } catch (fetchErr: any) {
        hasRemote = false;
      }

      res.json({
        local: { branch: localBranch, hash: localHash, fullHash: localFullHash, date: localDate, message: localMessage },
        remote: hasRemote ? { branch: remoteBranch, hash: remoteHash, date: remoteDate, message: remoteMessage } : null,
        behind,
        hasRemote,
        upToDate: hasRemote && behind === 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/dev/git-pull", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();

      const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
      const stashResult = execSync("git stash --include-untracked", { encoding: "utf-8", env: gitEnv }).trim();
      const hadChanges = !stashResult.includes("No local changes");

      const pullResult = execSync(`git pull origin ${branch} --no-edit 2>&1`, { encoding: "utf-8", timeout: 30000, env: gitEnv }).trim();

      if (hadChanges) {
        try {
          execSync("git stash pop", { encoding: "utf-8", env: gitEnv });
        } catch {
        }
      }

      const newHash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf-8" }).trim();
      const newDate = execSync('git log -1 --format="%ci"', { encoding: "utf-8" }).trim();
      const newMessage = execSync('git log -1 --format="%s"', { encoding: "utf-8" }).trim();

      res.json({
        success: true,
        pullResult,
        newVersion: { hash: newHash, date: newDate, message: newMessage },
        hadLocalChanges: hadChanges,
        restartRequired: true,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message, success: false });
    }
  });
}

const SHARE_DOC_TABLES: Record<string, { table: any; tokenField: string; noField: string; dateField: string; label: string }> = {
  invoice: { table: invoices, tokenField: "shareToken", noField: "invoiceNo", dateField: "invoiceDate", label: "ใบแจ้งหนี้" },
  "tax-invoice": { table: taxInvoices, tokenField: "shareToken", noField: "taxInvoiceNo", dateField: "taxInvoiceDate", label: "ใบกำกับภาษี" },
  receipt: { table: receipts, tokenField: "shareToken", noField: "receiptNo", dateField: "receiptDate", label: "ใบเสร็จรับเงิน" },
  quotation: { table: quotations, tokenField: "shareToken", noField: "quotationNo", dateField: "quotationDate", label: "ใบเสนอราคา" },
  "sales-order": { table: salesOrders, tokenField: "shareToken", noField: "orderNo", dateField: "orderDate", label: "ใบสั่งขาย" },
};

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
}

app.get("/share/:docType/:token", async (req, res, next) => {
  try {
    const cfg = SHARE_DOC_TABLES[req.params.docType];
    if (!cfg) return next();

    const [doc] = await db.select().from(cfg.table).where(eq(cfg.table.shareToken, req.params.token));
    if (!doc) return next();

    const [company] = await db.select().from(companies).where(eq(companies.id, doc.companyId));
    const companyName = escHtml(company?.name || "E-Tax Center");
    const docNo = escHtml((doc as any)[cfg.noField] || "");
    const customerName = escHtml(doc.customerName || "");
    const totalAmount = doc.totalAmount ? `฿${Number(doc.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "";

    const ogTitle = `${cfg.label} ${docNo}`;
    const ogDesc = [customerName, totalAmount, companyName].filter(Boolean).join(" | ");
    const ogUrl = `https://etaxcenter.replit.app/share/${req.params.docType}/${req.params.token}`;

    const prodPath = path.resolve(import.meta.dirname, "public", "index.html");
    const devPath = path.resolve(import.meta.dirname, "..", "client", "index.html");
    const templatePath = fs.existsSync(prodPath) ? prodPath : devPath;
    let html = await fs.promises.readFile(templatePath, "utf-8");

    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${ogTitle}" />`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${ogDesc}" />`
    );
    html = html.replace(
      /<meta property="og:type" content="[^"]*" \/>/,
      `<meta property="og:type" content="article" />`
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${ogTitle}" />`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${ogDesc}" />`
    );
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="https://etaxcenter.replit.app/etaxcenter-logo.png" />`
    );
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${ogTitle} - ${companyName}</title>`);

    if (!html.includes('og:url')) {
      html = html.replace('</head>', `  <meta property="og:url" content="${ogUrl}" />\n  </head>`);
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch {
    next();
  }
});

app.post("/api/expense-snap/ocr", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ message: "AI service ไม่พร้อมใช้งาน กรุณาตั้งค่า OpenAI API Key" });
    }
    const { image } = req.body;
    if (!image || typeof image !== "string") return res.status(400).json({ message: "กรุณาส่งรูปใบเสร็จ" });

    if (image.length > 14 * 1024 * 1024) return res.status(400).json({ message: "ขนาดภาพใหญ่เกินไป (สูงสุด 10MB)" });

    const base64Match = image.match(/^data:(image\/(jpeg|jpg|png|webp|gif|bmp));base64,(.+)$/i);
    if (!base64Match) return res.status(400).json({ message: "รูปแบบภาพไม่ถูกต้อง (รองรับ JPEG, PNG, WebP)" });

    const mimeType = base64Match[1];
    const base64Data = base64Match[3];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are an OCR assistant that extracts data from Thai receipts/invoices. Return a JSON object with these fields:
- date: string (YYYY-MM-DD format)
- vendor: string (shop/company name)
- description: string (brief description of items/services)
- subtotal: number (amount before VAT)
- vat: number (VAT amount, 0 if not shown)
- amount: number (total amount including VAT)
- taxId: string (tax ID if visible)
- receiptNumber: string (receipt/invoice number)
Return ONLY valid JSON, no markdown or extra text. If a field is not found, use empty string for strings and 0 for numbers.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract receipt data from this image:" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
          ]
        }
      ],
    });

    const content = response.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      parsed = {};
    }

    res.json({
      date: parsed.date || new Date().toISOString().split("T")[0],
      vendor: parsed.vendor || "",
      description: parsed.description || "",
      subtotal: Number(parsed.subtotal) || 0,
      vat: Number(parsed.vat) || 0,
      amount: Number(parsed.amount) || 0,
      taxId: parsed.taxId || "",
      receiptNumber: parsed.receiptNumber || "",
    });
  } catch (err: any) {
    console.error("[expense-snap/ocr] Error:", err.message);
    res.status(500).json({ message: "OCR ล้มเหลว: " + (err.message || "Unknown error") });
  }
});

app.post("/api/expense-snap/save", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, date, vendor, description, amount, vat, subtotal, taxId, receiptNumber } = req.body;
    if (!companyId || isNaN(Number(companyId))) return res.status(400).json({ message: "กรุณาระบุ companyId" });

    const parsedAmount = Number(amount) || 0;
    const parsedVat = Number(vat) || 0;
    const parsedSubtotal = Number(subtotal) || parsedAmount;
    if (parsedAmount < 0) return res.status(400).json({ message: "จำนวนเงินต้องไม่ติดลบ" });

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)" });

    const totalAmount = String(parsedAmount);
    const vatAmount = String(parsedVat);
    const subTotalAmount = String(parsedSubtotal);

    const expDate = date || new Date().toISOString().split("T")[0];
    const nextDocNo = await getNextDocNo(companyId, "EXP", expenses, expenses.expNo, expenses.companyId, expDate);

    const [newExpense] = await db.insert(expenses).values({
      companyId,
      expNo: nextDocNo,
      expDate,
      vendorName: vendor || "ไม่ระบุ",
      vendorTaxId: taxId || null,
      taxInvoiceRef: receiptNumber || null,
      notes: description || "ค่าใช้จ่ายจาก Expense Snap",
      subtotal: subTotalAmount,
      vatAmount,
      totalAmount,
      status: "draft",
      paymentStatus: "unpaid",
    }).returning();

    if (newExpense) {
      await db.insert(expenseItems).values({
        expenseId: newExpense.id,
        description: description || "ค่าใช้จ่ายจาก Expense Snap",
        accountCode: "5265000",
        amount: subTotalAmount,
        vatType: vat > 0 ? "vat7" : "none",
      });
    }

    res.json({ id: newExpense?.id, docNumber: nextDocNo, message: "บันทึกสำเร็จ" });
  } catch (err: any) {
    console.error("[expense-snap/save] Error:", err.message);
    res.status(500).json({ message: "บันทึกล้มเหลว: " + (err.message || "Unknown error") });
  }
});

app.post("/api/fix-sequences", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT c.relname AS seq_name, t.relname AS table_name, a.attname AS column_name
      FROM pg_class c
      JOIN pg_depend d ON d.objid = c.oid
      JOIN pg_class t ON d.refobjid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE c.relkind = 'S'
      ORDER BY t.relname
    `);
    const fixes: { table: string; sequence: string; oldVal: number; newVal: number }[] = [];
    for (const row of result.rows as any[]) {
      const seqName = row.seq_name;
      const tableName = row.table_name;
      const colName = row.column_name;
      try {
        const [maxRow] = (await db.execute(sql.raw(`SELECT COALESCE(MAX("${colName}"), 0) AS max_id FROM "${tableName}"`))).rows as any[];
        const [seqRow] = (await db.execute(sql.raw(`SELECT last_value, is_called FROM "${seqName}"`))).rows as any[];
        const maxId = Number(maxRow.max_id);
        const seqVal = Number(seqRow.last_value);
        if (maxId > seqVal || (maxId > 0 && !seqRow.is_called)) {
          const newVal = maxId + 1;
          await db.execute(sql.raw(`SELECT setval('"${seqName}"', ${newVal}, true)`));
          fixes.push({ table: tableName, sequence: seqName, oldVal: seqVal, newVal });
        }
      } catch {}
    }
    console.log(`[fix-sequences] Fixed ${fixes.length} sequences:`, fixes.map(f => `${f.table}: ${f.oldVal} → ${f.newVal}`).join(", "));
    res.json({ fixed: fixes.length, details: fixes });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/db-compare", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ message: "Dev only" });
  try {
    const pg2 = (await import("pg")).default;
    const prodUrl = getConfig("DB_PROD_URL");
    if (!prodUrl) return res.status(400).json({ message: "DB_PROD_URL not configured" });

    const localPool = new pg2.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
    const remotePool = new pg2.Pool({ connectionString: prodUrl, max: 2, connectionTimeoutMillis: 15000, statement_timeout: 30000 });

    const tables = [
      "journal_entries", "journal_lines", "accounts", "invoices", "invoice_items",
      "tax_invoices", "receipts", "quotations", "expenses", "expense_items",
      "purchase_invoices", "purchase_invoice_items", "payroll_records",
      "firm_clients", "companies", "contacts", "products",
      "petty_cash_funds", "petty_cash_transactions",
    ];

    const results: any[] = [];
    for (const t of tables) {
      try {
        const [localRes, remoteRes] = await Promise.all([
          localPool.query(`SELECT count(*)::int as cnt FROM "${t}"`),
          remotePool.query(`SELECT count(*)::int as cnt FROM "${t}"`),
        ]);
        const localCount = localRes.rows[0]?.cnt || 0;
        const remoteCount = remoteRes.rows[0]?.cnt || 0;
        results.push({ table: t, neon: localCount, deepMain: remoteCount, diff: localCount - remoteCount, match: localCount === remoteCount });
      } catch (e: any) {
        results.push({ table: t, error: e.message?.slice(0, 100) });
      }
    }

    const financialSums: any = {};
    try {
      const sumQuery = `
        SELECT 
          coalesce(sum(CASE WHEN a.type='expense' THEN jl.debit-jl.credit ELSE 0 END),0) as expense_total,
          coalesce(sum(CASE WHEN a.type='revenue' THEN jl.credit-jl.debit ELSE 0 END),0) as revenue_total
        FROM journal_lines jl
        JOIN journal_entries je ON je.id=jl.journal_entry_id
        JOIN accounts a ON a.id=jl.account_id
        WHERE je.status IN ('posted','approved') AND je.company_id=4
          AND je.entry_date>='2026-01-01' AND je.entry_date<='2026-03-20'
      `;
      const [localFin, remoteFin] = await Promise.all([
        localPool.query(sumQuery),
        remotePool.query(sumQuery),
      ]);
      financialSums.neon = { expense: Number(localFin.rows[0]?.expense_total || 0), revenue: Number(localFin.rows[0]?.revenue_total || 0) };
      financialSums.deepMain = { expense: Number(remoteFin.rows[0]?.expense_total || 0), revenue: Number(remoteFin.rows[0]?.revenue_total || 0) };
      financialSums.match = financialSums.neon.expense === financialSums.deepMain.expense && financialSums.neon.revenue === financialSums.deepMain.revenue;
    } catch (e: any) {
      financialSums.error = e.message?.slice(0, 200);
    }

    await localPool.end().catch(() => {});
    await remotePool.end().catch(() => {});

    const mismatches = results.filter((r: any) => !r.match);
    res.json({ totalTables: tables.length, mismatches: mismatches.length, details: results, financialSums });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const TEST_DOC_PREFIX = "TEST-PDF";
const TEST_DOC_MARKER = "[TEST] ข้อมูลทดสอบ PDF — ลบได้หลังทดสอบเสร็จ";

app.post("/api/dev/create-pdf-test-doc", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(400).json({ message: "ไม่พบ companyId" });

    const itemCount = Math.min(Math.max(Number(req.body.itemCount) || 150, 10), 500);

    const existing = await db.select({ id: taxInvoices.id, taxInvoiceNo: taxInvoices.taxInvoiceNo })
      .from(taxInvoices)
      .where(and(eq(taxInvoices.companyId, companyId), sql`${taxInvoices.taxInvoiceNo} LIKE ${TEST_DOC_PREFIX + '%'}`));
    if (existing.length > 0) {
      return res.json({ message: "มี test document อยู่แล้ว", documentId: existing[0].id, docNo: existing[0].taxInvoiceNo, itemCount: 0 });
    }

    const docNo = `${TEST_DOC_PREFIX}-${itemCount}`;
    const items: { productCode: string; productName: string; description: string; qty: string; unit: string; unitPrice: string; discount: string; discountType: string; total: string; vatType: string; taxInvoiceId: number }[] = [];

    const sampleProducts = [
      "คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex", "จอมอนิเตอร์ LG 27 นิ้ว", "คีย์บอร์ดไร้สาย Logitech MX Keys",
      "เมาส์ไร้สาย Logitech MX Master 3", "เครื่องพิมพ์ HP LaserJet Pro", "หมึกพิมพ์ HP 26A",
      "แท่นชาร์จ USB-C 100W", "สาย HDMI 2.1 ยาว 3 เมตร", "กล้องเว็บแคม Logitech C920",
      "หูฟัง Sony WH-1000XM5", "แผ่นรองเมาส์ SteelSeries", "ตลับหมึก Canon PG-745",
      "กระดาษ A4 80 แกรม (5 รีม)", "ซองจดหมาย DL สีขาว (100 ซอง)", "แฟ้มเอกสาร A4 สีน้ำเงิน",
      "เก้าอี้สำนักงาน Ergonomic", "โต๊ะทำงาน 120x60 ซม.", "ชั้นวางของเหล็ก 4 ชั้น",
      "ปลั๊กไฟ 6 ช่อง สายยาว 3 เมตร", "เครื่องสำรองไฟ APC 1000VA",
    ];

    let subtotal = 0;
    for (let i = 0; i < itemCount; i++) {
      const name = sampleProducts[i % sampleProducts.length];
      const qty = Math.floor(Math.random() * 10) + 1;
      const unitPrice = Math.floor(Math.random() * 5000) + 100;
      const total = qty * unitPrice;
      subtotal += total;
      items.push({
        productCode: `TST-${String(i + 1).padStart(4, "0")}`,
        productName: `${name} #${i + 1}`,
        description: `รายการทดสอบ ${i + 1} / ${itemCount}`,
        qty: String(qty),
        unit: "ชิ้น",
        unitPrice: String(unitPrice),
        discount: "0",
        discountType: "amount",
        total: String(total),
        vatType: "vat7",
        taxInvoiceId: 0,
      });
    }

    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
    const totalAmount = subtotal + vatAmount;

    const [doc] = await db.insert(taxInvoices).values({
      companyId,
      taxInvoiceNo: docNo,
      taxInvoiceDate: new Date().toISOString().split("T")[0],
      customerName: "🧪 ลูกค้าทดสอบ PDF Stress Test",
      customerAddress: "999/99 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ 10999",
      customerTaxId: "0000000000000",
      branch: "สำนักงานใหญ่",
      subtotal: String(subtotal),
      vatAmount: String(vatAmount),
      totalAmount: String(totalAmount),
      discountAmount: "0",
      withholdingTax: "0",
      status: "draft",
      priceMode: "excluded",
      notes: TEST_DOC_MARKER,
      docPrefix: TEST_DOC_PREFIX,
      createdBy: user.id,
    }).returning();

    const itemsWithId = items.map(it => ({ ...it, taxInvoiceId: doc.id }));
    const BATCH = 50;
    for (let b = 0; b < itemsWithId.length; b += BATCH) {
      await db.insert(taxInvoiceItems).values(itemsWithId.slice(b, b + BATCH));
    }

    console.log(`[DEV] Created test tax invoice #${doc.id} (${docNo}) with ${itemCount} items for company ${companyId}`);
    res.json({ message: `สร้างเอกสารทดสอบ ${docNo} สำเร็จ (${itemCount} รายการ, ~${Math.ceil(itemCount / 12)} หน้า)`, documentId: doc.id, docNo, itemCount });
  } catch (err: any) {
    console.error("[DEV] Create test doc error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/dev/delete-pdf-test-doc/:id", requireAuth, async (req, res) => {
  try {
    const docId = Number(req.params.id);
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(400).json({ message: "ไม่พบ companyId" });

    const [doc] = await db.select().from(taxInvoices)
      .where(and(eq(taxInvoices.id, docId), eq(taxInvoices.companyId, companyId)));
    if (!doc) return res.status(404).json({ message: "ไม่พบเอกสาร" });
    if (!doc.taxInvoiceNo.startsWith(TEST_DOC_PREFIX)) {
      return res.status(403).json({ message: "ลบได้เฉพาะเอกสารทดสอบ (TEST-PDF-*) เท่านั้น" });
    }

    await db.delete(taxInvoiceItems).where(eq(taxInvoiceItems.taxInvoiceId, docId));
    await db.delete(taxInvoices).where(eq(taxInvoices.id, docId));

    console.log(`[DEV] Hard-deleted test tax invoice #${docId} (${doc.taxInvoiceNo}) and all items`);
    res.json({ message: `ลบเอกสารทดสอบ ${doc.taxInvoiceNo} สำเร็จ (hard delete)` });
  } catch (err: any) {
    console.error("[DEV] Delete test doc error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/dev/pdf-test-docs", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(400).json({ message: "ไม่พบ companyId", docs: [] });

    const docs = await db.select({
      id: taxInvoices.id,
      taxInvoiceNo: taxInvoices.taxInvoiceNo,
      customerName: taxInvoices.customerName,
      totalAmount: taxInvoices.totalAmount,
      status: taxInvoices.status,
      createdAt: taxInvoices.createdAt,
    }).from(taxInvoices)
      .where(and(eq(taxInvoices.companyId, companyId), sql`${taxInvoices.taxInvoiceNo} LIKE ${TEST_DOC_PREFIX + '%'}`));

    res.json({ docs });
  } catch (err: any) {
    res.status(500).json({ message: err.message, docs: [] });
  }
});

// ===================== Invoice Recompute Preview =====================
app.get("/api/dev/invoice-recompute-preview", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const invRows = await db.execute(sql.raw(`SELECT id, invoice_no, customer_name, total_amount, withholding_tax, payment_status FROM invoices WHERE company_id = ${companyId} ORDER BY invoice_date DESC, id DESC`));
    const rows = (invRows as any).rows || [];
    if (rows.length === 0) return res.json([]);
    const idArr = `'{${rows.map((r: any) => r.id).join(",")}}'::int[]`;
    const [directRes, batchRes, tivRes] = await Promise.all([
      db.execute(sql.raw(`SELECT invoice_id, SUM(total_amount) AS paid FROM receipts WHERE invoice_id = ANY(${idArr}) GROUP BY invoice_id`)),
      db.execute(sql.raw(`SELECT doc_id, SUM(amount) AS paid FROM receipt_linked_docs WHERE doc_type='IV' AND doc_id = ANY(${idArr}) GROUP BY doc_id`)),
      db.execute(sql.raw(`SELECT invoice_id, SUM(total_amount) AS paid FROM tax_invoices WHERE invoice_id = ANY(${idArr}) AND status IN ('cash','approved') GROUP BY invoice_id`)),
    ]);
    const directMap: Record<number,number> = {};
    const batchMap: Record<number,number> = {};
    const tivMap: Record<number,number> = {};
    for (const r of (directRes as any).rows || []) directMap[r.invoice_id] = parseFloat(r.paid || 0);
    for (const r of (batchRes as any).rows || []) batchMap[r.doc_id] = parseFloat(r.paid || 0);
    for (const r of (tivRes as any).rows || []) tivMap[r.invoice_id] = parseFloat(r.paid || 0);
    const result = rows.map((inv: any) => {
      const total = parseFloat(inv.total_amount || 0);
      const whtField = parseFloat(inv.withholding_tax || 0);
      const direct = directMap[inv.id] || 0;
      const batch = batchMap[inv.id] || 0;
      const tiv = tivMap[inv.id] || 0;
      const rawPaid = direct + batch + tiv;
      const whtCounted = rawPaid > 0 ? whtField : 0;
      const effectivePaid = rawPaid + whtCounted;
      const newStatus = effectivePaid >= total - 0.01 && effectivePaid > 0 ? "paid" : effectivePaid > 0 ? "partial" : "unpaid";
      // determine case
      const sources: string[] = [];
      if (direct > 0) sources.push("Receipt");
      if (batch > 0) sources.push("BatchReceipt");
      if (tiv > 0) sources.push("TIV");
      if (whtCounted > 0) sources.push("WHT");
      let caseLabel = sources.length === 0 ? "Case1: ไม่มีชำระ" :
        sources.length === 1 && sources[0] === "Receipt" ? "Case2: เสร็จตรง" :
        sources.length === 1 && sources[0] === "BatchReceipt" ? "Case3: เสร็จรวม" :
        sources.includes("TIV") && !sources.includes("WHT") ? "Case4: TIV" :
        sources.includes("TIV") && sources.includes("WHT") && !sources.includes("Receipt") && !sources.includes("BatchReceipt") ? "Case6: TIV+WHT" :
        sources.includes("WHT") && !sources.includes("TIV") ? "Case5: เสร็จ+WHT" :
        sources.includes("Receipt") && sources.includes("TIV") ? "Case7: ผสม" :
        effectivePaid > total + 0.01 ? "Case9: เกิน" : "Case8: อื่นๆ";
      return {
        id: inv.id, invoiceNo: inv.invoice_no, customerName: inv.customer_name,
        total, whtField, direct, batch, tiv, rawPaid, whtCounted, effectivePaid,
        currentStatus: inv.payment_status, newStatus, caseLabel,
        willChange: inv.payment_status !== newStatus,
      };
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/dev/invoice-recompute-apply", requireSuperAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids required" });
    const { recomputePaymentStatus } = await import("../route-helpers");
    let updated = 0; const errors: string[] = [];
    for (const id of ids) {
      try { await recomputePaymentStatus("invoice", id); updated++; }
      catch (e: any) { errors.push(`invoice#${id}: ${e.message}`); }
    }
    res.json({ updated, errors });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/dev/recompute-preview", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>Invoice Recompute Preview</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:sans-serif}
body{background:#f5f5f5;padding:20px;font-size:13px}
h1{font-size:18px;margin-bottom:12px;color:#1e3a5f}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
input[type=number]{border:1px solid #ccc;border-radius:4px;padding:5px 8px;width:120px}
button{padding:5px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500}
.btn-load{background:#2563eb;color:#fff}
.btn-apply{background:#16a34a;color:#fff}
.btn-apply:disabled{background:#86efac;cursor:default}
.btn-filter{background:#e5e7eb;color:#374151}
.btn-filter.active{background:#374151;color:#fff}
.stats{display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:6px 14px;text-align:center}
.stat-n{font-size:20px;font-weight:700}
.stat-will{color:#dc2626}
.stat-ok{color:#16a34a}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th{background:#1e3a5f;color:#fff;padding:7px 8px;text-align:left;white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
tr:hover td{background:#f9fafb}
.will-change td{background:#fff7ed}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.unpaid{background:#fee2e2;color:#991b1b}
.partial{background:#fed7aa;color:#9a3412}
.paid{background:#dcfce7;color:#166534}
.arrow{color:#6b7280;font-size:16px;margin:0 4px}
.changed{color:#dc2626;font-weight:700}
.ok{color:#16a34a}
.case-badge{background:#e0e7ff;color:#3730a3;border-radius:4px;padding:1px 6px;font-size:10px}
.loading{color:#6b7280;padding:20px;text-align:center}
.error{color:#dc2626;padding:10px;background:#fee2e2;border-radius:4px}
.num{text-align:right;font-variant-numeric:tabular-nums}
</style>
</head>
<body>
<h1>Invoice Payment Status — Recompute Preview</h1>
<div class="toolbar">
  <label>Company ID: <input id="cid" type="number" value="4" min="1" /></label>
  <button class="btn-load" onclick="loadData()">โหลดข้อมูล</button>
  <button class="btn-filter active" id="f-all" onclick="setFilter('all')">ทั้งหมด</button>
  <button class="btn-filter" id="f-change" onclick="setFilter('change')">เฉพาะที่จะเปลี่ยน</button>
  <button class="btn-apply" id="applyBtn" onclick="applyChanges()" disabled>Apply เฉพาะที่จะเปลี่ยน</button>
</div>
<div class="stats" id="stats"></div>
<div id="out"></div>
<script>
let allData = [], currentFilter = 'all';
const STATUS_TH = { unpaid:'ยังไม่ชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ' };
function badge(s){ return '<span class="badge '+(s||'')+'">'+( STATUS_TH[s]||s||'-')+'</span>'; }
function fmt(n){ return Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function setFilter(f){
  currentFilter=f;
  document.getElementById('f-all').className='btn-filter'+(f==='all'?' active':'');
  document.getElementById('f-change').className='btn-filter'+(f==='change'?' active':'');
  render();
}
async function loadData(){
  const cid = document.getElementById('cid').value;
  document.getElementById('out').innerHTML='<div class="loading">กำลังโหลด...</div>';
  document.getElementById('stats').innerHTML='';
  try{
    const r = await fetch('/api/dev/invoice-recompute-preview?companyId='+cid, {credentials:'include'});
    if(!r.ok){ const e=await r.json(); throw new Error(e.message); }
    allData = await r.json();
    document.getElementById('applyBtn').disabled = !allData.some(d=>d.willChange);
    render();
  }catch(e){ document.getElementById('out').innerHTML='<div class="error">Error: '+e.message+'</div>'; }
}
function render(){
  const data = currentFilter==='change' ? allData.filter(d=>d.willChange) : allData;
  const willChange = allData.filter(d=>d.willChange).length;
  const total = allData.length;
  document.getElementById('stats').innerHTML =
    '<div class="stat"><div class="stat-n">'+total+'</div><div>ทั้งหมด</div></div>'+
    '<div class="stat"><div class="stat-n stat-will">'+willChange+'</div><div>จะเปลี่ยน</div></div>'+
    '<div class="stat"><div class="stat-n stat-ok">'+(total-willChange)+'</div><div>ถูกต้องแล้ว</div></div>';
  if(data.length===0){ document.getElementById('out').innerHTML='<div class="loading">ไม่มีข้อมูล</div>'; return; }
  let rows = data.map((d,i)=>{
    const chg = d.willChange ? 'will-change' : '';
    const arrow = d.willChange ? '<span class="arrow">→</span><span class="changed">'+badge(d.newStatus)+'</span>' : '<span class="ok">✓ ถูกต้อง</span>';
    return '<tr class="'+chg+'">'+
      '<td class="num">'+(i+1)+'</td>'+
      '<td><a href="/sales/invoices" style="color:#2563eb;text-decoration:none">'+d.invoiceNo+'</a></td>'+
      '<td>'+d.customerName+'</td>'+
      '<td class="num">'+fmt(d.total)+'</td>'+
      '<td class="num">'+fmt(d.direct)+'</td>'+
      '<td class="num">'+fmt(d.batch)+'</td>'+
      '<td class="num">'+fmt(d.tiv)+'</td>'+
      '<td class="num">'+fmt(d.whtCounted)+'</td>'+
      '<td class="num"><b>'+fmt(d.effectivePaid)+'</b></td>'+
      '<td><span class="case-badge">'+d.caseLabel+'</span></td>'+
      '<td>'+badge(d.currentStatus)+arrow+'</td>'+
      '</tr>';
  }).join('');
  document.getElementById('out').innerHTML =
    '<table><thead><tr>'+
    '<th>#</th><th>เลขที่</th><th>ลูกค้า</th>'+
    '<th>ยอดรวม</th><th>เสร็จตรง</th><th>เสร็จรวม</th><th>TIV</th><th>WHT</th><th>ยอดรับรวม</th>'+
    '<th>Case</th><th>สถานะ (ปัจจุบัน → ใหม่)</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>';
}
async function applyChanges(){
  const ids = allData.filter(d=>d.willChange).map(d=>d.id);
  if(!ids.length){ alert('ไม่มีรายการที่ต้องเปลี่ยน'); return; }
  if(!confirm('จะ apply '+ids.length+' รายการ ยืนยัน?')) return;
  document.getElementById('applyBtn').disabled=true;
  document.getElementById('applyBtn').textContent='กำลัง apply...';
  try{
    const r = await fetch('/api/dev/invoice-recompute-apply',{
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ids})
    });
    const result = await r.json();
    alert('Updated: '+result.updated+' รายการ'+(result.errors?.length?' | Errors: '+result.errors.join(', '):''));
    loadData();
  }catch(e){ alert('Error: '+e.message); document.getElementById('applyBtn').disabled=false; }
}
</script>
</body>
</html>`);
});

}
