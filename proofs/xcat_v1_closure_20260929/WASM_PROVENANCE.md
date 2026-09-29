# WASM provenance — historical vs XCAT DOMAIN

**Date:** 2026-09-29  
**Task:** 56B

## Artifacts

| Role | SHA-256 | Bytes | Proves |
|------|---------|------:|--------|
| Historical pre-XCAT (effect-binding canonical) | `48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33` | 937763 | K3 effect binding / pre-XCAT WASM only |
| 56B XCAT DOMAIN (pre-ownership repair) | `d87a9d2ce1b2e789e7cb2869c686e6f719b39bdc753df509cb5244a07034b75a` | 1022683 | DOMAIN taxonomy + xcat API before 56C payload ownership repair |
| 56C ownership canonical | `077a4a399aaf598fd4ed3365f89cf6e32fcf64918a6c5f13319317823b4e3082` | 1023091 | DOMAIN payload allowlists for ratified C01–C07 IRs; imports=0 |

## Custody rule

- **Never claim the old hash proves the new semantics.**
- `pre_xcat_effect_binding_sha256` in `apps/web/public/spe_wasm.sha256.json` is retained for lineage only.
- New builds must re-hash; two-path bit-identical rebuild is the promotion gate for the new artifact.
- Imports remain **0** (no WASI / network surface).

## Semantic note

`48ad95f5…` does not prove XCAT. `d87a9d2c…` does not prove the 56C ownership allowlist. The promoted artifact is `077a4a39…`.
