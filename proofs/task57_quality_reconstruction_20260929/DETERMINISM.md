# Determinism

Obligation ids, reason codes, and disposition lists are sorted. Digests use canonical JSON and SHA-256. The same subject pair produces the same Quality Delta on Python, Rust, and WASM.

`attempt_index` emitted by a plan is never above 1. A requested attempt index above 1 is refused and still recorded as attempt 1 so the budget field cannot be exceeded.

Prompt length is recorded only as the reason `LENGTH_NOT_QUALITY` when obligations do not move. It is not a score.
