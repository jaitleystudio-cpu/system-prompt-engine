# LVT-2 mutation harness repair — replay package

Base 9637907 (PR #147 head). This is a proposed patch for the PR #147 owner, not a merge.

| Item | Location |
|---|---|
| Frozen protocol (mutant list: targets, replacements, killing test) | scripts/run_mutations.py `MUTANTS` (M01–M30; unchanged by the repair; diff with `git diff 9637907 -- scripts/run_mutations.py`) |
| Root cause and repair write-up | docs/lvt2/MUTATION_HARNESS_REPAIR.md |
| Original R1 crash output | evidence/lvt2_harness_repair/original_r1_crash_output.txt |
| Reproduced SIGTERM failure (old harness) | evidence/lvt2_harness_repair/repro_sigterm_old_harness.txt (sha256 check FAILED, mutant + .orig_backup left on disk) |
| Full mutation run log | evidence/lvt2_harness_repair/mutations.txt (MUT_EXIT=0) and mutations.json (per-mutant exit codes) |
| Pre/post restoration hashes | evidence/lvt2_harness_repair/source_sha256_before.txt and source_sha256_after.txt (385 files, identical; __pycache__ excluded) |
| LVT-2 test suite log | evidence/lvt2_harness_repair/lvt2_tests.txt (172 passed, TESTS_EXIT=0) |
| Regression tests | tests/research/lvt/test_mutation_harness_regression.py |
| Environment | evidence/lvt2_harness_repair/ENVIRONMENT.txt |

## Exact commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
/tmp/v/bin/python -m pytest tests/research/lvt -q                           # expect 172 passed
find spe_runtime -type f -not -path '*__pycache__*' | sort | xargs shasum -a 256 > /tmp/pre.sha
SPE_MUTATION_JSON_LOG=/tmp/m.json /tmp/v/bin/python scripts/run_mutations.py; echo MUT_EXIT=$?   # expect 30/30, 0
find spe_runtime -type f -not -path '*__pycache__*' | sort | xargs shasum -a 256 > /tmp/post.sha && cmp /tmp/pre.sha /tmp/post.sha
# reproduce the old failure (on a scratch worktree only!):
git show 9637907:scripts/run_mutations.py > /tmp/old.py   # then point REPO_ROOT at the scratch worktree, start it, kill -TERM after ~4 s, git status shows the mutant
```

## Per-mutant results (builder run 2026-10-12)
| id | mutant | status | pytest exit | restored | summary |
|---|---|---|---|---|---|
| M01 | Ignore oracle key allowlist | KILLED | 1 | True | 1 failed in 0.76s |
| M02 | Allow missing trust registry | KILLED | 1 | True | 1 failed in 0.64s |
| M03 | Enable aggregate-only mock qualification | KILLED | 1 | True | 1 failed in 0.25s |
| M04 | Accept changed attestation evidence hash | KILLED | 1 | True | 1 failed in 0.61s |
| M05 | Skip oracle ID binding | KILLED | 1 | True | 1 failed in 0.96s |
| M06 | Trust QUALIFIED without verified receipt | KILLED | 1 | True | 1 failed in 0.81s |
| M07 | Permit revoked .spe export | KILLED | 1 | True | 1 failed in 0.84s |
| M08 | Replace held-out baseline with training base | KILLED | 1 | True | 1 failed in 0.31s |
| M09 | Replace family-macro effect with item weighting | KILLED | 1 | True | 1 failed in 0.03s |
| M10 | Convert INCONCLUSIVE into QUALIFIED | KILLED | 1 | True | 1 failed in 0.15s |
| M11 | Allow absent validator in evaluate_cross_model_transfer | KILLED | 1 | True | 1 failed in 0.75s |
| M12 | Skip transfer receipt authentication in synthesize_spe_learning_artifact | KILLED | 1 | True | 1 failed in 1.01s |
| M13 | Bypass 20-family minimum in cross-model transfer | KILLED | 1 | True | 1 failed in 1.23s |
| M14 | Bypass model identity binding in evaluate_cross_model_transfer | KILLED | 1 | True | 1 failed in 1.18s |
| M15 | Bypass synthetic model check in .spe export | KILLED | 1 | True | 1 failed in 1.68s |
| M16 | Bypass owner authority check in validate_and_commit | KILLED | 1 | True | 1 failed in 0.71s |
| M17 | Bypass durable tombstone check in is_tombstoned | KILLED | 1 | True | 1 failed in 1.27s |
| M18 | Bypass task family clustering distinction check in transfer | KILLED | 1 | True | 1 failed in 1.22s |
| M19 | Bypass synthetic model digest invariant check against VERIFIED_MODEL_REVISION | KILLED | 1 | True | 1 failed in 1.27s |
| M20 | Bypass caller-asserted owner authorization rejection | KILLED | 1 | True | 1 failed in 0.44s |
| M21 | Bypass durable tombstone load from disk in validator | KILLED | 1 | True | 1 failed in 1.45s |
| M22 | Bypass independence assertions validation in cross-model transfer | KILLED | 1 | True | 1 failed in 1.45s |
| M23 | Bypass persistent parent transaction tombstone check in verify_transaction_signature | KILLED | 1 | True | 1 failed in 1.60s |
| M24 | Bypass fail-closed tombstone I/O error handling when explicitly configured | KILLED | 1 | True | 1 failed in 0.05s |
| M25 | Bypass parent study synthetic model digest rejection in paired_gate_v2 | KILLED | 1 | True | 1 failed in 0.05s |
| M26 | Bypass strict cryptographic owner authority requirement on LearningValidator | KILLED | 1 | True | 1 failed in 0.26s |
| M27 | Bypass RBPD RealityBoundEvidenceAsset Ed25519 signature verification | KILLED | 1 | True | 1 failed in 1.32s |
| M28 | Permit reuse of STALE obligations during selective invalidation | KILLED | 1 | True | 1 failed in 6.60s |
| M29 | Disable Channel B sealed reality witness Goodhart divergence detection | KILLED | 1 | True | 1 failed in 0.10s |
| M30 | Falsely claim positive proof dividend on negative control benchmark | KILLED | 1 | True | 1 failed in 24.33s |
