import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, or, isNull } from "drizzle-orm";
import { companies, taxInvoices, invoices } from "@shared/schema";
import { requireAuth } from "../route-middleware";

export function registerFtpArchiveRoutes(app: Express) {
// === FTP Archive Settings & Jobs ===
let ftpArchive: any = null;
let folderCodes: any = null;
async function getFtpArchive() {
  if (!ftpArchive) ftpArchive = await import('../services/ftp-archive');
  return ftpArchive;
}
async function getFolderCodes() {
  if (!folderCodes) folderCodes = await import('../services/folder-codes');
  return folderCodes;
}

app.get('/api/ftp-archive/settings', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const settings = await (await getFtpArchive()).getArchiveSettings();
    if (settings) {
      const { ftpPassword, ...safe } = settings;
      res.json({ ...safe, ftpPassword: settings.ftpPassword ? '••••••' : '' });
    } else {
      res.json(null);
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put('/api/ftp-archive/settings', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const data = req.body;
    if (data.ftpPassword === '••••••') delete data.ftpPassword;
    const result = await (await getFtpArchive()).upsertArchiveSettings(data, user.id);
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/test-connection', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const result = await (await getFtpArchive()).testFtpConnection(req.body);
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/run', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const result = await (await getFtpArchive()).runArchiveJob();
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/update-links', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const count = await (await getFtpArchive()).updateArchivedLinks();
    res.json({ updatedLinks: count });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/retry-failed', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const count = await (await getFtpArchive()).retryFailedItems();
    res.json({ retriedItems: count });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/jobs', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const limit = parseInt(req.query.limit as string) || 20;
    const jobs = await (await getFtpArchive()).getArchiveJobs(limit);
    res.json(jobs);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/jobs/:jobId/items', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const items = await (await getFtpArchive()).getArchiveJobItems(parseInt(req.params.jobId));
    res.json(items);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const stats = await (await getFtpArchive()).getArchiveStats();
    res.json(stats);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/last-run', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const lastRun = await (await getFtpArchive()).getLastRunStats();
    res.json(lastRun);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/check-stale', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const result = await (await getFtpArchive()).checkStaleTransfers();
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/sync-directory', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const result = await (await getFtpArchive()).syncDirectoryIndex();
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/backfill-folder-codes', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const result = await (await getFolderCodes()).backfillFolderCodes();
    res.json({ message: `Backfilled ${result.companyCodes} company codes, ${result.storeCodes} store codes`, ...result });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/directory', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const directory = await (await getFolderCodes()).getAllDirectoryEntries();
    res.json(directory);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/dirty-entries', requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'super_admin') return res.status(403).json({ message: 'Superadmin only' });
    const dirty = await (await getFolderCodes()).getDirtyEntries();
    res.json({ dirtyCount: dirty.companies.length + dirty.stores.length, ...dirty });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


app.get('/api/ftp-archive/base-urls', requireAuth, async (req, res) => {
  try {
    const settings = await (await getFtpArchive()).getArchiveSettings();
    res.json({
      ftpBaseUrl: settings?.ftpBaseUrl || null,
      ftpLanBaseUrl: settings?.ftpLanBaseUrl || null,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/resolve-url', requireAuth, async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ message: 'url parameter required' });

    const settings = await (await getFtpArchive()).getArchiveSettings();
    const ftpBaseUrl = settings?.ftpBaseUrl || '';
    const ftpLanBaseUrl = settings?.ftpLanBaseUrl || '';

    if (!ftpBaseUrl || !url.startsWith(ftpBaseUrl)) {
      return res.json({ primaryUrl: url, lanUrl: null, resolvedUrl: url, useLan: false });
    }

    let lanUrl: string | null = null;
    if (ftpLanBaseUrl) {
      lanUrl = url.replace(ftpBaseUrl, ftpLanBaseUrl);
    }

    let useLan = false;
    const controller = new AbortController();
    const probeTimeout = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(url, { method: 'HEAD', signal: controller.signal });
    } catch {
      useLan = !!lanUrl;
    } finally {
      clearTimeout(probeTimeout);
    }

    res.json({
      primaryUrl: url,
      lanUrl,
      resolvedUrl: useLan ? lanUrl : url,
      useLan,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get('/api/ftp-archive/proxy', requireAuth, async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ message: 'url parameter required' });

    const settings = await (await getFtpArchive()).getArchiveSettings();
    const ftpBaseUrl = settings?.ftpBaseUrl || '';
    const ftpLanBaseUrl = settings?.ftpLanBaseUrl || '';

    if (!ftpBaseUrl || (!url.startsWith(ftpBaseUrl) && !(ftpLanBaseUrl && url.startsWith(ftpLanBaseUrl)))) {
      return res.status(403).json({ message: 'URL not allowed — must be an archive URL' });
    }

    let fetchUrl = url;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const upstream = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!upstream.ok) {
        if (ftpLanBaseUrl && url.startsWith(ftpBaseUrl)) {
          const lanUrl = url.replace(ftpBaseUrl, ftpLanBaseUrl);
          const lanResp = await fetch(lanUrl, { signal: AbortSignal.timeout(10000) });
          if (!lanResp.ok) return res.status(lanResp.status).json({ message: 'File not found on archive server' });
          const ct = lanResp.headers.get('content-type');
          if (ct) res.setHeader('Content-Type', ct);
          const cd = lanResp.headers.get('content-disposition');
          if (cd) res.setHeader('Content-Disposition', cd);
          const buf = Buffer.from(await lanResp.arrayBuffer());
          return res.send(buf);
        }
        return res.status(upstream.status).json({ message: 'File not found on archive server' });
      }
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      const cd = upstream.headers.get('content-disposition');
      if (cd) {
        res.setHeader('Content-Disposition', cd);
      } else {
        const filename = decodeURIComponent(url.split('/').pop() || 'file');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (ftpLanBaseUrl && url.startsWith(ftpBaseUrl)) {
        try {
          const lanUrl = url.replace(ftpBaseUrl, ftpLanBaseUrl);
          const lanResp = await fetch(lanUrl, { signal: AbortSignal.timeout(10000) });
          if (!lanResp.ok) return res.status(502).json({ message: 'Archive server unreachable' });
          const ct = lanResp.headers.get('content-type');
          if (ct) res.setHeader('Content-Type', ct);
          const cd = lanResp.headers.get('content-disposition');
          if (cd) res.setHeader('Content-Disposition', cd);
          const buf = Buffer.from(await lanResp.arrayBuffer());
          return res.send(buf);
        } catch { /* fall through */ }
      }
      return res.status(502).json({ message: 'Archive server unreachable' });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/seed-test-files', requireAuth, async (req, res) => {
  try {
    const { saveBufferToPath } = await import("../replit_integrations/object_storage/routes");
    const { Pool: Pg2Pool } = await import("pg");

    const testFiles = [
      { key: '.private/test-archive/test-doc-001.pdf', content: 'FTP Archive Test #1 ' + 'A'.repeat(500) },
      { key: '.private/test-archive/test-doc-002.pdf', content: 'FTP Archive Test #2 ' + 'B'.repeat(800) },
      { key: '.private/test-archive/test-doc-003.pdf', content: 'FTP Archive Test #3 ' + 'C'.repeat(300) },
    ];

    for (const f of testFiles) {
      saveBufferToPath(Buffer.from(f.content), f.key);
    }

    const tivs = await db.select().from(taxInvoices)
      .where(or(isNull(taxInvoices.attachedUrl), eq(taxInvoices.attachedUrl, '')))
      .limit(3);

    if (tivs.length < 3) {
      return res.status(400).json({ message: `Need 3 TIVs without attachments, found ${tivs.length}` });
    }

    const seeded = [];
    for (let i = 0; i < 3; i++) {
      await db.update(taxInvoices)
        .set({ attachedUrl: testFiles[i].key })
        .where(eq(taxInvoices.id, tivs[i].id));
      seeded.push({ tivId: tivs[i].id, url: testFiles[i].key });
    }

    res.json({ success: true, seeded, message: `Seeded 3 test files on tax invoices` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/toggle-test-mode', requireAuth, async (req, res) => {
  try {
    const { testMode } = req.body;
    const user = req.user as any;
    const result = await (await getFtpArchive()).upsertArchiveSettings({ testMode: !!testMode }, user?.id);
    res.json({ testMode: result.testMode, message: testMode ? 'Test mode เปิดแล้ว — ระบบจะ Revert ไฟล์อัตโนมัติ 18:00 น.' : 'Test mode ปิดแล้ว' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/ftp-archive/revert', requireAuth, async (req, res) => {
  try {
    const { revertArchivedFiles } = await import('./services/ftp-archive');
    const result = await revertArchivedFiles();
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
