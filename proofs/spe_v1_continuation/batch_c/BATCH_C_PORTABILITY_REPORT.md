# SPE Ω — Batch C Portability Report

**Scope:** `.spe` / JSON / local PDF + bounded reconstruction  
**Base tip:** `d50aaeca62c510c083223c461032a1471745cd46`  
**Tested implementation tip:** `461eb65073fdec6b24867554db87cc90ac015c86`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44, stacked on the frozen PR #43 branch  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Portability matrix

| Capability | Before Batch C | After Batch C |
|---|---|---|
| `.spe` export | PRESENT | PRESENT |
| `.spe` import | PARTIAL | **PRESENT for `spe.artifact.v1` with strict integrity and authority checks** |
| JSON export | PARTIAL / hidden by Workspace depth | **PRESENT on Create and all Workspace depths** |
| JSON import | PARTIAL / generic `.spe` label | **PRESENT with explicit `.spe / JSON` labeling** |
| PDF export | MISSING | **PRESENT as a local browser print / Save as PDF view** |
| PDF import | MISSING | **Explicitly unsupported; nothing is inferred from PDF text** |
| Restore summary | MISSING | **PRESENT: Restored / Not restored / Review** |
| Truncated JSON | Generic failure | **Specific incomplete/truncated fail-closed message** |
| Foreign JSON | Generic unsupported format | **Specific non-SPE JSON message** |
| Tampered artifact | PRESENT | PRESENT, still fail-closed |
| Example authority protection | Implicit bucket behavior | **Explicit rejection if Example appears in an authority bucket** |
| Local history reopen | PARTIAL, request/category/target only | **New records retain full artifact; older records show bounded partial restore** |

## What survives `.spe` / JSON round-trip

- original request, category, and target
- all ProtectedIntent buckets
- Desired Output as confirmed intent and a HARD envelope constraint
- Example as `USER_SUPPLIED / NON-AUTHORITATIVE`
- constraints, open questions, input envelope, and provenance
- rendered prompt
- WASM record, lineage, creation time, and integrity metadata

## Explicitly not reconstructed

- live engine instance, progress, or phase history
- original image, screenshot, video, HTML, or other uploaded files
- media previews
- fresh public context or external sources
- full review commentary and technique labels

Missing fields are never inferred from a prompt preview. The current work remains
unchanged after a rejected import.

## Local PDF

`Print / Save PDF` opens a browser-native printable prompt pack containing the
request, Desired Output, non-authoritative Example, open questions, rendered
prompt, format, hash, and recorded network mode. It is explicitly labeled:

> Not a verification receipt. Integrity checks file consistency, not authorship,
> truth, or output quality.

No PDF SDK, paid service, upload, or network dependency was added. PDF import is
not supported; visitors are directed to `.spe` or SPE JSON for reconstruction.

## Files changed

- `packages/web-runtime/src/speArtifact.ts`
- `packages/web-runtime/src/history.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/workspace/Workspace.tsx`
- `apps/web/src/workspace/ReconstructionSummary.tsx`
- `apps/web/src/index.css`
- `apps/web/scripts/test-artifact-reconstruction.mjs`
- `apps/web/scripts/test-predeploy-qa.mjs`
- `apps/web/package.json`
- `tests/copy/reviewed-inventory.json`
- `proofs/spe_v1_continuation/batch_c/**`

No hero, engine kernel, Context Protocol architecture, hosting, DNS, deployment,
workflow, provider, paid dependency, or Execution Contract file was changed.

## Tests and exits

| Check | Exit |
|---|---:|
| `cd apps/web && npm run build` | `0` |
| `cd apps/web && npm run test:artifact` | `0` |
| `cd apps/web && npm run test:create-intent` | `0` |
| `cd apps/web && npm run test:engine` | `0` |
| `node tools/web04-prompt-regression.mjs` | `0` |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` |
| `cd apps/web && npm run test:predeploy-qa` | `0` |
| `node tools/copy-check.mjs` | `0` |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` |
| `node proofs/spe_v1_continuation/batch_c/capture_portability.mjs` | `0` |
| `node tools/deployment-safety-gate.mjs` | **`2`** (expected fail-closed) |

## Screenshot evidence

- `export-panel-dark.png`
- `export-panel-light.png`
- `export-pdf.png`
- `reconstruct-success.png`
- `reconstruct-partial-or-fail.png`
- `workspace-mobile.png`
- `screenshot-manifest.json`

All files are under `proofs/spe_v1_continuation/batch_c/` and the manifest binds
them to the tested implementation SHA.

## Residual risks

1. Browser import supports `spe.artifact.v1`; Python-side v2 artifacts remain
   unsupported in this preview and fail with an explicit version message.
2. Browser and Python canonical hashing are not claimed to have cross-language
   parity.
3. Print / Save PDF depends on the browser print dialog and pop-up permission.
4. PDF is a human-readable export, not a reconstructable artifact.
5. Older local history records remain partial because their missing protected
   details were never stored; the UI reports this instead of inventing them.
6. Aikido was invoked for Batch C files but remains blocked on integration
   authentication; no alternate credential or bypass was used.
7. Full human screen-reader testing remains outside the automated accessibility
   pass.

## Explicit stop

Batch C is complete for founder review. Batch D was not started.
