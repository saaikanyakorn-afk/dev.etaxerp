import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { getConfig, isBootstrapped } from "./config-bootstrap";

const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);

const DEV_DB_CHOICE_FILE = path.join(process.cwd(), ".dev-db-choice");

function getActiveDbUrl(): { url: string; label: string; target: "usa" | "thailand" } {
  if (process.env.NODE_ENV === "production") {
    const prodUrl = getConfig("DB_PROD_URL") || process.env.DB_PROD_URL || getConfig("DB_MAIN_URL");
    const prodLabel = getConfig("DB_PROD_LABEL") || process.env.DB_PROD_LABEL || "Production (Thailand)";
    if (prodUrl) {
      return { url: prodUrl, label: prodLabel, target: "thailand" };
    }
    if (process.env.DATABASE_URL) {
      return { url: process.env.DATABASE_URL, label: "Replit (Production)", target: "usa" };
    }
    throw new Error("No database URL available: config DB has no DB_PROD_URL/DB_MAIN_URL and DATABASE_URL is not set");
  }

  try {
    if (fs.existsSync(DEV_DB_CHOICE_FILE)) {
      const choice = fs.readFileSync(DEV_DB_CHOICE_FILE, "utf-8").trim();
      if (choice === "thailand") {
        const mainUrl = getConfig("DB_MAIN_URL");
        const mainLabel = getConfig("DB_MAIN_LABEL") || "Thailand (Dev)";
        if (mainUrl) {
          return { url: mainUrl, label: mainLabel, target: "thailand" };
        }
      }
    }
  } catch {}

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for development mode");
  }
  return { url: process.env.DATABASE_URL, label: "Replit (Dev/US)", target: "usa" };
}

let activeDb = getActiveDbUrl();
const isProduction = process.env.NODE_ENV === "production";
console.log(`[DB] Active database: ${activeDb.label} (target: ${activeDb.target}), production: ${isProduction}`);
let _pool = new pg.Pool({
  connectionString: activeDb.url,
  max: isProduction ? 25 : 20,
  min: isProduction ? 3 : 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

_pool.on("error", (err) => {
  console.error("[DB Pool] Unexpected error on idle client:", err.message);
});

if (isProduction) {
  let consecutiveFailures = 0;
  let cumulativeFailures = 0;
  setInterval(async () => {
    try {
      const client = await _pool.connect();
      await client.query("SELECT 1");
      client.release();
      if (consecutiveFailures > 0) {
        console.log(`[DB Pool] Connection recovered after ${consecutiveFailures} failures`);
      }
      consecutiveFailures = 0;
      cumulativeFailures = 0;
    } catch (err: any) {
      consecutiveFailures++;
      cumulativeFailures++;
      console.error(`[DB Pool] Keepalive failed (${consecutiveFailures}x, ${cumulativeFailures} cumulative): ${err.message}`);
      if (cumulativeFailures >= 20) {
        console.error("[DB Pool] 20 consecutive failures — forcing server restart");
        process.exit(1);
      }
      if (consecutiveFailures >= 3) {
        console.warn("[DB Pool] Multiple keepalive failures — recycling pool...");
        try {
          const oldPool = _pool;
          _pool = new pg.Pool({
            connectionString: activeDb.url,
            max: 25,
            min: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            statement_timeout: 30000,
            allowExitOnIdle: false,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
          });
          _pool.on("error", (e) => console.error("[DB Pool] Error on idle client:", e.message));
          _db = drizzle(_pool, { schema });
          consecutiveFailures = 0;
          console.log("[DB Pool] Pool recycled successfully");
          setTimeout(async () => { try { await oldPool.end(); } catch {} }, 5000);
        } catch (recycleErr: any) {
          console.error("[DB Pool] Recycle failed:", recycleErr.message);
        }
      }
    }
  }, 15000);
}
let _db: NodePgDatabase<typeof schema> = drizzle(_pool, { schema });

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(_pool, prop, _pool);
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(_db, prop, _db);
  },
});

export function getActiveDbInfo() {
  return { ...activeDb };
}

export const activeDbInfo = new Proxy({} as { url: string; label: string; target: "usa" | "thailand" }, {
  get(_target, prop) {
    return (activeDb as any)[prop];
  },
});

export function setDevDbChoice(target: "usa" | "thailand") {
  fs.writeFileSync(DEV_DB_CHOICE_FILE, target, "utf-8");
}

let _switchVersion = 0;
let _recoveryMode = false;

export function isRecoveryMode(): boolean {
  return _recoveryMode;
}

export function setRecoveryMode(val: boolean): void {
  _recoveryMode = val;
}

export async function testMainDbConnection(): Promise<{ ok: boolean; error?: string; db?: string; port?: string }> {
  try {
    const client = await _pool.connect();
    const res = await client.query("SELECT current_database() as db, inet_server_port() as port");
    client.release();
    return { ok: true, db: res.rows[0].db, port: res.rows[0].port };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export function getDbSwitchVersion(): number {
  return _switchVersion;
}

export async function reinitializeFromConfig(): Promise<void> {
  const newActiveDb = getActiveDbUrl();
  if (newActiveDb.url === activeDb.url) return;

  console.log(`[DB] Reinitializing connection: ${activeDb.label} → ${newActiveDb.label}`);
  const oldPool = _pool;
  activeDb = newActiveDb;

  _pool = new pg.Pool({
    connectionString: activeDb.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  _pool.on("error", (err) => {
    console.error("[DB Pool] Unexpected error on idle client:", err.message);
  });
  _db = drizzle(_pool, { schema });
  _switchVersion++;

  setTimeout(async () => {
    try { await oldPool.end(); } catch {}
  }, 3000);
}

export async function emergencySwitchToSource(): Promise<{ success: boolean; error?: string }> {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) return { success: false, error: "DATABASE_URL not set" };
  if (activeDb.url === sourceUrl) return { success: true };

  const testPool = new pg.Pool({ connectionString: sourceUrl, connectionTimeoutMillis: 5000 });
  try { await testPool.query("SELECT 1"); } catch (err: any) {
    await testPool.end();
    return { success: false, error: "Source database is not reachable" };
  }
  await testPool.end();

  const oldPool = _pool;
  setDevDbChoice("usa");
  activeDb = { url: sourceUrl, label: "Replit (Emergency Switch)", target: "usa" };
  _pool = new pg.Pool({
    connectionString: sourceUrl, max: 20,
    idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000,
    statement_timeout: 30000, keepAlive: true, keepAliveInitialDelayMillis: 10000,
  });
  _pool.on("error", (err) => {
    console.error("[DB Pool] Unexpected error on idle client:", err.message);
  });
  _db = drizzle(_pool, { schema });
  _switchVersion++;
  setTimeout(async () => { try { await oldPool.end(); } catch {} }, 3000);

  if (activeDb.url !== sourceUrl) {
    console.error("[DB] Emergency switch FAILED — activeDb.url mismatch after switch!");
    return { success: false, error: "Switch verification failed" };
  }
  console.log("[DB] Emergency switch to source (USA) complete — verified");
  return { success: true };
}

export async function hotSwapDatabase(target: "usa" | "thailand"): Promise<{ success: boolean; error?: string }> {
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "Cannot switch database in production" };
  }

  let newUrl: string | undefined;
  if (target === "thailand") {
    newUrl = getConfig("DB_MAIN_URL");
  } else {
    newUrl = process.env.DATABASE_URL;
  }

  if (!newUrl) {
    return { success: false, error: "Target database URL not configured" };
  }

  const testPool = new pg.Pool({ connectionString: newUrl, connectionTimeoutMillis: 5000 });
  try {
    await testPool.query("SELECT 1");
  } catch (err: any) {
    await testPool.end();
    return { success: false, error: "Target database is not reachable" };
  }
  await testPool.end();

  const oldPool = _pool;

  setDevDbChoice(target);

  activeDb = getActiveDbUrl();
  _pool = new pg.Pool({
    connectionString: activeDb.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  _db = drizzle(_pool, { schema });

  _switchVersion++;

  setTimeout(async () => {
    try {
      await oldPool.end();
    } catch {}
  }, 3000);

  return { success: true };
}
