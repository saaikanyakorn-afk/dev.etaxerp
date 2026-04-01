import { db } from "../db";
import { eq, sql, and } from "drizzle-orm";
import {
  companies, ecommerceConnections,
  companyFolderCodes, storeFolderCodes,
  type CompanyFolderCode, type StoreFolderCode,
} from "@shared/schema";
import { log } from "../index";

export async function getNextCompanyFolderCode(): Promise<string> {
  const [result] = await db.execute(sql`
    SELECT folder_code FROM company_folder_codes
    ORDER BY folder_code DESC LIMIT 1
  `).then(r => r.rows as any[]);

  if (!result) return "C00001";

  const num = parseInt(result.folder_code.replace("C", ""), 10);
  return `C${String(num + 1).padStart(5, "0")}`;
}

export async function getNextStoreFolderCode(companyId: number): Promise<string> {
  const [result] = await db.execute(sql`
    SELECT folder_code FROM store_folder_codes
    WHERE company_id = ${companyId}
    ORDER BY folder_code DESC LIMIT 1
  `).then(r => r.rows as any[]);

  if (!result) return "S001";

  const num = parseInt(result.folder_code.replace("S", ""), 10);
  return `S${String(num + 1).padStart(3, "0")}`;
}

export async function ensureCompanyFolderCode(companyId: number): Promise<CompanyFolderCode> {
  const [existing] = await db.select().from(companyFolderCodes)
    .where(eq(companyFolderCodes.companyId, companyId));

  if (existing) return existing;

  const [company] = await db.select().from(companies)
    .where(eq(companies.id, companyId));

  if (!company) throw new Error(`Company ${companyId} not found`);

  const folderCode = await getNextCompanyFolderCode();

  try {
    const [created] = await db.insert(companyFolderCodes).values({
      companyId,
      folderCode,
      displayName: company.name,
      taxId: company.taxId || null,
      active: company.active,
      dirty: true,
      version: 1,
    }).returning();
    return created;
  } catch (err: any) {
    if (err.code === "23505") {
      const [retry] = await db.select().from(companyFolderCodes)
        .where(eq(companyFolderCodes.companyId, companyId));
      if (retry) return retry;
    }
    throw err;
  }
}

export async function ensureStoreFolderCode(connectionId: number): Promise<StoreFolderCode> {
  const [existing] = await db.select().from(storeFolderCodes)
    .where(eq(storeFolderCodes.connectionId, connectionId));

  if (existing) return existing;

  const [conn] = await db.select().from(ecommerceConnections)
    .where(eq(ecommerceConnections.id, connectionId));

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  const folderCode = await getNextStoreFolderCode(conn.companyId);

  const [created] = await db.insert(storeFolderCodes).values({
    companyId: conn.companyId,
    connectionId,
    folderCode,
    displayName: conn.shopName,
    platform: conn.platform,
    active: conn.status !== "disconnected",
    dirty: true,
    version: 1,
  }).returning();

  return created;
}

export async function markCompanyDirty(companyId: number, newDisplayName?: string, newTaxId?: string): Promise<void> {
  const updates: Record<string, any> = {
    dirty: true,
    version: sql`version + 1`,
    updatedAt: new Date(),
  };
  if (newDisplayName !== undefined) updates.displayName = newDisplayName;
  if (newTaxId !== undefined) updates.taxId = newTaxId;

  await db.update(companyFolderCodes)
    .set(updates)
    .where(eq(companyFolderCodes.companyId, companyId));
}

export async function markStoreDirty(connectionId: number, newDisplayName?: string, newPlatform?: string): Promise<void> {
  const updates: Record<string, any> = {
    dirty: true,
    version: sql`version + 1`,
    updatedAt: new Date(),
  };
  if (newDisplayName !== undefined) updates.displayName = newDisplayName;
  if (newPlatform !== undefined) updates.platform = newPlatform;

  await db.update(storeFolderCodes)
    .set(updates)
    .where(eq(storeFolderCodes.connectionId, connectionId));
}

export async function getCompanyFolderCode(companyId: number): Promise<string | null> {
  const [row] = await db.select({ folderCode: companyFolderCodes.folderCode })
    .from(companyFolderCodes)
    .where(eq(companyFolderCodes.companyId, companyId));
  return row?.folderCode || null;
}

export async function getStoreFolderCode(connectionId: number): Promise<string | null> {
  const [row] = await db.select({ folderCode: storeFolderCodes.folderCode })
    .from(storeFolderCodes)
    .where(eq(storeFolderCodes.connectionId, connectionId));
  return row?.folderCode || null;
}

export async function getDirtyEntries(): Promise<{
  companies: CompanyFolderCode[];
  stores: StoreFolderCode[];
}> {
  const dirtyCompanies = await db.select().from(companyFolderCodes)
    .where(eq(companyFolderCodes.dirty, true));
  const dirtyStores = await db.select().from(storeFolderCodes)
    .where(eq(storeFolderCodes.dirty, true));

  return { companies: dirtyCompanies, stores: dirtyStores };
}

export async function markSynced(type: "company" | "store", id: number): Promise<void> {
  const now = new Date();
  if (type === "company") {
    await db.update(companyFolderCodes)
      .set({ dirty: false, lastSyncedAt: now })
      .where(eq(companyFolderCodes.id, id));
  } else {
    await db.update(storeFolderCodes)
      .set({ dirty: false, lastSyncedAt: now })
      .where(eq(storeFolderCodes.id, id));
  }
}

export async function getAllDirectoryEntries(): Promise<{
  companies: Array<{ folderCode: string; displayName: string; taxId: string | null; active: boolean; version: number }>;
  stores: Array<{ companyFolderCode: string; folderCode: string; displayName: string; platform: string | null; active: boolean; version: number }>;
}> {
  const allCompanies = await db.select().from(companyFolderCodes);
  const allStores = await db.select().from(storeFolderCodes);

  const companyCodeMap = new Map(allCompanies.map(c => [c.companyId, c.folderCode]));

  return {
    companies: allCompanies.map(c => ({
      folderCode: c.folderCode,
      displayName: c.displayName,
      taxId: c.taxId,
      active: c.active,
      version: c.version,
    })),
    stores: allStores.map(s => ({
      companyFolderCode: companyCodeMap.get(s.companyId) || "UNKNOWN",
      folderCode: s.folderCode,
      displayName: s.displayName,
      platform: s.platform,
      active: s.active,
      version: s.version,
    })),
  };
}

export async function backfillFolderCodes(): Promise<{ companyCodes: number; storeCodes: number }> {
  let companyCodes = 0;
  let storeCodes = 0;

  const allCompanies = await db.select({ id: companies.id, name: companies.name, taxId: companies.taxId, active: companies.active })
    .from(companies);

  for (const company of allCompanies) {
    const [existing] = await db.select().from(companyFolderCodes)
      .where(eq(companyFolderCodes.companyId, company.id));
    if (!existing) {
      await ensureCompanyFolderCode(company.id);
      companyCodes++;
    }
  }

  const allConnections = await db.select({ id: ecommerceConnections.id, companyId: ecommerceConnections.companyId })
    .from(ecommerceConnections);

  for (const conn of allConnections) {
    const [existing] = await db.select().from(storeFolderCodes)
      .where(eq(storeFolderCodes.connectionId, conn.id));
    if (!existing) {
      await ensureStoreFolderCode(conn.id);
      storeCodes++;
    }
  }

  return { companyCodes, storeCodes };
}

export function buildArchivePath(
  companyCode: string,
  storeCode: string | null,
  dateStr: string,
  filename: string
): string {
  const yearMonth = dateStr.slice(0, 7);
  if (storeCode) {
    return `${companyCode}/${storeCode}/${yearMonth}/${filename}`;
  }
  return `${companyCode}/${yearMonth}/${filename}`;
}

const NTFS_MAX_PATH = 260;
// NTFS_ROOT_OVERHEAD: The FTP remote path (e.g. "/archive") is shorter than the actual
// Windows disk path (e.g. "D:\Server\Websites\Default\fa\archive"). This overhead accounts
// for the hidden Windows root prefix so that files can be safely moved/copied via Windows
// Explorer without hitting the 260-char MAX_PATH limit.
// Production server: tax-gateway.hopto.org → D:\Server\Websites\Default\fa (29 chars)
// The "/fa" folder was shortened from "/app_attachment" to save 12 chars on NTFS paths.
const NTFS_ROOT_OVERHEAD = 45;

export function validateArchivePath(
  ftpRemotePath: string,
  relativePath: string
): { valid: boolean; fullPath: string; length: number } {
  const fullPath = `${ftpRemotePath}/${relativePath}`;
  const length = fullPath.length + NTFS_ROOT_OVERHEAD;
  return { valid: length <= NTFS_MAX_PATH, fullPath, length };
}
