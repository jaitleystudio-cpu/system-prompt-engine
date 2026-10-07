# SPE-R9-F — Scholarly / retraction path repair (BUILD)

**FINAL:** `SPE_R9F_HOLD_EXPLICIT`  
**Captured:** 2026-10-07 Asia/Calcutta (IST)  
**Branch:** `grok/r9-f-scholarly-retraction`  
**Base:** `895a3230d445089b3fdb48fbbb101e7b539f58c8` (`grok/r9-d-studio-runtime-journey`)  
**Machine:** Prawins-Mac-mini.local  
**Cost:** INR 0 · MERGED=NO · DEPLOYED=NO · FORCE_PUSH=NO

## Owner (canonical — no ResearchEngine2)

Live scholarly / retraction continues to run through the existing owner:

- `spe_runtime.grounding.research_journey.run_research_journey`
- adapters: `spe_runtime.grounding.live_adapters`
- retraction merge: `spe_runtime.grounding.retraction`
- promotion gate mirrors: `spe_runtime.grounding.live_fabric` (`LIVE_INDEX=HOLD`, `LIVE_RETRACTION=HOLD`)

No second research engine, no XCAT/taxonomy replacement, no TS `ResearchEngine2`.

## Repair (BUILD)

1. Restored missing unit oracles that already belong to tip modules (were on the older p3 lane, not an ancestor of this tip):
   - `tests/unit/test_live_scholarly_retraction_states.py`
   - `tests/unit/test_live_scholarly_promotion_gate.py`
   - `tests/unit/test_live_scholarly_adapters.py`
2. CLI `--live` now accepts `--evidence-dir` and auto-creates  
   `evidence/r9-f-scholarly-retraction/fresh/<IST-stamp>/` when omitted, so scoped live bodies are durable (same owner path; gates unchanged).
3. Added `tests/unit/test_r9f_research_journey_cli.py` (HOLD preserved; bodies bound).

## Live evidence (writer receipt — not promotion)

Fresh consented multi-provider fetch for well-known retracted DOI `10.1038/nature00870`:

| Field | Value |
|---|---|
| Path | `evidence/r9-f-scholarly-retraction/fresh/20261007T113158+0530/` |
| Journey status | `LIVE_FETCH_SCOPED` |
| Verification | `DOI_MATCH` |
| Retraction | `RETRACTION_SIGNAL` (Crossref independent family) |
| Families | OPENALEX, CROSSREF, NCBI |
| `may_promote` | **false** |
| `product_LIVE_INDEX` | **HOLD** |
| `product_LIVE_RETRACTION` | **HOLD** |
| OpenAlex body sha256 | `ea818b14eb7f5761cf5cec52a968a815e020e7ccbb042ce40e6243d8c58ee814` |
| Crossref body sha256 | `fdaef51c835946599f9a20d8b267fd32385a243949ceb655056c6e26c27ff32a` |

Promotion gate reasons (explicit): `MUTANTS_NOT_GREEN`, `INDEPENDENT_LIVE_NETWORK_PROOF_MISSING`, `LIVE_INDEX=HOLD`, `LIVE_RETRACTION=HOLD`.

**Not claimed:** LIVE_INDEX/LIVE_RETRACTION PASS, founder flip, independent verifier receipt, full-index promotion, invented papers, or search-noise PASS.

## Tests

```
pytest tests/unit/test_r9f_research_journey_cli.py \
  tests/unit/test_live_scholarly_retraction_states.py \
  tests/unit/test_live_scholarly_promotion_gate.py \
  tests/unit/test_live_scholarly_adapters.py \
  tests/unit/test_r5_research_journey.py \
  tests/unit/test_r6_scoped_live_fetch.py
→ 40 passed
```

## Epistemic law (unchanged)

OFFLINE≠LIVE · CACHE≠LIVE · NO_MATCH≠NOT_RETRACTED · UNKNOWN≠PASS ·  
ONE_DOI≠founder law · writer receipt≠independent verifier · PubMed+PMC=one NCBI family
