# LVT-3 R3 — replication / replay package (for Bro)

| Item | Location |
|---|---|
| Frozen protocol | docs/lvt3/r3/PREREG.md (sha256 f9d26438bbe400abbb85696d3a0cad53d6579bf3b771cfaa7411401558b4d744, commit 7687967f) |
| Manifest | `r3_plan()` in spe_runtime/research/lvt3r3/tasks.py; sha256 fc9b648c72da697f3f6f821b7d9856864ac3e5d7eff64ed2ba2ad2b51f469483. Freshness vs R1/R2 is tested in tests/research/lvt3r3/test_r3.py |
| Raw per-task / per-family / per-seed results | evidence/lvt3r3/holdout/rows.jsonl (seed, config, task, family, kind, declared, verified, exec, budget_hit, probes_used) |
| Cost accounting | `exec` = every program execution, including probe scoring. Budget 4118.6 for U/R/RR/U_guard; A is uncapped (search cap 4000) |
| Analysis / CIs / Holm / denominators | evidence/lvt3r3/holdout/analysis.json; docs/lvt3/r3/RESULTS.md |
| Val calibration (pre-freeze) | evidence/lvt3r3/val/ |
| Evaluator source | spe_runtime/research/lvt3/evaluator.py |
| Arms | spe_runtime/research/lvt3r3/agent.py |
| Environment | evidence/lvt3r3/ENVIRONMENT.txt |
| Builder determinism rerun | evidence/lvt3r3/builder_rerun_determinism.txt |

## Commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
git checkout 7687967f
/tmp/v/bin/python -m pytest tests/research/lvt3r3 tests/research/lvt3r2 tests/research/lvt3 -q     # 25 passed
/tmp/v/bin/python -m spe_runtime.research.lvt3r3.run r3holdout /tmp/h --budget 4118.6 --expect-prereg-sha f9d26438bbe400abbb85696d3a0cad53d6579bf3b771cfaa7411401558b4d744
/tmp/v/bin/python -m spe_runtime.research.lvt3r3.analyze /tmp/h --delta-vs 0.05 --delta-fs 0.04
diff <(sort /tmp/h/rows.jsonl) <(sort evidence/lvt3r3/holdout/rows.jsonl)
```

## Please challenge
- Whether RR is a fair comparator. It is deterministic stratum cycling and declares more programs.
- Whether U's scorer is too weak (it is capped for cost).
- Whether budget starvation (68%) makes this a test of scheduling rather than probing.
- Whether the verdict mapping (NOT_PROVEN rather than REJECTED) was applied correctly.
