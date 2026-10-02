"""Raw-egress truth.

An unmeasured host failure is not zero-egress. Raw private bytes are not
outbound-safe. Missing consent is not an allow. A fixture PASS is not a
privacy qualification.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROOF = ROOT / "proofs" / "privacy_binding_preflight_20260930" / "C10_REPORT.md"
EGRESS_PROOF = ROOT / "apps" / "web" / "scripts" / "egress-proof.mjs"
VERDICT = ROOT / "apps" / "web" / "scripts" / "egress-verdict.mjs"

FORBIDDEN_QUALIFICATIONS = (
    "PRIVACY_PASS",
    "PRIVACY_BINDING_PREFLIGHT_PASS",
    "FINAL: PASS",
)


def _classify(payload: dict) -> dict:
    script = (
        "import { classifyEgress } from "
        + json.dumps(VERDICT.as_uri())
        + "; const payload = JSON.parse(process.argv[1]); "
        + "process.stdout.write(JSON.stringify(classifyEgress(payload)));"
    )
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, json.dumps(payload)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_unmeasured_engine_failure_is_not_labeled_zero_egress(tmp_path: Path) -> None:
    """Reproduced on ac3df92: missing WASM exited 0 with zero_egress true."""

    out = tmp_path / "egress-proof.json"
    env = os.environ.copy()
    env["SPE_WASM_PATH"] = str(tmp_path / "missing.wasm")
    env["SPE_PROOF_OUT"] = str(out)
    env["SPE_FIXTURE_ID"] = "POS-001"
    proc = subprocess.run(
        ["node", str(EGRESS_PROOF)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode != 0, proc.stdout
    payload = json.loads(proc.stdout)
    assert payload["zero_egress"] is not True
    assert payload.get("outbound_safe") is not True
    assert payload.get("missing_consent_allows_egress") is not True
    assert payload.get("privacy_qualification") != "PASS"
    for forbidden in FORBIDDEN_QUALIFICATIONS:
        assert forbidden not in proc.stdout
    if out.is_file():
        written = json.loads(out.read_text(encoding="utf-8"))
        assert written["zero_egress"] is not True
        assert written.get("outbound_safe") is not True


def test_fixture_success_counts_are_not_a_privacy_pass() -> None:
    text = PROOF.read_text(encoding="utf-8")
    for forbidden in FORBIDDEN_QUALIFICATIONS:
        assert forbidden not in text
    assert "FINAL: HOLD" in text
    assert "PRIVACY_QUALIFICATION: NOT_A_PASS" in text
    assert "preflight_passed:" in text


def test_raw_private_bytes_are_not_outbound_safe() -> None:
    verdict = _classify(
        {
            "error": None,
            "used_ts_fallback": False,
            "expect": "PASS",
            "privacy": {"sensitivity": "USER_PRIVATE"},
            "raw_private_bytes": "raw private prompt bytes\nnot for egress",
            "egress": {
                "measured": True,
                "fetch_during_evaluate": 0,
                "websocket_during_evaluate": 0,
            },
        }
    )
    assert verdict["outbound_safe"] is False
    assert verdict["privacy_qualification"] == "NOT_A_PASS"


def test_missing_consent_is_not_allowed_egress() -> None:
    verdict = _classify(
        {
            "error": None,
            "used_ts_fallback": False,
            "egress": {
                "measured": True,
                "fetch_during_evaluate": 0,
                "websocket_during_evaluate": 0,
            },
        }
    )
    assert verdict["consent_present"] is False
    assert verdict["missing_consent_allows_egress"] is False
    assert verdict["outbound_safe"] is False


def test_fixture_expect_pass_is_not_a_privacy_qualification() -> None:
    verdict = _classify(
        {
            "error": None,
            "expect": "PASS",
            "used_ts_fallback": False,
            "egress": {
                "measured": True,
                "fetch_during_evaluate": 0,
                "websocket_during_evaluate": 0,
            },
        }
    )
    assert verdict["privacy_qualification"] == "NOT_A_PASS"
    assert verdict["zero_egress"] is True
    assert verdict["outbound_safe"] is False


def test_engine_error_with_fake_zero_counts_is_not_zero_egress() -> None:
    verdict = _classify(
        {
            "error": {"code": "ENGINE_UNAVAILABLE", "message": "WASM missing"},
            "used_ts_fallback": False,
            "egress": {"fetch_during_evaluate": 0, "websocket_during_evaluate": 0},
        }
    )
    assert verdict["zero_egress"] is False
    assert verdict["outbound_safe"] is False
    assert verdict["missing_consent_allows_egress"] is False
    assert verdict["privacy_qualification"] == "NOT_A_PASS"
