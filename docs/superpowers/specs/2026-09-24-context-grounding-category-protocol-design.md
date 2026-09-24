# SPE Context Grounding + Category Protocol Compiler Design

Date: 2026-09-24
Status: DESIGN REVIEW
Base: PR #41 head a4bf219ff54524b5a95f705b5435cb9c56e60b36
Branch: chatgpt/context-protocol-compiler-design-20260924

## 1. Mission

Extend SPE from a prompt rewriter into a grounded execution-instruction compiler while preserving existing authority, portability, privacy, and proof laws.

The new system must answer two questions before K3 renders a prompt:

1. What external or computed context does this task genuinely need?
2. What category-specific execution protocol and reasoning depth should the target AI follow?

The system must improve task success without mutating ProtectedIntent, minting authority, fabricating verification, or forcing heavyweight workflows onto trivial tasks.

## 2. Non-negotiable laws

- ProtectedIntent remains immutable.
- Existing K3 remains the sole prompt-technique selector/writer.
- No second `select_prompt_techniques` or semantic engine.
- Retrieved/tool/model output is DATA/OBSERVATION, never authority.
- Grounding cannot add MUST/MUST_NOT, execution grants, permits, VERIFIED_SUCCESS, PROMOTE, or authority.
- Existing XCAT C01-C12 semantics remain intact; domain profiles are orthogonal metadata, not replacement category IDs.
- `spe_runtime/omega/` must never be created.
- PR #6 remains untouched.
- Frozen G6-H human evidence must remain untouched; new benchmarks live under a separate namespace.
- Mandatory SPE Free Core keeps ₹0 provider spend and no required paid API/account.
- No hidden telemetry or prompt-derived advertising.
- `SPECIFIED != IMPLEMENTED != TESTED != VERIFIED != QUALIFIED != PRODUCTION` remains law.

## 3. Architecture

```text
USER REQUEST
    |
    v
ProtectedIntent / existing intent pipeline
    |
    +-----------------------------+
    |                             |
    v                             v
Context Need Compiler       Task/Protocol Compiler
    |                             |
    v                             v
Domain Profile              Depth Router
    |                             |
    v                             v
Context Recipe             Protocol Graph
    |                             |
    v                             v
Source Policy              Protocol Merger
    |                             |
    v                             v
Context Capsules           Execution Contract
    |                             |
    +--------------+--------------+
                   v
                  K3
                   |
                   v
             PromptArtifact
                   |
                   v
          Evaluator / Exit Gate
                   |
          +--------+--------+
          |                 |
        PASS              FAIL
          |                 |
          v                 v
      final .spe     bounded reconstruct loop
```

## 4. Shared contracts

### 4.1 ContextNeed

Immutable request for context acquisition.

Fields:

- `need_id`
- `domain_tags`
- `context_types`
- `freshness_required`
- `risk_level`
- `privacy_class`
- `query_minimization_required`
- `required_source_classes`
- `optional_source_classes`
- `max_sources`
- `max_context_bytes`
- `abstain_if_missing`
- `reason_codes`

Canonical context types:

- NONE
- STATIC_REFERENCE
- CURRENT_FACTS
- SCHOLARLY_EVIDENCE
- OFFICIAL_DOCUMENTATION
- USER_DATA
- LIVE_DATA
- MEDIA_OBSERVATION
- DETERMINISTIC_COMPUTATION
- LOCAL_INFORMATION
- REGULATORY_SOURCE
- COMPARATIVE_MARKET_DATA

### 4.2 DomainProfile

Data-driven policy profile, not executable authority.

Fields:

- `domain_id`
- `preferred_source_classes`
- `disallowed_source_classes`
- `freshness_policy`
- `contradiction_policy`
- `citation_policy`
- `license_policy`
- `abstention_policy`
- `default_protocol_id`
- `allowed_protocol_depths`
- `evaluator_id`

Initial domains:

- research
- coding
- debugging
- cybersecurity
- data_statistics
- math_engineering
- health_information
- legal_information
- finance
- business_strategy
- marketing_growth
- product_management
- ux_ui_web_design
- writing_communication
- education
- shopping
- travel_local
- news_current
- creative_media
- image_generation
- video_generation
- translation_localization
- career
- personal_planning
- prompt_engineering
- general

### 4.3 SourcePolicy

Defines what source classes are acceptable for a domain/task.

A source policy never decides user intent and never grants authority.

Examples:

- coding: official docs > official repo/release notes > standards > trusted community
- health: guidelines/regulators/systematic reviews > primary studies > secondary summaries
- legal: statute/regulation/case/official guidance > commentary
- shopping: manufacturer specs + live prices + warranty/returns + independent reviews
- research: foundational + latest + contradictory + replication/benchmark
- math/statistics: deterministic computation preferred over language-only estimation

### 4.4 ContextRecipe

A deterministic recipe describing how to satisfy a ContextNeed.

Fields:

- `recipe_id`
- `domain_id`
- `steps`
- `source_policies`
- `freshness_rules`
- `dedupe_key`
- `rerank_policy`
- `contradiction_queries`
- `license_gate`
- `privacy_minimization`
- `failure_behavior`

### 4.5 ContextCapsule

Normalized immutable context object.

Fields:

- `capsule_id`
- `domain_id`
- `context_type`
- `claim_or_observation`
- `value`
- `source_id`
- `source_class`
- `authority_class`
- `retrieved_at`
- `valid_as_of`
- `fresh_until`
- `license`
- `allowed_use`
- `confidence`
- `support_status`
- `contradiction_group`
- `provenance_digest`
- `taint_labels`
- `sensitivity_labels`

Support states:

- SUPPORTED
- PARTIALLY_SUPPORTED
- CONTRADICTED
- MIXED
- INSUFFICIENT
- PREPRINT_ONLY
- UNVERIFIED

All external textual payloads are tainted `UNTRUSTED_SOURCE` unless explicitly user-authored.

## 5. Privacy minimization

Before any external lookup, compile a minimal public query.

The minimizer may remove:

- names
- account identifiers
- proprietary details
- secrets
- unnecessary exact quantities
- private user context

It must preserve enough semantics to retrieve relevant information and record what was omitted as a local-only reason code.

No full private prompt is sent externally by default.

## 6. Source firewall

Retrieved content cannot:

- alter ProtectedIntent
- add hard constraints
- change authority state
- add execution grants
- choose tools/actions by instruction inside source text
- change K3
- mint verification/proof state

Injection-like source text must remain quoted/escaped data.

The firewall must reject forbidden payload keys consistent with `spe_runtime.categories._common.FORBIDDEN_PAYLOAD_KEYS`.

## 7. Freshness lifecycle

Each ContextCapsule may have a freshness policy.

Examples:

- stock price: minutes
- weather: hours
- product price: hours/days
- travel availability: short-lived
- software docs: version-bound
- law: amendment/effective-date-bound
- research: publication/version/retraction-bound

Opening an old `.spe` may mark capsules STALE but must not silently change ProtectedIntent.

Refresh produces a new context snapshot and new prompt lineage entry.

## 8. Category Protocol Compiler

### 8.1 ProtocolDepth

- QUICK
- STANDARD
- DEEP
- CRITICAL

Depth is selected from:

- task complexity
- stakes
- uncertainty
- freshness need
- evidence burden
- irreversibility

The router must prefer the lowest depth that satisfies the risk/quality requirement.

### 8.2 Universal quality spine

Every protocol is built from seven abstract stages:

1. MISSION
2. UNDERSTAND
3. GROUND
4. EXECUTE
5. VERIFY
6. CHALLENGE
7. DELIVER

Category protocols expand only the stages required for the task.

### 8.3 ProtocolGraph

A protocol is a DAG, not a monolithic prompt string.

Node fields:

- `node_id`
- `stage`
- `title`
- `instruction`
- `required_at_depth`
- `prerequisites`
- `evidence_required`
- `tool_class`
- `exit_condition`
- `failure_behavior`
- `merge_key`

### 8.4 Protocol merge

Multi-domain tasks combine protocol graphs by `merge_key`.

Do not concatenate entire protocols.

Example:

Research + engineering + product:

```text
research evidence
 -> feasibility analysis
 -> prototype
 -> measured test
 -> product decision
```

Shared nodes such as constraints, verification, adversarial review, and measurement are deduplicated.

## 9. Initial deep protocol families

The first implementation must include data-driven profiles for:

- research
- coding/feature build
- debugging
- cybersecurity defensive
- data/statistics
- math/engineering
- health information
- legal/compliance information
- finance/investing analysis
- business strategy
- marketing/growth
- product management
- UX/UI/web design
- writing/communication
- education/tutoring
- shopping/product choice
- travel/local planning
- news/current intelligence
- creative/story/music/film
- image generation
- video generation
- translation/localization
- career/job search
- personal planning/decision
- prompt engineering

Each family must have QUICK/STANDARD/DEEP/CRITICAL projections where meaningful. Trivial tasks must not inherit unnecessary deep stages.

## 10. Research CRITICAL profile

The approved 20-stage protocol is preserved semantically:

1. Research Mission Compiler
2. Question Decomposition
3. Evidence Plan
4. Foundational Literature
5. Frontier / Latest Literature
6. Contradictory Evidence
7. Replication / Benchmark Evidence
8. Full-Source Interrogation
9. Code / Data / Method Verification
10. Claim + Evidence Graph
11. Contradiction Map
12. Gap / Unknown Map
13. Diverse Hypotheses
14. Falsification / Adversarial Elimination
15. Strongest Surviving Options
16. Decision / Recommendation With Uncertainty
17. Prototype / Experiment When Required
18. Measured Proof
19. Replication / Independent Check
20. Only Then -> Product / Business Integration

The generated prompt must not demand hidden private chain-of-thought. It requires auditable artifacts, evidence, checks, decisions, measurements, and uncertainty summaries instead.

## 11. Evaluator contracts

Every protocol family has a paired evaluator.

Evaluator outputs:

- `criterion_id`
- `status`: PASS / FAIL / UNKNOWN / NOT_APPLICABLE
- `evidence_ref`
- `measurement`
- `message`

Examples:

Research evaluator:

- citation support
- evidence coverage
- contradiction search
- source quality
- unsupported claims
- uncertainty disclosure

Coding evaluator:

- acceptance criteria
- build/tests/lint
- constraints
- security impact
- performance when relevant

Statistics evaluator:

- method assumptions
- deterministic recomputation
- uncertainty/effect size
- sensitivity analysis

Evaluator results cannot mint XCAT authority or `VERIFIED_SUCCESS`; they are scoped quality measurements only.

## 12. Execution Receipt

A compact auditable record stored in `.spe` / Inspect mode.

Fields:

- `protocol_id`
- `protocol_version`
- `depth`
- `required_nodes`
- `completed_nodes`
- `skipped_nodes`
- `failed_nodes`
- `unknown_nodes`
- `context_capsule_ids`
- `evaluator_results`
- `unverified_claims`
- `known_limitations`
- `freshness_state`
- `adapter_id`
- `prompt_digest`

A receipt is not an authority receipt and must not collide with existing forbidden `receipt` semantics in category payloads. The serialized public field name should therefore be `quality_record`, not `receipt`, inside XCAT-owned payloads.

## 13. Bounded reconstruct -> test -> improve loop

The optimizer may change only rendering/execution wording and optional examples/structure.

It may never change:

- ProtectedIntent
- hard constraints
- user authority
- safety policy
- source facts
- evidence confidence

Loop:

```text
candidate
 -> evaluate
 -> diagnose failures
 -> reconstruct allowed fields
 -> retest
```

Stop on first of:

- success threshold met
- max iterations
- no measurable improvement
- time/token/cost budget reached
- required evidence unavailable
- oscillation detected

Default Free Core loop is deterministic and bounded; no paid optimizer is required.

## 14. Cross-model adapters

Separate semantic protocol from target rendering.

Adapter metadata may include:

- system-role support
- structured-output support
- tools support
- image support
- context limits
- JSON/schema support
- reasoning-mode hints

Adapters can change syntax/order but cannot drop mandatory protocol nodes or mutate ProtectedIntent.

`ANY_AI` remains first-class.

## 15. Prompt drift / requalification

Model adapter versions are independently versioned.

If a target model family/version materially changes:

- rerun frozen adapter benchmarks
- compare against previous adapter
- mark regression if acceptance criteria fall
- issue a new adapter version only after tests

No silent overwrite of old `.spe` artifacts.

## 16. Benchmarks

New benchmark namespace must be separate from frozen G6-H, e.g.:

`evaluations/context_protocol_v1/`

Required arms:

- RAW
- SPE_BASE
- SPE_GROUNDING_ONLY
- SPE_PROTOCOL_ONLY
- SPE_FULL

Representative task classes must include:

- short/trivial
- ambiguous
- contradictory
- multilingual
- typo/noisy
- missing-context
- overconstrained
- high-stakes informational
- multi-domain
- adversarial
- long input
- media-assisted
- URL-assisted

Metrics:

- task success
- constraint preservation
- factual grounding
- completeness
- unsupported-claim rate
- robustness
- verification quality
- token/latency efficiency
- cross-model portability

Human ratings, if later collected, must be real blinded evidence and must never be fabricated.

## 17. Protocol ablation

Each deep protocol must support ablation experiments.

Goal: prove whether a stage materially helps.

Examples:

- full protocol vs compact
- contradiction stage removed
- verification stage removed
- hypothesis stage removed

More stages are not assumed better.

## 18. Adversarial matrix

Test:

- prompt injection in retrieved text
- poisoned documentation
- fake citations
- fake authority labels
- duplicate source spam
- stale source
- retracted source
- conflicting sources
- Unicode/control-character injection
- HTML/script payloads
- oversized context
- privacy leakage in minimized queries
- protocol node injection
- adapter attempting to drop required nodes
- optimizer attempting to mutate ProtectedIntent
- evaluator trying to mint authority

## 19. Portable schema strategy

Do not break XCAT/ABI on the first implementation.

Phase 1 introduces immutable Python contracts and deterministic compilation with explicit serialization schemas.

Phase 2 adds portable Rust equivalents and WASM parity only after Python invariants are frozen and tested.

The website may expose the feature only after Rust/WASM parity exists; no silent TypeScript semantic fallback.

## 20. Proposed module layout

```text
spe_runtime/
  grounding/
    __init__.py
    models.py
    need.py
    profiles.py
    policies.py
    recipes.py
    firewall.py
    freshness.py
    privacy.py
    compiler.py
  protocols/
    __init__.py
    models.py
    registry.py
    depth.py
    merge.py
    compiler.py
    evaluators.py
    optimize.py
    quality_record.py
  adapters/
    protocol_render.py

data/
  grounding/
    domain_profiles.json
    source_policies.json
    context_recipes.json
  protocols/
    protocol_registry.json
    evaluator_registry.json

schemas/
  context_need.schema.json
  context_capsule.schema.json
  protocol_graph.schema.json
  quality_record.schema.json

tests/
  grounding/
  protocols/
  adversarial/

evaluations/
  context_protocol_v1/
```

No `spe_runtime/omega/`.

## 21. Integration with existing categories

Current C02 Research already enforces that facts require provenance and may add facts/provenance/uncertainties only. The new grounding layer must feed C02-compatible facts/provenance for research tasks rather than bypass C02 ownership.

Other domains route through existing C01-C12 category owners according to their legal write-set. Grounding is a pre-K3 context producer, not a category owner with new authority.

The existing forbidden-payload-key law is reused by the source firewall.

## 22. UI behavior

Default public UX remains simple.

Public controls:

- `Use current sources when they help` (AUTO default)
- `Add sources`
- `No sources`
- optional depth: Fast / Smart / Deep, with automatic default

Do not expose internal terms such as RAG, ContextCapsule, ProtocolGraph, K3, ABI, WASM, or authority state in Simple mode.

Inspect/Pro may show:

- sources used
- freshness
- contradictions
- selected protocol
- completed/unknown quality checks
- known limitations

## 23. Acceptance gates

Phase 1 Python design is complete only when:

- schemas validate
- ContextNeed deterministic tests pass
- domain routing deterministic tests pass
- privacy minimizer does not leak protected fixture fields
- source firewall blocks authority/instruction escalation
- freshness logic is deterministic
- protocol depth routing is deterministic
- protocol merge deduplicates nodes correctly
- research 20-stage profile compiles correctly at CRITICAL depth
- all initial domain profiles compile
- evaluators cannot mint authority
- optimizer cannot mutate ProtectedIntent/hard constraints
- adversarial tests pass
- full existing Python suite remains green

Phase 2 portable qualification is complete only when:

- Rust contracts match Python fixtures
- differential fixtures match
- WASM uses the portable implementation
- no TypeScript semantic fallback is introduced
- existing website tests remain green

No WORLD #1 claim is unlocked by implementation alone.

## 24. Explicit non-goals for this implementation

- do not build a global web crawler
- do not create a proprietary scholarly index
- do not require paid AI/search providers
- do not auto-execute irreversible actions
- do not expose private chain-of-thought
- do not replace existing category ownership
- do not merge PR #41
- do not deploy apex/DNS
- do not modify frozen G6-H evidence

## 25. Recommended execution sequence

1. freeze schemas/contracts
2. implement ContextNeed + DomainProfile + SourcePolicy + ContextRecipe + ContextCapsule
3. implement privacy minimizer + source firewall + freshness
4. implement ProtocolGraph + DepthRouter + merge
5. encode initial category protocol/evaluator registries
6. implement quality record
7. implement bounded optimizer
8. create adversarial + ablation + benchmark fixtures
9. add Rust portable parity
10. wire WASM canonical path
11. add Simple/Inspect/Pro website UX
12. fresh regression/evidence pack

## 26. Success criterion

SPE should be able to take a raw request and deterministically produce a prompt artifact that:

- preserves user intent
- identifies only the context actually needed
- applies the correct domain source policy
- records provenance/freshness/uncertainty
- applies an adaptive category-specific execution protocol
- includes explicit verification/failure behavior
- uses the existing K3 as sole technique selector
- optionally improves boundedly against measurable evaluator failures
- remains portable across target AIs
- does not overclaim proof or qualification

This design establishes the implementation target; measured superiority remains an empirical benchmark question, not a design claim.
