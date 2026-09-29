# Task57R causal repair

Maximum automatic reconstruction attempts remains 1.

A repair is accepted only when the diagnosed trigger improves, parsed section changes stay inside the operation's allowed headings, and ProtectedIntent, Requirement Graph, XCAT, K3, and effect-plan identity do not move.

`RENDER_FROM_BOUND_EFFECT_PLAN` is accepted only with cause `FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN` and a bound plan that already passes its binding checks. Otherwise the disposition is `UNRESOLVED` and the original prompt is kept.

Scope escape, category change, technique change, authority change, and an unrelated protected regression are rejected by `repair_is_admissible`.

Python, Rust, and WASM parity for the existing quality and `from_k3` payloads passed in the full pytest run (992 passed, 0 failed).
