import * as path from "path";
import * as crypto from "crypto";

export function decodeMulterFilename(originalname: string): string {
  try {
    const hasNonAscii = /[^\x00-\x7f]/.test(originalname);
    if (!hasNonAscii) return originalname;
    const hasThai = /[\u0E00-\u0E7F]/.test(originalname);
    if (hasThai) return originalname;
    const decoded = Buffer.from(originalname, "latin1").toString("utf8");
    if (/[\u0E00-\u0E7F]/.test(decoded)) return decoded;
    return originalname;
  } catch {
    return originalname;
  }
}

const MAX_FILENAME_BYTES = 200;

const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i;

function getByteLength(str: string): number {
  return Buffer.byteLength(str, "utf8");
}

function truncateToByteLimit(str: string, maxBytes: number): string {
  if (getByteLength(str) <= maxBytes) return str;

  const buf = Buffer.from(str, "utf8");
  let truncated = buf.subarray(0, maxBytes);

  while (truncated.length > 0) {
    try {
      const decoded = truncated.toString("utf8");
      if (Buffer.from(decoded, "utf8").length <= maxBytes) {
        return decoded;
      }
    } catch {}
    truncated = truncated.subarray(0, truncated.length - 1);
  }

  return "";
}

export function sanitizeFilename(
  originalName: string,
  options?: {
    maxBytes?: number;
    prefix?: string;
  }
): string {
  const maxBytes = options?.maxBytes ?? MAX_FILENAME_BYTES;
  const prefix = options?.prefix ?? "";

  if (!originalName || originalName.trim() === "") {
    const hash = crypto.randomBytes(8).toString("hex");
    return `${prefix}unnamed_${hash}`;
  }

  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);

  const safeExt = ext
    .replace(UNSAFE_CHARS, "")
    .slice(0, 10);

  let safeName = baseName
    .replace(UNSAFE_CHARS, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .trim();

  if (RESERVED_NAMES.test(safeName)) {
    safeName = `_${safeName}`;
  }

  if (!safeName) {
    safeName = crypto.randomBytes(4).toString("hex");
  }

  const fullPrefix = prefix ? `${prefix}` : "";
  const reservedBytes = getByteLength(fullPrefix) + getByteLength(safeExt);
  const availableForName = maxBytes - reservedBytes;

  if (availableForName <= 0) {
    const hash = crypto.randomBytes(8).toString("hex");
    return `${fullPrefix}${hash}${safeExt}`;
  }

  const truncatedName = truncateToByteLimit(safeName, availableForName);

  const result = `${fullPrefix}${truncatedName}${safeExt}`;

  if (getByteLength(result) > maxBytes) {
    const hash = crypto.randomBytes(8).toString("hex");
    return truncateToByteLimit(`${fullPrefix}${hash}${safeExt}`, maxBytes);
  }

  return result;
}

export function makeStorageFilename(
  originalName: string,
  options?: {
    maxBytes?: number;
  }
): { safeFilename: string; originalFilename: string } {
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(originalName, {
    ...options,
    prefix: `${timestamp}_`,
  });

  return {
    safeFilename,
    originalFilename: originalName,
  };
}

export function makeUniqueFilename(
  originalName: string,
  options?: {
    maxBytes?: number;
  }
): { safeFilename: string; originalFilename: string } {
  const uuid = crypto.randomBytes(6).toString("hex");
  const safeFilename = sanitizeFilename(originalName, {
    ...options,
    prefix: `${uuid}_`,
  });

  return {
    safeFilename,
    originalFilename: originalName,
  };
}
