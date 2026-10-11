"""
SPE Ω — REC-0 CLI Runner.

Supports both human-readable 7-view summary output and deterministic `--json` output.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile
from typing import Optional, Sequence

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_owner_validator_attestation,
)
from spe_runtime.research.rec.experiment import REC0ExperimentRunner
from spe_runtime.research.rec.explain import explain_rec0_audit_and_ux


def run_rec0_cli(argv: Optional[Sequence[str]] = None) -> str:
    parser = argparse.ArgumentParser(
        prog="spe-rec0",
        description="SPE Ω — Reliability Envelope Compiler (REC-0) Qualification & 7-View UX CLI",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit deterministic JSON audit & 7-view UX payload",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    with tempfile.TemporaryDirectory() as tmp_dir:
        LearningValidator.clear_owner_registries()
        tombstone_path = Path(tmp_dir) / "rec0_cli_tombstones.jsonl"
        LearningValidator.set_tombstone_store_path(tombstone_path)

        owner_sk, owner_pk = generate_keypair()
        val_sk, val_pk = generate_keypair()
        oracle_sk, oracle_pk = generate_keypair()

        LearningValidator.register_owner_root_key(owner_pk)
        owner_att = create_owner_validator_attestation(
            owner_signing_key=owner_sk,
            owner_public_key=owner_pk,
            validator_public_key=val_pk,
        )
        validator = LearningValidator(
            default_signing_key=val_sk,
            default_public_key=val_pk,
            trusted_oracles={"oracle-rec0-independent": oracle_pk.hex()},
            owner_root_public_key=owner_pk,
            owner_attestation=owner_att,
            require_cryptographic_owner_authority=True,
        )

        runner = REC0ExperimentRunner(
            validator=validator,
            oracle_signing_key=oracle_sk,
            oracle_public_key=oracle_pk,
        )
        report = runner.run_full_experiment()
        ux_payload = explain_rec0_audit_and_ux(report)
        LearningValidator.set_tombstone_store_path(None)
        LearningValidator.clear_owner_registries()

    if args.json:
        return json.dumps(ux_payload, indent=2, sort_keys=True)
    return ux_payload["formatted_report"]


if __name__ == "__main__":
    print(run_rec0_cli())
