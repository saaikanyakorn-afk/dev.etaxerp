export let platformCloneProgress: {
  status: string;
  percent: number;
  error?: string;
  step?: string;
  startedAt?: number;
  dumpSizeMB?: number;
  currentTable?: string;
  tableIndex?: number;
  totalTables?: number;
  tableElapsedSec?: number;
  autoTimeoutSec?: number;
  rowCount?: number;
  totalBatches?: number;
  batchPhase?: string;
  completedTables?: { tableName: string; status: string; rowCount: number; durationMs: number; errorMessage?: string }[];
  cloneType?: string;
} = { status: "idle", percent: 0 };

export function setPlatformCloneProgress(p: typeof platformCloneProgress) {
  platformCloneProgress = p;
}

export let cloneScreenUserId: number | null = null;
export let cloneScreenLastHeartbeat: number = 0;

export function setCloneScreen(userId: number | null, heartbeat?: number) {
  cloneScreenUserId = userId;
  if (heartbeat !== undefined) cloneScreenLastHeartbeat = heartbeat;
}

export function setCloneScreenHeartbeat(ts: number) {
  cloneScreenLastHeartbeat = ts;
}

export let cloneLockState: {
  isRunning: boolean;
  initiator: "user" | "auto-resume" | null;
  targetDb: string | null;
  startedAt: number | null;
  userId: number | null;
} = { isRunning: false, initiator: null, targetDb: null, startedAt: null, userId: null };

export function acquireCloneLock(initiator: "user" | "auto-resume", targetDb: string, userId: number | null): { acquired: boolean; reason?: string } {
  if (cloneLockState.isRunning) {
    const who = cloneLockState.initiator === "auto-resume" ? "ระบบ Auto-Resume" : `ผู้ใช้ #${cloneLockState.userId}`;
    return { acquired: false, reason: `กำลัง Clone อยู่แล้วโดย ${who} (target: ${cloneLockState.targetDb})` };
  }
  cloneLockState = { isRunning: true, initiator, targetDb, startedAt: Date.now(), userId };
  console.log(`[Clone Lock] Acquired by ${initiator} (user: ${userId}, target: ${targetDb})`);
  return { acquired: true };
}

export function releaseCloneLock() {
  if (cloneLockState.isRunning) {
    console.log(`[Clone Lock] Released (was: ${cloneLockState.initiator}, target: ${cloneLockState.targetDb})`);
  }
  cloneLockState = { isRunning: false, initiator: null, targetDb: null, startedAt: null, userId: null };
}
