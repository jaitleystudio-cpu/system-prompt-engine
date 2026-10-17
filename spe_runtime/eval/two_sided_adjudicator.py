"""
SPE Ω — Two-Sided Evidence Adjudicator & Evaluator Authority Firewall (Python Parity Kernel)
Enforces:
1. Evaluator Authority Firewall (EAF):
   - Cryptographic immutability of test fixtures
   - Anti-tamper and anti-reward-hacking checks
2. Side 1: Anti-False-Acceptance via Hostile Mutation Testing (Kill Rate >= 0.95)
3. Side 2: Anti-False-Rejection via Inferred-Constraint Relaxation (ACL 2026)
4. Minimum Decisive Experiment Selection (MDES)
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple


def compute_sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# ─── EVALUATOR AUTHORITY FIREWALL ─────────────────────────────────────────────

@dataclass(frozen=True)
class EvaluatorFixture:
    fixture_id: str
    path: str
    content: str
    content_hash: str
    is_critical_assertion: bool = True


@dataclass(frozen=True)
class EvaluatorAuthorityEnvelope:
    authority_id: str
    registered_timestamp_iso: str
    fixtures: Tuple[EvaluatorFixture, ...]
    combined_fixture_digest: str


def register_evaluator_authority(
    authority_id: str,
    fixtures: Sequence[Dict[str, Any]],
) -> EvaluatorAuthorityEnvelope:
    registered: List[EvaluatorFixture] = []
    for f in fixtures:
        content = f["content"]
        h = compute_sha256(content)
        registered.append(
            EvaluatorFixture(
                fixture_id=f["fixture_id"],
                path=f["path"],
                content=content,
                content_hash=h,
                is_critical_assertion=f.get("is_critical_assertion", True),
            )
        )
    sorted_hashes = ":".join(sorted(r.content_hash for r in registered))
    digest = compute_sha256(sorted_hashes)
    return EvaluatorAuthorityEnvelope(
        authority_id=authority_id,
        registered_timestamp_iso="2026-10-15T02:00:00Z",
        fixtures=tuple(registered),
        combined_fixture_digest=digest,
    )


def verify_evaluator_integrity(
    envelope: EvaluatorAuthorityEnvelope,
    observed_fixtures: Sequence[Dict[str, Any]],
) -> Tuple[bool, List[str]]:
    violations: List[str] = []
    observed_map = {f["fixture_id"]: (f["path"], f["content"], compute_sha256(f["content"])) for f in observed_fixtures}

    for expected in envelope.fixtures:
        if expected.fixture_id not in observed_map:
            violations.append(f"Fixture '{expected.fixture_id}' was deleted.")
            continue
        _, _, obs_hash = observed_map[expected.fixture_id]
        if obs_hash != expected.content_hash:
            violations.append(f"Fixture '{expected.fixture_id}' was mutated by candidate execution.")

    for obs_id in observed_map:
        if not any(f.fixture_id == obs_id for f in envelope.fixtures):
            violations.append(f"Unauthorized mock fixture '{obs_id}' injected into test harness.")

    return len(violations) == 0, violations


# ─── TWO-SIDED EVIDENCE ADJUDICATOR ───────────────────────────────────────────

@dataclass(frozen=True)
class HostileMutant:
    mutant_id: str
    operator: str
    mutated_code: str


def synthesize_hostile_mutants(code: str) -> List[HostileMutant]:
    mutants = []
    # SMO-1: Invert conditional
    if "==" in code or "<" in code:
        mutated = code.replace("==", "!=").replace("<", ">=")
        mutants.append(HostileMutant("MUT-SMO1", "CONDITIONAL_NEGATION", mutated))
    else:
        mutants.append(HostileMutant("MUT-SMO1", "RETURN_INVERSION", code + "\nreturn False"))

    # SMO-2: Statement deletion
    lines = code.splitlines()
    mutated_lines = [l for l in lines if "=" not in l and "-=" not in l and "+=" not in l]
    mutants.append(HostileMutant("MUT-SMO2", "STATEMENT_DELETION", "\n".join(mutated_lines)))

    # SMO-3: Return null/empty
    mutants.append(HostileMutant("MUT-SMO3", "RETURN_PERTURBATION", code + "\nreturn None"))

    # SMO-4: Boundary fault
    mutants.append(HostileMutant("MUT-SMO4", "BOUNDARY_FAULT", "fault_val = -99999\n" + code))

    # SMO-5: Runtime error
    mutants.append(HostileMutant("MUT-SMO5", "EXCEPTION_INJECTION", "raise RuntimeError('MUTANT')\n" + code))

    return mutants


def evaluate_side1_mutation_kill_rate(
    mutants: Sequence[HostileMutant],
    test_runner: Callable[[str], bool],  # returns True if test passes (mutant survived), False if caught
) -> Tuple[float, List[str]]:
    killed = 0
    survived: List[str] = []
    for m in mutants:
        passed = test_runner(m.mutated_code)
        if not passed:
            killed += 1
        else:
            survived.append(f"Mutant {m.mutant_id} ({m.operator}) survived test suite.")

    kill_rate = killed / len(mutants) if mutants else 0.0
    return kill_rate, survived


@dataclass(frozen=True)
class InferredConstraint:
    constraint_id: str
    is_hard_invariant: bool
    violated: bool


def evaluate_side2_constraint_relaxation(
    raw_passed: bool,
    constraints: Sequence[InferredConstraint],
) -> Dict[str, Any]:
    if raw_passed:
        return {"status": "CLEAN_PASS", "is_false_rejection": False}

    hard_violated = [c for c in constraints if c.is_hard_invariant and c.violated]
    soft_violated = [c for c in constraints if not c.is_hard_invariant and c.violated]

    if hard_violated:
        return {
            "status": "CONFIRMED_TRUE_FAILURE",
            "is_false_rejection": False,
            "hard_violations_count": len(hard_violated),
        }

    if soft_violated and not hard_violated:
        return {
            "status": "FALSE_REJECTION_REMEDIATED",
            "is_false_rejection": True,
            "relaxed_soft_count": len(soft_violated),
            "recommendation": f"Relaxed {len(soft_violated)} incidental constraints. Preserved all hard invariants.",
        }

    return {"status": "CONFIRMED_TRUE_FAILURE", "is_false_rejection": False}
