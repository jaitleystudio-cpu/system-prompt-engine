# CONFORMANCE

Subject under test: independently built candidate WASM (not the tracked legacy public module).

```
artifact=/home/ubuntu/spe-independent-repro/portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm
sha256=9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6
bytes=671621
```

Harness:

```
/tmp/spe-task-b-venv/bin/python tools/wasm_candidate_vectors.py <artifact>
```

Temporary isolated Python environment used declared dependencies only (`pip install -e ".[dev]"`). The vector tool builds `spe-core-eval` if needed.

## Result JSON

```json
{
  "authority_mismatches": 0,
  "bytes": 671621,
  "exports": [
    "memory",
    "spe_alloc",
    "spe_evaluate",
    "spe_free"
  ],
  "imports": [],
  "mismatch_ids": [],
  "negative_count": 55,
  "negative_reason_mismatches": 0,
  "pass": true,
  "positive_count": 55,
  "protocol_mismatches": 0,
  "python_rust_mismatches": 0,
  "python_wasm_mismatches": 0,
  "runtime_errors": 0,
  "rust_wasm_mismatches": 0,
  "semantic_mismatches": 0,
  "sha256": "9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6"
}
```

Window: `2026-09-28T16:59:34Z` → `2026-09-28T16:59:41Z`

## Gates

| Gate | Expected | Observed |
| --- | --- | --- |
| positive | 55 | 55 |
| negative | 55 | 55 |
| total | 110 | 110 |
| mismatches | 0 | 0 |
| runtime_errors | 0 | 0 |
| pass | true | true |

## Engine fixtures (candidate subject)

```
POS-001: status=VALID disposition=VALID reason_code=null used_ts_fallback=false imports=0 sha256=9325f9ec…
NEG-001: status=INVALID disposition=INVALID reason_code=P_PROVENANCE_REMOVED used_ts_fallback=false imports=0 sha256=9325f9ec…
```

Public WASM remained legacy after harness. CONFORMANCE = PASS
