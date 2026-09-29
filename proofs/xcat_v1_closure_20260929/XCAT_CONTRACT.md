# XCAT v1 Canonical Contract Recovery — 2026-09-29

**Mission:** SPE Ω RELEASE TASK 56 — XCAT v1 CANONICAL 12-CATEGORY RUNTIME CLOSURE  
**Base branch:** `cursor/spe-k3-effect-binding-20260929`  
**Base SHA:** `04bc003ce358fc72279ce40cb96fa2990f8033c6`  
**Work branch:** `cursor/spe-xcat-v1-closure-20260929`  
**Verdict:** `XCAT_CONTRACT_RECOVERY_HOLD_C04_C05_C08_C09_C10_C11_C12`  
**Phase B:** NOT ENTERED (hard gate — unrecovered protocols)

Time law honored: MOVE FAST, BUT NEVER INVENT FROZEN SEMANTICS.

---

## Registry (frozen ID + name only)

Source: `data/category_registry_v1.json` @ `6c7fa1d` / HEAD  
Schema companion `schemas/category_registry.schema.json` is a **STUB** (`additionalProperties: true`, description "not yet implemented").

| ID | Name | Engine present @ HEAD | Protocol status |
|----|------|----------------------|-----------------|
| CAT:C01 | Decide | yes `c01_decide/` | RECOVERED |
| CAT:C02 | Research | yes `c02_research/` | RECOVERED |
| CAT:C03 | Communicate | yes `c03_communicate/` | RECOVERED |
| CAT:C04 | Plan | **no** | **NOT_RECOVERED** |
| CAT:C05 | Verify | **no** | **NOT_RECOVERED** |
| CAT:C06 | Analyze | yes `c06_analyze/` | RECOVERED |
| CAT:C07 | Execute | yes `c07_execute/` | RECOVERED |
| CAT:C08 | Recover | **no** | **NOT_RECOVERED** |
| CAT:C09 | Privacy | **no** | **NOT_RECOVERED** |
| CAT:C10 | Authority | **no** | **NOT_RECOVERED** |
| CAT:C11 | Provenance | **no** | **NOT_RECOVERED** |
| CAT:C12 | Capability | **no** | **NOT_RECOVERED** |

Fixtures: `data/xcat_fixtures_v1.jsonl` = empty (0 bytes).  
Mutations: `data/xcat_mutations_v1.jsonl` = empty (0 bytes).

K3 explicit sets @ HEAD (`spe_runtime/k3/registry.py`):
- `IMPLEMENTED_XCAT` = {C01, C02, C03, C06, C07}
- `UNIMPLEMENTED_XCAT` = {C04, C05, C08, C09, C10, C11, C12} → `NO_SELECTION`

---

## Cross-cutting recovered law (X01–X10)

**CONTRACT SOURCE:** `spe_runtime/xcat/invariants.py`, `spe_runtime/xcat/handoff.py`, `docs/implementation/xcat-core-s1.md`  
**SOURCE SHA:** `6c7fa1d` (intro) + `2068f89` (X05–X07 merge-gate harden) retained through HEAD `04bc003`

| ID | Law | Enforcement |
|----|-----|-------------|
| X01 | Hard constraints never silently weaken/disappear | `validate_constraint_monotonicity` |
| X02 | Provenance never disappears | `validate_provenance_monotonicity` |
| X03 | Uncertainty never silently disappears | `validate_uncertainty_preservation` |
| X04 | User preferences immutable | `validate_preference_immutability` |
| X05 | Facts require provenance | `validate_facts_have_provenance` |
| X06 | Analysis ≠ recommendation | `validate_analysis_not_recommendation` |
| X07 | Recommendation ≠ execution | `validate_recommendation_not_execution` |
| X08 | Communication cannot rewrite locked semantics | `validate_no_semantic_rewrite` |
| X09 | Authority no self-escalate without external authority event | `validate_authority_non_escalation` |
| X10 | FAIL/UNKNOWN cannot become PASS; failures cannot vanish | `validate_failure_preservation` / `failures_not_laundered` |

Handoff results ONLY: `VALID | REFUSE | BLOCKED | REVALIDATION_REQUIRED`  
Never: `PROMOTE | EXECUTED | VERIFIED_SUCCESS`

Envelope fields (schema `schemas/xcat_envelope.schema.json`):  
`envelope_id, goal_identity, facts, provenance, uncertainties, hard_constraints, user_preferences, analysis, recommendation, rendering, authority_state, execution_grants, failures, taint_labels, sensitivity_labels, category_trace`

Category ID pattern: `^CAT:C(0[1-9]|1[0-2])$` — no C13+.

---

## CAT:C01 — Decide — RECOVERED

- **CONTRACT SOURCE:** `docs/implementation/xcat-c02-c06-c01-c03-s2.md`; `spe_runtime/categories/c01_decide/{engine,validate,models}.py`; integration tests
- **SOURCE SHA:** `a8078e8` (Sprint 2) + `43281c8` (merge-gate)
- **STATUS:** RECOVERED
- **INPUTS:** prior envelope (typically after C06 analysis); `recommendation` mapping
- **OWNED OUTPUTS:** `recommendation` (+ append `CAT:C01` to `category_trace`)
- **PERMITTED MUTATIONS:** set/replace `recommendation` only; default `kind=recommendation`
- **FORBIDDEN MUTATIONS:** authority/execution kwargs; `kind=analysis`; forbidden payload keys (permit/permits/verified_outcome/verified_success/execution_grant/authority/receipt/EXECUTED/VERIFIED_SUCCESS/PROMOTE); mint/change `execution_grants`; change facts/provenance/uncertainties/analysis; introduce rendering
- **PRECONDITIONS:** recommendation payload present after run; must pass `validate_c01_output`
- **FAILURE STATES:** `ValueError` ownership/validation; handoff REFUSE/BLOCKED on invariant breach
- **UNKNOWN BEHAVIOR:** none claimed beyond fail-closed ownership
- **AUTHORITY/PROVENANCE BEHAVIOR:** authority must remain unchanged; does not write provenance
- **HANDOFF RULES:** typical chain C02→C06→C01→C03; `validate_handoff` between stages
- **ORDERING/PRECEDENCE:** after Analyze, before Communicate in Sprint 2 chain
- **MULTI-CATEGORY RULES:** single writer of `recommendation` among XCAT engines (semantic_writer_map: owner K3 / writer c01)
- **K3 RELATIONSHIP:** `CAT:C01` ∈ IMPLEMENTED_XCAT; may be selected as context; does not itself select techniques

## CAT:C02 — Research — RECOVERED

- **CONTRACT SOURCE:** Sprint 2 doc; `c02_research/*`; optional `research_from_grounding`
- **SOURCE SHA:** `a8078e8` + later grounding bridge `2e921ac` (lineage retained)
- **STATUS:** RECOVERED
- **INPUTS:** envelope; `facts`, `provenance`, `uncertainties` tuples; or `GroundingBundle` via bridge
- **OWNED OUTPUTS:** append-only facts + provenance + research uncertainties (+ trace)
- **PERMITTED MUTATIONS:** append facts (must have `provenance_ids` ⊆ known provenance), provenance, uncertainties
- **FORBIDDEN MUTATIONS:** analysis/recommendation/authority kwargs; change rendering; mint grants; forbidden keys
- **PRECONDITIONS:** every fact has non-empty provenance_ids resolving to known provenance
- **FAILURE STATES:** ownership ValueError; X05 fail → handoff refuse
- **UNKNOWN BEHAVIOR:** none invented
- **AUTHORITY/PROVENANCE BEHAVIOR:** writes envelope provenance records (XCAT layer); must not escalate authority
- **HANDOFF RULES:** first stage in Sprint 2 chain
- **ORDERING:** before C06
- **MULTI-CATEGORY:** sole XCAT writer of facts/provenance/uncertainty in implemented set
- **K3:** ∈ IMPLEMENTED_XCAT; display label `"Research"` → `CAT:C02` in `DISPLAY_LABEL_XCAT`

## CAT:C03 — Communicate — RECOVERED

- **CONTRACT SOURCE:** Sprint 2 doc; `c03_communicate/*`
- **SOURCE SHA:** `a8078e8` + `43281c8`
- **STATUS:** RECOVERED
- **INPUTS:** envelope with recommendation; `rendering` mapping
- **OWNED OUTPUTS:** `rendering` (+ trace)
- **PERMITTED MUTATIONS:** set rendering only
- **FORBIDDEN MUTATIONS:** mutate recommendation; strengthen certainty CONDITIONAL→CERTAIN vs recommendation; change facts/provenance/uncertainties/analysis; authority/grants; forbidden keys; semantic rewrite of goal/constraints (X08)
- **PRECONDITIONS:** rendering non-null after run
- **FAILURE STATES:** ownership ValueError
- **AUTHORITY/PROVENANCE:** unchanged
- **HANDOFF:** after C01 in Sprint 2 chain
- **K3:** ∈ IMPLEMENTED_XCAT

## CAT:C06 — Analyze — RECOVERED

- **CONTRACT SOURCE:** Sprint 2 doc; `c06_analyze/*`
- **SOURCE SHA:** `a8078e8` + `43281c8`
- **STATUS:** RECOVERED
- **INPUTS:** envelope (post-research); `analysis` mapping
- **OWNED OUTPUTS:** `analysis` (+ trace)
- **PERMITTED MUTATIONS:** set/update analysis only; analysis must not be recommendation-shaped (`kind=recommendation` / action fields rejected)
- **FORBIDDEN MUTATIONS:** manufacture recommendation; change facts/provenance/uncertainties; mint grants; introduce rendering
- **PRECONDITIONS:** analysis present; X06 field distinctness
- **FAILURE STATES:** ownership ValueError
- **HANDOFF:** after C02, before C01
- **K3:** ∈ IMPLEMENTED_XCAT; display label `"Analysis"` → `CAT:C06`

## CAT:C07 — Execute — RECOVERED

- **CONTRACT SOURCE:** `docs/implementation/xcat-c07-authority-s3.md`; `c07_execute/*`; `spe_runtime/authority/*`; execution outcomes
- **SOURCE SHA:** `f8d7bf2` + `967d2c9` merge-gate
- **STATUS:** RECOVERED
- **INPUTS:** envelope; external immutable `AuthorityGrant`; forms `ExecutionIntent` under compatible grant
- **OWNED OUTPUTS:** category_trace append; execution intent recording; outcome transitions via K2 execution modules (NOT authority minting)
- **PERMITTED MUTATIONS:** append trace; drive outcome state machine under grant; local adapter `WRITE_LOCAL_TEMP_FILE` under tempfile with digest
- **FORBIDDEN MUTATIONS:** mint/expand authority or execution_grants; mutate recommendation/analysis/rendering/facts/provenance/uncertainties/constraints/preferences; network; claim VERIFIED_SUCCESS without verified evidence; amount_max nested escalate; expiry `now >= expires` refuse; blind UNKNOWN→FAILED retry; PARTIAL→COMPLETED without evidence
- **PRECONDITIONS:** compatible external grant; recommendation SEND + C03 rendering + authority NONE (no grant) = C07 BLOCKED
- **FAILURE / OUTCOME STATES:**  
  `NOT_EXECUTED → DISPATCHING → {OUTCOME_UNKNOWN, PARTIAL, COMPLETED, FAILED, RECONCILIATION_REQUIRED}`  
  Illegal: UNKNOWN→FAILED blind retry; PARTIAL→COMPLETED; Tool OK ≠ VERIFIED_SUCCESS; UNKNOWN→RECONCILIATION_REQUIRED allowed; NOT_EXECUTED retry eligible
- **AUTHORITY:** C07 never mints authority; consume via K4 `consume_grant` + EffectLedger
- **HANDOFF:** after Communicate when execution requested; authority external
- **K3:** ∈ IMPLEMENTED_XCAT
- **COST LAW (Sprint 3):** paid=NO, APIs=NO, hosting=NO

---

## CAT:C04 — Plan — NOT_RECOVERED

- **CONTRACT SOURCE:** name only in `data/category_registry_v1.json`
- **SOURCE SHA:** registry introduced `6c7fa1d`
- **STATUS:** NOT_RECOVERED
- **INPUTS / OWNED OUTPUTS / MUTATIONS / PRECONDITIONS / FAILURE STATES / HANDOFF / ORDERING / MULTI-CATEGORY:** **UNKNOWN — no normative XCAT protocol found**
- **RELATED (non-XCAT) surfaces that MUST NOT be silently promoted to C04:**
  - K3 `CognitivePlan` / `PlanningHints` / plan-kind order (`proofs/k3_runtime_closure_20260929/K3_CONTRACT_RECOVERY.md`, G1R-7R `a6b7e57`)
  - Requirement Graph / protected intent planning fields
  - UI/product “Plan a …” prompt copy (hero fixtures) — not category engines
- **AUTHORITY/PROVENANCE BEHAVIOR:** unknown for XCAT C04
- **K3 RELATIONSHIP:** ∈ UNIMPLEMENTED_XCAT → `NO_SELECTION` (adversarial vectors A07)
- **UNKNOWN BEHAVIOR:** entire protocol

## CAT:C05 — Verify — NOT_RECOVERED

- **CONTRACT SOURCE:** name only in registry
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT) — do not invent C05 from these:**
  - K2 `verification receipt` / `spe_runtime/proof/verify.py` / `proof/receipt.py` (Ring-0 owner K2 per RING0_WORKING_CONTRACT @ `bcb5c3d`/`c700494`)
  - C07 outcome ≠ VERIFIED_SUCCESS law (Sprint 3) — constrains Execute, does not define Verify category I/O
- **K3:** UNIMPLEMENTED → NO_SELECTION (A08)
- All protocol fields: UNKNOWN

## CAT:C08 — Recover — NOT_RECOVERED

- **CONTRACT SOURCE:** name only in registry
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT):**
  - K7 / Ring-1 `schemas/recovery_plan.schema.json` + `spe_runtime/recovery/plan.py` — durable journal recovery; description explicitly “K7 — durable Ring-1 recovery plan”, not CAT:C08
  - G3 journal recovery (`798927d`, `6688694`) — Ring-1, not XCAT category
- **K3:** UNIMPLEMENTED → NO_SELECTION (A09)
- All protocol fields: UNKNOWN

## CAT:C09 — Privacy — NOT_RECOVERED

- **CONTRACT SOURCE:** name only; `schemas/privacy_label.schema.json` = STUB
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT):**
  - K4 owns `privacy_projection` / egress (`ce0d9f7` G1R-5; RING0_WORKING_CONTRACT: K4 = Authority + Privacy)
  - Grounding `PrivacyClass` / privacy firewall (`720b7fd`) — grounding layer, not XCAT C09 engine
  - Product “privacy” UI/copy waves — not XCAT protocol
- **CONFLICT RISK:** inventing C09 as writer of privacy facts would duplicate K4 (CATEGORY != KERNEL OWNER law)
- **K3:** UNIMPLEMENTED → NO_SELECTION (A10)
- All protocol fields: UNKNOWN

## CAT:C10 — Authority — NOT_RECOVERED

- **CONTRACT SOURCE:** name only; `schemas/authority_state.schema.json` = STUB
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT):**
  - K4 owns grants, permission scope, revocation, `AuthorityGrant`, `apply_authority_event` (G1R-2 `bcb5c3d`)
  - Sprint 3 AuthorityGrant is **external injection** consumed by C07 — not an XCAT C10 category engine
  - Envelope `authority_state` field exists; no C10 writer module ever existed in `spe_runtime/categories/`
- **CONFLICT RISK:** C10 as authority writer would duplicate K4 / violate “C07 never mints” / DATA!=AUTHORITY
- **K3:** UNIMPLEMENTED → NO_SELECTION (A11)
- All protocol fields: UNKNOWN

## CAT:C11 — Provenance — NOT_RECOVERED

- **CONTRACT SOURCE:** name only; `schemas/provenance_record.schema.json` = STUB
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT):**
  - C02 already writes envelope `provenance` under XCAT ownership
  - K0/K1 provenance rules (`spe_runtime/provenance/*`, G1R-3 `3f0847d`)
  - semantic_writer_map: `facts_provenance_uncertainty` canonical owner K1 / writer C02
- **CONFLICT RISK:** C11 as second provenance writer violates SINGLE WRITER LAW vs C02/K1
- **K3:** UNIMPLEMENTED → NO_SELECTION (A12)
- All protocol fields: UNKNOWN

## CAT:C12 — Capability — NOT_RECOVERED

- **CONTRACT SOURCE:** name only; `schemas/capability_manifest.schema.json` = STUB
- **STATUS:** NOT_RECOVERED
- **RELATED (non-XCAT):**
  - K3 requirement “capability routing (prompt/strategy)” in RING0_WORKING_CONTRACT
  - K7 `capability_status` writer (`spe_runtime/portability/capability.py`) per semantic_writer_map
  - `spe_runtime/providers` CapabilityNeed ABI — explicitly “never an AuthorityGrant”
  - `spe_runtime/capabilities/` marked RETIRE empty stub in module_disposition (G1)
  - Product protocol registry / auto-routing amendment (`a858eb0`, `59049d7`) — **display/product protocols**, not XCAT C12
- **CONFLICT RISK:** C12 as capability oracle vs K3/K7/providers
- **K3:** UNIMPLEMENTED → NO_SELECTION (A13)
- All protocol fields: UNKNOWN

---

## CONTRACT_CONFLICTS (summary)

See `CONTRACT_CONFLICTS.md` for full table. Material unresolved conflicts all involve missing categories vs Ring-0 owners. Precedence cannot resolve into an XCAT protocol because no normative XCAT contract exists for C04/C05/C08–C12 — only names + kernel-adjacent modules.

## UNRESOLVED_ITEMS

1. No frozen inputs/outputs/mutations/handoff/ordering for C04, C05, C08, C09, C10, C11, C12.
2. Empty xcat fixtures/mutations corpora.
3. Stub schemas: privacy_label, capability_manifest, provenance_record, authority_state, category_registry.
4. Category↔Kernel relationship for C05/C08/C09/C10/C11/C12 never frozen (invoke vs request vs project vs validate vs transport).
5. Routing rules for selecting unimplemented categories beyond K3 `NO_SELECTION` — no LLM classifier authorized; no deterministic inference contract recovered for inventing those engines.
6. Display labels (Writing/Coding/…) are UI protocols (`DISPLAY_LABEL_PROTOCOL`), not XCAT IDs — only Research→C02 and Analysis→C06 are mapped in `DISPLAY_LABEL_XCAT`.

## HARD GATE RESULT

Because C04, C05, C08, C09, C10, C11, C12 are **NOT_RECOVERED**, Phase B (implementation, Rust/WASM port, mutant corpus expansion, K3 IMPLEMENTED_XCAT expansion) is **FORBIDDEN**.

Outcome: **XCAT_CONTRACT_RECOVERY_HOLD_C04_C05_C08_C09_C10_C11_C12** (truth-preserving success).

---

## APPENDIX — Task 56B DOMAIN resolution (2026-09-29)

**Does not rewrite** the Task 56 HOLD body above. Task 56A did **not** approve DOMAIN; approval is the separate founder ratification (`FOUNDER_XCAT_V1_RATIFICATION.md`, commit `b208554`).

| Field | Value |
|-------|-------|
| 56B base SHA | `fc0838da6222106e98df9aa96b2f3b4b5be93a42` |
| Taxonomy | DOMAIN |
| Registry version | old=`1` → new=`2` |
| Normative names | See `XCAT_V1_CANONICAL_REGISTRY.md` |
| Engines | C01–C12 DOMAIN specialty modules present |
| K3 | `IMPLEMENTED_XCAT=C01–C12`; technique/effect freeze retained |
| Mutations | M1–M16 killed |
| Parity | Python↔Rust↔WASM = 0 mismatches |
| WASM | `d87a9d2c…` (1022683 B, imports=0); historical `48ad95f5…` does not prove XCAT |
| PR | #56 draft — do not merge |
| Hosting | FORBIDDEN |

Legacy v1 names remain **migration metadata only**. Phase B DOMAIN runtime is authorized by founder ratification + this appendix, not by inventing protocols under the old HOLD names.
