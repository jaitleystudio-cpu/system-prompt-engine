# LVT-3 R1 — replay package (raw evidence). Verdict NOT_PROVEN (unchanged)

| Item | Location |
|---|---|
| Frozen protocol | docs/lvt3/CONTRACT.md (sha256 f8b523a0d922b462081fb40b38ebe6cc4e9e05085a89c9c8b021a5c301f4e20e, commit 8dfb8173, before implementation) |
| Manifest | families in spe_runtime/research/lvt3/generator.py (`FAMILIES`, 20 tasks/family, seeds 0–9); file hashes in evidence/lvt3/MANIFEST_SHA256.txt |
| Raw per-task results | evidence/lvt3/run1/task_rows.jsonl (seed, config, task, family, split, declared, verified, source, exec, program) |
| Per-family / per-seed aggregates | evidence/lvt3/run1/per_family_seed.jsonl |
| Cost accounting | `exec` = search executions + rival/probe-scoring executions; the 4000 search cap applies to search only (disclosed interpretation) |
| Aggregates + CIs | evidence/lvt3/run1/results.json, docs/lvt3/RESULTS.md |
| Evaluator source | spe_runtime/research/lvt3/evaluator.py |
| Qualifier mutation tests | tests/research/lvt3/, evidence/lvt3/qualifier_mutants.txt |
| Environment | evidence/lvt3/ENVIRONMENT.txt |

## Exact commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
/tmp/v/bin/python -m pytest tests/research/lvt3 -q
/tmp/v/bin/python -m spe_runtime.research.lvt3.experiment /tmp/r1
diff <(sort /tmp/r1/task_rows.jsonl) <(sort evidence/lvt3/run1/task_rows.jsonl)
```
results.json contains a wall-clock `runtime_s` field, so it is not byte-identical across runs; compare it with that key removed.
