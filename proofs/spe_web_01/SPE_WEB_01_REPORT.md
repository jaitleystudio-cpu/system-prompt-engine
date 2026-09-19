# SPE-WEB-01 FULL WEBSITE FOUNDATION REPORT

## SOURCE

base SHA:
931128b384c3055ecef876124f787e5b8e67651b (origin/main)

branch:
cursor/spe-web-01-foundation-0d6e

HEAD:
442b765bd7ef3ea8a09a4723823245b1fa2e2ec3

PR:
(opened after push)

## PR #6

inspected:
YES

merged:
NO

reused files:
apps/web/src/engine/* · scripts/copy-wasm|eval-fixture|audit-*|egress · public/sw.js · public/manifest (rebased) · tests/web architecture/engine/privacy gates · WEB_CSP.md

discarded files:
JSON-only Composer as primary UX · SPE Workbench product brand · session-only ban on opt-in local history · treating sprint6_* generated proofs as current SPE-WEB-01 evidence

## ENGINE

real WASM:
YES (spe_wasm.wasm → spe-core-rs)

worker:
YES

TS fallback:
NO

offline:
YES (network_mode=NONE)

integrity gate:
WASM_INTEGRITY_MISMATCH (fail closed)

## PRODUCT SURFACES

home:
YES — cinematic hero, one-line, Build with SPE, privacy line, before/after

prompt workspace:
YES

intent lens:
YES — Confirmed / Assumed / Unknown / Conflict (editable)

prompt lens:
YES — USER REQUEST → SPE ADDED → FINAL PROMPT

target selector:
YES — Any AI / ChatGPT / Claude / Gemini / Copilot / Local / Custom

.spe:
YES — open/inspect/export/import/lineage/integrity

history:
YES — opt-in local-first

PWA:
YES — manifest + service worker (shell+WASM only)

## PRIVACY

compile egress:
0 during evaluate

analytics:
NONE

mandatory provider:
NONE

mandatory spend:
₹0

## ACCESSIBILITY

keyboard:
YES (skip link, focus-visible, controls)

reduced motion:
YES

320px:
YES

200% zoom:
YES (rem-based type)

## TESTS

See proofs/spe_web_01/test_summary.json for exact denominators recorded at run time.

## G6-H frozen:

YES (website branch from main; g6zc artifacts absent / unmodified)

## CLAIM BOUNDARY

website implementation:
IMPLEMENTATION_PRESENT / REVIEW_PENDING

production:
NOT QUALIFIED

World #1:
NOT PROVEN

## STOP

Do not begin SPE-WEB-02 in the same mission.
