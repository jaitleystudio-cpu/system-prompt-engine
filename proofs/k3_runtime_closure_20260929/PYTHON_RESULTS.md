# Python results

Command: `python3 -m pytest -q` after `pip install -e .` so subprocess harnesses can import `spe_runtime`.

| Result | Count |
|---|---|
| passed | 776 |
| failed | 0 |

K3-focused files included in that run:

- `tests/unit/test_k3_runtime.py` (vectors, invariants, adversarial classes, false-proof, 7 mutants)
- `tests/portability/test_k3_cross_runtime.py` (Python↔Rust and Python↔public WASM)
