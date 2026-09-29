# XCAT v1 Canonical Registry — DOMAIN taxonomy

**Date:** 2026-09-29  
**Task:** 56B  
**Branch:** `cursor/spe-xcat-v1-closure-20260929`  
**Founder ratification:** 2026-09-29 DOMAIN taxonomy (`FOUNDER_XCAT_V1_RATIFICATION.md`)  
**Registry file:** `data/category_registry_v1.json`

## Version

| Field | Value |
|-------|-------|
| taxonomy | `DOMAIN` |
| version (new) | `2` |
| supersedes_version (old) | `1` |
| ratification_date | `2026-09-29` |
| ratification_ref | `proofs/xcat_v1_closure_20260929/FOUNDER_XCAT_V1_RATIFICATION.md` |

Category count: **12**. No C13+.

## Normative names (DOMAIN v2)

| ID | Name |
|----|------|
| CAT:C01 | Advise / Plan / Decide |
| CAT:C02 | Research |
| CAT:C03 | Write / Rewrite / Communicate |
| CAT:C04 | Translate / Localize / Language Transform |
| CAT:C05 | Learn |
| CAT:C06 | Analyze / Compare / Extract |
| CAT:C07 | Work / Execute |
| CAT:C08 | Business |
| CAT:C09 | Code |
| CAT:C10 | Multimedia |
| CAT:C11 | Career |
| CAT:C12 | Creative / Story / Roleplay |

## Legacy metadata only (v1 — not canonical aliases)

Status: `MIGRATION_METADATA_ONLY`. English names below are custody/migration metadata. They MUST NOT be treated as live aliases for DOMAIN semantics. `UNKNOWN != SAFE MIGRATION`.

| ID | Legacy (v1) name |
|----|------------------|
| CAT:C01 | Decide |
| CAT:C02 | Research |
| CAT:C03 | Communicate |
| CAT:C04 | Plan |
| CAT:C05 | Verify |
| CAT:C06 | Analyze |
| CAT:C07 | Execute |
| CAT:C08 | Recover |
| CAT:C09 | Privacy |
| CAT:C10 | Authority |
| CAT:C11 | Provenance |
| CAT:C12 | Capability |

## Stability rule

- **IDs** `CAT:C01` … `CAT:C12` are stable.
- **Meaning** of collision IDs (especially C04/C05/C08–C12) is corrected under DOMAIN v2.
- Legacy payloads with `taxonomy_version=1` require explicit migration or rejection (`LEGACY_TAXONOMY_UNMIGRATED`).
