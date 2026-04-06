import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getConfig } from "./config-bootstrap";

const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);

const isProduction = process.env.NODE_ENV === "production";

function getEcomDbUrl(): { url: string; label: string } {
  const ecomUrl = process.env.DATABASE_URL_ECOM || getConfig("DATABASE_URL_ECOM");
  if (ecomUrl) {
    return { url: ecomUrl, label: "E-Commerce (Separate DB)" };
  }
  const prodUrl = getConfig("DB_PROD_URL") || process.env.DB_PROD_URL;
  if (isProduction && prodUrl) {
    return { url: prodUrl, label: "E-Commerce (Shared Production DB)" };
  }
  return { url: process.env.DATABASE_URL!, label: "E-Commerce (Shared Dev DB)" };
}

let _ecomPool: pg.Pool | null = null;
let _ecomDb: NodePgDatabase<typeof schema> | null = null;
let _ecomLabel = "";
let _keepaliveStarted = false;

function createEcomPool(): { pool: pg.Pool; db: NodePgDatabase<typeof schema> } {
  const config = getEcomDbUrl();
  _ecomLabel = config.label;
  console.log(`[EcomDB] Creating pool: ${config.label}`);

  const pool = new pg.Pool({
    connectionString: config.url,
    max: isProduction ? 15 : 10,
    min: isProduction ? 2 : 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 60000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("[EcomDB Pool] Unexpected error on idle client:", err.message);
  });

  if (isProduction && !_keepaliveStarted) {
    _keepaliveStarted = true;
    let consecutiveFailures = 0;
    setInterval(async () => {
      if (!_ecomPool) return;
      try {
        const client = await _ecomPool.connect();
        await client.query("SELECT 1");
        client.release();
        if (consecutiveFailures > 0) {
          console.log(`[EcomDB Pool] Connection recovered after ${consecutiveFailures} failures`);
        }
        consecutiveFailures = 0;
      } catch (err: any) {
        consecutiveFailures++;
        console.error(`[EcomDB Pool] Keepalive failed (${consecutiveFailures}x): ${err.message}`);
      }
    }, 30_000);
  }

  const db = drizzle(pool, { schema });
  _ecomPool = pool;
  _ecomDb = db;
  return { pool, db };
}

function ensureEcomDb(): NodePgDatabase<typeof schema> {
  if (!_ecomDb) createEcomPool();
  return _ecomDb!;
}

export const ecomDb: NodePgDatabase<typeof schema> = new Proxy({} as any, {
  get(_target, prop) {
    return (ensureEcomDb() as any)[prop];
  },
});

export function getEcomPoolInstance(): pg.Pool {
  if (!_ecomPool) createEcomPool();
  return _ecomPool!;
}

export { getEcomPoolInstance as ecomPoolInstance };

export function getEcomDbLabel(): string {
  return _ecomLabel || "E-Commerce (not initialized)";
}

export function isEcomSeparateDb(): boolean {
  const ecomUrl = process.env.DATABASE_URL_ECOM || getConfig("DATABASE_URL_ECOM");
  return !!ecomUrl;
}

export async function reinitializeEcomDb(): Promise<void> {
  const newConfig = getEcomDbUrl();
  if (_ecomPool && newConfig.url && newConfig.label === _ecomLabel) {
    console.log(`[EcomDB] reinitialize: URL unchanged, skipping`);
    return;
  }
  if (!newConfig.url) {
    console.error("[EcomDB] reinitialize: no URL available");
    return;
  }
  console.log(`[EcomDB] reinitialize: "${_ecomLabel || "none"}" → "${newConfig.label}"`);
  if (_ecomPool) {
    try { await _ecomPool.end(); } catch {}
  }
  _ecomPool = null;
  _ecomDb = null;
  createEcomPool();
}
