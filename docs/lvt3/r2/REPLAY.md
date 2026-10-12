# LVT-3 R2 — replay package (raw evidence)

| Item | Location |
|---|---|
| Frozen protocol | docs/lvt3/r2/PREREG.md (sha256 3042ee90ee0832d0762284ab9eeed837037fde99d7dfc7dfcb0cd9f286c6ec60, commit 03c88785, before the holdout run) |
| Manifest | `family_plan()` in spe_runtime/research/lvt3r2/tasks.py; sha256 cb07aaad7dc4fe11574adaab9d16a0b64783a7ba0e8818bedb18a744ab2b2a99 |
| Raw per-task / per-family / per-seed results | evidence/lvt3r2/holdout/rows.jsonl: 8400 rows = 7 configs × 80 families × 5 tasks × 3 seeds. Fields: seed, config, task, family, kind, declared, verified, exec, source, budget_hit |
| Cost accounting | `exec` per row = every program execution (consistency checks, library candidates, probe scoring). Evaluator probes are k ≤ 4 for every config. Budget 3335.8 for B and E_CAPPED. Per-config means in analysis.json |
| Aggregates, CIs, Holm | evidence/lvt3r2/holdout/analysis.json; docs/lvt3/r2/RESULTS.md |
| Val (pre-freeze) evidence | evidence/lvt3r2/val/ |
| H12 false-success detail (denominators, paired outcomes, exposures, CIs) | evidence/lvt3r2/h12_false_success_detail.json (tool: tools/replay/h12_false_success_detail.py) |
| Evaluator source | spe_runtime/research/lvt3/evaluator.py (independent reference semantics, HMAC-signed verdicts) |
| Agent / configs | spe_runtime/research/lvt3r2/agent.py |
| Evidence hashes | docs/lvt3/r2/EVIDENCE_SHA256.txt |
| Environment | evidence/lvt3r2/ENVIRONMENT.txt |

## Exact commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
git checkout 03c88785    # prereg commit: code identical to what produced the holdout
/tmp/v/bin/python -m pytest tests/research/lvt3r2 tests/research/lvt3 -q
/tmp/v/bin/python -m spe_runtime.research.lvt3r2.run holdout /tmp/ho --budget 3335.8 --expect-prereg-sha 3042ee90ee0832d0762284ab9eeed837037fde99d7dfc7dfcb0cd9f286c6ec60
/tmp/v/bin/python -m spe_runtime.research.lvt3r2.analyze /tmp/ho --delta 0.10
diff <(sort /tmp/ho/rows.jsonl) <(sort evidence/lvt3r2/holdout/rows.jsonl)   # builder rerun: identical
```

## H12 false-success claim ("109 → 19"): exact numbers
Holdout, E (entropy probes) vs E_randprobe (random probes). Both arms see the same 1200 tasks.

| arm | tasks | declared | verified | false-success | abstain | FS / declared (Wilson 95%) | FS / task (Wilson 95%) | exec/task |
|---|---|---|---|---|---|---|---|---|
| E | 1200 | 742 | 723 | 19 | 458 | 2.56% [1.65, 3.96] | 1.58% [1.02, 2.46] | 17,593 |
| E_randprobe | 1200 | 777 | 668 | 109 | 423 | 14.03% [11.76, 16.65] | 9.08% [7.59, 10.84] | 11,093 |

- **Paired task-level false-success table:** both false 16; E only 3; randprobe only 93; neither 1088. Exact McNemar p = 3.7e-24.
- **Family-level difference in FS/task** (n=80 families): −0.075, 95% CI [−0.101, −0.049].
- **Full paired state table:** in h12_false_success_detail.json.
- **Caveats:**
  - The two arms are **not cost-matched**: E uses about 1.6× the executions.
  - Some of the reduction comes from E abstaining more often: of the 109 randprobe false successes, E abstained on 49 and was verified on 44.
  - Secondary/descriptive analysis only. This is what motivates the cost-matched H12-only R3.
