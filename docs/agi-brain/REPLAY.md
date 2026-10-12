# AGI-BRAIN R1 — replay package (raw evidence for an external reviewer)

| Item | Location |
|---|---|
| Frozen protocol | docs/agi-brain/CONTRACT_R1.md (frozen in commit 16649bd4, before any run) |
| Manifest / task families | spe_runtime/research/agi_brain/families.py; file hashes in evidence/agi-brain/replay/MANIFEST_SHA256.txt |
| Raw per-family/per-seed results | evidence/agi-brain/r1/rows.jsonl (one row per cond × family × seed; includes `cost`, `valid`, `quality`) |
| Aggregates and CIs | evidence/agi-brain/r1/results.json, docs/agi-brain/RESULTS_R1.md |
| Cost accounting | `cost` field per row (see experiment_r1.py for its definition); the R1 notes say library-build cost is excluded from C/D (flagged in REVIEW_REQUEST) |
| Evaluator source | spe_runtime/research/agi_brain/evaluator_r1.py (independent of netsearch.py) |
| Environment | evidence/agi-brain/replay/ENVIRONMENT.txt |
| Errata | docs/agi-brain/REVIEW_REQUEST.md § ERRATA |

## Exact commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
/tmp/v/bin/python -m pytest -q tests/research/agi_brain
/tmp/v/bin/python -m spe_runtime.research.agi_brain.experiment_r1 /tmp/r1_replay     # ~170 s
/tmp/v/bin/python tools/replay/normalize_compare.py /tmp/r1_replay evidence/agi-brain/r1   # expect exit 0
```
Byte-determinism: not byte-identical because of the wall-clock `sec`/`runtime_sec` fields (ERRATA E1). Identical after stripping those fields.
