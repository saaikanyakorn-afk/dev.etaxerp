import pg from "pg";

interface ConfigEntry {
  config_key: string;
  config_value: string;
  environment: string;
  is_secret: boolean;
}

let _configCache: Map<string, string> = new Map();
let _configDbUrl: string = "";
let _bootstrapped = false;

export function getConfigDbUrl(): string {
  return _configDbUrl || process.env.DATABASE_URL || "";
}

export async function bootstrapConfig(): Promise<Map<string, string>> {
  const configDbUrl = process.env.DATABASE_URL;
  if (!configDbUrl) {
    console.warn("[Config] No DATABASE_URL set, skipping config bootstrap");
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
