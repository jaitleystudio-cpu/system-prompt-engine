# G6-H Evaluator Protocol (neutral)

## Before you start

You will see **one task** and **two candidate instructions** (A and B).

- Judge each candidate using the **provided rubric only**.
- Either candidate may be better, worse, or equivalent.
- **Do not reward length by itself.**
- A **tie is legitimate** — never force a winner.
- Skip if you cannot understand the task or language; a skip is **not** a tie.

## You will not be told

- Which candidate is “ours”
- Which side is expected to win
- Whether a candidate was machine-compiled

## Required each completed pair

1. Rubric dimension scores (exact frozen scale — typically 0–4)  
2. Overall preference: **A / B / TIE** (or LEFT / RIGHT / TIE per UI)  
3. Confidence: **LOW / MEDIUM / HIGH**  
4. Optional short comment  

## Privacy

Use your assigned pseudonymous ID only (e.g. `E001`).  
Do not enter legal name, phone, email, or address in the study forms.

## UI

There is **no public URL**. Serve locally:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Open:

```
http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html
```

Load `evaluations/g6zc/blind_pairs.json` in the UI.  
Full instructions: `proofs/g6h/HOW_TO_OPEN_EVALUATOR.md`  
No internet required for rating after the page loads. No telemetry. Autosave is local only.

**Do not** open `benchmarks/g6zc/randomization_manifest.json` while rating.
