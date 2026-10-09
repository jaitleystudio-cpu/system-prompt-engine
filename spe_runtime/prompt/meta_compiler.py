"""
SPE Ω — Autonomous Meta-Prompt Compiler & Zero-Drift Execution Subsystem.
Transforms raw informal user prompts into domain-specialized Master Execution Plans,
enforces zero semantic drift via ZeroDriftSentry, and verifies 100% completion
against Kleene 3-valued verification obligations before issuing cryptographic receipts.
"""

from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping, Optional, Sequence, Union

from spe_runtime.ci_gate.receipt import (
    AuthenticatedReceipt,
    ed25519_sign,
    ed25519_verify,
    generate_keypair,
    rfc8785_canonicalize,
    verify_receipt_signature,
)
from spe_runtime.research.wdes.types import (
    NanoUSD,
    NetworkPolicy,
    PredicateValue,
    VerificationVerdict,
    validate_nanos,
)


# ==============================================================================
# I. CORE DATA STRUCTURES & VALUE OBJECTS
# ==============================================================================

@dataclass(frozen=True)
class ProtectedIntent:
    """The inviolable human objective and constraints (frozen, immutable)."""
    raw_prompt: str
    objective: str
    invariants: tuple[str, ...]
    forbidden_actions: tuple[str, ...]
    domain: str
    budget_nanos: NanoUSD = 0
    network_policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED
    intent_digest: str = ""

    def __post_init__(self) -> None:
        validate_nanos(self.budget_nanos, "budget_nanos")
        object.__setattr__(self, "invariants", tuple(self.invariants))
        object.__setattr__(self, "forbidden_actions", tuple(self.forbidden_actions))
        payload = {
            "budget_nanos": self.budget_nanos,
            "domain": self.domain,
            "forbidden_actions": list(self.forbidden_actions),
            "invariants": list(self.invariants),
            "network_policy": self.network_policy.value,
            "objective": self.objective,
            "raw_prompt": self.raw_prompt,
        }
        computed_digest = hashlib.sha256(rfc8785_canonicalize(payload)).hexdigest()
        if self.intent_digest and self.intent_digest != computed_digest:
            raise ValueError(f"Mismatched intent_digest: expected {computed_digest}, got {self.intent_digest}")
        object.__setattr__(self, "intent_digest", computed_digest)


@dataclass(frozen=True)
class GeneratedMasterSystemPrompt:
    """An elite, domain-specialized system prompt loaded with exact axioms and rules."""
    prompt_text: str
    domain: str
    axioms: tuple[str, ...]
    output_constraints: tuple[str, ...]
    error_protocols: tuple[str, ...]
    verification_rules: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "axioms", tuple(self.axioms))
        object.__setattr__(self, "output_constraints", tuple(self.output_constraints))
        object.__setattr__(self, "error_protocols", tuple(self.error_protocols))
        object.__setattr__(self, "verification_rules", tuple(self.verification_rules))

    def __str__(self) -> str:
        return self.prompt_text

    @property
    def content(self) -> str:
        return self.prompt_text


@dataclass(frozen=True)
class Obligation:
    """A mandatory invariant that must be proven TRUE before completion can be reported."""
    obligation_id: str
    description: str
    predicate_target: str
    is_safety_critical: bool = True
    witness_type: str = "empirical_test"


@dataclass(frozen=True)
class ObligationSet:
    """The list of mandatory invariants that must be proven TRUE."""
    obligations: tuple[Obligation, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "obligations", tuple(self.obligations))
        seen: set[str] = set()
        for ob in self.obligations:
            if not isinstance(ob, Obligation):
                raise TypeError(f"ObligationSet items must be Obligation, got {type(ob)}")
            if ob.obligation_id in seen:
                raise ValueError(f"Duplicate obligation ID in ObligationSet: {ob.obligation_id}")
            seen.add(ob.obligation_id)

    @property
    def ids(self) -> tuple[str, ...]:
        return tuple(ob.obligation_id for ob in self.obligations)

    def get(self, obligation_id: str) -> Optional[Obligation]:
        for ob in self.obligations:
            if ob.obligation_id == obligation_id:
                return ob
        return None

    def __getitem__(self, key: Union[int, str]) -> Obligation:
        if isinstance(key, int):
            return self.obligations[key]
        if isinstance(key, str):
            ob = self.get(key)
            if ob is None:
                raise KeyError(f"Obligation '{key}' not found in ObligationSet")
            return ob
        raise TypeError(f"Invalid key type: {type(key)}")

    def __iter__(self):
        return iter(self.obligations)

    def __len__(self) -> int:
        return len(self.obligations)

    def __contains__(self, item: Union[str, Obligation]) -> bool:
        if isinstance(item, str):
            return any(ob.obligation_id == item for ob in self.obligations)
        if isinstance(item, Obligation):
            return item in self.obligations
        return False


@dataclass(frozen=True)
class AdmissibleTools:
    """The minimal tool envelope permitted for this task."""
    allowed_tools: tuple[str, ...]
    network_egress_allowed: bool = False
    file_write_paths: tuple[str, ...] = ()
    max_cost_nanos: NanoUSD = 0
    disallowed_tools: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        validate_nanos(self.max_cost_nanos, "max_cost_nanos")
        object.__setattr__(self, "allowed_tools", tuple(self.allowed_tools))
        object.__setattr__(self, "file_write_paths", tuple(self.file_write_paths))
        object.__setattr__(self, "disallowed_tools", tuple(self.disallowed_tools))


@dataclass(frozen=True)
class MasterExecutionPlan:
    """The fully synthesized zero-drift execution plan for an agent."""
    protected_intent: ProtectedIntent
    master_system_prompt: GeneratedMasterSystemPrompt
    obligations: ObligationSet
    admissible_tools: AdmissibleTools
    created_at_utc: str
    plan_digest: str = ""

    def __post_init__(self) -> None:
        payload = {
            "admissible_tools": {
                "allowed_tools": list(self.admissible_tools.allowed_tools),
                "disallowed_tools": list(self.admissible_tools.disallowed_tools),
                "file_write_paths": list(self.admissible_tools.file_write_paths),
                "max_cost_nanos": self.admissible_tools.max_cost_nanos,
                "network_egress_allowed": self.admissible_tools.network_egress_allowed,
            },
            "created_at_utc": self.created_at_utc,
            "domain": self.protected_intent.domain,
            "intent_digest": self.protected_intent.intent_digest,
            "obligations": list(self.obligations.ids),
            "system_prompt_digest": hashlib.sha256(self.master_system_prompt.prompt_text.encode("utf-8")).hexdigest(),
        }
        computed_digest = hashlib.sha256(rfc8785_canonicalize(payload)).hexdigest()
        if self.plan_digest and self.plan_digest != computed_digest:
            raise ValueError(f"Mismatched plan_digest: expected {computed_digest}, got {self.plan_digest}")
        object.__setattr__(self, "plan_digest", computed_digest)

    @property
    def original_intent(self) -> ProtectedIntent:
        return self.protected_intent

    @property
    def obligation_set(self) -> ObligationSet:
        return self.obligations

    @property
    def system_prompt(self) -> GeneratedMasterSystemPrompt:
        return self.master_system_prompt


# ==============================================================================
# II. DRIFT ENUMS, VERDICTS & EXCEPTIONS
# ==============================================================================

class DriftType(str, Enum):
    """Categorization of detected semantic invariant drift."""
    SCOPE_CREEP = "SCOPE_CREEP"
    PREMATURE_SURRENDER = "PREMATURE_SURRENDER"
    INVARIANT_WEAKENING = "INVARIANT_WEAKENING"
    UNAUTHORIZED_DEPENDENCY = "UNAUTHORIZED_DEPENDENCY"
    NO_DRIFT = "NO_DRIFT"


@dataclass(frozen=True)
class DriftVerdict:
    """The formal outcome of invariant drift sentry supervision."""
    is_drift_detected: bool
    semantic_distance: float
    reasons: tuple[str, ...] = ()
    drift_type: Optional[DriftType] = None
    remediation_advice: Optional[str] = None


class SemanticDriftViolationError(ValueError):
    """Raised when an intermediate agent output violates frozen intent invariants."""
    def __init__(
        self,
        message: str,
        verdict: Optional[DriftVerdict] = None,
        violating_output: str = "",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.verdict = verdict
        self.violating_output = violating_output


class CompletionRejectedError(RuntimeError):
    """Raised when completion is refused due to unmet verification obligations."""
    def __init__(
        self,
        message: str,
        missing_witness_delta: Optional[dict[str, Any]] = None,
        unmet_obligations: tuple[str, ...] = (),
    ) -> None:
        super().__init__(message)
        self.message = message
        self.missing_witness_delta = missing_witness_delta or {}
        self.delta = self.missing_witness_delta
        self.unmet_obligations = unmet_obligations


@dataclass(frozen=True)
class CompletionCertificate:
    """Cryptographically signed proof of 100% verified task completion."""
    certificate_id: str
    plan_digest: str
    verdict: VerificationVerdict
    obligation_results: Mapping[str, PredicateValue]
    cost_nanos: NanoUSD
    signature_ed25519: str
    public_key_hex: str
    digest_sha256: str
    timestamp_utc: str
    authenticated_receipt: Optional[AuthenticatedReceipt] = None
    canonical_payload: Optional[dict[str, Any]] = None

    def __post_init__(self) -> None:
        validate_nanos(self.cost_nanos, "cost_nanos")

    @property
    def certificate_type(self) -> str:
        return "ExecutionPlacementCertificate"

    def to_dict(self) -> dict[str, Any]:
        return {
            "certificate_id": self.certificate_id,
            "certificate_type": self.certificate_type,
            "cost_nanos": self.cost_nanos,
            "digest_sha256": self.digest_sha256,
            "obligation_results": {k: (v.name if isinstance(v, PredicateValue) else str(v)) for k, v in self.obligation_results.items()},
            "plan_digest": self.plan_digest,
            "public_key_hex": self.public_key_hex,
            "signature_ed25519": self.signature_ed25519,
            "timestamp_utc": self.timestamp_utc,
            "verdict": self.verdict.value,
        }

    def verify(self) -> bool:
        """Verifies Ed25519 signature against digest, canonical payload, and object fields."""
        try:
            # 1. Attribute consistency check against signed canonical payload
            if self.canonical_payload is not None:
                if self.canonical_payload.get("certificate_id") != self.certificate_id:
                    return False
                if self.canonical_payload.get("plan_digest") != self.plan_digest:
                    return False
                if self.canonical_payload.get("cost_nanos") != self.cost_nanos:
                    return False
                if self.canonical_payload.get("verdict") != self.verdict.value:
                    return False

                payload_obs = self.canonical_payload.get("obligations", {})
                for ob_id, res in self.obligation_results.items():
                    res_val = res.name if isinstance(res, PredicateValue) else str(res)
                    if payload_obs.get(ob_id) != res_val:
                        return False

                c_bytes = rfc8785_canonicalize(self.canonical_payload)
                expected_digest = hashlib.sha256(c_bytes).hexdigest()
                if expected_digest != self.digest_sha256:
                    return False

            pk = bytes.fromhex(self.public_key_hex)
            sig = bytes.fromhex(self.signature_ed25519)
            valid_sig = ed25519_verify(pk, self.digest_sha256.encode("utf-8"), sig)
            if not valid_sig:
                return False

            if self.authenticated_receipt is not None:
                if not verify_receipt_signature(self.authenticated_receipt, self.public_key_hex):
                    return False

            return True
        except Exception:
            return False


# Alias per architectural requirements
ExecutionPlacementCertificate = CompletionCertificate


# ==============================================================================
# III. META-PROMPT SUPERCOMPILER
# ==============================================================================

class MetaPromptCompiler:
    """
    Autonomous Meta-Prompt Supercompiler.
    Transforms raw, informal user wishes into elite Master Execution Plans with
    frozen protected intent contracts and Kleene 3-valued verification obligations.
    """

    def __init__(self, default_budget_nanos: NanoUSD = 0) -> None:
        self.default_budget_nanos = validate_nanos(default_budget_nanos, "default_budget_nanos")

    def compile_raw_intent(
        self,
        raw_prompt: str,
        domain_hint: Optional[str] = None,
        budget_nanos: Optional[NanoUSD] = None,
    ) -> MasterExecutionPlan:
        """
        Analyzes raw user input and extracts:
        a) ProtectedIntent: The inviolable human objective and constraints (frozen, immutable).
        b) GeneratedMasterSystemPrompt: Elite domain-specialized prompt with axioms and rules.
        c) ObligationSet: List of mandatory invariants to be proven TRUE.
        d) AdmissibleTools: Minimal tool envelope permitted for the task.
        """
        if not raw_prompt or not raw_prompt.strip():
            raise ValueError("raw_prompt cannot be empty or whitespace")

        cleaned_prompt = raw_prompt.strip()
        assigned_budget = self.default_budget_nanos if budget_nanos is None else validate_nanos(budget_nanos, "budget_nanos")

        # 1. Domain Classification
        domain = self._classify_domain(cleaned_prompt, domain_hint)

        # 2. Extract Invariants & Objective
        objective = self._crystallize_objective(cleaned_prompt, domain)
        invariants = self._derive_invariants(cleaned_prompt, domain)
        forbidden_actions = (
            "Do not introduce unapproved external network dependencies or external endpoints",
            "Do not weaken authentication, encryption, or security invariants",
            "Do not invent unrequested scope or expand project boundaries",
            "Do not declare premature completion without empirical or formal witness proofs",
            "Do not modify or skip existing regression tests to force a pass",
        )

        protected_intent = ProtectedIntent(
            raw_prompt=cleaned_prompt,
            objective=objective,
            invariants=invariants,
            forbidden_actions=forbidden_actions,
            domain=domain,
            budget_nanos=assigned_budget,
            network_policy=NetworkPolicy.AIR_GAPPED,
        )

        # 3. Derive Formal Obligations
        obligations = self._derive_obligations(cleaned_prompt, domain)
        obligation_set = ObligationSet(obligations=obligations)

        # 4. Minimal Admissible Tools Envelope
        admissible_tools = self._derive_admissible_tools(domain)

        # 5. Synthesize Elite Master System Prompt
        master_prompt = self._synthesize_master_prompt(
            protected_intent=protected_intent,
            obligations=obligation_set,
            tools=admissible_tools,
        )

        created_at_utc = datetime.now(timezone.utc).isoformat()
        return MasterExecutionPlan(
            protected_intent=protected_intent,
            master_system_prompt=master_prompt,
            obligations=obligation_set,
            admissible_tools=admissible_tools,
            created_at_utc=created_at_utc,
        )

    def _classify_domain(self, prompt: str, hint: Optional[str]) -> str:
        if hint and hint.strip():
            h = hint.strip().lower()
            if h in ("auth", "auth_security", "security", "token", "session", "oauth", "login"):
                return "auth_security"
            if h in ("smart_contracts", "smart_contract", "solidity", "web3", "crypto", "blockchain"):
                return "smart_contracts"
            if h in ("database", "database_optimization", "db", "sql", "postgres", "mysql", "sqlite", "query"):
                return "database_optimization"
            if h in ("web", "web_frontend", "frontend", "ui", "site", "website", "three.js", "tailwind"):
                return "web_frontend"
            if h in ("architecture", "system_architecture", "microservices", "infrastructure", "distributed"):
                return "system_architecture"
            if h in ("perf", "performance", "performance_tuning", "speed", "latency", "benchmark"):
                return "performance_tuning"
            return h

        lower = prompt.lower()
        if any(w in lower for w in ("auth", "token", "jwt", "session", "credential", "password", "oauth", "login", "permission", "rbac", "secret")):
            return "auth_security"
        if any(w in lower for w in ("smart contract", "solidity", "ethereum", "web3", "reentrancy", "erc20", "erc721", "blockchain")):
            return "smart_contracts"
        if any(w in lower for w in ("database", "sql", "query", "postgres", "mysql", "sqlite", "table", "schema", "index")):
            return "database_optimization"
        if any(w in lower for w in ("site", "website", "three.js", "tailwind", "frontend", "ui", "html", "css", "react", "3d")):
            return "web_frontend"
        if any(w in lower for w in ("architecture", "microservice", "infrastructure", "distributed", "concurrency")):
            return "system_architecture"
        if any(w in lower for w in ("optimize", "fast", "speed", "latency", "benchmark", "throughput", "profile")):
            return "performance_tuning"
        return "general_software_engineering"

    def _crystallize_objective(self, prompt: str, domain: str) -> str:
        s = prompt.strip()
        if not s.endswith((".", "!", "?")):
            s += "."
        return s[0].upper() + s[1:]

    def _derive_invariants(self, prompt: str, domain: str) -> tuple[str, ...]:
        lower = prompt.lower()
        invariants: list[str] = []

        if domain == "auth_security":
            invariants.append("Preserve cryptographic authentication integrity and token validity")
            invariants.append("Prevent auth bypass, token forgery, and timing attack side channels")
        elif domain == "database_optimization":
            invariants.append("Preserve ACID transactional safety and strict data consistency")
            invariants.append("Ensure bounded query scan costs and correct index utilization")
        elif domain == "smart_contracts":
            invariants.append("Formally enforce non-reentrancy and access control constraints")
            invariants.append("Zero unhandled reverts and exact integer balance arithmetic")
        elif domain == "web_frontend":
            invariants.append("Zero visual or DOM rendering regressions across supported viewport breakpoints")
            invariants.append("Retain fluid frame rate (>= 60 FPS) and immediate interactive event dispatch")
        elif domain == "system_architecture":
            invariants.append("Preserve fault isolation boundaries and modular service contracts")
            invariants.append("Enforce deadlock-free asynchronous message coordination and state idempotency")
        elif domain == "performance_tuning":
            invariants.append("Satisfy throughput SLA and latency ceilings without computational regression")
            invariants.append("Retain algorithmic correctness and numerical stability across bounded memory budgets")
        else:
            invariants.append("Preserve all specified functional domain requirements")

        if any(w in lower for w in ("fast", "speed", "latency", "throughput", "perf", "optimize")):
            invariants.append("Satisfy latency SLA and performance throughput bounds without regression")

        invariants.append("Maintain zero regressions across existing test suite and specification invariants")
        invariants.append("Preserve offline air-gapped boundary with zero unapproved network egress")
        return tuple(invariants)

    def _derive_obligations(self, prompt: str, domain: str) -> tuple[Obligation, ...]:
        lower = prompt.lower()
        obs: list[Obligation] = []

        if domain == "auth_security":
            obs.append(
                Obligation(
                    obligation_id="ob_security",
                    description="Cryptographic token validation & authentication integrity invariant",
                    predicate_target="auth.token.is_cryptographically_secure == TRUE",
                    is_safety_critical=True,
                    witness_type="crypto_verification",
                )
            )
            if any(w in lower for w in ("fast", "speed", "latency", "throughput", "optimize")):
                obs.append(
                    Obligation(
                        obligation_id="ob_latency",
                        description="Execution latency SLA & computational throughput invariant",
                        predicate_target="execution.p99_latency_ms <= sla_budget_ms",
                        is_safety_critical=True,
                        witness_type="benchmark_witness",
                    )
                )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in existing test suite & functional contracts",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        elif domain == "database_optimization":
            obs.append(
                Obligation(
                    obligation_id="ob_query_plan",
                    description="Query execution plan utilizes bounded scan indexes",
                    predicate_target="db.query_plan.is_indexed == TRUE",
                    is_safety_critical=True,
                    witness_type="ast_explain_plan",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_data_integrity",
                    description="ACID transaction integrity and serializability preserved",
                    predicate_target="db.data_integrity.verified == TRUE",
                    is_safety_critical=True,
                    witness_type="formal_proof",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_latency",
                    description="Query execution latency within bounded budget",
                    predicate_target="db.query.latency_ms <= sla_budget_ms",
                    is_safety_critical=True,
                    witness_type="benchmark_witness",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in database queries and regression tests",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        elif domain == "smart_contracts":
            obs.append(
                Obligation(
                    obligation_id="ob_security",
                    description="Smart contract security invariants and access control verified",
                    predicate_target="contract.access_control.is_sound == TRUE",
                    is_safety_critical=True,
                    witness_type="formal_verification",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_reentrancy",
                    description="Non-reentrancy invariant formally proven across state mutations",
                    predicate_target="contract.reentrancy.immune == TRUE",
                    is_safety_critical=True,
                    witness_type="formal_verification",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in existing contract test suite",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        elif domain == "web_frontend":
            obs.append(
                Obligation(
                    obligation_id="ob_rendering",
                    description="Component renders without DOM errors and conforms to responsive design",
                    predicate_target="ui.dom_errors.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_responsiveness",
                    description="Client-side interactivity and event listeners operational",
                    predicate_target="ui.interactive_listeners.active == TRUE",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
            if any(w in lower for w in ("fast", "speed", "latency", "optimize")):
                obs.append(
                    Obligation(
                        obligation_id="ob_latency",
                        description="Frame rendering budget satisfies 60fps SLA",
                        predicate_target="ui.render_frame_ms <= 16.6",
                        is_safety_critical=True,
                        witness_type="benchmark_witness",
                    )
                )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in visual and functional frontend suites",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        elif domain == "system_architecture":
            obs.append(
                Obligation(
                    obligation_id="ob_correctness",
                    description="System components conform to formal architectural specifications",
                    predicate_target="arch.conformance == TRUE",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_fault_isolation",
                    description="Fault isolation boundaries verified across component failures",
                    predicate_target="arch.fault_isolation.verified == TRUE",
                    is_safety_critical=True,
                    witness_type="fault_injection_witness",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression across existing architectural invariants",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        elif domain == "performance_tuning":
            obs.append(
                Obligation(
                    obligation_id="ob_correctness",
                    description="Algorithmic functional correctness preserved during tuning",
                    predicate_target="algo.correctness == TRUE",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_latency",
                    description="Execution latency SLA and computational throughput invariant",
                    predicate_target="execution.p99_latency_ms <= sla_budget_ms",
                    is_safety_critical=True,
                    witness_type="benchmark_witness",
                )
            )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in system functional suite",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
        else:
            obs.append(
                Obligation(
                    obligation_id="ob_correctness",
                    description="Task functional correctness proven via unit and integration tests",
                    predicate_target="task.correctness == TRUE",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )
            if any(w in lower for w in ("fast", "speed", "latency", "throughput", "optimize")):
                obs.append(
                    Obligation(
                        obligation_id="ob_latency",
                        description="Execution latency SLA & computational throughput invariant",
                        predicate_target="execution.p99_latency_ms <= sla_budget_ms",
                        is_safety_critical=True,
                        witness_type="benchmark_witness",
                    )
                )
            if any(w in lower for w in ("security", "safe", "secure", "auth", "token")):
                obs.append(
                    Obligation(
                        obligation_id="ob_security",
                        description="Security invariant preservation and vulnerability immunity",
                        predicate_target="security.invariants_intact == TRUE",
                        is_safety_critical=True,
                        witness_type="crypto_verification",
                    )
                )
            obs.append(
                Obligation(
                    obligation_id="ob_regression",
                    description="Zero regression in existing codebase contracts",
                    predicate_target="suite.regressions.count == 0",
                    is_safety_critical=True,
                    witness_type="empirical_test",
                )
            )

        return tuple(obs)

    def _derive_admissible_tools(self, domain: str) -> AdmissibleTools:
        if domain == "auth_security":
            tools = ("read_file", "write_file", "run_test", "ast_lint", "bench_latency", "crypto_verify")
        elif domain == "database_optimization":
            tools = ("read_file", "write_file", "explain_query", "bench_query", "schema_check")
        elif domain == "smart_contracts":
            tools = ("read_file", "write_file", "slither_lint", "run_test", "formal_verify")
        elif domain == "web_frontend":
            tools = ("read_file", "write_file", "render_preview", "run_test", "bundle_analyze")
        elif domain == "system_architecture":
            tools = ("read_file", "write_file", "run_test", "ast_lint", "fault_inject")
        elif domain == "performance_tuning":
            tools = ("read_file", "write_file", "run_test", "bench_latency", "profile_mem")
        else:
            tools = ("read_file", "write_file", "run_test", "ast_lint")

        return AdmissibleTools(
            allowed_tools=tools,
            network_egress_allowed=False,
            file_write_paths=(),
            max_cost_nanos=0,
            disallowed_tools=("curl", "wget", "git_push_main", "arbitrary_egress"),
        )

    def _synthesize_master_prompt(
        self,
        protected_intent: ProtectedIntent,
        obligations: ObligationSet,
        tools: AdmissibleTools,
    ) -> GeneratedMasterSystemPrompt:
        domain = protected_intent.domain

        if domain == "auth_security":
            axioms = (
                "Axiom A1: Cryptographic tokens must be validated with constant-time equality checks to prevent timing attacks.",
                "Axiom A2: Authentication states and session tokens must never be forged, bypassed, or downgraded.",
                "Axiom A3: Token lifetime and revocation lists must be strictly enforced with zero stale-state leakage.",
                "Axiom A4: Latency optimizations must never compromise cryptographic strength or validation rigor.",
            )
        elif domain == "database_optimization":
            axioms = (
                "Axiom A1: Query execution plans must leverage appropriate indexing; full table scans in hot paths are prohibited.",
                "Axiom A2: Transactional ACID safety and serializability must never be weakened for transient throughput gains.",
                "Axiom A3: All database migrations and optimizations must remain idempotent and backward-compatible.",
            )
        elif domain == "smart_contracts":
            axioms = (
                "Axiom A1: Checks-Effects-Interactions pattern must be strictly adhered to across all external call boundaries.",
                "Axiom A2: State changes following an external call without reentrancy guards constitute a fatal violation.",
                "Axiom A3: Arithmetic overflows and underflows must be formally prevented; balance invariants must be conserved.",
            )
        elif domain == "web_frontend":
            axioms = (
                "Axiom A1: All UI components must mount with zero unhandled DOM or console exceptions across responsive viewports.",
                "Axiom A2: Frame rendering times must stay within interactive budgets (<= 16.6ms for 60 FPS).",
                "Axiom A3: Semantic markup and accessibility contracts must remain compliant without degradations.",
            )
        elif domain == "system_architecture":
            axioms = (
                "Axiom A1: Fault isolation boundaries must prevent cascading failures across services.",
                "Axiom A2: State management must be idempotent and resilient to transport partitions.",
                "Axiom A3: Asynchronous communications must preserve causal order and be deadlock-free.",
            )
        elif domain == "performance_tuning":
            axioms = (
                "Axiom A1: Latency optimizations must be backed by reproducible benchmark witness profiles.",
                "Axiom A2: Algorithmic time and space complexity bounds must be formally preserved.",
                "Axiom A3: Speed gains must not weaken validation checks, error reporting, or numerical precision.",
            )
        else:
            axioms = (
                "Axiom A1: Functional correctness must be provable via empirical test witnesses or formal derivations.",
                "Axiom A2: Zero regression rule: existing operational code paths and contracts must not degrade.",
                "Axiom A3: Code mutations must be minimal, focused, and match the surrounding conventions.",
            )

        output_constraints = (
            "Constraint C1: Exact Integer Financials: All financial and token budgets must use NanoUSD (1 USD = 1,000,000,000 nanos). Floating-point arithmetic is strictly prohibited.",
            "Constraint C2: Zero Semantic Drift: Execution must strictly conform to frozen ProtectedIntent contract P. No scope expansion, unapproved libraries, or network egress.",
            "Constraint C3: Deterministic & Offline: The system must execute 100% offline in an air-gapped environment with zero unapproved external network dependencies.",
            "Constraint C4: Immutable Invariants: Safety-critical assertions and existing tests must never be modified, disabled, or skipped to pass artificially.",
        )

        error_protocols = (
            "Protocol E1: Fail-Closed Default: Any validation error, invariant breach, or unhandled exception must immediately halt execution.",
            "Protocol E2: Diagnostic Delta Emission: Upon completion refusal, emit the exact missing evidence delta Δ detailing unproven obligations.",
            "Protocol E3: State Rollback: If semantic drift is detected, instantly abort and trigger rollback to the frozen ProtectedIntent contract P.",
        )

        verification_rules = (
            "Rule V1: Kleene 3-Valued Logic: Every obligation in ObligationSet must evaluate strictly under PredicateValue (TRUE, FALSE, UNKNOWN).",
            "Rule V2: No Premature Completion: Completion is strictly refused if ANY safety-critical obligation remains UNKNOWN or FALSE.",
            "Rule V3: Cryptographic Witness Required: Never promote UNKNOWN to TRUE without an established empirical test or formal proof witness receipt.",
            "Rule V4: Completion Certificate: A CompletionCertificate is signed and issued via Ed25519 only when 100% of obligations evaluate to TRUE.",
        )

        axioms_md = "\n".join(f"- {a}" for a in axioms)
        constraints_md = "\n".join(f"- {c}" for c in output_constraints)
        protocols_md = "\n".join(f"- {p}" for p in error_protocols)
        rules_md = "\n".join(f"- {r}" for r in verification_rules)
        invariants_md = "\n".join(f"- {inv}" for inv in protected_intent.invariants)
        forbidden_md = "\n".join(f"- {f}" for f in protected_intent.forbidden_actions)
        obligations_md = "\n".join(
            f"- [{ob.obligation_id}] {ob.description} (Target: `{ob.predicate_target}`, Witness: `{ob.witness_type}`)"
            for ob in obligations
        )
        tools_md = ", ".join(f"`{t}`" for t in tools.allowed_tools)

        full_prompt = (
            f"# SPE Ω MASTER EXECUTION PROMPT: [{domain.upper()}]\n\n"
            f"## INVIOLABLE OBJECTIVE\n"
            f"{protected_intent.objective}\n\n"
            f"## FROZEN PROTECTED INVARIANTS (P)\n"
            f"{invariants_md}\n\n"
            f"## STRICT FORBIDDEN ACTIONS\n"
            f"{forbidden_md}\n\n"
            f"## ADMISSIBLE TOOL ENVELOPE\n"
            f"Permitted tools: {tools_md}\n"
            f"Network egress: {'ALLOWED' if tools.network_egress_allowed else 'PROHIBITED (AIR-GAPPED)'}\n\n"
            f"## FORMAL DOMAIN AXIOMS\n"
            f"{axioms_md}\n\n"
            f"## STRICT OUTPUT CONSTRAINTS\n"
            f"{constraints_md}\n\n"
            f"## FAIL-CLOSED ERROR PROTOCOLS\n"
            f"{protocols_md}\n\n"
            f"## VERIFICATION OBLIGATIONS (KLEENE 3-VALUED LOGIC)\n"
            f"{obligations_md}\n\n"
            f"## VERIFICATION GOVERNANCE RULES\n"
            f"{rules_md}\n"
        )

        return GeneratedMasterSystemPrompt(
            prompt_text=full_prompt,
            domain=domain,
            axioms=axioms,
            output_constraints=output_constraints,
            error_protocols=error_protocols,
            verification_rules=verification_rules,
        )


# ==============================================================================
# IV. ZERO-DRIFT SENTRY
# ==============================================================================

class ZeroDriftSentry:
    """
    Supervises agent intermediate outputs and state transitions to enforce
    zero semantic drift against the frozen ProtectedIntent contract.
    """

    # Air-gap network egress patterns (including obfuscation & dynamic vectors)
    _URL_RE = re.compile(r"\b(https?|wss?|ftp)://[^\s\"'<>]+", re.IGNORECASE)
    _OBFUSCATED_URL_RE = re.compile(r"['\"](https?|wss?|ftp)['\"]\s*\+\s*['\"]://", re.IGNORECASE)

    _EGRESS_PATTERNS = [
        re.compile(r"\b(curl|wget|netcat|nc|ncat|telnet|ssh|scp|rsync)\b\s+[\-a-zA-Z0-9/]", re.IGNORECASE),
        re.compile(r"\b(import|from)\s+(requests|httpx|aiohttp|urllib|socket|http\.client|ftplib|websockets)\b", re.IGNORECASE),
        re.compile(r"(__import__|importlib\.import_module)\s*\(\s*['\"](urllib|requests|httpx|aiohttp|socket|http\.client|ftplib|websockets)['\"]", re.IGNORECASE),
        re.compile(r"\bsocket\.(socket|create_connection|connect)\b", re.IGNORECASE),
        re.compile(r"\b(fetch|axios\.(get|post|put|delete)|new\s+WebSocket)\s*\(", re.IGNORECASE),
        re.compile(r"\b(subprocess|os\.system|os\.popen)\s*\([^)]*\b(curl|wget|nc|netcat|ping)\b", re.IGNORECASE),
        re.compile(r"\b(add(ed|ing)?|use|using|introduce(d)?)\s+(an?\s+)?unapproved\s+external\s+(network|dependency|endpoint|api)\b", re.IGNORECASE),
        re.compile(r"\b(add(ed|ing)?|connect(ing)?\s+to)\s+external\s+network\s+dependenc(y|ies)\b", re.IGNORECASE),
        re.compile(r"\b(add(ed|ing)?|use|using)\s+third-party\s+(telemetry|analytics|cloud|tracker)\b", re.IGNORECASE),
    ]

    # Scope creep & requirement mutation patterns (affirmative only, avoiding false positives on preventative phrases)
    _SCOPE_CREEP_PATTERNS = [
        re.compile(r"\b(will|decided\s+to|going\s+to|proceeding\s+to|let's)\s+rewrite\s+(the\s+)?(user\s+)?requirements?\b", re.IGNORECASE),
        re.compile(r"\b(will|decided\s+to|going\s+to|proceeding\s+to)\s+change\s+(the\s+)?(user\s+)?requirements?\b", re.IGNORECASE),
        re.compile(r"\binstead\s+of\s+(fixing|implementing|the\s+requested)\b", re.IGNORECASE),
        re.compile(r"\b(add(ed|ing)?|invent(ed|ing)?)\s+(a\s+)?(new\s+)?(unrequested|unapproved)\s+(requirement|feature|addition|deliverable)\b", re.IGNORECASE),
        re.compile(r"\bintroduce(d|ing)?\s+scope\s+creep\b", re.IGNORECASE),
        re.compile(r"\buser\s+asked\s+for\b.*?\bbut\s+I('m|\s+am|\s+will)\b", re.IGNORECASE),
    ]

    # Premature surrender & false claim patterns
    _SURRENDER_PATTERNS = [
        re.compile(r"\b(task\s+done|all\s+done|completed|finished)\b.*?\b(skip|without\s+proof|cannot\s+verify|tests?\s+not\s+run)\b", re.IGNORECASE),
        re.compile(r"\b(will|decided\s+to|going\s+to|let's)\s+(skip|abandon)\s+(the\s+)?(tests?|verification|validations?)\b", re.IGNORECASE),
        re.compile(r"\b(i\s+)?give\s+up\b", re.IGNORECASE),
        re.compile(r"\bgiving\s+up\b", re.IGNORECASE),
        re.compile(r"\bimpossible\s+to\s+(fix|verify|prove)\b", re.IGNORECASE),
        re.compile(r"\bclaim(ed|ing)?\s+success\s+without\s+proof\b", re.IGNORECASE),
        re.compile(r"\bassuming\s+(it\s+)?passes?\s+without\s+(checking|verifying|tests?)\b", re.IGNORECASE),
        re.compile(r"\bwithout\s+(ever\s+)?(running|executing)\s+(the\s+|any\s+)?tests?\b(?!\s*failing)", re.IGNORECASE),
    ]

    # Invariant weakening patterns
    _WEAKENING_PATTERNS = [
        re.compile(r"\bverify\s*=\s*False\b", re.IGNORECASE),
        re.compile(r"\binsecure\s*=\s*True\b", re.IGNORECASE),
        re.compile(r"\bskip_verification\b", re.IGNORECASE),
        re.compile(r"\b(bypass|bypassing)\s+(auth|token|security|verification|validation|checks?)\b", re.IGNORECASE),
        re.compile(r"\b(disable|disabling|disabled)\s+(auth|token|security|verification|validation|checks?)\b", re.IGNORECASE),
        re.compile(r"\ballow_all\s*=\s*True\b", re.IGNORECASE),
        re.compile(r"\blower(ing)?\s+(the\s+)?(security|safety|threshold|standards?)\b", re.IGNORECASE),
        re.compile(r"\bweaken(ing)?\s+(the\s+)?invariants?\b", re.IGNORECASE),
        re.compile(r"\b(delete|remove|ignore)\s+(safety\s+)?tests?\b", re.IGNORECASE),
        re.compile(r"@pytest\.mark\.skip\b", re.IGNORECASE),
        re.compile(r"@unittest\.skip\b", re.IGNORECASE),
        re.compile(r"\bexcept\s*(\([^\)]*\)|Exception)?\s*:\s*(pass|\.\.\.)\b", re.IGNORECASE),
        re.compile(r"\bdef\s+test_[a-zA-Z0-9_]+\s*\([^)]*\)\s*:\s*return\s+True\b", re.IGNORECASE),
    ]

    def __init__(self) -> None:
        self.rollback_history: list[dict[str, Any]] = []
        self.last_drift_verdict: Optional[DriftVerdict] = None

    def evaluate_drift(
        self,
        original_intent: ProtectedIntent,
        intermediate_output: str,
        raise_on_drift: bool = True,
    ) -> DriftVerdict:
        """
        Computes semantic invariant preservation.
        Checks for:
          - Scope creep (inventing requirements user never asked for, unauthorized egress).
          - Premature surrender (giving up or claiming success without proof).
          - Invariant weakening (silently lowering safety/functional standards).
          - Forbidden action violations defined in original_intent.
        If drift is detected, raises SemanticDriftViolationError and forces state rollback.
        """
        if not intermediate_output or not intermediate_output.strip():
            verdict = DriftVerdict(
                is_drift_detected=False,
                semantic_distance=0.0,
                reasons=(),
                drift_type=DriftType.NO_DRIFT,
                remediation_advice=None,
            )
            self.last_drift_verdict = verdict
            return verdict

        reasons: list[str] = []
        detected_types: list[DriftType] = []

        # 1. Check network egress in air-gapped context
        if original_intent.network_policy == NetworkPolicy.AIR_GAPPED:
            if self._URL_RE.search(intermediate_output):
                reasons.append("Unauthorized external URL / network egress detected in air-gapped policy")
                detected_types.append(DriftType.UNAUTHORIZED_DEPENDENCY)

            if self._OBFUSCATED_URL_RE.search(intermediate_output):
                reasons.append("Obfuscated external network URL concatenation detected")
                detected_types.append(DriftType.UNAUTHORIZED_DEPENDENCY)

            for pattern in self._EGRESS_PATTERNS:
                if pattern.search(intermediate_output):
                    reasons.append(f"Unauthorized external network dependency detected: '{pattern.pattern}'")
                    detected_types.append(DriftType.UNAUTHORIZED_DEPENDENCY)

        # 2. Check scope creep / requirement rewriting
        for pattern in self._SCOPE_CREEP_PATTERNS:
            if pattern.search(intermediate_output):
                reasons.append(f"Scope creep detected: mutating requirements or adding unrequested scope ('{pattern.pattern}')")
                detected_types.append(DriftType.SCOPE_CREEP)

        # 3. Check explicit forbidden actions from ProtectedIntent
        forbidden_violations = self._check_forbidden_actions(original_intent.forbidden_actions, intermediate_output)
        for fv in forbidden_violations:
            reasons.append(fv)
            detected_types.append(DriftType.SCOPE_CREEP)

        # 4. Check premature surrender
        for pattern in self._SURRENDER_PATTERNS:
            if pattern.search(intermediate_output):
                reasons.append(f"Premature surrender detected: claiming success or abandoning verification ('{pattern.pattern}')")
                detected_types.append(DriftType.PREMATURE_SURRENDER)

        # 5. Check invariant weakening
        for pattern in self._WEAKENING_PATTERNS:
            if pattern.search(intermediate_output):
                reasons.append(f"Invariant weakening detected: compromising safety, security, or test rigor ('{pattern.pattern}')")
                detected_types.append(DriftType.INVARIANT_WEAKENING)

        if reasons:
            primary_type = detected_types[0] if detected_types else DriftType.SCOPE_CREEP
            semantic_distance = min(1.0, 0.4 + 0.2 * len(reasons))
            verdict = DriftVerdict(
                is_drift_detected=True,
                semantic_distance=semantic_distance,
                reasons=tuple(reasons),
                drift_type=primary_type,
                remediation_advice="FAIL-CLOSED: Revert immediately to frozen ProtectedIntent contract P.",
            )
            self.last_drift_verdict = verdict
            self._force_state_rollback(original_intent, verdict)

            if raise_on_drift:
                raise SemanticDriftViolationError(
                    f"ZeroDriftSentry violation ({primary_type.value}): {'; '.join(reasons)}",
                    verdict=verdict,
                    violating_output=intermediate_output,
                )
            return verdict

        # Clean invariant preservation: semantic distance is exactly 0.0
        verdict = DriftVerdict(
            is_drift_detected=False,
            semantic_distance=0.0,
            reasons=(),
            drift_type=DriftType.NO_DRIFT,
            remediation_advice=None,
        )
        self.last_drift_verdict = verdict
        return verdict

    def _check_forbidden_actions(
        self,
        forbidden_actions: Sequence[str],
        output: str,
    ) -> list[str]:
        """Detects attempts to execute actions explicitly declared forbidden in ProtectedIntent."""
        violations: list[str] = []
        for action in forbidden_actions:
            clean_action = re.sub(
                r"^(do\s+not|never|must\s+not|cannot|prohibit(ed)?|avoid)\s+",
                "",
                action,
                flags=re.IGNORECASE,
            ).strip()
            if not clean_action:
                continue

            words = [w for w in re.split(r"\s+", clean_action.lower()) if len(w) > 2]
            if len(words) >= 2:
                phrase = r"\b" + r"\s+".join(re.escape(w) for w in words[:3]) + r"\b"
                match = re.search(phrase, output, re.IGNORECASE)
                if match:
                    start = max(0, match.start() - 30)
                    preceding = output[start:match.start()].lower()
                    if not re.search(r"\b(not|never|no|without|prevent(ed)?|avoid(ed)?)\b", preceding):
                        violations.append(f"Forbidden action violation: attempted '{action}'")
        return violations

    def _force_state_rollback(self, original_intent: ProtectedIntent, verdict: DriftVerdict) -> None:
        """Enforces immediate state rollback to the frozen intent contract."""
        rollback_event = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "frozen_intent_digest": original_intent.intent_digest,
            "drift_type": verdict.drift_type.value if verdict.drift_type else "UNKNOWN",
            "semantic_distance": verdict.semantic_distance,
            "reasons": list(verdict.reasons),
            "status": "ROLLED_BACK_TO_FROZEN_CONTRACT",
        }
        self.rollback_history.append(rollback_event)

    def rollback_state(
        self,
        original_intent: ProtectedIntent,
        current_state: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Provides an authoritative rollback checkpoint for execution recovery."""
        restored: dict[str, Any] = {
            "frozen_intent_digest": original_intent.intent_digest,
            "objective": original_intent.objective,
            "domain": original_intent.domain,
            "invariants": list(original_intent.invariants),
            "forbidden_actions": list(original_intent.forbidden_actions),
            "network_policy": original_intent.network_policy.value,
            "status": "RESTORED_TO_FROZEN_CONTRACT",
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }
        if current_state is not None and isinstance(current_state, dict):
            safe_state = dict(current_state)
            safe_state.pop("unapproved_dependency", None)
            safe_state.pop("unapproved_egress", None)
            safe_state.pop("mutated_scope", None)
            safe_state.update(restored)
            return safe_state
        return restored


# ==============================================================================
# V. SELF-VERIFYING COMPLETION HARNESS
# ==============================================================================

class SelfVerifyingCompletionHarness:
    """
    Evaluates obligations using strict 3-valued Kleene logic (TRUE, FALSE, UNKNOWN).
    Refuses completion if ANY safety-critical obligation is UNKNOWN or FALSE,
    emitting the exact missing evidence delta Δ.
    Issues Ed25519-signed CompletionCertificates only on 100% verified TRUE completion.
    """

    def __init__(self, keypair: Optional[tuple[bytes, bytes]] = None) -> None:
        self._sk, self._pk = keypair if keypair is not None else generate_keypair()

    def verify_and_finalize(
        self,
        plan: MasterExecutionPlan,
        execution_state: Any,
        raise_on_rejection: bool = True,
        require_csc: bool = False,
    ) -> CompletionCertificate:
        """
        Evaluates every obligation in ObligationSet using strict 3-valued Kleene logic.
        Hard Rule: If ANY safety-critical obligation evaluates to UNKNOWN or FALSE,
        the harness REFUSES completion and outputs the exact missing evidence delta Δ.
        If all obligations evaluate to TRUE, signs and issues a CompletionCertificate.
        """
        obligation_evaluations: dict[str, PredicateValue] = {}
        missing_delta: dict[str, Any] = {}

        # 1. Evaluate all obligations in the plan
        for ob in plan.obligations:
            status = self._evaluate_obligation_predicate(ob.obligation_id, execution_state)
            obligation_evaluations[ob.obligation_id] = status

            if status != PredicateValue.TRUE:
                missing_delta[ob.obligation_id] = {
                    "obligation_id": ob.obligation_id,
                    "status": status.name,
                    "is_safety_critical": ob.is_safety_critical,
                    "description": ob.description,
                    "predicate_target": ob.predicate_target,
                    "witness_type": ob.witness_type,
                    "remediation": f"Witness receipt establishing {ob.obligation_id} == PredicateValue.TRUE is missing or unresolved.",
                }

        # 2. Extract & validate exact integer NanoUSD cost
        cost_nanos: NanoUSD = 0
        if isinstance(execution_state, dict):
            cost_nanos = execution_state.get("cost_nanos", 0)
        elif hasattr(execution_state, "cost_nanos"):
            cost_nanos = getattr(execution_state, "cost_nanos")
        validate_nanos(cost_nanos, "cost_nanos")

        # 3. Check Financial Budget Conservation
        if plan.protected_intent.budget_nanos > 0 and cost_nanos > plan.protected_intent.budget_nanos:
            missing_delta["ob_financial_budget"] = {
                "obligation_id": "ob_financial_budget",
                "status": "FALSE",
                "is_safety_critical": True,
                "description": f"Execution cost ({cost_nanos} nanos) exceeded protected intent budget ({plan.protected_intent.budget_nanos} nanos)",
                "predicate_target": "cost_nanos <= budget_nanos",
                "witness_type": "exact_integer_accounting",
                "remediation": f"Reduce execution resource consumption by {cost_nanos - plan.protected_intent.budget_nanos} nanos.",
            }

        # 4. Check Dual-Engine CSC Crucible / Counterfactual Challenge
        csc_status = self._evaluate_csc_crucible(execution_state)
        if csc_status == PredicateValue.FALSE:
            missing_delta["ob_counterfactual_crucible"] = {
                "obligation_id": "ob_counterfactual_crucible",
                "status": "FALSE",
                "is_safety_critical": True,
                "description": "Counterfactual Challenge (CSC Crucible) identified counterexample: system proved the wrong thing",
                "predicate_target": "csc.counterfactual_challenge.passed == TRUE",
                "witness_type": "csc_crucible_qualification",
                "remediation": "Investigate counterexample and resolve counterfactual discrepancy before finalizing.",
            }
        elif csc_status == PredicateValue.UNKNOWN and require_csc:
            missing_delta["ob_counterfactual_crucible"] = {
                "obligation_id": "ob_counterfactual_crucible",
                "status": "UNKNOWN",
                "is_safety_critical": True,
                "description": "Counterfactual Challenge (CSC Crucible) unproven",
                "predicate_target": "csc.counterfactual_challenge.passed == TRUE",
                "witness_type": "csc_crucible_qualification",
                "remediation": "Provide distinguishing probe witness proving counterfactual soundness.",
            }

        # Check completion gate
        if missing_delta:
            unmet_ids = tuple(missing_delta.keys())
            err = CompletionRejectedError(
                message=f"Harness refused completion: {len(missing_delta)} unproven obligation(s) [{', '.join(unmet_ids)}]",
                missing_witness_delta=missing_delta,
                unmet_obligations=unmet_ids,
            )
            if raise_on_rejection:
                raise err
            return err  # type: ignore[return-value]

        # 5. All obligations evaluate to TRUE: Issue cryptographic CompletionCertificate
        now_utc = datetime.now(timezone.utc).isoformat()
        certificate_id = f"cert-{plan.plan_digest[:16]}-{int(time.time() * 1000)}"

        payload = {
            "certificate_id": certificate_id,
            "certificate_type": "ExecutionPlacementCertificate",
            "cost_nanos": cost_nanos,
            "domain": plan.protected_intent.domain,
            "objective": plan.protected_intent.objective,
            "obligations": {ob.obligation_id: "TRUE" for ob in plan.obligations},
            "plan_digest": plan.plan_digest,
            "timestamp_utc": now_utc,
            "verdict": VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE.value,
        }

        canonical_bytes = rfc8785_canonicalize(payload)
        digest_sha256 = hashlib.sha256(canonical_bytes).hexdigest()
        sig_bytes = ed25519_sign(self._sk, self._pk, digest_sha256.encode("utf-8"))
        signature_ed25519 = sig_bytes.hex()
        pk_hex = self._pk.hex()

        receipt = AuthenticatedReceipt(
            spec_version="0.1.0",
            digest_sha256=digest_sha256,
            signature_ed25519=signature_ed25519,
            signer_key_id=f"spe-authority:{pk_hex[:16]}",
            canonical_payload=payload,
            verified=True,
        )

        return CompletionCertificate(
            certificate_id=certificate_id,
            plan_digest=plan.plan_digest,
            verdict=VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE,
            obligation_results=obligation_evaluations,
            cost_nanos=cost_nanos,
            signature_ed25519=signature_ed25519,
            public_key_hex=pk_hex,
            digest_sha256=digest_sha256,
            timestamp_utc=now_utc,
            authenticated_receipt=receipt,
            canonical_payload=payload,
        )

    def _evaluate_csc_crucible(self, state: Any) -> PredicateValue:
        """Evaluates counterfactual challenge status from execution state."""
        if isinstance(state, dict):
            for k in ("csc_verdict", "counterfactual_status", "crucible_verdict", "csc_challenge"):
                if k in state:
                    return self._resolve_predicate_value(state[k])
        elif hasattr(state, "csc_verdict"):
            return self._resolve_predicate_value(getattr(state, "csc_verdict"))
        elif hasattr(state, "counterfactual_status"):
            return self._resolve_predicate_value(getattr(state, "counterfactual_status"))
        return PredicateValue.UNKNOWN

    def _evaluate_obligation_predicate(self, ob_id: str, state: Any) -> PredicateValue:
        """Resolves 3-valued predicate value from execution state without converting UNKNOWN to TRUE."""
        if isinstance(state, str):
            return PredicateValue.UNKNOWN

        val: Any = None
        if isinstance(state, dict):
            if ob_id in state:
                val = state[ob_id]
            elif "obligation_results" in state and isinstance(state["obligation_results"], dict) and ob_id in state["obligation_results"]:
                val = state["obligation_results"][ob_id]
            elif "witnesses" in state and isinstance(state["witnesses"], dict) and ob_id in state["witnesses"]:
                val = state["witnesses"][ob_id]
            elif "verdicts" in state and isinstance(state["verdicts"], dict) and ob_id in state["verdicts"]:
                val = state["verdicts"][ob_id]
        elif hasattr(state, "obligation_results") and isinstance(state.obligation_results, dict):
            val = state.obligation_results.get(ob_id)
        elif hasattr(state, "witnesses") and isinstance(state.witnesses, dict):
            val = state.witnesses.get(ob_id)
        elif hasattr(state, ob_id):
            val = getattr(state, ob_id)

        return self._resolve_predicate_value(val)

    def _resolve_predicate_value(self, val: Any) -> PredicateValue:
        """Deterministically unwraps any representation into strict Kleene PredicateValue."""
        if val is None:
            return PredicateValue.UNKNOWN

        if isinstance(val, PredicateValue):
            return val

        if isinstance(val, bool):
            return PredicateValue.TRUE if val else PredicateValue.FALSE

        if isinstance(val, VerificationVerdict):
            if val in (VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE, VerificationVerdict.EMPIRICALLY_QUALIFIED):
                return PredicateValue.TRUE
            if val == VerificationVerdict.COUNTEREXAMPLE_FOUND:
                return PredicateValue.FALSE
            return PredicateValue.UNKNOWN

        if isinstance(val, str):
            v_upper = val.upper().strip()
            if v_upper in ("TRUE", "SATISFIED", "PROVEN", "PASS", "PASSED", "VERIFIED", "SUCCESS", "SUCCESSFUL", "OK"):
                return PredicateValue.TRUE
            if v_upper in ("FALSE", "REJECTED", "FAILED", "FAIL", "UNSAT", "ERROR"):
                return PredicateValue.FALSE
            if v_upper == VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE.value:
                return PredicateValue.TRUE
            if v_upper == VerificationVerdict.EMPIRICALLY_QUALIFIED.value:
                return PredicateValue.TRUE
            if v_upper == VerificationVerdict.COUNTEREXAMPLE_FOUND.value:
                return PredicateValue.FALSE
            return PredicateValue.UNKNOWN

        if isinstance(val, dict):
            for k in ("predicate_value", "verdict", "status", "value", "outcome", "result", "verified", "passed"):
                if k in val:
                    resolved = self._resolve_predicate_value(val[k])
                    if resolved != PredicateValue.UNKNOWN:
                        return resolved
            return PredicateValue.UNKNOWN

        if hasattr(val, "predicate_value"):
            return self._resolve_predicate_value(getattr(val, "predicate_value"))
        if hasattr(val, "verdict"):
            return self._resolve_predicate_value(getattr(val, "verdict"))
        if hasattr(val, "status"):
            return self._resolve_predicate_value(getattr(val, "status"))

        return PredicateValue.UNKNOWN
