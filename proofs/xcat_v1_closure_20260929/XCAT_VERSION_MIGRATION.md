# XCAT version migration — DOMAIN v1 → v2

**Date:** 2026-09-29  
**Task:** 56B  
**Code:** `spe_runtime/xcat/migration.py` (+ Rust/WASM parity path)

## What changed

| Aspect | Old (registry v1) | New (DOMAIN v2) |
|--------|-------------------|-----------------|
| taxonomy label | (implicit / NEW_IMPLEMENTATION names) | `DOMAIN` |
| version | `1` | `2` |
| IDs | CAT:C01–C12 | CAT:C01–C12 (**stable**) |
| Meaning | Plan/Verify/Recover/Privacy/Authority/Provenance/Capability for C04/C05/C08–C12 | Translate/Learn/Business/Code/Multimedia/Career/Creative |

IDs stay. Semantic meaning is corrected. Old English names are **not** silent aliases.

## Reject path

`reject_legacy_payload_reinterpretation(taxonomy_version, category_id, payload)`:

- When `taxonomy_version == "1"` and the caller attempts to apply a DOMAIN specialty payload under a collision ID (notably C04/C05/C08–C12), raise:
  - **`LEGACY_TAXONOMY_UNMIGRATED`**
- `apply_category_payload` invokes this gate before writing `category_payload`.

Evidence vectors:

- `A049` legacy Plan reinterpretation → `LEGACY_TAXONOMY_UNMIGRATED`
- `A056` legacy Privacy as Code → `LEGACY_TAXONOMY_UNMIGRATED`
- Mutation **M13** kills silent Privacy→Code reinterpretation

## UNKNOWN ≠ SAFE MIGRATION

Absence of an explicit migration receipt is **not** permission to reinterpret:

| Unsafe silent mapping | Why forbidden |
|----------------------|---------------|
| Legacy C09 Privacy → DOMAIN C09 Code | Different owners/semantics; privacy remains K4 |
| Legacy C04 Plan → DOMAIN C04 Translate | Different meaning; K3 CognitivePlan ≠ translate IR |
| Legacy C05 Verify → DOMAIN C05 Learn | Verification remains K2 |
| Legacy C08 Recover → DOMAIN C08 Business | Recovery remains K7 |
| Legacy C10 Authority → DOMAIN C10 Multimedia | Authority remains K4 |
| Legacy C11 Provenance → DOMAIN C11 Career | Provenance writers remain K1/C02 |
| Legacy C12 Capability → DOMAIN C12 Creative | Capability remains K3/K7 registries |

Fail closed: migrate explicitly, or reject. Do not invent a “best guess” mapping.

## Provenance to retain

- Old registry version / names (this proof pack + `legacy_taxonomy` block in `data/category_registry_v1.json`)
- Founder ratification date `2026-09-29`
- New taxonomy=`DOMAIN` version=`2`
