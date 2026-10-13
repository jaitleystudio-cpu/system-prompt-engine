#!/usr/bin/env python3
"""
SPE Ω — Genuine LVT-2 Mutation Harness (Task 5).

Applies 10 required real source mutations to production code in isolated transactions,
executes regression tests, proves test failure (exit code != 0 -> KILLED),
restores original file bytes, and verifies restoration.
"""

import atexit
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

# REPAIR (grok/lvt2-mutation-harness-repair):
# Root cause of the M01 "crash": the harness had no signal handling and no subprocess
# timeout; restoration lived only in a `finally` block, which does not run on SIGTERM/SIGHUP
# (e.g. when the launching shell/session is reaped). The mutant then stayed on disk and a
# stray *.orig_backup was left behind, with no Python traceback. Secondary defect: the
# harness preferred a hard-coded pytest from another checkout's venv, so tests could run under
# a different interpreter/site-packages than the code under test (custody hazard).
REPO_ROOT = Path(os.environ.get("SPE_MUTATION_REPO_ROOT") or Path(__file__).resolve().parent.parent)
PYTEST_CMD = [sys.executable, "-m", "pytest"]  # always the interpreter running the harness
TEST_TIMEOUT_S = float(os.environ.get("SPE_MUTATION_TEST_TIMEOUT_S", "600"))

_ACTIVE = {}  # filepath -> original bytes, for emergency restoration


def _restore_active():
    for fp, data in list(_ACTIVE.items()):
        try:
            fp.write_bytes(data)
            bak = fp.with_suffix(fp.suffix + ".orig_backup")
            if bak.exists() and bak.read_bytes() == data:
                bak.unlink()
        finally:
            _ACTIVE.pop(fp, None)


def _on_signal(signum, _frame):
    _restore_active()
    sys.stderr.write(f"\nmutation harness interrupted by signal {signum}; sources restored\n")
    sys.exit(128 + signum)


MUTANTS = [
    {
        "id": "M01",
        "name": "Ignore oracle key allowlist",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if self._trusted_oracle_keys:\n            if oracle_pk not in self._trusted_oracle_keys:",
        "replacement": "        if False:\n            if oracle_pk not in self._trusted_oracle_keys:",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task2_d2_key_only_allowlist_fails_closed",
    },
    {
        "id": "M02",
        "name": "Allow missing trust registry",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if not self._trusted_oracles and not self._trusted_oracle_keys:\n            return False, \"no trusted oracle registry configured (fail closed)\"",
        "replacement": "        if False and not self._trusted_oracles and not self._trusted_oracle_keys:\n            return False, \"no trusted oracle registry configured (fail closed)\"",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task2_a_no_oracle_trust_registry_fails_closed",
    },
    {
        "id": "M03",
        "name": "Enable aggregate-only mock qualification",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        else:\n            # Legacy V1 aggregate-only: FAIL CLOSED. Production bypass is strictly forbidden.\n            tx.status = QualificationStatus.RESEARCH_UNQUALIFIED\n            tx.canonical_receipt_signature = \"\"\n            tx.artifact_hash = \"\"\n            tx.rejection_reason = (\n                \"V1 aggregate-only results cannot mint production QUALIFIED receipt. \"\n                \"LVT-2 family-level evaluation and independent oracle attestation required.\"\n            )\n            return tx",
        "replacement": "        else:\n            # MUTANT M03: Enable aggregate-only mock qualification\n            tx.status = QualificationStatus.QUALIFIED\n            tx.rejection_reason = None",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task3_mock_scores_cannot_yield_production_qualified",
    },
    {
        "id": "M04",
        "name": "Accept changed attestation evidence hash",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if not attestation.evidence_hash or attestation.evidence_hash != expected_evidence_hash:\n            return False, f\"evidence hash mismatch ({attestation.evidence_hash} != {expected_evidence_hash})\"",
        "replacement": "        if False and (not attestation.evidence_hash or attestation.evidence_hash != expected_evidence_hash):\n            return False, f\"evidence hash mismatch ({attestation.evidence_hash} != {expected_evidence_hash})\"",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task2_e_trusted_oracle_altered_evidence_rejected",
    },
    {
        "id": "M05",
        "name": "Skip oracle ID binding",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if expected_oracle_id and attestation.oracle_id != expected_oracle_id:\n            return False, f\"oracle identity mismatch: attestation oracle_id '{attestation.oracle_id}' != expected '{expected_oracle_id}'\"",
        "replacement": "        # MUTANT M05: Skip oracle ID binding\n        pass",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task2_f2_oracle_id_evaluator_mismatch",
    },
    {
        "id": "M06",
        "name": "Trust QUALIFIED without verified receipt",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "        if not validator.verify_transaction_signature(tx):\n            raise ValueError(\"Invalid receipt signature blocks .spe export\")",
        "replacement": "        # MUTANT M06: Trust QUALIFIED without verified receipt\n        pass",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task4_4_invalid_receipt_signature_blocks_export",
    },
    {
        "id": "M07",
        "name": "Permit revoked .spe export",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "        LearningTransferProtocol.assert_not_revoked(tx)\n\n        if tx.status == QualificationStatus.REVOKED or tx.revocation_reason is not None:\n            raise ValueError(f\"Cannot synthesize artifact for revoked transaction: {tx.revocation_reason}\")",
        "replacement": "        # MUTANT M07: Permit revoked .spe export\n        pass",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task4_5b_revoked_reason_blocks_export_even_if_qualified",
    },
    {
        "id": "M08",
        "name": "Replace held-out baseline with training base",
        "file": "spe_runtime/research/lvt/controlled_experiment.py",
        "target": "        held_out_retention = score_d - score_d_base",
        "replacement": "        held_out_retention = score_d - score_a  # MUTANT M08: Replace held-out baseline with training base",
        "test": "tests/research/lvt/test_defects_reproduction.py::test_defect_lvt_f02_heldout_candidate_vs_train_baseline_mismatch_rejected",
    },
    {
        "id": "M09",
        "name": "Replace family-macro effect with item weighting",
        "file": "spe_runtime/research/lvt/paired_gate_v2.py",
        "target": "    macro_delta = _mean(family_delta)  # independent family is the inference and effect unit",
        "replacement": "    macro_delta = held_delta  # MUTANT M09: Replace family-macro effect with item weighting",
        "test": "tests/research/lvt/test_defects_reproduction.py::test_defect_lvt_f05_repeated_family_pseudoreplication_controlled_by_family_macro",
    },
    {
        "id": "M10",
        "name": "Convert INCONCLUSIVE into QUALIFIED",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "                if study.status == \"INCONCLUSIVE\":\n                    tx.status = QualificationStatus.INCONCLUSIVE\n                    tx.rejection_reason = f\"LVT-2 study inconclusive: {', '.join(study.reasons)}\"",
        "replacement": "                if study.status == \"INCONCLUSIVE\":\n                    tx.status = QualificationStatus.QUALIFIED  # MUTANT M10\n                    tx.rejection_reason = None",
        "test": "tests/research/lvt/test_lvt2_r2_trust_root_and_authority.py::test_task7_inconclusive_study_cannot_yield_qualified",
    },
    {
        "id": "M11",
        "name": "Allow absent validator in evaluate_cross_model_transfer",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "        if validator is None or not isinstance(validator, LearningValidator):\n            raise ValueError(\"Missing owner-authorized LearningValidator: cross-model transfer requires a trusted validator instance\")",
        "replacement": "        if False:\n            raise ValueError(\"Missing owner-authorized LearningValidator: cross-model transfer requires a trusted validator instance\")",
        "test": "tests/research/lvt/test_lvt2_r5_authenticated_transfer.py::test_r5_01_absent_validator_rejected",
    },
    {
        "id": "M12",
        "name": "Skip transfer receipt authentication in synthesize_spe_learning_artifact",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "            is_authentic, is_verified_transfer, reason = validator.verify_model_transfer_receipt(\n                tx, model_id, report, allow_synthetic_models=allow_synthetic_models\n            )",
        "replacement": "            is_authentic, is_verified_transfer, reason = True, bool(report.get('transfers_successfully')), 'MUTANT M12'",
        "test": "tests/research/lvt/test_lvt2_r5_authenticated_transfer.py::test_r5_03_forged_transfer_metadata_rejected",
    },
    {
        "id": "M13",
        "name": "Bypass 20-family minimum in cross-model transfer",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "        min_required_families = max(20, proto.min_heldout_families)",
        "replacement": "        min_required_families = 1  # MUTANT M13",
        "test": "tests/research/lvt/test_lvt2_r5_authenticated_transfer.py::test_r5_07_one_item_mock_qualification_rejected",
    },
    {
        "id": "M14",
        "name": "Bypass model identity binding in evaluate_cross_model_transfer",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "            if transfer_protocol.generator_id != target_model_id:\n                raise ValueError(\n                    f\"Mismatched model identity: transfer_protocol.generator_id '{transfer_protocol.generator_id}' != target_model_id '{target_model_id}'\"\n                )",
        "replacement": "            # MUTANT M14: Bypass model identity binding\n            pass",
        "test": "tests/research/lvt/test_lvt2_r5_authenticated_transfer.py::test_r5_05_mismatched_model_identity_rejected",
    },
    {
        "id": "M15",
        "name": "Bypass synthetic model check in .spe export",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "            if is_synthetic and not allow_synthetic_models:\n                # Synthetic model digests cannot qualify as verified model revisions in production .spe export\n                continue",
        "replacement": "            if False and is_synthetic and not allow_synthetic_models:\n                continue",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_a_synthetic_model_digest_rejected_for_export",
    },
    {
        "id": "M16",
        "name": "Bypass owner authority check in validate_and_commit",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "                    if not self._is_owner_authorized:\n                        tx.status = QualificationStatus.REJECTED",
        "replacement": "                    if False and not self._is_owner_authorized:\n                        tx.status = QualificationStatus.REJECTED",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_b_unauthorized_validator_rejected",
    },
    {
        "id": "M17",
        "name": "Bypass durable tombstone check in is_tombstoned",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "    def is_tombstoned(\n        self,\n        receipt_hash: Optional[str] = None,\n        evidence_hash: Optional[str] = None,\n        tx_id: Optional[str] = None,\n        target_model_id: Optional[str] = None,\n    ) -> bool:\n        \"\"\"Checks if a receipt, evidence, or transfer binding has a durable revocation tombstone.\"\"\"",
        "replacement": "    def is_tombstoned(\n        self,\n        receipt_hash: Optional[str] = None,\n        evidence_hash: Optional[str] = None,\n        tx_id: Optional[str] = None,\n        target_model_id: Optional[str] = None,\n    ) -> bool:\n        \"\"\"Checks if a receipt, evidence, or transfer binding has a durable revocation tombstone.\"\"\"\n        return False  # MUTANT M17: Bypass durable tombstone check",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_c_revocation_tombstone_prevents_metadata_restore_replay",
    },
    {
        "id": "M18",
        "name": "Bypass task family clustering distinction check in transfer",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "            if len(clusters) < min_required_families:\n                raise ValueError(\n                    f\"Family clustering lacks auditable distinction: got {len(clusters)} distinct clusters across {len(families)} nominal family IDs (require >= {min_required_families})\"\n                )",
        "replacement": "            if False and len(clusters) < min_required_families:\n                pass",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_d_insufficient_task_clusters_rejected",
    },
    {
        "id": "M19",
        "name": "Bypass synthetic model digest invariant check against VERIFIED_MODEL_REVISION",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "                    if model_digest_type == \"VERIFIED_MODEL_REVISION\":\n                        raise ValueError(\n                            f\"Synthetic model identifier digest '{target_model_digest}' cannot be classified as VERIFIED_MODEL_REVISION: \"\n                            \"digest derives from synthetic model name hash and lacks verified model revision provenance.\"\n                        )",
        "replacement": "                    # MUTANT M19: Bypass synthetic model digest invariant check\n                    if False and model_digest_type == \"VERIFIED_MODEL_REVISION\":\n                        pass",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_a_synthetic_digest_misclassified_as_verified_revision_rejected",
    },
    {
        "id": "M20",
        "name": "Bypass caller-asserted owner authorization rejection",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if is_owner_authorized is not None:\n            raise ValueError(\n                \"Caller cannot self-assert owner authorization: 'is_owner_authorized' parameter is forbidden. \"\n                \"Authority must be cryptographically attested by an enrolled owner root key.\"\n            )",
        "replacement": "        if is_owner_authorized is not None:\n            # MUTANT M20: Allow caller self-assertion\n            self._is_owner_authorized = bool(is_owner_authorized)",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_b_self_asserted_authority_and_unauthorized_root_rejected",
    },
    {
        "id": "M21",
        "name": "Bypass durable tombstone load from disk in validator",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "    def load_tombstones_from_disk(cls, path: Optional[str | Path] = None) -> int:\n        \"\"\"Loads persistent tombstones from disk into global validator registries.\"\"\"\n        p = Path(path) if path else cls._get_tombstone_path()",
        "replacement": "    def load_tombstones_from_disk(cls, path: Optional[str | Path] = None) -> int:\n        \"\"\"Loads persistent tombstones from disk into global validator registries.\"\"\"\n        # MUTANT M21: Bypass durable tombstone load from disk\n        return 0\n        p = Path(path) if path else cls._get_tombstone_path()",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_c_revocation_persists_across_process_restart_and_backup_restore",
    },
    {
        "id": "M22",
        "name": "Bypass independence assertions validation in cross-model transfer",
        "file": "spe_runtime/research/lvt/transfer_protocol.py",
        "target": "            if not independence_assertions:\n                raise ValueError(\"Task family independence assertions rejected: empty assertions dictionary provided\")\n            if independence_assertions.get(\"contamination_controlled\") is not True:\n                raise ValueError(\"Task family independence assertions rejected: contamination controls not asserted as True\")",
        "replacement": "            # MUTANT M22: Bypass independence assertions validation\n            if False:\n                pass",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_finding_d_missing_provenance_and_unsupported_independence_rejected",
    },
    {
        "id": "M23",
        "name": "Bypass persistent parent transaction tombstone check in verify_transaction_signature",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if self.is_tombstoned(\n            receipt_hash=tx.artifact_hash,\n            evidence_hash=study_ev_hash,\n            tx_id=tx.tx_id,\n        ):\n            return False",
        "replacement": "        # MUTANT M23: Bypass persistent parent transaction tombstone check\n        if False:\n            return False",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_round3_parent_transaction_revocation_persists_across_restart_and_backup_restore",
    },
    {
        "id": "M24",
        "name": "Bypass fail-closed tombstone I/O error handling when explicitly configured",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        except OSError as exc:\n            if explicit:\n                raise RuntimeError(f\"Failed to persist revocation tombstone to '{p}': {exc}\") from exc",
        "replacement": "        except OSError as exc:\n            # MUTANT M24: Silently ignore tombstone persistence failure\n            pass",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_round3_tombstone_io_failure_fails_closed_when_configured",
    },
    {
        "id": "M25",
        "name": "Bypass parent study synthetic model digest rejection in paired_gate_v2",
        "file": "spe_runtime/research/lvt/paired_gate_v2.py",
        "target": "    if p.model_digest_type == 'VERIFIED_MODEL_REVISION' and _is_synthetic_model_digest(p.generator_id, p.model_digest):\n        raise StudyInvalid('synthetic model_digest cannot claim VERIFIED_MODEL_REVISION')",
        "replacement": "    if False and p.model_digest_type == 'VERIFIED_MODEL_REVISION' and _is_synthetic_model_digest(p.generator_id, p.model_digest):\n        raise StudyInvalid('synthetic model_digest cannot claim VERIFIED_MODEL_REVISION')",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_round3_parent_and_variant_synthetic_model_digests_rejected",
    },
    {
        "id": "M26",
        "name": "Bypass strict cryptographic owner authority requirement on LearningValidator",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if require_cryptographic_owner_authority and not self._has_cryptographic_owner_authority:\n            raise ValueError(\n                \"Unauthorized LearningValidator: cryptographic owner attestation from an enrolled owner root key \"\n                \"is required (validator is unattested or revoked).\"\n            )",
        "replacement": "        if False and require_cryptographic_owner_authority and not self._has_cryptographic_owner_authority:\n            raise ValueError(\"MUTANT M26\")",
        "test": "tests/research/lvt/test_lvt2_r5_adversarial_closure.py::test_round3_cryptographic_owner_authority_and_validator_revocation_enforced",
    },
    {
        "id": "M27",
        "name": "Bypass RBPD RealityBoundEvidenceAsset Ed25519 signature verification",
        "file": "spe_runtime/research/rbpd/contract.py",
        "target": "        if val_pk_bytes != self._validator.public_key or not ed25519_verify(val_pk_bytes, canonical_bytes, sig_bytes):\n            return AssetValidationVerdict(\n                status=EpistemicStatus.INVALID,\n                can_reuse=False,\n                reason=\"Cryptographic Ed25519 signature verification failed\",\n            )",
        "replacement": "        if False:\n            return AssetValidationVerdict(status=EpistemicStatus.INVALID, can_reuse=False, reason=\"MUTANT M27\")",
        "test": "tests/research/rbpd/test_rbpd_proof_dividend.py::test_phase_a_adversarial_forgery_synthetic_model_and_tombstone_fail_closed",
    },
    {
        "id": "M28",
        "name": "Permit reuse of STALE obligations during selective invalidation",
        "file": "spe_runtime/research/rbpd/contract.py",
        "target": "        if stale_triggers:\n            return AssetValidationVerdict(\n                status=EpistemicStatus.STALE,\n                can_reuse=False,\n                reason=f\"Asset is STALE due to: {', '.join(stale_triggers)}\",\n                triggered_invalidations=tuple(stale_triggers),\n            )",
        "replacement": "        if False and stale_triggers:\n            return AssetValidationVerdict(status=EpistemicStatus.STALE, can_reuse=False, reason=\"MUTANT M28\")",
        "test": "tests/research/rbpd/test_rbpd_proof_dividend.py::test_phase_b_selective_invalidation_matrix_all_six_classes",
    },
    {
        "id": "M29",
        "name": "Disable Channel B sealed reality witness Goodhart divergence detection",
        "file": "spe_runtime/research/rbpd/witness_selector.py",
        "target": "        goodhart_detected = gap > self.goodhart_gap_threshold or (\n            mean_a >= self.pass_floor and mean_b < self.pass_floor\n        )",
        "replacement": "        goodhart_detected = False  # MUTANT M29: Disable Goodhart divergence detection",
        "test": "tests/research/rbpd/test_rbpd_proof_dividend.py::test_phase_c_dual_channel_witness_selector_catches_goodhart_proxy_overfit",
    },
    {
        "id": "M30",
        "name": "Falsely claim positive proof dividend on negative control benchmark",
        "file": "spe_runtime/research/rbpd/dividend_benchmark.py",
        "target": "        net_positive = rbpd_ledger.total_lifecycle_cost < full_rerun_cost",
        "replacement": "        net_positive = True  # MUTANT M30: Falsely claim positive dividend on negative control",
        "test": "tests/research/rbpd/test_rbpd_proof_dividend.py::test_phase_d_lifecycle_proof_dividend_and_negative_control",
    },
    {
        "id": "M31",
        "name": "verify_transaction_signature accepts REVOKED (Bro replay BRO1)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if tx.status == QualificationStatus.REVOKED:\n            return False\n        if not tx.canonical_receipt_signature",
        "replacement": "        # MUTANT M31: REVOKED check removed\n        if not tx.canonical_receipt_signature",
        "test": "tests/research/lvt/test_verify_signature_mutant_killers.py::test_validly_signed_but_revoked_receipt_is_rejected",
    },
    {
        "id": "M32",
        "name": "verify_transaction_signature skips artifact_hash check (Bro replay BRO2)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if not tx.artifact_hash:\n            return False\n        study_ev_hash",
        "replacement": "        # MUTANT M32: artifact_hash check removed\n        study_ev_hash",
        "test": "tests/research/lvt/test_verify_signature_mutant_killers.py::test_missing_artifact_hash_fails_closed_before_any_lookup",
    },
    {
        "id": "M33",
        "name": "verify_oracle_attestation accepts non-APPROVED verdict (Bro replay 2 BRO3)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if attestation.verdict != \"APPROVED\":\n            return False, f\"unapproved verdict: {attestation.verdict}\"\n",
        "replacement": "        # MUTANT M33: verdict check removed\n",
        "test": "tests/research/lvt/test_verify_signature_mutant_killers.py::test_signed_attestation_with_non_approved_verdict_is_rejected",
    },
    {
        "id": "M34",
        "name": "revoked validator key may be re-enrolled (Bro replay 2 BRO4)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if pk_hex in cls._REVOKED_VALIDATORS or f\"validator_pk:{pk_hex}\" in cls._GLOBAL_TOMBSTONES:\n            raise ValueError(f\"Validator public key '{pk_hex}' has been revoked and cannot be re-enrolled\")\n",
        "replacement": "        # MUTANT M34: re-enrollment revocation check removed\n",
        "test": "tests/research/lvt/test_verify_signature_mutant_killers.py::test_revoked_validator_key_cannot_be_re_enrolled",
    },
    {
        "id": "M35",
        "name": "transfer receipt duplicate item_id/content_sha256 replay check removed (Bro replay 3 BRO5)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "            if iid in seen_ids or csha in seen_digests:\n                return False, False, \"Duplicate item_id or content_sha256 in transfer observations\"\n",
        "replacement": "            # MUTANT M35: duplicate check removed\n",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M36",
        "name": "transfer significance p_val <= alpha_adj relaxed to p_val <= 1.0 (Bro replay 3 BRO6)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "            and p_val <= alpha_adj\n",
        "replacement": "            and p_val <= 1.0\n",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M37",
        "name": "transfer protocol min_heldout_families floor 20 -> 2 (Bro replay 3 BRO8)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if proto.min_heldout_families < 20 or proto.family_level_significance is not True:",
        "replacement": "        if proto.min_heldout_families < 2 or proto.family_level_significance is not True:",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M38",
        "name": "duplicate check keeps item_id only (content_sha256 replay allowed)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "            if iid in seen_ids or csha in seen_digests:\n                return False, False, \"Duplicate item_id or content_sha256 in transfer observations\"\n",
        "replacement": "            if iid in seen_ids:\n                return False, False, \"Duplicate item_id or content_sha256 in transfer observations\"\n",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M39",
        "name": "duplicate check keeps content_sha256 only (item_id replay allowed)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "            if iid in seen_ids or csha in seen_digests:\n                return False, False, \"Duplicate item_id or content_sha256 in transfer observations\"\n",
        "replacement": "            if csha in seen_digests:\n                return False, False, \"Duplicate item_id or content_sha256 in transfer observations\"\n",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M40",
        "name": "transfer protocol floor off-by-one (< 19)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        if proto.min_heldout_families < 20 or proto.family_level_significance is not True:",
        "replacement": "        if proto.min_heldout_families < 19 or proto.family_level_significance is not True:",
        "test": "tests/research/lvt/test_transfer_receipt_mutant_killers.py",
    },
    {
        "id": "M41",
        "name": "transfer Bonferroni dropped: alpha_adj = proto.alpha (Bro round-3 BRO9)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        alpha_adj = proto.alpha / proto.multiplicity\n",
        "replacement": "        alpha_adj = proto.alpha\n",
        "test": "tests/research/lvt/test_alpha_and_ties_mutant_killers.py",
    },
    {
        "id": "M42",
        "name": "study-path study.p_value <= study.alpha_adjusted check deleted (Bro round-3 BRO10)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "                and study.p_value <= study.alpha_adjusted\n",
        "replacement": "",
        "test": "tests/research/lvt/test_alpha_and_ties_mutant_killers.py",
    },
    {
        "id": "M43",
        "name": "transfer sign test counts ties as positive (Bro round-3 BRO11)",
        "file": "spe_runtime/research/lvt/learning_validator.py",
        "target": "        positives = sum(d > 1e-12 for d in family_deltas)\n",
        "replacement": "        positives = sum(d >= -1e-12 for d in family_deltas)\n",
        "test": "tests/research/lvt/test_alpha_and_ties_mutant_killers.py",
    },
]


def run_mutation(m: dict) -> dict:
    filepath = REPO_ROOT / m["file"]
    orig_bytes = filepath.read_bytes()
    orig_text = orig_bytes.decode("utf-8")

    if m["target"] not in orig_text:
        return {
            "id": m["id"],
            "name": m["name"],
            "status": "ERROR_TARGET_NOT_FOUND",
            "exit_code": None,
            "restored_ok": True,
            "output_summary": "Target substring not found in source file",
            "error": "Target substring not found in source file",
        }

    backup_path = filepath.with_suffix(filepath.suffix + ".orig_backup")
    backup_path.write_bytes(orig_bytes)
    _ACTIVE[filepath] = orig_bytes

    # Apply mutation
    mutated_text = orig_text.replace(m["target"], m["replacement"], 1)
    filepath.write_text(mutated_text, encoding="utf-8")

    try:
        # Run test
        cmd = PYTEST_CMD + [m["test"], "-q", "-p", "no:cacheprovider"]
        try:
            proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True,
                                  timeout=TEST_TIMEOUT_S)
            exit_code = proc.returncode
            stdout = proc.stdout.strip()
            stderr = proc.stderr.strip()
        except subprocess.TimeoutExpired:
            exit_code, stdout, stderr = None, "", f"TIMEOUT after {TEST_TIMEOUT_S}s"
    finally:
        # Restore original bytes from backup
        if backup_path.exists():
            filepath.write_bytes(backup_path.read_bytes())
            backup_path.unlink()
        else:
            filepath.write_bytes(orig_bytes)
        _ACTIVE.pop(filepath, None)

    # Verify restoration
    restored_bytes = filepath.read_bytes()
    restored_ok = (restored_bytes == orig_bytes)

    # Mutant is KILLED if test fails (exit_code != 0)
    # exit 1 = tests failed (KILLED). Collection/usage/internal errors (2-5), timeouts and
    # missing pytest are NOT counted as kills: the gate must not be satisfied by a broken run.
    if exit_code is None:
        status = "ERROR_TIMEOUT"
    elif exit_code == 1:
        status = "KILLED"
    elif exit_code == 0:
        status = "SURVIVED"
    else:
        status = f"ERROR_PYTEST_EXIT_{exit_code}"
    if not restored_ok:
        status = "ERROR_RESTORE_FAILED"

    return {
        "id": m["id"],
        "name": m["name"],
        "status": status,
        "exit_code": exit_code,
        "restored_ok": restored_ok,
        "output_summary": (stdout.splitlines()[-1] if stdout else (stderr.splitlines()[-1] if stderr else "")),
    }


def main():
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, _on_signal)
    atexit.register(_restore_active)
    only = [x for x in sys.argv[1:] if x.startswith("M")]
    print("=" * 70)
    print("SPE Ω — Genuine LVT-2 Source Mutation Verification Harness")
    print("=" * 70)

    # Recover any dangling backups from aborted runs
    for bak in REPO_ROOT.rglob("*.orig_backup"):
        orig_target = bak.with_suffix("")
        if orig_target.exists():
            orig_target.write_bytes(bak.read_bytes())
        bak.unlink()

    results = []
    all_killed = True

    selected = [m for m in MUTANTS if not only or m["id"] in only]
    for m in selected:
        print(f"Testing mutant {m['id']}: {m['name']}...", end=" ", flush=True)
        res = run_mutation(m)
        results.append(res)
        if res["status"] == "KILLED":
            print(f"KILLED (exit_code={res['exit_code']}, restored={res['restored_ok']})")
        else:
            print(f"{res['status']} (exit_code={res['exit_code']}, restored={res['restored_ok']})")
            all_killed = False

    print("=" * 70)
    killed_count = sum(1 for r in results if r["status"] == "KILLED")
    print(f"MUTATION TESTING SUMMARY: {killed_count}/{len(selected)} mutants KILLED")
    for r in results:
        print(f"  [{r['id']}] {r['status']}: {r['name']} | test summary: {r['output_summary']}")
    print("=" * 70)

    log = os.environ.get("SPE_MUTATION_JSON_LOG")
    if log:
        Path(log).write_text(json.dumps(results, indent=2))
    if not all_killed or not all(r["restored_ok"] for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
