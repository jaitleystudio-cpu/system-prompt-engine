"""Adversarial Counterfactual Mutator for Property-Based Capability Stress Testing."""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from spe_runtime.capabilities.capsule import CapabilityCapsule
from spe_runtime.capabilities.sandbox import CapabilitySandbox, ExecutionResult


class MutationKind(str, Enum):
    BOUNDARY = "BOUNDARY"
    STRUCTURAL = "STRUCTURAL"
    TAINT = "TAINT"
    NULLABILITY = "NULLABILITY"


@dataclass(frozen=True)
class MutatedFixture:
    fixture_id: str
    kind: MutationKind
    payload: Dict[str, Any]
    mutation_description: str


@dataclass(frozen=True)
class MutationTrialResult:
    fixture: MutatedFixture
    sandbox_success: bool
    output: Any
    error: Optional[str]
    overfit_exposed: bool
    latency_ms: float


@dataclass(frozen=True)
class MutatorStressReport:
    total_mutations: int
    passed_count: int
    vulnerabilities_exposed: int
    results: List[MutationTrialResult]
    is_robust: bool


class CounterfactualMutator:
    """Generates adversarial mutations from base fixtures to challenge candidate capability capsules."""

    BOUNDARY_VALUES = [0, -1, 1, 2147483647, -2147483648, 1e9, "", " ", "   \n\t  "]
    TAINT_STRINGS = [
        "__proto__",
        "constructor",
        "../../etc/passwd",
        "<script>alert(1)</script>",
        "\x00\xff\xfe",
        "🚀💥🔥",
        "' OR '1'='1",
        "${7*7}",
        "__class__",
    ]

    @classmethod
    def mutate(cls, base: Dict[str, Any], seed: int = 42) -> List[MutatedFixture]:
        """Generate a deterministic suite of adversarial counterfactual fixtures."""
        rng = random.Random(seed)
        fixtures: List[MutatedFixture] = []
        keys = list(base.keys())

        if not keys:
            # Empty dict boundary
            fixtures.append(
                MutatedFixture(
                    fixture_id="mut_empty_boundary",
                    kind=MutationKind.BOUNDARY,
                    payload={"__empty": True},
                    mutation_description="Tested empty fixture injection",
                )
            )
            return fixtures

        # 1. Nullability mutations: set each key to None
        for i, key in enumerate(keys):
            p = copy.deepcopy(base)
            p[key] = None
            fixtures.append(
                MutatedFixture(
                    fixture_id=f"mut_null_{i}_{key}",
                    kind=MutationKind.NULLABILITY,
                    payload=p,
                    mutation_description=f"Injected None into key '{key}'",
                )
            )

        # 2. Boundary mutations: inject boundary values into boolean, string, container, or numeric keys
        for i, key in enumerate(keys):
            val = base[key]
            p = copy.deepcopy(base)
            if isinstance(val, bool):
                p[key] = not val
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_bool_flip_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p,
                        mutation_description=f"Inverted boolean boundary on '{key}'",
                    )
                )
            elif isinstance(val, (int, float)):
                p[key] = -val if val != 0 else -1
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_num_inv_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p,
                        mutation_description=f"Inverted numeric boundary on '{key}'",
                    )
                )
                p2 = copy.deepcopy(base)
                p2[key] = 0
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_num_zero_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p2,
                        mutation_description=f"Set numeric zero boundary on '{key}'",
                    )
                )
                p3 = copy.deepcopy(base)
                p3[key] = 2147483647
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_num_max_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p3,
                        mutation_description=f"Set max 32-bit integer on '{key}'",
                    )
                )
            elif isinstance(val, str):
                p = copy.deepcopy(base)
                p[key] = ""
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_str_empty_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p,
                        mutation_description=f"Emptied string on '{key}'",
                    )
                )
                p_ws = copy.deepcopy(base)
                p_ws[key] = "   \n\t  "
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_str_ws_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p_ws,
                        mutation_description=f"Whitespace-only string on '{key}'",
                    )
                )
            elif isinstance(val, list):
                p = copy.deepcopy(base)
                p[key] = []
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_list_empty_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p,
                        mutation_description=f"Emptied list on '{key}'",
                    )
                )
            elif isinstance(val, dict):
                p = copy.deepcopy(base)
                p[key] = {}
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_bound_dict_empty_{i}_{key}",
                        kind=MutationKind.BOUNDARY,
                        payload=p,
                        mutation_description=f"Emptied dict on '{key}'",
                    )
                )

        # 3. Taint injection: inject security/boundary payloads
        for i, key in enumerate(keys):
            if isinstance(base[key], str):
                p = copy.deepcopy(base)
                p[key] = rng.choice(cls.TAINT_STRINGS)
                fixtures.append(
                    MutatedFixture(
                        fixture_id=f"mut_taint_{i}_{key}",
                        kind=MutationKind.TAINT,
                        payload=p,
                        mutation_description=f"Injected adversarial taint token into '{key}'",
                    )
                )

        # 4. Structural mutation: remove required key entirely
        for i, key in enumerate(keys):
            p = copy.deepcopy(base)
            del p[key]
            fixtures.append(
                MutatedFixture(
                    fixture_id=f"mut_struct_missing_{i}_{key}",
                    kind=MutationKind.STRUCTURAL,
                    payload=p,
                    mutation_description=f"Omitted required property '{key}'",
                )
            )

        # 5. Structural mutation: type mutation
        for i, key in enumerate(keys):
            val = base[key]
            p = copy.deepcopy(base)
            if isinstance(val, bool):
                p[key] = "not_a_boolean"
            elif isinstance(val, str):
                p[key] = 12345
            elif isinstance(val, (int, float)):
                p[key] = "not_a_number"
            elif isinstance(val, list):
                p[key] = {"unexpected": "object"}
            elif isinstance(val, dict):
                p[key] = ["unexpected", "array"]
            else:
                p[key] = None

            fixtures.append(
                MutatedFixture(
                    fixture_id=f"mut_struct_type_{i}_{key}",
                    kind=MutationKind.STRUCTURAL,
                    payload=p,
                    mutation_description=f"Inverted property type on '{key}'",
                )
            )

        return fixtures

    @classmethod
    def stress_test(
        cls,
        capsule: CapabilityCapsule,
        base_fixture: Dict[str, Any],
        seed: int = 42,
        max_duration_ms: float = 500.0,
    ) -> MutatorStressReport:
        """Run property-based adversarial mutations against a candidate capability capsule."""
        mutated_fixtures = cls.mutate(base_fixture, seed=seed)
        trial_results: List[MutationTrialResult] = []

        unhandled_error_indicators = (
            "KeyError",
            "TypeError",
            "AttributeError",
            "ZeroDivisionError",
            "IndexError",
            "ValueError",
            "UnboundLocalError",
        )

        for fix in mutated_fixtures:
            res: ExecutionResult = CapabilitySandbox.execute_capsule(
                capsule,
                fix.payload,
                max_duration_ms=max_duration_ms,
            )

            # Determine whether the mutation exposed an overfit flaw:
            # If the procedure crashed with an unhandled exception or timed out, overfit is exposed.
            overfit_exposed = not res.success

            trial_results.append(
                MutationTrialResult(
                    fixture=fix,
                    sandbox_success=res.success,
                    output=res.output,
                    error=res.error,
                    overfit_exposed=overfit_exposed,
                    latency_ms=res.latency_ms,
                )
            )

        vulnerabilities = sum(1 for r in trial_results if r.overfit_exposed)
        passed = len(trial_results) - vulnerabilities

        return MutatorStressReport(
            total_mutations=len(trial_results),
            passed_count=passed,
            vulnerabilities_exposed=vulnerabilities,
            results=trial_results,
            is_robust=(vulnerabilities == 0),
        )
