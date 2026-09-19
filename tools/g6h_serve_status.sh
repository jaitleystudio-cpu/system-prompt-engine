#!/usr/bin/env bash
# Fast health check for the G6-H local evaluator serve path.
# Explains ERR_EMPTY_RESPONSE / connection-reset when nothing is listening.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${G6H_PORT:-8765}"
URL="http://127.0.0.1:${PORT}/evaluations/g6zc/blind_evaluator.html"
PAIRS="http://127.0.0.1:${PORT}/evaluations/g6zc/blind_pairs.json"

echo "G6-H serve status (port ${PORT})"
echo

if ! test -f evaluations/g6zc/blind_evaluator.html || ! test -f evaluations/g6zc/blind_pairs.json; then
  echo "FAIL  evaluator files missing — checkout a branch that has evaluations/g6zc/"
  exit 2
fi
echo "PASS  evaluator files present"

LISTENERS="$( (ss -tln 2>/dev/null || netstat -tln 2>/dev/null || true) | grep -E ":${PORT}\\b" || true )"
if [[ -z "${LISTENERS}" ]]; then
  echo "FAIL  nothing listening on :${PORT}"
  echo
  echo "Most likely cause of browser ERR_EMPTY_RESPONSE / Connection reset:"
  echo "  the http.server is not running (or died after a smoke test)."
  echo
  echo "Fastest fix (repo root):"
  echo "  ./tools/g6h_serve.sh"
  echo "  # or: python3 -m http.server ${PORT} --bind 127.0.0.1"
  echo
  echo "Then open:"
  echo "  ${URL}"
  exit 1
fi
echo "PASS  listener on :${PORT}"
echo "      ${LISTENERS}"

code_html="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 "${URL}" || echo 000)"
code_pairs="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 "${PAIRS}" || echo 000)"
echo "PASS  GET evaluator → HTTP ${code_html}"
echo "PASS  GET pairs     → HTTP ${code_pairs}"

if [[ "${code_html}" != "200" || "${code_pairs}" != "200" ]]; then
  echo "FAIL  expected HTTP 200 for evaluator + pairs"
  exit 1
fi

echo
echo "OPEN: ${URL}"
echo "If your browser still fails while this script PASSes:"
echo "  - you may be hitting a different machine than the one serving"
echo "  - in Cursor Cloud, wait for port ${PORT} forward / reopen the forwarded URL"
echo "  - hard-refresh; do not use a public tunnel unless the owner asked for one"
