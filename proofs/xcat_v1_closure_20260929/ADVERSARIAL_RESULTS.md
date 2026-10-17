# Adversarial results — CATEGORY_VECTORS + unit tests

**Date:** 2026-09-29  
**Corpus:** `proofs/xcat_v1_closure_20260929/CATEGORY_VECTORS.json`  
**Taxonomy:** DOMAIN v2  
**Counts (verified):** normal=**60**, adversarial=**56**, total vectors=**116**

## Adversarial class summary

| Kind | Count | Expected disposition | Meaning |
|------|------:|----------------------|---------|
| `authority_write` | 12 (C01–C12) | REJECT | Category must not mutate authority |
| `facts_write` | 12 | REJECT | Category must not rewrite facts |
| `forbidden_key` | 12 | REJECT | EXECUTED / VERIFIED_SUCCESS / authority keys banned |
| `unknown_field` | 12 | REJECT | IR field not in allowed payload set |
| `legacy_plan` | 1 (C04) | LEGACY_TAXONOMY_UNMIGRATED | Silent Plan→Translate reinterpretation |
| `mastery_no_evidence` | 1 (C05) | REJECT | MASTERED without mastery_evidence |
| `build_pass` | 1 (C09) | REJECT | Generation claimed as BUILD_PASS |
| `hypothesis_fact` | 1 (C08) | REJECT | Hypothesis elevated to fact |
| `licensed_oracle` | 1 (C10) | REJECT | Rights-oracle / LICENSED claim |
| `claim_as_credential` | 1 (C11) | REJECT | USER_CLAIM as VERIFIED_CREDENTIAL |
| `canon_silent` | 1 (C12) | REJECT | Silent canon overwrite |
| `legacy_privacy` | 1 (C09) | LEGACY_TAXONOMY_UNMIGRATED | Privacy→Code silent migration |

## Unit coverage

- `tests/unit/test_xcat_vectors_56b.py` — loads corpus, coverage + offline determinism (**5** tests collected; passed in 56B suite)
- Domain anti-laundering also covered in `tests/unit/test_xcat_domain_56b.py`
- Mutation suite separately kills related attacks (M11–M14, M13 legacy Privacy)

## Result

All 56 adversarial vectors expect fail-closed REJECT or LEGACY_TAXONOMY_UNMIGRATED. No UNKNOWN→PASS path introduced.
