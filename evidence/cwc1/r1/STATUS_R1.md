# CWC-1 R1 status (amendment 3) — 2026-10-14

Verdict: **NOT_RUN** (PARTIAL seed 101; fewer than 8 complete 3-arm tasks).

## Stopping rule
Amendment 3 HARD CUTOFF: 16:05 IST. Driver `run_holdout.sh` used that cutoff.
At ~17:41 IST a leftover `run_shard2_resilient.py` was still hung on
`location_finding source 101 B` (started 15:35 IST). It was killed to honor the
outcome-blind cutoff. Partial logs kept; that in-flight episode is NOT scored.

## Seed 101 inventory (scored/ files present)
| task | A | B | C | complete 3-arm? |
|---|---|---|---|---|
| dugongs direct | yes | yes | no | no |
| peregrines direct | yes | yes | no | no |
| hyperbolic_temporal_discount direct | yes | yes* | yes* | yes (*B/C wrote files after ValueError in scorer) |
| location_finding source | yes* | in-flight killed | no | no |
| (other 7 holdout tasks) | — | — | — | no |

Complete 3-arm tasks: **1** (need ≥8 for any verdict other than NOT_PROVEN/NOT_RUN).

## Artifacts
- Branch: `grok/cwc1-pilot-r1-real-model`
- Prereg/code: 7c39871b, 6bb0ae3c (ahead of origin/grok/cwc1-pilot-r0)
- Logs: `evidence/cwc1/r1/run_logs/`
- Partial scores: `evidence/cwc1/r1/scored/`
- Model: qwen2.5-3b-instruct-q4km-hf (digest a36559c7…0722 per amendment 3)
- ₹0; nothing merged or deployed

## Next
Any further scored attempt needs a new preregistered amendment (longer window and/or
smaller task set). Do not tune on holdout from these partials.
