#!/usr/bin/env bash
# Run EGAC tests and the E01 re-gate against THIS checkout, whatever venv is active (editable-install trap fix).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PY="${PYTHON:-python3}"
export PYTHONPATH="$REPO${PYTHONPATH:+:$PYTHONPATH}"
"$PY" -c "import spe_runtime,sys,pathlib; p=pathlib.Path(spe_runtime.__file__).resolve(); sys.exit(0 if pathlib.Path('$REPO') in p.parents else 'spe_runtime resolves to '+str(p))"
cd "$REPO"
"$PY" -m pytest -q -p no:cacheprovider tests/research/egac
"$PY" scripts/egac/regate_e01.py
