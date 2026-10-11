"""
SPE Ω — Learning Transfer & Revocation Protocol (LVT-0 / LVT-2 R5).
Evaluates cross-model generalization with authenticated model-specific receipts,
synthesizes portable .spe learning artifacts, and enforces continuous monitoring
with cryptographic revocation upon drift or counterexample.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
import hashlib
import json
import math
import time
from typing import Any, Callable, Dict, List, Optional, Sequence

from spe_runtime.ci_gate.receipt import ed25519_verify, rfc8785_canonicalize
from spe_runtime.research.lvt.paired_gate_v2 import (
    VERSION,
    Observation,
    StudyProtocol,
    _DIGEST,
    _finite_score,
    _is_synthetic_model_digest,
    _valid_alpha,
    _valid_positive_int,
    exact_sign_p,
)
from spe_runtime.research.lvt.types import (
    LearningValidityTransaction,
    OracleAttestation,
    QualificationStatus,
    RevocationReason,
    TransactionRevokedError,
)


class LearningTransferProtocol:
    """Manages cross-model portability, .spe contract bundle synthesis, and transaction revocation."""

    @staticmethod
    def assert_not_revoked(tx: LearningValidityTransaction) -> None:
        """Verifies that a transaction is active and has not been revoked."""
        if tx.status == QualificationStatus.REVOKED or tx.revocation_reason is not None:
            raise TransactionRevokedError(
                f"LVT Invariant: Transaction '{tx.tx_id}' was revoked. Reason: {tx.revocation_reason}"
            )

    @staticmethod
    def verify_transaction_signature(
        tx: LearningValidityTransaction,
        validator: Optional[Any] = None,
    ) -> bool:
        """Delegates transaction signature and tombstone verification to the authoritative LearningValidator."""
        if validator is None:
            return False
        return bool(validator.verify_transaction_signature(tx))

    @staticmethod
    def evaluate_cross_model_transfer(
        tx: LearningValidityTransaction,
        target_model_id: str,
        evaluator_fn: Callable[[str, Dict[str, Any]], float],
        test_dataset: Sequence[Dict[str, Any]],
        base_prompt: str,
        refined_prompt: str,
        regression_tolerance: float = 0.05,
        validator: Optional[Any] = None,
        *,
        transfer_protocol: Optional[StudyProtocol] = None,
        target_model_digest: Optional[str] = None,
        model_digest_type: Optional[str] = None,
        evaluator_id: Optional[str] = None,
        oracle_attestation: Optional[OracleAttestation] = None,
        oracle_signing_key: Optional[bytes] = None,
        family_provenance: Optional[Dict[str, Any]] = None,
        independence_assertions: Optional[Dict[str, Any]] = None,
        require_family_provenance: bool = False,
    ) -> Dict[str, Any]:
        """
        Tests whether an admitted learning refinement generalizes to a distinct foundation model
        under a frozen multi-family protocol and produces an authenticated model-transfer receipt.
        """
        LearningTransferProtocol.assert_not_revoked(tx)

        if tx.status not in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED):
            raise ValueError(f"Cannot evaluate cross-model transfer for unqualified transaction (status={tx.status})")

        if (
            not tx.canonical_receipt_signature
            or not tx.artifact_hash
            or tx.lvt2_study_result is None
            or (tx.status == QualificationStatus.QUALIFIED and (not tx.is_attested_oracle or tx.oracle_attestation is None))
        ):
            raise ValueError("Cannot evaluate cross-model transfer without verified receipt and trusted qualification evidence")

        from spe_runtime.research.lvt.learning_validator import (
            LearningValidator,
            create_oracle_attestation,
        )

        # PRIORITY 1: Owner-authorized LearningValidator is mandatory
        if validator is None or not isinstance(validator, LearningValidator):
            raise ValueError("Missing owner-authorized LearningValidator: cross-model transfer requires a trusted validator instance")

        if not getattr(validator, "is_owner_authorized", True):
            raise ValueError("Unauthorized LearningValidator: cross-model transfer requires an owner-authorized validator")

        if validator.is_tombstoned(
            receipt_hash=tx.artifact_hash,
        ):
            raise ValueError(
                f"Cannot evaluate cross-model transfer: parent transaction '{tx.tx_id}' has been revoked (persistent tombstone enforced)"
            )

        if not validator._trusted_oracles and not validator._trusted_oracle_keys:
            raise ValueError("Untrusted LearningValidator: no trusted oracle registry configured for cross-model transfer")

        if not tx.protocol or not getattr(tx.protocol, "protocol_id", None):
            raise ValueError("Missing experiment protocol on transaction blocks cross-model transfer")

        if "committed_protocol_id" in tx.metadata and tx.protocol.protocol_id != tx.metadata["committed_protocol_id"]:
            raise ValueError("Replay against a changed protocol blocks cross-model transfer")

        if "committed_evidence_hash" in tx.metadata and tx.lvt2_study_result.evidence_hash != tx.metadata["committed_evidence_hash"]:
            raise ValueError("Changed parent study evidence hash blocks cross-model transfer")

        if not validator.verify_transaction_signature(tx):
            raise ValueError("Invalid receipt signature blocks cross-model transfer evaluation")

        if tx.status == QualificationStatus.QUALIFIED:
            parent_ok, parent_msg = validator.verify_oracle_attestation(
                tx.oracle_attestation,
                tx.lvt2_study_result.evidence_hash,
                expected_oracle_id=tx.evaluator_id,
            )
            if not parent_ok:
                raise ValueError(f"Parent transaction oracle attestation failed verification: {parent_msg}")

        # PRIORITY 2 & 3: Model identity and frozen benchmark protocol validation
        if not isinstance(target_model_id, str) or not target_model_id.strip():
            raise ValueError("target_model_id must be a non-empty string")

        effective_evaluator_id = evaluator_id if evaluator_id is not None else tx.evaluator_id
        if not isinstance(effective_evaluator_id, str) or not effective_evaluator_id.strip():
            raise ValueError("evaluator_id must be a non-empty string")
        if effective_evaluator_id == target_model_id or effective_evaluator_id == tx.claim.generator_id:
            raise ValueError("Evaluator self-certification is forbidden in cross-model transfer")

        if transfer_protocol is not None:
            if not isinstance(transfer_protocol, StudyProtocol):
                raise ValueError("transfer_protocol must be a StudyProtocol instance")
            if transfer_protocol.generator_id != target_model_id:
                raise ValueError(
                    f"Mismatched model identity: transfer_protocol.generator_id '{transfer_protocol.generator_id}' != target_model_id '{target_model_id}'"
                )
            if transfer_protocol.evaluator_id != effective_evaluator_id:
                raise ValueError(
                    f"Mismatched evaluator identity: transfer_protocol.evaluator_id '{transfer_protocol.evaluator_id}' != '{effective_evaluator_id}'"
                )
            if target_model_digest is not None and transfer_protocol.model_digest != target_model_digest:
                raise ValueError("Mismatched target_model_digest against transfer_protocol.model_digest")
            effective_model_digest = transfer_protocol.model_digest
            proto = transfer_protocol
            if _is_synthetic_model_digest(target_model_id, effective_model_digest):
                if model_digest_type == "VERIFIED_MODEL_REVISION":
                    raise ValueError(
                        f"Synthetic model identifier digest '{effective_model_digest}' cannot be classified as VERIFIED_MODEL_REVISION: "
                        "digest derives from synthetic model name hash and lacks verified model revision provenance."
                    )
                effective_model_digest_type = "SYNTHETIC_MODEL_IDENTIFIER"
            else:
                effective_model_digest_type = model_digest_type or getattr(transfer_protocol, "model_digest_type", "VERIFIED_MODEL_REVISION")
        else:
            synthetic_hash = hashlib.sha256(f"spe-model-v1:{target_model_id}".encode("utf-8")).hexdigest()
            if target_model_digest is not None:
                effective_model_digest = target_model_digest
                if _is_synthetic_model_digest(target_model_id, target_model_digest):
                    if model_digest_type == "VERIFIED_MODEL_REVISION":
                        raise ValueError(
                            f"Synthetic model identifier digest '{target_model_digest}' cannot be classified as VERIFIED_MODEL_REVISION: "
                            "digest derives from synthetic model name hash and lacks verified model revision provenance."
                        )
                    effective_model_digest_type = "SYNTHETIC_MODEL_IDENTIFIER"
                else:
                    effective_model_digest_type = model_digest_type or "VERIFIED_MODEL_REVISION"
            else:
                if model_digest_type == "VERIFIED_MODEL_REVISION":
                    raise ValueError(
                        "Synthetic model identifier cannot be classified as VERIFIED_MODEL_REVISION: "
                        "no verified target_model_digest provided; derived digest is synthetic."
                    )
                effective_model_digest = synthetic_hash
                effective_model_digest_type = "SYNTHETIC_MODEL_IDENTIFIER"

            oracle_digest = hashlib.sha256(f"spe-oracle-v1:{effective_evaluator_id}".encode("utf-8")).hexdigest()
            proto = StudyProtocol(
                study_id=f"XFER-{tx.tx_id}-{target_model_id}",
                evaluator_id=effective_evaluator_id,
                generator_id=target_model_id,
                evaluator_kind="independent_static_oracle",
                oracle_digest=oracle_digest,
                model_digest=effective_model_digest,
                alpha=0.05,
                primary_effect_floor=0.05,
                min_heldout_families=20,
                family_level_significance=True,
                multiplicity=1,
                model_digest_type=effective_model_digest_type,
            )

        if not isinstance(effective_model_digest, str) or not _DIGEST.fullmatch(effective_model_digest):
            raise ValueError("Invalid target_model_digest: must be a 64-character lowercase hex SHA-256 digest")
        if not isinstance(proto.oracle_digest, str) or not _DIGEST.fullmatch(proto.oracle_digest):
            raise ValueError("Invalid oracle_digest in transfer_protocol")
        if proto.evaluator_kind != "independent_static_oracle":
            raise ValueError("transfer_protocol.evaluator_kind must be 'independent_static_oracle'")
        if not _valid_alpha(proto.alpha) or not _finite_score(proto.primary_effect_floor):
            raise ValueError("Invalid alpha or primary_effect_floor in transfer_protocol")
        if not _valid_positive_int(proto.min_heldout_families) or proto.min_heldout_families < 20:
            raise ValueError("transfer_protocol.min_heldout_families must be >= 20")
        if not _valid_positive_int(proto.multiplicity) or proto.family_level_significance is not True:
            raise ValueError("transfer_protocol requires family_level_significance=True and positive multiplicity")

        # PRIORITY 2 & 3: Dataset & family-level provenance validation
        if not test_dataset:
            raise ValueError("test_dataset cannot be empty")
        if len(test_dataset) < 2:
            raise ValueError(
                "One-item mock qualification is forbidden: cross-model transfer requires a multi-family held-out dataset (>= 20 families)"
            )

        seen_ids = set()
        seen_digests = set()
        observations: List[Observation] = []
        for idx, raw_item in enumerate(test_dataset):
            if isinstance(raw_item, Observation):
                iid = raw_item.item_id
                fid = raw_item.family_id
                csha = raw_item.content_sha256
                eval_input: Dict[str, Any] = {
                    "item_id": iid,
                    "family_id": fid,
                    "content_sha256": csha,
                }
            elif isinstance(raw_item, dict):
                iid = raw_item.get("item_id")
                fid = raw_item.get("family_id")
                csha = raw_item.get("content_sha256")
                eval_input = raw_item
            else:
                raise ValueError(f"Invalid test_dataset item at index {idx}: expected dict or Observation")

            if not isinstance(iid, str) or not iid.strip():
                raise ValueError(f"Missing family-level provenance: test_dataset[{idx}] missing valid 'item_id'")
            if not isinstance(fid, str) or not fid.strip():
                raise ValueError(f"Missing family-level provenance: test_dataset[{idx}] missing valid 'family_id'")
            if not isinstance(csha, str) or not _DIGEST.fullmatch(csha):
                raise ValueError(
                    f"Missing family-level provenance: test_dataset[{idx}] missing valid 64-char hex 'content_sha256'"
                )
            if iid in seen_ids:
                raise ValueError(f"Duplicate item_id '{iid}' in cross-model transfer test_dataset")
            if csha in seen_digests:
                raise ValueError(f"Duplicate content_sha256 '{csha}' in cross-model transfer test_dataset")
            seen_ids.add(iid)
            seen_digests.add(csha)

            b_score = float(evaluator_fn(base_prompt, eval_input))
            c_score = float(evaluator_fn(refined_prompt, eval_input))
            if not _finite_score(b_score) or not _finite_score(c_score):
                raise ValueError(f"Invalid non-finite or out-of-range score at item '{iid}'")

            observations.append(
                Observation(
                    item_id=iid,
                    family_id=fid,
                    content_sha256=csha,
                    base_score=b_score,
                    candidate_score=c_score,
                )
            )

        sorted_obs = sorted(observations, key=lambda r: r.item_id)
        grouped: dict[str, list[float]] = defaultdict(list)
        for obs in sorted_obs:
            grouped[obs.family_id].append(obs.candidate_score - obs.base_score)

        families = sorted(grouped.keys())
        min_required_families = max(20, proto.min_heldout_families)
        if len(families) < min_required_families:
            raise ValueError(
                f"Insufficient independent held-out families for cross-model transfer: got {len(families)}, require >= {min_required_families}"
            )

        # Finding D: Task family independence and dataset custody assertions
        if family_provenance is not None:
            if not isinstance(family_provenance, dict):
                raise ValueError("family_provenance must be a dictionary")
            clusters = set()
            for fid in families:
                if fid not in family_provenance:
                    raise ValueError(f"Missing family provenance for family '{fid}': all held-out families must have documented provenance")
                entry = family_provenance[fid]
                if isinstance(entry, dict):
                    cluster_id = entry.get("source_cluster") or entry.get("source_family") or entry.get("cluster_id") or fid
                elif isinstance(entry, str):
                    cluster_id = entry
                else:
                    cluster_id = str(entry)
                clusters.add(cluster_id)
            if len(clusters) < min_required_families:
                raise ValueError(
                    f"Family clustering lacks auditable distinction: got {len(clusters)} distinct clusters across {len(families)} nominal family IDs (require >= {min_required_families})"
                )
        else:
            item_clusters = set()
            inferred_prov = {}
            has_item_clusters = False
            for raw_item in test_dataset:
                if isinstance(raw_item, dict):
                    fid = raw_item.get("family_id")
                    c = raw_item.get("source_cluster") or raw_item.get("source_family") or raw_item.get("cluster_id")
                    if c:
                        has_item_clusters = True
                        item_clusters.add(str(c))
                        if fid:
                            inferred_prov[str(fid)] = {"source_cluster": str(c), "task_type": "heldout_family"}
            if has_item_clusters:
                if len(item_clusters) < min_required_families:
                    raise ValueError(
                        f"Family clustering lacks auditable distinction: dataset items map to only {len(item_clusters)} distinct clusters (require >= {min_required_families})"
                    )
                family_provenance = inferred_prov
            elif require_family_provenance:
                raise ValueError("Missing required family provenance: external qualification requires documented family custody and independence")
            else:
                family_provenance = {
                    fid: {"source_cluster": fid, "task_type": "heldout_family"}
                    for fid in families
                }

        if independence_assertions is None:
            if require_family_provenance:
                raise ValueError("Missing required independence assertions: production qualification requires documented contamination controls and demonstrated family independence")
            independence_assertions = {
                "contamination_controlled": True,
                "independent_task_families": True,
                "min_independent_clusters": len(families),
            }
        else:
            if not isinstance(independence_assertions, dict):
                raise ValueError("independence_assertions must be a dictionary")
            if not independence_assertions:
                raise ValueError("Task family independence assertions rejected: empty assertions dictionary provided")
            if independence_assertions.get("contamination_controlled") is not True:
                raise ValueError("Task family independence assertions rejected: contamination controls not asserted as True")
            if independence_assertions.get("independent_task_families") is not True:
                raise ValueError("Task family independence assertions rejected: task families independence not asserted as True")
            if "min_independent_clusters" in independence_assertions and independence_assertions["min_independent_clusters"] < min_required_families:
                raise ValueError("Task family independence assertions rejected: min_independent_clusters < required minimum")

        family_deltas = [math.fsum(v) / len(v) for _, v in sorted(grouped.items())]
        macro_delta = math.fsum(family_deltas) / len(family_deltas)
        avg_base = math.fsum([r.base_score for r in sorted_obs]) / len(sorted_obs)
        avg_refined = math.fsum([r.candidate_score for r in sorted_obs]) / len(sorted_obs)
        holdout_delta = avg_refined - avg_base

        positives = sum(d > 1e-12 for d in family_deltas)
        negatives = sum(d < -1e-12 for d in family_deltas)
        ties = len(family_deltas) - positives - negatives
        p_value = exact_sign_p(positives, negatives)
        alpha_adjusted = proto.alpha / proto.multiplicity

        transfers_successfully = (
            macro_delta >= proto.primary_effect_floor
            and macro_delta >= -regression_tolerance
            and p_value <= alpha_adjusted
            and len(families) >= min_required_families
        )
        statistical_status = (
            "TRANSFER_SUPPORTED"
            if transfers_successfully
            else ("REJECTED" if macro_delta < -regression_tolerance else "INCONCLUSIVE")
        )

        proto_dict = asdict(proto)
        protocol_digest = hashlib.sha256(rfc8785_canonicalize(proto_dict)).hexdigest()
        item_manifest = [
            {
                "item_id": r.item_id,
                "family_id": r.family_id,
                "content_sha256": r.content_sha256,
            }
            for r in sorted_obs
        ]
        dataset_digest = hashlib.sha256(rfc8785_canonicalize(item_manifest)).hexdigest()
        paired_observations = [
            {
                "item_id": r.item_id,
                "family_id": r.family_id,
                "content_sha256": r.content_sha256,
                "base_score": r.base_score,
                "candidate_score": r.candidate_score,
            }
            for r in sorted_obs
        ]
        observations_digest = hashlib.sha256(rfc8785_canonicalize(paired_observations)).hexdigest()

        evidence_payload = {
            "version": VERSION,
            "tx_id": tx.tx_id,
            "parent_artifact_hash": tx.artifact_hash,
            "target_model_id": target_model_id,
            "target_model_digest": effective_model_digest,
            "protocol": proto_dict,
            "protocol_digest": protocol_digest,
            "dataset_digest": dataset_digest,
            "family_manifest": families,
            "observations": paired_observations,
        }
        evidence_hash = hashlib.sha256(rfc8785_canonicalize(evidence_payload)).hexdigest()

        # Verify evaluator identity & oracle attestation against validator's trusted registry
        if oracle_attestation is not None:
            att = oracle_attestation
        elif oracle_signing_key is not None:
            if validator._trusted_oracles and effective_evaluator_id in validator._trusted_oracles:
                enrolled_pk_hex = validator._trusted_oracles[effective_evaluator_id]
            else:
                raise ValueError(
                    f"Untrusted oracle identity '{effective_evaluator_id}': not enrolled in validator trusted_oracles"
                )
            if not isinstance(oracle_signing_key, (bytes, bytearray)) or len(oracle_signing_key) != 32:
                raise ValueError("Invalid oracle_signing_key: must be 32-byte Ed25519 private key")
            att = create_oracle_attestation(
                signing_key=bytes(oracle_signing_key),
                public_key=bytes.fromhex(enrolled_pk_hex),
                oracle_id=effective_evaluator_id,
                evidence_hash=evidence_hash,
            )
        else:
            raise ValueError(
                "Missing oracle_attestation or approved oracle_signing_key for cross-model transfer evidence"
            )

        oracle_ok, oracle_msg = validator.verify_oracle_attestation(
            att,
            evidence_hash,
            expected_oracle_id=effective_evaluator_id,
        )
        if not oracle_ok:
            raise ValueError(f"Untrusted or invalid transfer oracle attestation: {oracle_msg}")

        statistical_verdict = {
            "status": statistical_status,
            "statistical_method": "ONE_SIDED_EXACT_FAMILY_SIGN_TEST",
            "family_macro_delta": round(macro_delta, 6),
            "holdout_candidate_minus_base": round(holdout_delta, 6),
            "primary_effect_floor": proto.primary_effect_floor,
            "regression_tolerance": regression_tolerance,
            "exact_sign_p_value": p_value,
            "adjusted_alpha": alpha_adjusted,
            "n_items": len(sorted_obs),
            "n_families": len(families),
            "wins": positives,
            "losses": negatives,
            "ties": ties,
            "transfers_successfully": transfers_successfully,
        }

        report: Dict[str, Any] = {
            "tx_id": tx.tx_id,
            "parent_artifact_hash": tx.artifact_hash,
            "parent_protocol_id": tx.protocol.protocol_id,
            "parent_evidence_hash": tx.lvt2_study_result.evidence_hash,
            "source_generator": tx.claim.generator_id,
            "target_model_id": target_model_id,
            "target_model_digest": effective_model_digest,
            "model_digest_type": effective_model_digest_type,
            "target_model_digest_type": effective_model_digest_type,
            "transfer_protocol": proto_dict,
            "protocol_digest": protocol_digest,
            "dataset_digest": dataset_digest,
            "family_manifest": families,
            "item_manifest": item_manifest,
            "paired_observations": paired_observations,
            "observations_digest": observations_digest,
            "evaluator_id": effective_evaluator_id,
            "oracle_public_key": att.oracle_public_key,
            "oracle_attestation": asdict(att),
            "evidence_hash": evidence_hash,
            "statistical_verdict": statistical_verdict,
            "base_score": round(avg_base, 4),
            "refined_score": round(avg_refined, 4),
            "transfer_delta": round(macro_delta, 4),
            "transfers_successfully": transfers_successfully,
            "sample_count": len(sorted_obs),
            "revoked": False,
        }
        if family_provenance is not None:
            report["family_provenance"] = family_provenance
        if independence_assertions is not None:
            report["independence_assertions"] = independence_assertions

        receipt_hash, receipt_sig = validator.sign_model_transfer_receipt(tx, report)
        report["transfer_receipt_hash"] = receipt_hash
        report["transfer_receipt_signature"] = receipt_sig
        report["validator_public_key"] = validator._pk.hex()

        if "cross_model_transfers" not in tx.metadata or not isinstance(tx.metadata["cross_model_transfers"], dict):
            tx.metadata["cross_model_transfers"] = {}
        tx.metadata["cross_model_transfers"][target_model_id] = report

        return report

    evaluate_transfer = evaluate_cross_model_transfer

    @staticmethod
    def revoke_model_transfer(
        tx: LearningValidityTransaction,
        target_model_id: str,
        reason: RevocationReason,
        details: str,
        validator: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Revokes a specific cross-model transfer qualification without revoking the base model study."""
        transfers = tx.metadata.get("cross_model_transfers", {})
        if not isinstance(transfers, dict) or target_model_id not in transfers:
            raise ValueError(f"No cross-model transfer record found for '{target_model_id}'")
        report = transfers[target_model_id]
        if not isinstance(report, dict):
            raise ValueError(f"Malformed transfer record for '{target_model_id}'")
        report["revoked"] = True
        report["revocation_reason"] = reason.value
        report["revocation_details"] = details

        receipt_hash = report.get("transfer_receipt_hash")
        evidence_hash = report.get("evidence_hash")

        from spe_runtime.research.lvt.learning_validator import LearningValidator
        if validator is not None and hasattr(validator, "record_tombstone"):
            validator.record_tombstone(
                receipt_hash=receipt_hash,
                evidence_hash=evidence_hash,
                tx_id=tx.tx_id,
                target_model_id=target_model_id,
                reason=reason.value,
                details=details,
            )
        else:
            LearningValidator._record_global_tombstone(
                receipt_hash=receipt_hash,
                evidence_hash=evidence_hash,
                tx_id=tx.tx_id,
                target_model_id=target_model_id,
                reason=reason.value,
                details=details,
            )

        tx.metadata.setdefault("revocation_tombstones", []).append({
            "target_model_id": target_model_id,
            "transfer_receipt_hash": receipt_hash,
            "evidence_hash": evidence_hash,
            "reason": reason.value,
            "details": details,
            "timestamp": time.time(),
        })

        return report

    @staticmethod
    def synthesize_spe_learning_artifact(
        tx: LearningValidityTransaction,
        refined_prompt_content: str,
        supported_models: Optional[Sequence[str]] = None,
        validator: Optional[Any] = None,
        *,
        allow_synthetic_models: bool = False,
    ) -> str:
        """
        Synthesizes a portable, self-contained .spe bundle embedding the verified learning artifact.
        Strictly enforces:
        1. Non-revoked state
        2. QUALIFIED status
        3. Exclusion of mock/test-only qualifications
        4. Independent trusted oracle attestation custody via mandatory owner-authorized validator
        5. Evidence and protocol hash integrity
        6. Valid cryptographic receipt signature
        7. Cryptographically authenticated per-model transfer receipts for verified_models
        """
        from spe_runtime.research.lvt.learning_validator import LearningValidator

        if validator is not None and not isinstance(validator, LearningValidator):
            raise ValueError("Missing trusted verifier: validator must be an authoritative LearningValidator instance")

        if validator is not None and not getattr(validator, "is_owner_authorized", True):
            raise ValueError("Unauthorized LearningValidator: validator lacks owner root-of-trust authorization for production .spe export")

        LearningTransferProtocol.assert_not_revoked(tx)

        if tx.status == QualificationStatus.REVOKED or tx.revocation_reason is not None:
            raise ValueError(f"Cannot synthesize artifact for revoked transaction: {tx.revocation_reason}")

        if tx.status != QualificationStatus.QUALIFIED:
            raise ValueError(f"Cannot synthesize artifact for non-qualified transaction (status={tx.status})")

        if tx.metadata.get("test_fixture_mock") or tx.protocol_version != "LVT-2" or tx.lvt2_study_result is None:
            raise ValueError("Mock-qualified transaction cannot export a production-valid .spe learning artifact")

        if not tx.is_attested_oracle or tx.oracle_attestation is None:
            raise ValueError("Missing trusted oracle attestation blocks .spe export")

        study = tx.lvt2_study_result
        if not study or not getattr(study, "evidence_hash", None):
            raise ValueError("Invalid LVT-2 study evidence")

        # 5. Protocol and evidence integrity
        if not tx.protocol or not getattr(tx.protocol, "protocol_id", None):
            raise ValueError("Missing experiment protocol blocks .spe export")

        if "committed_protocol_id" in tx.metadata and tx.protocol.protocol_id != tx.metadata["committed_protocol_id"]:
            raise ValueError("Changed protocol invalidates qualification")

        if tx.oracle_attestation.evidence_hash != study.evidence_hash:
            raise ValueError("Changed evidence hash invalidates qualification")

        if "committed_evidence_hash" in tx.metadata and study.evidence_hash != tx.metadata["committed_evidence_hash"]:
            raise ValueError("Changed evidence hash invalidates qualification")

        # 4. Independent oracle attestation verification at export boundary
        att = tx.oracle_attestation
        if not att.oracle_public_key or len(att.oracle_public_key) != 64:
            raise ValueError("Invalid oracle public key format blocks .spe export")
        if not att.signature or len(att.signature) != 128:
            raise ValueError("Invalid oracle signature format blocks .spe export")
        if att.verdict != "APPROVED":
            raise ValueError(f"Unapproved oracle verdict blocks .spe export: {att.verdict}")
        if att.oracle_id != tx.evaluator_id:
            raise ValueError(f"Oracle identity mismatch at export boundary: '{att.oracle_id}' != '{tx.evaluator_id}'")

        try:
            att_pk = bytes.fromhex(att.oracle_public_key)
            att_sig = bytes.fromhex(att.signature)
        except ValueError as e:
            raise ValueError(f"Hex decoding error in oracle attestation: {e}")

        att_dict = {
            "evidence_hash": att.evidence_hash,
            "oracle_id": att.oracle_id,
            "oracle_public_key": att.oracle_public_key,
            "timestamp": att.timestamp,
            "verdict": att.verdict,
        }
        att_canonical = rfc8785_canonicalize(att_dict)
        if not ed25519_verify(att_pk, att_canonical, att_sig):
            raise ValueError("Invalid oracle attestation cryptographic signature blocks .spe export")

        from spe_runtime.research.lvt.learning_validator import LearningValidator

        if validator is None:
            raise ValueError("Missing owner-authorized trusted validator for .spe export")

        if not isinstance(validator, LearningValidator):
            raise ValueError("Missing owner-authorized trusted verifier: validator must be an authoritative LearningValidator instance")

        if not getattr(validator, "is_owner_authorized", True):
            raise ValueError("Unauthorized LearningValidator: validator lacks owner root-of-trust authorization for production .spe export")

        if validator.is_tombstoned(
            receipt_hash=tx.artifact_hash,
        ):
            raise ValueError(
                f"Cannot export .spe artifact: parent transaction '{tx.tx_id}' has been revoked (persistent tombstone enforced)"
            )

        oracle_ok, oracle_msg = validator.verify_oracle_attestation(
            att,
            study.evidence_hash,
            expected_oracle_id=tx.evaluator_id,
        )
        if not oracle_ok:
            raise ValueError(f"Oracle attestation rejected at export boundary: {oracle_msg}")

        if not tx.canonical_receipt_signature or not tx.artifact_hash:
            raise ValueError("Missing receipt signature blocks .spe export")

        if not validator.verify_transaction_signature(tx):
            raise ValueError("Invalid receipt signature blocks .spe export")

        # 7. Cryptographically verify every cross-model transfer entry
        transfers = tx.metadata.get("cross_model_transfers", {})
        if not isinstance(transfers, dict):
            raise ValueError("Malformed cross_model_transfers metadata")

        verified = set()
        verified_model_transfers: Dict[str, Any] = {}
        if tx.claim.generator_id:
            parent_digest_type = (
                tx.metadata.get("parent_model_digest_type")
                or getattr(study, "model_digest_type", "VERIFIED_MODEL_REVISION")
            )
            parent_digest = tx.metadata.get("parent_model_digest", "")
            parent_is_synthetic = (
                parent_digest_type in ("SYNTHETIC_NAME_DERIVED", "SYNTHETIC_MODEL_IDENTIFIER")
                or (isinstance(parent_digest, str) and bool(parent_digest) and _is_synthetic_model_digest(tx.claim.generator_id, parent_digest))
            )
            if not parent_is_synthetic or allow_synthetic_models:
                verified.add(tx.claim.generator_id)

        for model_id, report in transfers.items():
            receipt_hash = report.get("transfer_receipt_hash")
            evidence_hash = report.get("evidence_hash")
            if (
                report.get("revoked") is True
                or validator.is_tombstoned(
                    receipt_hash=receipt_hash,
                    evidence_hash=evidence_hash,
                )
                or any(
                    isinstance(t, dict) and (
                        t.get("target_model_id") == model_id
                        or (receipt_hash and t.get("transfer_receipt_hash") == receipt_hash)
                    )
                    for t in tx.metadata.get("revocation_tombstones", [])
                )
            ):
                raise ValueError(
                    f"Rejected cross-model transfer evidence for '{model_id}': transfer has been revoked (persistent tombstone enforced)"
                )

            is_authentic, is_verified_transfer, reason = validator.verify_model_transfer_receipt(
                tx, model_id, report, allow_synthetic_models=allow_synthetic_models
            )
            if not is_authentic:
                raise ValueError(
                    f"Rejected cross-model transfer evidence for '{model_id}': {reason}"
                )

            digest_type = report.get("model_digest_type") or report.get("target_model_digest_type", "VERIFIED_MODEL_REVISION")
            is_synthetic = (
                digest_type in ("SYNTHETIC_MODEL_IDENTIFIER", "SYNTHETIC_NAME_DERIVED")
                or _is_synthetic_model_digest(model_id, str(report.get("target_model_digest", "")))
            )
            if is_synthetic and not allow_synthetic_models:
                # Synthetic model digests cannot qualify as verified model revisions in production .spe export
                continue

            if is_verified_transfer:
                verified.add(model_id)
                verified_model_transfers[model_id] = {
                    "target_model_id": model_id,
                    "target_model_digest": report["target_model_digest"],
                    "model_digest_type": report.get("model_digest_type", "VERIFIED_MODEL_REVISION"),
                    "evaluator_id": report["evaluator_id"],
                    "oracle_public_key": report["oracle_public_key"],
                    "protocol_digest": report["protocol_digest"],
                    "dataset_digest": report["dataset_digest"],
                    "observations_digest": report["observations_digest"],
                    "evidence_hash": report["evidence_hash"],
                    "transfer_receipt_hash": report["transfer_receipt_hash"],
                    "transfer_receipt_signature": report["transfer_receipt_signature"],
                    "statistical_verdict": report["statistical_verdict"],
                }
                if "family_provenance" in report:
                    verified_model_transfers[model_id]["family_provenance"] = report["family_provenance"]
                if "independence_assertions" in report:
                    verified_model_transfers[model_id]["independence_assertions"] = report["independence_assertions"]

        if supported_models is not None:
            if len(supported_models) == 0:
                raise ValueError("supported_models cannot be empty")
            unverified = [
                m for m in supported_models
                if not isinstance(m, str) or not m.strip() or m not in verified
            ]
            if unverified:
                raise ValueError(
                    f"Unverified model transfer cannot be labeled as verified_models: {unverified}. "
                    "Synthetic model identifier digests cannot qualify as verified model revisions unless allow_synthetic_models=True."
                )
            models_to_export = list(supported_models)
        else:
            models_to_export = sorted(list(verified))
            if not models_to_export:
                raise ValueError(
                    "Cannot synthesize production .spe learning artifact with zero verified_models: "
                    "synthetic model identifier digests cannot qualify as verified model revisions unless allow_synthetic_models=True."
                )

        empirical_gain = {
            "delta_improvement": study.family_macro_delta,
            "held_out_retention": study.holdout_candidate_minus_base,
        }

        artifact_doc = {
            "spe_version": "1.0",
            "artifact_type": "LEARNING_VALIDITY_TRANSACTION",
            "tx_id": tx.tx_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "receipt": {
                "artifact_hash": tx.artifact_hash,
                "signature": tx.canonical_receipt_signature,
                "committed_timestamp": tx.committed_timestamp,
            },
            "verified_models": models_to_export,
            "verified_model_transfers": {
                m: verified_model_transfers[m]
                for m in models_to_export
                if m in verified_model_transfers
            },
            "empirical_gain": empirical_gain,
            "refined_prompt": refined_prompt_content,
        }

        return json.dumps(artifact_doc, indent=2)

    @staticmethod
    def revoke_transaction(
        tx: LearningValidityTransaction,
        reason: RevocationReason,
        details: str,
        *,
        validator: Optional[Any] = None,
    ) -> LearningValidityTransaction:
        """
        Revokes a previously admitted transaction upon counterexample discovery or drift failure,
        and persists durable revocation tombstones for both the parent transaction and all child transfers.
        """
        from spe_runtime.research.lvt.learning_validator import LearningValidator

        tx.status = QualificationStatus.REVOKED
        tx.revocation_reason = reason

        study_ev = tx.lvt2_study_result.evidence_hash if tx.lvt2_study_result else None
        if validator is not None and hasattr(validator, "record_tombstone"):
            validator.record_tombstone(
                receipt_hash=tx.artifact_hash,
                evidence_hash=study_ev,
                tx_id=tx.tx_id,
                target_model_id=None,
                reason=reason.value,
                details=details,
            )
        else:
            LearningValidator._record_global_tombstone(
                receipt_hash=tx.artifact_hash,
                evidence_hash=study_ev,
                tx_id=tx.tx_id,
                target_model_id=None,
                reason=reason.value,
                details=details,
            )

        transfers = tx.metadata.get("cross_model_transfers", {})
        if isinstance(transfers, dict):
            for model_id, report in transfers.items():
                if isinstance(report, dict):
                    report["revoked"] = True
                    report["revocation_reason"] = reason.value
                    r_hash = report.get("transfer_receipt_hash")
                    e_hash = report.get("evidence_hash")
                    if validator is not None and hasattr(validator, "record_tombstone"):
                        validator.record_tombstone(
                            receipt_hash=r_hash,
                            evidence_hash=e_hash,
                            tx_id=tx.tx_id,
                            target_model_id=model_id,
                            reason=reason.value,
                            details=details,
                        )
                    else:
                        LearningValidator._record_global_tombstone(
                            receipt_hash=r_hash,
                            evidence_hash=e_hash,
                            tx_id=tx.tx_id,
                            target_model_id=model_id,
                            reason=reason.value,
                            details=details,
                        )

        if "revocation_history" not in tx.metadata:
            tx.metadata["revocation_history"] = []

        tx.metadata["revocation_history"].append({
            "reason": reason.value,
            "details": details,
            "status_before": QualificationStatus.QUALIFIED.value,
        })

        return tx

    @staticmethod
    def check_distribution_drift_and_revoke(
        tx: LearningValidityTransaction,
        monitored_scores: Sequence[float],
        drift_tolerance: float = 0.15,
        *,
        validator: Optional[Any] = None,
    ) -> bool:
        """
        Monitors ongoing production outputs. If average performance degrades below
        held-out generalization baseline by more than drift_tolerance, automatically revokes.
        """
        if not monitored_scores:
            return False

        if tx.lvt2_study_result:
            baseline_generalization = tx.lvt2_study_result.holdout_candidate_mean
        elif tx.results:
            baseline_generalization = tx.results.arm_d_generalization_score
        else:
            return False

        current_avg = sum(monitored_scores) / len(monitored_scores)

        if current_avg < (baseline_generalization - drift_tolerance):
            LearningTransferProtocol.revoke_transaction(
                tx,
                reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
                details=f"Current score {current_avg:.4f} dropped below generalization baseline {baseline_generalization:.4f} by > {drift_tolerance}",
                validator=validator,
            )
            return True
        return False
