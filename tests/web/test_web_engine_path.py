"""Positive + attack flows through the web WASM host (same glue as the Worker)."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from tests.web.paths import REPO, WEB


def test_eval_script_exists():
    script = WEB / "scripts" / "eval-fixture.mjs"
    assert script.is_file(), "apps/web/scripts/eval-fixture.mjs missing"


def _run_eval(fixture_id: str, extra_env: dict[str, str] | None = None) -> dict:
    script = WEB / "scripts" / "eval-fixture.mjs"
    env = os.environ.copy()
    env["SPE_FIXTURE_ID"] = fixture_id
    if extra_env:
        env.update(extra_env)
    proc = subprocess.run(
        ["node", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"eval-fixture failed rc={proc.returncode} stderr={proc.stderr[:2000]}"
        )
    return json.loads(proc.stdout)


def test_positive_flow_pos001_via_web_wasm_host():
    result = _run_eval("POS-001")
    assert result.get("error") is None
    body = result["result"]
    assert body["status"] == "VALID"
    assert body["disposition"] == "VALID"


def test_attack_flow_neg001_exact_reason_via_web_wasm_host():
    result = _run_eval("NEG-001")
    assert result.get("error") is None
    body = result["result"]
    assert body["status"] == "INVALID"
    assert body["reason_code"] == "P_PROVENANCE_REMOVED"


def test_wasm_integrity_mismatch_is_typed_not_ts_fallback():
    result = _run_eval("POS-001", extra_env={"SPE_TAMPER_SHA": "1"})
    err = result.get("error") or {}
    assert err.get("code") in {"WASM_INTEGRITY_MISMATCH", "ENGINE_UNAVAILABLE"}
    assert result.get("result") is None
    assert result.get("used_ts_fallback") is not True


def test_missing_wasm_engine_unavailable():
    result = _run_eval("POS-001", extra_env={"SPE_WASM_PATH": "/nonexistent/spe_wasm.wasm"})
    err = result.get("error") or {}
    assert err.get("code") == "ENGINE_UNAVAILABLE"
    assert result.get("used_ts_fallback") is not True


def test_compile_phases_are_real_transitions():
    result = _run_eval("POS-001")
    phases = result.get("phases") or []
    for required in (
        "loading_wasm",
        "verifying_integrity",
        "instantiating",
        "evaluating",
    ):
        assert required in phases, phases


def test_no_network_during_evaluate():
    result = _run_eval("POS-001", extra_env={"SPE_PROOF_EGRESS": "1"})
    egress = result.get("egress") or {}
    assert egress.get("fetch_during_evaluate", 0) == 0
    assert egress.get("websocket_during_evaluate", 0) == 0
