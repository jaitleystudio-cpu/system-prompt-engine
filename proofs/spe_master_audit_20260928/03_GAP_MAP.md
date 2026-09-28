# Gap map

P0: none.

## Finite closure queue

These are the closure items. The lists below them are every non-PROVEN ledger row, not extra work.

### P0

None.

### P1-01

GAP: K3 is not a runtime selector.
WHY IT MATTERS: Design docs name K3 as the only prompt-technique selector. No class or function exists.
OWNER: design spec only; no runtime owner.
EXACT ACCEPTANCE CRITERION: one selector in the canonical runtime, with a test that a second selector cannot override it, bound to the SHA under test.
DEPENDENCIES: none inside this audit.
ESTIMATED IMPLEMENTATION SCOPE: LARGE
PROOF REQUIRED TO CLOSE: a current Rust or Python test that fails if another component selects techniques.

### P1-02

GAP: Category engines exist for C01, C02, C03, C06, and C07. The registry lists C01–C12.
WHY IT MATTERS: XCAT C01–C12 is a founder requirement. IDs without engines are not the protocol.
OWNER: `spe_runtime/categories`; `data/category_registry_v1.json`
EXACT ACCEPTANCE CRITERION: each listed category either runs an engine under test or is explicitly removed from the registry.
DEPENDENCIES: pytest.
ESTIMATED IMPLEMENTATION SCOPE: LARGE
PROOF REQUIRED TO CLOSE: executed category tests at the current SHA.

### P1-03

GAP: URL reading copy says the browser contacts the address. CSP `connect-src 'self'` does not allow that.
WHY IT MATTERS: Create/Privacy over-claim a network behavior the page policy blocks.
OWNER: `apps/web/src/media/urlIngest.ts`; `apps/web/src/pages/PrivacyProof.tsx`; CSP in `index.html` and `public/_headers`
EXACT ACCEPTANCE CRITERION: either a same-origin acquisition path that still treats remote HTML as untrusted, or copy that no longer says the browser contacts the site, with a test for the chosen behavior.
DEPENDENCIES: do not edit frozen Home.
ESTIMATED IMPLEMENTATION SCOPE: SMALL
PROOF REQUIRED TO CLOSE: a browser or source test that matches the chosen behavior and the CSP.

### P1-04

GAP: `npm run build` stops because the gitignored wasm32 release file is missing.
WHY IT MATTERS: the official build is not green on a clean machine. The committed public wasm still passes the engine fixture.
OWNER: `apps/web/scripts/copy-wasm.mjs`; `portable/spe-wasm`
EXACT ACCEPTANCE CRITERION: a wasm32 release build from the lockfile produces a wasm whose sha256 is recorded, without a silent overwrite of the tracked file unless that overwrite is the reviewed release step.
DEPENDENCIES: wasm32-unknown-unknown target. Do not copy onto the tracked wasm during an audit.
ESTIMATED IMPLEMENTATION SCOPE: MEDIUM
PROOF REQUIRED TO CLOSE: official `npm run build` exit 0 on a machine that starts without the target directory, plus the engine fixture.

### P1-05

GAP: Home drops pasted text above 20000 characters with no in-product notice. URL and HTML excerpts are sliced.
WHY IT MATTERS: the founder law is no silent truncation.
OWNER: `apps/web/src/landing/Hero.tsx`; `apps/web/src/media/urlIngest.ts`
EXACT ACCEPTANCE CRITERION: overflow is rejected or visibly labeled, and the stored source matches what the user was told was kept.
DEPENDENCIES: Home is frozen. A behavior fix there needs founder permission.
ESTIMATED IMPLEMENTATION SCOPE: MEDIUM
PROOF REQUIRED TO CLOSE: a browser test at 20001 and 100000 characters that records the notice and the stored length.

### P1-06

GAP: Screenshot-to-code targets are prompt scaffolds, not runtimes.
WHY IT MATTERS: HTML/CSS, React, SwiftUI, Compose, Flutter, and React Native can be mistaken for generated apps.
OWNER: `apps/web/src/media/screenshotToCode.ts`
EXACT ACCEPTANCE CRITERION: UI and tests state prompt/scaffold, or a real runtime exists and is tested per target.
DEPENDENCIES: none for a claim correction.
ESTIMATED IMPLEMENTATION SCOPE: LARGE if runtimes are added; SMALL if claims stay honest and tests lock that wording.
PROOF REQUIRED TO CLOSE: the existing scaffold tests plus an assertion that no in-app compiler is claimed.

### P1-07

GAP: Massive Intent modes are absent.
WHY IT MATTERS: 100k-word, 1M-word, and larger-than-1M source modes, chunking, OPFS, and provider packing do not exist.
OWNER: Create textarea only. No storage module.
EXACT ACCEPTANCE CRITERION: measured benchmarks at the stated sizes with no silent truncation, source hash, and preservation of non-selected source.
DEPENDENCIES: a product harness, not this audit.
ESTIMATED IMPLEMENTATION SCOPE: LARGE
PROOF REQUIRED TO CLOSE: the benchmark harness in section 9 of the audit mission. Timing: LAUNCH_PLUS_1.

### P1-08

GAP: MCP and live ChatGPT, Claude, and Cursor adapters are absent.
WHY IT MATTERS: distribution was specified. The roadmap marks MCP planned. `targets.ts` is labels.
OWNER: `spe_runtime/portability/conformance.py`; `packages/web-runtime/src/targets.ts`
EXACT ACCEPTANCE CRITERION: a thin adapter that calls the canonical engine and does not reimplement protocol selection, with a contract test.
DEPENDENCIES: K3 or an explicit statement that the canonical engine is the only selector.
ESTIMATED IMPLEMENTATION SCOPE: LARGE
PROOF REQUIRED TO CLOSE: adapter tests plus a negative test that the adapter cannot grant authority.

### P1-09

GAP: The inline prompt assistant does not exist.
WHY IT MATTERS: browser, desktop, and mobile invocation with review-before-replace were specified.
OWNER: none
EXACT ACCEPTANCE CRITERION: explicit invocation, no background clipboard, no keystroke log, review before replace.
DEPENDENCIES: privacy tests for those negatives.
ESTIMATED IMPLEMENTATION SCOPE: LARGE
PROOF REQUIRED TO CLOSE: an extension or in-app helper test, not an architecture note.

### P1-10

GAP: Requirement graph, quality-delta, Plan B, VALIDATE_ONLY, and budget preservation were not found as runtime symbols.
WHY IT MATTERS: they are founder engine laws with no implementation to qualify.
OWNER: none in code
EXACT ACCEPTANCE CRITERION: each symbol exists and a test shows the law, or the founder retires the requirement.
DEPENDENCIES: none
ESTIMATED IMPLEMENTATION SCOPE: LARGE as a set; each law is MEDIUM
PROOF REQUIRED TO CLOSE: one executed test per law.

The rows under the severity headings are the full ledger remainder, not a second queue.


## P1

- 7 Category Protocol — PARTIAL — implement or explicitly retire missing category engines
- 8 XCAT C01–C12 — PARTIAL — close C04 C05 C08–C12 or mark them non-goals
- 9 K3 as sole prompt-technique selector — SPECIFIED_ONLY — implement K3 or stop claiming it is the selector
- 11 Requirement graph — NOT_FOUND — do not invent the graph in this audit
- 17 Quality-delta requirement — NOT_FOUND — do not invent the metric in this audit
- 22 Deterministic degradation / Plan B — NOT_FOUND — do not invent Plan B in this audit
- 24 Budget preservation — NOT_FOUND — do not invent a budget model in this audit
- 27 Automatic reconstruction until threshold or stop — PARTIAL — execute the optimizer tests
- 45 Rust/WASM parity — PARTIAL — differential rust/wasm vectors
- 47 Mutation testing — PARTIAL — do not treat the stub as a mutation suite
- 55 Screenshot to code — PARTIAL — do not claim an in-app compiler
- 58 URL — PARTIAL — align acquisition with CSP or stop claiming contact
- 59 Website input — PARTIAL — align acquisition with CSP or stop claiming contact
- 64 HTML/CSS target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 65 React target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 66 SwiftUI target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 67 Jetpack Compose target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 68 Flutter target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 69 React Native target — PARTIAL — keep claims at prompt/scaffold until a runtime exists
- 70 URL input — PARTIAL — align acquisition with CSP or stop claiming contact
- 71 Page acquisition — PARTIAL — same-origin safe acquisition or copy correction
- 72 HTML extraction — PARTIAL — same-origin safe acquisition or copy correction
- 73 CSS and design-token extraction — PARTIAL — same-origin safe acquisition or copy correction
- 74 Typography extraction — PARTIAL — same-origin safe acquisition or copy correction
- 75 Layout extraction — PARTIAL — same-origin safe acquisition or copy correction
- 76 Responsive behavior inference — PARTIAL — same-origin safe acquisition or copy correction
- 77 Component inference — PARTIAL — same-origin safe acquisition or copy correction
- 78 Motion analysis — PARTIAL — same-origin safe acquisition or copy correction
- 79 Scroll storytelling analysis — NOT_FOUND — do not implement in this audit
- 80 WebGL/3D detection — PARTIAL — same-origin safe acquisition or copy correction
- 81 MEASURED vs INFERRED distinction — PARTIAL — same-origin safe acquisition or copy correction
- 82 Design DNA — NOT_FOUND — do not implement in this audit
- 83 URL to implementation contract — NOT_FOUND — do not implement in this audit
- 84 URL to single-file website prompt — NOT_FOUND — do not implement in this audit
- 85 Safe handling of untrusted remote content — PARTIAL — same-origin safe acquisition or copy correction
- 86 100K-word Live Editor — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 87 1,000,000-word Large Source Mode — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 88 Greater-than-1M Massive Source Mode — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 89 Streamed ingestion — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 91 Chunking — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 92 Incremental counting — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 94 OPFS or suitable local large-source storage — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 95 IndexedDB fallback — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 97 Memory-pressure handling — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 98 Virtualized source preview — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 99 Provider-context packing — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 102 Preservation of non-selected source — NOT_FOUND — LAUNCH_PLUS_1; do not implement now
- 103 No silent truncation — PARTIAL — surface truncation explicitly before any large-source claim
- 137 VALIDATE_ONLY — NOT_FOUND — do not invent the mode in this audit
- 138 EXECUTE semantics where implemented — PARTIAL — keep EXECUTE unavailable until authority exists
- 143 Network denied by default — PARTIAL — make URL behavior match the disclosure
- 189 Budget preservation — NOT_FOUND — do not invent a budget model in this audit
- 196 Screenshot upload — PARTIAL — do not describe scaffolds as compiled apps
- 197 Clear code workflow — PARTIAL — do not describe scaffolds as compiled apps
- 198 Target selection — PARTIAL — do not describe scaffolds as compiled apps
- 199 Actual screenshot processing — PARTIAL — same as screenshot targets
- 200 Error handling — PARTIAL — do not describe scaffolds as compiled apps
- 202 Truthful generated-code claims — PARTIAL — do not describe scaffolds as compiled apps
- 233 Network egress disclosure — PARTIAL — correct URL disclosure or acquisition; do not edit frozen Home
- 234 Optional external-provider disclosure — PARTIAL — correct URL disclosure or acquisition; do not edit frozen Home
- 235 Credentials behavior — PARTIAL — correct URL disclosure or acquisition; do not edit frozen Home
- 236 Browser storage disclosure — PARTIAL — correct URL disclosure or acquisition; do not edit frozen Home
- 251 URL hostile-content isolation — PARTIAL — align URL behavior
- 260 repository_access capability — PARTIAL — do not pretend declaration is execution
- 261 file_access — PARTIAL — do not pretend declaration is execution
- 262 Browser/computer-use capability — PARTIAL — do not pretend declaration is execution
- 269 Voice input — PARTIAL — device qualification
- 271 Speech recognition — PARTIAL — device qualification
- 274 Voice to intent — PARTIAL — device qualification
- 276 Browser integration — NOT_FOUND — do not build in this audit
- 277 Desktop integration — NOT_FOUND — do not build in this audit
- 278 Mobile integration — NOT_FOUND — do not build in this audit
- 279 Explicit invocation — NOT_FOUND — do not build in this audit
- 282 Review before replace — NOT_FOUND — do not build in this audit
- 284 Adapter/plugin implementation — NOT_FOUND — do not build in this audit
- 285 MCP server/interface — SPECIFIED_ONLY — do not mark planned as shipped
- 286 ChatGPT integration path — NOT_FOUND — do not build adapters in this audit
- 287 Claude integration path — NOT_FOUND — do not build adapters in this audit
- 288 Cursor integration — NOT_FOUND — do not build adapters in this audit
- 289 Coding-agent integration — NOT_FOUND — do not build adapters in this audit
- 333 Mutation evidence — PARTIAL — do not count the stub
- 337 Cross-runtime proof — PARTIAL — run Python and a wasm rebuild on a later mission
- 342 Real human ratings — EXTERNAL_VALIDATION_REQUIRED — collect real ratings later
- 355 Official full build — BLOCKED — reproducible wasm build on a later mission
- 356 WASM packaging — BLOCKED — reproducible wasm build on a later mission

## P2

- 2 ProtectedIntent — IMPLEMENTED_UNPROVEN — run Python artifact immutability tests
- 3 Immutable user goal — IMPLEMENTED_UNPROVEN — run optimizer tests
- 4 Context-need detection — IMPLEMENTED_UNPROVEN — run grounding tests
- 5 Context Grounding — IMPLEMENTED_UNPROVEN — run grounding tests
- 12 Contradiction detection — IMPLEMENTED_UNPROVEN — run grounding tests
- 13 Provenance — PARTIAL — bind user-source provenance when large-source work starts
- 14 Trust validation — IMPLEMENTED_UNPROVEN — run firewall tests
- 15 Quality evaluator — IMPLEMENTED_UNPROVEN — run evaluator tests
- 18 Retry limits — IMPLEMENTED_UNPROVEN — run optimizer tests
- 19 Oscillation protection — SPECIFIED_ONLY — do not implement in this audit
- 20 Goal-mutation protection — IMPLEMENTED_UNPROVEN — run optimizer tests
- 21 Authority-escalation protection — PARTIAL — run Python authority tests
- 23 No fabricated requirements — IMPLEMENTED_UNPROVEN — run the regression test
- 25 Hard-constraint preservation — PARTIAL — execute optimizer mutation tests
- 28 Preserve original intent — IMPLEMENTED_UNPROVEN — run Python tests
- 29 Do not weaken HARD constraints — PARTIAL — run optimizer tests
- 30 Do not invent facts — IMPLEMENTED_UNPROVEN — run grounding tests
- 31 Explicit unknowns and questions — PARTIAL — none
- 34 Provider-portable output — PARTIAL — keep adapters thin when added
- 35 Structured result explanation — PARTIAL — none for the panel contract
- 36 Why this prompt / reviewability — PARTIAL — extend review only if founder asks
- 37 Python reference/oracle — IMPLEMENTED_UNPROVEN — run pytest on a machine that already has it
- 43 Canonical vectors — PARTIAL — run Python vector tests
- 44 Python/Rust parity — IMPLEMENTED_UNPROVEN — run parity tests
- 46 Differential testing — PARTIAL — run parity tests
- 49 False-proof prevention — PARTIAL — stamp new proofs with this SHA
- 52 Speech-to-text — PARTIAL — device qualification for speech and media
- 53 Image — PARTIAL — device qualification for speech and media
- 54 Screenshot — PARTIAL — device qualification for speech and media
- 56 Video — PARTIAL — device qualification for speech and media
- 57 Video to text — PARTIAL — device qualification for speech and media
- 62 Image to prompt — PARTIAL — device qualification for speech and media
- 63 Files and documents — PARTIAL — device qualification for speech and media
- 90 Web Worker processing of large source — PARTIAL — do not build Massive Intent in this audit
- 93 Local source preservation — PARTIAL — do not add OPFS in this audit
- 96 Byte-based internal limits — PARTIAL — do not change caps in this audit
- 100 Retrieval and relevance selection — PARTIAL — do not implement Massive Intent
- 101 Source provenance for large sources — PARTIAL — later
- 104 Source hash and integrity — PARTIAL — later
- 105 Mobile-safe large-source behavior — NOT_FOUND — do not claim the sizes on the site
- 106 Benchmark harness at 100K/250K/500K/1M — NOT_FOUND — do not claim the sizes on the site
- 107 Paste-latency measurement — NOT_FOUND — do not claim the sizes on the site
- 108 UI responsiveness measurement — NOT_FOUND — do not claim the sizes on the site
- 109 Memory measurement — NOT_FOUND — do not claim the sizes on the site
- 110 Reconstruction-quality measurement at large sizes — NOT_FOUND — do not claim the sizes on the site
- 111 .spe schema — PARTIAL — run Python artifact tests
- 112 Versioning — PARTIAL — run Python round-trip
- 113 Export — PARTIAL — run Python round-trip
- 114 Import — PARTIAL — run Python round-trip
- 116 Integrity — PARTIAL — run Python round-trip
- 117 Lineage — PARTIAL — run Python round-trip
- 118 Provider profile binding — PARTIAL — run Python round-trip
- 119 execution_record preservation — PARTIAL — run Python round-trip
- 120 Backward compatibility strategy — SPECIFIED_ONLY — write a strategy only if founder asks
- 121 JSON export — PARTIAL — run Python round-trip
- 122 PDF export — PARTIAL — keep the rejection message until import exists
- 123 Copy prompt — PARTIAL — none
- 124 Canonical execution contract — PARTIAL — add VALIDATE_ONLY only if founder still wants that mode
- 127 Protocol and depth — PARTIAL — do not invent EXECUTE
- 128 Acceptance criteria — PARTIAL — do not invent EXECUTE
- 131 Planned stages — PARTIAL — do not invent EXECUTE
- 132 Side-effect policy — PARTIAL — do not invent EXECUTE
- 133 Network policy — PARTIAL — do not invent EXECUTE
- 134 Credential policy — PARTIAL — do not invent EXECUTE
- 135 Human approval requirement — PARTIAL — do not invent EXECUTE
- 144 Credentials denied by default — PARTIAL — none for local dry-run
- 145 External write denied by default — PARTIAL — none for local dry-run
- 146 Upload denied by default — PARTIAL — none for local dry-run
- 149 No silent external action — PARTIAL — none for local dry-run
- 150 Fail closed if enforcement unavailable — PARTIAL — none for local dry-run
- 151 Versioned provider profiles — PARTIAL — do not add hidden fallbacks
- 152 Local profile — PARTIAL — do not add hidden fallbacks
- 153 Deterministic profile — PARTIAL — do not add hidden fallbacks
- 154 Optional external provider profile — PARTIAL — do not add hidden fallbacks
- 155 Capability declarations — PARTIAL — do not add hidden fallbacks
- 156 Network requirements — PARTIAL — do not add hidden fallbacks
- 157 Credential requirements — PARTIAL — do not add hidden fallbacks
- 158 Unavailable capability state — PARTIAL — none
- 159 No hidden provider fallback — PARTIAL — keep the law when adapters appear
- 160 Thin adapters only — PARTIAL — do not grow a second kernel in adapters
- 162 Create — PARTIAL — report only
- 163 Code — PARTIAL — report only
- 164 Daily Lab — PARTIAL — report only
- 165 My Work — PARTIAL — report only
- 166 Capabilities — PARTIAL — report only
- 167 Privacy / Proof — PARTIAL — report only
- 168 Workspace — PARTIAL — report only
- 169 Execution Contract Simple — PARTIAL — none
- 170 Execution Contract Inspect — PARTIAL — none
- 174 Responsive mobile — PARTIAL — human device pass
- 175 Desktop — PARTIAL — none for frozen Home
- 177 Accessible keyboard flows — PARTIAL — fix the test later only if founder asks; nav was not changed
- 178 Plain-English beginner UX — PARTIAL — none
- 179 Advanced/technical inspection UX — PARTIAL — none
- 180 Idea first — PARTIAL — report only
- 182 Optional details later — PARTIAL — report only
- 183 Tab persistence — IMPLEMENTED_UNPROVEN — add a persistence test only if founder asks
- 184 Source policy — PARTIAL — report only
- 185 Automatic depth — PARTIAL — do not retune depth in this audit
- 186 Fast — PARTIAL — do not retune depth in this audit
- 187 Smart — PARTIAL — do not retune depth in this audit
- 188 Deep — PARTIAL — do not retune depth in this audit
- 190 Constraint preservation — PARTIAL — run optimizer tests
- 192 Mobile progressive disclosure — PARTIAL — report only
- 193 Output result — PARTIAL — do not treat the timeout as an engine failure
- 194 Review — PARTIAL — report only
- 195 Failure states — PARTIAL — report only
- 201 Mobile usability — IMPLEMENTED_UNPROVEN — human mobile pass
- 203 Curated inventory — PARTIAL — keep finite-queue wording
- 204 Deterministic daily selection — PARTIAL — none
- 206 3D experiments — PARTIAL — keep finite-queue wording
- 207 Storytelling experiments — PARTIAL — keep finite-queue wording
- 208 Live preview — PARTIAL — keep finite-queue wording
- 209 Pause — PARTIAL — none
- 210 Reduced motion — PARTIAL — none
- 211 Open in SPE — PARTIAL — keep finite-queue wording
- 212 Prompt seed preservation — PARTIAL — keep finite-queue wording
- 213 Provenance — PARTIAL — keep finite-queue wording
- 214 Mobile — PARTIAL — keep finite-queue wording
- 215 Finite versus truly new-daily distinction — PARTIAL — align Home daily wording only if founder unfreezes Home
- 216 Opt-in local storage — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 217 Save — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 218 Reopen — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 219 Delete where specified — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 220 Constraints preserved — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 221 Budget preserved — NOT_FOUND — same as budget preservation
- 222 .spe relationship — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 223 Offline behavior — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 224 Privacy — IMPLEMENTED_UNPROVEN — add a history test when founder asks
- 228 No raw voice storage — IMPLEMENTED_UNPROVEN — keep the disclosure
- 237 Manifest — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 239 Cache strategy — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 240 Offline shell — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 241 WASM offline availability — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 242 Offline compilation — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 243 Stale navigation — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 244 Update strategy — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 245 Network-failure UX — IMPLEMENTED_UNPROVEN — offline walk on a later mission
- 247 Security headers — PARTIAL — do not deploy to prove headers
- 249 Secrets scan — NOT_FOUND — run a secrets scan on a later mission
- 250 Prompt injection isolation — PARTIAL — do not claim a pentest
- 252 HTML sanitization — PARTIAL — do not claim penetration testing
- 253 External script audit — PARTIAL — track the onnx eval warning
- 255 Service-worker security — PARTIAL — do not claim penetration testing
- 256 Filesystem authority — PARTIAL — do not claim penetration testing
- 257 Network authority — PARTIAL — do not claim penetration testing
- 258 Credential authority — PARTIAL — do not claim penetration testing
- 259 Supply-chain controls — PARTIAL — do not claim penetration testing
- 264 Capability routing — PARTIAL — do not add computer use in this audit
- 265 Runtime execution bridge — PARTIAL — do not add computer use in this audit
- 266 Sandbox — PARTIAL — do not add computer use in this audit
- 267 Authority — PARTIAL — do not add computer use in this audit
- 268 Observer/proof — PARTIAL — do not add computer use in this audit
- 273 Raw-audio persistence law — IMPLEMENTED_UNPROVEN — keep disclosure
- 275 Voice cannot authorize actions — IMPLEMENTED_UNPROVEN — add an explicit negative test later
- 290 Generic AI adapters — PARTIAL — keep it thin
- 291 Thin-adapter law — PARTIAL — enforce when adapters are added
- 292 No duplicate semantic engine — PARTIAL — keep onnx out of K3
- 307 Keyboard — PARTIAL — human SR pass
- 308 Focus — PARTIAL — human SR pass
- 309 Heading structure — PARTIAL — human SR pass
- 310 Landmarks — PARTIAL — human SR pass
- 311 Labels — PARTIAL — human SR pass
- 312 ARIA states — PARTIAL — human SR pass
- 313 Contrast — PARTIAL — do not restyle
- 314 200% zoom — PARTIAL — human SR pass
- 315 Reflow — PARTIAL — human SR pass
- 318 Mobile — PARTIAL — human SR pass
- 319 Errors — PARTIAL — human SR pass
- 331 Proof manifests — PARTIAL — rebinding is future work
- 332 SHA binding — PARTIAL — stamp this SHA on the next proof run
- 334 Adversarial evidence — PARTIAL — do not call it a pentest
- 335 False-proof protection — PARTIAL — keep SHA separation
- 336 Canonical fixtures — PARTIAL — rebinding is future work
- 338 Claim classification — PARTIAL — keep SHA separation
- 339 Current-HEAD binding — PARTIAL — none
- 340 Historical-proof separation — PARTIAL — keep SHA separation
- 341 Prestudy — SPECIFIED_ONLY — do not simulate ratings
- 343 Lock — EXTERNAL_VALIDATION_REQUIRED — do not simulate
- 344 Unblind — EXTERNAL_VALIDATION_REQUIRED — do not simulate
- 345 Frozen thresholds — NOT_FOUND — do not invent thresholds
- 346 Adjudication — EXTERNAL_VALIDATION_REQUIRED — do not simulate
- 347 Participants — EXTERNAL_VALIDATION_REQUIRED — do not simulate
- 348 Independence — EXTERNAL_VALIDATION_REQUIRED — do not simulate
- 349 Fresh clone — EXTERNAL_VALIDATION_REQUIRED — independent replication later
- 350 Fresh build — EXTERNAL_VALIDATION_REQUIRED — independent replication later
- 351 Fresh test run — EXTERNAL_VALIDATION_REQUIRED — independent replication later
- 352 Reproduced key proof — EXTERNAL_VALIDATION_REQUIRED — independent replication later
- 353 Verified results — EXTERNAL_VALIDATION_REQUIRED — independent replication later
- 357 Fresh clone build — EXTERNAL_VALIDATION_REQUIRED — independent clone later
- 358 Release artifact integrity — PARTIAL — rebuild without touching tracked wasm until reviewed

## P3

- 147 Private to shared preview — SPECIFIED_ONLY — do not build
- 280 No background clipboard — IMPLEMENTED_UNPROVEN — none
- 281 No keystroke logging — IMPLEMENTED_UNPROVEN — none
- 283 Privacy of the assistant — IMPLEMENTED_UNPROVEN — none
- 295 canonical — IMPLEMENTED_UNPROVEN — extend the SEO test later
- 296 metadata — IMPLEMENTED_UNPROVEN — extend the SEO test later
- 297 Open Graph — IMPLEMENTED_UNPROVEN — extend the SEO test later
- 298 Structured data — PARTIAL — none
- 301 Semantic headings — PARTIAL — no ranking claims
- 302 Crawlability — PARTIAL — no ranking claims
- 303 Internal links — PARTIAL — no ranking claims
- 305 Indexable examples — PARTIAL — no ranking claims
- 306 Duplicate-content handling — PARTIAL — no ranking claims
- 321 JS raw/gzip — PARTIAL — do not call this field data
- 322 CSS raw/gzip — PARTIAL — do not call this field data
- 323 WASM size — PARTIAL — do not call this field data
- 324 Largest chunks — PARTIAL — do not call this field data
- 325 Route loading — PARTIAL — lab trace later
- 326 Hero loading — PARTIAL — lab trace later
- 327 Daily Lab assets — PARTIAL — do not call this field data
- 328 3D critical path — PARTIAL — lab trace later
- 329 Memory — PARTIAL — lab trace later
- 330 Main-thread blocking — PARTIAL — lab trace later
- 361 DNS — BLOCKED — do not touch DNS
- 362 Rollback strategy if specified — NOT_FOUND — specify only if hosting is ever authorized
