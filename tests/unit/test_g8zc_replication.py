"""G8-ZC hermetic full-system replay tests + mutations."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from spe_runtime.core import compile_and_persist_spe
from spe_runtime.error_registry import SpeTypedError
from spe_runtime.qualification import (
    STAGE_ORDER,
    ClaimCandidate,
    ClaimScope,
    ClaimStage,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceClass,
    QualificationVerdict,
    qualify_claim,
    record_qualification_evidence,
)


def _rank(stage: ClaimStage | None) -> int:
    if stage is None:
        return -1
    return STAGE_ORDER.index(stage)

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "benchmarks" / "g8zc" / "golden_corpus.json"
CORPUS_SHA = ROOT / "benchmarks" / "g8zc" / "golden_corpus.sha256"
REPLAY = ROOT / "tools" / "g8zc_replay.py"


def _scope() -> ClaimScope:
    return ClaimScope(
        component="g8-hermetic-replay",
        platform="python",
        runtime="cpython",
        environment="local",
        revision="g8zc",
    )


def test_g8_corpus_sha_frozen():
    assert CORPUS.is_file()
    assert CORPUS_SHA.is_file()
    got = hashlib.sha256(CORPUS.read_bytes()).hexdigest()
    assert got == CORPUS_SHA.read_text(encoding="utf-8").strip()


def test_g8_replay_all_tasks_match():
    sys.path.insert(0, str(ROOT / "tools"))
    import g8zc_replay  # noqa: E402

    report = g8zc_replay.run_corpus(CORPUS)
    assert report["failed"] == 0
    assert report["passed"] == report["total"]
    assert report["total"] >= 30


def test_g8_subprocess_replay_exit_zero():
    proc = subprocess.run(
        [sys.executable, str(REPLAY), "--corpus", str(CORPUS)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr + proc.stdout
    data = json.loads(proc.stdout)
    assert data["failed"] == 0


def test_g8_tampered_golden_fails():
    sys.path.insert(0, str(ROOT / "tools"))
    import g8zc_replay  # noqa: E402

    data = json.loads(CORPUS.read_text(encoding="utf-8"))
    for t in data["tasks"]:
        if t["expect"] == "success":
            t["prompt_content_digest"] = "pad-" + ("0" * 64)
            break
    with tempfile.TemporaryDirectory() as td:
        bad = Path(td) / "bad.json"
        bad.write_text(json.dumps(data), encoding="utf-8")
        report = g8zc_replay.run_corpus(bad)
    assert report["failed"] >= 1
    assert report["exit"] == 1


def test_g8m1_self_asserted_independent_replication_rejected():
    with pytest.raises(SpeTypedError):
        record_qualification_evidence(
            evidence_kind=EvidenceKind.INDEPENDENT_REPLICATION,
            subject_id="spe-core",
            claim_key="ZERO_COST_HERMETIC_CORE_REPLAY",
            scope=_scope(),
            verdict=EvidenceVerdict.PASS,
            independence=IndependenceClass.INDEPENDENT,
            producer_class="i_say_so",
            artifact_ref="review:x",
            evidence_digest="a" * 64,
        )


def test_g8m1b_local_evidence_cannot_earn_independently_replicated():
    s = _scope()
    ev = [
        record_qualification_evidence(
            evidence_kind=kind,
            subject_id="spe-core",
            claim_key="ZERO_COST_HERMETIC_CORE_REPLAY",
            scope=s,
            verdict=EvidenceVerdict.PASS,
            independence=IndependenceClass.INTERNAL,
            producer_class="unit_test",
        )
        for kind in (
            EvidenceKind.SPECIFICATION,
            EvidenceKind.IMPLEMENTATION_BINDING,
            EvidenceKind.TEST_RESULT,
        )
    ]
    cand = ClaimCandidate(
        claim_key="ZERO_COST_HERMETIC_CORE_REPLAY",
        subject_id="spe-core",
        requested_stage=ClaimStage.INDEPENDENTLY_REPLICATED,
        scope=s,
        claim_code="ZERO_COST_HERMETIC_CORE_REPLAY",
        policy_id="default_ring0",
    )
    q = qualify_claim(cand, ev)
    assert _rank(q.earned_stage) < _rank(ClaimStage.INDEPENDENTLY_REPLICATED)


def test_g8m2_self_contained_full_replay_still_unqualifiable():
    cand = ClaimCandidate(
        claim_key="SELF_CONTAINED_FULL_REPLAY",
        subject_id="spe-core",
        requested_stage=ClaimStage.QUALIFIED,
        scope=ClaimScope(
            component="k6-spe-artifact",
            platform="python",
            runtime="cpython",
            environment="local",
            revision="g8zc",
        ),
        claim_code="SELF_CONTAINED_FULL_REPLAY",
        policy_id="default_ring0",
    )
    q = qualify_claim(cand, [])
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g8m3_world_1_still_not_proven():
    cand = ClaimCandidate(
        claim_key="WORLD_1",
        subject_id="spe",
        requested_stage=ClaimStage.INDEPENDENTLY_REPLICATED,
        scope=_scope(),
        claim_code="WORLD_1",
        policy_id="default_ring0",
    )
    q = qualify_claim(cand, [])
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g8m4_zero_cost_replay_no_network_imports():
    src = Path("tools/g8zc_replay.py").read_text(encoding="utf-8")
    assert "urlopen" not in src
    assert "requests" not in src
    assert "openai" not in src.lower()


def test_g8m5_artifact_path_not_in_identity():
    sys.path.insert(0, str(ROOT / "tools"))
    import g8zc_replay  # noqa: E402

    data = json.loads(CORPUS.read_text(encoding="utf-8"))
    task = next(t for t in data["tasks"] if t["expect"] == "success")
    with tempfile.TemporaryDirectory() as td:
        a = Path(td) / "a" / "x.spe"
        b = Path(td) / "b" / "y.spe"
        a.parent.mkdir()
        b.parent.mkdir()
        kw = g8zc_replay._kwargs(task)
        ra = compile_and_persist_spe(task["goal"], a, **kw)
        rb = compile_and_persist_spe(task["goal"], b, **kw)
        assert (
            ra.spe_artifact.artifact_id
            == rb.spe_artifact.artifact_id
            == task["spe_artifact_id"]
        )
