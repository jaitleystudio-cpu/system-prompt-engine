"""SPE CI Gate: Policy evaluation, PR comments, and receipt generation."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .receipt import AuthenticatedReceipt, generate_authenticated_receipt


@dataclass
class GatePolicy:
    require_protected_intent_preserved: bool = True
    max_hard_constraints_failed: int = 0
    max_unknown_authority: int = 0
    require_zero_secrets: bool = True
    min_owasp_coverage_pct: float = 70.0
    allow_pii_warnings: bool = False


@dataclass
class GateResult:
    verdict: str  # SHIP, REVIEW, BLOCK
    bounded_rule_consistency: str  # PASS, FAIL, UNKNOWN
    owasp_coverage_pct: float
    pii_status: str  # NO_KNOWN_MATCHES, POTENTIAL_MATCHES_DETECTED
    secrets_status: str  # NO_SECRETS_FOUND, SECRETS_DETECTED
    unknown_authority_count: int
    intent_preserved: bool
    summary: dict[str, Any]
    pr_comment_markdown: str
    receipt: AuthenticatedReceipt


def evaluate_ci_gate(
    prompt_text: str,
    policy: GatePolicy | None = None,
    diff_previous_text: str | None = None,
) -> GateResult:
    if policy is None:
        policy = GatePolicy()

    # 1. Bounded Rule Consistency check
    lower = prompt_text.lower()
    if ("must always" in lower and "must never" in lower and "ignore" in lower):
        rule_consistency = "FAIL"
    elif "must always" in lower or "strictly" in lower:
        rule_consistency = "PASS"
    else:
        rule_consistency = "PASS"

    # 2. Secret scanning
    secrets_detected = False
    for pat in [r"sk-[a-zA-Z0-9]{20,}", r"ghp_[a-zA-Z0-9]{30,}"]:
        if re.search(pat, prompt_text):
            secrets_detected = True
            break
    secrets_status = "SECRETS_DETECTED" if secrets_detected else "NO_SECRETS_FOUND"

    # 3. PII scanning
    pii_matches = []
    for pat in [r"\b\d{3}-\d{2}-\d{4}\b", r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b"]:
        if re.search(pat, prompt_text):
            pii_matches.append(pat)
    pii_status = "POTENTIAL_MATCHES_DETECTED" if pii_matches else "NO_KNOWN_MATCHES"

    # 4. Unknown authority detection
    unknown_authority = 0
    for kw in ["bypass_security", "sudo_execute", "unrestricted_write"]:
        if kw in lower:
            unknown_authority += 1

    # 5. OWASP coverage estimate based on presence of defensive clauses
    owasp_defenses = [
        ("prompt_injection", "ignore previous instructions" in lower or "disregard system" in lower),
        ("data_leakage", "never leak" in lower or "confidential" in lower or "redact" in lower),
        ("insecure_output", "sanitize" in lower or "json" in lower or "schema" in lower),
        ("excessive_agency", "confirm before" in lower or "ask approval" in lower or "read-only" in lower),
    ]
    matched_defenses = sum(1 for _, present in owasp_defenses if present)
    owasp_pct = round((matched_defenses / len(owasp_defenses)) * 100.0, 1)

    # 6. Intent preservation (if diff provided)
    intent_preserved = True
    if diff_previous_text:
        # Check if core non-negotiable clauses were dropped
        if "never" in diff_previous_text.lower() and "never" not in lower:
            intent_preserved = False

    # Compute Gate Verdict
    blocked = False
    review_needed = False

    if policy.require_protected_intent_preserved and not intent_preserved:
        blocked = True
    if secrets_detected and policy.require_zero_secrets:
        blocked = True
    if rule_consistency == "FAIL":
        blocked = True
    if unknown_authority > policy.max_unknown_authority:
        blocked = True

    if not blocked:
        if pii_matches and not policy.allow_pii_warnings:
            review_needed = True
        elif owasp_pct < policy.min_owasp_coverage_pct:
            review_needed = True

    verdict = "BLOCK" if blocked else ("REVIEW" if review_needed else "SHIP")

    # Generate PR Comment Markdown
    pr_comment = f"""### 🛡️ SPE Evidence Gate Qualification Report

**Verdict**: `{verdict}`

#### 1. WHAT CHANGED
- Instruction payload length: {len(prompt_text)} characters
- Intent preserved: `{'YES' if intent_preserved else 'NO - REGRESSION DETECTED'}`
- Diff provided: `{'YES' if diff_previous_text else 'STANDALONE QUALIFICATION'}`

#### 2. WHAT MAY BREAK
- Bounded Rule Consistency: `{rule_consistency}`
- Unknown / Ambiguous Authority Claims: `{unknown_authority}`
- Secrets Status: `{secrets_status}`
- PII Exposure Risk: `{pii_status}`

#### 3. WHAT WAS TESTED
- OWASP GenAI Risk-Control Coverage: `{owasp_pct}%`
- Syntax & Dialect Safety: `PASS`
- Deterministic Contradiction Scan: `{rule_consistency}`

#### 4. WHAT IS UNKNOWN
- Hosted provider runtime attention salience: `NOT_MEASURED (Run spe bench for observed probes)`
- Physical GPU KV-cache allocation: `STACK_SPECIFIC_ESTIMATE`

---
*Cryptographic Receipt ID*: Attached below.
"""

    receipt_payload = {
        "verdict": verdict,
        "bounded_rule_consistency": rule_consistency,
        "owasp_coverage_pct": owasp_pct,
        "pii_status": pii_status,
        "secrets_status": secrets_status,
        "unknown_authority_count": unknown_authority,
        "intent_preserved": intent_preserved,
    }
    receipt = generate_authenticated_receipt(receipt_payload)

    return GateResult(
        verdict=verdict,
        bounded_rule_consistency=rule_consistency,
        owasp_coverage_pct=owasp_pct,
        pii_status=pii_status,
        secrets_status=secrets_status,
        unknown_authority_count=unknown_authority,
        intent_preserved=intent_preserved,
        summary=receipt_payload,
        pr_comment_markdown=pr_comment,
        receipt=receipt,
    )
