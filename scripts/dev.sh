#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend on :8000"
cd "$ROOT"
python -m uvicorn backend.app.main:app --reload --reload-dir backend --reload-dir options_mm --port 8000 &
BACKEND_PID=$!

echo "Starting frontend on :5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait
