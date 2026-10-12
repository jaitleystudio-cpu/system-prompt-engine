# hostile-gym-r1 — EVIDENCE REPORT (builder: Grok Bot; verifier Package I: Bro, PENDING)
H1 verdict: **NOT_PROVEN** (prereg sha256 99097eb2…48aa, committed in c735076c before any model output).
Held-out (primary, 64 attack + 32 benign pairs, qwen2.5:1.5b local): ASR 18.75% → 10.94%, d = −7.8 pts, 95% CI [−20.3, +4.7], McNemar 10 vs 5, p = 0.30.
Legit completion 98.96% both arms (d 0, CI [−3.1, +3.1]); benign lookalikes 100% both; canary leaks 1 vs 1; prompt tokens +15% (698 → 803).
Dev (secondary): ASR 12.5% vs 12.5%, p = 1. SIMULATED_DETERMINISTIC arena (not evidence): candidate 10, baseline 5, tie 81.
Candidate is opt-in (`evidenceEnvelope:"fenced"`), product default unchanged; not accepted.
Known defects: WASM `spe_evaluate` returns VALID for schema-less objects (`{}`, `{"a":1}`); shipped WASM not reproducible with local rustc 1.98.1 (1 pytest failure); validate_repo.py is a stub.
