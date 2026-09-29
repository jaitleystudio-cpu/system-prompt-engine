# Task57R-F3D default category contract

**Base SHA:** `02f0318932ed3cd64b1f81a4ef6470911d553b0d`
**Date:** 2026-09-29
**Disposition:** HOLD
**Production source changed:** no

Inspection only. No router, registry, K3, Quality, or UI change follows from this document.

## A. UI template labels

| Owner | What it owns |
| --- | --- |
| `packages/web-runtime/src/targets.ts` `CATEGORIES` | Product template ids, including `"AI Assistant"` |
| `apps/web/src/App.tsx` | Default Create state `category = "AI Assistant"` |
| `packages/web-runtime/src/envelope.ts` `buildAbiFixture` | Copies the template into `payload.category_trace[].category` with note `"UI category route — rendering hint only"` |
| `apps/web/src/engine/k3Transport.ts` `requestK3Binding` | Sends `category: { display_label }` only. It does not send `xcat_id` |
| `spe_runtime/k3/registry.py` `DISPLAY_LABEL_PROTOCOL` | `"AI Assistant" → "general"`. Mirrored in `portable/spe-core-rs/src/k3.rs` `display_protocol` |

These strings are presentation and protocol labels. They are not XCAT ids.

## B. Canonical XCAT evidence

| Owner | What it owns |
| --- | --- |
| `data/category_registry_v1.json` | `version = "2"`, `taxonomy = "DOMAIN"`, ids `CAT:C01`–`CAT:C12` |
| `spe_runtime/xcat/models.py` `CATEGORY_IDS` | The only strings the router accepts as categories |
| `spe_runtime/xcat/router.py` `route_mission_stage` | Sole CategoryRouterIR. Twin `xcat.router.v1` |
| `portable/spe-core-rs/src/xcat.rs` `route_mission_stage` | Same law. Entry `spe_api=xcat`, `op=route` |
| `spe_runtime/k3/registry.py` `DISPLAY_LABEL_XCAT` | Explicit product bridges only: `Research → CAT:C02`, `Analysis → CAT:C06` |

Router law, already frozen in `proofs/xcat_v1_closure_20260929/CATEGORY_ROUTING.md`:

- Route from explicit `category_ref` / `primary_category` / `stage_category` / `xcat_id` / `stage.*` / `category_evidence[]` when the value is a `CAT:Cxx` id.
- No evidence → `NEEDS_DISAMBIGUATION`, `primary_category = null`.
- Self-selected category without supporting evidence → `UNKNOWN`.
- Never default to `CAT:C01`.
- Prose goals and product UI labels are not category evidence.

`spe_runtime/categories/domain.py` `apply_domain_category` specializes a payload only after a category id already exists. It does not choose the id.

## C. ProtectedIntent and Requirement Graph

`spe_runtime/requirements/project.py` `build_requirement_graph` stores `semantic_key=category_ref` from:

1. `category_trace` objects, copied as given.
2. A category mapping's `xcat_id`, `protocol_domain_id`, and `display_label`, copied as given.

The builder does not parse goal prose into a category id. The module states that it does not parse prose into new obligations.

On the default Create envelope, the graph therefore contains:

- `category_ref.value = { "display_label": "AI Assistant" }`
- `category_ref.value = { "category": "AI Assistant", "note": "UI category route — rendering hint only" }`

Neither value is a member of `CATEGORY_IDS`. The goal atom and the user-request fact remain free text.

## D. Can CategoryRouterIR consume that evidence?

Yes, when the evidence is already a canonical id. Observed on this SHA with `route_mission_stage`:

| Evidence | Disposition | Primary |
| --- | --- | --- |
| `{}` | `NEEDS_DISAMBIGUATION` | null |
| `{ "display_label": "AI Assistant" }` | `NEEDS_DISAMBIGUATION` | null |
| `{ "category_ref": "Research" }` | `NEEDS_DISAMBIGUATION` | null |
| `{ "goal": "<research prose>" }` | `NEEDS_DISAMBIGUATION` | null |
| `{ "stage": { "category_ref": "AI Assistant" } }` | `NEEDS_DISAMBIGUATION` | null |
| `{ "self_selected_category": "CAT:C01" }` | `UNKNOWN` | null |
| `{ "category_ref": "CAT:C02" }` | `ROUTED` | `CAT:C02` |

The default graph nodes are not inputs the router can turn into `ROUTED`. K3 does not call the router. `select_prompt_techniques` resolves category only through `_resolve_category`: explicit `xcat_id`, else `DISPLAY_LABEL_XCAT`. Observed:

| `display_label` | K3 disposition | `xcat_id` | protocol |
| --- | --- | --- | --- |
| `AI Assistant` | `SAFE_DEFAULT` | null | `general` |
| `Research` | `SELECTED` | `CAT:C02` | `research` |

Quality `subject_from_k3` copies that null through `_normalize_category_id` into `protected_intent.category` and `xcat.active_category`. An empty active category fails `bind:xcat` (`evaluate_obligations`). Reconstruction then treats the unbound category as unrepairable (`UNREPAIRABLE_BINDING`) and stays `UNRESOLVED`. That is why a generic label blocks Quality. It is not a missing C01 default.

## E. Rust / WASM routing API

`portable/spe-core-rs/src/lib.rs` dispatches `spe_api`:

| API | Category operation |
| --- | --- |
| `xcat` / `route` | `route_mission_stage` — explicit ids only |
| `xcat` / `apply` | Payload specialization for a supplied `category_id` |
| `xcat` / `validate_taxonomy` | Version check. Current version is `"2"` |
| `k3` / `select` | `resolve_category` — same display-label maps as Python |
| `requirement_graph` | Projects `category_ref` atoms; does not mint an id |
| `quality` | Normalizes `category_context.xcat_id`; does not route |

No WASM operation accepts a goal string and returns `CAT:Cxx`.

## Why a default-task classifier is a new contract

The preferred chain is already the lawful one:

```
ProtectedIntent / Requirement Graph
  → explicit category evidence
  → CategoryRouterIR
  → XCAT
  → K3
  → Quality
```

Default Create never places a `CAT:Cxx` on that chain. The user's goal is prose. Turning that prose into a category requires one of the forbidden moves:

- Map `"AI Assistant"` to `CAT:C01`, `CAT:C02`, `CAT:C06`, or any other fixed id.
- Change the default template to Research or Analysis so `DISPLAY_LABEL_XCAT` fires.
- Add a TypeScript or React keyword table.
- Call an LLM or network classifier.
- Reuse `spe_runtime/grounding/need.py` `_route`. That function is a second router. It matches a short keyword list, defaults unmatched text to protocol domain `general`, and emits a context-need domain id, not an XCAT id. Promoting it to category authority would invent a mapping the founder registry does not contain.

`NEEDS_DISAMBIGUATION` remains the lawful result when evidence is insufficient. Forcing a category so Quality can return `PASS` would fake closure.

Explicit `Research` and `Analysis` templates stay on `DISPLAY_LABEL_XCAT`. This hold does not remove those bridges.

## Hold

**HOLD:** the generic default has no canonical XCAT evidence, and the frozen router cannot derive one from the task without a new semantic contract.

No F3D mutants, WASM rebuild, browser repair, or Task58 work is authorized by this document.
