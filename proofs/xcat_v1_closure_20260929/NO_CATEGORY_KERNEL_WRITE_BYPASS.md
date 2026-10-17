# No category kernel-write bypass — Task 56C

Scan: every `replace_envelope(` under `spe_runtime/categories/`.

Kernel keywords audited: `facts`, `provenance`, `uncertainties`, `hard_constraints`, `user_preferences`, `goal_identity`, `analysis`, `recommendation`, `rendering`, `authority_state`, `execution_grants`.

## DOMAIN production

| File | Kernel keywords on `replace_envelope` |
|------|----------------------------------------|
| `spe_runtime/categories/domain.py` | none (delegates to `apply_category_payload`) |
| `spe_runtime/categories/apply.py` | none (writes `category_payload`, `active_category`, `proof_obligation_proposals`, `category_trace` only) |
| `c04_translate` … `c12_creative` engines | none (call `apply_category_payload`) |

`domain_production_kernel_bypasses()` = **0**.

## Legacy compatibility only

| File | Kernel keys | Class |
|------|-------------|-------|
| `c01_decide/engine.py` | `recommendation` | LEGACY_COMPATIBILITY |
| `c02_research/engine.py` | `facts`, `provenance`, `uncertainties` | LEGACY_COMPATIBILITY |
| `c03_communicate/engine.py` | `rendering` | LEGACY_COMPATIBILITY |
| `c06_analyze/engine.py` | `analysis` | LEGACY_COMPATIBILITY |

`c07_execute/engine.py` calls `replace_envelope` with `category_trace` only. That is not a kernel-truth commit. The API remains legacy and is not on the DOMAIN production path.

## Other `replace_envelope` uses

Tests and invariant mutants construct illegal envelopes on purpose so validators can kill them. They are not production writers.

`dataclasses.replace` is not used by category engines to commit kernel fields.

```
DOMAIN production bypasses = 0
```
