import type { Express } from "express";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/uploads/direct", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const result = await objectStorageService.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype || "application/octet-stream"
      );
      res.json({
        objectPath: result.objectPath,
        metadata: {
          name: req.file.originalname,
          size: req.file.size,
          contentType: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("Error in direct upload:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * Uses middleware-style approach to handle wildcard paths
   * since Express 5 path-to-regexp v8 doesn't support traditional wildcards.
   */
  app.use("/objects", async (req, res, next) => {
    if (req.method !== "GET") return next();
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
    try {
      const objectPath = `/objects/uploads/${req.params.fileId}`;
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        const [metadata] = await objectFile.getMetadata();
        res.set({
          "Content-Type": metadata.contentType || "application/octet-stream",
          ...(metadata.size ? { "Content-Length": String(metadata.size) } : {}),
          "Cache-Control": "public, max-age=86400",
        });
        const stream = objectFile.createReadStream();
        stream.on("error", (err) => {
          if (!res.headersSent) {
            res.status(500).json({ error: "Error streaming file" });
          }
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

