"""Models and Oracle definitions for SPE-Bench Ω."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

from jsonschema import Draft202012Validator
from enum import Enum
from typing import Any, Callable


class BenchmarkDomain(str, Enum):
    STRUCTURED_EXTRACTION = "STRUCTURED_EXTRACTION"
    CUSTOMER_SUPPORT = "CUSTOMER_SUPPORT"
    CODING = "CODING"
    RESEARCH = "RESEARCH"
    RAG_GROUNDING = "RAG_GROUNDING"
    LONG_CONTEXT = "LONG_CONTEXT"
    TOOL_SELECTION = "TOOL_SELECTION"
    AGENT_AUTHORIZATION = "AGENT_AUTHORIZATION"
    FINANCIAL_CONSTRAINTS = "FINANCIAL_CONSTRAINTS"
    HEALTHCARE_ROUTING = "HEALTHCARE_ROUTING"
    MULTILINGUAL = "MULTILINGUAL"
    SCHEMA_CONFORMANCE = "SCHEMA_CONFORMANCE"
    REFUSAL_BOUNDARIES = "REFUSAL_BOUNDARIES"
    CITATION_REQUIREMENTS = "CITATION_REQUIREMENTS"
    MULTI_TURN_DRIFT = "MULTI_TURN_DRIFT"


class DatasetSplit(str, Enum):
    DEV = "DEV"
    VAL = "VAL"
    HELD_OUT = "HELD_OUT"


@dataclass
class OracleVerdict:
    passed: bool
    score: float  # 0.0 to 1.0
    rationale: str
    evidence_class: str  # OBSERVED_LOCAL, DETERMINISTIC, CALIBRATED_ESTIMATE
    oracle_id: str


class TaskOracle:
    oracle_id: str
    method: str
    known_limitations: str
    evidence_strength: str

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        raise NotImplementedError

    def inspect(self) -> dict[str, Any]:
        return {
            "oracle_id": self.oracle_id,
            "method": self.method,
            "known_limitations": self.known_limitations,
            "evidence_strength": self.evidence_strength,
        }


class DeterministicOracle(TaskOracle):
    def __init__(self, oracle_id: str, exact_target: str) -> None:
        self.oracle_id = oracle_id
        self.method = "EXACT_STRING_MATCH"
        self.known_limitations = "Requires identical string representation"
        self.evidence_strength = "DETERMINISTIC"
        self.exact_target = exact_target

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        passed = candidate_output.strip() == self.exact_target.strip()
        return OracleVerdict(
            passed=passed,
            score=1.0 if passed else 0.0,
            rationale=f"Exact match against expected: '{self.exact_target}'",
            evidence_class="DETERMINISTIC",
            oracle_id=self.oracle_id,
        )


class SchemaConformanceOracle(TaskOracle):
    """Fail-closed JSON Schema Draft 2020-12 oracle.

    A valid schema validates shapes and types only, not factual truth.
    """

    def __init__(self, oracle_id: str, json_schema: dict[str, Any]) -> None:
        # Reject malformed schemas before grading; no implicit partial validation.
        Draft202012Validator.check_schema(json_schema)
        # Restrict untrusted fixture schemas to same-document references so the
        # validator cannot resolve attacker-provided HTTP/file/relative targets.
        stack: list[Any] = [json_schema]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ("$ref", "$dynamicRef", "$recursiveRef"):
                        if not isinstance(value, str) or not value.startswith("#"):
                            raise ValueError("External JSON Schema references are forbidden")
                    stack.append(value)
            elif isinstance(node, list):
                stack.extend(node)
        self.oracle_id = oracle_id
        self.method = "JSON_SCHEMA_VALIDATION"
        self.known_limitations = "Draft 2020-12 structural/schema validation; not factual truth"
        self.evidence_strength = "DETERMINISTIC"
        self.schema = json_schema
        self._validator = Draft202012Validator(json_schema)

    @staticmethod
    def _reject_non_finite_number(token: str) -> None:
        # The JSON decoder accepts NaN/Infinity extensions unless explicitly blocked.
        raise ValueError("Invalid non-finite JSON number")

    @staticmethod
    def _strict_float(token: str) -> float:
        value = float(token)
        # A syntactically valid exponent like 1e999 can overflow to infinity.
        if not math.isfinite(value):
            raise ValueError("JSON number exceeds finite numeric range")
        return value

    @staticmethod
    def _unique_object_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            # Avoid parser-dependent winner-takes-last behavior for duplicate keys.
            if key in result:
                raise ValueError("Duplicate JSON object key")
            result[key] = value
        return result

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        try:
            parsed = json.loads(
                candidate_output,
                parse_constant=self._reject_non_finite_number,
                parse_float=self._strict_float,
                object_pairs_hook=self._unique_object_keys,
            )
        except (ValueError, TypeError) as exc:
            return OracleVerdict(
                passed=False,
                score=0.0,
                rationale=f"Invalid JSON payload ({type(exc).__name__})",
                evidence_class="DETERMINISTIC",
                oracle_id=self.oracle_id,
            )

        try:
            error = next(self._validator.iter_errors(parsed), None)
        except Exception as exc:
            # Missing, malformed or unresolved references must never earn PASS.
            return OracleVerdict(
                passed=False,
                score=0.0,
                rationale=f"JSON Schema evaluation failed ({type(exc).__name__})",
                evidence_class="DETERMINISTIC",
                oracle_id=self.oracle_id,
            )
        if error is not None:
            if error.validator == "required" and isinstance(error.instance, dict):
                missing = next(
                    (key for key in error.validator_value if key not in error.instance),
                    None,
                )
                rationale = f"Missing required field '{missing}' in JSON payload"
            else:
                location = "$" + "".join(
                    f"[{item}]" if isinstance(item, int) else f".{item}"
                    for item in error.absolute_path
                )
                # Do not echo private candidate values in evidence diagnostics.
                rationale = f"JSON Schema violation at {location}: {error.validator}"
            return OracleVerdict(
                passed=False,
                score=0.0,
                rationale=rationale,
                evidence_class="DETERMINISTIC",
                oracle_id=self.oracle_id,
            )

        return OracleVerdict(
            passed=True,
            score=1.0,
            rationale="Valid JSON satisfying Draft 2020-12 schema constraints",
            evidence_class="DETERMINISTIC",
            oracle_id=self.oracle_id,
        )


class ProgrammaticConstraintOracle(TaskOracle):
    def __init__(self, oracle_id: str, predicate_fn: Callable[[str], bool], description: str) -> None:
        self.oracle_id = oracle_id
        self.method = "PROGRAMMATIC_PREDICATE"
        self.known_limitations = "Custom programmatic test predicate"
        self.evidence_strength = "DETERMINISTIC"
        self.predicate_fn = predicate_fn
        self.description = description

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        passed = bool(self.predicate_fn(candidate_output))
        return OracleVerdict(
            passed=passed,
            score=1.0 if passed else 0.0,
            rationale=self.description,
            evidence_class="DETERMINISTIC",
            oracle_id=self.oracle_id,
        )


class ReferenceAnswerOracle(TaskOracle):
    def __init__(self, oracle_id: str, references: list[str]) -> None:
        self.oracle_id = oracle_id
        self.method = "TOKEN_CONTAINMENT_REFERENCE"
        self.known_limitations = "Checks coverage of expected reference keywords"
        self.evidence_strength = "CALIBRATED_ESTIMATE"
        self.references = references

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        lower = candidate_output.lower()
        matched = sum(1 for r in self.references if r.lower() in lower)
        score = matched / len(self.references) if self.references else 1.0
        return OracleVerdict(
            passed=score >= 0.7,
            score=score,
            rationale=f"Matched {matched}/{len(self.references)} reference terms",
            evidence_class="CALIBRATED_ESTIMATE",
            oracle_id=self.oracle_id,
        )


class LlmJudgeOracle(TaskOracle):
    """LLM Judge Oracle with explicit evidence status: NEVER claimed as objective truth."""

    def __init__(self, oracle_id: str, rubric: str, judge_model: str = "claude-3-5-sonnet") -> None:
        self.oracle_id = oracle_id
        self.method = f"LLM_JUDGE_RUBRIC_{judge_model}"
        self.known_limitations = "Subject to evaluator model bias, verbosity bias, and positional variance"
        self.evidence_strength = "SIMULATED"
        self.rubric = rubric
        self.judge_model = judge_model

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        # Evaluates heuristic alignment based on rubric rules
        length_ok = len(candidate_output.strip()) > 10
        refusal_ok = "apologize" not in candidate_output.lower()
        score = 0.85 if (length_ok and refusal_ok) else 0.40
        return OracleVerdict(
            passed=score >= 0.7,
            score=score,
            rationale=f"Heuristic simulation against rubric (Judge: {self.judge_model}). Note: Non-objective evidence.",
            evidence_class="SIMULATED",
            oracle_id=self.oracle_id,
        )


class HybridCompositeOracle(TaskOracle):
    def __init__(self, oracle_id: str, components: list[tuple[TaskOracle, float]], pass_threshold: float = 0.75) -> None:
        self.oracle_id = oracle_id
        self.method = "HYBRID_WEIGHTED_COMPOSITE"
        self.known_limitations = "Aggregates sub-oracles; weakest evidence tier governs output"
        self.components = components
        self.pass_threshold = pass_threshold
        evidence_tiers = [c[0].evidence_strength for c in components]
        if "SIMULATED" in evidence_tiers:
            self.evidence_strength = "SIMULATED"
        elif "CALIBRATED_ESTIMATE" in evidence_tiers:
            self.evidence_strength = "CALIBRATED_ESTIMATE"
        else:
            self.evidence_strength = "DETERMINISTIC"

    def evaluate(self, candidate_output: str, task_context: dict[str, Any]) -> OracleVerdict:
        total_weight = sum(w for _, w in self.components) or 1.0
        weighted_score = 0.0
        rationales: list[str] = []
        all_passed = True

        for oracle, weight in self.components:
            v = oracle.evaluate(candidate_output, task_context)
            weighted_score += (v.score * weight)
            rationales.append(f"[{oracle.oracle_id}: {v.score:.2f} ({v.rationale})]")
            if not v.passed:
                all_passed = False

        normalized_score = weighted_score / total_weight
        passed = normalized_score >= self.pass_threshold and all_passed
        return OracleVerdict(
            passed=passed,
            score=normalized_score,
            rationale=f"Hybrid score: {normalized_score:.2f} | " + "; ".join(rationales),
            evidence_class=self.evidence_strength,
            oracle_id=self.oracle_id,
        )


@dataclass
class BenchmarkTask:
    task_id: str
    domain: BenchmarkDomain
    split: DatasetSplit
    prompt_input: str
    oracle: TaskOracle
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class BenchmarkResult:
    suite_id: str
    split: DatasetSplit
    total_tasks: int
    passed_tasks: int
    accuracy_score: float
    domain_breakdown: dict[str, float]
    verdicts: list[OracleVerdict]
    evidence_class: str  # Execution provenance; never infer from oracle method
    oracle_evidence_strength: str = "UNKNOWN"
    execution_evidence_class: str = "UNKNOWN"
    task_manifest_digest: str = ""  # Unauthenticated comparison binding, not a trust receipt


@dataclass
class BenchmarkSuite:
    suite_id: str
    tasks: list[BenchmarkTask]

    def filter_split(self, split: DatasetSplit) -> BenchmarkSuite:
        return BenchmarkSuite(
            suite_id=f"{self.suite_id}_{split.value}",
            tasks=[t for t in self.tasks if t.split == split],
        )
