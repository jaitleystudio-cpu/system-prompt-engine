"""Re-gate all E01 control prompts with the current gate and print a hash of the treatment prompts.
Frozen-run reference (f8c4f88e): 120/120 allowed, sha256[:16] of "\n\0".join(outputs) = 48b471c474652f2d."""
import hashlib, pathlib, sys
REPO = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
import spe_runtime  # noqa: E402
assert REPO in pathlib.Path(spe_runtime.__file__).resolve().parents, spe_runtime.__file__
from spe_runtime.egac.e01 import build_tasks, make_prompt, run_canaries  # noqa: E402
from spe_runtime.egac.conservation import run_gated  # noqa: E402
from spe_runtime.egac.transforms import TECHNIQUES  # noqa: E402
ts = build_tasks(); outs = []; ok = 0
for t in ts:
    ctrl = make_prompt(t["pretty"], t["question"]); g = run_gated(TECHNIQUES["json_minify"], ctrl)
    ok += g.allowed; outs.append(g.output if g.allowed else ctrl)
h = hashlib.sha256("\n\0".join(outs).encode()).hexdigest()[:16]
c = run_canaries()
print(f"tasks={len(ts)} allowed={ok} treatment_sha16={h} canaries_valid={c['n_valid']} malformed={c['n_malformed']} critical={len(c['critical_failures'])}")
sys.exit(0 if (ok, h) == (120, "48b471c474652f2d") else 1)
