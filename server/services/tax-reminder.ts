import { db } from "../db";
import { taxReminderSettings, taxReminderLogs, lineGroupMappings, tenants } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getStandardTaxDeadlines, type TaxDeadline } from "../routes/tax-calendar";

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function buildTaxReminderFlex(deadlines: TaxDeadline[], daysUntil: number): any {
  const urgencyColor = "#f94d4d";
  const urgencyText = daysUntil === 0 ? "⏰ วันสุดท้ายวันนี้!" : daysUntil === 1 ? "เหลืออีก 1 วัน" : `เหลืออีก ${daysUntil} วัน`;
  const urgencyEmoji = daysUntil <= 1 ? "🚨" : daysUntil <= 3 ? "⚠️" : "📋";

  const bodyContents: any[] = [
    {
      type: "box", layout: "horizontal", margin: "md",
      contents: [
        { type: "text", text: urgencyText, size: "lg", weight: "bold", color: urgencyColor, flex: 1 },
        { type: "text", text: formatThaiDate(deadlines[0].date), size: "sm", color: "#999999", align: "end", flex: 1 },
      ],
    },
    { type: "separator", margin: "md" },
    { type: "text", text: "⏰ กรุณาชำระก่อนเวลา 20.00 น.", size: "xs", color: "#f94d4d", margin: "sm", wrap: true },
  ];

  for (const dl of deadlines) {
    const icon = dl.type === "e-filing" ? "🌐" : "📄";
    bodyContents.push({
      type: "box", layout: "vertical", margin: "md", spacing: "xs",
      contents: [
        { type: "text", text: `${icon} ${dl.title}`, size: "sm", color: "#333333", wrap: true },
        { type: "text", text: `แบบ: ${dl.forms.join(", ")}`, size: "xs", color: "#888888", wrap: true },
        ...(dl.note ? [{ type: "text", text: dl.note, size: "xs", color: "#fb9678", wrap: true }] : []),
      ],
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box", layout: "horizontal", paddingAll: "15px",
      backgroundColor: urgencyColor,
      contents: [
        { type: "text", text: `${urgencyEmoji} แจ้งเตือนกำหนดชำระภาษี`, color: "#ffffff", size: "sm", weight: "bold", wrap: true },
      ],
    },
    body: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "15px",
      contents: bodyContents,
    },
    footer: {
      type: "box", layout: "vertical", paddingAll: "12px", spacing: "sm",
      contents: [
        { type: "separator" },
        { type: "text", text: "* นี่เป็นการแจ้งเตือนแบบอัตโนมัติ", size: "xxs", color: "#999999", align: "center", margin: "sm" },
        { type: "text", text: "ขออภัยหากท่านชำระภาษีเรียบร้อยแล้ว", size: "xxs", color: "#999999", align: "center" },
        { type: "text", text: "E-Tax Center — ระบบบัญชีดิจิทัล", size: "xxs", color: "#CCCCCC", align: "center", margin: "md" },
      ],
    },
  };
}

const STICKER_SETS = [
  { packageId: "11537", stickerId: "52002734" },
  { packageId: "11537", stickerId: "52002735" },
  { packageId: "11537", stickerId: "52002738" },
  { packageId: "11537", stickerId: "52002739" },
  { packageId: "11538", stickerId: "51626494" },
  { packageId: "11538", stickerId: "51626497" },
  { packageId: "6325", stickerId: "10979904" },
  { packageId: "6325", stickerId: "10979905" },
  { packageId: "6359", stickerId: "11069848" },
  { packageId: "6359", stickerId: "11069850" },
];

async function sendLinePush(token: string, to: string, messages: any[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE API error: ${res.status} ${err}`);
  }
  return res.json();
}

export async function sendTaxReminder(
  lineToken: string,
  groupId: string,
  deadlines: TaxDeadline[],
  daysUntil: number,
  sendSticker: boolean,
  customStickerPackageId?: string | null,
  customStickerId?: string | null,
): Promise<void> {
  const messages: any[] = [];

  const flexBubble = buildTaxReminderFlex(deadlines, daysUntil);
  messages.push({
    type: "flex",
    altText: `📋 แจ้งเตือนกำหนดยื่นภาษี ${formatThaiDate(deadlines[0].date)} (อีก ${daysUntil} วัน)`,
    contents: flexBubble,
  });

  if (sendSticker) {
    if (customStickerPackageId && customStickerId) {
      messages.push({
        type: "sticker",
        packageId: customStickerPackageId,
        stickerId: customStickerId,
      });
    } else {
      const sticker = STICKER_SETS[Math.floor(Math.random() * STICKER_SETS.length)];
      messages.push({
        type: "sticker",
        packageId: sticker.packageId,
        stickerId: sticker.stickerId,
      });
    }
  }

  await sendLinePush(lineToken, groupId, messages);
}

export async function checkAndSendTaxReminders(filterTenantId?: number): Promise<{ sent: number; errors: number }> {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!lineToken) {
    console.log("[Tax Reminder] No LINE token configured, skipping");
    return { sent: 0, errors: 0 };
  }

  let sent = 0;
  let errors = 0;

  try {
    const whereClause = filterTenantId
      ? and(eq(taxReminderSettings.enabled, true), eq(taxReminderSettings.tenantId, filterTenantId))
      : eq(taxReminderSettings.enabled, true);
    const settings = await db.select().from(taxReminderSettings).where(whereClause);
    if (settings.length === 0) {
      console.log("[Tax Reminder] No enabled settings found");
      return { sent: 0, errors: 0 };
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const deadlines = getStandardTaxDeadlines(currentYear, currentMonth);
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextDeadlines = getStandardTaxDeadlines(nextYear, nextMonth);
    const allDeadlines = [...deadlines, ...nextDeadlines];

    for (const setting of settings) {
      const daysBefore = setting.daysBefore ?? 3;

      const upcomingByDate = new Map<string, TaxDeadline[]>();
      for (const dl of allDeadlines) {
        const dlDate = new Date(dl.date);
        const diffMs = dlDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0 || (diffDays > 0 && diffDays <= daysBefore)) {
          if (!upcomingByDate.has(dl.date)) upcomingByDate.set(dl.date, []);
          upcomingByDate.get(dl.date)!.push(dl);
        }
      }

      if (upcomingByDate.size === 0) continue;

      const whereClause = setting.tenantId
        ? and(eq(lineGroupMappings.tenantId, setting.tenantId), eq(lineGroupMappings.active, true))
        : eq(lineGroupMappings.active, true);

      const groups = await db.select().from(lineGroupMappings).where(whereClause);
      if (groups.length === 0) continue;

      for (const [deadlineDate, dls] of upcomingByDate) {
        const dlDate = new Date(deadlineDate);
        const daysUntil = Math.ceil((dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        for (const group of groups) {
          const existing = await db.select().from(taxReminderLogs).where(
            and(
              eq(taxReminderLogs.lineGroupId, group.lineGroupId),
              eq(taxReminderLogs.deadlineDate, deadlineDate),
              eq(taxReminderLogs.status, "sent"),
            )
          );
          if (existing.length > 0) continue;

          try {
            await sendTaxReminder(lineToken, group.lineGroupId, dls, daysUntil, setting.sendSticker ?? true, setting.customStickerPackageId, setting.customStickerId);
            await db.insert(taxReminderLogs).values({
              tenantId: setting.tenantId,
              lineGroupId: group.lineGroupId,
              groupName: group.groupName,
              deadlineDate,
              deadlineTitle: dls.map(d => d.title).join(", "),
              status: "sent",
            });
            sent++;
            console.log(`[Tax Reminder] Sent to group ${group.groupName || group.lineGroupId} for ${deadlineDate}`);
          } catch (err: any) {
            errors++;
            await db.insert(taxReminderLogs).values({
              tenantId: setting.tenantId,
              lineGroupId: group.lineGroupId,
              groupName: group.groupName,
              deadlineDate,
              deadlineTitle: dls.map(d => d.title).join(", "),
              status: "error",
              errorMessage: err.message,
            });
            console.error(`[Tax Reminder] Error sending to ${group.groupName || group.lineGroupId}:`, err.message);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[Tax Reminder] Scheduler error:", err.message);
  }

  return { sent, errors };
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startTaxReminderScheduler() {
  console.log("[Tax Reminder] Starting scheduler (checks every hour)");

  schedulerInterval = setInterval(async () => {
    const now = new Date();
    const thaiHour = (now.getUTCHours() + 7) % 24;
    const thaiMinute = now.getUTCMinutes();
    const thaiTimeStr = `${thaiHour.toString().padStart(2, "0")}:${thaiMinute < 30 ? "00" : "30"}`;

    try {
      const allSettings = await db.select().from(taxReminderSettings).where(eq(taxReminderSettings.enabled, true));
      for (const setting of allSettings) {
        const configuredTime = setting.reminderTime || "09:00";
        const [configH] = configuredTime.split(":").map(Number);
        if (thaiHour === configH) {
          console.log(`[Tax Reminder] Running check for tenant ${setting.tenantId} at Thai time ${thaiHour}:${thaiMinute.toString().padStart(2, "0")}...`);
          const result = await checkAndSendTaxReminders(setting.tenantId ?? undefined);
          console.log(`[Tax Reminder] Tenant ${setting.tenantId}: ${result.sent} sent, ${result.errors} errors`);
        }
      }
    } catch (err: any) {
      console.error("[Tax Reminder] Scheduler iteration error:", err.message);
    }
  }, 60 * 60 * 1000);
}

export function stopTaxReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
