import subprocess, sys
from spe_runtime.research.lvt3r2.tasks import family_plan, make_tasks, manifest_hash
from spe_runtime.research.lvt3r2.agent import Agent, Meter, Budget
from spe_runtime.research.lvt3r2.stats import holm, paired
from spe_runtime.research.lvt3.evaluator import Evaluator
import pytest

def test_splits_family_disjoint_and_deterministic():
    p = family_plan(); q = family_plan()
    assert manifest_hash(p) == manifest_hash(q)
    seen = {}
    for split, fams in p.items():
        for f in fams:
            assert tuple(f["struct"]) not in seen, (f, seen.get(tuple(f["struct"])))
            seen[tuple(f["struct"])] = split

def test_novel_families_share_no_train_substructure():
    p = family_plan(); train = [tuple(f["struct"]) for f in p["train"]]
    subs = {s for s in train if len(s) == 2} | {s[i:i+2] for s in train if len(s) == 3 for i in range(2)}
    for split in ("dev", "val", "holdout"):
        for f in p[split]:
            s = tuple(f["struct"])
            if f["kind"] == "novel": assert not ({s[0:2], s[1:3]} & subs)
            else: assert {s[0:2], s[1:3]} & subs

def test_budget_is_hard():
    m = Meter(10)
    with pytest.raises(Budget):
        for _ in range(11): m.tick()

def test_capped_agent_respects_budget():
    ev = Evaluator(5); ag = Agent("E_CAPPED", 0, ev, budget=500)
    for t in make_tasks("val", 0)[:10]:
        assert ag.solve(t)["exec"] <= 500 + 1

def test_task_object_never_reaches_hidden_inputs_via_agent():
    import inspect, spe_runtime.research.lvt3r2.agent as a
    src = inspect.getsource(a.Agent.solve)
    assert "hidden_inputs" not in src and "verify(" not in src

def test_holdout_refuses_without_matching_prereg(tmp_path):
    r = subprocess.run([sys.executable, "-m", "spe_runtime.research.lvt3r2.run", "holdout", str(tmp_path),
                        "--configs", "A", "--expect-prereg-sha", "0" * 64], capture_output=True, text=True)
    assert r.returncode != 0 and "REFUSED" in (r.stderr + r.stdout)

def test_holm_monotone_and_paired_ci():
    h = holm({"a": 0.01, "b": 0.04, "c": 0.03})
    assert h["a"]["p_holm"] == pytest.approx(0.03) and h["c"]["p_holm"] == pytest.approx(0.06)
    assert not h["b"]["reject_h0"]
    r = paired([0.1] * 10); assert r["ci_lo"] == pytest.approx(0.1)
