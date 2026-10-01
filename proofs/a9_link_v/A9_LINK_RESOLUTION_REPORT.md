# A9_LINK_RESOLUTION_REPORT

Lane: **A9-LINK-V** — read-only independent Authority Hub link-resolution verifier  
Local time: **2026-10-01 07:23 IST** (Asia/Calcutta)  
Machine: Prawins-Mac-mini.local (`0d308a2c-330c-430b-85e3-74d647e69e59`)  
Cost: **₹0**

## Pins

| Field | Value |
| --- | --- |
| A9-R base | `8ddfe7e630d507ad9c13345e4e2e03120903ea82` |
| PR #90 tip (custody) | `c3698cd87ef100447c044e479dcc16929cd2d165` |
| App delta A9-R → tip | **NONE** (PR #90 = proofs custody only under `proofs/a9_q_authority_hub_qa/`) |
| Prior contaminated PR #83 | CLOSED — not touched |
| Oracle artifact | `proofs/a9_link_v/link_resolution_oracle.mjs` |
| Oracle results | `proofs/a9_link_v/oracle_results.json` |

## Scope

- Read-only verification of in-app Authority Hub evidence hrefs on A9-R app lineage (identical on PR #90 tip).
- **No** product source modification (prefer report-only HOLD; failing oracle proves defects but fix deferred).
- **No** merge / deploy / host.
- Closes prior custody gap `LINK_RESOLUTION=GAP_NO_ORACLE_ON_BASE` by **introducing** a dedicated oracle; oracle **fails** → product PASS still blocked.

## Surfaces verified

- `apps/web/src/authority/evidenceRegistry.ts` (ledger + JSON-LD generator)
- `apps/web/src/pages/GuideArticle.tsx` (clickable evidence `<a>`, rel guard, schema inject)
- `apps/web/src/pages/AuthorityHub.tsx` (hub copy; no direct hrefs)
- `apps/web/src/App.tsx` + `apps/web/src/routing.ts` (route isolation)
- HTTP status of each `evidenceLinks[]` URL (fetch only; not a live-host product claim)

## Results

### INTERNAL_LINKS=0 PASS

- Zero relative / same-origin evidence hrefs in the ledger.
- Vacuous pass: no relative link is clickable; no known-dead relative href present.
- GuideArticle only emits `<a href>` for `ev.evidenceLinks` entries.

### EXTERNAL_LINKS=4 noopener/noreferrer=PASS resolve=FAIL

- All four ledger URLs are absolute `https://` links.
- GuideArticle render contract: external → `target="_blank"` + `rel="noopener noreferrer"` → **PASS**.
- HTTP GET (follow redirects, 15s): **all four return 404**.
- Wrong org/repo: every URL targets `github.com/system-prompt-engine/spe/...` which itself 404s. Real repo is `jaitleystudio-cpu/system-prompt-engine`.

### DEAD_LINKS=

1. `https://github.com/system-prompt-engine/spe/proofs/task57_wasm_provenance.md` → **404**
2. `https://github.com/system-prompt-engine/spe/proofs/bench-task57r-wasm.mjs` → **404**
3. `https://github.com/system-prompt-engine/spe/proofs/truth-privacy-closure.md` → **404**
4. `https://github.com/system-prompt-engine/spe/proofs/provider_schema_validation.json` → **404**

Local analogs (informational only; not linked in UI):

| Clickable URL basename | Local analog |
| --- | --- |
| `task57_wasm_provenance.md` | `proofs/task57_quality_reconstruction_20260929/WASM_PROVENANCE.md` (different path/case) |
| `bench-task57r-wasm.mjs` | `apps/web/scripts/bench-task57r-wasm.mjs` (exists; not under `proofs/`) |
| `truth-privacy-closure.md` | `proofs/truth_privacy_closure_20260928/` (directory; no exact `.md` basename) |
| `provider_schema_validation.json` | **MISSING_IN_REPO** |

### PUBLICATION_TRUTH=HOLD

- `ROUTE_MOUNT_STATUS=NOT_INTEGRATED`: `AuthorityHub` / `GuideArticle` not mounted in `App.tsx`; no `/authority` route in `routing.ts`.
- JSON-LD `mainEntityOfPage.@id` and author/publisher URLs hardcode `https://systempromptengine.com/authority/${slug}` / `https://systempromptengine.com`.
- Probe of live host `/authority/*` returns a **lander redirect stub** (`window.location.href="/lander"`), not Authority Hub product HTML. Random paths also HTTP 200 → SPA/lander soft-200; **not** publication of Authority Hub.
- Hub/UI copy uses “Publications” / “Published {date}” for document metadata; not treated as live-host authorization alone.
- **HOLD** (not FAIL): isolation holds, but schema generator asserts live-host authority URLs that are not the Authority Hub product.

### SCHEMA_TRUTH=PASS

- Per-doc types: TechArticle, Article, Article (one each).
- Generator chooses **Article XOR TechArticle** via `schemaType`; no stacked `@type: ["Article","TechArticle"]`.
- GuideArticle injects a single `application/ld+json` block per slug.

### MANDATORY_14_FIELDS=PASS

Interface + ledger entries retain: claim, dataset, baseline, metric, sampleSize, providerVersion, date, methodology, evidenceLinks, rawResults, reproSteps, limitations, status, lastVerified.  
Existing harness `apps/web/scripts/test-authority-hub.mjs` → **PASS** on this tip.

## Bounded defect (report-only; source not modified)

Failing oracle proves a **bounded** defect in `evidenceRegistry.ts` `evidenceLinks` (wrong org + non-existent paths) and a **publication-truth** concern in `generateArticleJsonLd` live-host `@id`s. Per mission: **prefer HOLD first** — no apps/web patch in this lane.

Suggested future fix (out of scope here): rewrite evidence URLs to real repo paths that exist, or use non-clickable provenance strings until paths are real; gate JSON-LD host `@id` behind an explicit publication authorization flag.

## Footer

```
INTERNAL_LINKS=0 PASS
EXTERNAL_LINKS=4 noopener/noreferrer=PASS resolve=FAIL
DEAD_LINKS=4 (all evidenceLinks; wrong org github.com/system-prompt-engine/spe → 404)
PUBLICATION_TRUTH=HOLD (NOT_INTEGRATED route; JSON-LD live-host authority @id → lander stub)
SCHEMA_TRUTH=PASS (single Article|TechArticle per doc)
MANDATORY_14_FIELDS=PASS
PRIOR_GAP=LINK_RESOLUTION=GAP_NO_ORACLE_ON_BASE → ORACLE_NOW_PRESENT=YES ORACLE_RESULT=FAIL
SOURCE_MODIFIED=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
PR83_TOUCHED=NO
FINAL=HOLD_DEAD_EVIDENCE_LINKS_AND_PUBLICATION_JSONLD_LIVE_HOST_CLAIM
```

