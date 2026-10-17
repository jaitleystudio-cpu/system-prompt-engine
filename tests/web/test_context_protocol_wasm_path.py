"""Task 12: context protocol through WASM — fail-closed, no TS synthesis."""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

from tests.web.paths import REPO, WEB

ENGINE = WEB / "src" / "engine"


def _engine_sources() -> str:
    parts: list[str] = []
    for p in ENGINE.rglob("*"):
        if p.suffix in {".ts", ".tsx", ".js", ".mjs"} and p.is_file():
            parts.append(p.read_text(encoding="utf-8"))
    return "\n".join(parts)


def _run_node_eval(json_payload: dict, extra_env: dict[str, str] | None = None) -> dict:
    """Evaluate arbitrary JSON via the same wasm-host glue as the Worker."""
    script = WEB / "scripts" / "eval-context-protocol.mjs"
    assert script.is_file(), "apps/web/scripts/eval-context-protocol.mjs missing"
    env = os.environ.copy()
    env["SPE_CONTEXT_PROTOCOL_JSON"] = json.dumps(json_payload)
    if extra_env:
        env.update(extra_env)
    proc = subprocess.run(
        ["node", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"eval-context-protocol failed rc={proc.returncode} stderr={proc.stderr[:2000]}"
        )
    return json.loads(proc.stdout)


def test_types_declare_context_protocol_transport_fields():
    types = (ENGINE / "types.ts").read_text(encoding="utf-8")
    host_d = (ENGINE / "wasm-host.d.ts").read_text(encoding="utf-8")
    blob = types + "\n" + host_d
    for token in (
        "SourceMode",
        "RequestedDepth",
        '"AUTO"',
        '"ON"',
        '"OFF"',
        '"FAST"',
        '"SMART"',
        '"DEEP"',
        "context_summary",
        "execution_contract",
        "quality_record",
        "capability_profile_mode",
        "source_mode",
        "requested_depth",
    ):
        assert token in blob, f"missing transport field/type: {token}"


def test_engine_does_not_synthesize_protocol_in_typescript():
    """TS must only transport/render; no local ProtocolDepth / depth routing."""
    body = _engine_sources()
    forbidden = [
        r"function\s+select_protocol_depth",
        r"function\s+compile_execution_contract",
        r"function\s+compile_context_need",
        r"ProtocolDepth\s*=",
        r"FAST\s*[=:]?\s*['\"]QUICK['\"]",
        r"SMART\s*[=:]?\s*['\"]STANDARD['\"]",
        # Affirmative synthesis only — comments saying "never synthesize" are OK.
        r"function\s+synthesize\w*protocol",
        r"const\s+localProtocol\s*=",
        r"used_ts_fallback:\s*true",
    ]
    for pat in forbidden:
        assert re.search(pat, body, re.I) is None, f"TS must not implement: {pat}"
    # Fail-closed markers must remain.
    assert "used_ts_fallback: false" in body or "used_ts_fallback:false" in body.replace(" ", "")
    assert "ENGINE_UNAVAILABLE" in body
    assert "No TypeScript fallback" in body or "no TypeScript fallback" in body.lower()


def test_wasm_unavailable_fails_closed_no_protocol_result():
    payload = {
        "spe_api": "context_protocol",
        "op": "compile",
        "request_text": "research the latest evidence on topic X",
        "source_mode": "AUTO",
        "requested_depth": "DEEP",
    }
    result = _run_node_eval(payload, extra_env={"SPE_WASM_PATH": "/nonexistent/spe_wasm.wasm"})
    err = result.get("error") or {}
    assert err.get("code") == "ENGINE_UNAVAILABLE"
    assert result.get("result") is None
    assert result.get("used_ts_fallback") is not True
    # Must not invent a protocol when WASM is gone.
    assert "execution_contract" not in json.dumps(result.get("result") or {})


def test_context_protocol_compile_via_wasm_returns_required_fields():
    payload = {
        "spe_api": "context_protocol",
        "op": "compile",
        "request_text": "research the latest evidence on topic X",
        "source_mode": "AUTO",
        "requested_depth": "DEEP",
        "adapter_id": "ANY_AI",
    }
    result = _run_node_eval(payload)
    assert result.get("error") is None, result
    assert result.get("used_ts_fallback") is not True
    body = result["result"]
    assert body["status"] == "VALID"
    out = body["output"]
    assert out["source_mode"] == "AUTO"
    assert out["requested_depth"] == "DEEP"
    assert "context_summary" in out
    assert "execution_contract" in out
    assert "quality_record" in out
    assert out["capability_profile_mode"] in {"CONDITIONAL", "DECLARED", "NONE"}
    assert out["execution_contract"]["depth"] in {"QUICK", "STANDARD", "DEEP", "CRITICAL"}
    # Public DEEP maps to internal DEEP (not synthesized in TS).
    assert out["resolved_depth"] == "DEEP"
    assert "receipt" not in json.dumps(out["quality_record"])


def test_client_exposes_context_protocol_transport():
    client = (ENGINE / "client.ts").read_text(encoding="utf-8")
    assert "compileContextProtocol" in client
    worker = (ENGINE / "engine.worker.ts").read_text(encoding="utf-8")
    assert "context_protocol" in worker or "compileContextProtocol" in worker or "jsonText" in worker
