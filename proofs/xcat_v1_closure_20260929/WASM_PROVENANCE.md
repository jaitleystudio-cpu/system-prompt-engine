# WASM provenance — historical vs XCAT DOMAIN

**Date:** 2026-09-29  
**Task:** 56B

## Artifacts

| Role | SHA-256 | Bytes | Proves |
|------|---------|------:|--------|
| Historical pre-XCAT (effect-binding canonical) | `48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33` | 937763 | K3 effect binding / pre-XCAT WASM only |
| New XCAT DOMAIN canonical | `623b7ac4323f63bbb5192b72ca7f442567df31d7ae7680f80c20f8e044ff81d4` | 1022578 | DOMAIN taxonomy + xcat API + parity |

## Custody rule

- **Never claim the old hash proves the new semantics.**
- `pre_xcat_effect_binding_sha256` in `apps/web/public/spe_wasm.sha256.json` is retained for lineage only.
- New builds must re-hash; two-path bit-identical rebuild is the promotion gate for the new artifact.
- Imports remain **0** (no WASI / network surface).

## Semantic note

`623b7ac4…` embeds XCAT DOMAIN route/apply/migration paths. Evaluating historical fixtures that assume unimplemented C04–C12 → `NO_SELECTION` against this binary is a taxonomy-era mismatch, not a WASM custody failure.
