#!/bin/sh
# Freebuff preview entrypoint: boots the NestJS API (background, port 3001)
# then runs the Vite web dev server (foreground, port 5173) which proxies /api
# to the API. DATABASE_URL + JWT_SECRET are taken from the process environment
# (API Keys) or, as a fallback, from /tmp/thulir-db-url and /tmp/thulir-jwt
# scratch files created by the workspace tooling.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Secrets: prefer injected environment (API Keys), fall back to /tmp scratch files
if [ -z "$DATABASE_URL" ] && [ -f /tmp/thulir-db-url ]; then
  export DATABASE_URL="$(cat /tmp/thulir-db-url)"
fi
if [ -z "$JWT_SECRET" ] && [ -f /tmp/thulir-jwt ]; then
  export JWT_SECRET="$(cat /tmp/thulir-jwt)"
fi

# 1) Start the API in the background if it isn't already running
if [ -f /tmp/thulir-api.pid ] && kill -0 "$(cat /tmp/thulir-api.pid)" 2>/dev/null; then
  echo "API already running (pid $(cat /tmp/thulir-api.pid)) on :3001"
else
  cd "$ROOT/apps/api"
  nohup node dist/src/main.js > /tmp/thulir-api.log 2>&1 &
  echo $! > /tmp/thulir-api.pid
  echo "API starting on :3001 (pid $(cat /tmp/thulir-api.pid); log: /tmp/thulir-api.log)"
  sleep 5
fi

# 2) Foreground: web dev server on 5173
cd "$ROOT/apps/web"
exec npm run dev
