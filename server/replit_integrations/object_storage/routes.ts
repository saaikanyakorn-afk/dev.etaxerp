import type { Express } from "express";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");

function isReplitEnvironment(): boolean {
  return !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT);
}

function ensureUploadDir(): void {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

export function registerObjectStorageRoutes(app: Express): void {
  const useReplit = isReplitEnvironment();
  let objectStorageService: ObjectStorageService | null = null;
  if (useReplit) {
    objectStorageService = new ObjectStorageService();
  } else {
    ensureUploadDir();
    console.log(`[Upload] Local disk mode — files stored in ${LOCAL_UPLOAD_DIR}`);
  }
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      if (objectStorageService) {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
      } else {
        const fileId = randomUUID();
        res.json({
          uploadURL: `/api/uploads/local/${fileId}`,
          objectPath: `/objects/uploads/${fileId}`,
          metadata: { name, size, contentType },
        });
      }
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/uploads/local/:fileId", upload.single("file"), async (req, res) => {
    try {
      ensureUploadDir();
      const { fileId } = req.params;
      const safeName = fileId.replace(/[^a-zA-Z0-9\-]/g, "");
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
      if (objectStorageService) {
        const result = await objectStorageService.uploadBufferToStorage(
          req.file.buffer,
          req.file.mimetype || "application/octet-stream"
        );
        res.json({
          objectPath: result.objectPath,
          metadata: { name: req.file.originalname, size: req.file.size, contentType: req.file.mimetype },
        });
      } else {
        ensureUploadDir();
        const fileId = randomUUID();
        const ext = path.extname(req.file.originalname || "").toLowerCase();
        const safeName = fileId + ext;
        const metaName = fileId + ".meta.json";
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, safeName), req.file.buffer);
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, metaName), JSON.stringify({
          originalName: req.file.originalname,
          contentType: req.file.mimetype || "application/octet-stream",
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
        }));
        res.json({
          objectPath: `/api/local-file/${safeName}`,
          metadata: { name: req.file.originalname, size: req.file.size, contentType: req.file.mimetype },
        });
      }
    } catch (error: any) {
      console.error("Error in direct upload:", error);
      const msg = error?.message || "";
      if (msg.includes("subject_token") || msg.includes("credential_source")) {
        res.status(503).json({ error: "ระบบจัดเก็บไฟล์ยังไม่พร้อม กรุณาลองอีกครั้งในอีกสักครู่" });
      } else {
        res.status(500).json({ error: "อัพโหลดไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง" });
      }
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
      let contentType = "application/octet-stream";
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          contentType = meta.contentType || contentType;
        } catch {}
      } else {
        const ext = path.extname(safeName).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
          ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
          ".pdf": "application/pdf", ".ico": "image/x-icon",
        };
        contentType = mimeMap[ext] || contentType;
      }
      res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Error serving local file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  app.use("/objects", async (req, res, next) => {
    if (req.method !== "GET") return next();
    if (!objectStorageService) {
      const parts = req.originalUrl.replace(/\?.*$/, "").split("/");
      const fileId = parts[parts.length - 1];
      if (fileId) {
        const candidates = fs.readdirSync(LOCAL_UPLOAD_DIR).filter(f => f.startsWith(fileId) && !f.endsWith(".meta.json"));
        if (candidates.length > 0) {
          const filePath = path.join(LOCAL_UPLOAD_DIR, candidates[0]);
          const ext = path.extname(candidates[0]).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
          };
          res.set({ "Content-Type": mimeMap[ext] || "application/octet-stream", "Cache-Control": "public, max-age=86400" });
          return fs.createReadStream(filePath).pipe(res);
        }
      }
      return res.status(404).json({ error: "Object not found" });
    }
    try {
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.originalUrl);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (streamErr: any) {
        if (streamErr instanceof ObjectNotFoundError) throw streamErr;
        const signedUrl = await objectStorageService.getSignedReadUrl(req.originalUrl);
        res.redirect(signedUrl);
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  app.get("/api/file/:fileId", async (req, res) => {
    const { fileId } = req.params;
    if (!objectStorageService) {
      try {
        ensureUploadDir();
        const candidates = fs.readdirSync(LOCAL_UPLOAD_DIR).filter(f => f.startsWith(fileId) && !f.endsWith(".meta.json"));
        if (candidates.length === 0) {
          return res.status(404).json({ error: "File not found" });
        }
        const filePath = path.join(LOCAL_UPLOAD_DIR, candidates[0]);
        const metaPath = path.join(LOCAL_UPLOAD_DIR, fileId + ".meta.json");
        let contentType = "application/octet-stream";
        if (fs.existsSync(metaPath)) {
          try { contentType = JSON.parse(fs.readFileSync(metaPath, "utf-8")).contentType || contentType; } catch {}
        } else {
          const ext = path.extname(candidates[0]).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
          };
          contentType = mimeMap[ext] || contentType;
        }
        res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
        return fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        console.error("Error serving local file:", error);
        return res.status(500).json({ error: "Failed to serve file" });
      }
    }
    try {
      const objectPath = `/objects/uploads/${fileId}`;
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        const [metadata] = await objectFile.getMetadata();
        res.set({
          "Content-Type": metadata.contentType || "application/octet-stream",
          ...(metadata.size ? { "Content-Length": String(metadata.size) } : {}),
          "Cache-Control": "public, max-age=86400",
        });
        const stream = objectFile.createReadStream();
        stream.on("error", () => {
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        stream.pipe(res);
      } catch (streamErr: any) {
        if (streamErr instanceof ObjectNotFoundError) throw streamErr;
        const signedUrl = await objectStorageService.getSignedReadUrl(objectPath);
        res.redirect(signedUrl);
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving file:", error);
      return res.status(500).json({ error: "Failed to serve file" });
    }
  });
}
