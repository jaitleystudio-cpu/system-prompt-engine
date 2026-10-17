"""Causal Counterfactual Commit (C^4) Challenge Engine.

Verifies prerequisite sensitivity and irrelevance invariance, producing
cryptographic certificates of causal grounding before state commit.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    generate_keypair,
    rfc8785_canonicalize,
)
from .models import CounterfactualCommitCertificate, SemanticTransaction


class CausalCommitEngine:
    """Evaluates counterfactual challenge suites to certify causal grounding."""

    def __init__(
        self,
        signing_key: Optional[bytes] = None,
        public_key: Optional[bytes] = None,
        key_id: str = "spe-csi-causal:ed25519:default",
    ) -> None:
        if signing_key and public_key:
            self.signing_key = signing_key
            self.public_key = public_key
        else:
            self.signing_key, self.public_key = generate_keypair()
        self.key_id = key_id

    def evaluate_causal_grounding(
        self,
        tx: SemanticTransaction,
        candidate_decision: Any,
        prerequisites: Dict[str, Any],
        decision_evaluator: Callable[[Dict[str, Any]], Any],
    ) -> CounterfactualCommitCertificate:
        """Executes counterfactual sensitivity and invariance challenges."""
        cert_id = f"c4-{uuid.uuid4().hex[:12]}"
        tested_prereqs = list(prerequisites.keys())
        sensitivity_passed = True

        # 1. Prerequisite Sensitivity Challenges
        # Inverting a prerequisite MUST change the decision or raise an error
        for key, val in prerequisites.items():
            perturbed_env = dict(prerequisites)
            # Invert boolean or negate value
            if isinstance(val, bool):
                perturbed_env[key] = not val
            elif isinstance(val, (int, float)):
                perturbed_env[key] = -val if val != 0 else -1
            else:
                perturbed_env[key] = None

            try:
                perturbed_result = decision_evaluator(perturbed_env)
                # If perturbed result still matches candidate decision, sensitivity failed!
                if perturbed_result == candidate_decision:
                    sensitivity_passed = False
                    break
            except Exception:
                # Exception on inverted prerequisite indicates dependency is strictly enforced
                pass

        # 2. Irrelevance Invariance Challenge
        # Injecting non-semantic perturbation must NOT alter the candidate decision
        noisy_env = dict(prerequisites)
        noisy_env["_spe_irrelevant_theme"] = "dark_mode"
        noisy_env["_spe_filler_greeting"] = "salutations"
        try:
            noisy_result = decision_evaluator(noisy_env)
            invariance_passed = (noisy_result == candidate_decision)
        except Exception:
            invariance_passed = False

        is_grounded = sensitivity_passed and invariance_passed

        # Canonicalize and sign certificate
        payload_data = {
            "certificate_id": cert_id,
            "invariance_passed": invariance_passed,
            "is_grounded": is_grounded,
            "prerequisites_tested": tested_prereqs,
            "sensitivity_passed": sensitivity_passed,
            "tx_id": tx.tx_id,
        }
        canonical_bytes = rfc8785_canonicalize(payload_data)
        digest = hashlib.sha256(canonical_bytes).hexdigest()
        sig_bytes = ed25519_sign(self.signing_key, self.public_key, digest.encode("utf-8"))

        cert = CounterfactualCommitCertificate(
            certificate_id=cert_id,
            tx_id=tx.tx_id,
            prerequisites_tested=tested_prereqs,
            sensitivity_passed=sensitivity_passed,
            invariance_passed=invariance_passed,
            is_grounded=is_grounded,
            signer_key_id=self.key_id,
            payload_digest=digest,
            signature_hex=sig_bytes.hex(),
        )

        tx.c4_certificate = cert
        return cert
