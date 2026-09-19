# G6-H Blind Evaluator (local only)

No public website. Serve from the repository root:

```bash
./tools/g6h_serve.sh
# or: python3 -m http.server 8765 --bind 0.0.0.0
```

Open:

```
http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
```

The page **auto-loads** `blind_pairs.json` when served over HTTP (also: “Load server pairs”).

## Mobile (same Wi‑Fi)

```bash
./tools/g6h_serve.sh          # binds 0.0.0.0 by default
hostname -I                   # use the real LAN IP, e.g. 192.168.1.25
```

Phone:

```
http://192.168.1.25:8765/evaluations/g6zc/blind_evaluator.html
```

Replace with your real IP — never the literal text `<your-LAN-IP>`.

## Rules

- Evaluator ID: pseudonymous `E001`, …
- Do **not** open `benchmarks/g6zc/randomization_manifest.json` while rating
- Export ratings JSON → `tools/g6h_lock_ratings.py` → only then unblind

Files: `blind_evaluator.html` · `blind_pairs.json` (120 pairs)

## Troubleshooting (`ERR_EMPTY_RESPONSE` / connection reset)

Most likely: the local server is **not running**.

```bash
./tools/g6h_serve_status.sh   # diagnoses listener + HTTP 200
./tools/g6h_serve.sh          # start and leave running
```

Expect `HTTP 200` for the evaluator URL. Do not kill the server while rating.
