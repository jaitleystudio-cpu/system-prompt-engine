# A9_LINK_W_REPAIR_REPORT

Lane: **A9-LINK-W** — bounded writer repair (evidenceLinks + JSON-LD publication truth)  
Local time: **2026-10-01 ~08:10 IST** (Asia/Calcutta)  
Machine: Prawins-Mac-mini.local (`0d308a2c-330c-430b-85e3-74d647e69e59`)  
Cost: **₹0**

## Custody

| Field | Value |
| --- | --- |
| BASE_SHA | `48b027c234807af1ef97fc2d3932ff652a652771` (PR #91 tip) |
| BRANCH | `grok/spe-a9-link-repair-20261001` |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-a9-link-w-20261001` |
| WORKTREE_CLEAN (pre-patch) | YES |
| FROZEN_CHAIN | A9-R `8ddfe7e` → #90 `c3698cd` → #91 `48b027c` → HOLD → this repair |
| I1_TOUCHED | NO |
| I2_STARTED | NO |
| PIN_MODIFIED | NO |
| PR90_TOUCHED | NO |
| PR91_TOUCHED | NO |
| MERGED | NO |
| DEPLOYED | NO |
| HOSTED | NO |

## Pre-repair reproduction (exact A9-LINK-V oracle)

```
DEAD_LINKS=4
PUBLICATION_TRUTH=HOLD
SCHEMA_TRUTH=PASS
FINAL=HOLD_DEAD_EVIDENCE_LINKS_AND_PUBLICATION_JSONLD_LIVE_HOST_CLAIM
```

## Repair

### EVIDENCE_LINKS_FIXED

| Before (404 wrong org) | After |
| --- | --- |
| `github.com/system-prompt-engine/spe/proofs/task57_wasm_provenance.md` | commit-pinned blob `jaitleystudio-cpu/system-prompt-engine@8ddfe7e…/proofs/task57_quality_reconstruction_20260929/WASM_PROVENANCE.md` (HTTP 200) |
| `…/proofs/bench-task57r-wasm.mjs` | commit-pinned blob `…@8ddfe7e…/apps/web/scripts/bench-task57r-wasm.mjs` (HTTP 200) |
| `…/proofs/truth-privacy-closure.md` | commit-pinned blob `…@8ddfe7e…/proofs/truth_privacy_closure_20260928/FINAL_REPORT.md` (HTTP 200) |
| `…/proofs/provider_schema_validation.json` | **NOT_PUBLISHED** gap token (MISSING_IN_REPO — no invented URL; GuideArticle renders non-clickable) |

### PUBLICATION_JSONLD_FIXED

- Added `ROUTE_MOUNT_STATUS="NOT_INTEGRATED"` and `PUBLICATION_STATUS="NOT_INTEGRATED"`.
- Removed production `mainEntityOfPage.@id` / `systempromptengine.com/authority/*` claims from `generateArticleJsonLd`.
- Removed hard-coded production author `url` fields while unmounted.
- Schema remains single Article XOR TechArticle; 14 mandatory fields preserved.
- External http evidence anchors retain `rel: "noopener noreferrer"`.

### FILES_CHANGED

- `apps/web/src/authority/evidenceRegistry.ts`
- `apps/web/src/pages/GuideArticle.tsx`
- `proofs/a9_link_v/adversarial_link_tests.mjs` (new)
- `proofs/a9_link_v/oracle_results.json` (re-run green)
- `proofs/a9_link_v/A9_LINK_W_REPAIR_REPORT.md` (this file)

## Post-repair verification

| Check | Result |
| --- | --- |
| A9-LINK-V oracle (unchanged) | `DEAD_LINKS=NONE` `PUBLICATION_TRUTH=PASS` `SCHEMA_TRUTH=PASS` `FINAL=A9_LINK_RESOLUTION_VERIFIED` |
| Adversarial fail-closed | `ADVERSARIAL_PASS` |
| Node harness `test-authority-hub.mjs` | PASS |
| pytest `tests/web/test_authority_hub_seo.py` | 3 passed |
| pytest `tests/unit/test_authority_numeric_boundaries.py` | 13 passed |

## Footer

```
EVIDENCE_LINKS_FIXED=YES
PUBLICATION_JSONLD_FIXED=YES
ORACLE_RERUN=GREEN
DEAD_LINKS=0
PUBLICATION_TRUTH=PASS
SCHEMA_TRUTH=PASS
PR90_TOUCHED=NO
PR91_TOUCHED=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
FINAL=A9_LINK_REPAIR_PASS
NOTE=Independent A9-LINK-R (Antigravity) required before any A9 product PASS claim.
```
