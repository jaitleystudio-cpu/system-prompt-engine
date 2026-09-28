# XCAT v1 Contract Source Index — 2026-09-29

Base SHA: `04bc003ce358fc72279ce40cb96fa2990f8033c6`  
Work branch: `cursor/spe-xcat-v1-closure-20260929`

## Search performed

| Surface | Result |
|---------|--------|
| CURRENT TREE | Registry names only for C04/C05/C08–C12; engines only for C01/C02/C03/C06/C07 |
| `data/category_registry_v1.json` | 12 IDs + names; no protocol fields |
| `data/xcat_fixtures_v1.jsonl` | empty |
| `data/xcat_mutations_v1.jsonl` | empty |
| `docs/implementation/xcat-*.md` | Sprint 1–3 only (core + C02/C06/C01/C03 + C07) |
| `spe_runtime/categories/` | c01, c02, c03, c06, c07 only — never had c04/c05/c08–c12 in history |
| `schemas/*` related stubs | privacy_label, capability_manifest, provenance_record, authority_state, category_registry = STUB |
| `schemas/recovery_plan.schema.json` | K7 Ring-1, not CAT:C08 |
| `schemas/xcat_envelope.schema.json` | envelope shape + CAT:C01–C12 trace pattern |
| K3 registry/selector | IMPLEMENTED vs UNIMPLEMENTED sets; NO_SELECTION for missing |
| proofs/k3_runtime_closure_20260929 | documents unimplemented → NO_SELECTION |
| proofs/requirement_graph_closure_20260929 | uses C04/C08 as missing-category / adversarial vectors only |
| Historical commits a6b7e57, 3f0847d, 931128b | K3 strategy / K0–K1 provenance / baseline — no XCAT C04–C12 protocols |
| G1 artifacts @ c700494 (`proofs/g1/*`, RING0_WORKING_CONTRACT) | Ring-0 kernel owners; semantic_writer_map for implemented categories; no missing-category protocols |
| `git log -S'CAT:C04'..C12` | registry + K3 NO_SELECTION + test vectors only |
| Product “category protocol” docs (2026-09-24) | UI/product protocol compiler — **not** XCAT CAT:Cxx engines |
| `spe_runtime/capabilities/` | empty stub / RETIRE in G1 disposition |

## Normative sources used (precedence order)

1. **Explicitly frozen normative contract**
   - `schemas/xcat_envelope.schema.json`
   - `spe_runtime/xcat/invariants.py` (X01–X10)
   - `spe_runtime/xcat/handoff.py`
   - `data/category_registry_v1.json` (ID+name registry only)
   - `specs/spe-omega-v2.4.1/RING0_WORKING_CONTRACT.json` @ historical `bcb5c3d`/`c700494` (kernel owners; not in HEAD tree but recoverable from git)
2. **Later accepted/frozen design + implementation**
   - Sprint docs `xcat-core-s1.md`, `xcat-c02-c06-c01-c03-s2.md`, `xcat-c07-authority-s3.md`
   - Category engines/validators for C01/C02/C03/C06/C07
   - K3 `IMPLEMENTED_XCAT` / `UNIMPLEMENTED_XCAT` @ `98bc160`→HEAD
3. **Accepted tests/proofs**
   - `tests/unit/test_xcat_core.py`
   - `tests/integration/test_xcat_c02_c06_c01_c03.py`
   - `tests/unit/test_c07_authority.py` (and sprint3 proofs under `proofs/generated/`)
   - K3 adversarial A07–A13
4. **Older design / non-normative**
   - Context-grounding category protocol design (product protocols) — recorded as non-XCAT
   - G1 semantic_writer_map — used for conflict detection vs inventing C09–C12 writers

## SHA pins cited

| SHA | Role |
|-----|------|
| `04bc003ce358fc72279ce40cb96fa2990f8033c6` | Required base (K3 effect binding fail-closed) |
| `6c7fa1d654d73fcbaf35699a5c226261538fd46f` | XCAT Sprint 1 + registry |
| `a8078e8` / `43281c8` | Sprint 2 + merge-gate |
| `f8d7bf2` / `967d2c9` | Sprint 3 C07 + merge-gate |
| `98bc160184afa0cf95f17ff23392645c16ccc516` | K3 selector + UNIMPLEMENTED_XCAT |
| `a6b7e572b66632aab3837242983afec96672c148` | G1R-7R (inspected; no C04–C12 XCAT protocol) |
| `3f0847d37fa1857e4a391c97ba7fd2448feb32c1` | G1R-3 K0/K1 (inspected; provenance kernel, not C11) |
| `931128b384c3055ecef876124f787e5b8e67651b` | G1 base (inspected) |
| `c7004940e930e7b0d39e7094c269564b246f9f05` | G1RV binding pack with g1 proofs |
| `bcb5c3d9784b62c2d6dcfeb0d40eebb1060e632e` | RING0_WORKING_CONTRACT introduction |

## Negative evidence (important)

`git rev-list --all --objects` found **no** historical paths matching `c04_*`, `c05_*`, `c08_*`…`c12_*` category engines, nor `xcat*contract` protocol docs defining those seven categories' I/O.
