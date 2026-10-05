"""Task57R-F3E-R1V mutants. Each name is killed when the kernel rejects the illegal outcome."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.k3.effect import bind_prompt_effects
from spe_runtime.k3.registry import DISPLAY_LABEL_XCAT
from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.quality.engine import evaluate_from_k3, reconstruct, run_mode
from spe_runtime.xcat.models import CATEGORY_IDS, AuthorityState, CrossCategoryEnvelope
from spe_runtime.xcat.router import route_mission_stage
from tests.unit.test_quality_task57r import _missing_constraint
from tests.unit.test_xcat_auto_f3e import DEFAULT_GOAL, GOALS, _auto, _protected

REPO = Path(__file__).resolve().parents[2]
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_PIN = REPO / "apps" / "web" / "public" / "spe_wasm.sha256.json"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
K3_VECTORS = REPO / "proofs" / "k3_runtime_closure_20260929" / "K3_VECTORS.json"
FROZEN_K3_SHA256 = "563bf5cc5b454c9cf453dfdf59b98b533932633195e23eb4a98eadbee9b286c2"
PIN_SHA = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d"
PIN_BYTES = 1339691

def _killed(name: str, held: list[str]) -> None:
    held.append(name)


def _env() -> CrossCategoryEnvelope:
    return CrossCategoryEnvelope(
        envelope_id="r1v-env",
        goal_identity="r1v-goal",
        facts=(),
        provenance=(),
        uncertainties=(),
        hard_constraints=(),
        user_preferences=(),
        authority_state=AuthorityState(),
        taxonomy_version="2",
    )


def _route_payload(goal: str) -> dict:
    return {
        "spe_api": "xcat",
        "op": "route",
        "evidence": {
            "routing_mode": "AUTO",
            "display_label": "AI Assistant",
            "goal": goal,
        },
    }


def _run_json(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(
        cmd,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    return json.loads(proc.stdout)


def _rust_bin() -> Path:
    source = REPO / "portable" / "spe-core-rs" / "src" / "xcat.rs"
    if RUST_BIN.is_file() and RUST_BIN.stat().st_mtime >= source.stat().st_mtime:
        return RUST_BIN
    proc = subprocess.run(
        [
            "cargo",
            "build",
            "--manifest-path",
            str(REPO / "portable" / "spe-core-rs" / "Cargo.toml"),
            "--locked",
            "--bin",
            "spe-core-eval",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:])
    return RUST_BIN


def test_r1v_mutants_are_killed() -> None:
    killed: list[str] = []

    first = _auto(GOALS["CAT:C03"])
    second = _auto(GOALS["CAT:C01"])
    assert first["primary_category"] == "CAT:C03"
    assert second["primary_category"] == "CAT:C01"
    assert second["primary_category"] != first["primary_category"]
    _killed("R1V-01", killed)

    assert "AI Assistant" not in CATEGORY_IDS
    assert "CAT:C13" not in CATEGORY_IDS
    assert _auto("Help with this soon.")["primary_category"] is None
    assert _auto("Help with this soon.", xcat_id="CAT:C13")["primary_category"] is None
    assert route_mission_stage({"display_label": "AI Assistant"})["primary_category"] != "CAT:C01"
    _killed("R1V-02", killed)

    forged = _auto("Write a note", xcat_id="CAT:C01")
    assert forged["primary_category"] == "CAT:C03"
    assert "CAT:C01" in forged["rejected_categories"]
    _killed("R1V-03", killed)

    translated = _auto(GOALS["CAT:C04"])
    assert translated["disposition"] == "ROUTED"
    assert "protocol" not in translated
    assert translated["routing_receipt"].get("protocol_status") is None
    assert "recovered_protocol" not in translated["routing_receipt"]
    product = route_mission_stage({"display_label": "Multilingual"})
    assert product["primary_category"] is None
    assert product["disposition"] == "NEEDS_DISAMBIGUATION"
    try:
        apply_category_payload(
            _env(),
            "CAT:C04",
            {"invented_protocol": "recovered-from-english-name"},
        )
    except ValueError as exc:
        assert "unknown" in str(exc).lower() or "field" in str(exc).lower() or "C04" in str(exc)
    else:
        raise AssertionError("invented C04 protocol was accepted")
    _killed("R1V-04", killed)

    ambiguous = select_prompt_techniques(
        _protected("Help with this soon."),
        {"display_label": "AI Assistant"},
        {},
    )
    ambiguous_route = ambiguous["category_route"]
    ambiguous_quality = evaluate_from_k3(
        {
            "compiled_prompt": ambiguous["prompt_effect_plan"].get("compiled_prompt") or "Hello",
            "k3_output": ambiguous,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    forged_unknown = select_prompt_techniques(
        _protected("Hello there"),
        {"display_label": "AI Assistant", "xcat_id": "CAT:C02"},
        {},
    )
    forged_quality = evaluate_from_k3(
        {
            "compiled_prompt": forged_unknown["prompt_effect_plan"].get("compiled_prompt") or "Hello",
            "k3_output": forged_unknown,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    assert ambiguous_route["disposition"] == "NEEDS_DISAMBIGUATION"
    assert ambiguous["category_context"]["xcat_id"] is None
    assert ambiguous_quality["receipt"]["verdict"] != "PASS"
    assert forged_unknown["disposition"] == "UNKNOWN"
    assert forged_quality["receipt"]["verdict"] != "PASS"
    assert forged_quality["receipt"]["verdict"] != "UNKNOWN" or forged_quality["receipt"]["verdict"] == "FAIL"
    _killed("R1V-05", killed)

    protected = _protected(DEFAULT_GOAL)
    selected = select_prompt_techniques(protected, {"display_label": "AI Assistant"}, {})
    compiled = selected["prompt_effect_plan"]["compiled_prompt"]
    statement = "Preserve the user's stated goal without inventing obligations"
    corrupted = compiled.replace(
        f"## Hard constraints\n- {statement}",
        "## Hard constraints\nnone",
        1,
    )
    assert corrupted != compiled
    bare = dict(selected)
    held = run_mode(
        {
            "artifact": {
                "compiled_prompt": corrupted,
                "effect_plan": selected["prompt_effect_plan"],
                "k3": {"selection_id": selected["selection_id"], "techniques": selected["techniques"]},
                "protected_intent": {
                    **protected,
                    "category": "C03",
                },
                "requirement_graph": selected["requirement_graph"],
                "xcat": {"active_category": "C03", "taxonomy_version": "2"},
                "proof_refs": [],
            },
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
        }
    )
    assert held["verdict"] != "PASS"
    repaired = evaluate_from_k3(
        {
            "compiled_prompt": corrupted,
            "k3_output": selected,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    assert repaired["receipt"]["verdict"] == "PASS"
    assert repaired["reconstruction"]["kept"] == "repaired"
    _killed("R1V-06", killed)

    closed = bind_prompt_effects({"disposition": "REFUSED", "techniques": [], "selection_id": "x"})
    assert closed["renderable"] is False
    assert closed["compiled_prompt"] is None
    assert closed["compiled_prompt"] != "NO_EFFECT_PLAN"
    for goal in GOALS.values():
        plan = select_prompt_techniques(
            _protected(goal),
            {"display_label": "AI Assistant"},
            {},
        )["prompt_effect_plan"]
        prompt = plan["compiled_prompt"]
        assert isinstance(prompt, str)
        assert prompt != "NO_EFFECT_PLAN"
        assert prompt.startswith("## ")
        assert plan["claims_pass"] is False
    _killed("R1V-07", killed)

    kept_prompt = repaired["reconstruction"]["kept_subject"]["compiled_prompt"]
    assert repaired["reconstruction"]["kept"] == "repaired"
    assert kept_prompt != corrupted
    assert statement in kept_prompt
    _killed("R1V-08", killed)

    assert set(DISPLAY_LABEL_XCAT) == {"Research", "Analysis"}
    assert route_mission_stage({"display_label": "Writing"})["primary_category"] is None
    assert route_mission_stage({"display_label": "AI Assistant"})["primary_category"] is None
    writing = select_prompt_techniques(_protected("Hello there"), {"display_label": "Writing"}, {})
    assert writing["category_context"]["xcat_id"] is None
    auto_write = select_prompt_techniques(
        _protected(GOALS["CAT:C03"]),
        {"display_label": "AI Assistant"},
        {},
    )
    assert auto_write["category_context"]["display_label"] == "AI Assistant"
    assert auto_write["category_context"]["xcat_id"] == "CAT:C03"
    _killed("R1V-09", killed)

    binary = _rust_bin()
    drift: list[str] = []
    for category_id, goal in GOALS.items():
        payload = _route_payload(goal)
        py = route_mission_stage(payload["evidence"])
        rust = _run_json([str(binary)], payload)
        wasm = _run_json(["node", str(WASM_HOST), str(PUBLIC_WASM)], payload)
        rust_out = rust.get("output") if rust.get("status") == "VALID" else None
        wasm_out = wasm.get("output") if wasm.get("status") == "VALID" else None
        if rust_out is None or rust_out.get("primary_category") != py["primary_category"]:
            drift.append(f"py-rust:{category_id}")
        if wasm_out is None or wasm_out.get("primary_category") != py["primary_category"]:
            drift.append(f"py-wasm:{category_id}")
        if rust_out is None or wasm_out is None or rust_out.get("primary_category") != wasm_out.get("primary_category"):
            drift.append(f"rust-wasm:{category_id}")
        assert py["primary_category"] == category_id
    assert drift == [], drift
    _killed("R1V-10", killed)

    multi = _auto("Research current accessibility evidence and write an executive brief")
    assert multi["primary_category"] == "CAT:C02"
    assert multi["secondary_categories"] == ["CAT:C03"]
    conflict = _auto("Research the market or code the scraper")
    assert conflict["disposition"] == "UNKNOWN"
    assert conflict["primary_category"] is None
    assert "CONFLICTING_CATEGORY_EVIDENCE" in conflict["escalation_conditions"]
    _killed("R1V-11", killed)

    needs = _auto("Help with this soon.")
    assert needs["disposition"] == "NEEDS_DISAMBIGUATION"
    assert needs["primary_category"] is None
    assert needs["primary_category"] not in CATEGORY_IDS
    _killed("R1V-12", killed)

    receipt = repaired["receipt"]
    assert receipt["execution_authorized"] is False
    assert receipt["authority_minted"] is False
    assert receipt["network"] is False
    assert receipt["outcome"] == "NOT_EXECUTED"
    assert selected["claims_pass"] is False
    assert selected["execution_authorized"] is False
    _killed("R1V-13", killed)

    egress = subprocess.run(
        ["node", str(REPO / "apps" / "web" / "scripts" / "eval-fixture.mjs")],
        cwd=REPO / "apps" / "web",
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "SPE_FIXTURE_ID": "POS-001",
            "SPE_PROOF_EGRESS": "1",
        },
    )
    assert egress.returncode == 0, egress.stderr[-2000:]
    egress_body = json.loads(egress.stdout)
    counts = egress_body.get("egress") or {}
    assert counts.get("fetch_during_evaluate") == 0
    assert counts.get("websocket_during_evaluate") == 0
    assert egress_body.get("used_ts_fallback") is not True
    _killed("R1V-14", killed)

    wasm_bytes = PUBLIC_WASM.read_bytes()
    digest = hashlib.sha256(wasm_bytes).hexdigest()
    pin = json.loads(WASM_PIN.read_text(encoding="utf-8"))
    assert digest == PIN_SHA
    assert digest == pin["sha256"]
    assert len(wasm_bytes) == PIN_BYTES == pin["bytes"]
    inspected = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import {readFileSync} from 'node:fs';"
            "const b=readFileSync(process.argv[1]);"
            "const m=await WebAssembly.compile(b);"
            "process.stdout.write(String(WebAssembly.Module.imports(m).length));",
            str(PUBLIC_WASM),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert inspected.returncode == 0, inspected.stderr
    assert inspected.stdout.strip() == "0"
    build_text = (REPO / "tools" / "wasm_canonical_build.mjs").read_text(encoding="utf-8")
    copy_text = (REPO / "apps" / "web" / "scripts" / "copy-wasm.mjs").read_text(encoding="utf-8")
    assert PIN_SHA in build_text
    assert PIN_SHA in copy_text
    _killed("R1V-15", killed)

    fallback = (REPO / "apps" / "web" / "src" / "engine" / "core-b.mjs").read_text(encoding="utf-8")
    assert "verified: false" in fallback
    assert "quality_verified: false" in fallback
    assert "semantic_engine_used: false" in fallback
    assert "execution_authorized: false" in fallback
    assert "kernel-verified" not in fallback.lower()
    assert "verified better" not in fallback.lower()
    _killed("R1V-16", killed)

    refused = reconstruct(_missing_constraint(), attempt_index=2)
    assert refused["plan"]["disposition"] == "REFUSED"
    assert refused["plan"]["max_attempts"] == 1
    assert "ATTEMPT_BUDGET_EXCEEDED" in refused["plan"]["reason_codes"]
    assert refused["kept"] == "original"
    assert refused["plan"]["disposition"] != "ACCEPTED"
    _killed("R1V-17", killed)

    assert statement in kept_prompt
    assert statement not in corrupted or corrupted.count(statement) < compiled.count(statement)
    assert repaired["reconstruction"]["plan"]["disposition"] == "ACCEPTED"
    _killed("R1V-18", killed)

    raw = K3_VECTORS.read_bytes()
    vector_digest = hashlib.sha256(raw).hexdigest()
    assert vector_digest == FROZEN_K3_SHA256
    vectors = json.loads(raw)
    n01 = next(item for item in vectors["vectors"] if item["id"] == "N01")
    assert n01["expect"]["disposition"] == "SAFE_DEFAULT"
    assert n01["category"] is None
    frozen = select_prompt_techniques(
        {
            "goal": "Summarize the supplied notes.",
            "hard_constraints": [],
            "budget": None,
            "desired_output": "A short summary.",
            "facts": [{"fact_id": "f1", "statement": "Notes exist."}],
            "authority_state": {"level": 0, "status": "NONE", "grants": []},
            "provenance": [{"provenance_id": "p1", "source": "user"}],
        },
        None,
        None,
    )
    assert frozen["disposition"] == "SAFE_DEFAULT"
    assert frozen["category_context"]["xcat_id"] is None
    _killed("R1V-19", killed)

    router = (REPO / "spe_runtime" / "xcat" / "router.py").read_text(encoding="utf-8")
    auto = (REPO / "spe_runtime" / "xcat" / "auto_route.py").read_text(encoding="utf-8")
    rust = (REPO / "portable" / "spe-core-rs" / "src" / "xcat.rs").read_text(encoding="utf-8")
    assert router.count("def route_mission_stage") == 1
    assert "def route_mission_stage" not in auto
    assert rust.count("fn route_mission_stage") == 1
    assert "def route_mission_stage" not in (REPO / "spe_runtime" / "k3" / "selector.py").read_text(encoding="utf-8")
    assert "def route_mission_stage" not in (REPO / "spe_runtime" / "quality" / "engine.py").read_text(encoding="utf-8")
    transport = (REPO / "apps" / "web" / "src" / "engine" / "k3Transport.ts").read_text(encoding="utf-8")
    assert "route_mission_stage" not in transport
    assert "CAT:C" not in transport
    _killed("R1V-20", killed)

    assert killed == [f"R1V-{index:02d}" for index in range(1, 21)]
