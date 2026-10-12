import subprocess, sys
from spe_runtime.research.lvt3r3.tasks import r3_plan, make_tasks
from spe_runtime.research.lvt3r2.tasks import family_plan
from spe_runtime.research.lvt3.generator import FAMILIES
from spe_runtime.research.lvt3r3.agent import Agent
from spe_runtime.research.lvt3.evaluator import Evaluator

def test_r3_families_fresh_vs_r1_r2_and_disjoint():
    r2 = {tuple(f["struct"]) for v in family_plan().values() for f in v} | {tuple(v[1]) for v in FAMILIES.values()}
    p = r3_plan(); a = [tuple(f["struct"]) for f in p["r3val"]]; b = [tuple(f["struct"]) for f in p["r3holdout"]]
    assert not (set(a) | set(b)) & r2
    assert not set(a) & set(b) and len(set(b)) == len(b) == 120

def test_library_arms_identical_except_probe_rule():
    ev = Evaluator(1)
    arms = {c: Agent(c, 0, ev, 1000.0) for c in ("U", "R", "RR")}
    assert {(a.reg.use_guard, a.reg.use_revoke, a.budget) for a in arms.values()} == {(False, False, 1000.0)}
    assert Agent("U_guard", 0, ev, 1000.0).reg.use_guard

def test_budget_hard_for_all_library_arms():
    ev = Evaluator(2)
    for c in ("U", "R", "RR"):
        ag = Agent(c, 0, ev, 300.0)
        for t in make_tasks("r3val", 0)[:8]: assert ag.solve(t)["exec"] <= 301

def test_holdout_refuses_without_prereg_match(tmp_path):
    r = subprocess.run([sys.executable, "-m", "spe_runtime.research.lvt3r3.run", "r3holdout", str(tmp_path), "--configs", "A",
                        "--expect-prereg-sha", "0" * 64], capture_output=True, text=True)
    assert r.returncode != 0 and "REFUSED" in r.stdout + r.stderr
