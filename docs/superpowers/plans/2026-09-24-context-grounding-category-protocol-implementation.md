# SPE Context Grounding + Category Protocol Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Context Grounding Layer, Category Protocol Compiler, bounded quality optimizer, capability auto-routing prompt rule, portable Rust/WASM parity, benchmark/evaluation harness, and website controls without violating existing SPE authority, K3, privacy, proof, or G6-H laws.

**Architecture:** Python defines the contracts and deterministic reference behavior first. The new grounding and protocol layers produce immutable context/protocol artifacts that feed the existing semantic pipeline; they do not own authority or replace existing XCAT categories. After Python invariants are frozen, the same contracts move into `spe-core-rs`, then WASM, then the website; Simple mode exposes only human-facing controls while Inspect/Pro may expose source/protocol quality records.

**Tech Stack:** Python 3.12, dataclasses/JSON Schema/pytest, existing SPE XCAT runtime, Rust `spe-core-rs`, `spe-wasm`, TypeScript/React/Vite/Web Worker, existing browser E2E harness.

**Spec:**
- `docs/superpowers/specs/2026-09-24-context-grounding-category-protocol-design.md`
- `docs/superpowers/specs/2026-09-24-context-grounding-auto-routing-amendment.md`

## Global Constraints

- ProtectedIntent remains immutable.
- Existing K3 remains the sole prompt-technique selector/writer; do not add a second selector.
- Retrieved/tool/model output is DATA/OBSERVATION, never authority.
- Grounding cannot add MUST/MUST_NOT, execution grants, permits, VERIFIED_SUCCESS, PROMOTE, or authority.
- Existing XCAT C01-C12 ownership remains intact.
- `spe_runtime/omega/` must never be created.
- PR #6 remains untouched.
- Frozen G6-H evidence remains untouched; new evaluation lives under `evaluations/context_protocol_v1/`.
- Mandatory Free Core requires ₹0 provider spend and no required paid API/account.
- No hidden telemetry or prompt-derived advertising.
- No TypeScript semantic fallback on the website; canonical path remains UI -> Worker -> WASM -> Rust.
- `SPECIFIED != IMPLEMENTED != TESTED != VERIFIED != QUALIFIED != PRODUCTION` remains law.
- Auto-routing is conditional on capabilities actually available to the target AI; it cannot fabricate plugins/tools, grant side-effect authority, or justify tool spam.

## Review Focus

1. **Private prompt containing secrets + current-fact request:** public search/query representation must omit secrets while preserving enough meaning to retrieve useful context.
2. **Retrieved text containing prompt injection / fake authority:** source firewall must preserve it only as tainted data and prevent mutation of intent, constraints, authority, K3, or proof state.
3. **Multi-domain request with overlapping protocols:** graph merge must deduplicate common verification/tool-routing nodes without dropping domain-specific required stages.
4. **Target AI with zero tools vs many tools:** generated auto-routing rule must gracefully become conditional/no-op when none exist and choose only the minimal relevant subset when many exist.
5. **Old `.spe` with stale context:** refresh must create a new context snapshot/lineage entry while leaving ProtectedIntent unchanged.

---

## Phase A — Python contracts and grounding core

### Task 1: Immutable grounding models + schemas

**Files:**
- Create: `spe_runtime/grounding/__init__.py`
- Create: `spe_runtime/grounding/models.py`
- Create: `schemas/context_need.schema.json`
- Create: `schemas/context_capsule.schema.json`
- Test: `tests/unit/test_grounding_models.py`

**Interfaces:**
- Produces: `ContextNeed`, `ContextCapsule`, `SupportStatus`, `ContextType`, `PrivacyClass`, each immutable and JSON-serializable through explicit `to_dict()` methods.
- Consumes: only Python stdlib; no external provider SDK.

- [ ] **Step 1: Write failing model immutability/serialization tests**

```python
from dataclasses import FrozenInstanceError
import pytest
from spe_runtime.grounding.models import ContextNeed, ContextCapsule


def test_context_need_is_immutable_and_deterministic():
    need = ContextNeed(
        need_id="need-1",
        domain_tags=("research",),
        context_types=("SCHOLARLY_EVIDENCE",),
        freshness_required=True,
        risk_level="HIGH",
        privacy_class="PRIVATE",
        query_minimization_required=True,
        required_source_classes=("peer_reviewed",),
        optional_source_classes=("preprint",),
        max_sources=12,
        max_context_bytes=65536,
        abstain_if_missing=True,
        reason_codes=("CURRENT_EVIDENCE_REQUIRED",),
    )
    assert need.to_dict()["need_id"] == "need-1"
    with pytest.raises(FrozenInstanceError):
        need.max_sources = 20


def test_context_capsule_keeps_provenance_and_taint():
    capsule = ContextCapsule(
        capsule_id="cap-1",
        domain_id="research",
        context_type="SCHOLARLY_EVIDENCE",
        claim_or_observation="Finding",
        value="Result",
        source_id="doi:10.1/example",
        source_class="peer_reviewed",
        authority_class="REFERENCE",
        retrieved_at="2026-09-24T00:00:00Z",
        valid_as_of="2026-09-24T00:00:00Z",
        fresh_until=None,
        license="CC-BY-4.0",
        allowed_use="SUMMARIZE_WITH_ATTRIBUTION",
        confidence=0.9,
        support_status="SUPPORTED",
        contradiction_group=None,
        provenance_digest="sha256:abc",
        taint_labels=("UNTRUSTED_SOURCE",),
        sensitivity_labels=(),
    )
    assert "UNTRUSTED_SOURCE" in capsule.to_dict()["taint_labels"]
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python -m pytest tests/unit/test_grounding_models.py -q`
Expected: import failure because `spe_runtime.grounding.models` does not exist.

- [ ] **Step 3: Implement minimal frozen dataclasses and enums**

Create `models.py` with frozen dataclasses, tuple normalization in `__post_init__`, explicit validation of confidence range `0.0..1.0`, positive source/context budgets, and `to_dict()`.

- [ ] **Step 4: Add JSON schemas matching exact serialized field names**

`context_need.schema.json` must require all contract fields and use enums for canonical context/privacy values. `context_capsule.schema.json` must require provenance/source/freshness/taint fields and prohibit additional properties.

- [ ] **Step 5: Run focused + schema tests**

Run: `python -m pytest tests/unit/test_grounding_models.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add spe_runtime/grounding schemas/context_need.schema.json schemas/context_capsule.schema.json tests/unit/test_grounding_models.py
git commit -m "feat: add immutable grounding contracts"
```

### Task 2: Domain profiles, source policies, recipes, and ContextNeed compiler

**Files:**
- Create: `spe_runtime/grounding/profiles.py`
- Create: `spe_runtime/grounding/policies.py`
- Create: `spe_runtime/grounding/recipes.py`
- Create: `spe_runtime/grounding/need.py`
- Create: `data/grounding/domain_profiles.json`
- Create: `data/grounding/source_policies.json`
- Create: `data/grounding/context_recipes.json`
- Test: `tests/unit/test_context_need_compiler.py`

**Interfaces:**
- Produces: `compile_context_need(request_text: str, *, user_flags: Mapping[str, object] | None = None) -> ContextNeed`
- Produces: `get_domain_profile(domain_id: str) -> DomainProfile`
- Produces: deterministic recipe/source-policy lookup by ID.

- [ ] **Step 1: Write RED routing tests**

```python
from spe_runtime.grounding.need import compile_context_need


def test_birthday_message_needs_no_external_context():
    need = compile_context_need("Write a birthday message for my sister")
    assert need.context_types == ("NONE",)
    assert need.max_sources == 0


def test_current_react_migration_prefers_official_docs():
    need = compile_context_need("Create a prompt to migrate this app to the latest React API")
    assert "OFFICIAL_DOCUMENTATION" in need.context_types
    assert "official_docs" in need.required_source_classes
    assert need.freshness_required is True


def test_research_request_requires_scholarly_evidence():
    need = compile_context_need("Research whether blue light affects sleep quality")
    assert "SCHOLARLY_EVIDENCE" in need.context_types
    assert "peer_reviewed" in need.required_source_classes
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/unit/test_context_need_compiler.py -q`
Expected: import failure.

- [ ] **Step 3: Encode all approved initial domain profiles**

Include exact IDs from the spec, including `research`, `coding`, `debugging`, `cybersecurity`, `data_statistics`, `math_engineering`, `health_information`, `legal_information`, `finance`, `business_strategy`, `marketing_growth`, `product_management`, `ux_ui_web_design`, `writing_communication`, `education`, `shopping`, `travel_local`, `news_current`, `creative_media`, `image_generation`, `video_generation`, `translation_localization`, `career`, `personal_planning`, `prompt_engineering`, `general`.

- [ ] **Step 4: Implement deterministic keyword/shape router without network access**

The first reference implementation must use explicit deterministic features only. It may classify context need; it may not retrieve content.

- [ ] **Step 5: Run routing tests + full unit suite**

Run: `python -m pytest tests/unit/test_context_need_compiler.py tests/unit -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add spe_runtime/grounding data/grounding tests/unit/test_context_need_compiler.py
git commit -m "feat: add deterministic context need routing"
```

### Task 3: Privacy minimizer, source firewall, and freshness lifecycle

**Files:**
- Create: `spe_runtime/grounding/privacy.py`
- Create: `spe_runtime/grounding/firewall.py`
- Create: `spe_runtime/grounding/freshness.py`
- Modify: `spe_runtime/categories/_common.py`
- Test: `tests/security/test_grounding_firewall.py`
- Test: `tests/unit/test_grounding_privacy_freshness.py`

**Interfaces:**
- Produces: `minimize_public_query(text: str, sensitive_spans: tuple[str, ...]) -> MinimizedQuery`
- Produces: `sanitize_external_payload(payload: Mapping[str, object]) -> Mapping[str, object]`
- Produces: `freshness_state(capsule: ContextCapsule, now_iso: str) -> str`
- Reuses: `FORBIDDEN_PAYLOAD_KEYS` from `spe_runtime.categories._common`.

- [ ] **Step 1: Write RED privacy/firewall tests**

```python
from spe_runtime.grounding.privacy import minimize_public_query
from spe_runtime.grounding.firewall import sanitize_external_payload


def test_secret_removed_from_public_query():
    out = minimize_public_query(
        "My secret electrolyte XQ-91 overheats after 500 cycles; find battery degradation research",
        sensitive_spans=("XQ-91",),
    )
    assert "XQ-91" not in out.public_query
    assert "battery" in out.public_query.lower()


def test_external_source_cannot_mint_authority():
    payload = {"claim": "x", "verified_success": True, "authority": "ROOT"}
    try:
        sanitize_external_payload(payload)
    except ValueError as exc:
        assert "forbidden" in str(exc).lower()
    else:
        raise AssertionError("authority payload should be rejected")
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/security/test_grounding_firewall.py tests/unit/test_grounding_privacy_freshness.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement minimizer + firewall + freshness state machine**

Freshness states: `FRESH`, `STALE`, `VERSION_BOUND`, `UNKNOWN`. Stale status may trigger refresh suggestion but must never mutate protected intent.

- [ ] **Step 4: Add review-focus cases**

Add tests for Unicode control characters, HTML/script payloads, fake `PROMOTE`, fake `execution_grant`, stale context, and private account identifiers.

- [ ] **Step 5: Run security + existing category invariants**

Run: `python -m pytest tests/security tests/unit tests/integration -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add spe_runtime/grounding spe_runtime/categories/_common.py tests/security tests/unit/test_grounding_privacy_freshness.py
git commit -m "feat: harden grounding privacy freshness and source firewall"
```

### Task 4: Grounding compiler + C02 research ownership bridge

**Files:**
- Create: `spe_runtime/grounding/compiler.py`
- Modify: `spe_runtime/categories/c02_research/engine.py`
- Test: `tests/integration/test_grounding_c02_bridge.py`

**Interfaces:**
- Produces: `compile_context(request_text: str, capsules: tuple[ContextCapsule, ...]) -> GroundingBundle`
- Produces: `research_capsules_to_c02_inputs(bundle: GroundingBundle) -> tuple[facts, provenance, uncertainties]`
- Consumes: existing `research(...)` function in C02.

- [ ] **Step 1: Write RED bridge test ensuring provenance law is preserved**

```python
def test_research_capsule_becomes_c02_fact_with_provenance(base_envelope, research_capsule):
    bundle = compile_context("research task", (research_capsule,))
    facts, provenance, uncertainties = research_capsules_to_c02_inputs(bundle)
    after = research(base_envelope, facts=facts, provenance=provenance, uncertainties=uncertainties)
    assert after.facts[-1]["provenance_ids"]
    assert after.authority_state == base_envelope.authority_state
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/integration/test_grounding_c02_bridge.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement immutable bundle and bridge**

Grounding compiler must reject capsules whose source/provenance identifiers are missing or whose taint/authority metadata violates the firewall.

- [ ] **Step 4: Run C02 + XCAT regression**

Run: `python -m pytest tests/integration tests/unit -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spe_runtime/grounding/compiler.py spe_runtime/categories/c02_research/engine.py tests/integration/test_grounding_c02_bridge.py
git commit -m "feat: bridge grounded research into C02 ownership"
```

---

## Phase B — Protocol compiler, evaluators, optimizer, auto-routing

### Task 5: Protocol models, depth router, registry, and approved category profiles

**Files:**
- Create: `spe_runtime/protocols/__init__.py`
- Create: `spe_runtime/protocols/models.py`
- Create: `spe_runtime/protocols/depth.py`
- Create: `spe_runtime/protocols/registry.py`
- Create: `data/protocols/protocol_registry.json`
- Create: `schemas/protocol_graph.schema.json`
- Test: `tests/unit/test_protocol_depth_registry.py`

**Interfaces:**
- Produces: `ProtocolDepth`, `ProtocolNode`, `ProtocolGraph`
- Produces: `select_protocol_depth(signals: DepthSignals) -> ProtocolDepth`
- Produces: `load_protocol(domain_id: str, depth: ProtocolDepth) -> ProtocolGraph`

- [ ] **Step 1: Write RED depth tests**

```python
def test_trivial_writing_request_routes_quick():
    assert select_protocol_depth(DepthSignals(complexity=0, stakes=0, uncertainty=0, freshness=0, evidence=0, irreversibility=0)) == ProtocolDepth.QUICK


def test_high_stakes_multisource_request_routes_critical():
    assert select_protocol_depth(DepthSignals(complexity=3, stakes=3, uncertainty=3, freshness=2, evidence=3, irreversibility=3)) == ProtocolDepth.CRITICAL
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/unit/test_protocol_depth_registry.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement deterministic depth thresholds**

Use an integer score with explicit escalation rules: any `stakes == 3` plus `irreversibility >= 2` => CRITICAL; otherwise bounded thresholds map to QUICK/STANDARD/DEEP/CRITICAL. Keep thresholds in code constants and test every boundary.

- [ ] **Step 4: Encode the approved 25+ domain protocol families**

The research CRITICAL graph must preserve the approved 20 semantic stages exactly. Other categories use the approved category workflows from the design discussion and project spec.

- [ ] **Step 5: Add schema validation and run tests**

Run: `python -m pytest tests/unit/test_protocol_depth_registry.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add spe_runtime/protocols data/protocols/protocol_registry.json schemas/protocol_graph.schema.json tests/unit/test_protocol_depth_registry.py
git commit -m "feat: add adaptive category protocol registry"
```

### Task 6: Protocol graph merger + capability auto-routing node

**Files:**
- Create: `spe_runtime/protocols/merge.py`
- Create: `spe_runtime/protocols/capability_routing.py`
- Test: `tests/unit/test_protocol_merge_and_routing.py`

**Interfaces:**
- Produces: `merge_protocol_graphs(graphs: tuple[ProtocolGraph, ...]) -> ProtocolGraph`
- Produces: `build_auto_route_node(capability_profile: CapabilityProfile | None, *, task_benefits_from_tools: bool) -> ProtocolNode | None`
- Universal merge key: `capability.auto_route`.

- [ ] **Step 1: Write RED graph-dedup + no-tools tests**

```python
def test_merge_deduplicates_universal_verification_nodes():
    merged = merge_protocol_graphs((research_graph(), product_graph()))
    merge_keys = [n.merge_key for n in merged.nodes]
    assert merge_keys.count("verify.evidence") == 1


def test_unknown_capabilities_render_conditionally():
    node = build_auto_route_node(None, task_benefits_from_tools=True)
    assert "If your environment provides relevant tools" in node.instruction


def test_many_capabilities_does_not_require_all_tools():
    profile = CapabilityProfile(available=("web", "calculator", "image_generation", "deployment"))
    node = build_auto_route_node(profile, task_benefits_from_tools=True)
    assert "smallest sufficient" in node.instruction.lower()
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/unit/test_protocol_merge_and_routing.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement DAG merge by `merge_key` with prerequisite union**

If two required nodes collide, preserve the stricter required depth and union non-conflicting prerequisites; fail closed on contradictory instructions rather than silently choosing one.

- [ ] **Step 4: Implement auto-routing node exactly per amendment**

The generated rule must instruct the target AI to inventory actual capabilities, decompose first, route subtask -> capability, prefer deterministic/live/specialist tools where appropriate, avoid irrelevant tools, verify outputs, and state limitations on failure.

- [ ] **Step 5: Add attack test: fake capability cannot expand authority**

Assert that a capability descriptor containing `deployment_authority=true` or `verified_success=true` is rejected by the same forbidden-key law.

- [ ] **Step 6: Run tests + commit**

Run: `python -m pytest tests/unit/test_protocol_merge_and_routing.py tests/security -q`
Expected: PASS.

```bash
git add spe_runtime/protocols tests/unit/test_protocol_merge_and_routing.py
git commit -m "feat: merge protocols and add safe capability auto-routing"
```

### Task 7: Protocol compiler + model adapter rendering

**Files:**
- Create: `spe_runtime/protocols/compiler.py`
- Create: `spe_runtime/adapters/protocol_render.py`
- Test: `tests/integration/test_protocol_rendering.py`

**Interfaces:**
- Produces: `compile_execution_contract(domain_ids, depth, capability_profile) -> ExecutionContract`
- Produces: `render_execution_contract(contract, adapter_id: str) -> str`
- Adapter IDs: `ANY_AI`, plus existing/approved target-specific IDs only when already present in the repository.

- [ ] **Step 1: Write RED portability tests**

```python
def test_any_ai_includes_conditional_auto_routing_without_vendor_names():
    text = render_execution_contract(contract_with_unknown_capabilities(), "ANY_AI")
    assert "If your environment provides relevant tools" in text
    assert "OpenAI" not in text and "Anthropic" not in text and "Google" not in text


def test_adapter_cannot_drop_required_research_stage():
    contract = critical_research_contract()
    text = render_execution_contract(contract, "ANY_AI")
    assert "Contradictory Evidence" in text
    assert "Replication / Independent Check" in text
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/integration/test_protocol_rendering.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement compact renderer**

Renderer emits auditable stage titles/instructions, not hidden chain-of-thought requests. It must compact redundant prose and preserve required nodes.

- [ ] **Step 4: Run integration suite + commit**

Run: `python -m pytest tests/integration/test_protocol_rendering.py tests/integration -q`
Expected: PASS.

```bash
git add spe_runtime/protocols/compiler.py spe_runtime/adapters/protocol_render.py tests/integration/test_protocol_rendering.py
git commit -m "feat: compile portable execution contracts"
```

### Task 8: Evaluators, quality record, and bounded reconstruct loop

**Files:**
- Create: `spe_runtime/protocols/evaluators.py`
- Create: `spe_runtime/protocols/quality_record.py`
- Create: `spe_runtime/protocols/optimize.py`
- Create: `data/protocols/evaluator_registry.json`
- Create: `schemas/quality_record.schema.json`
- Test: `tests/unit/test_protocol_evaluators_optimizer.py`

**Interfaces:**
- Produces: `evaluate_result(protocol_id: str, evidence: Mapping[str, object]) -> tuple[EvaluatorResult, ...]`
- Produces: `QualityRecord`
- Produces: `optimize_prompt(candidate: PromptCandidate, evaluator, *, max_iterations=3) -> OptimizationResult`

- [ ] **Step 1: Write RED optimizer-protection tests**

```python
def test_optimizer_cannot_mutate_protected_intent():
    result = optimize_prompt(candidate_with_intent("A"), evaluator_that_requests_intent_change(), max_iterations=2)
    assert result.final_candidate.protected_intent == "A"
    assert result.stop_reason == "PROTECTED_FIELD_MUTATION_REJECTED"


def test_optimizer_stops_on_no_improvement():
    result = optimize_prompt(candidate(), constant_score_evaluator(0.5), max_iterations=5)
    assert result.iterations <= 2
    assert result.stop_reason == "NO_MEASURABLE_IMPROVEMENT"
```

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/unit/test_protocol_evaluators_optimizer.py -q`
Expected: FAIL/import error.

- [ ] **Step 3: Implement evaluator registry and non-authority quality record**

Statuses: `PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE`. Serialized XCAT-adjacent field name must be `quality_record`, never `receipt`.

- [ ] **Step 4: Implement bounded deterministic optimizer**

Allowed mutation surface: execution wording, ordering of non-required explanatory text, optional examples, formatting. Forbidden mutation surface: ProtectedIntent, hard constraints, source facts, evidence confidence, authority, safety policy.

- [ ] **Step 5: Add category-specific evaluator fixtures**

At minimum: research, coding, data/statistics, business, design, shopping. Add the remaining category evaluator records before Phase A/B is declared complete.

- [ ] **Step 6: Run tests + commit**

Run: `python -m pytest tests/unit/test_protocol_evaluators_optimizer.py tests/unit -q`
Expected: PASS.

```bash
git add spe_runtime/protocols data/protocols/evaluator_registry.json schemas/quality_record.schema.json tests/unit/test_protocol_evaluators_optimizer.py
git commit -m "feat: add outcome evaluators and bounded prompt optimization"
```

---

## Phase C — Benchmarks, ablation, and adversarial proof

### Task 9: Independent context/protocol benchmark harness

**Files:**
- Create: `evaluations/context_protocol_v1/README.md`
- Create: `evaluations/context_protocol_v1/tasks.jsonl`
- Create: `evaluations/context_protocol_v1/arms.json`
- Create: `tools/run_context_protocol_benchmark.py`
- Test: `tests/regression/test_context_protocol_benchmark_fixture.py`

**Interfaces:**
- Arms: `RAW`, `SPE_BASE`, `SPE_GROUNDING_ONLY`, `SPE_PROTOCOL_ONLY`, `SPE_FULL`.
- Produces: machine-readable per-task records with task success, constraint fidelity, grounding, completeness, unsupported-claim count, token count, latency when measurable, tool calls, and adapter ID.

- [ ] **Step 1: Write RED fixture validation test**

Require at least one task for each approved stress class: trivial, ambiguous, contradictory, multilingual, typo/noisy, missing-context, overconstrained, high-stakes informational, multi-domain, adversarial, long input, media-assisted, URL-assisted.

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/regression/test_context_protocol_benchmark_fixture.py -q`
Expected: FAIL because fixture does not exist.

- [ ] **Step 3: Add frozen tasks and harness**

Do not reuse or modify frozen G6-H files. Human rating fields must default to `NO_RATINGS_YET` and must never be auto-filled.

- [ ] **Step 4: Add protocol ablation matrix**

Benchmark full vs compact and removal of contradiction, verification, and hypothesis stages for relevant categories.

- [ ] **Step 5: Add routing-efficiency measurements**

For capability-routing cases, record base-model tokens, total tokens, number of tool calls, latency, correctness, and unsupported claims. Do not claim load reduction until measured.

- [ ] **Step 6: Run fixture test + deterministic dry run + commit**

Run: `python -m pytest tests/regression/test_context_protocol_benchmark_fixture.py -q`
Run: `python tools/run_context_protocol_benchmark.py --fixture-only`
Expected: both PASS.

```bash
git add evaluations/context_protocol_v1 tools/run_context_protocol_benchmark.py tests/regression/test_context_protocol_benchmark_fixture.py
git commit -m "test: add context protocol benchmark harness"
```

### Task 10: Grounding/protocol red-team matrix

**Files:**
- Create: `tests/security/test_context_protocol_adversarial.py`
- Create: `evaluations/context_protocol_v1/adversarial_cases.jsonl`

**Interfaces:**
- Reuses: privacy minimizer, firewall, protocol merge, adapter renderer, optimizer, evaluator.

- [ ] **Step 1: Add adversarial cases from spec**

Cover prompt injection in retrieved text, poisoned docs, fake citation/authority labels, duplicate source spam, stale/retracted/conflicting source metadata, Unicode/control characters, HTML/script payloads, oversized context, privacy leakage, protocol-node injection, adapter node dropping, optimizer ProtectedIntent mutation, evaluator authority minting, and fake plugin/tool capability grants.

- [ ] **Step 2: Run and confirm failures before final hardening**

Run: `python -m pytest tests/security/test_context_protocol_adversarial.py -q`
Expected: at least one RED case until hardening is complete.

- [ ] **Step 3: Harden owning modules, not tests**

Fix root causes only in `spe_runtime/grounding/*`, `spe_runtime/protocols/*`, `spe_runtime/adapters/protocol_render.py`, or existing authority helpers. Do not weaken assertions.

- [ ] **Step 4: Run security + mutation/regression suites**

Run: `python -m pytest tests/security tests/mutation tests/regression -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/security/test_context_protocol_adversarial.py evaluations/context_protocol_v1/adversarial_cases.jsonl spe_runtime
git commit -m "test: red-team grounding protocols and tool routing"
```

---

## Phase D — Rust + WASM canonical parity

### Task 11: Port contracts/compiler to `spe-core-rs`

**Files:**
- Create: `portable/spe-core-rs/src/grounding.rs`
- Create: `portable/spe-core-rs/src/protocols.rs`
- Modify: `portable/spe-core-rs/src/lib.rs`
- Create: `portable/spe-core-rs/tests/context_protocol.rs`
- Create: `tests/portability/context_protocol_vectors.json`

**Interfaces:**
- Rust serialized shapes must match Python JSON fixtures byte-for-byte after canonical JSON normalization.
- Expose pure functions for context-need compilation, depth routing, protocol merge, and portable execution-contract rendering.

- [ ] **Step 1: Generate frozen Python vectors**

Add representative vectors for no-context writing, research CRITICAL, current coding docs, multi-domain merge, unknown capabilities, many capabilities, stale context, and malicious source payload rejection.

- [ ] **Step 2: Write failing Rust conformance tests**

```rust
#[test]
fn research_critical_keeps_all_required_stages() {
    let out = compile_fixture("research-critical").unwrap();
    assert!(out.rendered.contains("Contradictory Evidence"));
    assert!(out.rendered.contains("Replication / Independent Check"));
}
```

- [ ] **Step 3: Verify RED**

Run: `cargo test --manifest-path portable/spe-core-rs/Cargo.toml context_protocol -- --nocapture`
Expected: FAIL until modules exist.

- [ ] **Step 4: Implement Rust contracts/compiler without network dependencies**

Reuse existing `protected.rs`, `semantic.rs`, `abi.rs`, and conformance patterns; do not add provider SDKs.

- [ ] **Step 5: Run Rust + Python differential vectors**

Run: `cargo test --manifest-path portable/spe-core-rs/Cargo.toml`
Run: `python -m pytest tests/portability -q`
Expected: PASS with zero Python/Rust vector mismatches.

- [ ] **Step 6: Commit**

```bash
git add portable/spe-core-rs tests/portability/context_protocol_vectors.json
git commit -m "feat: port context and protocol compiler to rust"
```

### Task 12: Expose through WASM and preserve fail-closed web engine

**Files:**
- Modify: `portable/spe-wasm/src/lib.rs`
- Modify: `apps/web/src/engine/types.ts`
- Modify: `apps/web/src/engine/wasm-host.d.ts`
- Modify: `apps/web/src/engine/wasm-host.mjs`
- Modify: `apps/web/src/engine/engine.worker.ts`
- Modify: `apps/web/src/engine/client.ts`
- Test: `tests/web/test_context_protocol_wasm_path.py`

**Interfaces:**
- Add WASM request/response fields for source mode (`AUTO`/`ON`/`OFF`), requested depth (`AUTO`/`FAST`/`SMART`/`DEEP`), context summary, execution contract, quality record, and capability-profile mode.
- No TypeScript implementation of semantic routing; TS only transports and renders Rust/WASM results.

- [ ] **Step 1: Write RED test proving no TS semantic fallback**

Assert engine worker fails closed if WASM is unavailable and does not synthesize a protocol locally.

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/web/test_context_protocol_wasm_path.py -q`
Expected: FAIL until fields/path exist.

- [ ] **Step 3: Add WASM bindings and worker transport**

Keep existing integrity/digest validation. New output must be produced by Rust through WASM.

- [ ] **Step 4: Run WASM + engine tests**

Run: `cargo test --manifest-path portable/spe-wasm/Cargo.toml`
Run: `cd apps/web && npm run test:engine`
Run: `python -m pytest tests/web/test_context_protocol_wasm_path.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portable/spe-wasm apps/web/src/engine tests/web/test_context_protocol_wasm_path.py
git commit -m "feat: expose context protocol compiler through wasm"
```

---

## Phase E — Website UX and prompt-artifact integration

### Task 13: Add Simple/Inspect controls without exposing internal jargon

**Files:**
- Create: `apps/web/src/composer/ContextProtocolControls.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`
- Test: `tests/web/test_context_protocol_copy.py`
- Test: `apps/web/scripts/e2e-context-protocol.mjs`

**Interfaces:**
- Public source control: `AUTO`, `ADD_SOURCES`, `NO_SOURCES`.
- Public depth control: `AUTO`, `FAST`, `SMART`, `DEEP`.
- Simple-mode copy examples: `Use current sources when they help.` and `Use the best available tools when they help.`
- Inspect mode may show sources, freshness, contradictions, selected protocol, quality checks, limitations.

- [ ] **Step 1: Write RED copy test**

Reject visitor-facing strings containing `RAG`, `ContextCapsule`, `ProtocolGraph`, `ABI`, `WASM`, `K3`, connector IDs, or plugin manifest terminology in Simple mode.

- [ ] **Step 2: Verify RED**

Run: `python -m pytest tests/web/test_context_protocol_copy.py -q`
Expected: FAIL until component exists.

- [ ] **Step 3: Implement controls and accessibility**

Controls must be keyboard reachable, have accessible names, preserve 44px-ish interaction targets where practical, and default to AUTO without requiring an account.

- [ ] **Step 4: Add E2E flows**

Cover: simple request => no unnecessary grounding; research => sources AUTO + DEEP/CRITICAL internal selection; no-tools capability => conditional prompt rule; source OFF => no external context request; stale `.spe` => refresh suggestion without intent mutation.

- [ ] **Step 5: Run web build/copy/E2E**

Run: `cd apps/web && npm run build`
Run: `python -m pytest tests/web -q`
Run: `node apps/web/scripts/e2e-context-protocol.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/composer/ContextProtocolControls.tsx apps/web/src/App.tsx apps/web/src/index.css tests/web apps/web/scripts/e2e-context-protocol.mjs
git commit -m "feat: add human-facing grounding and depth controls"
```

### Task 14: Extend `.spe` artifact lineage with context/protocol quality data

**Files:**
- Modify existing `.spe` serializer/portability module discovered during execution under `spe_runtime/portability/`
- Add exact schema fields in the existing `.spe` schema file discovered in `schemas/`
- Test: `tests/portability/test_spe_context_protocol_roundtrip.py`

**Interfaces:**
- Adds versioned fields: context snapshot IDs, protocol ID/version, depth, adapter ID, freshness state, `quality_record`, prompt digest.
- Old `.spe` files remain readable; new fields are optional on legacy artifacts and required only for the new artifact version.

- [ ] **Step 1: During execution, identify the current serializer and schema by repository inspection before editing**

This discovery step is required because the design branch does not rename or restructure the existing portability implementation. Record the exact chosen paths in the task commit message.

- [ ] **Step 2: Write RED backward-compatibility and refresh-lineage tests**

Test: old artifact round-trips unchanged; new artifact preserves ProtectedIntent while stale context refresh creates a new context snapshot and prompt lineage node.

- [ ] **Step 3: Implement minimal versioned extension**

No silent migration that rewrites user intent.

- [ ] **Step 4: Run portability suites**

Run: `python -m pytest tests/portability -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spe_runtime/portability schemas tests/portability/test_spe_context_protocol_roundtrip.py
git commit -m "feat: persist context protocol lineage in spe artifacts"
```

---

## Phase F — Final integration, regression, and evidence

### Task 15: Full regression + proof pack

**Files:**
- Create: `proofs/context_protocol_v1/CONTEXT_PROTOCOL_V1_REPORT.md`
- Create: `proofs/context_protocol_v1/manifest.json`
- Modify: `SPE-CHANGELOG`

**Interfaces:**
- Report must distinguish `IMPLEMENTED`, `TESTED`, `VERIFIED_WITHIN_TESTED_SCOPE`, and all remaining `NOT_PROVEN` claims.

- [ ] **Step 1: Run fresh Python suites**

Run: `python -m pytest -q`
Expected: zero failures.

- [ ] **Step 2: Run focused grounding/protocol/security suites**

Run: `python -m pytest tests/unit tests/integration tests/security tests/mutation tests/regression tests/portability tests/web -q`
Expected: zero failures.

- [ ] **Step 3: Run Rust/WASM suites**

Run: `cargo test --manifest-path portable/spe-core-rs/Cargo.toml`
Run: `cargo test --manifest-path portable/spe-wasm/Cargo.toml`
Expected: zero failures.

- [ ] **Step 4: Run browser engine/build/E2E**

Run: `cd apps/web && npm run test:engine && npm run build`
Run: `node apps/web/scripts/e2e-context-protocol.mjs`
Expected: PASS.

- [ ] **Step 5: Run benchmark fixture + adversarial matrix**

Run: `python tools/run_context_protocol_benchmark.py --fixture-only`
Run: `python -m pytest tests/security/test_context_protocol_adversarial.py -q`
Expected: PASS.

- [ ] **Step 6: Write evidence report with exact SHAs and no claim inflation**

Required verdict vocabulary:

- `CONTEXT_PROTOCOL_IMPLEMENTATION_PRESENT`
- `CONTEXT_PROTOCOL_TESTED_WITHIN_DECLARED_SCOPE`
- `WORLD #1 = NOT_PROVEN`
- `INDEPENDENTLY_REPLICATED = NOT_PROVEN` unless external/fresh-machine evidence later exists.

- [ ] **Step 7: Commit**

```bash
git add proofs/context_protocol_v1 SPE-CHANGELOG
git commit -m "docs: publish context protocol v1 verification report"
```

## Self-Review Results

### Spec coverage

Covered: ContextNeed, DomainProfile, SourcePolicy, ContextRecipe, ContextCapsule, privacy minimization, source firewall, freshness, adaptive depth, ProtocolGraph, graph merge, 20-stage Research CRITICAL, all category families, evaluators, quality record, bounded optimizer, cross-model rendering, model/tool capability routing, routing-efficiency measurement, benchmarks, ablation, adversarial matrix, Rust/WASM parity, website UX, `.spe` lineage, and claim discipline.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, generic “add error handling”, or undefined follow-up tasks are used. Task 14 contains an explicit repository-discovery action because the existing `.spe` serializer path was not identified in the design inspection; the discovery itself is a required concrete step and is immediately followed by exact required behavior/tests.

### Type consistency

Core names are stable across tasks: `ContextNeed`, `ContextCapsule`, `ProtocolDepth`, `ProtocolNode`, `ProtocolGraph`, `CapabilityProfile`, `ExecutionContract`, `QualityRecord`, `compile_context_need`, `compile_context`, `merge_protocol_graphs`, `compile_execution_contract`, `render_execution_contract`, `evaluate_result`, `optimize_prompt`.

### Review Focus coverage

1. Secret-bearing request -> Task 3 tests query minimization.
2. Injection/fake authority -> Tasks 3 and 10 test source firewall.
3. Multi-domain overlap -> Task 6 tests merge deduplication.
4. Zero/many tools -> Task 6 tests conditional/minimal auto-routing; Task 9 measures tool-call efficiency.
5. Stale `.spe` -> Tasks 3, 13, and 14 test freshness/refresh without intent mutation.

## Execution order

Execute Phases A -> B -> C -> D -> E -> F in order. Each numbered task has its own RED/GREEN cycle and commit. Do not start Rust/WASM parity until Python contracts and adversarial behavior are green. Do not expose website controls until Rust/WASM parity is green. Do not touch DNS, apex hosting, PR #6, frozen G6-H evidence, or `spe_runtime/omega/` during this plan.
