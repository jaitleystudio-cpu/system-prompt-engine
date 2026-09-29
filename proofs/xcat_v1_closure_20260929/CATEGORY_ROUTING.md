# Category routing — CategoryRouterIR

**Date:** 2026-09-29  
**Task:** 56B  
**Code:** `spe_runtime/xcat/router.py` (`route_mission_stage`)  
**Twin version:** `xcat.router.v1`

## Law

Mission-stage routing is **deterministic**, **offline**, and **evidence-only**.

- No LLM classifier
- No network
- No randomness
- No default to `CAT:C01` when evidence is missing
- Self-selected category without supporting evidence → rejected (`UNKNOWN`)

## Inputs (explicit evidence only)

Collected keys (top-level or under `stage`):

- `category_ref` / `primary_category` / `stage_category` / `xcat_id`
- optional `category_evidence[]`
- optional `secondary_categories`
- optional `cross_category_dependencies`

Prose goals or product UI labels alone are **not** category evidence.

## Dispositions

| Disposition | When |
|-------------|------|
| `ROUTED` | ≥1 explicit valid `CAT:Cxx` evidence ref |
| `NEEDS_DISAMBIGUATION` | no explicit category evidence |
| `UNKNOWN` | self-selected without evidence (or invalid refusal path) |

Primary category is the first valid candidate. Secondaries are ordered extras. Routing receipt includes content-addressed `routing_id` (SHA-256 of canonical evidence JSON).

## Fail-closed guarantees (tested)

- Mutation **M12**: unsupported / empty evidence must NOT default to C01 → `NEEDS_DISAMBIGUATION` / `UNKNOWN`, `primary_category=null`
- Mutation **M15**: stage evidence `{stage: {category_ref: CAT:C08}}` must ROUTE to C08

## Relation to K3

Routing produces a category selection receipt. K3 technique selection remains separate (`IMPLEMENTED_XCAT = C01–C12` after 56B). UI display labels must not masquerade as XCAT without an explicit `category_ref` bridge.
