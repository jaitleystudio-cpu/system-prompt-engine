# Task57R-F3E-R1V mutation results

**Base SHA:** `f07511d9e2def7aa7129fa2c718b76e4ec9f1407`
**Test:** `tests/unit/test_xcat_r1v_mutants.py::test_r1v_mutants_are_killed`
**Result:** 1 passed. defined=20, killed=20, survived=0.

Each mutant is killed when the current kernel rejects the illegal outcome. No defect was planted.

| Id | Illegal outcome | Kill |
| --- | --- | --- |
| R1V-01 | Wrong category sticky after AUTO | C03 then C01; the second primary is `CAT:C01` |
| R1V-02 | AI Assistant as `CAT:C13` or forced C01 | neither id is in `CATEGORY_IDS`; unlabeled and forged `CAT:C13` stay primary null; label-only is not `CAT:C01` |
| R1V-03 | Forged caller `xcat_id` wins AUTO | write goal plus `CAT:C01` stays `CAT:C03` and rejects `CAT:C01` |
| R1V-04 | Unrecovered protocol invented | translate route has no protocol fields; label `Multilingual` is `NEEDS_DISAMBIGUATION`; unknown C04 field raises `ValueError` |
| R1V-05 | UNKNOWN → PASS | disambiguation quality verdict is not `PASS`; forged `CAT:C02` on empty prose is K3 `UNKNOWN` and quality is not `PASS` |
| R1V-06 | VALIDATE_ONLY PASS without repair | corrupted hard-constraint subject is not `PASS` until `evaluate_from_k3` repairs it |
| R1V-07 | `NO_EFFECT_PLAN` renders an executable prompt | closed plan `compiled_prompt` is null; routed prompts start with `## ` and `claims_pass` is false |
| R1V-08 | Repaired kept ≠ visible | kept prompt differs from the corrupted prompt and contains the restored constraint |
| R1V-09 | `display_label` drives semantic category | bridges are only Research and Analysis; Writing and AI Assistant do not assign a category without an act |
| R1V-10 | Python ≠ Rust ≠ WASM | AUTO goals C01–C12 match `route_mission_stage`, `spe-core-eval`, and the WASM host |
| R1V-11 | Secondary category dropped or conflict forced | research-and-write keeps primary C02 and secondary C03; research-or-code is `UNKNOWN` with `CONFLICTING_CATEGORY_EVIDENCE` |
| R1V-12 | `NEEDS_DISAMBIGUATION` forced to a category | `Help with this soon.` primary is null |
| R1V-13 | Authority laundering via Quality | receipt `execution_authorized`, `authority_minted`, and `network` are false; outcome `NOT_EXECUTED`; K3 `claims_pass` is false |
| R1V-14 | Egress during evaluate | `eval-fixture.mjs` `fetch_during_evaluate` 0, websocket 0, no TypeScript fallback |
| R1V-15 | WASM pin unreproducible | public bytes sha256 and size match the pin; imports 0; pin text is in the canonical build and copy scripts |
| R1V-16 | Core-B fallback claims verified | `core-b.mjs` sets verified, quality_verified, semantic_engine_used, and execution_authorized false |
| R1V-17 | `max_attempts` exceeded silently | `attempt_index` 2 is `REFUSED` / `ATTEMPT_BUDGET_EXCEEDED`, kept original |
| R1V-18 | Constraint not restored | repaired kept prompt contains the removed statement; plan is `ACCEPTED` |
| R1V-19 | Frozen K3 vectors mutated | `K3_VECTORS.json` sha256 `563bf5cc5b454c9cf453dfdf59b98b533932633195e23eb4a98eadbee9b286c2`; N01 stays `SAFE_DEFAULT` with null category |
| R1V-20 | Second semantic router | one `route_mission_stage` in Python `router.py` and Rust `xcat.rs`; absent from `auto_route.py`, K3 selector, Quality engine, and `k3Transport.ts` |

The harness rebuilds `spe-core-eval` when `xcat.rs` is newer than the binary, so a stale debug artifact cannot pass R1V-10.
