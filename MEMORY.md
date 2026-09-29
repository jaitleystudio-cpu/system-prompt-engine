# Project memory

## Map

- `spe_runtime/output_example/` — created 2026-09-30 — compiler boundary that reads existing desired-output and desired-example fields and emits a candidate pattern contract.
- `spe_runtime/output_example/compiler.py` — created 2026-09-30 — runs extract, accidental-detail filter, and contract assembly without writing K3 or the requirement graph.
- `spe_runtime/output_example/extract.py` — created 2026-09-30 — lexical pattern cues from desired output and user-supplied examples.
- `spe_runtime/output_example/filter.py` — created 2026-09-30 — drops instance details (amounts, dates, names, addresses, JSON values) from example patterns.
- `spe_runtime/output_example/models.py` — created 2026-09-30 — frozen IR, filter result, and candidate pattern contract. The contract cannot hold authority grants or facts.
- `schemas/candidate_pattern_contract.schema.json` — created 2026-09-30 — schema for the candidate pattern contract, including the example laws.
- `tests/unit/test_output_example_compiler.py` — created 2026-09-30 — proves the three example laws and the existing field shapes.
- `SPE-CHANGELOG` — updated 2026-09-30 — records the compiler foundation.

## Log

### 2026-09-30 — desired-output and example compiler foundation
- Why: compile pattern shape from desired output and examples without treating an example as authority, fact, or an instruction unless the caller confirms it.
- Files: `spe_runtime/output_example/` (created), `schemas/candidate_pattern_contract.schema.json` (created), `tests/unit/test_output_example_compiler.py` (created), `SPE-CHANGELOG` (updated)
- Left: a later lane can call `compile_output_example` from a pipeline. This lane does not wire K3.
