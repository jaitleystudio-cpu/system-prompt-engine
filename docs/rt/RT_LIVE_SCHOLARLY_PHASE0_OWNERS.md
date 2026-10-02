# RT Live Scholarly Fabric — Phase 0 Owner Map

Captured: 2026-10-02 23:21 IST
Branch: `grok/rt-live-scholarly-fabric-20261002`
Base: `afe1453c515be3b189b27828e20d03d64f80cbdd` (VR1)
Rule: **extend existing Context Grounding / Research architecture — NO second research engine**

## Primary owners (extend these)

| Layer | Path | Role |
|---|---|---|
| TS research fabric | `apps/web/src/engine/continuation/researchFabric.ts` | Offline seed corpus, citation verify, evidence need, acquireScholarlyEvidence (networkCalls=0 today), SCHOLARLY_FABRIC_TRUTH_STATUS / HOLD displays |
| TS types | `apps/web/src/engine/continuation/types.ts` | `ScholarlySourceRecord` (`isRetracted` boolean today — must be upgraded to non-collapsing retraction states) |
| TS oracle guards | `apps/web/src/engine/continuation/oracleGuards.ts` | minimizePublicQuery, matchIdentifierClaim (NOT_PROVEN_NOT_RETRACTED when <2 sources), assessRetrievedBody, URL/consent gates |
| TS report verifier | `apps/web/src/engine/continuation/reportVerifier.ts` | Contradicts LIVE_INDEX/LIVE_RETRACTION=PASS / FULL_SCHOLARLY YES without evidence |
| TS consumers | `apps/web/src/engine/continuation/{evidenceGraph,continuationCompiler,gildenBoundary,index}.ts` | C02/K3/RT consumers via Continuation pipeline |
| TS UI | `apps/web/src/workspace/TaskContinuationInspector.tsx` | Three-state scholarly display + HOLD gates |
| Python grounding | `spe_runtime/grounding/` | ContextNeed → privacy → SourcePolicy → firewall → freshness → ContextCapsule |
| Grounding modules | `need.py`, `privacy.py`, `policies.py`, `firewall.py`, `freshness.py`, `compiler.py`, `models.py`, `recipes.py`, `profiles.py` | Existing pipeline pieces |
| C02 bridge | `spe_runtime/categories/c02_research/` | `research_from_grounding` → ResearchProjectIR proposal (DOMAIN; no epistemic commit) |
| Grounding data | `data/grounding/source_policies.json` | Source policy registry (no network) |

## Prior Lane-C scholarly package (reference only — NOT on this tip)

Branch `origin/grok/spe-scholarly-fabric-v1-20260929` contains `spe_runtime/scholarly/` (pipeline, transport, retraction merge, OpenAlex/Crossref/PubMed adapters, proofs). **Not present on VR1/ABCD tip.** Do not revive as a parallel engine. Mine contracts/ideas only; wire live adapters into **grounding + researchFabric** path:

`ContextNeed → privacy-minimized query → source policy → live scholarly adapters → normalization → source firewall → freshness → provenance → conflict → retraction evidence → ContextCapsule → existing C02/K3/RT consumers`

## Free/open adapter targets (₹0; inspect before wiring)

| Provider | Prior host (Lane C) | Notes |
|---|---|---|
| OpenAlex | `api.openalex.org` | free |
| Crossref | `api.crossref.org` | free |
| PubMed / PMC | `eutils.ncbi.nlm.nih.gov` / `pmc.ncbi.nlm.nih.gov` | free |
| Europe PMC | `www.ebi.ac.uk` | free |
| arXiv | `export.arxiv.org` | preprint ≠ peer-reviewed |
| DOAJ | `doaj.org` | free |

No paid APIs. No Semantic Scholar / CORE paid paths.

## Existing tests to keep green / extend

| Suite | Path |
|---|---|
| VR1 truth fail-closed | `tests/test_rt_vr1_truth_fail_closed.mjs` |
| RT-Q0 adversarial | `tests/test_rt_q0_adversarial_oracles.mjs` |
| Continuation engine | `tests/test_task_continuation_engine.mjs` |
| Grounding unit | `tests/unit/test_grounding_*.py` |
| Grounding firewall | `tests/security/test_grounding_firewall.py` |
| C02 bridge | `tests/integration/test_grounding_c02_bridge.py` |
| False-proof gate | `scripts/ci/assert-no-live-pass-claims.sh` |

## New oracle suite (this lane)

`tests/test_rt_live_scholarly_fabric_oracles.mjs` — TDD RED matrix + mutant kills.
Contract stubs: `apps/web/src/engine/continuation/liveScholarlyFabric.ts` (types + fail-closed stubs; not live PASS).

## Status claims

LIVE_INDEX=**HOLD** · LIVE_RETRACTION=**HOLD** until mutants killed with evidence.
