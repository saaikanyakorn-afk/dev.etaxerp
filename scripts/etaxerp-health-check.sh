#!/bin/bash
# ============================================================
# E-Tax Center — etaxerp Post-Deploy Health Check
# ============================================================
# Run on etaxerp after deployment: bash scripts/etaxerp-health-check.sh
# ============================================================

BASE_URL="${1:-http://localhost:5000}"
echo "================================================"
echo "  E-Tax Center — Health Check"
echo "  Target: $BASE_URL"
echo "================================================"
echo ""

check_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  if [ "$response" = "$expected" ]; then
    echo "  ✓ $name → HTTP $response"
  else
    echo "  ✗ $name → HTTP $response (expected $expected)"
  fi
}

echo "[1] API Endpoints..."
check_endpoint "Public Config" "$BASE_URL/api/public-config" "200"
check_endpoint "Maintenance Status" "$BASE_URL/api/maintenance/status" "200"
check_endpoint "Recovery Status" "$BASE_URL/api/recovery/status" "200"

echo ""
echo "[2] Recovery Mode Check..."
RECOVERY=$(curl -s --max-time 5 "$BASE_URL/api/recovery/status" 2>/dev/null)
if echo "$RECOVERY" | grep -q '"recoveryMode":true'; then
  echo "  ⚠ SERVER IS IN RECOVERY MODE!"
  echo "  → Database unreachable. Check DB_PROD_URL in system_config"
  echo "  → Response: $RECOVERY"
else
  echo "  ✓ Server is NOT in recovery mode"
fi

echo ""
echo "[3] Database Connection..."
DB_STATUS=$(curl -s --max-time 5 "$BASE_URL/api/recovery/status" 2>/dev/null)
if echo "$DB_STATUS" | grep -q '"dbOk":true'; then
  echo "  ✓ Database connection OK"
  DB_NAME=$(echo "$DB_STATUS" | grep -o '"db":"[^"]*"' | head -1)
  DB_PORT=$(echo "$DB_STATUS" | grep -o '"port":"[^"]*"' | head -1)
  echo "    $DB_NAME, $DB_PORT"
else
  echo "  ✗ Database connection FAILED"
fi

echo ""
echo "[4] Required Files..."
for f in server/fonts/Sarabun-Regular.ttf server/fonts/Sarabun-Bold.ttf server/assets/sRGB2014.icc server/data/thai-addresses.json; do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f — MISSING!"
  fi
done

echo ""
echo "[5] Directories..."
for d in logs uploads config; do
  if [ -d "$d" ]; then
    if [ -w "$d" ]; then
      echo "  ✓ $d/ (writable)"
    else
      echo "  ⚠ $d/ (exists but NOT writable)"
    fi
  else
    echo "  ✗ $d/ — MISSING! Create with: mkdir -p $d"
  fi
done

echo ""
echo "[6] Environment Variables..."
for var in NODE_ENV DATABASE_URL SESSION_SECRET PORT; do
  if [ -n "${!var}" ]; then
    if [ "$var" = "NODE_ENV" ] || [ "$var" = "PORT" ]; then
      echo "  ✓ $var = ${!var}"
    else
      echo "  ✓ $var = (set)"
    fi
  else
    echo "  ✗ $var — NOT SET!"
  fi
done

echo ""
echo "================================================"
echo "  Health Check Complete"
echo "================================================"
