# K3 effect contract

Recovered before implementation. The selector already chooses techniques. This contract is only the missing binding from that choice to the compiled prompt.

## Sources

| Source | What it freezes |
|---|---|
| `a6b7e572b66632aab3837242983afec96672c148` `spe_runtime/prompt/strategy.py` | `build_prompt_strategy` is the sole writer of instruction, context, evidence, example, output, and revision modes. It does not re-decide the cognitive plan. |
| same commit `spe_runtime/prompt/build.py` | `build_prompt_artifact` renders protected constraints unchanged, then a `STRATEGY` line and one `TECHNIQUE` line per justification. Context cannot carry MUST, MUST_NOT, or protected provenance. CONFLICTED and INCOMPLETE contracts do not compile. |
| same commit `spe_runtime/prompt/techniques.py` | Nine technique ids, strength-first budget of 3, ZERO_SHOT exclusive with FEW_SHOT, `EXAMPLES_REQUIRED_BUT_MISSING` when examples are required and absent. |
| `spe_runtime/k3/registry.py` on `54a211b` | Those ids, modes, and the unimplemented XCAT set are still the live selector law. |
| `proofs/k3_runtime_closure_20260929/COMPILER_INTEGRATION.md` | The previous closure attached `technique_selection` beside the prompt and explicitly left `renderPromptArtifact` without technique-controlled body text. That is the gap this binding closes. |

## Technique to intended effect

Frozen strategy modes stay the authorization. Effect operation codes name those modes so the prompt can show them.

| Technique | Frozen authorization | Operation | Observable effect |
|---|---|---|---|
| ZERO_SHOT | `example_mode=zero_shot` | `DIRECT` | Direct instruction. No invented examples. |
| FEW_SHOT | `example_mode=few_shot` | `USE_USER_EXAMPLES` | Only `user_supplied_pattern` nodes, marked non-authoritative. |
| FEW_SHOT with no such node | `example_mode=examples_required_missing` | none; disposition `DEFERRED` | No prompt and no synthetic example. |
| ROLE_PERSONA | technique line; role text is data | `ROLE_CALIBRATION` | User role from a role key or `preference_id=brief-role`. Otherwise one marked working-default sentence that does not change the goal. |
| CONTEXTUAL | `context_mode=with_context` | `USE_CONTEXT` | Fact and non-role preference nodes, or an explicit empty-context sentence. |
| STEP_BACK | technique instruction; no separate strategy mode in G1R-7 | `STEP_BACK` | Principles and acceptance criteria. No hidden-reasoning request. |
| DECOMPOSE_PLAN_SOLVE | `instruction_mode=decompose_then_solve` when the plan kind is DECOMPOSE | `DECOMPOSE` | Visible parts `identify_subproblems; solve_parts; synthesize`. |
| RETRIEVE_REASON | `evidence_mode=local_or_supplied_evidence_only` | `ADD_GROUNDING_CONTRACT` | Supplied-evidence discipline. No network grant and no retrieval claim. |
| CRITIQUE_REVISE | `revision_mode=single_critique_revise` | `CRITIQUE_REVISE_ONCE` | One review and one revision. |
| STRUCTURED_OUTPUT | `output_mode=structured` | `STRUCTURED_OUTPUT` | Canonical value of `desired_output` or a schema-keyed graph node. |
| STRUCTURED_OUTPUT with no such node | output would otherwise be unspecified | none; disposition `DEFERRED` | No invented schema and no success prompt. |

G1R-7 rendered the effect as sentinel `STRATEGY` and `TECHNIQUE` lines. This binding keeps those authorizations and emits `## Effect: CODE` sections so the difference is visible in the current prompt. It does not add a second planner.

## Conflicts

- ZERO_SHOT together with FEW_SHOT is `INCOMPATIBLE_TECHNIQUES` and refuses a prompt.
- A CONFLICTED requirement graph refuses even if a caller labels the selection `SELECTED`.
- Selector dispositions other than `SELECTED` and `SAFE_DEFAULT` refuse. That covers `UNKNOWN`, `NO_SELECTION`, and unimplemented XCAT.
- One unrealizable selected technique (`FEW_SHOT` without an authorized example, or `STRUCTURED_OUTPUT` without an authorized structure) defers the whole success prompt.

## Eligibility

Operations are copied from the technique list K3 already returned, in that order. Deferred techniques get no operation. The binder does not read the goal sentence to decide a technique. Examples, roles, context, and schemas come from requirement-graph nodes.

## Protected invariants

Goal, hard constraints, budget, facts, provenance, and authority state are echoed into `protected_fields` and hashed as `protected_binding_digest`. Effect text is appended after that block. No operation adds a grant, weakens a MUST or MUST_NOT, turns UNKNOWN into a fact, or resolves a conflict.

## Fallback

| Condition | Result |
|---|---|
| No lawful selection, UNKNOWN, unimplemented category | `REFUSED`, `renderable=false`, `compiled_prompt=null` |
| FEW_SHOT without a graph example | `DEFERRED`, note `EXAMPLES_REQUIRED_BUT_MISSING` |
| STRUCTURED_OUTPUT without a graph structure | `DEFERRED`, note `STRUCTURED_OUTPUT_UNAUTHORIZED` |
| Invalid technique id | `REFUSED`, note `INVALID_TECHNIQUE` |
| SAFE_DEFAULT | `BOUND` with `DIRECT` only |

The web renderer prints `compiled_prompt` when the plan is `BOUND`. It throws when a plan is present and not renderable. It does not choose operations.
