import json, os, re, subprocess, sys
from spe_runtime.research.rgd1.build_corpus import sanitize
from spe_runtime.research.rgd1.retrieval import BM25, rrf
from spe_runtime.research.rgd1.analyze import holm

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
FROZEN = os.path.join(ROOT, "evidence", "rgd1", "frozen")


def test_sanitize_removes_status_leaks():
    assert sanitize("RETRACTED: Effect of X on Y") == "Effect of X on Y"
    assert "retract" not in sanitize("[Retracted] Withdrawn: Study of Z").lower()


def test_task_titles_do_not_leak_retraction_status():
    T = [json.loads(l) for l in open(os.path.join(FROZEN, "tasks.jsonl"))]
    leak = [t for t in T if re.search(r"\b(retract|withdrawn)", t["query_title"], re.I)]
    assert not leak, leak[:3]


def test_splits_disjoint_and_gold_in_corpus():
    T = [json.loads(l) for l in open(os.path.join(FROZEN, "tasks.jsonl"))]
    ids = {json.loads(l)["id"] for l in open(os.path.join(FROZEN, "corpus.jsonl"))}
    assert len({t["task_id"] for t in T}) == len(T)
    for t in T:
        assert set(t["gold_ids"]) <= ids
        assert (t["kind"] == "control") == (not t["gold_ids"])


def test_bm25_and_rrf_deterministic():
    docs = [{"id": "a", "text": "retraction of vitamin d study"}, {"id": "b", "text": "vitamin d trial"}, {"id": "c", "text": "unrelated"}]
    bm = BM25(docs)
    assert bm.search("vitamin d retraction")[0][0] == "a"
    assert rrf([["a", "b"], ["b", "a"]]) == ["a", "b"]


def test_holm():
    h = holm({"x": 0.01, "y": 0.03})
    assert h["x"]["p_holm"] == 0.02 and h["y"]["p_holm"] == 0.03 and h["y"]["reject_h0"]


def test_holdout_refuses_without_prereg_match(tmp_path):
    r = subprocess.run([sys.executable, "-m", "spe_runtime.research.rgd1.run", "holdout", str(tmp_path),
                        "--expect-prereg-sha", "0" * 64], capture_output=True, text=True, cwd=ROOT)
    assert r.returncode != 0 and "REFUSED" in r.stdout + r.stderr


def test_embed_cache_creates_missing_cache_dir(tmp_path):
    # Regression (Bro replay 2026-10-13): fresh checkout crashed with FileNotFoundError on data/rgd1_cache/emb.jsonl
    from spe_runtime.research.rgd1.retrieval import EmbedCache
    p = tmp_path / "fresh" / "rgd1_cache" / "emb.jsonl"
    c = EmbedCache(str(p))
    assert p.parent.is_dir() and c.d == {}
