"""Mutation / adversarial tests: the qualifier must reject forged, leaky and overfit
capabilities, and must never reuse a revoked capability."""
import ast, pathlib, random
import pytest
from spe_runtime.research.lvt3 import dsl
from spe_runtime.research.lvt3.evaluator import Evaluator, reference, broad_input
from spe_runtime.research.lvt3.generator import Task, make_tasks
from spe_runtime.research.lvt3.registry import Registry, Capability, Counter
from spe_runtime.research.lvt3.solver import Agent
from spe_runtime.research.lvt3.experiment import run_config, metrics

PKG = pathlib.Path(__file__).resolve().parents[3] / "spe_runtime" / "research" / "lvt3"


def _tasks(spec, n=2):
    return [Task(f"t{i}", "X", "train", spec, ((1, 2, 3), (4, 5, 6), (7, 8, 9))) for i in range(n)]


def test_evaluator_is_independent_of_solver_interpreter():
    tree = ast.parse((PKG / "evaluator.py").read_text())
    names = {a.name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)) for a in n.names}
    mods = {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
    assert "dsl" not in names and not any(m and "dsl" in m for m in mods)


def test_reference_and_dsl_agree_differentially():
    rng = random.Random(7)
    progs = dsl.all_programs()
    for _ in range(3000):
        p = rng.choice(progs); x = broad_input(rng)
        assert dsl.run(p, x) == reference(p, x), (p, x)


def test_forged_unsigned_verdict_rejected():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    t = _tasks((("sort", None),), 1)[0]
    forged = {"task_id": t.task_id, "pass": True, "sig": "00" * 32}
    with pytest.raises(ValueError):
        reg.record(("sort",), forged, t, "train", [(1,)])


def test_verdict_replayed_onto_other_task_rejected():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    a, b = _tasks((("sort", None),), 2)
    v = ev.verify(a.task_id, a.spec, lambda x: tuple(sorted(x)))
    with pytest.raises(ValueError):
        reg.record(("sort",), v, b, "train", [(1,)])


def test_forged_capability_claims_are_ignored():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    cap = Capability(cap_id="rev", struct=("rev",), claimed={"verdicts": [True, True], "hash": "deadbeef"})
    assert reg.admit_external(cap, _tasks((("sort", None), ("take", 2)))) is False


class LeakyCap(Capability):
    """Memorises hidden test I/O of its evidence tasks (lookup table)."""
    def __init__(self, ev, tasks):
        super().__init__(cap_id="leaky", struct=None)
        self.table = {}
        for t in tasks:
            for x in ev.hidden_inputs(t.task_id):
                self.table[x] = reference(t.spec, x)
    def fit_callable(self, examples, ctr):
        return lambda x: self.table.get(tuple(x), tuple(x))


def test_leaky_lookup_capability_rejected():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    tasks = _tasks((("abs", None), ("rev", None)))
    cap = LeakyCap(ev, tasks)
    # sanity: it really does pass the original hidden tests
    assert ev.verify(tasks[0].task_id, tasks[0].spec, cap.fit_callable([], Counter()))["pass"]
    assert reg.admit_external(cap, tasks) is False


def test_overfit_capability_rejected():
    # [sort] fits positive-only visible examples of [abs, sort] but not broad inputs
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    cap = Capability(cap_id="sort", struct=("sort",))
    assert reg.admit_external(cap, _tasks((("abs", None), ("sort", None)))) is False


def test_genuine_capability_admitted():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    cap = Capability(cap_id="sort|take", struct=("sort", "take"))
    assert reg.admit_external(cap, _tasks((("sort", None), ("take", 3)))) is True


def test_revoked_capability_never_reused():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    cap = Capability(cap_id="sort|take", struct=("sort", "take"))
    assert reg.admit_external(cap, _tasks((("sort", None), ("take", 3))))
    assert cap in reg.usable([((1, 2, 3), (1, 2))])
    cap.revoked = True
    assert cap not in reg.usable([((1, 2, 3), (1, 2))])


def test_revocation_triggers_on_repeated_signed_failures():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    ok_tasks = _tasks((("sort", None), ("take", 3)), 2)
    for t in ok_tasks:
        reg.record(("sort", "take"), ev.verify(t.task_id, t.spec, lambda x: tuple(sorted(x))[:3]), t, "train", [(1, -1, 1)])
    cap = reg.caps[("sort", "take")]
    assert cap.admitted and not cap.revoked
    bad = [Task(f"b{i}", "X", "train", (("sortd", None), ("take", 3)), ((1, 2, 3),)) for i in range(3)]
    for t in bad:
        reg.record(("sort", "take"), ev.verify(t.task_id, t.spec, lambda x: tuple(sorted(x))[:3]), t, "train", [(1,)])
    assert cap.revoked


def test_guard_blocks_out_of_envelope_inputs():
    ev = Evaluator(0); reg = Registry(ev, True, True, 0)
    cap = Capability(cap_id="sort|take", struct=("sort", "take"), admitted=True, env_max_len=4)
    reg.caps[cap.struct] = cap
    assert reg.usable([((1, 2, 3), (1, 2))]) == [cap]
    assert reg.usable([((-1, 2, 3), (-1, 2))]) == []          # negatives never qualified
    assert reg.usable([((1, 2, 3, 4, 5), (1, 2))]) == []     # longer than envelope


def test_hidden_phase_gives_no_feedback_to_registry():
    ev = Evaluator(0); ag = Agent("E", 0, ev)
    t = [x for x in make_tasks(0) if x.split == "hidden"][0]
    res = ag.solve(t); ag.feedback(t, res)
    assert ag.reg.caps == {}


def test_probe_pool_disjoint_from_hidden():
    ev = Evaluator(3)
    for tid in ["a", "b", "c"]:
        assert not set(ev.probe_pool(tid)) & set(ev.hidden_inputs(tid))


def test_no_hardcoded_scores_and_deterministic():
    a = metrics(run_config((1, "D"))[2]); b = metrics(run_config((1, "D"))[2])
    assert a == b
    src = (PKG / "experiment.py").read_text() + (PKG / "solver.py").read_text()
    assert "verified_success\": 0." not in src
