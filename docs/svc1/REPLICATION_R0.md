# SVC-1 R0 replication

1. Check out `grok/svc1-selective-verify-cascade` at the results tip.
2. Confirm contract commit `ba5d48f3` precedes code `b6619ace` precedes results commit.
3. `PYTHONPATH=. python3 -m spe_runtime.research.svc1.experiment`
4. Compare `evidence/svc1/r0/summary.json` means within sampling noise (deterministic hashes → should match exactly).
5. Independent Bro replay: re-run and confirm verdict labels under CONTRACT_R0 decision rules without editing thresholds after seeing holdout.
