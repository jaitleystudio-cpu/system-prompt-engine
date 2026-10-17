# Python results

## Full suite (Task C)

```
704 passed in 32.06s
0 failed
0 skipped
```

## Collection count note

Task A baseline before promotion: **700 collected / 699 passed / 1 failed**.

The single pre-promotion failure was
`tests/web/test_web_architecture_gates.py::test_shipped_release_wasm_matches_kernel_artifact_hash`
when a non-canonical default-target wasm was present. Expected values were
**not** weakened: after promotion, public bytes equal the canonical source
build (`9325f9ec…`).

Task C added four promotion/supply-chain tests in
`tests/release/test_wasm_canonical_supply_chain.py` (copy-wasm missing
candidate, wrong hash, package wiring, and related promotion contracts).

```
700 (Task A collected) + 4 (new promotion tests) = 704
```

Do not treat 704 as a fabricated 700.

## Law coverage still passing (no new semantic implementation)

Existing suites continue to cover:

- ProtectedIntent / goal immutability
- Context Grounding / context need
- Contradiction detection
- Trust firewall
- Quality evaluator
- Bounded reconstruction / retry bound
- Goal-mutation prevention / constraint weakening
- UNKNOWN != PASS
- Authority escalation
- Category engines / canonical vectors
- Python ↔ Rust parity

Evidence: full pytest green; no semantic engine files modified in Task C.
