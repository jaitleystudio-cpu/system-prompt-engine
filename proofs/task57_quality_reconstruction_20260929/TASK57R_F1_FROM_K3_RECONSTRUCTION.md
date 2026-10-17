# Task57R-F1 from_k3 reconstruction return

Starting head: `c27b13ae6543ea19125e5a2be419e109f86dfd0b`.

`evaluate_from_k3` now does the existing Task57 loop once:

1. `subject_from_k3`
2. `reconstruct(subject)` exactly once
3. `VALIDATE_ONLY` on `kept_subject`
4. return `subject`, `reconstruction`, `quality_delta`, and `receipt`

The receipt `subject_digest` binds `reconstruction.kept_subject`. When `kept` is `repaired`, that digest is not the original subject digest. When `kept` is `original`, it binds the original subject.

Python cases:

| Case | Result |
| --- | --- |
| A missing hard constraint | `kept=repaired`, plan `ACCEPTED`, delta `IMPROVED`, receipt binds the repaired subject |
| B protected regression | `kept=original`, plan not `ACCEPTED` |
| C no deficit | `kept=original`, plan `NOT_TRIGGERED` |
| D unrepairable conflict | `kept=original`, plan `UNRESOLVED` |
| E attempt budget | `reconstruct` called once; `attempt_index <= 1`; `max_attempts == 1` |

Rust returns the same canonical JSON. WASM uses that Rust. Python, Rust, and WASM mismatches on the full reconstruction objects: 0.

The web replaces the visible prompt only when all of these are true: `kept == repaired`, plan `ACCEPTED`, delta `IMPROVED`, `protected_regressions` empty, and receipt verdict `PASS`, with a non-empty kernel `compiled_prompt`. `reconstruction_eligible` and `PASS` alone do not select a repaired prompt.
