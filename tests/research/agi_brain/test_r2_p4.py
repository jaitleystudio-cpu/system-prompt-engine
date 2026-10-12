import ast, hashlib, pathlib, random
from spe_runtime.research.agi_brain import netsearch_r2 as ns, evaluator_r2 as ev
from spe_runtime.research.agi_brain.netsearch import Meter, batcher_net
from spe_runtime.research.agi_brain.experiment_r2 import signflip_p, holm
from spe_runtime.research.agi_brain.r2_starts import FAMS_R2

PKG = pathlib.Path(ns.__file__).parent; ROOT = PKG.parents[2]


def _imports(f):
    t = ast.parse((PKG / f).read_text())
    return {getattr(n, "module", "") or "" for n in ast.walk(t) if isinstance(n, ast.ImportFrom)} | \
           {a.name for n in ast.walk(t) if isinstance(n, (ast.Import, ast.ImportFrom)) for a in n.names}


def test_r2_verifier_and_metrics_independent_of_generators():
    assert not any("netsearch" in m for m in _imports("evaluator_r2.py"))
    assert not any("p4_ollama" in m or "longdoc" in m for m in _imports("metrics_p4.py"))


def test_select_kind_checker_agrees_with_independent_verifier():
    r = random.Random(3)
    for fam in ("select6k2", "select7k3", "median7", "sort6"):
        n = ns.parse(fam)[1]; chk = ns.Checker2(fam, Meter())
        for _ in range(200):
            net = [tuple(sorted(r.sample(range(n), 2))) for _ in range(r.randint(0, 16))]
            assert chk.exhaustive(net)[0] == ev.verify(fam, net, n_random=300)["valid"], (fam, net)


def test_heldout_families_disjoint_from_r1():
    from spe_runtime.research.agi_brain.families import FAMILIES, fid
    assert not set(FAMS_R2) & {fid(f) for f in FAMILIES}


def test_all_conditions_return_valid_networks_small_budget():
    for c in ns.COND_R2:
        r = ns.search_r2("select8k3", c, 0, 0.5)
        assert ev.verify("select8k3", r["net"])["valid"]


def test_cegis_example_set_grows_and_is_consistent():
    r = ns.search_r2("sort8", "cegis", 1, 1.0, start_net=batcher_net(8))
    assert r["model_size"] >= 1 and r["verifier_calls"] <= r["proposals"]


def test_stats_helpers():
    assert signflip_p([1.0] * 10) == 2 / 1024 and signflip_p([0.0] * 10) == 1.0
    assert holm({"a": 0.01, "b": 0.04, "c": 0.03}) == {"a": 0.03, "c": 0.06, "b": 0.06}


def test_contracts_frozen():
    h = lambda p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
    assert h("docs/agi-brain/CONTRACT_R2.md") == "1911d6af6ef075e342fe9b6820657b262878995f071834dcc43d9ff3659cb735"
    assert h("docs/agi-brain/CONTRACT_P4.md") == "ac01124cbc34e7e547001f3c730310ac740e65dc2c83a8649e35c75097ef515e"
