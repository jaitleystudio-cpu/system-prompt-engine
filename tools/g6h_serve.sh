#!/usr/bin/env bash
# Serve the G6-H blind evaluator locally (no telemetry).
# URL: http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${G6H_PORT:-8765}"
BIND="${G6H_BIND:-0.0.0.0}"

test -f evaluations/g6zc/blind_evaluator.html
test -f evaluations/g6zc/blind_pairs.json

echo "G6-H evaluator → http://127.0.0.1:${PORT}/evaluations/g6zc/blind_evaluator.html"
echo "Bind ${BIND}:${PORT} · Ctrl+C to stop · do not open randomization_manifest while rating"
exec python3 -m http.server "$PORT" --bind "$BIND"
