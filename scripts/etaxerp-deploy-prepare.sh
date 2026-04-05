#!/bin/bash
# ============================================================
# E-Tax Center — etaxerp Full Deployment Preparation Script
# ============================================================
# This script prepares everything needed if the ENTIRE codebase
# is deployed to etaxerp (worst case scenario).
#
# Run from project root: bash scripts/etaxerp-deploy-prepare.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/deploy-package"

echo "================================================"
echo "  E-Tax Center — etaxerp Deploy Preparation"
echo "================================================"
echo ""

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/config"
mkdir -p "$OUTPUT_DIR/sql"
mkdir -p "$OUTPUT_DIR/env"

# --------------------------------------------------------
# 1. Export system_config table from current database
# --------------------------------------------------------
echo "[1/6] Exporting system_config table..."

if [ -n "$DATABASE_URL" ]; then
  cat > "$OUTPUT_DIR/sql/01-create-system-config.sql" << 'SQLEOF'
-- Create system_config table if not exists
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(255) PRIMARY KEY,
  config_value TEXT NOT NULL DEFAULT '',
  description TEXT,
  environment VARCHAR(50) NOT NULL DEFAULT 'all',
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Minimum required entries for etaxerp startup
-- UPDATE these values before running on etaxerp!
INSERT INTO system_config (config_key, config_value, environment, is_secret, description) VALUES
  ('DB_PROD_URL', '<<REPLACE_WITH_PRODUCTION_DB_URL>>', 'production', true, 'Production database URL (Thailand)'),
  ('DB_PROD_LABEL', 'Production (Thailand)', 'all', false, 'Label for production database'),
  ('DB_MAIN_URL', '<<REPLACE_WITH_MAIN_DB_URL>>', 'development', true, 'Development/Main database URL'),
  ('DB_MAIN_LABEL', 'Thailand (Dev)', 'all', false, 'Label for main database')
ON CONFLICT (config_key) DO NOTHING;
SQLEOF

  echo "  → SQL template created at deploy-package/sql/01-create-system-config.sql"
  echo "  → Attempting live export from current DB..."

  psql "$DATABASE_URL" -t -A -c "
    SELECT 'INSERT INTO system_config (config_key, config_value, environment, is_secret, description) VALUES (' ||
      quote_literal(config_key) || ', ' ||
      quote_literal(config_value) || ', ' ||
      quote_literal(environment) || ', ' ||
      is_secret::text || ', ' ||
      COALESCE(quote_literal(description), 'NULL') ||
    ') ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW();'
    FROM system_config ORDER BY config_key
  " > "$OUTPUT_DIR/sql/02-seed-system-config-live.sql" 2>/dev/null || echo "  ⚠ Could not export live data (DB may be unreachable)"

  if [ -s "$OUTPUT_DIR/sql/02-seed-system-config-live.sql" ]; then
    LINES=$(wc -l < "$OUTPUT_DIR/sql/02-seed-system-config-live.sql")
    echo "  → Exported $LINES config entries to 02-seed-system-config-live.sql"
  fi
else
  echo "  ⚠ DATABASE_URL not set — skipping live export"
fi

# --------------------------------------------------------
# 2. Create .env template for etaxerp
# --------------------------------------------------------
echo ""
echo "[2/6] Creating .env template..."

cat > "$OUTPUT_DIR/env/.env.etaxerp" << 'ENVEOF'
# ============================================================
# E-Tax Center — etaxerp Environment Variables
# ============================================================
# Copy this to .env on the etaxerp server and fill in values
# ============================================================

# --- CRITICAL (server won't start without these) ---
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/etax_center

# --- Session Security ---
SESSION_SECRET=<<GENERATE_A_LONG_RANDOM_STRING>>

# --- Machine Identity (for encrypted config) ---
# Set these to enable config/etax-config.enc decryption
# If not set, server falls back to DATABASE_URL
MACHINE_NAME=<<HOSTNAME_OF_THIS_SERVER>>
MACHINE_DB_PORT=<<POSTGRES_PORT_ON_THIS_SERVER>>

# --- Database Overrides (if not using config DB) ---
# DB_PROD_URL=postgresql://user:password@host:port/database
# DB_PROD_LABEL=Production (Thailand)
# DB_MAIN_HOST=etaxerp

# --- LAN Optimization (optional) ---
# Set to "true" if DB is on same LAN as app server
# DB_MAIN_LAN=true

# --- POS / E-Commerce Separate DBs (optional) ---
# If not set, shares the main DB
# DATABASE_URL_POS=postgresql://...
# DATABASE_URL_ECOM=postgresql://...

# --- Third-Party Services ---
LINE_CHANNEL_ACCESS_TOKEN=<<FROM_LINE_DEVELOPER_CONSOLE>>
RESEND_API_KEY=<<FROM_RESEND_DASHBOARD>>
RESEND_FROM_EMAIL=noreply@yourdomain.com
GITHUB_PAT=<<PERSONAL_ACCESS_TOKEN>>
RECAPTCHA_SITE_KEY=<<FROM_GOOGLE_RECAPTCHA>>
RECAPTCHA_SECRET_KEY=<<FROM_GOOGLE_RECAPTCHA>>

# --- Object Storage (Replit-specific, may not work on etaxerp) ---
# DEFAULT_OBJECT_STORAGE_BUCKET_ID=<<BUCKET_ID>>
# PUBLIC_OBJECT_SEARCH_PATHS=<<PATHS>>
# PRIVATE_OBJECT_DIR=<<DIR>>

# --- Optional ---
# CHROMIUM_PATH=/usr/bin/chromium-browser
# SYNC_API_KEY=<<FOR_LANDING_PAGE_SYNC>>
ENVEOF

echo "  → Created deploy-package/env/.env.etaxerp"

# --------------------------------------------------------
# 3. Check required files and directories
# --------------------------------------------------------
echo ""
echo "[3/6] Checking required files..."

check_file() {
  if [ -e "$PROJECT_ROOT/$1" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 — MISSING!"
  fi
}

check_file "server/fonts/Sarabun-Regular.ttf"
check_file "server/fonts/Sarabun-Bold.ttf"
check_file "server/fonts/Sarabun-SemiBold.ttf"
check_file "server/fonts/Sarabun-Italic.ttf"
check_file "server/assets/sRGB2014.icc"
check_file "server/data/thai-addresses.json"
check_file "server/utils/machine-crypto.ts"
check_file "server/config-bootstrap.ts"

# --------------------------------------------------------
# 4. Generate deployment checklist
# --------------------------------------------------------
echo ""
echo "[4/6] Generating deployment checklist..."

cat > "$OUTPUT_DIR/DEPLOY-CHECKLIST.md" << 'MDEOF'
# etaxerp Full Deployment Checklist

## Pre-Deploy (on Replit)
- [ ] Build the project: `npm run build`
- [ ] Export system_config: `bash scripts/etaxerp-deploy-prepare.sh`
- [ ] Verify deploy-package/ contents are complete

## On etaxerp Server

### Step 1: Environment Setup
- [ ] Copy `.env.etaxerp` → `.env` and fill in ALL values
- [ ] Set `NODE_ENV=production`
- [ ] Set `DATABASE_URL` pointing to the Thai production DB
- [ ] Set `SESSION_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- [ ] Set `MACHINE_NAME` and `MACHINE_DB_PORT` (or leave unset to skip encrypted config)

### Step 2: Database Preparation
- [ ] Run `sql/01-create-system-config.sql` on the target database
- [ ] Run `sql/02-seed-system-config-live.sql` to populate config values
- [ ] Verify `system_config` has correct `DB_PROD_URL` for production

### Step 3: Encrypted Config (Optional but Recommended)
- [ ] From Infrastructure Management page → Generate Enc Config for etaxerp machine
- [ ] Save the output as `config/etax-config.enc` on the server
- [ ] Verify `MACHINE_NAME` matches the hostname used to generate

### Step 4: Required Files
- [ ] Verify `server/fonts/` contains all Sarabun TTF files
- [ ] Verify `server/assets/sRGB2014.icc` exists
- [ ] Verify `server/data/thai-addresses.json` exists
- [ ] Create `logs/` directory with write permission
- [ ] Create `uploads/` directory with write permission

### Step 5: Dependencies
- [ ] Run `npm install --production`
- [ ] Verify Node.js version >= 18

### Step 6: Start & Verify
- [ ] Start: `NODE_ENV=production node dist/index.js` (or via pm2/systemd)
- [ ] Check logs for: `[DB] Active database: Production`
- [ ] Check logs for: `Core schema ready - API enabled`
- [ ] Check NO recovery mode: `[RECOVERY MODE]` should NOT appear
- [ ] Verify login works at https://etaxerp/
- [ ] Verify POS module works

## Known Differences from Replit

### Host Binding
- Replit binds to `0.0.0.0` — etaxerp binds to `localhost`
- If accessing from external network, use a reverse proxy (nginx) or set `REPL_ID=1` to force `0.0.0.0`

### Object Storage
- Replit Object Storage (`@replit/object-storage`) won't work on etaxerp
- Logo uploads stored locally in `uploads/` directory will work
- FTP Archive features that use Object Storage may fail silently

### Schedulers
- All background schedulers (platform sync, tax reminders, GitHub push) will START on etaxerp
- On Replit production they're DISABLED (too far from TH database)
- This is CORRECT behavior for etaxerp (it's in Thailand)

### Recovery Mode
- If DB is unreachable on startup, server enters Recovery Mode
- Access `/api/recovery/status` to check
- Use `/api/recovery/update-connection` to fix DB URL

## Rollback Plan
1. Stop etaxerp server
2. Restore previous code from git
3. Restart with old codebase
4. Database schema changes are additive (new columns) — won't break old code
MDEOF

echo "  → Created deploy-package/DEPLOY-CHECKLIST.md"

# --------------------------------------------------------
# 5. Create config DB setup SQL
# --------------------------------------------------------
echo ""
echo "[5/6] Creating config DB setup SQL..."

cat > "$OUTPUT_DIR/sql/00-setup-config-db.sql" << 'SQLEOF'
-- ============================================================
-- Setup Config Database for etaxerp
-- Run this on the PostgreSQL server BEFORE first startup
-- ============================================================

-- Option A: Use existing database (recommended)
-- Just run the CREATE TABLE below on your main database

-- Option B: Separate config database
-- CREATE DATABASE etax_config;
-- \c etax_config

CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(255) PRIMARY KEY,
  config_value TEXT NOT NULL DEFAULT '',
  description TEXT,
  environment VARCHAR(50) NOT NULL DEFAULT 'all',
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Grant access (if using separate config DB user)
-- GRANT SELECT, INSERT, UPDATE ON system_config TO etax_config;
SQLEOF

echo "  → Created deploy-package/sql/00-setup-config-db.sql"

# --------------------------------------------------------
# 6. Create quick-fix script for host binding
# --------------------------------------------------------
echo ""
echo "[6/6] Creating host-binding fix helper..."

cat > "$OUTPUT_DIR/fix-host-binding.js" << 'JSEOF'
// Quick fix: If etaxerp needs to bind to 0.0.0.0 instead of localhost
// Run: REPL_ID=1 node dist/index.js
// OR: Set this env var in .env: REPL_ID=etaxerp
//
// The server checks: !!process.env.REPL_ID
// If truthy → binds 0.0.0.0 (accessible from network)
// If falsy → binds localhost (only local access, needs reverse proxy)
console.log("To bind to 0.0.0.0, add REPL_ID=etaxerp to your .env file");
console.log("Or use a reverse proxy (nginx) pointing to localhost:5000");
JSEOF

echo "  → Created deploy-package/fix-host-binding.js"

# --------------------------------------------------------
# Summary
# --------------------------------------------------------
echo ""
echo "================================================"
echo "  Deploy Package Ready!"
echo "================================================"
echo ""
echo "  Output: $OUTPUT_DIR/"
echo ""
echo "  Contents:"
ls -la "$OUTPUT_DIR/" 2>/dev/null
echo ""
echo "  SQL files:"
ls -la "$OUTPUT_DIR/sql/" 2>/dev/null
echo ""
echo "  Next steps:"
echo "  1. Review DEPLOY-CHECKLIST.md"
echo "  2. Fill in .env.etaxerp values"
echo "  3. Run SQL scripts on target DB"
echo "  4. Generate etax-config.enc from Infrastructure page"
echo "================================================"
