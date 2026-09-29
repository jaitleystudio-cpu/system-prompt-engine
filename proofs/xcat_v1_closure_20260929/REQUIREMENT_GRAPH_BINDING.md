# Requirement Graph binding — ProtectedIntent → RG → category_ref → XCAT → K3

**Date:** 2026-09-29  
**Task:** 56B  
**Surfaces:** `spe_runtime/requirements/project.py` (`semantic_key=category_ref`), `spe_runtime/xcat/router.py`, `spe_runtime/k3/*`

## Chain (lawful)

```
ProtectedIntent
  → Requirement Graph (K1 atoms / edges)
    → category_ref (explicit semantic key on RG node)
      → XCAT CategoryRouterIR / apply_category_payload
        → K3 technique selection + prompt_effect_plan (when selected)
```

## Rules

1. **No UI masquerade.** Product display labels (`DISPLAY_LABEL_PROTOCOL`) are not XCAT IDs. Only an explicit `category_ref` (or equivalent evidence keys accepted by `route_mission_stage`) binds RG → XCAT.
2. **ProtectedIntent fields** (goal, hard constraints, budget, facts, provenance, authority) are not rewritten by category engines.
3. **XCAT** specializes `category_payload` and may propose proof obligations; it does not become a second Requirement Graph writer.
4. **K3** consumes lawful selection context. After 56B, `IMPLEMENTED_XCAT = {C01…C12}`; technique registry and effect binder remain the Task 55/55R freeze.
5. Missing / ambiguous category evidence → `NEEDS_DISAMBIGUATION` / `UNKNOWN` — not a silent C01 default.

## Anti-patterns (forbidden)

- Treating hero copy / UX category chips as `category_ref`
- Inferring CAT:Cxx from free-text mission alone
- Letting category engines mutate ProtectedIntent / RG hard constraints
- Claiming K3 CognitivePlan is CAT:C04 Translate (legacy collision)

## Evidence

- Router tests + vectors with `category_ref` / `stage.category_ref`
- Mutation M12 / M15
- K3 `test_unimplemented_xcat_set_is_empty` (post-56B expansion)
