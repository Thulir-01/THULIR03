#!/bin/sh
# Boots the THULIR03 NestJS API in the background on :3001 if it isn't already
# running. Runs as the web app's `predev` hook so the Freebuff preview always
# has its backend available (no dependence on the flaky preview CLI).
#
# Secrets come from the process environment (Freebuff API Keys) or, as a
# fallback, from the /tmp scratch files written by workspace tooling.
# This script never fails the build (always exits 0).
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Already responding on :3001? Nothing to do (curl returns 0 for any HTTP
# response, including the 404 the API returns on "/").
if curl -s -o /dev/null --max-time 2 http://localhost:3001/ 2>/dev/null; then
  echo "[start-api-bg] API already responding on :3001 — skip"
  exit 0
fi

# Secrets: prefer injected environment (API Keys), fall back to /tmp scratch files
if [ -z "${DATABASE_URL:-}" ] && [ -f /tmp/thulir-db-url ]; then
  export DATABASE_URL="$(cat /tmp/thulir-db-url)"
fi
if [ -z "${JWT_SECRET:-}" ] && [ -f /tmp/thulir-jwt ]; then
  export JWT_SECRET="$(cat /tmp/thulir-jwt)"
fi

if [ -z "${DATABASE_URL:-}" ] || [ -z "${JWT_SECRET:-}" ]; then
  echo "[start-api-bg] DATABASE_URL / JWT_SECRET missing — API not started"
  exit 0
fi

if [ ! -f "$ROOT/apps/api/dist/src/main.js" ]; then
  echo "[start-api-bg] apps/api/dist/src/main.js missing — build the API first"
  exit 0
fi

cd "$ROOT/apps/api"
nohup node dist/src/main.js > /tmp/thulir-api.log 2>&1 &
echo $! > /tmp/thulir-api.pid
echo "[start-api-bg] API starting on :3001 (pid $(cat /tmp/thulir-api.pid); log: /tmp/thulir-api.log)"
exit 0
