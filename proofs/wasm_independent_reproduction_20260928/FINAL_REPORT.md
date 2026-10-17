# FINAL_REPORT

SPE INDEPENDENT WASM REPRODUCTION — Task B

## Verdict

**INDEPENDENT_REPRODUCTION_PASS**

## Acceptance gates

| Gate | Value |
| --- | --- |
| FRESH_AGENT | YES |
| FRESH_CLONE | YES |
| RECIPE_SHA | 96ce1ceb000ff04d8fcd324de1da5dfe0d70c909 |
| SEMANTIC_PRODUCT_BASE | e0497f79898689a00a30abeab67652d5f6a9193c |
| PINNED_RUSTC | 1.98.1 / 48a229ceaefd4985c50990b14116b6d856af0985 |
| BUILD_A | 9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6 |
| BUILD_B | 9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6 |
| SECOND_PATH | 9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6 |
| ALL_HASHES_EQUAL | YES |
| ALL_SIZES | 671621 |
| IMPORTS | 0 |
| EXPORTS | memory / spe_alloc / spe_evaluate / spe_free |
| CONFORMANCE | 110/110 |
| MISMATCHES | 0 |
| RUNTIME_ERRORS | 0 |
| PUBLIC_WASM_CHANGED | NO |
| PUBLIC_MANIFEST_CHANGED | NO |
| PRODUCTION_SOURCE_CHANGED | NO |

## What was not done

- No promotion of candidate into `apps/web/public`
- No `npm run build` / `copy-wasm` change
- No merge of Task A PR #49
- No deploy / host / DNS
- No modification of Task A evidence under `proofs/wasm_rebaseline_candidate_20260928/`

## Evidence files

- ENVIRONMENT.md
- SOURCE_CUSTODY.md
- BUILD_A.md
- BUILD_B.md
- SECOND_PATH_BUILD.md
- BINARY_SURFACE.md
- CONFORMANCE.md
- PARITY.md
- SHA256_MANIFEST.txt
- FINAL_REPORT.md

STOP FOR FOUNDER + CHATGPT REVIEW.
