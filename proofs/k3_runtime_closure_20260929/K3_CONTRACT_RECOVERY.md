# K3 contract recovery

Base: `98632cfb712d20eb7f7f6962a09f6326d7e942f6`
Branch at recovery: `cursor/spe-k3-runtime-closure-20260929`
Status: recovered from the newest explicit frozen selector, then bound to this tree.

## Sources (newest explicit selector wins)

| Source | Date | What it freezes | On this HEAD? |
|---|---|---|---|
| `a6b7e57` `spe_runtime/prompt/techniques.py` (G1R-7R) | 2026-09-18 | Sole writer `select_prompt_techniques`, technique enum, strength-first budget ≤ 3, ZERO_SHOT ⊕ FEW_SHOT, PlanningHints cannot mint MUST | No. Lineage `origin/cursor/g1r7r-k3-strategy-recheck-0d6e` through `g9` still contains the file unchanged after `a6b7e57`. Not an ancestor of HEAD. |
| `7da9404` `proofs/g1r7/*` | 2026-09-18 | Authoritative K3 evidence: determinism, writer map, compatibility matrix, vectors | Same lineage. Not on HEAD. |
| `1dd587b` | 2026-09-18 | Introduces `CognitivePlan`, `PromptStrategy`, `TechniqueSelection`, `PromptArtifact` | Superseded on that lineage by G1R-7R strength law. |
| `docs/superpowers/specs/2026-09-24-context-grounding-category-protocol-design.md` | 2026-09-24 | "Existing K3 remains the sole prompt-technique selector/writer." Forbids a second `select_prompt_techniques`. Places K3 after context capsules and the execution contract, before `PromptArtifact`. Does not replace the technique enum. | Yes. Status in file: DESIGN REVIEW. |
| Master audit `b66bc23` `proofs/spe_master_audit_20260928/03_GAP_MAP.md` P1-01 | 2026-09-28 | "K3 is not a runtime selector." Acceptance: one selector in the canonical runtime, with a test that a second selector cannot override it. | Audit commit is not this tree. The gap statement matches HEAD: no `select_prompt_techniques` symbol. |

Newest explicit selector contract: **G1R-7R (`a6b7e57`)**, retained by the 2026-09-24 design as "existing K3".

## Contradictions recorded

1. G1R-7R inputs are `ProtectedIntentContract` (requirement graph) + `CognitivePlan` + `PlanningHints`. This mission forbids implementing the Requirement Graph, and this tree has no `ProtectedIntentContract`. The 2026-09-24 diagram feeds K3 from context capsules and the execution contract instead of that graph.
2. G1R-7R fail-closed paths raise `SpeTypedError` (`K3_STRATEGY_CONFLICTED_SOURCE`, `K3_TECHNIQUE_INCOMPATIBLE`). This tree's portable ABI returns JSON. The same failures are returned as dispositions `UNKNOWN` or `NO_SELECTION`, never as task PASS.
3. G1 `PromptArtifact` rendered with structural sentinels. This tree's user-facing prompt is `renderPromptArtifact` editorial text. K3 must not rewrite that prompt body. Technique selection is advisory data beside it.
4. Web category labels (`Research`, `Coding`, `Creative`) are not XCAT ids. XCAT engines on HEAD are only `CAT:C01`, `CAT:C02`, `CAT:C03`, `CAT:C06`, `CAT:C07`.

Resolution used for implementation: keep G1R-7R technique ids, priority, budget, compatibility, justification strengths, and plan-kind order. Read immutable fields from the current protected envelope. Do not build a requirement graph. Do not scan user prose for technique tokens. Structured `semantic_key` atoms are the only strength elevators, matching G1's key scan rather than statement scan.

## A. What K3 owns

Prompt-technique and prompt-strategy selection only:

- `select_prompt_techniques` (sole technique writer)
- the cognitive plan kind used as selection input (`build_cognitive_plan` order from G1R-7)
- `build_prompt_strategy` from an already chosen plan and selection
- technique registry, budget truncation, compatibility, fail-closed disposition

## B. What K3 never owns

- Category classification or missing category engines (C04, C05, C08–C12 stay unimplemented)
- Category protocol graph compilation (`compile_execution_contract` stays the protocol owner)
- ProtectedIntent mutation: goal, hard constraints, budget, desired output, user facts, authority, provenance
- Authority grants, network, credentials, external write, execute mode, sharing approval
- Proof, qualification, privacy projection, `.spe` package identity
- Requirement Graph, quality-delta, Plan B, VALIDATE_ONLY, Massive Intent, MCP, provider adapters
- User-facing prompt prose in `renderPromptArtifact`

## C. Inputs

```text
select_prompt_techniques(
  protected,          # goal, hard_constraints, budget, desired_output, facts,
                      # authority_state, provenance; read-only
  category,           # xcat_id and/or protocol_domain_id and/or display_label
  task                # structured PlanningHints-equivalent flags and semantic_key atoms
)
```

User prose is not an input to selection. `display_label` maps only through an explicit table (`Research` → `CAT:C02`, `Analysis` → `CAT:C06`, plus protocol domain ids). It does not parse the goal.

## D. Outputs

`TechniqueSelection` public object, schema `technique_selection.v1`, selector version `k3.g1r7r`:

- `selection_id` (`tsel-` + sha256 of the G1 payload)
- `cognitive_plan_id`
- `techniques`, `justifications`, `deferred_techniques`
- `budget_truncated`, `notes`
- `disposition`: `SELECTED` | `SAFE_DEFAULT` | `NO_SELECTION` | `UNKNOWN`
- `claims_pass`: always false
- `strategy`: `prompt_strategy.v1` or null when no lawful selection
- authority effect flags, all false
- `protected_binding`: echo of the immutable fields

`SAFE_DEFAULT` is the G1 direct/zero-shot default (`HINT_DIRECT_DEFAULT`). It is a completed selector result and not a task pass.

## E. Technique registry (G1R-7R, unchanged)

| ID | Priority (lower kept first on ties) | Eligibility (structured flags / plan kind) | Incompatible |
|---|---|---|---|
| RETRIEVE_REASON | 0 | plan requires evidence or `RETRIEVE_THEN_REASON` | none frozen |
| STRUCTURED_OUTPUT | 1 | structured output required | none frozen |
| DECOMPOSE_PLAN_SOLVE | 2 | plan `DECOMPOSE` or `PLAN_THEN_EXECUTE` | none frozen |
| CRITIQUE_REVISE | 3 | plan `CRITIQUE_REVISE` or `needs_revision` | none frozen |
| FEW_SHOT | 4 | `needs_examples` and `example_count > 0` | ZERO_SHOT |
| CONTEXTUAL | 5 | `has_context` | none frozen |
| ROLE_PERSONA | 6 | non-empty `role_label` (length ref only; text is data) | none frozen |
| STEP_BACK | 7 | decompose / plan-then-execute / retrieve plan, or complexity `COMPLEX` | none frozen |
| ZERO_SHOT | 8 | not `needs_examples` | FEW_SHOT |

Status: active. Version: `technique_selection.v1`. Standard budget: 3. Truncation order: MUST > SHOULD > PREFERENCE > HINT > PLAN, then priority, then id. `MUST_NOT` atoms rank as MUST for keep-order, as in G1R-7R. No technique grants authority, weakens constraints, or invents facts.

Plan-kind order (first match): retrieval, comparison, revision, decomposition, execution-prep, structured-and-not-simple, else `DIRECT`.

Category defaults, only for implemented XCAT ids, and only when the task flag is omitted:

- `CAT:C02` omits `needs_retrieval` → true
- `CAT:C07` omits `needs_execution_prep` → true

An explicit false is not overridden. Protocol domain ids do not select techniques. `CAT:C01`, `CAT:C03`, and `CAT:C06` add no technique default.

## F. Deterministic fields

Given the same normalized category ids, task flags, semantic-key atoms, and complexity: `plan_kind`, `techniques`, `justifications`, `deferred_techniques`, `notes`, `disposition`, `selection_id`, `cognitive_plan_id`, `strategy`, `inputs_digest`. No clock, randomness, network, provider, or model call.

Whitespace around an XCAT id is stripped before selection. Goal prose, constraint statement text, and fact statement text are not selection inputs.

## G. Fields that may be UNKNOWN

`disposition = UNKNOWN` with empty techniques when:

- task `ambiguous` is true
- structured flags conflict (`force_zero_shot` and `needs_examples`)
- protected conflicts are marked (`conflicts` non-empty, or a hard-constraint statement prefixed `[CONFLICT]`)
- `protocol_domain_id` is not in the protocol registry
- examples are required, none are supplied, and no other technique qualifies

`NO_SELECTION` when `xcat_id` is outside the implemented set, including `CAT:C04`, `CAT:C05`, `CAT:C08`–`CAT:C12`. UNKNOWN and NO_SELECTION are not PASS (`claims_pass` is false). A non-empty object is not success.

## H. Category protocols

`compile_execution_contract` still owns protocol graphs. `compile_with_k3` calls that function unchanged and attaches a K3 selection beside it. K3 does not add protocol nodes and does not treat a protocol domain as an implemented XCAT engine.

## I. ProtectedIntent

The selector copies protected fields into `protected_binding` and does not write the caller object. Goal, hard constraints, budget, desired output, facts, authority state, and provenance in that echo equal the input.

## J. Authority

Selection cannot set grants, network, credentials, external write, execute authorization, or sharing. `CAT:C07` may choose `PLAN_THEN_EXECUTE` techniques. That plan is not an execution grant. Evidence mode for `RETRIEVE_REASON` is `local_or_supplied_evidence_only`.

## K. Portable output

K3 serializes as the JSON object above through `spe_api = "k3"`. It is not a `.spe` identity field. G1 states `prompt_content_digest != spe_artifact_identity`. This tree's `.spe` schema has `rendered_prompt`, `prompt_digest`, `prompt_lineage`, and `quality_record`, and no technique-selection slot. This mission does not add one.

TypeScript may display `techniques` returned by WASM. It does not choose them.
