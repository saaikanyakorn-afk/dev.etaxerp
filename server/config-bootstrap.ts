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

function resolveConfigDbUrl(): string | null {
  const machineName = process.env.MACHINE_NAME;
  const machineDbPort = process.env.MACHINE_DB_PORT;
  if (!machineName || !machineDbPort) {
    if (machineName && !machineDbPort) console.warn("[Config] MACHINE_NAME set but MACHINE_DB_PORT missing");
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return null;
  }

  const encFile = path.join(process.cwd(), "config", "etax-config.enc");
  if (!fs.existsSync(encFile)) {
    console.warn(`[Config] Encrypted config not found at ${encFile}`);
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
      console.error("[Config] Could not determine MAC address");
      return null;
    }

    const encrypted = fs.readFileSync(encFile, "utf-8").trim();
    const key = deriveKey(hostname, mac, machineDbPort);
    const decrypted = JSON.parse(decrypt(encrypted, key));
    const cfg = decrypted.configDb;
    const url = `postgresql://${cfg.user}:${encodeURIComponent(cfg.password)}@${cfg.host}:${cfg.port}/${cfg.database}`;
    console.log(`[Config] Decrypted config for machine: ${hostname}`);
    return url;
  } catch (err: any) {
    console.error(`[Config] Failed to decrypt config: ${err.message}`);
    return null;
  }
}

export function getConfigDbUrl(): string {
  return _configDbUrl || process.env.DATABASE_URL || "";
}

export async function bootstrapConfig(): Promise<Map<string, string>> {
  const configDbUrl = isReplit() ? process.env.DATABASE_URL : resolveConfigDbUrl();
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
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_config'
      )
    `);

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
    console.log(`[Config] Loaded ${loaded} config entries (${secrets} secrets) from config DB`);

    _bootstrapped = true;
    await pool.end();
  } catch (err: any) {
    console.error(`[Config] Bootstrap failed: ${err.message} — falling back to env vars`);
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
