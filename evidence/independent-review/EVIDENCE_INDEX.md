# SPE Ω — Evidence Index for Independent Adversarial Verification

**Date:** 2026-10-08  
**Auditor Role:** Hostile Independent Verifier (Grok)  
**Target Release Candidate Freeze:** 2026-10-24  
**Public Release Target:** 2026-10-26 22:10 IST  
**Candidate Branch:** `candidate/2026-10-26`  
**Repository:** `https://github.com/jaitleystudio-cpu/system-prompt-engine.git`  

---

## 1. Machine-Readable Evidence Files

| Evidence File | Provenance Tier | Description | Machine Verification Command |
|---|---|---|---|
| [`evidence/test-manifest.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/test-manifest.json) | `LOCAL_VERIFIED` | Machine test manifest parsed from JUnit XML: 736/736 unit tests pass, 30 CLI commands, WASM hash | `npm --prefix apps/web run manifest:test` |
| [`evidence/unknown-register.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/unknown-register.json) | `EMPIRICAL_GOVERNANCE` | 12 real-world unobserved empirical dimensions honestly tracked (live payments, field CWV, remote model drift) | Verified non-zero UNKNOWNs |
| [`evidence/EGRESS_PROOF.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/EGRESS_PROOF.json) | `LOCAL_VERIFIED` | Host-level socket, DNS, and Gilden egress audit proving zero unexpected outbound packets | `python scripts/test-network-egress.py` |
| [`evidence/benchmarks/PAIRED_BENCHMARK_REPORT.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/benchmarks/PAIRED_BENCHMARK_REPORT.json) | `LOCAL_VERIFIED` | Paired baseline: raw prompt vs compiled prompt across 15 domains and 3 splits (`DEV`, `VAL`, `HELD_OUT`) | `pytest tests/unit/test_bench_corpus.py` |
| [`evidence/seo-manifest.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/seo-manifest.json) | `LOCAL_VERIFIED` | Audit of 25 pre-rendered static HTML routes, zero placeholder spam, rich domain-specific evidence | `node scripts/generate-evidence-seo.mjs` |
| [`evidence/FRESH_MACHINE_REPRODUCTION.json`](file:///Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/evidence/FRESH_MACHINE_REPRODUCTION.json) | `LOCAL_VERIFIED` | Clean step-by-step reproduction instructions for fresh developer environments | Clean git checkout & pytest |

---

## 2. Evidence Classification Standard

Every claim in SPE Ω is strictly typed according to Section 3 of the Master Execution Directive:

1. **`LOCAL_VERIFIED`**: Executed locally in test suites or local sandboxes.
2. **`REMOTE_CI_VERIFIED`**: Built and tested in clean GitHub Actions runners (`spe-phase2-ci.yml`).
3. **`STAGING_VERIFIED`**: Qualified on isolated staging infrastructure (scheduled for Oct 23).
4. **`INDEPENDENTLY_REVIEWED`**: Hostile refutation completed by Grok.
5. **`PRODUCTION_VERIFIED`**: Only applicable post-release under founder sign-off.
6. **`UNKNOWN`**: Explicitly maintained in `evidence/unknown-register.json` when real-world data is absent.

---

## 3. Pinned Canonical Hashes

- **Canonical WASM Engine SHA-256:**  
  `ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d`
- **Reviewed Copy Catalog Strings:** 4,147 strings  
- **Unreviewed Copy Violations:** 0 strings (`npm --prefix apps/web run spe:copy-check`)
