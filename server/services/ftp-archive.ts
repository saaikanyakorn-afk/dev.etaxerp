import * as ftp from "basic-ftp";
import { db } from "../db";
import { eq, and, lt, sql, isNull, or, ne } from "drizzle-orm";
import {
  ftpArchiveSettings, ftpArchiveJobs, ftpArchiveItems,
  companyFolderCodes, storeFolderCodes,
  type FtpArchiveSettings, type FtpArchiveJob,
} from "@shared/schema";
import { log } from "../index";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { sanitizeFilename } from "../utils/safe-filename";
import {
  ensureCompanyFolderCode, buildArchivePath, validateArchivePath,
  getDirtyEntries, getAllDirectoryEntries, markSynced,
} from "./folder-codes";
import { getConfig, setConfig, bootstrapConfig } from "../config-bootstrap";

const OBJECT_STORAGE_PREFIX = "/objects/";
const FTP_CONCURRENCY = 3;
const SAFE_DELETE = true; // When true, rename files instead of deleting them (testing safety net)

let _ftpArchiveRunning = false;
export function isFtpArchiveRunning(): boolean { return _ftpArchiveRunning; }
export function setFtpArchiveRunning(v: boolean) { _ftpArchiveRunning = v; }

interface ArchiveableFile {
  sourceTable: string;
  sourceId: number;
  sourceColumn: string;
  localPath: string;
  originalUrl: string;
  fileSize: number;
  companyId: number;
  docDate: string;
}

// FTP Archive config lives in system_config (core infrastructure, excluded from clone).
// This builds a FtpArchiveSettings-compatible object from system_config keys.
export async function getArchiveSettings(): Promise<FtpArchiveSettings | null> {
  const host = getConfig("FTP_HOST");
  if (!host) return null;
  return {
    id: 1,
    enabled: getConfig("FTP_ENABLED") === "true",
    ftpHost: host,
    ftpPort: parseInt(getConfig("FTP_PORT") || "21", 10),
    ftpUser: getConfig("FTP_USER") || null,
    ftpPassword: getConfig("FTP_PASSWORD") || null,
    ftpProtocol: getConfig("FTP_PROTOCOL") || "ftp",
    ftpRemotePath: getConfig("FTP_REMOTE_PATH") || "/archive",
    ftpPassive: getConfig("FTP_PASSIVE") !== "false",
    resumeEnabled: getConfig("FTP_RESUME_ENABLED") !== "false",
    scheduleTime1: getConfig("FTP_SCHEDULE_TIME_1") || "02:00",
    scheduleTime2: getConfig("FTP_SCHEDULE_TIME_2") || "14:00",
    timezone: getConfig("FTP_TIMEZONE") || "Asia/Bangkok",
    fileAgeMonths: parseInt(getConfig("FTP_FILE_AGE_MONTHS") || "12", 10),
    alertAfterDays: parseInt(getConfig("FTP_ALERT_AFTER_DAYS") || "3", 10),
    alertLineRecipientId: parseInt(getConfig("FTP_ALERT_LINE_RECIPIENT_ID") || "0", 10) || null,
    ftpBaseUrl: getConfig("FTP_BASE_URL") || null,
    ftpLanBaseUrl: getConfig("FTP_LAN_BASE_URL") || null,
    testMode: getConfig("FTP_TEST_MODE") === "true",
    updatedAt: null,
    updatedBy: null,
  };
}

// Maps camelCase field names from the UI form to system_config keys
const FIELD_TO_CONFIG_KEY: Record<string, string> = {
  enabled: "FTP_ENABLED",
  ftpHost: "FTP_HOST",
  ftpPort: "FTP_PORT",
  ftpUser: "FTP_USER",
  ftpPassword: "FTP_PASSWORD",
  ftpProtocol: "FTP_PROTOCOL",
  ftpRemotePath: "FTP_REMOTE_PATH",
  ftpPassive: "FTP_PASSIVE",
  resumeEnabled: "FTP_RESUME_ENABLED",
  scheduleTime1: "FTP_SCHEDULE_TIME_1",
  scheduleTime2: "FTP_SCHEDULE_TIME_2",
  timezone: "FTP_TIMEZONE",
  fileAgeMonths: "FTP_FILE_AGE_MONTHS",
  alertAfterDays: "FTP_ALERT_AFTER_DAYS",
  alertLineRecipientId: "FTP_ALERT_LINE_RECIPIENT_ID",
  ftpBaseUrl: "FTP_BASE_URL",
  ftpLanBaseUrl: "FTP_LAN_BASE_URL",
  testMode: "FTP_TEST_MODE",
};

export async function upsertArchiveSettings(data: Partial<FtpArchiveSettings>, _userId?: number) {
  const secretFields = new Set(["ftpPassword"]);
  const failures: string[] = [];
  for (const [field, configKey] of Object.entries(FIELD_TO_CONFIG_KEY)) {
    if (field in data) {
      const rawVal = (data as any)[field];
      const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal);
      const ok = await setConfig(configKey, strVal, undefined, secretFields.has(field));
      if (!ok) failures.push(configKey);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Failed to save FTP config keys: ${failures.join(", ")}`);
  }
  return getArchiveSettings();
}

// One-time migration: copies values from legacy ftp_archive_settings table into system_config.
// Safe to call multiple times — skips if FTP_HOST already has a value in system_config.
export async function migrateFtpSettingsToSystemConfig() {
  const existingHost = getConfig("FTP_HOST");
  if (existingHost) return;

  try {
    const [legacy] = await db.select().from(ftpArchiveSettings).limit(1);
    if (!legacy) return;

    console.log("[FTP Archive] Migrating settings from ftp_archive_settings → system_config");
    const migrations: Record<string, { value: string; secret?: boolean }> = {
      FTP_HOST: { value: legacy.ftpHost || "" },
      FTP_PORT: { value: String(legacy.ftpPort || 21) },
      FTP_USER: { value: legacy.ftpUser || "" },
      FTP_PASSWORD: { value: legacy.ftpPassword || "", secret: true },
      FTP_PROTOCOL: { value: legacy.ftpProtocol || "ftp" },
      FTP_REMOTE_PATH: { value: legacy.ftpRemotePath || "/archive" },
      FTP_PASSIVE: { value: String(legacy.ftpPassive ?? true) },
      FTP_RESUME_ENABLED: { value: String(legacy.resumeEnabled ?? true) },
      FTP_BASE_URL: { value: legacy.ftpBaseUrl || "" },
      FTP_LAN_BASE_URL: { value: legacy.ftpLanBaseUrl || "" },
      FTP_SCHEDULE_TIME_1: { value: legacy.scheduleTime1 || "02:00" },
      FTP_SCHEDULE_TIME_2: { value: legacy.scheduleTime2 || "14:00" },
      FTP_TIMEZONE: { value: legacy.timezone || "Asia/Bangkok" },
      FTP_FILE_AGE_MONTHS: { value: String(legacy.fileAgeMonths ?? 12) },
      FTP_ALERT_AFTER_DAYS: { value: String(legacy.alertAfterDays ?? 3) },
      FTP_ALERT_LINE_RECIPIENT_ID: { value: String(legacy.alertLineRecipientId || "") },
      FTP_ENABLED: { value: String(legacy.enabled ?? false) },
      FTP_TEST_MODE: { value: String(legacy.testMode ?? false) },
    };

    for (const [key, { value, secret }] of Object.entries(migrations)) {
      await setConfig(key, value, `Migrated from ftp_archive_settings`, secret ?? false);
    }
    console.log("[FTP Archive] Migration complete — 18 keys written to system_config");
  } catch (err: any) {
    console.error(`[FTP Archive] Migration failed: ${err.message}`);
  }
}

const MAX_RETRY_ATTEMPTS = 5;

// Recovers orphaned transfers after process restart.
// Items stuck in "transferring" status are reset to "pending" so the scheduler picks them up.
export async function recoverOrphanedTransfers(): Promise<number> {
  try {
    const orphaned = await db.select({ id: ftpArchiveItems.id })
      .from(ftpArchiveItems)
      .where(eq(ftpArchiveItems.status, "transferring"));

    if (orphaned.length === 0) return 0;

    for (const item of orphaned) {
      await db.update(ftpArchiveItems)
        .set({ status: "pending", errorMessage: "Recovered after process restart" })
        .where(eq(ftpArchiveItems.id, item.id));
    }

    console.log(`[FTP Archive] Recovered ${orphaned.length} orphaned transfers → reset to pending`);
    return orphaned.length;
  } catch (err: any) {
    console.error(`[FTP Archive] Recovery failed: ${err.message}`);
    return 0;
  }
}

// Resumes pending items from previous failed/interrupted jobs.
// Called by the scheduler when no new files are found but pending items exist.
export async function resumePendingItems(): Promise<{ jobId: number; success: boolean; message: string }> {
  if (_ftpArchiveRunning) {
    return { jobId: 0, success: false, message: "FTP Archive already running" };
  }
  _ftpArchiveRunning = true;
  try {

  try {
    const { isCloneInProgress } = await import("../maintenance");
    if (await isCloneInProgress()) {
      return { jobId: 0, success: false, message: "Skipped — clone database in progress" };
    }
  } catch {}

  const settings = await getArchiveSettings();
  if (!settings || !settings.enabled) {
    return { jobId: 0, success: false, message: "FTP Archive is disabled" };
  }

  const exhaustedItems = await db.select().from(ftpArchiveItems)
    .where(and(
      or(eq(ftpArchiveItems.status, "pending"), eq(ftpArchiveItems.status, "failed")),
      sql`${ftpArchiveItems.attempts} >= ${MAX_RETRY_ATTEMPTS}`,
    ));

  for (const item of exhaustedItems) {
    await db.update(ftpArchiveItems)
      .set({ status: "failed", errorMessage: `Exceeded max retry attempts (${MAX_RETRY_ATTEMPTS})` })
      .where(eq(ftpArchiveItems.id, item.id));
  }
  if (exhaustedItems.length > 0) {
    console.log(`[FTP Archive] ${exhaustedItems.length} items exceeded ${MAX_RETRY_ATTEMPTS} retries — marked as permanently failed`);
  }

  const pendingItems = await db.select().from(ftpArchiveItems)
    .where(and(
      or(eq(ftpArchiveItems.status, "pending"), eq(ftpArchiveItems.status, "failed")),
      sql`${ftpArchiveItems.attempts} < ${MAX_RETRY_ATTEMPTS}`,
    ))
    .limit(200);

  if (pendingItems.length === 0) {
    return { jobId: 0, success: true, message: "No pending items to resume" };
  }

  console.log(`[FTP Archive] Auto-resume: ${pendingItems.length} pending items found, starting transfer`);

  const [job] = await db.insert(ftpArchiveJobs).values({
    status: "running",
    totalFiles: pendingItems.length,
  }).returning();

  let transferred = 0;
  let failed = 0;
  let skipped = 0;

  const clients: ftp.Client[] = [];
  try {
    for (let i = 0; i < FTP_CONCURRENCY; i++) {
      const c = await createFtpClient(settings);
      clients.push(c);
    }
    console.log(`[FTP Archive] Auto-resume: ${FTP_CONCURRENCY} FTP connections opened`);
  } catch (err: any) {
    console.error(`[FTP Archive] Auto-resume: FTP connection failed: ${err.message}`);
    clients.forEach(c => { try { c.close(); } catch {} });
    await db.update(ftpArchiveJobs)
      .set({ status: "failed", errorSummary: `FTP connection error: ${err.message}`, completedAt: new Date() })
      .where(eq(ftpArchiveJobs.id, job.id));
    return { jobId: job.id, success: false, message: `FTP connection error: ${err.message}` };
  }

  try {
    // Update items to reference this new job
    for (const item of pendingItems) {
      await db.update(ftpArchiveItems)
        .set({ jobId: job.id })
        .where(eq(ftpArchiveItems.id, item.id));
    }

    const chunks: (typeof pendingItems)[] = Array.from({ length: FTP_CONCURRENCY }, () => []);
    pendingItems.forEach((item, i) => chunks[i % FTP_CONCURRENCY].push(item));

    await Promise.all(chunks.map(async (chunk, ci) => {
      for (const item of chunk) {
        const result = await processOneItem(clients[ci], item, settings);
        if (result === "transferred") transferred++;
        else if (result === "failed") failed++;
        else if (result === "skipped") skipped++;
      }
    }));
  } catch (err: any) {
    console.error(`[FTP Archive] Auto-resume transfer error: ${err.message}`);
  } finally {
    clients.forEach(c => { try { c.close(); } catch {} });
  }

  const finalStatus = failed === 0 ? "completed" : transferred > 0 ? "partial" : "failed";
  await db.update(ftpArchiveJobs)
    .set({ status: finalStatus, transferredFiles: transferred, failedFiles: failed, skippedFiles: skipped, completedAt: new Date() })
    .where(eq(ftpArchiveJobs.id, job.id));

  console.log(`[FTP Archive] Auto-resume complete: transferred=${transferred}, failed=${failed}, skipped=${skipped}`);
  return { jobId: job.id, success: failed === 0, message: `Auto-resume: Transferred=${transferred}, Failed=${failed}, Skipped=${skipped}` };

  } finally {
    _ftpArchiveRunning = false;
  }
}

async function createFtpClient(settings: FtpArchiveSettings): Promise<ftp.Client> {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const secure = settings.ftpProtocol === "ftps" || settings.ftpProtocol === "sftp";

  await client.access({
    host: settings.ftpHost || "localhost",
    port: settings.ftpPort || 21,
    user: settings.ftpUser || "anonymous",
    password: settings.ftpPassword || "",
    secure: secure,
    secureOptions: secure ? { rejectUnauthorized: false } : undefined,
  });

  if (settings.ftpPassive) {
    client.ftp.verbose = false;
  }

  return client;
}

async function findOldFiles(settings: FtpArchiveSettings): Promise<ArchiveableFile[]> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - (settings.fileAgeMonths ?? 12));
  
  const files: ArchiveableFile[] = [];

  const tables: { table: string; idCol: string; urlCol: string; dateCol: string }[] = [
    { table: "tax_invoices", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    { table: "quotations", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    { table: "invoices", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    { table: "receipts", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    // purchase_orders does not have attached_url column
    { table: "purchase_invoices", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    { table: "expenses", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
    { table: "withholding_tax_certs", idCol: "id", urlCol: "attached_url", dateCol: "created_at" },
  ];

  log(`FTP Archive: Scanning ${tables.length} tables, cutoffDate=${cutoffDate.toISOString()}`, "ftp-archive");
  for (const t of tables) {
    try {
      const rows = await db.execute(sql.raw(
        `SELECT ${t.idCol} as id, ${t.urlCol} as url, company_id, ${t.dateCol} as doc_date FROM ${t.table} 
         WHERE ${t.urlCol} IS NOT NULL 
         AND ${t.urlCol} != '' 
         AND ${t.dateCol} < '${cutoffDate.toISOString()}'
         AND (${t.urlCol} LIKE '/objects/%' OR ${t.urlCol} LIKE '.private/%' OR ${t.urlCol} LIKE 'public/%')
         AND ${t.idCol} NOT IN (
           SELECT source_id FROM ftp_archive_items 
           WHERE source_table = '${t.table}' 
           AND source_column = '${t.urlCol}'
           AND (status = 'completed' OR status = 'transferring')
         )
         LIMIT 500`
      ));

      for (const row of rows.rows as any[]) {
        if (row.url) {
          const localPath = row.url.startsWith(OBJECT_STORAGE_PREFIX)
            ? row.url.replace(OBJECT_STORAGE_PREFIX, "")
            : row.url;
          const docDate = row.doc_date ? new Date(row.doc_date).toISOString() : new Date().toISOString();
          files.push({
            sourceTable: t.table,
            sourceId: row.id,
            sourceColumn: t.urlCol,
            localPath: localPath,
            originalUrl: row.url,
            fileSize: 0,
            companyId: row.company_id,
            docDate,
          });
        }
      }
    } catch (err: any) {
      log(`FTP Archive: Error scanning table ${t.table}: ${err.message}`, "ftp-archive");
    }
  }

  return files;
}

async function getRemoteFileSize(client: ftp.Client, remotePath: string): Promise<number> {
  try {
    return await client.size(remotePath);
  } catch {
    return -1;
  }
}

async function ensureRemoteDir(client: ftp.Client, remotePath: string) {
  const dir = path.dirname(remotePath);
  try {
    await client.ensureDir(dir);
    await client.cd("/");
  } catch (err: any) {
    log(`FTP Archive: Could not create remote dir ${dir}: ${err.message}`, "ftp-archive");
  }
}

type ProcessResult = "transferred" | "failed" | "skipped";

async function processOneItem(client: ftp.Client, item: any, settings: FtpArchiveSettings): Promise<ProcessResult> {
  try {
    await db.update(ftpArchiveItems)
      .set({ status: "transferring", lastAttemptAt: new Date(), firstAttemptAt: item.firstAttemptAt || new Date(), attempts: (item.attempts || 0) + 1 })
      .where(eq(ftpArchiveItems.id, item.id));

    const objectKey = item.localPath;
    let localFileBuffer: Buffer | null = null;
    let localSize = 0;

    try {
      const { Client: ObjClient } = await import("@replit/object-storage");
      const objClient = new ObjClient({ bucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID });
      const result = await objClient.downloadAsBytes(objectKey);
      if (result.ok && result.value) {
        localFileBuffer = Buffer.from(result.value as unknown as ArrayBuffer);
        localSize = localFileBuffer.length;
      }
    } catch (err: any) {
      log(`FTP Archive: Could not read object ${objectKey}: ${err.message}`, "ftp-archive");
      await db.update(ftpArchiveItems)
        .set({ status: "failed", errorMessage: `Object read error: ${err.message}` })
        .where(eq(ftpArchiveItems.id, item.id));
      return "failed";
    }

    if (!localFileBuffer || localSize === 0) {
      await db.update(ftpArchiveItems)
        .set({ status: "skipped", errorMessage: "File not found or empty" })
        .where(eq(ftpArchiveItems.id, item.id));
      return "skipped";
    }

    await db.update(ftpArchiveItems)
      .set({ fileSize: String(localSize) })
      .where(eq(ftpArchiveItems.id, item.id));

    const remotePath = item.remotePath!;
    await ensureRemoteDir(client, remotePath);

    const remoteSize = await getRemoteFileSize(client, remotePath);

    if (remoteSize === localSize) {
      await db.update(ftpArchiveItems)
        .set({
          status: "completed",
          transferredSize: String(localSize),
          verified: true,
          completedAt: new Date(),
          archivedUrl: `${settings.ftpBaseUrl || ""}${remotePath}`,
        })
        .where(eq(ftpArchiveItems.id, item.id));

      await cleanupObjectStorage(objectKey);
      return "transferred";
    }

    const safeTmpName = sanitizeFilename(path.basename(item.localPath), { prefix: `ftp_archive_${item.id}_` });
    const tmpPath = path.join(os.tmpdir(), safeTmpName);
    fs.writeFileSync(tmpPath, localFileBuffer);

    try {
      if (settings.resumeEnabled && remoteSize > 0 && remoteSize < localSize) {
        log(`FTP Archive: Resuming item ${item.id} from byte ${remoteSize}/${localSize}`, "ftp-archive");
        const readStream = fs.createReadStream(tmpPath, { start: remoteSize });
        await client.appendFrom(readStream, remotePath);
      } else {
        await client.uploadFrom(tmpPath, remotePath);
      }

      const verifiedSize = await getRemoteFileSize(client, remotePath);
      if (verifiedSize === localSize) {
        await db.update(ftpArchiveItems)
          .set({
            status: "completed",
            transferredSize: String(localSize),
            verified: true,
            completedAt: new Date(),
            archivedUrl: `${settings.ftpBaseUrl || ""}${remotePath}`,
          })
          .where(eq(ftpArchiveItems.id, item.id));

        await cleanupObjectStorage(objectKey);
        return "transferred";
      } else {
        await db.update(ftpArchiveItems)
          .set({
            status: "failed",
            transferredSize: String(verifiedSize >= 0 ? verifiedSize : 0),
            errorMessage: `Size mismatch: local=${localSize}, remote=${verifiedSize}`,
          })
          .where(eq(ftpArchiveItems.id, item.id));
        return "failed";
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }

  } catch (err: any) {
    log(`FTP Archive: Error transferring item ${item.id}: ${err.message}`, "ftp-archive");
    await db.update(ftpArchiveItems)
      .set({ status: "failed", errorMessage: err.message })
      .where(eq(ftpArchiveItems.id, item.id));
    return "failed";
  }
}

async function cleanupObjectStorage(objectKey: string) {
  try {
    const { Client: ObjClient } = await import("@replit/object-storage");
    const objClient = new ObjClient({ bucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID });
    if (SAFE_DELETE) {
      const archivedKey = objectKey + ".archived";
      await objClient.copy(objectKey, archivedKey);
      await objClient.delete(objectKey);
      log(`FTP Archive: Object Storage renamed ${objectKey} → ${archivedKey}`, "ftp-archive");
    } else {
      await objClient.delete(objectKey);
      log(`FTP Archive: Object Storage deleted ${objectKey}`, "ftp-archive");
    }
  } catch (cleanupErr: any) {
    log(`FTP Archive: Object Storage cleanup failed for ${objectKey}: ${cleanupErr.message}`, "ftp-archive");
  }
}

export async function runArchiveJob(): Promise<{ jobId: number; success: boolean; message: string }> {
  if (_ftpArchiveRunning) {
    return { jobId: 0, success: false, message: "FTP Archive already running" };
  }
  _ftpArchiveRunning = true;
  try {

  try {
    const { isCloneInProgress } = await import("../maintenance");
    if (await isCloneInProgress()) {
      console.log("[FTP Archive] Skipped — clone database is in progress");
      return { jobId: 0, success: false, message: "Skipped — clone database in progress" };
    }
  } catch {}

  const settings = await getArchiveSettings();
  if (!settings || !settings.enabled) {
    return { jobId: 0, success: false, message: "FTP Archive is disabled or not configured" };
  }

  if (!settings.ftpHost || !settings.ftpUser) {
    return { jobId: 0, success: false, message: "FTP host or user not configured" };
  }

  const oldFiles = await findOldFiles(settings);
  log(`FTP Archive: findOldFiles returned ${oldFiles.length} files (fileAgeMonths=${settings.fileAgeMonths}, enabled=${settings.enabled})`, "ftp-archive");
  if (oldFiles.length === 0) {
    return { jobId: 0, success: true, message: "No files to archive" };
  }

  const [job] = await db.insert(ftpArchiveJobs).values({
    status: "running",
    totalFiles: oldFiles.length,
  }).returning();

  const companyCodeCache = new Map<number, string>();
  async function resolveCompanyCode(companyId: number): Promise<string> {
    if (companyCodeCache.has(companyId)) return companyCodeCache.get(companyId)!;
    const fc = await ensureCompanyFolderCode(companyId);
    companyCodeCache.set(companyId, fc.folderCode);
    return fc.folderCode;
  }

  const ftpRoot = settings.ftpRemotePath || "/archive";
  const items = await Promise.all(oldFiles.map(async (f) => {
    const companyCode = await resolveCompanyCode(f.companyId);
    const filename = sanitizeFilename(path.basename(f.localPath));
    const relativePath = buildArchivePath(companyCode, null, f.docDate, filename);
    const pathCheck = validateArchivePath(ftpRoot, relativePath);

    let finalRelativePath = relativePath;
    if (!pathCheck.valid) {
      const maxFilenameBytes = Math.max(30, 260 - 45 - ftpRoot.length - companyCode.length - 10 - 4);
      const shortened = sanitizeFilename(path.basename(f.localPath), { maxBytes: maxFilenameBytes });
      finalRelativePath = buildArchivePath(companyCode, null, f.docDate, shortened);
      const recheck = validateArchivePath(ftpRoot, finalRelativePath);
      if (!recheck.valid) {
        log(`FTP Archive: Path still too long (${recheck.length} chars) for ${f.sourceTable}#${f.sourceId}, using hash`, "ftp-archive");
        const crypto = await import("crypto");
        const hash = crypto.randomBytes(8).toString("hex");
        const ext = path.extname(f.localPath) || "";
        finalRelativePath = buildArchivePath(companyCode, null, f.docDate, `${hash}${ext}`);
      }
    }

    return db.insert(ftpArchiveItems).values({
      jobId: job.id,
      sourceTable: f.sourceTable,
      sourceId: f.sourceId,
      sourceColumn: f.sourceColumn,
      localPath: f.localPath,
      remotePath: `${ftpRoot}/${finalRelativePath}`,
      fileSize: "0",
      status: "pending",
      originalUrl: f.originalUrl,
    }).returning();
  }));

  let transferred = 0;
  let failed = 0;
  let skipped = 0;

  const clients: ftp.Client[] = [];
  try {
    for (let i = 0; i < FTP_CONCURRENCY; i++) {
      const c = await createFtpClient(settings);
      clients.push(c);
    }
    log(`FTP Archive: ${FTP_CONCURRENCY} connections opened to ${settings.ftpHost}`, "ftp-archive");
  } catch (err: any) {
    log(`FTP Archive: FTP connection error: ${err.message}`, "ftp-archive");
    clients.forEach(c => { try { c.close(); } catch {} });
    await db.update(ftpArchiveJobs)
      .set({ status: "failed", errorSummary: `FTP connection error: ${err.message}`, completedAt: new Date(), transferredFiles: 0, failedFiles: 0, skippedFiles: 0 })
      .where(eq(ftpArchiveJobs.id, job.id));
    return { jobId: job.id, success: false, message: `FTP connection error: ${err.message}` };
  }

  try {
    const allItems = items.map(([item]) => item);
    const chunks: (typeof allItems[0])[][] = Array.from({ length: FTP_CONCURRENCY }, () => []);
    allItems.forEach((item, i) => chunks[i % FTP_CONCURRENCY].push(item));

    await Promise.all(chunks.map(async (chunk, ci) => {
      for (const item of chunk) {
        const result = await processOneItem(clients[ci], item, settings);
        if (result === "transferred") transferred++;
        else if (result === "failed") failed++;
        else if (result === "skipped") skipped++;
      }
    }));
  } catch (err: any) {
    log(`FTP Archive: Transfer error: ${err.message}`, "ftp-archive");
  } finally {
    clients.forEach(c => { try { c.close(); } catch {} });
  }

  const finalStatus = failed === 0 ? "completed" : transferred > 0 ? "partial" : "failed";
  await db.update(ftpArchiveJobs)
    .set({ status: finalStatus, transferredFiles: transferred, failedFiles: failed, skippedFiles: skipped, completedAt: new Date() })
    .where(eq(ftpArchiveJobs.id, job.id));

  try {
    const dirty = await getDirtyEntries();
    if (dirty.companies.length > 0 || dirty.stores.length > 0) {
      await syncDirectoryIndex();
    }
  } catch (err: any) {
    log(`FTP Archive: Directory sync after archive: ${err.message}`, "ftp-archive");
  }

  return {
    jobId: job.id,
    success: failed === 0,
    message: `Transferred: ${transferred}, Failed: ${failed}, Skipped: ${skipped}`,
  };

  } finally {
    _ftpArchiveRunning = false;
  }
}

export async function updateArchivedLinks(): Promise<number> {
  const completedItems = await db.select().from(ftpArchiveItems)
    .where(and(
      eq(ftpArchiveItems.status, "completed"),
      eq(ftpArchiveItems.verified, true),
      eq(ftpArchiveItems.linkUpdated, false),
    ))
    .limit(200);

  let updated = 0;
  for (const item of completedItems) {
    try {
      if (!item.archivedUrl) continue;

      await db.execute(sql.raw(
        `UPDATE ${item.sourceTable} SET ${item.sourceColumn} = '${item.archivedUrl}' WHERE id = ${item.sourceId}`
      ));

      await db.update(ftpArchiveItems)
        .set({ linkUpdated: true })
        .where(eq(ftpArchiveItems.id, item.id));
      updated++;
    } catch (err: any) {
      log(`FTP Archive: Error updating link for item ${item.id}: ${err.message}`, "ftp-archive");
    }
  }

  return updated;
}

export async function checkStaleTransfers(): Promise<{ staleCount: number; alerted: boolean }> {
  const settings = await getArchiveSettings();
  if (!settings) return { staleCount: 0, alerted: false };

  const alertDays = settings.alertAfterDays || 3;
  const cutoff = new Date(Date.now() - alertDays * 86400000);

  const staleItems = await db.select().from(ftpArchiveItems)
    .where(and(
      or(eq(ftpArchiveItems.status, "failed"), eq(ftpArchiveItems.status, "pending")),
      lt(ftpArchiveItems.createdAt, cutoff),
      eq(ftpArchiveItems.linkUpdated, false),
    ));

  if (staleItems.length === 0) return { staleCount: 0, alerted: false };

  let alerted = false;
  try {
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken && settings.alertLineRecipientId) {
      const [recipient] = await db.execute(sql.raw(
        `SELECT line_user_id FROM line_recipients WHERE id = ${settings.alertLineRecipientId}`
      )).then(r => r.rows as any[]);

      if (recipient?.line_user_id) {
        const message = `⚠️ FTP Archive Alert\n\n${staleItems.length} ไฟล์ transfer ไม่สำเร็จเกิน ${alertDays} วัน\n\nกรุณาตรวจสอบการเชื่อมต่อ FTP Server\n\nรายละเอียด:\n- Failed: ${staleItems.filter(i => i.status === "failed").length}\n- Pending: ${staleItems.filter(i => i.status === "pending").length}`;

        const response = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: recipient.line_user_id,
            messages: [{ type: "text", text: message }],
          }),
        });

        alerted = response.ok;
        if (!response.ok) {
          log(`FTP Archive: LINE alert failed: ${response.statusText}`, "ftp-archive");
        }
      }
    }
  } catch (err: any) {
    log(`FTP Archive: Error sending LINE alert: ${err.message}`, "ftp-archive");
  }

  return { staleCount: staleItems.length, alerted };
}

export async function retryFailedItems(): Promise<number> {
  const failedItems = await db.select().from(ftpArchiveItems)
    .where(and(
      eq(ftpArchiveItems.status, "failed"),
      eq(ftpArchiveItems.linkUpdated, false),
    ))
    .limit(100);

  if (failedItems.length === 0) return 0;

  let retried = 0;
  for (const item of failedItems) {
    await db.update(ftpArchiveItems)
      .set({ status: "pending", errorMessage: null })
      .where(eq(ftpArchiveItems.id, item.id));
    retried++;
  }

  return retried;
}

export async function getArchiveJobs(limit = 20) {
  return db.select().from(ftpArchiveJobs)
    .orderBy(sql`${ftpArchiveJobs.startedAt} DESC`)
    .limit(limit);
}

export async function getArchiveJobItems(jobId: number) {
  return db.select().from(ftpArchiveItems)
    .where(eq(ftpArchiveItems.jobId, jobId))
    .orderBy(sql`${ftpArchiveItems.createdAt} DESC`);
}

export async function getArchiveStats() {
  const [stats] = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'transferring') as transferring,
      COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN file_size::bigint ELSE 0 END), 0) as archived_bytes,
      COUNT(*) as total
    FROM ftp_archive_items
  `).then(r => r.rows);

  return stats;
}

export async function getLastRunStats() {
  const [lastJob] = await db.select().from(ftpArchiveJobs)
    .orderBy(sql`${ftpArchiveJobs.startedAt} DESC`)
    .limit(1);

  if (!lastJob) return null;

  const durationMs = lastJob.completedAt && lastJob.startedAt
    ? new Date(lastJob.completedAt).getTime() - new Date(lastJob.startedAt).getTime()
    : null;

  const itemStats = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
      COUNT(*) FILTER (WHERE status = 'transferring') as transferring,
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN file_size::bigint ELSE 0 END), 0) as total_bytes,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN transferred_size::bigint ELSE 0 END), 0) as transferred_bytes,
      COALESCE(MAX(attempts), 0) as max_attempts,
      MIN(first_attempt_at) as earliest_start,
      MAX(completed_at) as latest_finish,
      COUNT(*) FILTER (WHERE verified = true) as verified_count
    FROM ftp_archive_items
    WHERE job_id = ${lastJob.id}
  `).then(r => r.rows[0] as any);

  const throughputBytesPerSec = durationMs && durationMs > 0 && itemStats.transferred_bytes
    ? Math.round(parseInt(itemStats.transferred_bytes) / (durationMs / 1000))
    : 0;

  return {
    jobId: lastJob.id,
    status: lastJob.status,
    startedAt: lastJob.startedAt,
    completedAt: lastJob.completedAt,
    durationMs,
    totalFiles: lastJob.totalFiles,
    transferredFiles: lastJob.transferredFiles,
    failedFiles: lastJob.failedFiles,
    skippedFiles: lastJob.skippedFiles,
    errorSummary: lastJob.errorSummary,
    items: {
      completed: parseInt(itemStats.completed) || 0,
      failed: parseInt(itemStats.failed) || 0,
      pending: parseInt(itemStats.pending) || 0,
      skipped: parseInt(itemStats.skipped) || 0,
      transferring: parseInt(itemStats.transferring) || 0,
      total: parseInt(itemStats.total) || 0,
      totalBytes: itemStats.total_bytes || "0",
      transferredBytes: itemStats.transferred_bytes || "0",
      maxAttempts: parseInt(itemStats.max_attempts) || 0,
      verifiedCount: parseInt(itemStats.verified_count) || 0,
    },
    throughputBytesPerSec,
  };
}

export async function syncDirectoryIndex(): Promise<{ success: boolean; message: string; dirtyCount: number }> {
  const settings = await getArchiveSettings();
  if (!settings || !settings.enabled || !settings.ftpHost) {
    return { success: false, message: "FTP Archive not configured", dirtyCount: 0 };
  }

  const dirty = await getDirtyEntries();
  const dirtyCount = dirty.companies.length + dirty.stores.length;

  const directory = await getAllDirectoryEntries();
  const directoryJson = JSON.stringify(directory, null, 2);

  let client: ftp.Client | null = null;
  try {
    client = await createFtpClient(settings);
    const ftpRoot = settings.ftpRemotePath || "/archive";

    const tmpPath = path.join(os.tmpdir(), `ftp_directory_${Date.now()}.json`);
    fs.writeFileSync(tmpPath, directoryJson, "utf8");

    try {
      await client.ensureDir(ftpRoot);
      await client.cd("/");
      await client.uploadFrom(tmpPath, `${ftpRoot}/directory.json`);

      const txtLines: string[] = [
        "# Archive Directory Index",
        `# Generated: ${new Date().toISOString()}`,
        "",
        "## Companies",
        ...directory.companies.map(c =>
          `${c.folderCode}\t${c.displayName}\t${c.taxId || "-"}\t${c.active ? "active" : "inactive"}`
        ),
        "",
        "## Stores",
        ...directory.stores.map(s =>
          `${s.companyFolderCode}/${s.folderCode}\t${s.displayName}\t${s.platform || "-"}\t${s.active ? "active" : "inactive"}`
        ),
      ];
      const txtPath = path.join(os.tmpdir(), `ftp_directory_${Date.now()}.txt`);
      fs.writeFileSync(txtPath, txtLines.join("\n"), "utf8");
      await client.uploadFrom(txtPath, `${ftpRoot}/directory.txt`);
      try { fs.unlinkSync(txtPath); } catch {}
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }

    for (const c of dirty.companies) {
      await markSynced("company", c.id);
    }
    for (const s of dirty.stores) {
      await markSynced("store", s.id);
    }

    log(`FTP Archive: Directory index synced (${dirtyCount} dirty entries)`, "ftp-archive");
    return { success: true, message: `Directory index synced, ${dirtyCount} entries updated`, dirtyCount };
  } catch (err: any) {
    log(`FTP Archive: Directory sync error: ${err.message}`, "ftp-archive");
    return { success: false, message: `Sync error: ${err.message}`, dirtyCount };
  } finally {
    if (client) {
      try { client.close(); } catch {}
    }
  }
}

export async function revertArchivedFiles(): Promise<{ success: boolean; reverted: number; failed: number; message: string }> {
  const settings = await getArchiveSettings();
  if (!settings || !settings.testMode) {
    return { success: false, reverted: 0, failed: 0, message: "Test mode is not enabled" };
  }

  const completedItems = await db.select().from(ftpArchiveItems)
    .where(and(
      eq(ftpArchiveItems.status, "completed"),
      eq(ftpArchiveItems.verified, true),
    ))
    .limit(500);

  if (completedItems.length === 0) {
    return { success: true, reverted: 0, failed: 0, message: "No archived files to revert" };
  }

  log(`FTP Archive [TEST MODE]: Reverting ${completedItems.length} archived files back to Object Storage`, "ftp-archive");

  let reverted = 0;
  let failed = 0;

  const clients: ftp.Client[] = [];
  try {
    for (let i = 0; i < FTP_CONCURRENCY; i++) {
      clients.push(await createFtpClient(settings));
    }
  } catch (err: any) {
    log(`FTP Archive [REVERT]: FTP connection error: ${err.message}`, "ftp-archive");
    clients.forEach(c => { try { c.close(); } catch {} });
    return { success: false, reverted: 0, failed: completedItems.length, message: `FTP connection error: ${err.message}` };
  }

  try {
    const chunks: (typeof completedItems)[] = Array.from({ length: FTP_CONCURRENCY }, () => []);
    completedItems.forEach((item, i) => chunks[i % FTP_CONCURRENCY].push(item));

    async function revertItem(client: ftp.Client, item: typeof completedItems[0]) {
      try {
        if (!item.remotePath || !item.originalUrl || !item.localPath) {
          log(`FTP Archive [REVERT]: Skipping item #${item.id} — missing path info`, "ftp-archive");
          failed++;
          return;
        }

        let fileBuffer: Buffer | null = null;
        const tmpPath = path.join(os.tmpdir(), `ftp_revert_${item.id}_${Date.now()}`);
        try {
          await client.downloadTo(tmpPath, item.remotePath);
          fileBuffer = fs.readFileSync(tmpPath);
        } catch (dlErr: any) {
          log(`FTP Archive [REVERT]: Could not download ${item.remotePath}: ${dlErr.message}`, "ftp-archive");
          failed++;
          try { fs.unlinkSync(tmpPath); } catch {}
          return;
        }

        try {
          const { Client: ObjClient } = await import("@replit/object-storage");
          const objClient = new ObjClient({ bucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID });
          await objClient.uploadFromBytes(item.localPath, fileBuffer);
          log(`FTP Archive [REVERT]: Re-uploaded to Object Storage: ${item.localPath}`, "ftp-archive");
        } catch (uploadErr: any) {
          log(`FTP Archive [REVERT]: Could not upload to Object Storage ${item.localPath}: ${uploadErr.message}`, "ftp-archive");
          failed++;
          try { fs.unlinkSync(tmpPath); } catch {}
          return;
        }

        try { fs.unlinkSync(tmpPath); } catch {}

        if (item.linkUpdated && item.originalUrl) {
          try {
            await db.execute(sql.raw(
              `UPDATE ${item.sourceTable} SET ${item.sourceColumn} = '${item.originalUrl}' WHERE id = ${item.sourceId}`
            ));
          } catch (updateErr: any) {
            log(`FTP Archive [REVERT]: Could not restore URL for ${item.sourceTable}#${item.sourceId}: ${updateErr.message}`, "ftp-archive");
          }
        }

        if (SAFE_DELETE) {
          try {
            const renamedPath = item.remotePath + ".reverted";
            await client.rename(item.remotePath, renamedPath);
            log(`FTP Archive [REVERT]: Renamed ${item.remotePath} → ${renamedPath}`, "ftp-archive");
          } catch (renameErr: any) {
            log(`FTP Archive [REVERT]: Could not rename FTP file ${item.remotePath}: ${renameErr.message}`, "ftp-archive");
          }
        } else {
          try {
            await client.remove(item.remotePath);
          } catch (rmErr: any) {
            log(`FTP Archive [REVERT]: Could not delete FTP file ${item.remotePath}: ${rmErr.message}`, "ftp-archive");
          }
        }

        await db.delete(ftpArchiveItems).where(eq(ftpArchiveItems.id, item.id));
        reverted++;
        log(`FTP Archive [REVERT]: ✓ Reverted item #${item.id} (${item.sourceTable}#${item.sourceId})`, "ftp-archive");

      } catch (err: any) {
        log(`FTP Archive [REVERT]: Error on item #${item.id}: ${err.message}`, "ftp-archive");
        failed++;
      }
    }

    await Promise.all(chunks.map(async (chunk, ci) => {
      for (const item of chunk) {
        await revertItem(clients[ci], item);
      }
    }));

    const jobIds = [...new Set(completedItems.map(i => i.jobId).filter(Boolean))];
    for (const jobId of jobIds) {
      if (!jobId) continue;
      const remaining = await db.select().from(ftpArchiveItems)
        .where(eq(ftpArchiveItems.jobId, jobId))
        .limit(1);
      if (remaining.length === 0) {
        await db.delete(ftpArchiveJobs).where(eq(ftpArchiveJobs.id, jobId));
        log(`FTP Archive [REVERT]: Cleaned up empty job #${jobId}`, "ftp-archive");
      }
    }

  } catch (err: any) {
    log(`FTP Archive [REVERT]: Transfer error: ${err.message}`, "ftp-archive");
    return { success: false, reverted, failed, message: `FTP error: ${err.message}` };
  } finally {
    clients.forEach(c => { try { c.close(); } catch {} });
  }

  const msg = `Reverted: ${reverted}, Failed: ${failed}`;
  log(`FTP Archive [TEST MODE]: Revert complete — ${msg}`, "ftp-archive");
  return { success: failed === 0, reverted, failed, message: msg };
}

export async function testFtpConnection(settings: Partial<FtpArchiveSettings>): Promise<{ success: boolean; message: string }> {
  let client: ftp.Client | null = null;
  try {
    client = new ftp.Client();
    const secure = settings.ftpProtocol === "ftps" || settings.ftpProtocol === "sftp";

    await client.access({
      host: settings.ftpHost || "localhost",
      port: settings.ftpPort || 21,
      user: settings.ftpUser || "anonymous",
      password: settings.ftpPassword || "",
      secure: secure,
      secureOptions: secure ? { rejectUnauthorized: false } : undefined,
    });

    const list = await client.list(settings.ftpRemotePath || "/");
    return { success: true, message: `เชื่อมต่อสำเร็จ — พบ ${list.length} ไฟล์/โฟลเดอร์ใน ${settings.ftpRemotePath || "/"}` };
  } catch (err: any) {
    return { success: false, message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` };
  } finally {
    if (client) {
      try { client.close(); } catch {}
    }
  }
}
