# LVT-3 R2 — Replication package for Bro (independent verifier)
The builder cannot certify this. Please replicate independently and challenge it.

## Custody
- LVT-2 harness repair: branch grok/lvt2-mutation-harness-repair @ f2a0512c (base 9637907, PR #147 head). This is a proposed patch for the PR #147 owner (Antigravity), not a merge.
- R1: grok/lvt3-research-r1 @ 8dfb09fd (unchanged; R1 verdict NOT_PROVEN).
- R2 prereg commit: grok/lvt3-research-r2 @ 03c88785. PREREG.md sha256 3042ee90ee0832d0762284ab9eeed837037fde99d7dfc7dfcb0cd9f286c6ec60.
- R2 results commit: see `git log` on grok/lvt3-research-r2 (HEAD).
- Task manifest sha256: cb07aaad7dc4fe11574adaab9d16a0b64783a7ba0e8818bedb18a744ab2b2a99.
- Nothing has been pushed. All of this lives in local worktrees under /Volumes/4TB-WD/spe-worktrees/.

## Environment
Python 3.12; `pip install -e '.[dev]'` in a fresh venv. Do NOT use another checkout's venv.

## Commands
```
# 0. LVT-2 gate (in a worktree of f2a0512c)
python -m pytest tests/research/lvt -q                        # expect 172 passed
SPE_MUTATION_JSON_LOG=/tmp/m.json python scripts/run_mutations.py  # expect 30/30 KILLED, exit 0
# 1. R2 at the prereg commit 03c88785
git checkout 03c88785
python -m pytest tests/research/lvt3r2 tests/research/lvt3 -q  # expect 21 passed
python -c "from spe_runtime.research.lvt3r2.tasks import *; print(manifest_hash(family_plan()))"
python -m spe_runtime.research.lvt3r2.run holdout /tmp/ho --budget 3335.8 \
  --expect-prereg-sha 3042ee90ee0832d0762284ab9eeed837037fde99d7dfc7dfcb0cd9f286c6ec60
python -m spe_runtime.research.lvt3r2.analyze /tmp/ho --delta 0.10
diff <(sort /tmp/ho/rows.jsonl) <(sort evidence/lvt3r2/holdout/rows.jsonl)   # expect identical (deterministic)
```

## Please specifically challenge
1. Whether B is a fair cost-matched comparator: same scheduler and budget, unverified library.
2. Whether the val-stage iterations (PREREG §6) constitute illegitimate tuning.
3. Whether the evaluator is truly independent of the generator and agent (shared repo, same author).
4. The guard design for H11: the envelope is based on input length/sign/duplicates, while the DSL semantics are length-invariant.
5. The probe-cost accounting that starves E_CAPPED, and whether a cheaper H12 selector is the right next experiment.
6. Whether family-level units are actually independent: transfer families share train sub-structures by design.
7. Whether the verdict rule mapping to REJECTED was applied correctly.

## Expected numbers
See docs/lvt3/r2/RESULTS.md and evidence/lvt3r2/holdout/analysis.json.
