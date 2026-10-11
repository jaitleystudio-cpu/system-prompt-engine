#!/usr/bin/env python3
"""
SPE Ω — Genuine LVT-2 Mutation Harness (Task 5).

Applies 10 required real source mutations to production code in isolated transactions,
executes regression tests, proves test failure (exit code != 0 -> KILLED),
restores original file bytes, and verifies restoration.
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MAIN_VENV = Path("/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest")
if MAIN_VENV.exists():
    PYTEST_BIN = MAIN_VENV
elif (REPO_ROOT / ".venv" / "bin" / "pytest").exists():
    PYTEST_BIN = REPO_ROOT / ".venv" / "bin" / "pytest"
else:
    PYTEST_BIN = Path(sys.executable).parent / "pytest"

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
        "target": "        if any(\n            k in self._revocation_tombstones or k in self._GLOBAL_TOMBSTONES\n            for k in keys_to_check\n        ):\n            return True",
        "replacement": "        if False:\n            return True",
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

    # Apply mutation
    mutated_text = orig_text.replace(m["target"], m["replacement"], 1)
    filepath.write_text(mutated_text, encoding="utf-8")

    try:
        # Run test
        cmd = [str(PYTEST_BIN), m["test"], "-q"]
        proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
        exit_code = proc.returncode
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
    finally:
        # Restore original bytes from backup
        if backup_path.exists():
            filepath.write_bytes(backup_path.read_bytes())
            backup_path.unlink()
        else:
            filepath.write_bytes(orig_bytes)

    # Verify restoration
    restored_bytes = filepath.read_bytes()
    restored_ok = (restored_bytes == orig_bytes)

    # Mutant is KILLED if test fails (exit_code != 0)
    killed = (exit_code != 0)
    status = "KILLED" if killed else "SURVIVED"

    return {
        "id": m["id"],
        "name": m["name"],
        "status": status,
        "exit_code": exit_code,
        "restored_ok": restored_ok,
        "output_summary": (stdout.splitlines()[-1] if stdout else (stderr.splitlines()[-1] if stderr else "")),
    }


def main():
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

    for m in MUTANTS:
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
    print(f"MUTATION TESTING SUMMARY: {killed_count}/{len(MUTANTS)} mutants KILLED")
    for r in results:
        print(f"  [{r['id']}] {r['status']}: {r['name']} | test summary: {r['output_summary']}")
    print("=" * 70)

    if not all_killed:
        sys.exit(1)


if __name__ == "__main__":
    main()
