# Python oracle results

GLOBAL_TASK_ROUTER = NOT_FOUND

Base SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

## Environment

- Interpreter: Python 3.12.3
- Isolated environment: `.venv-audit` (not committed)
- Install: `python3 -m venv .venv-audit` then `pip install -e ".[dev]"`
- Declared contract: `pyproject.toml` runtime `jsonschema>=4.22`, optional dev `pytest>=8.0`, `requires-python >=3.11`
- Resolved in the venv: pytest 9.1.1, jsonschema 4.26.0
- No production dependency was added. Packages were not installed system-wide.
- `python3.12-venv` was installed only so `venv` could be created. The Debian image had no `ensurepip`.

No `requirements.txt`, `poetry.lock`, `uv.lock`, `Pipfile`, `setup.cfg`, or `tox.ini` exists. The intended suite is pytest with `testpaths = ["tests"]` and `pythonpath = ["."]`. README also shows the narrower example `pytest tests/unit/test_xcat_core.py`.

## Inventory

`find` of `test_*.py` and `*_test.py`, excluding `.git`, the venv, `node_modules`, and Rust `target`: **51** modules.

## Canonical command

```text
.venv-audit/bin/pytest -q --tb=line
```

Two runs agreed:

| Run | Collected | Passed | Failed | Skipped | Duration | Warnings |
|---|---:|---:|---:|---:|---:|---|
| 1 | 693 | 690 | 3 | 0 | 35.79s | none reported |
| 2 | 693 | 690 | 3 | 0 | 29.56s | none reported |

Exit code: **1**

## Failures (not hidden)

1. `tests/web/test_v1_media_and_lab.py::test_daily_lab_is_premium_3d_with_finite_queue`
   Asserts the source string `Daily 3D Lab`. `apps/web/src/lab/DailyLab.tsx` now says `Daily Lab`.
2. `tests/web/test_v1_media_and_lab.py::test_unified_composer_and_nav_surfaces`
   Asserts nav label `Privacy / Proof`. `apps/web/src/layout/Nav.tsx` now uses `Privacy` and `Capabilities`.
3. `tests/web/test_web_architecture_gates.py::test_shipped_release_wasm_matches_kernel_artifact_hash`
   The suite's own `ensure_wasm_artifact()` builds `portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm` with the environment compiler rustc 1.83.0. That file hashes to `27c73e9024b5fbf1933c5c7a37d4655ad2be623b8e75d9791c50ffef4f92bc91`. The tracked public file hashes to `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`.

Failures 1 and 2 are frozen-copy drift. They were not edited. Failure 3 is the byte-identity gap between this machine's locked build and the tracked artifact. The public artifact was not overwritten.

## Key laws

These laws have executable tests in the 690 passed results. No fake tests were added.

| Law | Result | Where it was executed |
|---|---|---|
| ProtectedIntent | PASS | `test_batch_e_adversarial.py`, `test_spe_context_protocol_roundtrip.py`, `test_protocol_evaluators_optimizer.py`, `test_c07_authority.py` |
| Goal immutability | PASS | optimizer protected-intent rejection; grounding refresh does not mutate intent |
| Context Grounding | PASS | `test_grounding_models.py`, `test_grounding_privacy_freshness.py`, `test_grounding_c02_bridge.py` |
| Context need | PASS | `test_context_need_compiler.py` |
| Contradiction detection | PASS | `test_protocol_merge_and_routing.py` colliding instructions; adversarial conflicting sources |
| Trust firewall | PASS | `test_grounding_firewall.py` |
| Quality evaluator | PASS | `test_protocol_evaluators_optimizer.py` |
| Bounded reconstruction | PASS | `.spe` round-trip tests. Byte identity of the shipped WASM file is a separate failure (row 3 above). |
| Retry bound | PASS | `test_c07_authority.py` retry and operation-id cases |
| Goal mutation prevention | PASS | protected-intent and C07 mutation cases |
| Constraint weakening | PASS | `test_09_c07_cannot_weaken_constraint` |
| Unknown handling | PASS | UNKNOWN stays distinct from PASS in portability and Rust-vector tests |
| Authority escalation | PASS | C07, provider-profile, and adversarial authority tests |
| Category engines | PASS for engines that exist | `test_xcat_core.py`, `test_xcat_c02_c06_c01_c03.py` cover C01, C02, C03, C06, C07. C04, C05, and C08–C12 remain unimplemented. No new category tests were added. |
| Canonical vectors | PASS | `test_canonical.py`, `test_context_protocol_vectors.py` (`test_python_oracle_matches_frozen_vectors`, `test_rust_matches_frozen_vectors_zero_mismatch`) |
| Python/Rust parity | PASS | `test_cross_language_determinism.py`, `test_rust_reference_conformance.py`, `test_sprint5_merge_gate_differential.py`, `test_wasm_reference_conformance.py` |

K3, Requirement Graph, quality-delta, Plan B, VALIDATE_ONLY, and budget preservation were not given new tests. They stay outside this evidence unlock.
