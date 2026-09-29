# Project memory

## Map

- `evaluations/spe_benchmark_qualification_v1/README.md` — created 2026-09-30 — reproduction steps for the SPE benchmark harness; fixture validity is not a score
- `evaluations/spe_benchmark_qualification_v1/dataset.json` — created 2026-09-30 — dataset header and measurement catalog
- `evaluations/spe_benchmark_qualification_v1/cases.jsonl` — created 2026-09-30 — twelve frozen unlabeled cases, no verdicts
- `evaluations/spe_benchmark_qualification_v1/human_ratings.example.jsonl` — created 2026-09-30 — human-rating import shape; not a collected rating
- `evaluations/spe_benchmark_qualification_v1/manifest.json` — created 2026-09-30 — frozen-input manifest; scores_included is false
- `evaluations/spe_benchmark_qualification_v1/hashes.sha256` — created 2026-09-30 — SHA-256 lines for the frozen inputs
- `schemas/spe_benchmark_case.schema.json` — created 2026-09-30 — unlabeled case format
- `schemas/spe_benchmark_dataset.schema.json` — created 2026-09-30 — dataset header format
- `schemas/spe_benchmark_result.schema.json` — created 2026-09-30 — result envelope; UNKNOWN cannot carry evidence and PASS requires it
- `schemas/spe_benchmark_comparison.schema.json` — created 2026-09-30 — raw prompt versus SPE prompt comparison
- `schemas/spe_benchmark_manifest.schema.json` — created 2026-09-30 — manifest format
- `schemas/spe_benchmark_observation.schema.json` — created 2026-09-30 — offline observation import
- `schemas/spe_benchmark_human_rating.schema.json` — created 2026-09-30 — human and blinded rating import
- `tools/run_spe_benchmark.py` — created 2026-09-30 — offline runner; a missing measurement stays UNKNOWN
- `tests/regression/test_spe_benchmark_qualification_harness.py` — created 2026-09-30 — proves fixtures stay unlabeled and missing results are not PASS

## Log

### 2026-09-30 — SPE benchmark qualification harness foundation
- Why: Record later SPE benchmark measurements without inventing scores
- Files: `evaluations/spe_benchmark_qualification_v1/` (created), `schemas/spe_benchmark_*.schema.json` (created), `tools/run_spe_benchmark.py` (created), `tests/regression/test_spe_benchmark_qualification_harness.py` (created)
- Left: none
