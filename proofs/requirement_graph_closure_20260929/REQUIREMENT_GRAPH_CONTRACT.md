# Requirement Graph contract

Status: RECOVERED
Base: `ae54a1a5a17d8d568b00e94f3d128d2858c60fd8`
Branch at recovery: `cursor/spe-requirement-graph-closure-20260929`

## Source

Newest explicit frozen graph, and the only version of these files in history:

| Source | What it freezes |
|---|---|
| `3f0847d` `spe_runtime/requirements/{models,graph,conflicts}.py` | K1 graph. Introduced once. |
| `a6b7e57` (G1R-7R) | Same files, unchanged. K3 reads `ProtectedIntentContract.graph`. |
| `proofs/g1r3/G1R3_REPORT.md` at `a6b7e57` | Node, edge, identity, conflict, and authority laws. |
| `spe_runtime/proof/snapshot.py` at `a6b7e57` | Digest `rg-` + sha256 of `graph.to_dict()`. |

No later commit edits `graph.py`, `models.py`, or `conflicts.py`. There is no second frozen graph to choose. This tree had no Requirement Graph; K3 used a protected-envelope bridge.

Contradiction recorded, then closed by the newest explicit graph:

- G1R-7R feeds K3 a `ProtectedIntentContract` whose body is the graph.
- The 2026-09-24 context-grounding design feeds K3 from capsules and the execution contract.
- The K3 runtime mission kept the G1R-7R selector and did not build the graph.

This mission keeps the G1R-3 graph and projects the current protected envelope into it. It does not replace ProtectedIntent and it does not give the graph a new node-type enum.

## Owner

`build_requirement_graph` in `spe_runtime/requirements/project.py`.

Python is the semantic oracle. Rust `spe-core-rs` and WASM call that same projection. TypeScript does not construct the graph.

## What the graph owns

Structured requirement relationships projected from defensible inputs:

- goal text
- hard constraints
- explicit budget
- desired output
- facts
- provenance / source records
- acceptance criteria when that field is already present
- explicit unknowns
- user preferences
- non-authoritative examples
- category / context references supplied by the caller
- contradiction records

## What the graph does not own

User-intent storage, category selection, K3 technique selection, authority, provider selection, execution, quality adjudication, prompt prose.

Flow:

```text
ProtectedIntent → Requirement Graph → category context → K3
```

The graph is not a rewritten user intent.

## Node type

Frozen name: `RequirementAtom`.

There is no frozen `GOAL` / `BUDGET` / `FACT` node-type enum. Roles are `semantic_key`. Strength is `RequirementKind`:

| Kind | Meaning |
|---|---|
| `MUST` | Hard obligation. Used for goal, hard constraints, budget, non-example desired output, explicit acceptance criteria. |
| `MUST_NOT` | Hard prohibition when the structured constraint kind is already `MUST_NOT`. Still hard. |
| `SHOULD` | Non-hard record carrier for facts, provenance records, and unknowns. Not a hard requirement. Unknowns are never `MUST` (frozen `K1_INVALID_REQUIREMENT`). |
| `PREFERENCE` | User preference, non-authoritative example, category reference. Two preferences are not a hard conflict. |

Role keys, chosen so they do not substring-match the frozen K3 `KEY_HINTS` table:

| Input | `semantic_key` |
|---|---|
| `goal` string | `goal` |
| hard constraint without its own key | `hard_constraint:<source_ref>` |
| hard constraint with an explicit `semantic_key` | that key, unchanged |
| `budget` field | `budget` |
| desired output that is not an example | `desired_output` |
| example / `USER_SUPPLIED` / `NON-AUTHORITATIVE` | `user_supplied_pattern` |
| fact | `fact` |
| provenance record | `provenance_record` |
| uncertainty | `unknown` |
| user preference | `user_preference` |
| `acceptance_criteria` field | `acceptance_criterion` |
| category argument or `category_trace` | `category_ref` |

Distinct hard constraints are different slots. They are not alternative values of one key, so two compatible obligations do not become `MUTUALLY_EXCLUSIVE`. A caller-supplied `semantic_key` of `budget` still shares the budget slot and can conflict. String constraints use `source_ref` `stmt-` plus the first 16 hex chars of sha256(canonical JSON of the statement).

An explicit structured `semantic_key` on a hard constraint is kept, including keys K3 already treats as technique tokens. Prose is not scanned for those tokens.

## Edge type

Frozen name: `CONFLICTS_WITH` only. Other edge types are rejected.

No `REQUIRES`, `CONSTRAINS`, `SUPPORTED_BY`, `SATISFIES`, `DERIVED_FROM`, or `DEPENDS_ON` edge. Those names are not in the frozen graph. Support and derivation are carried by `provenance` and `source_ref` on the atom.

## Identity

```text
req- + sha256(canonical_dumps({semantic_key, kind, value, source_ref}))[:32]
```

Provenance, statement, clock, and random ids are not part of identity. `source_ref` is.

- Goal: `source_ref` null.
- Explicit budget field: `source_ref` `explicit-budget`.
- Hard constraint object: `constraint_id` when it is a string, else null.
- Other records: their existing id field when it is a string.

## Ordering and digest

Canonical JSON sorts object keys. Conflict pairs are scanned in `requirement_id` order so summaries do not depend on dict insertion. That is a determinism closure of the frozen detector: conflict ids were already order-independent; summaries now follow sorted ids. Conflict types are unchanged.

`graph_digest` is `rg-` plus the sha256 of the canonical graph object `{nodes, edges}`, matching `requirement_graph_digest` in the frozen snapshot helper.

## Projection law

The builder reads the protected envelope and an optional category object. It returns a new graph. It does not write the caller's objects.

Included only when present:

- non-empty `goal` string
- each hard constraint
- `budget` when the field is present and not null, including `0`
- `desired_output` when not null
- each fact, provenance record, uncertainty, preference, acceptance criterion
- category ids actually supplied

Not included:

- authority grants, execution grants, proof, quality, technique choices
- facts inferred to fill gaps
- numbers parsed out of budget prose
- a second obligation invented from an example

Budget value is copied exactly. Kind is `MUST`. A present budget is not stored as `PREFERENCE` and is not dropped. Strings such as `"$2,000"`, `"under $2,000"`, `"up to $2,000"`, `"exactly $2,000"`, and `"No paid ads"` stay those strings when that is the supplied value. No universal amount parser.

`input_budget`, the `budget` atom value, and `output_bound_budget` are the same value. A second budget atom with a different value is kept beside it and marked unresolved. The output bound does not switch to that other value.

Hard-constraint entries stay `MUST` or `MUST_NOT`. A `strength` or `kind` of `PREFERENCE` or `SHOULD` inside `hard_constraints` is not allowed to downgrade the atom.

Desired output stays `MUST` unless the value is marked as an example (`EXAMPLE / USER_SUPPLIED` or `NON-AUTHORITATIVE`). An example is `user_supplied_pattern` + `PREFERENCE` and does not replace the goal.

Untagged facts keep provenance `UNKNOWN`. A provenance record whose source text contains `user` is `USER_EXPLICIT`. Any other non-empty source is `EXTERNAL_EVIDENCE`. Source-derived facts are not retagged as user requirements.

## Contradictions

Detector: frozen `detect_conflicts`. No second engine.

- same key, `MUST` and `MUST_NOT`, same value → `MUST_MUST_NOT`
- same key, two `MUST` values → `MUTUALLY_EXCLUSIVE`, or `EXPLICIT_CONFIRMED` / `INFERENCE_CONFLICT` under the frozen provenance split
- protected versus lower provenance, different value, same key → `INFERENCE_CONFLICT`
- two `PREFERENCE` values are not a hard conflict
- same `requirement_id` is not a conflict

Resolution state remains `UNRESOLVED`. A statement prefixed `[CONFLICT]`, or a non-empty `conflicts` list, adds an `EXPLICIT_CONFIRMED` record. Nothing picks a winner.

Validity: no nodes → `INCOMPLETE`; unresolved hard conflicts → `CONFLICTED`; otherwise `VALID`.

## Provenance

Frozen enum: `USER_EXPLICIT`, `USER_CONFIRMED`, `SYSTEM_REQUIRED`, `INFERRED`, `MODEL_PROPOSED`, `SPE_SUGGESTED`, `EXTERNAL_EVIDENCE`, `UNKNOWN`.

Protected provenances are the first three. Lower provenances cannot replace them. This builder does not run `propose_requirement` or `confirm_requirement` and does not upgrade provenance.

## K3 consumption

K3 still calls `select_prompt_techniques`. The selector builds this graph and attaches it as `requirement_graph`.

- Unresolved hard conflicts → disposition `UNKNOWN`. K3 does not resolve them.
- Technique strength still uses structured `semantic_key` atoms. Graph atoms participate only when their key matches the existing `KEY_HINTS` table. Role keys above do not. Goal prose is not scanned.
- `selection_id` stays the technique-payload digest. The graph has its own `graph_digest`.
- Protected fields echoed in `protected_binding` stay equal to the input.
- No new techniques. No authority effect. No prompt-prose rewrite.

## Portable `.spe`

`schemas/spe_artifact.schema.json` has no requirement-graph field.

`PORTABLE_GRAPH_BINDING = DEFERRED_BY_SCHEMA`

The compilation sidecar `compile_with_k3` references the graph. The `.spe` document is not redesigned here.

## Authority

The graph does not write grants, network, credentials, external write, or execution authorization. `USER_CONFIRMED` is not `EXECUTION_AUTHORIZED`.
