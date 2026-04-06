import type { Request, Response, NextFunction } from "express";
import * as path from "path";
import { db } from "./db";
import { ftpArchiveItems } from "@shared/schema";
import { eq, or, desc } from "drizzle-orm";

const INTERCEPTED_PREFIXES = [".private/", "public/", "pdf-imports/"];

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function isAllowedRedirectUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const { getConfig } = require("./config-bootstrap");
    const ftpBaseUrl = getConfig("FTP_BASE_URL") || "";
    const ftpLanUrl = getConfig("FTP_LAN_BASE_URL") || "";
    const allowedOrigins: string[] = [];
    if (ftpBaseUrl) {
      try { allowedOrigins.push(new URL(ftpBaseUrl).origin); } catch {}
    }
    if (ftpLanUrl) {
      try { allowedOrigins.push(new URL(ftpLanUrl).origin); } catch {}
    }
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

function extractObjectKey(reqPath: string): string | null {
  if (reqPath.startsWith("/api/")) return null;
  const decoded = decodeURIComponent(reqPath);
  for (const prefix of INTERCEPTED_PREFIXES) {
    const idx = decoded.indexOf("/" + prefix);
    if (idx !== -1) return decoded.slice(idx + 1);

    if (decoded === "/" + prefix.slice(0, -1) || decoded.startsWith("/" + prefix)) {
      return decoded.slice(1);
    }
  }
  return null;
}

export function attachmentInterceptMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET") return next();

  const objectKey = extractObjectKey(req.path);
  if (!objectKey) return next();

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  }

  handleObjectStorageFallback(objectKey, res).catch((err) => {
    console.error("[attachment-middleware] Error:", err.message);
    next();
  });
}

async function handleObjectStorageFallback(objectPath: string, res: Response) {
  const { readFromPath } = await import("./replit_integrations/object_storage/routes");
  const ext = path.extname(objectPath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  const tryServe = async (tryPath: string): Promise<boolean> => {
    try {
      const fileData = readFromPath(tryPath);
      if (fileData) {
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(path.basename(tryPath).replace('.archived', ''))}"`);
        res.send(fileData);
        return true;
      }
    } catch {}
    return false;
  };

  if (await tryServe(objectPath)) return;

  if (await tryServe(objectPath + ".archived")) return;

  const archiveInfo = await resolveArchiveStatus(objectPath);
  if (archiveInfo) {
    if (archiveInfo.status === "completed" && archiveInfo.archivedUrl) {
      if (isAllowedRedirectUrl(archiveInfo.archivedUrl)) {
        return res.redirect(archiveInfo.archivedUrl);
      }
      return sendStatusPage(res, 404, "✅", "#05b187", "ไฟล์ถูกย้ายไปเก็บถาวรแล้ว", "แต่ URL ปลายทางยังเข้าถึงไม่ได้<br/>ติดต่อ HO เพื่อขอเรียกคืนไฟล์");
    }
    if (archiveInfo.status === "transferring") {
      const totalBytes = Number(archiveInfo.fileSize) || 0;
      const sentBytes = Number(archiveInfo.transferredSize) || 0;
      const pct = totalBytes > 0 ? Math.round((sentBytes / totalBytes) * 100) : 0;
      const sizeMB = totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(1) : "?";
      const progressText = totalBytes > 0 ? `${pct}% ของ ${sizeMB} MB` : "กำลังดำเนินการ...";
      const progressBar = `<div style="margin:1rem 0;background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden"><div style="background:#fb9678;height:100%;width:${pct}%;transition:width 0.3s"></div></div>`;
      return sendStatusPage(res, 202, "⏳", "#fb9678", "ไฟล์กำลังถูกย้ายไปเก็บถาวร", `${progressBar}<p style="color:#666;font-size:0.875rem">${progressText}<br/>ความพยายามครั้งที่ ${archiveInfo.attempts}</p>`, 10);
    }
    if (archiveInfo.status === "pending") {
      return sendStatusPage(res, 202, "📋", "#fec90f", "ไฟล์อยู่ในคิวรอย้าย", `ระบบจะเริ่มย้ายเร็วๆ นี้<br/>ความพยายามครั้งที่ ${archiveInfo.attempts || 0}`, 15);
    }
    if (archiveInfo.status === "failed") {
      return sendStatusPage(res, 500, "⚠️", "#f94d4d", "การย้ายไฟล์ล้มเหลว", `ไฟล์ไม่สามารถย้ายไปเก็บถาวรได้ (พยายามแล้ว ${archiveInfo.attempts} ครั้ง)<br/>ติดต่อ HO เพื่อตรวจสอบ`);
    }
  }

  return sendStatusPage(res, 404, "📁", "#f94d4d", "ไม่พบไฟล์ในที่เก็บ", "ไฟล์อาจถูกย้ายไปเก็บถาวรแล้ว<br/>ติดต่อ HO เพื่อขอเรียกคืนไฟล์");
}

function sendStatusPage(res: Response, status: number, icon: string, color: string, title: string, body: string, refreshSec?: number) {
  const meta = refreshSec ? `<meta http-equiv="refresh" content="${refreshSec}">` : "";
  const refreshNote = refreshSec ? `<p style="color:#999;font-size:0.75rem;margin-top:0.5rem">หน้านี้จะรีเฟรชอัตโนมัติทุก ${refreshSec} วินาที</p><button onclick="location.reload()" style="margin-top:0.5rem;padding:0.5rem 1.5rem;background:#fb9678;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.875rem">รีเฟรชเลย</button>` : "";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${meta}<title>${title}</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef9f6"><div style="text-align:center;padding:2rem;max-width:400px"><p style="font-size:1.5rem;color:${color}">${icon}</p><p style="font-size:1rem;color:#333">${title}</p>${body.includes("<div") || body.includes("<p") ? body : `<p style="color:#666;font-size:0.875rem">${body}</p>`}${refreshNote}</div></body></html>`;
  res.status(status).setHeader("Content-Type", "text/html; charset=utf-8").send(html);
}

async function resolveArchiveStatus(objectPath: string): Promise<{ status: string; archivedUrl: string | null; fileSize: string | null; transferredSize: string | null; attempts: number } | null> {
  try {
    const [item] = await db.select({
      status: ftpArchiveItems.status,
      archivedUrl: ftpArchiveItems.archivedUrl,
      fileSize: ftpArchiveItems.fileSize,
      transferredSize: ftpArchiveItems.transferredSize,
      attempts: ftpArchiveItems.attempts,
    })
      .from(ftpArchiveItems)
      .where(
        or(
          eq(ftpArchiveItems.localPath, objectPath),
          eq(ftpArchiveItems.originalUrl, objectPath),
          eq(ftpArchiveItems.originalUrl, `/objects/${objectPath}`),
        )
      )
      .orderBy(desc(ftpArchiveItems.createdAt))
      .limit(1);

    if (!item) return null;
    return {
      status: item.status || "unknown",
      archivedUrl: item.archivedUrl,
      fileSize: item.fileSize,
      transferredSize: item.transferredSize,
      attempts: item.attempts || 0,
    };
  } catch {
    return null;
  }
}
