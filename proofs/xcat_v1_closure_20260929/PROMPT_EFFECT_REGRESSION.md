# Prompt effect regression — Task 56B

**Date:** 2026-09-29  
**Prior proof:** `proofs/k3_effect_binding_20260929/`  
**Suite:** `tests/unit/test_k3_effect.py`

## Effect mutants

| Defined | Killed | Survived |
|---------|--------|----------|
| 11 | 11 | 0 |

Source of truth for the 11 mutants: `EFFECT_MUTATION_RESULTS.md` / `M11_RESULT.md` under the K3 effect-binding proof pack, reasserted by `test_effect_mutants_are_killed` in this Task 56B regression run.

Observed this session: `tests/unit/test_k3_effect.py` → **33 passed**.

## Law preserved

**NO EFFECT PLAN → NO FINAL PROMPT**

Production renderer refuses unbound / null plans (`PromptBriefError` / missing-plan dispositions). Categories and XCAT routing do not bypass the effect binder.

## Scope

This is the effect-plan suite only — not a repository-wide mutation score. XCAT mutations M1–M16 are a separate suite (`MUTATION_RESULTS.md`).
