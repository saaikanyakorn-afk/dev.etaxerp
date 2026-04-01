import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { shareOgHandler, contractOgHandler } from "./share-og";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.get("/share/quote/:token", (req, res, next) => { req.params.docType = "quote"; shareOgHandler(req, res, next); });
  app.get("/share/invoice/:token", (req, res, next) => { req.params.docType = "invoice"; shareOgHandler(req, res, next); });
  app.get("/share/tax-invoice/:token", (req, res, next) => { req.params.docType = "tax-invoice"; shareOgHandler(req, res, next); });
  app.get("/share/receipt/:token", (req, res, next) => { req.params.docType = "receipt"; shareOgHandler(req, res, next); });
  app.get("/share/order/:token", (req, res, next) => { req.params.docType = "order"; shareOgHandler(req, res, next); });
  app.get("/sign/:token", contractOgHandler);

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
