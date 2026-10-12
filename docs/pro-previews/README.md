# SPE Pro previews r1 (PREVIEW ONLY, not released)
Branch `grok/pro-previews-r1` off `f1144b52` (premium redesign r1). Routes are built only by `apps/web/vite.redesign.config.ts`
(isolated from the production bundle), are `noindex, nofollow`, not linked from the product, and carry a CSP with `connect-src 'none'`.
No prices, plans, checkout, accounts, analytics or server storage. Labelled "Pro preview" only. Copy: HUMAN_COPY_REVIEW_REQUIRED (`COPY_MANIFEST.json`).

| Route | Real | Simulated / not built |
|---|---|---|
| `/pro/regression-lab/` | Test-case model, checks (must include / must not include / JSON / bullets / max words), A-vs-B diff report (fixed / broke / still), localStorage persistence | The runner is a scripted, deterministic stand-in (labelled "Demo runner: simulated"); it is not an AI model. Bring-your-own-key is a disabled option only. |
| `/pro/releases/` | SHA-256 over canonical JSON, Ed25519 sign/verify via WebCrypto, non-extractable private key generated in the tab, tamper detection, optional fingerprint pinning, history in localStorage (packs only, never keys) | Key does not persist across reloads; no key directory / identity, so a valid signature proves integrity, not authorship, unless the fingerprint is pinned. Needs a browser with WebCrypto Ed25519 (Chrome 137+, Safari 17+/WebKit 18.2 verified; Chromium 131 shows an "unsupported" notice). |
| `/pro/blueprint/` | Canvas with pointer drag and keyboard move (arrows, Shift = 32 px), editor for role / instructions / tools / step limit / human approval, handoffs with SVG edges, validation, three exporters, localStorage | Export formats are SPE drafts shaped like MCP / OpenAI / Anthropic configs, labelled "Draft format, verify before use"; not official schemas, not executed. |

Founder note added to the `/redesign/` footer (`#founder-note`), listed in both copy manifests as HUMAN_COPY_REVIEW_REQUIRED.

Tests: `cd apps/web && node --experimental-strip-types --test scripts/test-pro-previews.mjs` (16/16). Evidence in `evidence/`.
Tools: Ads-mcp `ads_get_a11y_guidelines` (forms) used. Refero, Mobbin: BLOCKED (paid), not used.
Independence: all of this was written by Grok (spe); it has not been independently reviewed.
