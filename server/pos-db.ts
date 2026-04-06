import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getConfig } from "./config-bootstrap";

const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);

function getPosDbUrl(): { url: string; label: string } {
  const posUrl = process.env.DATABASE_URL_POS || getConfig("DATABASE_URL_POS");
  if (posUrl) {
    return { url: posUrl, label: "POS (Separate DB)" };
  }
  const isProduction = process.env.NODE_ENV === "production";
  const prodUrl = getConfig("DB_PROD_URL") || process.env.DB_PROD_URL;
  if (isProduction && prodUrl) {
    return { url: prodUrl, label: "POS (Shared Production DB)" };
  }
  return { url: process.env.DATABASE_URL!, label: "POS (Shared Dev DB)" };
}

const isProduction = process.env.NODE_ENV === "production";
const posConfig = getPosDbUrl();
console.log(`[PosDB] Connection: ${posConfig.label}`);

const posPool = new pg.Pool({
  connectionString: posConfig.url,
  max: isProduction ? 15 : 10,
  min: isProduction ? 2 : 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000,
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

posPool.on("error", (err) => {
  console.error("[PosDB Pool] Unexpected error on idle client:", err.message);
});

if (isProduction) {
  let consecutiveFailures = 0;
  setInterval(async () => {
    try {
      const client = await posPool.connect();
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

export let posDb: NodePgDatabase<typeof schema> = drizzle(posPool, { schema });
export let posPoolInstance = posPool;

export function getPosDbLabel(): string {
  return posConfig.label;
}

export function isPosSeparateDb(): boolean {
  const posUrl = process.env.DATABASE_URL_POS || getConfig("DATABASE_URL_POS");
  return !!posUrl;
}

export async function reinitializePosDb(): Promise<void> {
  const newConfig = getPosDbUrl();
  if (newConfig.url === posConfig.url) {
    console.log(`[PosDB] reinitialize: URL unchanged, skipping`);
    return;
  }
  if (!newConfig.url) {
    console.error("[PosDB] reinitialize: no URL available");
    return;
  }
  console.log(`[PosDB] reinitialize: "${posConfig.label}" → "${newConfig.label}"`);
  try { await posPool.end(); } catch {}
  Object.assign(posConfig, newConfig);
  const newPool = new pg.Pool({
    connectionString: newConfig.url,
    max: isProduction ? 15 : 10,
    min: isProduction ? 2 : 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 60000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  newPool.on("error", (err) => {
    console.error("[PosDB Pool] Unexpected error on idle client:", err.message);
  });
  posDb = drizzle(newPool, { schema });
  posPoolInstance = newPool;
  console.log(`[PosDB] reinitialize complete: ${newConfig.label}`);
}
