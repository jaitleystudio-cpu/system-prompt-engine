# Python results — Task 56B XCAT suites

**Date:** 2026-09-29  
**Interpreter:** project `.venv`  
**Command:**

```bash
.venv/bin/pytest \
  tests/unit/test_xcat_domain_56b.py \
  tests/unit/test_xcat_vectors_56b.py \
  tests/unit/test_xcat_mutations_56b.py \
  tests/portability/test_xcat_parity_56b.py \
  tests/unit/test_k3_runtime.py \
  tests/unit/test_k3_effect.py -q
```

## Aggregate

| Result | Count |
|--------|------:|
| Passed | **148** |
| Failed | 0 |
| Wall time | ~1.95s |

## Per-file collection counts

| File | Collected | Role |
|------|----------:|------|
| `test_xcat_domain_56b.py` | 22 | DOMAIN engines, migration, routing |
| `test_xcat_vectors_56b.py` | 5 | CATEGORY_VECTORS load/coverage/determinism |
| `test_xcat_mutations_56b.py` | 17 | M1–M16 kill suite |
| `test_xcat_parity_56b.py` | 3 | Python↔Rust↔WASM |
| `test_k3_runtime.py` | 68 | K3 selector freeze regression |
| `test_k3_effect.py` | 33 | Effect binder + 11/11 mutants |

## Notes

- Domain/mutation/vector suites are the primary XCAT evidence.
- K3 runtime + effect suites confirm 55/55R freeze under expanded `IMPLEMENTED_XCAT`.
- Full-repo pytest / web regression: see `REGRESSION_RESULTS.md` (partial / TBD where not run).
