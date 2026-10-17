# SPE Ω — Release Governance & Immutability Law v1.0
**Target Release:** 2026-10-26 22:10 IST | **RC Freeze Date:** 2026-10-24 23:59 IST

---

## 1. Core Principles & Immutability Standard
To ensure auditability, repeatable evidence, and forensic integrity, SPE Ω enforces a strict two-stage branch and release lifecycle:

1. **Pre-Freeze Moving Candidate Lineage:**
   - Active development, integration of the 12 moat engines, tests, and evidence promotion occur on:
     - Integration Train: `integration/spe-2026-10-26`
     - Pushed Moving Candidate: `candidate/2026-10-26`
   - Both branches reflect verified, tested commits.
   - **No branch named `rc*` or `release/*-rc*` may exist or be force-moved prior to the formal freeze date.**

2. **Immutable Release Candidate Creation (October 24, 2026):**
   - At the RC Freeze checkpoint on October 24, 2026:
     - The exact qualified candidate commit SHA on `candidate/2026-10-26` is pinned.
     - The immutable release branch `release/2026-10-26-rc1` is created.
   - **Immutability Law:** Once created, `release/2026-10-26-rc1` must **NEVER** be force-updated (`git push -f`, `git branch -f`).
   - Any necessary repairs discovered during destructive qualification (Oct 24–26) must be committed to subsequent, append-only RC branches:
     - `release/2026-10-26-rc2`
     - `release/2026-10-26-rc3`
     - etc.

---

## 2. Evidence Classification Hierarchy
Every claim, test result, benchmark, and security assertion must be explicitly labeled with its achieved verification tier. No higher tier may be claimed without its corresponding witness evidence:

| Evidence Tier | Definition | Required Witness |
| :--- | :--- | :--- |
| `BUILT` | Source code, test, or documentation authored and syntactically valid. | Working tree presence. |
| `LOCAL_VERIFIED` | Passed automated test suite, compiler, or harness on local developer workstation. | Local execution logs / exit code 0. |
| `REMOTE_CI_VERIFIED` | Verified independently by remote GitHub Actions CI on an official runner. | Pushed remote commit SHA, GitHub workflow run ID, CI job logs. |
| `STAGING_VERIFIED` | Verified on deployed staging surface matching exact candidate SHA. | Staging deployment URL/ID, clean network capture, 7-journey qualification. |
| `INDEPENDENTLY_REVIEWED` | Refuted or validated by external adversarial evaluation (e.g. Grok audit). | Independent review receipt with identified limitations or counterexamples. |
| `PRODUCTION_VERIFIED` | Executed and monitored in production post-founder authorization. | Production telemetry, real user telemetry with privacy consent. |

---

## 3. Machine-Readable Test Manifest Invariant
- Test counts in release reports must **never** be hand-edited.
- All totals must be generated directly by automated test runners emitting `evidence/test-manifest.json`.
- Discrepancies between human-readable markdown reports and machine-generated test manifests constitute an immediate release gate failure.

---

## 4. Unknown State Preservation
- An unobserved capability, external model behavior, or real payment flow must **never** be reported as `PASS` or `0 UNKNOWNs`.
- All unobserved dimensions are recorded in `evidence/unknown-register.json` with clear testing prerequisites and assigned owners.
