# Determinism — XCAT DOMAIN Task 56B

**Date:** 2026-09-29

## Claims (evidence-scoped)

| Surface | Determinism property | Evidence |
|---------|----------------------|----------|
| CategoryRouterIR | Same evidence → same `routing_id` / disposition / primary | SHA-256 over canonical JSON; vector tests offline |
| `apply_category_payload` | Same envelope+payload → same field writes | unit + parity suites |
| Migration reject | Legacy v1 reinterpretation always raises | M13, A049, A056 |
| K3 effect plan | Repeatable bind for same selection | `test_effect_binding_is_repeatable` |
| WASM | Bit-identical two-path rebuild for `623b7ac4…` | `WASM_RESULTS.md` |
| Vectors | Offline, no network | `test_xcat_vectors_56b.py` |

## Explicit non-claims

- No LLM sampling in routing
- No wall-clock dependence in routing / apply (except separate microbench measurements)
- No “globally deterministic entire product” claim beyond the surfaces above
