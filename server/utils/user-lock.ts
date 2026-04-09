interface UserLock {
  userId: number;
  lockedBy: number;
  lockedByName: string;
  lockedAt: number;
  expiresAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const lockedUsers = new Map<number, UserLock>();

const DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000;

export function lockUser(userId: number, lockedBy: number, lockedByName: string, durationMs?: number): UserLock {
  const existing = lockedUsers.get(userId);
  if (existing) {
    clearTimeout(existing.timeoutHandle);
  }

  const duration = durationMs || DEFAULT_LOCK_DURATION_MS;
  const now = Date.now();

  const lock: UserLock = {
    userId,
    lockedBy,
    lockedByName,
    lockedAt: now,
    expiresAt: now + duration,
    timeoutHandle: setTimeout(() => {
      lockedUsers.delete(userId);
      console.log(`[user-lock] Auto-unlocked userId=${userId} after timeout`);
    }, duration),
  };

  lockedUsers.set(userId, lock);
  return lock;
}

export function unlockUser(userId: number): boolean {
  const lock = lockedUsers.get(userId);
  if (!lock) return false;
  clearTimeout(lock.timeoutHandle);
  lockedUsers.delete(userId);
  return true;
}

export function isUserLocked(userId: number): UserLock | null {
  const lock = lockedUsers.get(userId);
  if (!lock) return null;
  if (Date.now() >= lock.expiresAt) {
    clearTimeout(lock.timeoutHandle);
    lockedUsers.delete(userId);
    return null;
  }
  return lock;
}

export function getLockRemainingMs(userId: number): number {
  const lock = isUserLocked(userId);
  if (!lock) return 0;
  return Math.max(0, lock.expiresAt - Date.now());
}
