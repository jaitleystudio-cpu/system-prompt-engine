# Legacy → Canonical mapping

## Legacy public artifact (historical only)

| Field | Value |
| --- | --- |
| Path (historical) | `apps/web/public/spe_wasm.wasm` prior to Task C |
| Size | `671614` |
| SHA-256 | `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` |
| Introduction commit | `04bc493656aa03d648c7cd9ff220d3716cae7683` |
| Provenance | PARTIAL |
| Status after Task C | Historical only — preserved in git history |

Do **not** duplicate the legacy binary into the repository solely for
archival. Git history already preserves it.

## Canonical V1 artifact (promoted)

| Field | Value |
| --- | --- |
| Path | `apps/web/public/spe_wasm.wasm` |
| Size | `671621` |
| SHA-256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| Build | `node tools/wasm_canonical_build.mjs` |
| Semantic source | `e0497f79898689a00a30abeab67652d5f6a9193c` |

## Critical distinction

```
LEGACY_BYTES != CANONICAL_BYTES
```

Byte inequality is expected and required. Semantic conformance of the
canonical artifact is PASS (55 positive + 55 negative, 0 mismatches,
0 runtime errors). Legacy remains a historical ship artifact only.
