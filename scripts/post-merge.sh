#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -5

echo "[post-merge] Done!"
