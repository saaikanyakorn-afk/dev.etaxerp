import type { Request } from "express";

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePagination(req: Request, defaults: { pageSize?: number; maxPageSize?: number } = {}): PaginationParams {
  const maxPageSize = defaults.maxPageSize || 200;
  const defaultPageSize = defaults.pageSize || 50;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(req.query.pageSize) || defaultPageSize));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
      hasMore: params.page * params.pageSize < total,
    },
  };
}
