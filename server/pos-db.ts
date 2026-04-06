import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getConfig } from "./config-bootstrap";

const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);

const isProduction = process.env.NODE_ENV === "production";

function getPosDbUrl(): { url: string; label: string } {
  const posUrl = process.env.DATABASE_URL_POS || getConfig("DATABASE_URL_POS");
  if (posUrl) {
    return { url: posUrl, label: "POS (Separate DB)" };
  }
  const prodUrl = getConfig("DB_PROD_URL") || process.env.DB_PROD_URL;
  if (isProduction && prodUrl) {
    return { url: prodUrl, label: "POS (Shared Production DB)" };
  }
  return { url: process.env.DATABASE_URL!, label: "POS (Shared Dev DB)" };
}

let _posPool: pg.Pool | null = null;
let _posDb: NodePgDatabase<typeof schema> | null = null;
let _posLabel = "";
let _keepaliveStarted = false;

function createPosPool(): { pool: pg.Pool; db: NodePgDatabase<typeof schema> } {
  const config = getPosDbUrl();
  _posLabel = config.label;
  console.log(`[PosDB] Creating pool: ${config.label}`);

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
    console.error("[PosDB Pool] Unexpected error on idle client:", err.message);
  });

  if (isProduction && !_keepaliveStarted) {
    _keepaliveStarted = true;
    let consecutiveFailures = 0;
    setInterval(async () => {
      if (!_posPool) return;
      try {
        const client = await _posPool.connect();
        await client.query("SELECT 1");
        client.release();
        if (consecutiveFailures > 0) {
          console.log(`[PosDB Pool] Connection recovered after ${consecutiveFailures} failures`);
        }
        consecutiveFailures = 0;
      } catch (err: any) {
        consecutiveFailures++;
        console.error(`[PosDB Pool] Keepalive failed (${consecutiveFailures}x): ${err.message}`);
      }
    }, 30_000);
  }

  const db = drizzle(pool, { schema });
  _posPool = pool;
  _posDb = db;
  return { pool, db };
}

function ensurePosDb(): NodePgDatabase<typeof schema> {
  if (!_posDb) createPosPool();
  return _posDb!;
}

export const posDb: NodePgDatabase<typeof schema> = new Proxy({} as any, {
  get(_target, prop) {
    return (ensurePosDb() as any)[prop];
  },
});

export function getPosPoolInstance(): pg.Pool {
  if (!_posPool) createPosPool();
  return _posPool!;
}

export { getPosPoolInstance as posPoolInstance };

export function getPosDbLabel(): string {
  return _posLabel || "POS (not initialized)";
}

export function isPosSeparateDb(): boolean {
  const posUrl = process.env.DATABASE_URL_POS || getConfig("DATABASE_URL_POS");
  return !!posUrl;
}

export async function reinitializePosDb(): Promise<void> {
  const newConfig = getPosDbUrl();
  if (_posPool && newConfig.url && newConfig.label === _posLabel) {
    console.log(`[PosDB] reinitialize: URL unchanged, skipping`);
    return;
  }
  if (!newConfig.url) {
    console.error("[PosDB] reinitialize: no URL available");
    return;
  }
  console.log(`[PosDB] reinitialize: "${_posLabel || "none"}" → "${newConfig.label}"`);
  if (_posPool) {
    try { await _posPool.end(); } catch {}
  }
  _posPool = null;
  _posDb = null;
  createPosPool();
}
