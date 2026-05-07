import type { Express } from "express";
import { db } from "../db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../route-middleware";
import { getTimingLog, getTimingSummary, clearTimingLog } from "./report-cache";
import { getMaintenanceStatus, activateNow, liftMaintenance, isMaintenanceMode, createSchedule, rescheduleSchedule, cancelSchedule, hasCompletedMaintenanceToday, getScheduleHistory } from "../maintenance";
import { execSync } from "child_process";
import { getConfig } from "../config-bootstrap";

const ARCHIVE_SIZE_WARN_MB = 200;
let archiveSizeWarned = false;

export async function archiveOrphanedContacts(companyId?: number): Promise<{ archived: number; skippedDuplicates: number }> {
  const companyFilter = companyId ? sql`AND c.company_id = ${companyId}` : sql``;
  const result = await db.execute(sql`
    WITH orphaned AS (
      SELECT c.* FROM contacts c
      WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM quotations WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM receipts WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM invoices WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM tax_invoices WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM sales_orders WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM sales_credit_notes WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM billing_notes WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM deposit_receipts WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM pos_transactions WHERE customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM purchase_invoices WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM purchase_requests WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM purchase_deposits WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM purchase_debit_notes WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM payment_vouchers WHERE vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM withholding_tax_certs WHERE payee_vendor_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM firm_clients WHERE contact_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM pipeline_deals WHERE contact_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM supplier_portal_tokens WHERE contact_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM supplier_quotes WHERE contact_id = c.id)
        ${companyFilter}
    ),
    new_orphaned AS (
      SELECT o.* FROM orphaned o
      WHERE NOT EXISTS (SELECT 1 FROM contacts_archive ca WHERE ca.id = o.id)
    ),
    inserted AS (
      INSERT INTO contacts_archive (
        id, company_id, code, name, name_en, name_zh, type, tax_id, branch,
        address, address_en, address_zh, phone, email, contact_person,
        credit_days, notes, active, created_at, postcode, building_number,
        district_code, subdistrict_code, province_code, rd_code, dbd_code,
        sso_code, portal_password, service_fee, archived_at, archive_reason,
        origin_company_name, reference_snapshot
      )
      SELECT
        n.id, n.company_id, n.code, n.name, n.name_en, n.name_zh, n.type, n.tax_id, n.branch,
        n.address, n.address_en, n.address_zh, n.phone, n.email, n.contact_person,
        n.credit_days, n.notes, n.active, n.created_at, n.postcode, n.building_number,
        n.district_code, n.subdistrict_code, n.province_code, n.rd_code, n.dbd_code,
        n.sso_code, n.portal_password, n.service_fee, NOW(), 'orphaned_auto_archive',
        co.name,
        jsonb_build_object(
          'contactType', n.type,
          'hadDocuments', false,
          'archivedFrom', 'contacts table (id=' || n.id || ')',
          'originalCode', n.code,
          'taxId', COALESCE(n.tax_id, ''),
          'note', 'ไม่มีเอกสารอ้างอิง (orphaned) — ย้ายเข้าคลังจัดเก็บอัตโนมัติ'
        )
      FROM new_orphaned n
      LEFT JOIN companies co ON co.id = n.company_id
      RETURNING contacts_archive.id
    )
    SELECT
      (SELECT COUNT(*)::int FROM inserted) as archived,
      (SELECT COUNT(*)::int FROM orphaned) - (SELECT COUNT(*)::int FROM new_orphaned) as skipped_duplicates
  `);
  const row = result[0] as any;
  const archived = Number(row?.archived || 0);
  const skippedDuplicates = Number(row?.skipped_duplicates || 0);
  if (archived > 0) {
    await db.execute(sql`DELETE FROM contacts WHERE id IN (SELECT id FROM contacts_archive WHERE archive_reason = 'orphaned_auto_archive' AND archived_at >= NOW() - INTERVAL '1 minute')`);
    console.log(`[Archive] Archived ${archived} orphaned contacts${companyId ? ` (company ${companyId})` : ''}, skipped ${skippedDuplicates} already-in-archive`);
  }
  return { archived, skippedDuplicates };
}

async function checkContactsArchiveSize(): Promise<{ sizeBytes: number; sizeMb: number; sizePretty: string; records: number; warning: boolean }> {
  const [sizeRow] = await db.execute(sql`SELECT pg_total_relation_size('contacts_archive') as size_bytes, pg_size_pretty(pg_total_relation_size('contacts_archive')) as size_pretty`);
  const [countRow] = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM contacts_archive`);
  const sizeBytes = Number((sizeRow as any).size_bytes || 0);
  const sizeMb = Math.round(sizeBytes / 1024 / 1024 * 100) / 100;
  const warning = sizeMb >= ARCHIVE_SIZE_WARN_MB;
  if (warning && !archiveSizeWarned) {
    console.warn(`[SYSADMIN WARNING] contacts_archive table size ${(sizeRow as any).size_pretty} exceeds ${ARCHIVE_SIZE_WARN_MB}MB threshold! (${(countRow as any).cnt} records)`);
    archiveSizeWarned = true;
  }
  return { sizeBytes, sizeMb, sizePretty: (sizeRow as any).size_pretty, records: Number((countRow as any).cnt || 0), warning };
}

function getGitVersion(): { hash: string; shortHash: string; date: string; message: string; version: string } {
  let version = "1.0.0";
  try { version = require("fs").readFileSync(require("path").join(process.cwd(), "VERSION"), "utf-8").trim(); } catch {}

  if (process.env.NODE_ENV === "production") {
    try {
      const fs = require("fs");
      const versionPath = require("path").join(__dirname, "..", "version.json");
      if (fs.existsSync(versionPath)) {
        const data = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
        return { ...data, version: data.version || version };
      }
    } catch {}
  }
  try {
    const shortHash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf-8" }).trim();
    const hash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    const date = execSync('git log -1 --format="%ci"', { encoding: "utf-8" }).trim();
    const message = execSync('git log -1 --format="%s"', { encoding: "utf-8" }).trim();
    return { hash, shortHash, date, message, version };
  } catch {
    return { hash: "unknown", shortHash: "unknown", date: new Date().toISOString(), message: "", version };
  }
}
const BUILD_VERSION = getGitVersion();


export function registerMiscRoutes(app: Express) {
app.get("/api/version", (_req, res) => {
  res.json(BUILD_VERSION);
});

app.get("/api/share-base-url", (req, res) => {
  const host = req.get("host");
  if (!host) {
    throw new Error("Server cannot determine its own host — check reverse proxy Host header configuration");
  }
  const proto = req.get("x-forwarded-proto") || req.protocol;
  res.json({ url: `${proto}://${host}` });
});

app.get("/api/public-config", (_req, res) => {
  res.json({ recaptchaSiteKey: getConfig("RECAPTCHA_SITE_KEY", "RECAPTCHA_SITE_KEY") });
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

app.get("/api/sysadmin/contacts-archive-status", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const archiveStatus = await checkContactsArchiveSize();
    const [mainRow] = await db.execute(sql`SELECT COUNT(*)::int as cnt, pg_size_pretty(pg_total_relation_size('contacts')) as size FROM contacts`);
    res.json({
      archive: archiveStatus,
      main: { records: Number((mainRow as any).cnt || 0), sizePretty: (mainRow as any).size },
      thresholdMb: ARCHIVE_SIZE_WARN_MB,
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/sysadmin/contacts-archive-run", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.body.companyId ? Number(req.body.companyId) : undefined;
    const result = await archiveOrphanedContacts(companyId);
    const archiveStatus = await checkContactsArchiveSize();
    res.json({ ...result, archive: archiveStatus });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

setTimeout(async () => {
  try {
    await checkContactsArchiveSize();
  } catch (e) {}
}, 10000);

// ── Exchange rate helpers ──────────────────────────────────────────────────

function parseRateFromHtml(html: string, currency: string): { buying: number; selling: number } | null {
  const esc = currency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`alt=["']${esc}["'][^>]*/>[\\s\\S]{0,500}?<\\/td>[\\s\\S]{0,100}?<td[^>]*>\\s*([\\d.]+)\\s*<\\/td>[\\s\\S]{0,150}?<td[^>]*>\\s*([\\d.]+)`, "i"),
    new RegExp(`<(?:strong|b)>\\s*${esc}\\s*<\\/(?:strong|b)>[\\s\\S]{0,500}?<\\/td>[\\s\\S]{0,100}?<td[^>]*>\\s*([\\d.]+)\\s*<\\/td>[\\s\\S]{0,150}?<td[^>]*>\\s*([\\d.]+)`, "i"),
    new RegExp(`<td[^>]*>[^<]{0,40}${esc}[^<]{0,40}<\\/td>[\\s\\S]{0,150}?<td[^>]*>\\s*([\\d.]+)\\s*<\\/td>[\\s\\S]{0,150}?<td[^>]*>\\s*([\\d.]+)`, "i"),
    new RegExp(`\\b${esc}\\b[\\s\\S]{1,700}?([\\d]+(?:\\.[\\d]+)?)[\\s\\S]{1,500}?([\\d]+(?:\\.[\\d]+)?)`, "i"),
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const v1 = parseFloat(m[1]);
      const v2 = parseFloat(m[2]);
      if (v1 > 0 && v2 > 0 && Math.abs(v1 - v2) / Math.max(v1, v2) < 0.5) {
        return { buying: Math.min(v1, v2), selling: Math.max(v1, v2) };
      }
    }
  }
  return null;
}

async function fetchFromSecondary(currency: string, dbConn: typeof db): Promise<{
  thb: number; buying: number; selling: number; bankName: string;
} | null> {
  try {
    const { sql } = await import("drizzle-orm");
    const [urlRow, nameRow] = await Promise.all([
      dbConn.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'EXCHANGE_RATE_SECONDARY_URL' LIMIT 1`)),
      dbConn.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'EXCHANGE_RATE_SECONDARY_BANK_NAME' LIMIT 1`)),
    ]);
    const url: string = ((urlRow.rows || [])[0] as any)?.config_value
      || "https://krungthai.com/en/widget/rates?theme=ktb&remark=true&fund=true&social=false&logo=false";
    const bankName: string = ((nameRow.rows || [])[0] as any)?.config_value || "ธนาคารกรุงไทย";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ETaxCenter/1.0; +https://etaxcenter.th)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const rates = parseRateFromHtml(html, currency);
    if (!rates) return null;
    return { thb: rates.selling, buying: rates.buying, selling: rates.selling, bankName };
  } catch {
    return null;
  }
}

async function fetchManualRate(currency: string, dbConn: typeof db): Promise<{
  thb: number; validTo: string; expired: boolean;
} | null> {
  try {
    const { sql } = await import("drizzle-orm");
    const [rateRow, fromRow, toRow] = await Promise.all([
      dbConn.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'EXCHANGE_RATE_MANUAL_${currency.toUpperCase()}' LIMIT 1`)),
      dbConn.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'EXCHANGE_RATE_MANUAL_VALID_FROM' LIMIT 1`)),
      dbConn.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'EXCHANGE_RATE_MANUAL_VALID_TO' LIMIT 1`)),
    ]);
    const rateStr: string | null = ((rateRow.rows || [])[0] as any)?.config_value || null;
    const validFrom: string | null = ((fromRow.rows || [])[0] as any)?.config_value || null;
    const validTo: string | null = ((toRow.rows || [])[0] as any)?.config_value || null;
    if (!rateStr || !validFrom || !validTo) return null;
    const rate = parseFloat(rateStr);
    if (!rate || rate <= 0) return null;
    const now = new Date();
    const from = new Date(validFrom);
    const to = new Date(validTo);
    if (now > to) return { thb: rate, validTo, expired: true };
    if (now < from) return null;
    return { thb: rate, validTo, expired: false };
  } catch {
    return null;
  }
}

// ── /api/exchange-rate — 3-tier cascade: BOT → Secondary → Manual ─────────

app.get("/api/exchange-rate", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const currency = (req.query.currency as string || "USD").toUpperCase();
    const date = req.query.date as string | undefined;
    const dateParam = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const { sql } = await import("drizzle-orm");

    // ── TIER 1: BOT API ─────────────────────────────────────────────────
    const keyResult = await db.execute(sql.raw(`SELECT config_value FROM system_config WHERE config_key = 'BOT_API_KEY' LIMIT 1`));
    const botApiKey: string | null = ((keyResult.rows || [])[0] as any)?.config_value || null;

    if (botApiKey) {
      const baseDate = dateParam || new Date().toISOString().slice(0, 10);
      for (let i = 0; i <= 30; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const tryDate = d.toISOString().slice(0, 10);
        const botUrl = `https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/?start_period=${tryDate}&end_period=${tryDate}&currency=${currency}`;
        let botRes: Response;
        try {
          botRes = await fetch(botUrl, {
            headers: { "Authorization": `Bearer ${botApiKey}`, "Accept": "application/json" },
            signal: AbortSignal.timeout(10000),
          });
        } catch { continue; }
        if (!botRes.ok) continue;
        const botData = await botRes.json() as any;
        const entry = botData?.result?.data?.data_detail?.[0];
        const midRate = entry?.mid_rate ? parseFloat(entry.mid_rate) : 0;
        if (midRate > 0) {
          return res.json({
            currency, date: entry.period || tryDate, daysOld: i,
            thb: Number(midRate.toFixed(6)),
            buying_transfer: entry.buying_transfer ? Number(parseFloat(entry.buying_transfer).toFixed(6)) : undefined,
            selling: entry.selling ? Number(parseFloat(entry.selling).toFixed(6)) : undefined,
            source: "BOT",
            sourceName: "ธนาคารแห่งประเทศไทย (ธปท.)",
          });
        }
      }
    }

    // ── TIER 2: Secondary bank HTML source ──────────────────────────────
    const secondary = await fetchFromSecondary(currency, db);
    if (secondary) {
      const today = new Date().toISOString().slice(0, 10);
      return res.json({
        currency, date: today, daysOld: 0,
        thb: Number(secondary.selling.toFixed(6)),
        buying_transfer: Number(secondary.buying.toFixed(6)),
        selling: Number(secondary.selling.toFixed(6)),
        source: "SECONDARY",
        sourceName: secondary.bankName,
      });
    }

    // ── TIER 3: Manual rate (time-bounded) ──────────────────────────────
    const manual = await fetchManualRate(currency, db);
    if (manual) {
      if (manual.expired) {
        return res.status(503).json({
          message: `อัตราแบบ Manual ของ ${currency} หมดอายุแล้ว (หมดอายุ: ${new Date(manual.validTo).toLocaleString("th-TH")}) — กรุณาตั้งค่าใหม่ที่ Platform Admin > อัตราแลกเปลี่ยน`,
          code: "MANUAL_RATE_EXPIRED",
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      return res.json({
        currency, date: today, daysOld: 0,
        thb: Number(manual.thb.toFixed(6)),
        selling: Number(manual.thb.toFixed(6)),
        source: "MANUAL",
        sourceName: "Manual (ตั้งค่าเอง)",
        manualValidTo: manual.validTo,
      });
    }

    // ── All sources exhausted ────────────────────────────────────────────
    return res.status(503).json({
      message: `ไม่สามารถดึงอัตราแลกเปลี่ยน ${currency} ได้จากทุกแหล่ง (BOT / แหล่งสำรอง / Manual) — กรุณาตรวจสอบการตั้งค่าที่ Platform Admin > อัตราแลกเปลี่ยน`,
      code: "ALL_SOURCES_EXHAUSTED",
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
}
