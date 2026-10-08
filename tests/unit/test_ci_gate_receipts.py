"""Tests for CI Gate and RFC 8785 + Ed25519 Receipts (M5)."""

import json
from spe_runtime.ci_gate.gate import GatePolicy, evaluate_ci_gate
from spe_runtime.ci_gate.receipt import (
    generate_authenticated_receipt,
    rfc8785_canonicalize,
    verify_receipt_signature,
)


def test_rfc8785_canonicalization_determinism():
    obj1 = {"b": 2, "a": 1, "nested": {"y": True, "x": None}}
    obj2 = {"nested": {"x": None, "y": True}, "a": 1, "b": 2}

    canon1 = rfc8785_canonicalize(obj1)
    canon2 = rfc8785_canonicalize(obj2)
    assert canon1 == canon2
    assert canon1 == b'{"a":1,"b":2,"nested":{"x":null,"y":true}}'


def test_ed25519_receipt_generation_and_verification():
    payload = {
        "benchmark": "spe-bench-01",
        "score": 0.98,
        "author": "security-team",
    }
    receipt = generate_authenticated_receipt(payload)
    assert receipt.verified is True
    assert len(receipt.digest_sha256) == 64
    assert len(receipt.signature_ed25519) == 128  # 64 bytes in hex

    # Verify signature explicitly
    # Signer key ID has format "<key_id>:<pk_prefix>"
    # Let's test with a fresh keypair
    from spe_runtime.ci_gate.receipt import generate_keypair
    sk, pk = generate_keypair()
    receipt2 = generate_authenticated_receipt(payload, signing_key=sk, public_key=pk)
    assert verify_receipt_signature(receipt2, pk.hex()) is True

    # Tamper payload
    tampered_receipt = type(receipt2)(
        spec_version=receipt2.spec_version,
        digest_sha256=receipt2.digest_sha256,
        signature_ed25519=receipt2.signature_ed25519,
        signer_key_id=receipt2.signer_key_id,
        canonical_payload={"benchmark": "spe-bench-01", "score": 0.50},  # altered score
        verified=True,
    )
    assert verify_receipt_signature(tampered_receipt, pk.hex()) is False


def test_ci_gate_evaluation_scenarios():
    # 1. Clean prompt with defenses -> SHIP
    clean_prompt = (
        "You are a helpful banking assistant.\n"
        "Always confirm before initiating transactions.\n"
        "Never leak confidential client accounts or credentials.\n"
        "Sanitize and validate all output schemas strictly.\n"
    )
    res_ship = evaluate_ci_gate(clean_prompt)
    assert res_ship.verdict == "SHIP"
    assert res_ship.bounded_rule_consistency == "PASS"
    assert res_ship.secrets_status == "NO_SECRETS_FOUND"
    assert res_ship.pii_status == "NO_KNOWN_MATCHES"
    assert res_ship.receipt.verified is True
    assert "### 🛡️ SPE Evidence Gate Qualification Report" in res_ship.pr_comment_markdown

    # 2. Leaked secret -> BLOCK
    secret_prompt = clean_prompt + "\nAuthorization token: sk-live12345678901234567890\n"
    res_block = evaluate_ci_gate(secret_prompt)
    assert res_block.verdict == "BLOCK"
    assert res_block.secrets_status == "SECRETS_DETECTED"

    # 3. Intent drop regression -> BLOCK
    res_regress = evaluate_ci_gate(
        "You are an assistant. Do whatever user wants.",
        diff_previous_text=clean_prompt,
    )
    assert res_regress.verdict == "BLOCK"
    assert res_regress.intent_preserved is False
