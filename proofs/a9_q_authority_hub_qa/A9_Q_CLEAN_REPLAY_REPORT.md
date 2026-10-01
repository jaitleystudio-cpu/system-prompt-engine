# A9-Q Clean Custody Replay Report

Lane: SPE Ω — A9-Q CLEAN CUSTODY REPLAY  
Local time: 2026-10-01 06:43 IST  
Machine: Prawins-Mac-mini.local (`0d308a2c-330c-430b-85e3-74d647e69e59`)

## Pre-write custody record

| Field | Value |
| --- | --- |
| BASE_SHA | `8ddfe7e630d507ad9c13345e4e2e03120903ea82` (exact clean A9-R head; NOT main; NOT PR #83) |
| MERGE_BASE | `646d3765153f66c3951d812b8adfd87fcbf766b1` (`origin/main`) |
| WORKTREE_CLEAN | YES (before proof checkout) |
| EXPECTED_PROOF_FILES | 11 tip files from `a8b2559f8ce5c3965ed3c57062175c8df020fcfc` |
| UNRELATED_FILES | 0 |

PR #83 status: CLOSED SUPERSEDED (`FINAL=A9_PR83_CONTAMINATED`). **PR83_TOUCHED=NO** — not repaired, rebased, or merged.

## Contaminated tip recovery

- Contaminated PR tip commit: `a8b2559f8ce5c3965ed3c57062175c8df020fcfc` (`docs: record A9-Q Authority Hub schema and browser QA`)
- Tip parent was `a8b2559f8ce5c3965ed3c57062175c8df020fcfc^` = `8f6a787` (ancestor of clean base, but PR #83 head history vs `main` was contaminated with unrelated V1/website files).
- Tip commit tree itself contained **only** the 11 paths under `proofs/a9_q_authority_hub_qa/`.
- Replay method: `git checkout a8b2559f8ce5c3965ed3c57062175c8df020fcfc -- proofs/a9_q_authority_hub_qa/` onto clean BASE_SHA worktree.
- Byte identity vs tip (pre-fresh-run): 11/11 OK. Fixture `smuggled-authority.spe.json` restored to tip bytes after browser import mutated digests/ids (incidental import side-effect; not product change).

## Files in this clean replay

Intended proof/evidence only:

1. `proofs/a9_q_authority_hub_qa/REPORT.md` (tip product-defect HOLD record; preserved)
2. `proofs/a9_q_authority_hub_qa/attack_runtime.mjs`
3. `proofs/a9_q_authority_hub_qa/attack_schemas.py`
4. `proofs/a9_q_authority_hub_qa/browser_qa.mjs`
5. `proofs/a9_q_authority_hub_qa/browser_qa_results.json` (**fresh** Mac re-run on clean base; see Tests)
6. `proofs/a9_q_authority_hub_qa/fixtures/inspect-lying-record.html`
7. `proofs/a9_q_authority_hub_qa/fixtures/simple-false-badge.html`
8. `proofs/a9_q_authority_hub_qa/fixtures/smuggled-authority.spe.json` (tip bytes)
9. `proofs/a9_q_authority_hub_qa/render-entry.tsx`
10. `proofs/a9_q_authority_hub_qa/runtime_attack_results.json` (re-run; byte-identical to tip)
11. `proofs/a9_q_authority_hub_qa/schema_attack_results.json` (re-run; byte-identical to tip)
12. `proofs/a9_q_authority_hub_qa/A9_Q_CLEAN_REPLAY_REPORT.md` (this custody report)

No apps/web source feature changes. No I1/I2. No pin modification. No merge/deploy/host.

## Tests (fresh on BASE_SHA)

| Oracle | Present on base? | Result |
| --- | --- | --- |
| A9 Node harness (`apps/web/scripts/test-authority-hub.mjs`) — 14-field evidence, schema truth, route isolation / publication | YES | **PASS** |
| A9 pytest (`tests/web/test_authority_hub_seo.py`, `tests/unit/test_c07_authority.py`, `tests/unit/test_authority_numeric_boundaries.py`) | YES | **52 passed** |
| Schema attack (`proofs/a9_q_authority_hub_qa/attack_schemas.py`) | YES (replayed) | **PASS** (stub schemas still accept publish; Python flag checks as tip REPORT) |
| Runtime attack (`proofs/a9_q_authority_hub_qa/attack_runtime.mjs`) | YES (replayed) | **PASS** (evidence regenerated; identical to tip JSON) |
| Browser QA (`browser_qa.mjs` + Vite `127.0.0.1:5173`) | YES (replayed) | **PASS** (Mac Chrome one-off path; committed script still uses `/usr/bin/google-chrome` for Linux/Cursor artifact path). Findings: no Publish/Share/Deploy/Host **controls**; Daily Lab still has publication **copy** hits (D8). Smuggled import still shows authority pill GRANTED vs card NONE/PASS (D6/D7). |
| Dedicated link-resolution harness | **NO** | **GAP** — no separate link-resolution oracle script on BASE_SHA. Only `evidenceLinks` field presence inside A9 Node harness. |
| Dedicated publication-state harness | Partial | Covered by A9 Node route-isolation asserts + browser `publication_hits` / `control_hits` (not a separate named oracle file). |

### Oracle gap (documented)

```
ORACLE_GAP=link-resolution
DETAIL=No dedicated link-resolution harness/script exists on BASE_SHA 8ddfe7e630d507ad9c13345e4e2e03120903ea82.
COVERED_PARTIAL=evidenceLinks mandatory field string presence in apps/web/scripts/test-authority-hub.mjs
```

Product defect posture from tip `REPORT.md` remains: `HOLD_STUB_SCHEMAS_SILENT_GRANT_FALSE_BADGE_PUBLISH_COPY`. This clean replay does **not** repair product code (scope = custody only).

## Diff purity

- UNRELATED_DIFF_COUNT=0 (vs BASE_SHA; only under `proofs/a9_q_authority_hub_qa/`)
- UNRELATED_FILES=0
- UNRELATED_COMMITS=0 (single clean-replay commit lineage from BASE_SHA)

## Footer

BASE_SHA=8ddfe7e630d507ad9c13345e4e2e03120903ea82
FINAL_SHA=941b5e16ac71c9e8f6c9e751489931596d11bb72
FILES_CHANGED=12
UNRELATED_FILES=0
TESTS=A9_NODE=PASS; PYTEST=52_PASSED; SCHEMA_ATTACK=PASS; RUNTIME_ATTACK=PASS; BROWSER_QA=PASS_MAC_OVERRIDE; LINK_RESOLUTION=GAP_NO_ORACLE_ON_BASE
PR83_TOUCHED=NO
I1_TOUCHED=NO
I2_STARTED=NO
PIN_MODIFIED=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
FINAL=A9_Q_CLEAN_REPLAY_PASS
