"""
SPE Ω — RBPD Command-Line Audit & Explanation Interface.

Usage:
    python -m spe_runtime.research.rbpd.cli [--json]
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Sequence

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_owner_validator_attestation,
)
from spe_runtime.research.rbpd.dividend_benchmark import (
    PortabilityVerifier,
    ProofDividendBenchmark,
)
from spe_runtime.research.rbpd.explain import explain_proof_dividend


def run_rbpd_cli(argv: Sequence[str] | None = None) -> str:
    parser = argparse.ArgumentParser(
        description="SPE Ω — Reality-Bound Proof Dividend (RBPD) CLI Audit Runner"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON explanation instead of human-readable text",
    )
    parser.add_argument(
        "--modules",
        type=int,
        default=20,
        help="Number of modular obligations in benchmark graph (default: 20)",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=6,
        help="Number of incremental edit steps (default: 6)",
    )
    args = parser.parse_args(list(argv) if argv is not None else [])

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
        trusted_oracles={"oracle-rbpd-01": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=owner_att,
        require_cryptographic_owner_authority=True,
    )

    benchmark = ProofDividendBenchmark(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )
    verifier = PortabilityVerifier(
        validator=validator,
        oracle_signing_key=oracle_sk,
        oracle_public_key=oracle_pk,
    )

    bench_report = benchmark.run_lifecycle_comparison(
        num_modules=args.modules,
        num_incremental_steps=args.steps,
    )
    neg_report = benchmark.run_negative_control_benchmark(num_modules=args.modules)
    port_report = verifier.verify_cross_runtime_conformance(max_cases_per_kind=1)

    explanation = explain_proof_dividend(
        benchmark_report=bench_report,
        negative_control_report=neg_report,
        portability_report=port_report,
    )
    if args.json:
        return json.dumps(explanation, indent=2)
    return explanation["human_text"]


def main() -> None:
    out = run_rbpd_cli(sys.argv[1:])
    print(out)


if __name__ == "__main__":
    main()
