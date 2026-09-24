"""Python oracle vs frozen vectors vs Rust spe-core-rs (Task 11)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from spe_runtime.adapters.protocol_render import render_execution_contract
from spe_runtime.grounding import (
    ContextCapsule,
    compile_context_need,
    freshness_state,
    plan_refresh,
    sanitize_external_payload,
)
from spe_runtime.protocols import (
    DepthSignals,
    ProtocolDepth,
    compile_execution_contract,
    select_protocol_depth,
)

REPO = Path(__file__).resolve().parents[2]
VECTORS = Path(__file__).resolve().parent / "context_protocol_vectors.json"
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"


def _canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _load_vectors():
    return json.loads(VECTORS.read_text(encoding="utf-8"))


def _fixture(vectors, fid: str):
    for item in vectors["fixtures"]:
        if item["id"] == fid:
            return item
    raise KeyError(fid)


def _ensure_rust_bin() -> Path:
    if RUST_BIN.is_file():
        return RUST_BIN
    subprocess.run(
        [
            "cargo",
            "build",
            "--manifest-path",
            str(REPO / "portable" / "spe-core-rs" / "Cargo.toml"),
            "--bin",
            "spe-core-eval",
        ],
        check=True,
        cwd=str(REPO),
    )
    assert RUST_BIN.is_file(), RUST_BIN
    return RUST_BIN


def _rust(payload: dict) -> dict:
    raw = json.dumps(payload)
    proc = subprocess.run(
        [str(_ensure_rust_bin())],
        input=raw.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr.decode()
    return json.loads(proc.stdout.decode("utf-8"))


def test_frozen_vectors_file_exists_and_has_required_ids():
    data = _load_vectors()
    ids = {f["id"] for f in data["fixtures"]}
    required = {
        "no-context-writing",
        "research-critical",
        "current-coding-docs",
        "multi-domain-merge",
        "unknown-capabilities",
        "many-capabilities",
        "stale-context",
        "malicious-source-payload-rejection",
    }
    assert required <= ids


def test_python_oracle_matches_frozen_vectors():
    data = _load_vectors()
    mismatches = []

    f = _fixture(data, "no-context-writing")
    need = compile_context_need(f["input"]["request_text"]).to_dict()
    if _canon(need) != _canon(f["expected"]["need"]):
        mismatches.append("no-context-writing")

    f = _fixture(data, "research-critical")
    contract = compile_execution_contract("research", ProtocolDepth.CRITICAL)
    rendered = render_execution_contract(contract, "ANY_AI")
    if rendered != f["expected"]["rendered"]:
        mismatches.append("research-critical.rendered")
    if _canon(contract.to_dict()) != _canon(f["expected"]["contract"]):
        mismatches.append("research-critical.contract")
    assert "Contradictory Evidence" in rendered
    assert "Replication / Independent Check" in rendered

    f = _fixture(data, "current-coding-docs")
    need = compile_context_need(f["input"]["request_text"]).to_dict()
    if _canon(need) != _canon(f["expected"]["need"]):
        mismatches.append("current-coding-docs.need")

    f = _fixture(data, "stale-context")
    from spe_runtime.grounding.models import ContextType, SupportStatus

    raw = f["input"]["capsule"]
    capsule = ContextCapsule(
        capsule_id=raw["capsule_id"],
        domain_id=raw["domain_id"],
        context_type=ContextType(raw["context_type"]),
        claim_or_observation=raw["claim_or_observation"],
        value=raw["value"],
        source_id=raw["source_id"],
        source_class=raw["source_class"],
        authority_class=raw["authority_class"],
        retrieved_at=raw["retrieved_at"],
        valid_as_of=raw["valid_as_of"],
        fresh_until=raw["fresh_until"],
        license=raw["license"],
        allowed_use=raw["allowed_use"],
        confidence=raw["confidence"],
        support_status=SupportStatus(raw["support_status"]),
        contradiction_group=raw["contradiction_group"],
        provenance_digest=raw["provenance_digest"],
        taint_labels=tuple(raw["taint_labels"]),
        sensitivity_labels=tuple(raw["sensitivity_labels"]),
    )
    state = freshness_state(capsule, f["input"]["now_iso"])
    plan = plan_refresh(capsule, now_iso=f["input"]["now_iso"])
    if state != f["expected"]["freshness_state"]:
        mismatches.append("stale-context.state")
    plan_dict = {
        "action": plan.action,
        "original_capsule_id": plan.original_capsule_id,
        "new_capsule_id": plan.new_capsule_id,
        "new_lineage_id": plan.new_lineage_id,
        "reason": plan.reason,
        "freshness_state": plan.freshness_state,
    }
    if _canon(plan_dict) != _canon(f["expected"]["refresh_plan"]):
        mismatches.append("stale-context.plan")

    f = _fixture(data, "malicious-source-payload-rejection")
    with pytest.raises(ValueError, match="forbidden keys"):
        sanitize_external_payload(f["input"]["malicious"])
    clean = dict(sanitize_external_payload(f["input"]["clean"]))
    clean["taint_labels"] = list(clean["taint_labels"])
    if _canon(clean) != _canon(f["expected"]["clean"]):
        mismatches.append("malicious.clean")

    f = _fixture(data, "depth-routing-thresholds")
    depths = [
        select_protocol_depth(DepthSignals(**case["signals"])).value
        for case in f["input"]["cases"]
    ]
    if depths != f["expected"]["depths"]:
        mismatches.append("depth-routing")

    assert mismatches == [], mismatches


def test_rust_matches_frozen_vectors_zero_mismatch():
    data = _load_vectors()
    mismatches = []

    # context need
    f = _fixture(data, "no-context-writing")
    rs = _rust(
        {
            "spe_api": "grounding",
            "op": "compile_context_need",
            "request_text": f["input"]["request_text"],
        }
    )
    assert rs["status"] == "VALID"
    if _canon(rs["output"]["need"]) != _canon(f["expected"]["need"]):
        mismatches.append(("no-context-writing", rs["output"]["need"], f["expected"]["need"]))

    f = _fixture(data, "current-coding-docs")
    rs = _rust(
        {
            "spe_api": "grounding",
            "op": "compile_context_need",
            "request_text": f["input"]["request_text"],
        }
    )
    if _canon(rs["output"]["need"]) != _canon(f["expected"]["need"]):
        mismatches.append(("current-coding-docs.need",))

    for fid in (
        "research-critical",
        "current-coding-docs",
        "multi-domain-merge",
        "unknown-capabilities",
        "many-capabilities",
    ):
        f = _fixture(data, fid)
        payload = {
            "spe_api": "context_protocol",
            "op": "render_execution_contract",
            "domain_ids": f["input"]["domain_ids"],
            "depth": f["input"]["depth"],
            "capability_profile": f["input"].get("capability_profile"),
            "adapter_id": f["input"].get("adapter_id", "ANY_AI"),
        }
        rs = _rust(payload)
        assert rs["status"] == "VALID", (fid, rs)
        if rs["output"]["rendered"] != f["expected"]["rendered"]:
            mismatches.append((f"{fid}.rendered",))
        if _canon(rs["output"]["contract"]) != _canon(f["expected"]["contract"]):
            mismatches.append((f"{fid}.contract",))

    f = _fixture(data, "stale-context")
    rs = _rust(
        {
            "spe_api": "grounding",
            "op": "freshness",
            "capsule": f["input"]["capsule"],
            "now_iso": f["input"]["now_iso"],
        }
    )
    assert rs["status"] == "VALID"
    if rs["output"]["freshness_state"] != f["expected"]["freshness_state"]:
        mismatches.append(("stale.state",))
    if _canon(rs["output"]["refresh_plan"]) != _canon(f["expected"]["refresh_plan"]):
        mismatches.append(("stale.plan",))

    f = _fixture(data, "malicious-source-payload-rejection")
    rs = _rust(
        {
            "spe_api": "grounding",
            "op": "sanitize_external_payload",
            "payload": f["input"]["malicious"],
        }
    )
    assert rs["output"]["ok"] is False
    assert "forbidden keys" in rs["output"]["error"]
    rs2 = _rust(
        {
            "spe_api": "grounding",
            "op": "sanitize_external_payload",
            "payload": f["input"]["clean"],
        }
    )
    if _canon(rs2["output"]["payload"]) != _canon(f["expected"]["clean"]):
        mismatches.append(("firewall.clean",))

    f = _fixture(data, "depth-routing-thresholds")
    for case, expected in zip(f["input"]["cases"], f["expected"]["depths"]):
        rs = _rust(
            {
                "spe_api": "context_protocol",
                "op": "select_protocol_depth",
                "signals": case["signals"],
            }
        )
        if rs["output"]["depth"] != expected:
            mismatches.append(("depth", case, expected, rs["output"]))

    assert mismatches == [], mismatches
