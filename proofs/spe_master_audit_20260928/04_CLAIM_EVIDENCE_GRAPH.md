# Claim evidence graph

SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

## ProtectedIntent
CLAIM: user intent is protected
OWNER: `spe_runtime/portability/spe_artifact.py`; web label in create-intent
IMPLEMENTATION: Python intent object; web Desired Output label
TEST: `test:create-intent` EXIT 0; Python tests not run
PROOF: logs/create_intent.log
CURRENT SHA BINDING: NO for the Python object; YES for the web label test
STATUS: IMPLEMENTED_UNPROVEN

## K3
CLAIM: K3 is the sole prompt-technique selector
OWNER: design spec `docs/superpowers/specs/2026-09-24-context-grounding-category-protocol-design.md`
IMPLEMENTATION: none
TEST: none
PROOF: none
CURRENT SHA BINDING: NO
STATUS: SPECIFIED_ONLY

## Bounded reconstruction
CLAIM: reconstruction is bounded
OWNER: web artifact test
IMPLEMENTATION: web v1 round-trip contract
TEST: `test:artifact` EXIT 0
PROOF: logs/artifact.log
CURRENT SHA BINDING: YES
STATUS: PROVEN for the web contract

## Cross-runtime parity
CLAIM: Python, Rust, and WASM agree
OWNER: `spe_runtime`, `portable/spe-core-rs`, `apps/web/public/spe_wasm.wasm`
IMPLEMENTATION: all three exist
TEST: cargo EXIT 0 (38); engine fixture EXIT 0; pytest EXIT 1
PROOF: logs/cargo_test_online.log, logs/engine.log, logs/pytest.txt
CURRENT SHA BINDING: partial
STATUS: PARTIAL

## Privacy
CLAIM: no analytics, no sale, local core, no mandatory cloud AI
OWNER: PrivacyProof, Hero, CSP, egress proof
IMPLEMENTATION: no analytics SDK found; evaluate path zero egress
TEST: audit:egress EXIT 0; audit:deps EXIT 0; predeploy EXIT 0
PROOF: 08_PRIVACY_EGRESS_AUDIT.md
CURRENT SHA BINDING: YES for those commands
STATUS: PARTIAL because URL disclosure and CSP disagree

## Offline
CLAIM: works offline once cached
OWNER: `apps/web/public/sw.js`
IMPLEMENTATION: precache includes wasm
TEST: service worker presence only
PROOF: logs/predeploy_qa.log
CURRENT SHA BINDING: YES for presence
STATUS: IMPLEMENTED_UNPROVEN for offline use

## .spe portability
CLAIM: portable artifact round-trips
OWNER: web artifact + Python v2
IMPLEMENTATION: both
TEST: web round-trip EXIT 0; Python not run; PDF import rejected in App.tsx
PROOF: logs/artifact.log
CURRENT SHA BINDING: YES for web v1
STATUS: PARTIAL

## Execution Contract
CLAIM: recommend is not authorize is not execute; UNKNOWN is not PASS
OWNER: `packages/web-runtime` execution record
IMPLEMENTATION: LOCAL_DRY_RUN, authority NONE, summarizeConformance
TEST: `test:execution-contract` EXIT 0; Rust unknown_vs_pass passed
PROOF: logs/execution_contract.log
CURRENT SHA BINDING: YES
STATUS: PARTIAL (VALIDATE_ONLY absent; no live EXECUTE)

## Authority separation
CLAIM: selection is not a grant
OWNER: execution contract test
IMPLEMENTATION: profile_authority_granted false
TEST: EXIT 0
PROOF: logs/execution_contract.log
CURRENT SHA BINDING: YES
STATUS: PROVEN for the local record

## Daily Lab
CLAIM: daily experiments
OWNER: `apps/web/src/lab`
IMPLEMENTATION: finite queue of 14, honest FINITE_QUEUE flag
TEST: adversarial daily_lab_14 EXIT 0; headlines 31 deterministic
PROOF: logs/adversarial.log, logs/daily_hero.log
CURRENT SHA BINDING: YES
STATUS: PARTIAL; not a new specimen every calendar day

## Multimodal
CLAIM: text, speech, image, screenshot, video, URL, files
OWNER: `apps/web/src/media`
IMPLEMENTATION: limits and scaffolds
TEST: media, screenshot, video, speech fallback EXIT 0
PROOF: 14_MULTIMODAL_MATRIX.md
CURRENT SHA BINDING: YES for those node/Chromium contract tests
STATUS: PARTIAL

## Provider portability
CLAIM: versioned profiles and thin adapters
OWNER: `data/provider_profiles_v1.json`
IMPLEMENTATION: LOCAL_WASM, DETERMINISTIC, EXTERNAL_OPTIONAL; ANY_AI render
TEST: execution-contract bind EXIT 0
PROOF: 13_PROVIDER_ADAPTER_MATRIX.md
CURRENT SHA BINDING: YES for the bind
STATUS: PARTIAL; no ChatGPT/Claude/Cursor adapters

## Accessibility
CLAIM: WCAG 2.2 AA posture
OWNER: Home contrast closure inside this SHA; predeploy source contracts
IMPLEMENTATION: light contrast rules from the prior commit; source a11y contracts
TEST: predeploy EXIT 0; hero EXIT 0; axe not re-run
PROOF: 10_ACCESSIBILITY_AUDIT.md
CURRENT SHA BINDING: YES for hero and predeploy; NO for a new axe run
STATUS: AUTOMATED PARTIAL; HUMAN NO

## Massive Intent
CLAIM: none on the site; audit asked whether 100k-word and 1M-word modes exist
OWNER: Hero maxLength 20000; Create idea uncapped in source
IMPLEMENTATION: no OPFS, chunking, or packing
TEST: Chromium baseline EXIT 0
PROOF: 12_MASSIVE_INTENT_BASELINE.md
CURRENT SHA BINDING: YES
STATUS: PARTIAL_FOUNDATION

## Human validation
CLAIM: none qualified
OWNER: `evaluations/context_protocol_v1/arms.json`
IMPLEMENTATION: sentinel NO_RATINGS_YET
TEST: not simulated
PROOF: 16_HUMAN_EVIDENCE_STATUS.md
CURRENT SHA BINDING: NO
STATUS: HUMAN_VALIDATED NO
