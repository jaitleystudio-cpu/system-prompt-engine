# G6-H — How to open the evaluator (local only)

There is **no public website URL**. The evaluator is a frozen local webpage in the repo.

| File | Path |
|------|------|
| Evaluator UI | `evaluations/g6zc/blind_evaluator.html` |
| Blind pairs | `evaluations/g6zc/blind_pairs.json` |

Built for: local browser storage · no telemetry · no analytics.

## Before you rate

On the SPE computer (repo root):

```bash
python tools/verify_g9_freeze.py
python tools/verify_g6h_prestudy.py
python tools/g6h_coordinator_checklist.py
```

Required:

```
verify_g9_freeze.py        → PASS
verify_g6h_prestudy.py     → PASS
g6h_coordinator_checklist  → READINESS: PASS
```

## Fastest way (same computer)

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Open:

```
http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
```

The page **auto-loads** `blind_pairs.json` over HTTP. You can also tap **Load server pairs** (no file picker needed on mobile).

Optional one-liner: `./tools/g6h_serve.sh`

You should see the task plus **LEFT / RIGHT** candidates, without knowing which is RAW or SPE.

Stop the server afterward with `Ctrl+C`.

## Rate from iPhone (same Wi‑Fi only)

On the SPE computer:

```bash
python -m http.server 8765 --bind 0.0.0.0
hostname -I   # Linux — note the LAN IP, e.g. 192.168.1.25
```

On the phone (same trusted home/local Wi‑Fi):

```
http://<LAN-IP>:8765/evaluations/g6zc/blind_evaluator.html
```

Example:

```
http://192.168.1.25:8765/evaluations/g6zc/blind_evaluator.html
```

Use a trusted local network only. Stop the server with `Ctrl+C` when done.

## Evaluator identity

Use a pseudonymous ID such as **E001**. Do not enter legal name / phone / email in the study forms.

## Do NOT open while rating

```
benchmarks/g6zc/randomization_manifest.json
```

That file reveals which side is SPE vs RAW. The evaluator UI intentionally does **not** contain that mapping.

## After ratings

1. Download ratings JSON from the UI  
2. `python tools/g6h_lock_ratings.py --ratings EXPORT.json --expected 120`  
3. Only then unblind with `--allow-real`  
4. Apply frozen thresholds · report · **STOP**

## Custody note

PR #33 records the frozen evaluator SHA-256 and blinded A/B design. Serving locally does not mint human evidence — only real blinded submissions do.
