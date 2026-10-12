import ast, hashlib, pathlib
import pytest
from spe_runtime.research.agi_brain import netsearch as ns, evaluator_r1 as ev
from spe_runtime.research.agi_brain.families import FAMILIES, BEST_KNOWN
from spe_runtime.research.agi_brain.experiment_r1 import split, REF

PKG = pathlib.Path(ns.__file__).parent
ROOT = PKG.parents[2]


def test_evaluator_is_independent_of_generator():
    tree = ast.parse((PKG / "evaluator_r1.py").read_text())
    mods = {getattr(n, "module", None) for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
    names = {a.name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)) for a in n.names}
    assert "netsearch" not in names and not any(m and "netsearch" in m for m in mods)


@pytest.mark.parametrize("n", range(2, 13))
def test_reference_constructions_valid(n):
    assert ev.verify("sort", n, ns.batcher_net(n))["valid"]
    assert ev.verify("sort", n, ns.insertion_net(n))["valid"]


def test_known_optimal_sort4_and_mutants_killed():
    opt = [(0, 1), (2, 3), (0, 2), (1, 3), (1, 2)]
    assert ev.verify("sort", 4, opt) == {"valid": True, "size": 5, "depth": 3, "memory_wires": 4}
    for k in range(len(opt)):  # every single-comparator deletion must be rejected
        assert not ev.verify("sort", 4, opt[:k] + opt[k + 1:])["valid"]
    assert not ev.verify("sort", 4, [(1, 0)])["valid"]  # malformed


def test_generator_internal_check_agrees_with_independent_evaluator():
    import random
    r = random.Random(7)
    for kind, n in [("sort", 5), ("minmax", 6), ("median", 5), ("median", 7)]:
        chk = ns.Checker((kind, n), ns.Meter())
        for _ in range(150):
            net = [tuple(sorted(r.sample(range(n), 2))) for _ in range(r.randint(0, 14))]
            assert chk.exhaustive(net)[0] == ev.verify(kind, n, net)["valid"], (kind, n, net)


def test_plain_search_can_false_succeed_and_tools_do_not():
    r = ns.search(("sort", 8), "A", 0, 600)
    assert not ev.verify("sort", 8, r["net"])["valid"]
    for c in "BCD":
        assert ev.verify("sort", 8, ns.search(("sort", 8), c, 0, 300)["net"])["valid"]


def test_world_model_reduces_cost_on_fixed_case():
    c = ns.search(("sort", 8), "C", 0, 300); d = ns.search(("sort", 8), "D", 0, 300)
    assert d["cost"] < c["cost"] and ev.verify("sort", 8, d["net"])["valid"]


def test_splits_disjoint_deterministic_and_cover_all():
    for s in range(10):
        tr, te = split(s)
        assert not set(tr) & set(te) and len(tr) + len(te) == len(FAMILIES) == len(REF)
        assert split(s) == (tr, te)


def test_contract_hash_is_frozen():
    h = hashlib.sha256((ROOT / "docs/agi-brain/CONTRACT_R1.md").read_bytes()).hexdigest()
    assert h == "7401e14fad02bf9ff2b175e20713efc71a89034d320d94660d95f04e0daaac06"
