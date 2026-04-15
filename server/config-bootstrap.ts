import pg from "pg";
import fs from "fs";
import path from "path";
import os from "os";

interface ConfigEntry {
  config_key: string;
  config_value: string;
  environment: string;
  is_secret: boolean;
}

let _configCache: Map<string, string> = new Map();
let _configDbUrl: string = "";
let _bootstrapped = false;

function isReplit(): boolean {
  return !!(process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPLIT_DOMAINS);
}

let _unauthorized = false;
let _unauthorizedReason = "";

export function isUnauthorizedMachine(): boolean {
  return _unauthorized;
}
export function getUnauthorizedReason(): string {
  return _unauthorizedReason;
}

function resolveConfigDbUrl(): string | null {
  const machineName = process.env.MACHINE_NAME;
  const machineDbPort = process.env.MACHINE_DB_PORT;
  if (!machineName || !machineDbPort) {
    if (machineName && !machineDbPort) {
      _unauthorized = true;
      _unauthorizedReason = "MACHINE_NAME is set but MACHINE_DB_PORT is missing";
      console.error("[Config] UNAUTHORIZED: MACHINE_NAME set but MACHINE_DB_PORT missing");
      return null;
    }
    _unauthorized = true;
    _unauthorizedReason = "No MACHINE_NAME configured — encryption key required";
    console.error("[Config] UNAUTHORIZED: No MACHINE_NAME — this machine has no encryption identity");
    return null;
  }

  const encFile = path.join(process.cwd(), "config", "etax-config.enc");
  if (!fs.existsSync(encFile)) {
    _unauthorized = true;
    _unauthorizedReason = `Encrypted config file not found at ${encFile}`;
    console.error(`[Config] UNAUTHORIZED: Encrypted config not found at ${encFile}`);
    return null;
  }

  try {
    const { deriveKey, decrypt } = require("./utils/machine-crypto");
    const hostname = machineName;
    const nets = os.networkInterfaces();
    let mac = "";
    for (const ifaces of Object.values(nets)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
          mac = iface.mac;
          break;
        }
      }
      if (mac) break;
    }

    if (!mac) {
      _unauthorized = true;
      _unauthorizedReason = "Could not determine MAC address for decryption";
      console.error("[Config] UNAUTHORIZED: Could not determine MAC address");
      return null;
    }

    const encrypted = fs.readFileSync(encFile, "utf-8").trim();
    console.log(`[Config] Deriving key with hostname=${hostname}, mac=${mac}, port=${machineDbPort}`);
    const key = deriveKey(hostname, mac, machineDbPort);
    const decrypted = JSON.parse(decrypt(encrypted, key));
    const cfg = decrypted.configDb;
    const url = `postgresql://${cfg.user}:${encodeURIComponent(cfg.password)}@${cfg.host}:${cfg.port}/${cfg.database}`;
    console.log(`[Config] Decrypted config OK → ${cfg.host}:${cfg.port}/${cfg.database}`);
    return url;
  } catch (err: any) {
    _unauthorized = true;
    _unauthorizedReason = `Decryption failed: ${err.message}`;
    console.error(`[Config] UNAUTHORIZED: Failed to decrypt config — ${err.message}`);
    return null;
  }
}

export function getConfigDbUrl(): string {
  return _configDbUrl || process.env.DATABASE_URL || "";
}

export async function bootstrapConfig(): Promise<Map<string, string>> {
  let configDbUrl: string | null = null;
  if (isReplit()) {
    configDbUrl = process.env.DATABASE_URL || null;
  } else {
    configDbUrl = resolveConfigDbUrl();
    if (!configDbUrl && _unauthorized) {
      console.error("╔══════════════════════════════════════════════════════════╗");
      console.error("║  This is not an Authorized machine to run this Application  ║");
      console.error("║  Reason: " + _unauthorizedReason.padEnd(48) + "║");
      console.error("╚══════════════════════════════════════════════════════════╝");
      return _configCache;
    }
  }
  if (!configDbUrl) {
    console.warn("[Config] No config DB URL resolved, skipping config bootstrap");
    return _configCache;
  }

  _configDbUrl = configDbUrl;

  const pool = new pg.Pool({
    connectionString: configDbUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });

  try {
    console.log("[Config] Connecting to config DB...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_config'
      )
    `);
    console.log(`[Config] Table check: system_config exists = ${tableCheck.rows[0].exists}`);

    if (!tableCheck.rows[0].exists) {
      console.log("[Config] system_config table not found, using env vars only");
      await pool.end();
      return _configCache;
    }

    const env = process.env.NODE_ENV === "production" ? "production" : "development";
    const result = await pool.query<ConfigEntry>(
      `SELECT config_key, config_value, environment, is_secret 
       FROM system_config 
       WHERE environment IN ('all', $1) AND config_value != ''`,
      [env]
    );

    for (const row of result.rows) {
      _configCache.set(row.config_key, row.config_value);
    }

    const loaded = result.rows.length;
    const secrets = result.rows.filter(r => r.is_secret).length;
    const keys = result.rows.map(r => r.config_key).join(", ");
    console.log(`[Config] Loaded ${loaded} config entries (${secrets} secrets) from config DB: [${keys}]`);

    _bootstrapped = true;
    await pool.end();
  } catch (err: any) {
    console.log(`[Config] Bootstrap FAILED: ${err.message}`);
    try { await pool.end(); } catch {}
  }

  return _configCache;
}

export function getConfig(key: string, fallbackEnvVar?: string): string {
  const fromConfig = _configCache.get(key);
  if (fromConfig) return fromConfig;

  if (fallbackEnvVar && process.env[fallbackEnvVar]) {
    return process.env[fallbackEnvVar]!;
  }

  return "";
}

export async function refreshConfigKeys(keys: string[]): Promise<void> {
  const configDbUrl = getConfigDbUrl();
  if (!configDbUrl || keys.length === 0) return;

  const pool = new pg.Pool({
    connectionString: configDbUrl,
    max: 1,
    connectionTimeoutMillis: 8000,
  });

  try {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
    const result = await pool.query<ConfigEntry>(
      `SELECT config_key, config_value FROM system_config WHERE config_key IN (${placeholders}) AND config_value != ''`,
      keys
    );
    for (const row of result.rows) {
      _configCache.set(row.config_key, row.config_value);
    }
    await pool.end();
  } catch (err: any) {
    console.log(`[Config] refreshConfigKeys failed: ${err.message?.slice(0, 100)}`);
    try { await pool.end(); } catch {}
  }
}

export function isBootstrapped(): boolean {
  return _bootstrapped;
}

export function getAllConfig(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of _configCache) {
    result[key] = value;
  }
  return result;
}

export async function updateConfig(key: string, value: string): Promise<boolean> {
  const configDbUrl = getConfigDbUrl();
  if (!configDbUrl) return false;

  const pool = new pg.Pool({
    connectionString: configDbUrl,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query(
      `UPDATE system_config SET config_value = $1, updated_at = NOW() WHERE config_key = $2`,
      [value, key]
    );
    _configCache.set(key, value);
    await pool.end();
    return true;
  } catch (err: any) {
    console.error(`[Config] Failed to update ${key}: ${err.message}`);
    try { await pool.end(); } catch {}
    return false;
  }
}

export async function setConfig(key: string, value: string, description?: string, isSecret: boolean = false, environment: string = "all"): Promise<boolean> {
  const configDbUrl = getConfigDbUrl();
  if (!configDbUrl) return false;

  const pool = new pg.Pool({
    connectionString: configDbUrl,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query(
      `INSERT INTO system_config (config_key, config_value, description, environment, is_secret, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (config_key) DO UPDATE SET config_value = $2, description = COALESCE($3, system_config.description), updated_at = NOW()`,
      [key, value, description || null, environment, isSecret]
    );
    _configCache.set(key, value);
    await pool.end();
    return true;
  } catch (err: any) {
    console.error(`[Config] Failed to set ${key}: ${err.message}`);
    try { await pool.end(); } catch {}
    return false;
  }
}
