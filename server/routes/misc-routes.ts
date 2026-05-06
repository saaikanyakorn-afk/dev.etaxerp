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

app.get("/api/exchange-rate", requireAuth, async (req, res) => {
  try {
    const currency = (req.query.currency as string || "USD").toUpperCase();
    const date = req.query.date as string | undefined;
    const dateParam = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

    const botApiKey = process.env.BOT_API_KEY;
    if (botApiKey) {
      try {
        const startPeriod = dateParam || new Date().toISOString().slice(0, 10);
        const botUrl = `https://gateway.api.bot.or.th/bot/public/Stat-ReferenceRate/v2/DAILY_AVG_EXG_RATE?start_period=${startPeriod}&end_period=${startPeriod}&currency=${currency}`;
        const botRes = await fetch(botUrl, {
          headers: { "X-IBM-Client-Id": botApiKey, "accept": "application/json" },
        });
        if (botRes.ok) {
          const botData = await botRes.json() as any;
          const entry = botData?.result?.data?.[0];
          if (entry?.mid) {
            return res.json({
              currency,
              date: entry.period || startPeriod,
              thb: Number(parseFloat(entry.mid).toFixed(6)),
              source: "BOT",
            });
          }
        }
      } catch {}
    }

    const dateTag = dateParam || "latest";
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateTag}/v1/currencies/${currency.toLowerCase()}.min.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Exchange rate API error: ${response.status}`);
    const data = await response.json() as Record<string, any>;
    const rates = data[currency.toLowerCase()] as Record<string, number>;
    const thb = rates?.thb;
    if (!thb) throw new Error("ไม่พบอัตราแลกเปลี่ยน THB");
    res.json({ currency, date: data.date || dateTag, thb: Number(thb.toFixed(6)), source: "ECB/fawazahmed0" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
}
