import { db, activeDbInfo } from "./db";
import { maintenanceSchedules, users } from "@shared/schema";
import { eq, sql, and, desc, inArray } from "drizzle-orm";

let onEnableCallback: (() => void) | null = null;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let enabledInMemory = false;
let activeScheduleId: number | null = null;

export function setOnEnableCallback(cb: () => void) {
  onEnableCallback = cb;
}

export function isMaintenanceMode(): boolean {
  return enabledInMemory;
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  scheduledAt: string | null;
  activatedAt: string | null;
  createdBy: string | null;
  scheduleId: number | null;
  cloneInProgress: boolean;
  cloneSessionUserId: number | null;
  source: string | null;
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const active = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "active"))
    .limit(1);

  if (active.length > 0) {
    const s = active[0];

    return {
      enabled: true,
      message: s.message,
      scheduledAt: s.scheduledAt?.toISOString() || null,
      activatedAt: s.activatedAt?.toISOString() || null,
      createdBy: s.createdBy,
      scheduleId: s.id,
      cloneInProgress: s.cloneInProgress,
      cloneSessionUserId: s.cloneSessionUserId,
      source: s.source,
    };
  }

  const pending = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "pending"))
    .limit(1);

  if (pending.length > 0) {
    const s = pending[0];
    return {
      enabled: false,
      message: s.message,
      scheduledAt: s.scheduledAt?.toISOString() || null,
      activatedAt: null,
      createdBy: s.createdBy,
      scheduleId: s.id,
      cloneInProgress: false,
      cloneSessionUserId: null,
      source: s.source,
    };
  }

  return {
    enabled: false,
    message: "",
    scheduledAt: null,
    activatedAt: null,
    createdBy: null,
    scheduleId: null,
    cloneInProgress: false,
    cloneSessionUserId: null,
    source: null,
  };
}

function todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function hasCompletedMaintenanceToday(): Promise<boolean> {
  const today = todayDateStr();
  const rows = await db.select().from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.status, "completed"),
      eq(maintenanceSchedules.completedDate, today),
      eq(maintenanceSchedules.source, "manual")
    ))
    .limit(1);
  return rows.length > 0;
}

export async function getActiveSchedule() {
  const rows = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "active"))
    .limit(1);
  return rows[0] || null;
}

export async function getPendingSchedule() {
  const rows = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "pending"))
    .limit(1);
  return rows[0] || null;
}

const MIN_SCHEDULE_AHEAD_MS = 60 * 60 * 1000;

export async function createSchedule(opts: {
  scheduledAt: Date;
  message?: string;
  createdBy?: string;
  createdByUserId?: number;
  source?: string;
}): Promise<{ success: boolean; message: string; scheduleId?: number }> {
  const diffMs = opts.scheduledAt.getTime() - Date.now();
  if (diffMs < MIN_SCHEDULE_AHEAD_MS) {
    return { success: false, message: "ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง" };
  }

  const existing = await db.select().from(maintenanceSchedules)
    .where(sql`${maintenanceSchedules.status} IN ('pending', 'active')`)
    .limit(1);

  if (existing.length > 0) {
    return { success: false, message: "มี schedule อยู่แล้ว กรุณายกเลิกหรือเลื่อนก่อน" };
  }

  const alreadyRanToday = await hasCompletedMaintenanceToday();
  if (alreadyRanToday) {
    return { success: false, message: "วันนี้เคยเปิดโหมดปรับปรุงและปิดไปแล้ว ไม่สามารถเปิดได้อีกในวันเดียวกัน" };
  }

  const [row] = await db.insert(maintenanceSchedules).values({
    scheduledAt: opts.scheduledAt,
    message: opts.message || "ระบบอยู่ระหว่างการปรับปรุง กรุณารอสักครู่",
    createdBy: opts.createdBy || null,
    createdByUserId: opts.createdByUserId || null,
    source: opts.source || "manual",
    status: "pending",
  }).returning();

  setupTimer(row.id, opts.scheduledAt);

  console.log(`[MAINTENANCE] Schedule #${row.id} created for ${opts.scheduledAt.toISOString()} by ${opts.createdBy || "system"}`);
  return { success: true, message: `ตั้งเวลาปรับปรุง ${opts.scheduledAt.toISOString()}`, scheduleId: row.id };
}

export async function createScheduleForClone(opts: {
  scheduledAt: Date;
  message?: string;
  createdBy?: string;
  createdByUserId?: number;
  source?: string;
}): Promise<{ success: boolean; message: string; scheduleId?: number }> {
  const existing = await db.select().from(maintenanceSchedules)
    .where(sql`${maintenanceSchedules.status} IN ('pending', 'active')`)
    .limit(1);

  if (existing.length > 0) {
    return { success: false, message: "มี schedule อยู่แล้ว" };
  }

  const [row] = await db.insert(maintenanceSchedules).values({
    scheduledAt: opts.scheduledAt,
    message: opts.message || "ระบบเตรียมพร้อมสำหรับ Clone ฐานข้อมูล",
    createdBy: opts.createdBy || null,
    createdByUserId: opts.createdByUserId || null,
    source: opts.source || "clone_database",
    status: "pending",
  }).returning();

  setupTimer(row.id, opts.scheduledAt);

  console.log(`[MAINTENANCE] Clone schedule #${row.id} created for ${opts.scheduledAt.toISOString()}`);
  return { success: true, message: "สร้าง schedule สำหรับ Clone", scheduleId: row.id };
}

export async function rescheduleForCloneFailure(userName: string, userId: number): Promise<void> {
  const pending = await getPendingSchedule();
  if (pending) return;

  const active = await getActiveSchedule();
  if (active) return;

  const oneHourFromNow = new Date(Date.now() + 60 * 60_000);
  await db.insert(maintenanceSchedules).values({
    scheduledAt: oneHourFromNow,
    message: "ระบบเตรียมพร้อมหลัง Clone ล้มเหลว",
    createdBy: userName,
    createdByUserId: userId,
    source: "clone_database",
    status: "pending",
  }).returning();

  console.log(`[MAINTENANCE] Post-clone-failure schedule created for ${oneHourFromNow.toISOString()}`);
}

export async function rescheduleSchedule(newScheduledAt: Date, message?: string): Promise<{ success: boolean; message: string }> {
  const diffMs = newScheduledAt.getTime() - Date.now();
  if (diffMs < MIN_SCHEDULE_AHEAD_MS) {
    return { success: false, message: "ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง" };
  }

  const pending = await getPendingSchedule();
  if (!pending) {
    return { success: false, message: "ไม่มี schedule ที่รอดำเนินการ" };
  }

  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  await db.update(maintenanceSchedules)
    .set({
      scheduledAt: newScheduledAt,
      ...(message ? { message } : {}),
    })
    .where(eq(maintenanceSchedules.id, pending.id));

  setupTimer(pending.id, newScheduledAt);

  console.log(`[MAINTENANCE] Schedule #${pending.id} rescheduled to ${newScheduledAt.toISOString()}`);
  return { success: true, message: `เลื่อนเวลาปรับปรุงเป็น ${newScheduledAt.toISOString()}` };
}

export async function cancelSchedule(): Promise<{ success: boolean; message: string }> {
  const pending = await getPendingSchedule();
  if (!pending) {
    return { success: false, message: "ไม่มี schedule ที่รอดำเนินการ" };
  }

  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  await db.update(maintenanceSchedules)
    .set({ status: "cancelled" })
    .where(eq(maintenanceSchedules.id, pending.id));

  console.log(`[MAINTENANCE] Schedule #${pending.id} cancelled`);
  return { success: true, message: "ยกเลิก schedule แล้ว" };
}

export async function activateNow(opts: {
  message?: string;
  enabledBy?: string;
  enabledByUserId?: number;
  source?: string;
  bypassDailyLimit?: boolean;
}): Promise<{ success: boolean; message: string; scheduleId?: number }> {
  if (!opts.bypassDailyLimit) {
    const alreadyRanToday = await hasCompletedMaintenanceToday();
    if (alreadyRanToday) {
      return { success: false, message: "วันนี้เคยเปิดโหมดปรับปรุงและปิดไปแล้ว ไม่สามารถเปิดได้อีกในวันเดียวกัน" };
    }
  }

  const active = await getActiveSchedule();
  if (active) {
    return { success: false, message: "ระบบอยู่ในโหมดปรับปรุงอยู่แล้ว" };
  }

  const pending = await getPendingSchedule();
  const isCloneSource = opts.source === "clone_database";

  if (pending) {
    const pendingDate = pending.scheduledAt ? pending.scheduledAt.toISOString().slice(0, 10) : "";
    const todayStr = todayDateStr();
    const isSameDay = pendingDate === todayStr;

    if (isCloneSource && pending.source === "manual") {
      if (isSameDay) {
        if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }
        await db.update(maintenanceSchedules)
          .set({
            status: "cancelled",
            liftedAt: new Date(),
            liftedBy: `Clone override by ${opts.enabledBy || "system"}`,
            cancelledByCloneUser: opts.enabledBy || null,
            cancelledByCloneUserId: opts.enabledByUserId || null,
            cancelledNotified: false,
          })
          .where(eq(maintenanceSchedules.id, pending.id));
        console.log(`[MAINTENANCE] Same-day manual schedule #${pending.id} cancelled by Clone (user: ${opts.enabledBy}). Owner #${pending.createdByUserId} will be notified.`);
      }
    } else if (!isCloneSource) {
      if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }
      await db.update(maintenanceSchedules)
        .set({
          status: "active",
          activatedAt: new Date(),
          message: opts.message || pending.message,
        })
        .where(eq(maintenanceSchedules.id, pending.id));

      enabledInMemory = true;
      activeScheduleId = pending.id;
      console.log(`[MAINTENANCE] Activated schedule #${pending.id} immediately`);
      if (onEnableCallback) onEnableCallback();
      return { success: true, message: "เปิดโหมดปรับปรุงทันที", scheduleId: pending.id };
    }
  }

  const [row] = await db.insert(maintenanceSchedules).values({
    scheduledAt: new Date(),
    message: opts.message || "ระบบอยู่ระหว่างการปรับปรุง กรุณารอสักครู่",
    createdBy: opts.enabledBy || null,
    createdByUserId: opts.enabledByUserId || null,
    source: opts.source || "manual",
    status: "active",
    activatedAt: new Date(),
  }).returning();

  enabledInMemory = true;
  activeScheduleId = row.id;
  console.log(`[MAINTENANCE] Enabled immediately by ${opts.enabledBy || "system"} — schedule #${row.id}`);
  if (onEnableCallback) onEnableCallback();
  return { success: true, message: "เปิดโหมดปรับปรุงทันที", scheduleId: row.id };
}

export async function liftMaintenance(liftedBy?: string): Promise<{ success: boolean; message: string; destroyedOtherSchedule?: boolean }> {
  const active = await getActiveSchedule();
  if (!active) {
    enabledInMemory = false;
    activeScheduleId = null;
    return { success: false, message: "ระบบไม่ได้อยู่ในโหมดปรับปรุง" };
  }

  const today = todayDateStr();

  await db.update(maintenanceSchedules)
    .set({
      status: "completed",
      liftedAt: new Date(),
      liftedBy: liftedBy || null,
      completedDate: today,
      cloneInProgress: false,
      cloneSessionUserId: null,
    })
    .where(eq(maintenanceSchedules.id, active.id));

  enabledInMemory = false;
  activeScheduleId = null;

  console.log(`[MAINTENANCE] Lifted by ${liftedBy || "system"} — schedule #${active.id} completed on ${today}`);

  return { success: true, message: "ปิดโหมดปรับปรุงแล้ว ผู้ใช้สามารถเข้าสู่ระบบได้" };
}

export async function setCloneInProgress(userId: number, inProgress: boolean): Promise<void> {
  const active = await getActiveSchedule();
  if (!active) return;

  await db.update(maintenanceSchedules)
    .set({
      cloneInProgress: inProgress,
      cloneSessionUserId: inProgress ? userId : null,
    })
    .where(eq(maintenanceSchedules.id, active.id));

  console.log(`[MAINTENANCE] Clone in progress: ${inProgress} (user: ${userId})`);
}

export async function isCloneInProgress(): Promise<boolean> {
  const active = await getActiveSchedule();
  return active?.cloneInProgress || false;
}

export async function getCloneSessionUserId(): Promise<number | null> {
  const active = await getActiveSchedule();
  return active?.cloneSessionUserId || null;
}

export async function freezeTimer(): Promise<{ hadPending: boolean; originalScheduledAt: string | null }> {
  const pending = await getPendingSchedule();
  if (!pending) return { hadPending: false, originalScheduledAt: null };

  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  console.log(`[MAINTENANCE] Timer frozen for schedule #${pending.id}`);
  return { hadPending: true, originalScheduledAt: pending.scheduledAt?.toISOString() || null };
}

export async function unfreezeTimer(addMinutes: number = 5): Promise<void> {
  const pending = await getPendingSchedule();
  if (!pending) return;

  const newTime = new Date(Date.now() + addMinutes * 60_000);

  const originalDate = pending.scheduledAt;
  const isToday = originalDate && todayDateStr() === `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, "0")}-${String(originalDate.getDate()).padStart(2, "0")}`;

  if (isToday) {
    await db.update(maintenanceSchedules)
      .set({ scheduledAt: newTime })
      .where(eq(maintenanceSchedules.id, pending.id));
    setupTimer(pending.id, newTime);
    console.log(`[MAINTENANCE] Timer unfrozen — rescheduled to ${newTime.toISOString()} (+${addMinutes}min)`);
  } else {
    setupTimer(pending.id, originalDate!);
    console.log(`[MAINTENANCE] Timer unfrozen — original schedule was not today, keeping ${originalDate?.toISOString()}`);
  }
}

export async function destroyScheduleAfterClone(): Promise<{ destroyedScheduleWasOthers: boolean; originalCreatedBy: string | null }> {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  const pending = await getPendingSchedule();
  if (pending) {
    const wasOthers = pending.source !== "clone_database";
    const originalCreatedBy = pending.createdBy;
    await db.update(maintenanceSchedules)
      .set({ status: "cancelled" })
      .where(eq(maintenanceSchedules.id, pending.id));
    console.log(`[MAINTENANCE] Pending schedule #${pending.id} destroyed after clone`);
    return { destroyedScheduleWasOthers: wasOthers, originalCreatedBy };
  }

  const recentSchedules = await db.select().from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.source, "clone_database"),
        inArray(maintenanceSchedules.status, ["completed", "active"]),
      )
    )
    .orderBy(desc(maintenanceSchedules.id))
    .limit(1);

  if (recentSchedules.length > 0) {
    const sched = recentSchedules[0];
    const wasOthers = false;
    const originalCreatedBy = sched.createdBy;
    await db.update(maintenanceSchedules)
      .set({ status: "cancelled" })
      .where(eq(maintenanceSchedules.id, sched.id));
    activeScheduleId = null;
    enabledInMemory = false;
    console.log(`[MAINTENANCE] Clone schedule #${sched.id} destroyed after successful clone (was ${sched.status})`);
    return { destroyedScheduleWasOthers: wasOthers, originalCreatedBy };
  }

  return { destroyedScheduleWasOthers: false, originalCreatedBy: null };
}

export async function getScheduleHistory(limit: number = 20) {
  return db.select().from(maintenanceSchedules)
    .orderBy(desc(maintenanceSchedules.createdAt))
    .limit(limit);
}

function setupTimer(scheduleId: number, triggerAt: Date) {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  const delayMs = triggerAt.getTime() - Date.now();
  if (delayMs <= 0) {
    activateScheduleById(scheduleId);
    return;
  }

  scheduledTimer = setTimeout(() => {
    activateScheduleById(scheduleId);
  }, delayMs);
}

async function activateScheduleById(scheduleId: number) {
  const rows = await db.select().from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.id, scheduleId),
      eq(maintenanceSchedules.status, "pending")
    ))
    .limit(1);

  if (rows.length === 0) return;

  await db.update(maintenanceSchedules)
    .set({ status: "active", activatedAt: new Date() })
    .where(eq(maintenanceSchedules.id, scheduleId));

  enabledInMemory = true;
  activeScheduleId = scheduleId;
  console.log(`[MAINTENANCE] Schedule #${scheduleId} auto-activated by timer`);
  if (onEnableCallback) onEnableCallback();
}

export async function initMaintenanceOnStartup(): Promise<void> {
  const active = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "active"))
    .limit(1);

  if (active.length > 0) {
    const s = active[0];
    const activatedAge = s.activatedAt ? Date.now() - new Date(s.activatedAt).getTime() : Infinity;
    const isStale = activatedAge > 60 * 60 * 1000;

    if (s.cloneInProgress && !isStale) {
      enabledInMemory = true;
      activeScheduleId = s.id;
      console.log(`[MAINTENANCE] Restored active maintenance from DB — schedule #${s.id} (clone in progress, age ${Math.round(activatedAge / 60000)}min)`);
    } else {
      const reason = isStale
        ? `stale (activated ${Math.round(activatedAge / 60000)}min ago)`
        : `cloneInProgress=false`;
      console.log(`[MAINTENANCE] Found active schedule #${s.id} but ${reason} — auto-completing on startup`);
      await db.update(maintenanceSchedules)
        .set({ status: "completed", completedDate: new Date(), cloneInProgress: false })
        .where(eq(maintenanceSchedules.id, s.id));
      console.log(`[MAINTENANCE] Schedule #${s.id} auto-completed on startup`);
    }
  }

  const pending = await db.select().from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.status, "pending"))
    .limit(1);

  if (pending.length > 0) {
    const s = pending[0];
    if (s.scheduledAt) {
      setupTimer(s.id, s.scheduledAt);
      console.log(`[MAINTENANCE] Restored pending timer for schedule #${s.id} at ${s.scheduledAt.toISOString()}`);
    }
  }
}

export function getMaintenanceState() {
  return {
    enabled: enabledInMemory,
    message: "",
    scheduledAt: null as string | null,
    scheduledEnd: null as string | null,
    enabledBy: null as string | null,
    enabledAt: null as string | null,
  };
}

export async function sendPlatformLineAlert(message: string): Promise<boolean> {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!lineToken) {
    console.log("[Platform LINE] No LINE token configured, skipping alert");
    return false;
  }
  try {
    const platformUsers = await db.select({ lineId: users.lineId }).from(users)
      .where(eq(users.role, "super_admin"))
      .limit(1);
    const lineId = platformUsers[0]?.lineId;
    if (!lineId) {
      console.log("[Platform LINE] Platform user has no LINE ID configured");
      return false;
    }
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ to: lineId, messages: [{ type: "text", text: message }] }),
    });
    if (!res.ok) {
      console.log(`[Platform LINE] API error: ${res.status}`);
      return false;
    }
    console.log(`[Platform LINE] Alert sent to platform user`);
    return true;
  } catch (err: any) {
    console.log(`[Platform LINE] Error: ${err.message?.slice(0, 200)}`);
    return false;
  }
}

export function getCurrentActiveTarget(): "usa" | "thailand" {
  return activeDbInfo.target;
}

let halfBakedCloneTimeout: ReturnType<typeof setTimeout> | null = null;

export function startHalfBakedTimeout(timeoutMs: number, switchBackFn: () => Promise<{ success: boolean; error?: string }>) {
  if (halfBakedCloneTimeout) clearTimeout(halfBakedCloneTimeout);
  halfBakedCloneTimeout = setTimeout(async () => {
    console.log("[Maintenance] Half-baked clone timeout expired — auto-switching DB back to source");
    try {
      const result = await switchBackFn();
      if (result.success) {
        await liftMaintenance("System (half-baked clone timeout auto-switch)");
        await sendPlatformLineAlert(
          "⚠️ E-Tax Center: ระบบ timeout แล้ว\n" +
          "Clone Database ไม่สมบูรณ์ ระบบสลับฐานข้อมูลกลับไปต้นทางอัตโนมัติแล้ว\n" +
          "กรุณาเข้าระบบเพื่อตรวจสอบและ Clone ใหม่"
        );
      } else {
        console.error(`[Maintenance] Half-baked timeout auto-switch FAILED: ${result.error} — lock stays ON`);
        await sendPlatformLineAlert(
          "🚨 E-Tax Center: สลับฐานข้อมูลอัตโนมัติล้มเหลว!\n" +
          `สาเหตุ: ${result.error}\n` +
          "ระบบยังคงล็อกอยู่ กรุณาเข้ามาจัดการด้วยตนเอง!"
        );
      }
    } catch (err: any) {
      console.log(`[Maintenance] Half-baked timeout auto-switch error: ${err.message}`);
      await sendPlatformLineAlert(
        "🚨 E-Tax Center: สลับฐานข้อมูลอัตโนมัติล้มเหลว!\n" +
        `Error: ${err.message?.slice(0, 100)}\n` +
        "ระบบยังคงล็อกอยู่ กรุณาเข้ามาจัดการด้วยตนเอง!"
      ).catch(() => {});
    }
    halfBakedCloneTimeout = null;
  }, timeoutMs);
  console.log(`[Maintenance] Half-baked clone timeout started: ${Math.round(timeoutMs / 60000)} minutes`);
}

export function cancelHalfBakedTimeout() {
  if (halfBakedCloneTimeout) {
    clearTimeout(halfBakedCloneTimeout);
    halfBakedCloneTimeout = null;
    console.log("[Maintenance] Half-baked clone timeout cancelled");
  }
}
