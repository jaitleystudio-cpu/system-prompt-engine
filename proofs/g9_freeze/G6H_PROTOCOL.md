# G6-H — Blinded Human Evaluation Protocol (External)

**Status:** EXTERNAL_NEXT  
**Do not fabricate ratings.**  
**Coding agent STOP:** collect genuine blinded humans; do not self-rate.

## Frozen artifacts (do not rewrite after ratings begin)

| Artifact | Path | Role |
|----------|------|------|
| Corpus | `benchmarks/g6zc/corpus.json` | 120 tasks |
| Rubric | `benchmarks/g6zc/rubric.json` | V1–V10 + confidence |
| Rubric SHA | `benchmarks/g6zc/rubric_sha256.txt` | `6456af82…` |
| Thresholds | `benchmarks/g6zc/thresholds.json` | Frozen **before** ratings |
| Thresholds SHA | `benchmarks/g6zc/thresholds_sha256.txt` | `8e7074a6…` |
| Blind pairs | `evaluations/g6zc/blind_pairs.json` | LEFT/RIGHT candidates |
| Blind UI | `evaluations/g6zc/blind_evaluator.html` | Local-only evaluator |
| Randomization map | `benchmarks/g6zc/randomization_manifest.json` | **Keep sealed** |
| Human results stub | `proofs/g6zc/human_results.json` | `NO_RATINGS_YET` |

## Blind flow

```
Task
  ↓
Candidate A       Candidate B
   RAW          SPE-compiled
        \       /
          blind
           ↓
       evaluator
```

- No SPE label
- No hint which side is expected to win
- LEFT/RIGHT already randomized in `blind_pairs.json`

## Per-pair collection (frozen dimensions)

From `benchmarks/g6zc/rubric.json`:

- V1 intent fidelity  
- V2 constraint coverage  
- V3 missing-requirement / ambiguity handling  
- V4 conflict handling  
- V5 executability  
- V6 output clarity  
- V7 verification / testability  
- V8 portability  
- V9 unnecessary complexity (reverse)  
- V10 overall usefulness  

Plus:

| Field | Values |
|-------|--------|
| Preference | A / B / TIE |
| Confidence | LOW / MEDIUM / HIGH |

## Unblinding rule

1. Complete **all** ratings first.  
2. Only then open `benchmarks/g6zc/randomization_manifest.json`.  
3. Adjudicate against frozen thresholds **without moving goalposts**.  
4. Preserve losses as well as wins.  
5. Decide whether `REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE` is earned.

## Target claim (only if earned)

`REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE`

## Not this study

- Independent second-party replication → **G8-X** (later)  
- World #1 → only after independent evidence + competitive campaign if warranted  

## Current human_results guard

```json
{
  "status": "NO_RATINGS_YET",
  "do_not_fabricate": true
}
```

Any agent that writes synthetic preference counts into `human_results.json` violates freeze discipline.
