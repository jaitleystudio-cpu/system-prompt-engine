# Project memory

## Map

| Path | Updated | Why |
|------|---------|-----|
| `data/category_registry_v1.json` | 2026-09-29 | DOMAIN taxonomy v2 registry (founder-ratified names + legacy migration metadata) |
| `schemas/category_registry.schema.json` | 2026-09-29 | Real JSON Schema for registry v2 (was STUB) |
| `schemas/xcat_envelope.schema.json` | 2026-09-29 | Optional taxonomy/payload envelope fields (not required) |
| `spe_runtime/xcat/models.py` | 2026-09-29 | CrossCategoryEnvelope optional DOMAIN fields |
| `spe_runtime/xcat/migration.py` | 2026-09-29 | Taxonomy version guards; reject legacy reinterpretation |
| `spe_runtime/xcat/router.py` | 2026-09-29 | Deterministic CategoryRouterIR / route_mission_stage |
| `spe_runtime/xcat/handoff.py` | 2026-09-29 | record_handoff receipt wrapper |
| `spe_runtime/categories/payloads.py` | 2026-09-29 | Per-category ProjectIR allowed fields |
| `spe_runtime/categories/apply.py` | 2026-09-29 | apply_category_payload ownership + anti-laundering laws |
| `spe_runtime/categories/validate.py` | 2026-09-29 | Shared validate_payload_category_output |
| `spe_runtime/categories/c04_translate/` … `c12_creative/` | 2026-09-29 | Domain specialty engines (C04/C05/C08–C12) |
| `spe_runtime/k3/registry.py` | 2026-09-29 | IMPLEMENTED_XCAT = C01–C12; UNIMPLEMENTED empty |
| `portable/spe-core-rs/src/k3.rs` | 2026-09-29 | Rust implemented_xcat parity with Python |
| `proofs/xcat_v1_closure_20260929/CATEGORY_VECTORS.json` | 2026-09-29 | ≥60 normal / ≥48 adversarial category vectors |
| `tests/unit/test_xcat_domain_56b.py` | 2026-09-29 | Domain engine / migration / routing unit tests |
| `tests/unit/test_xcat_vectors_56b.py` | 2026-09-29 | Corpus loader tests |

## Log

### 2026-09-29 — SPE Task 56B XCAT DOMAIN category runtime
- Why: Founder ratified DOMAIN taxonomy; implement missing category engines, registry v2, migration guards, router, and tests without breaking C01/C02/C03/C06/C07.
- Files: registry/schema/envelope models; `migration.py`, `router.py`, `payloads.py`, `apply.py`; c04/c05/c08–c12 packages; K3 + Rust parity; CATEGORY_VECTORS + unit tests
- Left: WASM artifact rebuild if portability WASM tests still pin pre-56B binary; PR merge remains out of scope
