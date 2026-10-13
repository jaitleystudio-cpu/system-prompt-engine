"""Guard against the venv editable-install trap (Bro replay 2, 2026-10-13): an editable install of ANOTHER
checkout can make `import spe_runtime` resolve outside this repo, so the tests silently exercise other code.
Fail loudly instead."""
import pathlib
import spe_runtime

REPO = pathlib.Path(__file__).resolve().parents[3]
_got = pathlib.Path(spe_runtime.__file__).resolve()
if REPO not in _got.parents:
    raise RuntimeError(f"spe_runtime imported from {_got}, not from this checkout {REPO}. "
                       f"Run with PYTHONPATH={REPO} (or scripts/egac/run_tests.sh), or `pip install -e {REPO}`.")
