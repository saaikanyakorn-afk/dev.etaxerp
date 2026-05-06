import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

const LOCAL_UPLOAD_DIR = resolveUploadDir();

function resolveUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  return path.join(process.cwd(), "uploads");
}

function ensureUploadDir(): void {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".ico": "image/x-icon",
};

function detectContentType(fileName: string, metaPath?: string): string {
  if (metaPath && fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8")).contentType || "application/octet-stream";
    } catch {}
  }
  return MIME_MAP[path.extname(fileName).toLowerCase()] || "application/octet-stream";
}

const EXT_FROM_MIME: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
  "image/webp": ".webp", "image/svg+xml": ".svg", "application/pdf": ".pdf",
  "image/x-icon": ".ico",
};

export function saveBufferLocally(buffer: Buffer, contentType: string, originalName?: string): { objectPath: string } {
  ensureUploadDir();
  const fileId = randomUUID();
  const ext = EXT_FROM_MIME[contentType] || (originalName ? path.extname(originalName).toLowerCase() : "") || "";
  const safeName = fileId + ext;
  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, safeName), buffer);
  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileId + ".meta.json"), JSON.stringify({
    originalName: originalName || safeName,
    contentType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  }));
  return { objectPath: `/api/local-file/${safeName}` };
}

export function getLocalFilePath(fileId: string): string | null {
  ensureUploadDir();
  const candidates = fs.readdirSync(LOCAL_UPLOAD_DIR).filter(f => f.startsWith(fileId) && !f.endsWith(".meta.json"));
  if (candidates.length === 0) return null;
  return path.join(LOCAL_UPLOAD_DIR, candidates[0]);
}

export function saveBufferToPath(buffer: Buffer, relativePath: string): void {
  ensureUploadDir();
  const fullPath = path.join(LOCAL_UPLOAD_DIR, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, buffer);
}

export function readFromPath(relativePath: string): Buffer | null {
  ensureUploadDir();
  const fullPath = path.join(LOCAL_UPLOAD_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

export function getFullLocalPath(relativePath: string): string {
  return path.join(LOCAL_UPLOAD_DIR, relativePath);
}

export function deleteFromPath(relativePath: string): boolean {
  try {
    const fullPath = path.join(LOCAL_UPLOAD_DIR, relativePath);
    if (fs.existsSync(fullPath)) { fs.unlinkSync(fullPath); return true; }
  } catch {}
  return false;
}

export function registerObjectStorageRoutes(app: Express): void {
  ensureUploadDir();
  console.log(`[Upload] Local disk storage — ${LOCAL_UPLOAD_DIR}`);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      const fileId = randomUUID();
      res.json({
        uploadURL: `/api/uploads/local/${fileId}`,
        objectPath: `/api/local-file/${fileId}`,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/uploads/local/:fileId", upload.single("file"), async (req, res) => {
    try {
      ensureUploadDir();
      const safeName = req.params.fileId.replace(/[^a-zA-Z0-9\-]/g, "");
      if (!safeName) return res.status(400).json({ error: "Invalid file ID" });

      if (req.file) {
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, safeName), req.file.buffer);
      } else {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        await new Promise<void>((resolve, reject) => {
          req.on("end", () => resolve());
          req.on("error", reject);
        });
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return res.status(400).json({ error: "No data received" });
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, safeName), buffer);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Error in local upload PUT:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.post("/api/uploads/direct", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      try {
        ensureUploadDir();
      } catch (dirErr: any) {
        console.error("[Upload] Failed to create upload directory:", dirErr);
        return res.status(500).json({ error: `Upload failed: cannot create upload folder — ${dirErr.message}` });
      }
      const fileId = randomUUID();
      const ext = path.extname(req.file.originalname || "").toLowerCase();
      const safeName = fileId + ext;
      const metaName = fileId + ".meta.json";
      try {
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, safeName), req.file.buffer);
      } catch (writeErr: any) {
        console.error("[Upload] Failed to write file:", writeErr);
        return res.status(500).json({ error: `Upload failed: cannot write file to disk — ${writeErr.message}` });
      }
      try {
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, metaName), JSON.stringify({
          originalName: req.file.originalname,
          contentType: req.file.mimetype || "application/octet-stream",
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
        }));
      } catch (metaErr: any) {
        console.error("[Upload] Failed to write metadata:", metaErr);
        return res.status(500).json({ error: `Upload failed: cannot write metadata — ${metaErr.message}` });
      }
      res.json({
        objectPath: `/api/local-file/${safeName}`,
        metadata: { name: req.file.originalname, size: req.file.size, contentType: req.file.mimetype },
      });
    } catch (error: any) {
      console.error("Error in direct upload:", error);
      res.status(500).json({ error: `Upload failed: ${error.message}` });
    }
  });

  app.get("/api/local-file/:fileName", (req, res) => {
    try {
      const safeName = req.params.fileName.replace(/[^a-zA-Z0-9\-\.]/g, "");
      const filePath = path.join(LOCAL_UPLOAD_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      const baseId = safeName.replace(/\.[^.]+$/, "");
      const metaPath = path.join(LOCAL_UPLOAD_DIR, baseId + ".meta.json");
      const contentType = detectContentType(safeName, metaPath);
      res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Error serving local file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  app.get("/api/file/:fileId", (req, res) => {
    try {
      ensureUploadDir();
      const { fileId } = req.params;
      const candidates = fs.readdirSync(LOCAL_UPLOAD_DIR).filter(f => f.startsWith(fileId) && !f.endsWith(".meta.json"));
      if (candidates.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }
      const fileName = candidates[0];
      const filePath = path.join(LOCAL_UPLOAD_DIR, fileName);
      const metaPath = path.join(LOCAL_UPLOAD_DIR, fileId + ".meta.json");
      const contentType = detectContentType(fileName, metaPath);
      res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  app.use("/objects", (req, res, next) => {
    if (req.method !== "GET") return next();
    const relativePath = decodeURIComponent(req.originalUrl.replace(/^\/objects\//, "").replace(/\?.*$/, ""));
    if (!relativePath) return res.status(404).json({ error: "Object not found" });
    ensureUploadDir();
    const fullPath = path.join(LOCAL_UPLOAD_DIR, relativePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) return res.status(403).json({ error: "Forbidden" });
    if (fs.existsSync(resolved)) {
      const contentType = detectContentType(path.basename(resolved));
      res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
      return fs.createReadStream(resolved).pipe(res);
    }
    const dirPath = path.dirname(resolved);
    const baseName = path.basename(relativePath);
    if (fs.existsSync(dirPath)) {
      const candidates = fs.readdirSync(dirPath).filter(f => f.startsWith(baseName) && !f.endsWith(".meta.json"));
      if (candidates.length > 0) {
        const filePath2 = path.join(dirPath, candidates[0]);
        const contentType = detectContentType(candidates[0]);
        res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
        return fs.createReadStream(filePath2).pipe(res);
      }
    }
    return res.status(404).json({ error: "Object not found" });
  });
}
