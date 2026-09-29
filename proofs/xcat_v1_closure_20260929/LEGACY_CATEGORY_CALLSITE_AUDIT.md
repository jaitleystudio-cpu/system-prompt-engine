# Legacy category callsite audit — Task 56C

**Base:** `e1e99b00e8e2848fb9a4e3fce22a3cfb65019031`  
**Scope:** `decide(`, `research(`, `research_from_grounding(`, `communicate(`, `analyze(`, `form_execution_intent(`, `retry_form_execution_intent(`

Classes: A production DOMAIN path, B compatibility/legacy path, C test-only, D obsolete/unreachable.

## Production runtime (`spe_runtime`, excluding tests)

| Symbol | Class | Sites | Notes |
|--------|-------|-------|-------|
| `decide` | B definition; C callers | `c01_decide/engine.py` | Directly writes `recommendation`. Not imported by `categories/domain.py`. |
| `research` | B definition; C callers | `c02_research/engine.py` | Directly appends facts/provenance/uncertainties. Not called by `research_from_grounding` after 56C. |
| `research_from_grounding` | A | `c02_research/engine.py`; grounding integration test | DOMAIN proposal only. Does not commit epistemic state. |
| `commit_epistemic_proposal` | A fail-closed | `c02_research/engine.py` | Raises `EPISTEMIC_OWNER_UNAVAILABLE`. |
| `communicate` | B definition; C callers | `c03_communicate/engine.py` | Directly writes `rendering`. |
| `analyze` | B definition; C callers | `c06_analyze/engine.py` | Directly writes `analysis`. |
| `form_execution_intent` | B definition; C callers | `c07_execute/engine.py` | Returns proposed `ExecutionIntent`. Appends category trace. Does not mint authority or commit success. |
| `retry_form_execution_intent` | B | calls `form_execution_intent` | Same legacy class. Preserves operation id. |

No K3, requirement-graph, protocol, or DOMAIN dispatcher module calls these legacy writers.

## Tests (class C)

- `tests/integration/test_xcat_c02_c06_c01_c03.py` — legacy chain C02→C06→C01→C03
- `tests/unit/test_c07_authority.py` — legacy execution-intent guards, including one legacy chain
- `tests/unit/test_xcat_mutations_56b.py` — M6/M8 still use `analyze` / `communicate` to prove those legacy engines reject laundering; M17–M23 use the DOMAIN path
- `tests/integration/test_grounding_c02_bridge.py` — one legacy `research(` test retained; `research_from_grounding` asserts non-commit

## Retirement

Legacy direct writers stay until callers in the historical XCAT suites are migrated. They are not the DOMAIN v2 compilation path. There is no `allow_legacy=True` default. Planned retirement: delete `decide` / `research` / `communicate` / `analyze` kernel assignments once those test suites call `apply_domain_category` only.

## Production reachability

`production_legacy_writer_reachability()` on `spe_runtime/categories/domain.py` = **0**.
