# Task57R-F3E AUTO XCAT closure

**Base SHA:** `83c354f51af1c4a967811ed03284b4e539925e55`
**Implementation commit:** `7e9e104c118d146272ae5c4c784306f54dbd11c6`
**Final SHA:** branch tip that records this line
**Branch:** `cursor/spe-quality-delta-planb-validate-only-20260929`
**PR:** #57 draft, not merged
**Disposition:** PASS

## Contract

`AI Assistant` is AUTO routing mode. It is not a thirteenth category and it is not `CAT:C01` or any other fixed id.

The canonical taxonomy remains `CAT:C01`–`CAT:C12` in `data/category_registry_v1.json` version `2`. No `CAT:C13`.

One category router: `route_mission_stage` / `CategoryRouterIR` (`xcat.router.v1`). Rust `route_mission_stage` is the same law. K3 consumes the router result. Quality copies that id. TypeScript transport still sends `display_label` only.

## Routing evidence

AUTO evidence is kernel-derived:

- Clause-initial act on the goal atom, after a closed politeness prefix. The matched characters are not stored.
- ProjectIR fields that belong to exactly one founder category, taken from requirement-graph node values. `category_ref` rendering nodes are skipped.
- Caller `xcat_id`, `category_ref`, and `category_evidence` proof strings are rejected in AUTO mode. They do not become the category.

Frame record: `act`, `category`, `key=semantic_frame`, `ordinal`, `provenance=KERNEL_DERIVED`, `source_ref` (`goal` or `structured_evidence`). Receipt basis is `semantic_frame`, `ambiguous_request`, `insufficient_evidence`, `rejected_self_selection`, or `conflicting_category_evidence`.

Explicit product bridges stay: `Research → CAT:C02`, `Analysis → CAT:C06`. They are not AUTO.

## Category cases

| Case | Result |
| --- | --- |
| Decide whether to launch the checklist in four weeks. | ROUTED `CAT:C01` |
| Research current accessibility evidence for public websites. | ROUTED `CAT:C02` |
| Write an executive brief about the launch. | ROUTED `CAT:C03` |
| Translate the launch note into Spanish. | ROUTED `CAT:C04` |
| Teach the concept of indexes with three check questions. | ROUTED `CAT:C05` |
| Analyze the permit dataset for anomalies. | ROUTED `CAT:C06` |
| Execute the release checklist and record each postcondition. | ROUTED `CAT:C07` |
| Business offer for a writing app with pricing and channels. | ROUTED `CAT:C08` |
| Code a PostgreSQL query for monthly active users. | ROUTED `CAT:C09` |
| Storyboard a 15-second product video. | ROUTED `CAT:C10` |
| Career plan for a product designer interview. | ROUTED `CAT:C11` |
| Roleplay a coastal dawn scene with two characters. | ROUTED `CAT:C12` |
| Help with this soon. / arbitrary prose / empty goal | `NEEDS_DISAMBIGUATION`, primary null |
| Research the market or code the scraper | `UNKNOWN`, `CONFLICTING_CATEGORY_EVIDENCE` |
| Research current accessibility evidence and write an executive brief | primary `CAT:C02`, secondary `CAT:C03` |
| AUTO plus forged `CAT:C01` on a write goal | primary `CAT:C03`, `CAT:C01` rejected |
| Label `AI Assistant` with no act | `NEEDS_DISAMBIGUATION` |

`Researcher notes from yesterday` does not route. `Write a launch plan` stays `CAT:C03`.

## Default Chrome

Request, UI still on AI Assistant, no manual category:

`Write a four-week launch checklist. Budget must remain $2000. Do not invent extra spend.`

Unarmed Create: active category `C03`, reconstruction plan `NOT_TRIGGERED`, kept is not repaired.

Armed fault removes one hard constraint. Chrome qualification:

| Field | Result |
| --- | --- |
| category | `C03` |
| kept | `repaired` |
| plan | `ACCEPTED` |
| delta | `IMPROVED` |
| receipt | `PASS` |
| attempts | `1` (`max_attempts` 1) |
| constraint restored | yes |
| visible equals kept | yes |
| display, artifact, history, copy, json, spe | match the kept prompt |
| quality posts | 1 |

The existing Research-template repair path also stayed `ACCEPTED` / `IMPROVED` / `PASS`.

## Core B

`spe_wasm.wasm` aborted in Chrome. Safe fallback appeared. `.spe` export count was 0. The fallback text does not claim verified, verified better, or kernel verified. The successful artifact is not shown.

## Verification

| Check | Result |
| --- | --- |
| Python pytest | 1017 passed, 0 failed |
| Rust `cargo test --offline` | 41 passed, 0 failed |
| WASM run 1 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` |
| WASM run 2 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` |
| size | 1340112 |
| imports | 0 |
| reproducible | yes |
| Python ↔ Rust | match, including AUTO cases and the frozen K3 vectors |
| Rust ↔ WASM | match (`tests/portability/test_xcat_parity_56b.py`, `tests/portability/test_k3_cross_runtime.py`) |
| Python ↔ WASM | match |
| F3E mutants | 15 killed, 0 survived |
| F3 / F2 / F1 / XCAT / effect | historical mutant tests stayed green in the same pytest run; browser repaired mutants F2-01–F2-10, F3-11, F3-12 killed |
| egress | `zero_egress` true, `external_hosts` empty, `fetch_during_evaluate` 0 |
| production build | exit 0 |
| deployment gate | exit 2 |
| hosting | FORBIDDEN |

No deploy. No host.

## Changed files

- `spe_runtime/xcat/auto_route.py`
- `spe_runtime/xcat/router.py`
- `spe_runtime/k3/selector.py`
- `portable/spe-core-rs/src/xcat_auto.rs`
- `portable/spe-core-rs/src/xcat.rs`
- `portable/spe-core-rs/src/k3.rs`
- `portable/spe-core-rs/src/lib.rs`
- `tests/unit/test_xcat_auto_f3e.py`
- `tests/portability/test_xcat_parity_56b.py`
- `apps/web/scripts/test-create-quality-browser.mjs`
- `apps/web/public/spe_wasm.wasm`
- `apps/web/public/spe_wasm.sha256.json`
- `apps/web/scripts/copy-wasm.mjs`
- `tools/wasm_canonical_build.mjs`
- `tests/release/test_wasm_canonical_supply_chain.py`
- `tests/web/test_web_architecture_gates.py`
- `proofs/task57_quality_reconstruction_20260929/candidate-manifest.json`
- this file
