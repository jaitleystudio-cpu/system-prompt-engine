# G6-H HUMAN COORDINATOR START

Frozen study access only. Cursor does **not** rate.

## Before humans

```bash
python tools/verify_g9_freeze.py
python tools/verify_g6h_prestudy.py
python tools/g6h_coordinator_checklist.py
```

All must PASS / READINESS: PASS. `human_results` must remain `NO_RATINGS_YET`.

## Serve (local)

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# or: ./tools/g6h_serve.sh
```

Open:

```
http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
```

Optional same-Wi‑Fi LAN (coordinator machine only):

```bash
python3 -m http.server 8765 --bind 0.0.0.0
# http://<LOCAL-LAN-IP>:8765/evaluations/g6zc/blind_evaluator.html
```

## Human steps

1. Enter pseudonymous ID (`E001`, …).
2. Rate blinded LEFT/RIGHT candidates + rubric. Use **TIE** only for true ties.
3. Skips / invalids: record separately (do **not** mark skip as TIE).
4. **Download ratings JSON** from the UI (browser-local until export).
5. Repeat for required evaluators.

## After all required ratings

```bash
python tools/g6h_lock_ratings.py --ratings EXPORT.json \
  [--skipped skips.json] [--invalid invalids.json] --expected 120
```

Only after successful lock:

```bash
python tools/g6h_unblind.py --ratings proofs/g6h/human_results_locked_bytes.json \
  --allow-real --json-out proofs/g6h/unblinded_results.json
```

Then apply **frozen** thresholds → PASS/FAIL/INCOMPLETE/INVALID → **STOP**.

## Forbidden

- Opening `benchmarks/g6zc/randomization_manifest.json` while rating
- Fabricating / simulating ratings
- Unblind before lock
- Merging PR #6
- Creating `spe_runtime/omega/`
- Claiming World #1 / independent replication from this access step
