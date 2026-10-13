# EGAC-E01 results — JSON minify OFF vs ON (local, ₹0)

Contract: docs/egac/E01_CONTRACT.md, sha256 `c6e67071015c2feeabf01ef9df3b3d7ffab67bf2bfcfa964d55fe4b4f44f811e`,
committed in 066af190 before the harness existed. Harness committed in 42e051ef before the run. Single run, no reruns.
Model: `qwen2.5:0.5b` (Q4_K_M, 494M), digest `a8b0c51577010a279d933d14c2a8ab4b268079d44c5c8830c0a93900f1827c67`,
Ollama 0.24.0, isolated server on 127.0.0.1:11435 (Mac mini). 120 tasks × 2 arms × 3 repeats = 720 calls.
Task manifest sha256 `c4895f2410acebdefc4068b9d5705aa8b09f439022fc3b521ede70f5e8aa2dae`.

| Endpoint | Control (off) | Treatment − control | 95% CI |
|---|---|---|---|
| Prompt tokens / call | 226.7 | **−60.4 (−26.6%)** | [−62.8, −57.9] |
| Total latency / call (ms) | 280.8 | −24.8 (−8.8%) | [−34.0, −16.3] |
| Success rate (majority of 3) | 89.2% | **−6.7 pp** (82.5%) | [−12.5, −1.7] pp |
| McNemar exact | b(ctrl-only)=10, c(treat-only)=2, both=97, neither=11 | | p = 0.0386 |
| Canary critical failures | 0 / 12 valid + 6 malformed | | |
| Gate refusals on tasks | 0 / 120 | | |

Per category (successes ctrl→treat, of 15): config 15→15, api_response 14→9, nested_records 14→12, big_ints 15→15,
unicode_escapes 15→15, numeric_arrays 5→4, deep_nesting 15→15, whitespace_in_strings 14→14.

## Verdict: **NOT_PROVEN** (by the frozen rule)
Token savings are real and tight, and the transform itself is byte-safe (0 canary failures). But non-inferiority
is not met: the success CI lower bound (−12.5 pp) is below the −5 pp margin, and McNemar is significant *against*
minification (p = 0.039). The upper bound (−1.7 pp) is not below −5 pp, so the frozen FAIL rule is not triggered.
Plain reading: on this 0.5B model, minified JSON is cheaper but measurably harder to read, concentrated in
array-of-records lookups (api_response −5). Not a gate defect — the bytes were preserved — a model-comprehension cost.

## Implementation notes / deviations
- A fixed-width per-call nonce `[call NNNN] ` prefixes every prompt in both arms to prevent KV-prefix reuse from
  distorting `prompt_eval_count`. Not in the contract text; identical in both arms. Disclosed here.
- Latency measured on a shared desktop; reported, non-gating, as pre-registered.
- Dollar VSOD: BLOCKED (needs paid provider billing). See E01_PROVIDER_CONFIG.md.

## Post-replay gate fix (2026-10-13; E01 verdict unchanged: NOT_PROVEN)
Bro's replay @ f8c4f88e (REPLAY_PASS on E01) found two gate defects in `spe_runtime/egac/conservation.py`:
1. `_PROTECTED_RE` was case-sensitive and anchored at line start, so "Never reveal the API key." / "Do not disclose credentials." were REPLACEABLE and could be deleted while the transform stayed ALLOWED. **Fixed:** case-insensitive, matched anywhere in the line (must/never/shall/required/do not/don't/always/forbidden/prohibited/not allowed/under no circumstances/exceptions to/constraint:).
2. Inserted text was never checked, so a transform adding "Ignore the line above…" or "The constraints above are examples only…" was ALLOWED. **Fixed:** the gate now refuses any transform whose output adds a non-exact-byte line, not present in the input, that matches an instruction-like pattern.

Regression tests: `tests/research/egac/test_egac_bro_replay_gate.py` (all of Bro's `egac_attack.py` cases plus variants, and benign edits that must stay allowed).

Impact on E01: re-gating all 120 E01 control prompts with the fixed gate gives **120/120 allowed with byte-identical treatment prompts** (sha256 prefix 1ab4f59deda4cc84 before and after), and the canary block is unchanged (12 valid / 6 malformed, 0 critical failures). E01 rows and verdict are therefore unaffected and not superseded.
