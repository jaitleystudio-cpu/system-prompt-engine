#!/usr/bin/env bash
# Serve the G6-H blind evaluator locally (no telemetry).
# URL: http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
# Keep this process alive while humans rate — stopping it causes ERR_EMPTY_RESPONSE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${G6H_PORT:-8765}"
BIND="${G6H_BIND:-0.0.0.0}"

test -f evaluations/g6zc/blind_evaluator.html
test -f evaluations/g6zc/blind_pairs.json

if (ss -tln 2>/dev/null || netstat -tln 2>/dev/null || true) | grep -qE ":${PORT}\\b"; then
  echo "Port ${PORT} already has a listener."
  echo "Check: ./tools/g6h_serve_status.sh"
  echo "OPEN: http://127.0.0.1:${PORT}/evaluations/g6zc/blind_evaluator.html"
  exit 0
fi

echo "G6-H evaluator → http://127.0.0.1:${PORT}/evaluations/g6zc/blind_evaluator.html"
echo "Bind ${BIND}:${PORT} · leave this running · Ctrl+C to stop"
echo "Do not open randomization_manifest while rating"
exec python3 -m http.server "$PORT" --bind "$BIND"
