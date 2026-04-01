import type { Request, Response, Express, RequestHandler } from "express";
import { requireAuth, requireModule, requireAnyModule, checkDocOwnership } from "./route-middleware";
import { parsePagination, paginatedResponse } from "./routes/pagination";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { companies } from "@shared/schema";

export type AuthUser = {
  id: number;
  role: string;
  tenantId: number | null;
  [key: string]: any;
};

export type RouteContext = {
  user: AuthUser;
  req: Request;
  res: Response;
};

export type CompanyRouteContext = RouteContext & {
  companyId: number;
};

export type PaginatedRouteContext = CompanyRouteContext & {
  page: number;
  pageSize: number;
  offset: number;
};

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

async function verifyCompanyAccess(user: AuthUser, companyId: number): Promise<boolean> {
  if (!companyId || isNaN(companyId)) return false;
  if (user.role === "super_admin" || user.role === "superadmin") return true;
  if (!user.tenantId) return false;
  const [company] = await db.select({ id: companies.id }).from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, user.tenantId)));
  return !!company;
}

interface RouteOptions {
  module?: string;
  modules?: string[];
  middleware?: RequestHandler[];
}

function buildMiddleware(opts: RouteOptions): RequestHandler[] {
  const mw: RequestHandler[] = [requireAuth];
  if (opts.module) mw.push(requireModule(opts.module));
  if (opts.modules && opts.modules.length > 0) mw.push(requireAnyModule(...opts.modules));
  if (opts.middleware) mw.push(...opts.middleware);
  return mw;
}

export function createRouteGroup(app: Express, opts: RouteOptions = {}) {
  function route(method: HttpMethod, path: string, handler: (ctx: RouteContext) => Promise<any>) {
    const mw = buildMiddleware(opts);
    app[method](path, ...mw, async (req: Request, res: Response) => {
      try {
        const user = req.user as AuthUser;
        const result = await handler({ user, req, res });
        if (result !== undefined && !res.headersSent) {
          res.json(result);
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(err.statusCode || 500).json({ message: err.message });
        }
      }
    });
  }

  function companyRoute(method: HttpMethod, path: string, handler: (ctx: CompanyRouteContext) => Promise<any>) {
    const mw = buildMiddleware(opts);
    app[method](path, ...mw, async (req: Request, res: Response) => {
      try {
        const user = req.user as AuthUser;
        const companyId = Number(req.query.companyId || req.body?.companyId);
        if (!companyId || isNaN(companyId)) {
          return res.status(400).json({ message: "กรุณาระบุ companyId" });
        }
        if (!(await verifyCompanyAccess(user, companyId))) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์" });
        }
        const result = await handler({ user, companyId, req, res });
        if (result !== undefined && !res.headersSent) {
          res.json(result);
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(err.statusCode || 500).json({ message: err.message });
        }
      }
    });
  }

  function paginatedRoute(method: HttpMethod, path: string, handler: (ctx: PaginatedRouteContext) => Promise<any>) {
    const mw = buildMiddleware(opts);
    app[method](path, ...mw, async (req: Request, res: Response) => {
      try {
        const user = req.user as AuthUser;
        const companyId = Number(req.query.companyId || req.body?.companyId);
        if (!companyId || isNaN(companyId)) {
          return res.status(400).json({ message: "กรุณาระบุ companyId" });
        }
        if (!(await verifyCompanyAccess(user, companyId))) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์" });
        }
        const { page, pageSize, offset } = parsePagination(req);
        const result = await handler({ user, companyId, page, pageSize, offset, req, res });
        if (result !== undefined && !res.headersSent) {
          res.json(result);
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(err.statusCode || 500).json({ message: err.message });
        }
      }
    });
  }

  function ownerRoute(method: HttpMethod, path: string, handler: (ctx: RouteContext) => Promise<any>) {
    const mw = buildMiddleware(opts);
    app[method](path, ...mw, async (req: Request, res: Response) => {
      try {
        const user = req.user as AuthUser;
        const result = await handler({ user, req, res });
        if (result !== undefined && !res.headersSent) {
          res.json(result);
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(err.statusCode || 500).json({ message: err.message });
        }
      }
    });
  }

  return { route, companyRoute, paginatedRoute, ownerRoute };
}

export function httpError(statusCode: number, message: string): never {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export function notFound(message = "ไม่พบข้อมูล"): never {
  httpError(404, message);
}

export function badRequest(message = "ข้อมูลไม่ถูกต้อง"): never {
  httpError(400, message);
}

export function forbidden(message = "ไม่มีสิทธิ์"): never {
  httpError(403, message);
}

export { parsePagination, paginatedResponse, checkDocOwnership, verifyCompanyAccess };
