# Task57R Core-B Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Every task uses TDD and ends in a separately reviewable commit.

**Goal:** Turn Task57's working Quality Delta / one-shot reconstruction / `VALIDATE_ONLY` foundation into the actual SPE product loop, harden proof custody and causal reconstruction, and implement the founder's independent deterministic Core-B no-dead-end fallback.

**Architecture:** Core A remains the sole semantic authority: ProtectedIntent → Requirement Graph → XCAT → K3 → PromptEffectPlan → Quality → one repair → validation. Core B is deliberately outside that semantic chain and produces only a clearly non-canonical `SAFE_FALLBACK_PROMPT` from independently preserved raw input when Core A cannot produce a lawful usable prompt.

**Tech Stack:** Python 3, Rust, WASM, TypeScript/React, Web Worker, Vite, Node.js, deterministic JSON vectors.

**Spec:** `docs/superpowers/specs/2026-09-29-task57r-core-b-recovery-design.md`

## Global constraints

```text
BASE PR HEAD:
352d05ee0fb97b46fea0171e958868da30f268d9

BRANCH:
cursor/spe-quality-delta-planb-validate-only-20260929

PR:
#57

Task54 / Task55 / Task56:
FROZEN

MAX_AUTOMATIC_RECONSTRUCTION:
1

NO EFFECT PLAN:
NO CANONICAL FINAL PROMPT

CORE_B_SEMANTIC_AUTHORITY:
NONE

SAFE_FALLBACK_PROMPT:
NOT CANONICAL
NOT VERIFIED
NOT QUALITY_PASS

NETWORK:
NONE

HOSTING:
FORBIDDEN

DEPLOYMENT:
FORBIDDEN

.github/workflows/**:
DO NOT MODIFY

PR #56:
DO NOT MODIFY

MERGE:
FORBIDDEN UNTIL FOUNDER REVIEW
```

PR #57 is currently draft, open and unmerged at the required head.

## Review focus

The five highest-risk boundaries reviewers must attack are:

1. **Caller-controlled proof state** — no request field may mint `ENFORCEMENT_VERIFIED`.
2. **Core-A failure after raw input capture** — the original request must survive even if WASM/Worker/K3 completely fail.
3. **Repair scope escape** — a repair fixing one diagnosed obligation must not silently modify unrelated protected content.
4. **Fallback as safety bypass** — conflict, refusal, unsupported state or authority denial must never be converted into a convenient fallback prompt.
5. **UI truthfulness** — the screen must distinguish canonical, reconstructed, validation-unknown and safe-fallback outputs without TypeScript inventing semantic verdicts.

---

# File map

### Existing semantic files to modify

```text
spe_runtime/quality/engine.py

portable/spe-core-rs/src/quality.rs
portable/spe-core-rs/src/lib.rs

tests/unit/test_quality_task57.py
tests/portability/test_quality_parity_57.py
```

Task57 already owns these Quality Delta / reconstruction semantics; don't create a second quality engine.

### Existing web runtime files to modify

```text
apps/web/src/engine/wasm-host.mjs
apps/web/src/engine/engine.worker.ts
apps/web/src/engine/client.ts
apps/web/src/engine/types.ts
apps/web/src/engine/qualityTransport.ts
apps/web/src/engine/k3Transport.ts

apps/web/src/App.tsx
apps/web/src/workspace/Workspace.tsx
apps/web/src/workspace/ExecutionContractPanel.tsx

apps/web/package.json
```

The Worker already verifies the real WASM SHA before instantiation and refuses host imports; preserve that boundary.

### New focused files

```text
tests/unit/test_quality_task57r.py
tests/portability/test_quality_parity_57r.py

apps/web/src/engine/core-b.mjs
apps/web/src/workspace/QualityReceiptPanel.tsx

apps/web/scripts/test-quality-runtime-custody.mjs
apps/web/scripts/test-core-b-fallback.mjs
apps/web/scripts/test-quality-product-wiring.mjs
apps/web/scripts/bench-task57r-wasm.mjs

tools/bench_task57r.py

proofs/task57_quality_reconstruction_20260929/
  PLANB_HISTORY_RECOVERY.md
  TASK57R_RUNTIME_CUSTODY.md
  TASK57R_CAUSAL_REPAIR.md
  TASK57R_CORE_B.md
  TASK57R_PRODUCT_WIRING.md
  TASK57R_MUTATION_RESULTS.md
  TASK57R_PARITY_RESULTS.md
  TASK57R_PERFORMANCE.md
  TASK57R_FINAL_REPORT.md
```

---

# Task 1 — Persist the frozen design and implementation plan

**Files**

```text
Create:
docs/superpowers/specs/2026-09-29-task57r-core-b-recovery-design.md
docs/superpowers/plans/2026-09-29-task57r-core-b-recovery.md
```

### Step 1 — verify custody

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Expected:

```text
branch =
cursor/spe-quality-delta-planb-validate-only-20260929

HEAD =
352d05ee0fb97b46fea0171e958868da30f268d9

working tree =
clean
```

Observed at execution start: branch and HEAD matched. Untracked `graphify-out/` was already present and is excluded from this commit.

### Step 2 — save the approved spec

The separate pre-plan design essay was not on disk. `docs/superpowers/specs/2026-09-29-task57r-core-b-recovery-design.md` freezes the founder-approved design laws from the execution authorization without adding requirements.

### Step 3 — save this implementation plan

### Step 4 — verify only documentation changed

```bash
git diff --name-only
```

Expected only the two `docs/superpowers/...` files, plus the pre-existing untracked `graphify-out/` which is not staged.

### Step 5 — commit

```bash
git add docs/superpowers/specs/2026-09-29-task57r-core-b-recovery-design.md \
        docs/superpowers/plans/2026-09-29-task57r-core-b-recovery.md

git commit -m "docs: freeze Task57R Core-B recovery design"
```

No runtime code in this commit.

---

# Task 2 — Remove caller authority over verification proof

This is the first runtime gate.

Current Task57's public quality path must no longer accept caller declarations such as:

```text
wasm_available=true
enforcement=AVAILABLE
proof_class=ENFORCEMENT_VERIFIED
```

as proof.

## Interfaces

Add a dedicated transport request:

```ts
export type QualityCompileRequest = {
  spe_api: "quality";
  op: string;
  [key: string]: unknown;
};
```

Add to `EngineClient`:

```ts
compileQuality(
  request: QualityCompileRequest,
  onPhase: (phase: CompilePhase) => void,
): Promise<CompileOutcome>
```

Add Worker request:

```ts
{
  id: string;
  type: "quality";
  request: QualityCompileRequest;
}
```

Caller-provided runtime-attestation fields must be removed/overwritten before WASM evaluation.

### Step 1 — write failing web custody tests

Create:

`apps/web/scripts/test-quality-runtime-custody.mjs`

Required tests:

```text
caller wasm_available=true              → cannot mint verified
caller proof_class=ENFORCEMENT_VERIFIED → ignored/refused
caller fake wasm_sha256                 → ignored/refused
generic evaluate with spe_api=quality   → trusted quality path required
real quality worker path                → carries actual verified WASM hash
WASM hash mismatch                      → no verified receipt
WASM import count >0                    → no verified receipt
```

### Step 2 — run and prove RED

```bash
cd apps/web
node scripts/test-quality-runtime-custody.mjs
```

Expected: FAIL.

### Step 3 — refactor the WASM host without changing semantics

Modify:

`apps/web/src/engine/wasm-host.mjs`

Add an internal verified-session abstraction equivalent to:

```js
createVerifiedWasmSession({
  wasmBytes,
  expectedSha256,
  onPhase,
})
```

It must:

```text
compute actual SHA
compare manifest SHA
compile module
verify imports == 0
instantiate required exports
return actual SHA + evaluator
```

Keep `loadAndEvaluate()` as a compatibility wrapper over the verified session so existing callers do not break.

### Step 4 — create dedicated quality Worker route

Modify:

`engine.worker.ts`

For `type === "quality"`:

```text
1. fetch bytes + manifest
2. verify actual bytes
3. instantiate trusted WASM
4. overwrite any caller runtime metadata
5. inject host-observed runtime evidence
6. evaluate quality request
7. return exact WASM output + actual sha/imports
```

Generic raw evaluate must not be allowed to create a trusted quality receipt.

### Step 5 — update client and transport

`qualityTransport.ts` should call:

```ts
client.compileQuality(...)
```

not generic `client.compile(...)`.

The current module is transport-only already; preserve that property.

### Step 6 — run custody tests GREEN

```bash
node scripts/test-quality-runtime-custody.mjs
npx tsc --noEmit
```

### Step 7 — commit

```bash
git commit -am "fix: bind quality verification to trusted WASM runtime"
```

---

# Task 3 — Kernel receipt custody + canonical `from_k3` quality input

The app must not reconstruct Requirement Graph/XCAT/K3 semantics in TypeScript.

Current K3 already produces:

```text
category_context
protected_binding
requirement_graph
selection_id
techniques
prompt_effect_plan
```

inside WASM.

Use those exact kernel outputs.

## New quality operation

Add:

```text
spe_api = quality
op = from_k3
```

Conceptual input:

```json
{
  "spe_api": "quality",
  "op": "from_k3",
  "k3_output": {},
  "compiled_prompt": "...",
  "mode": "VALIDATE_ONLY",
  "runtime_evidence": {}
}
```

`runtime_evidence` is Worker-supplied only.

## Python interface

Add inside `spe_runtime/quality/engine.py`:

```python
def subject_from_k3(
    k3_output: Mapping[str, Any],
    compiled_prompt: str,
) -> dict[str, Any]
```

and:

```python
def evaluate_from_k3(
    payload: Mapping[str, Any],
) -> dict[str, Any]
```

### Canonical mappings happen inside semantic core

```text
protected_intent ← k3_output.protected_binding
requirement_graph ← k3_output.requirement_graph
xcat ← k3_output.category_context.xcat_id
k3 ← selection_id + techniques
effect_plan ← prompt_effect_plan
compiled_prompt ← provided rendered candidate
```

Normalize `CAT:C01` → `C01` **inside the semantic core**, not TS.

### Receipt must bind

```text
subject_digest
wasm_sha256
runtime_path
integrity_state
mode
verdict
proof_class
```

### Proof law

```text
runtime evidence absent
→ max ENFORCEMENT_AVAILABLE / DECLARED_POLICY

runtime evidence verified by official Worker path
+
quality actually executed
→ ENFORCEMENT_VERIFIED

never
→ EXECUTION_OBSERVED
```

### Step 1 — failing Python tests

Create:

`tests/unit/test_quality_task57r.py`

Tests:

```python
test_caller_flags_cannot_mint_verified
test_from_k3_builds_subject_without_ts_semantics
test_receipt_binds_subject_digest
test_receipt_binds_runtime_wasm_sha
test_missing_runtime_evidence_not_verified
test_execute_never_becomes_observed
```

### Step 2

```bash
python -m pytest tests/unit/test_quality_task57r.py -q
```

Expected: FAIL.

### Step 3 — minimal Python implementation

### Step 4 — port exact semantics to Rust

Modify:

`portable/spe-core-rs/src/quality.rs`

No Rust reinterpretation.

### Step 5 — parity tests

Create:

`tests/portability/test_quality_parity_57r.py`

Require exact JSON equality for `from_k3` results.

### Step 6 — run

```bash
python -m pytest tests/unit/test_quality_task57.py \
  tests/unit/test_quality_task57r.py \
  tests/portability/test_quality_parity_57.py \
  tests/portability/test_quality_parity_57r.py -q

cargo test --offline --manifest-path portable/spe-core-rs/Cargo.toml
```

### Step 7 — commit

```bash
git commit -am "feat: add trusted quality receipt custody"
```

---

# Task 4 — Make reconstruction genuinely causal and minimal

Keep the six existing repair operations.

Do **not** add more intelligence.

## New diagnosis interface

Inside Python and Rust add a deterministic concept equivalent to:

```text
RepairDiagnosis {
  triggering_obligation_ids
  cause_codes
  repair_operation
  allowed_sections
}
```

Example:

```text
hard:c1
MISSING_CONSTRAINT
RESTORE_MISSING_CONSTRAINT
["Hard constraints"]
```

## Acceptance condition

A repair is accepted only if:

```text
trigger improves
AND changed_sections ⊆ allowed_sections
AND ProtectedIntent identical
AND Requirement Graph identity identical
AND XCAT identical
AND K3 identical
AND Effect Plan authority identical
AND no protected regression
AND no unrelated obligation regression
```

### Step 1 — failing tests

Add tests for:

```text
constraint prefix collision
duplicate heading
right constraint text in wrong section
repair modifies Objective while fixing constraint
repair modifies Facts while fixing output contract
repair changes category
repair changes technique
repair changes authority
repair fixes target but changes unrelated protected obligation
```

### Step 2

```bash
python -m pytest tests/unit/test_quality_task57r.py -q
```

Expected RED.

### Step 3 — implement section-diff check

Do not use raw byte diff as semantic authority.

Compare parsed canonical sections.

### Step 4 — harden `RENDER_FROM_BOUND_EFFECT_PLAN`

It is valid only when cause is:

```text
FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN
```

and the bound plan already passes its own binding checks.

Otherwise:

```text
UNRESOLVED
```

### Step 5 — Rust parity

### Step 6 — run Python/Rust/parity suites

### Step 7 — commit

```bash
git commit -am "fix: enforce causal minimality for Task57 reconstruction"
```

---

# Task 5 — Replace vector padding with frozen semantic oracles

Current Quality vectors include `q-goal-0` through `q-goal-20`, so raw count overstates semantic diversity.

Replace count-padding with real distinct fixtures.

## Frozen vector format

Each JSON vector must contain actual input—not only an ID.

Example conceptual shape:

```json
{
  "id": "constraint-prefix-collision",
  "input": {},
  "expected": {
    "disposition": "REGRESSED",
    "reason_codes": ["MISSING_CONSTRAINT"]
  }
}
```

## Mandatory unique cases

At minimum:

```text
missing exact constraint
prefix constraint collision
duplicate headings
right words in wrong section
UNKNOWN laundering
authority-level expansion
grant expansion
invented fact
invented example
unsupported browsing claim
ProtectedIntent mismatch
graph mismatch
XCAT mismatch
K3 mismatch
effect drift
output-contract drift
malformed artifact
missing proof
structured-output drift
extra unauthorized fact
same prompt
longer but not better
shorter but equivalent
repair scope escape
attempt 2
```

### Step 1 — rewrite vector files

```text
QUALITY_VECTORS.json
RECONSTRUCTION_VECTORS.json
VALIDATE_ONLY_VECTORS.json
```

### Step 2 — modify parity tests

Python, Rust and WASM must read the exact same frozen JSON vectors.

No helper may secretly manufacture the semantic input differently for each runtime.

### Step 3 — add real guard-deletion mutants

At minimum:

```text
trust caller proof class
trust caller wasm_available
ignore authority expansion
UNKNOWN→SATISFIED
skip protected binding
skip graph binding
skip XCAT binding
skip K3 binding
allow repair scope escape
allow attempt 2
accept NON_INFERIOR as IMPROVED
accept protected regression
```

### Step 4 — verify

Required:

```text
Task57 original mutants = 18/18
Task56 XCAT mutants = 23/23
Effect mutants = 11/11
Task57R new mutants = all killed
```

### Step 5 — commit

```bash
git commit -am "test: replace Task57 padding with adversarial quality oracles"
```

---

# Task 6 — Implement founder Core B

This is intentionally **not Rust/WASM**, because Core B must survive Rust/WASM failure.

Create:

`apps/web/src/engine/core-b.mjs`

Use plain deterministic JavaScript with JSDoc typing so it can run both in the browser and directly under Node tests.

## Interfaces

```js
createRawRequestCustody({
  rawRequest,
  target,
  explicitConstraints
}) -> Promise<RawRequestCustody>

renderSafeFallbackPrompt(
  custody,
  reasonCode
) -> SafeFallbackArtifact
```

## Artifact

```text
artifact_type = SAFE_FALLBACK_PROMPT
status = DEGRADED_DELIVERY
canonical = false
verified = false
quality_verified = false
semantic_engine_used = false
execution_authorized = false
external_effect = false
```

### Raw request law

The exact raw text must appear losslessly in the fallback.

Core B may not rewrite it.

### Template

Fixed versioned template only.

No:

```text
category detection
K3
persona selection
examples
retrieval
semantic inference
facts
network
credentials
execution
```

### Recursion law

`core-b.mjs` must import **none** of:

```text
EngineClient
k3Transport
qualityTransport
WASM host
itself
```

### Step 1 — write failing test script

Create:

`apps/web/scripts/test-core-b-fallback.mjs`

Required tests:

```text
raw request preserved byte-for-byte
target preserved only if explicit
explicit constraints preserved only if supplied
no invented constraint
no VERIFIED wording/state
no canonical flag
no network calls
no EngineClient import
no K3 import
no quality import
deterministic same input = same prompt
fallback never recurses
```

### Step 2

```bash
node scripts/test-core-b-fallback.mjs
```

Expected RED.

### Step 3 — implement minimal Core B

### Step 4 — run GREEN

### Step 5 — add package script

```json
"test:core-b": "node scripts/test-core-b-fallback.mjs"
```

### Step 6 — commit

```bash
git commit -am "feat: add deterministic Core-B safe prompt fallback"
```

---

# Task 7 — Wire Task57 + Core B into the actual app

The current `App.tsx` canonical path renders and stores a prompt, but any thrown engine error clears `result`, `rendered`, and `artifact` and enters `ENGINE_UNAVAILABLE`.

This is the exact no-dead-end gap.

## New React state

Add conceptually:

```ts
qualityReceipt
safeFallback
```

Do not replace canonical `artifact` with fallback.

## Compile flow

Before Core A starts:

```text
1. capture RawRequestCustody
```

Then:

```text
2. Core A
3. K3 binding
4. canonical rendering
5. requestQualityReceipt(from_k3)
6. if reconstruction accepted, use returned repaired prompt
7. display validation receipt
```

### Failure policy

```text
PromptBriefError / conflict
→ review/clarification
→ NO Core B bypass

explicit unsupported/refused
→ NO Core B bypass

Core A engine/WASM/Worker unavailable before canonical prompt
→ SAFE_FALLBACK_PROMPT

K3/effect unavailable and no canonical lawful prompt
→ SAFE_FALLBACK_PROMPT

quality subsystem unavailable AFTER lawful canonical prompt exists
→ keep canonical prompt
→ validation status UNKNOWN
→ do not replace with fallback

repair fails but original canonical prompt remains lawful
→ keep canonical original

repair regresses
→ keep canonical original
```

## K3 transport

Current K3 WASM output already contains the canonical context needed for quality. Extend `K3Binding` to retain the **raw WASM K3 output** as an opaque field.

Do not reconstruct it in TS.

Example:

```ts
rawOutput: unknown
```

Then:

```ts
requestQualityReceipt(client, {
  spe_api: "quality",
  op: "from_k3",
  k3_output: rawOutput,
  compiled_prompt: prompt.finalPrompt,
  mode: "VALIDATE_ONLY"
})
```

## UI component

Create:

`QualityReceiptPanel.tsx`

Allowed displayed semantic words:

```text
IMPROVED
NON_INFERIOR
REGRESSED
UNRESOLVED
PASS
FAIL
UNKNOWN
SAFE FALLBACK
```

Do not calculate these in React.

Display the values returned by the kernel.

### Safe fallback copy

Show:

> **Safe fallback** — SPE's full engine was unavailable. This prompt preserves your original request but has not received SPE's normal semantic verification.

Fallback can be copied.

Fallback must **not** enable canonical `.spe` export.

### Existing Execution Contract

The app already has an Execution Contract surface and explicitly states local preparation does not run a target AI or side-effect tool. Preserve that language and authority separation.

### Step 1 — product wiring test

Create:

`apps/web/scripts/test-quality-product-wiring.mjs`

Required tests:

```text
App calls requestQualityReceipt after K3
App does not compute disposition
Core-A unavailable produces fallback
PromptBriefError does not produce fallback
valid canonical + quality unavailable remains canonical/UNKNOWN
fallback disables canonical artifact export
safe fallback visually labeled
```

### Step 2 — run RED

### Step 3 — implement wiring

### Step 4 — run

```bash
npm run build
npm run test:quality-wiring
npm run test:core-b
npx tsc --noEmit
```

### Step 5 — commit

```bash
git commit -am "feat: wire quality receipts and Core-B delivery into SPE"
```

---

# Task 8 — Prove no-dead-end behavior under failure injection

Add failures at actual component boundaries.

Required scenarios:

```text
WASM missing
WASM SHA mismatch
forbidden WASM import
WASM instantiation failure
Worker startup error
Worker timeout
Core compile returns no result
K3 unavailable
effect plan unavailable
quality API unavailable
quality malformed output
reconstruction returns UNRESOLVED
reconstruction returns REGRESSED
raw custody intact after all above
```

For each test, terminal state must be one of:

```text
CANONICAL_PROMPT
RECONSTRUCTED_PROMPT
SAFE_FALLBACK_PROMPT
CLARIFICATION_REQUIRED
UNSUPPORTED
REFUSED
```

Never:

```text
success + blank prompt
undefined success
silent state loss
recursive retry
fake PASS
```

## Core-B mutations

Add at least:

```text
F1 Core-A failure returns blank
F2 Core B drops raw request
F3 Core B invents constraint
F4 Core B marks verified
F5 Core B imports K3
F6 Core B imports quality
F7 Core B calls network
F8 Core B becomes canonical artifact
F9 Core B recursion
F10 Core B changes explicit target
F11 refusal incorrectly falls into Core B
F12 quality unavailable replaces valid canonical prompt unnecessarily
```

Required:

```text
12/12 killed
```

Commit:

```bash
git commit -am "test: prove SPE no-dead-end delivery failures"
```

---

# Task 9 — Measure the real chain

Current proof labels the `0.464 ms` path as a “full compile-evaluate-repair-validate loop,” although Task57's measured subject was already largely constructed.

Correct that.

## Python benchmark

Create:

`tools/bench_task57r.py`

Measure:

```text
ProtectedIntent
→ Requirement Graph
→ XCAT
→ K3
→ Effect Plan
→ render
→ quality evaluation
→ one repair if triggered
→ re-evaluation
→ VALIDATE_ONLY
```

Minimum:

```text
N >= 100
```

Report:

```text
median
p95
max
sample count
machine/runtime
```

## WASM benchmark

Create:

`apps/web/scripts/bench-task57r-wasm.mjs`

Measure the real:

```text
Worker/WASM or Node WASM round trip
```

including integrity check separately from warm evaluation if useful.

Do not mix cold and warm results without labeling.

## Core-B benchmark

Measure separately:

```text
raw custody
+
fallback rendering
```

Do not market these numbers.

### Proof wording

Replace misleading:

```text
full compile-evaluate-repair-validate
```

with exact measured path names.

Commit:

```bash
git commit -am "perf: measure true Task57R semantic and fallback paths"
```

---

# Task 10 — Full release regression and proof pack

Run fresh verification **after all code changes**.

## Python

```bash
python -m pytest -q
```

Required:

```text
0 failures
```

## Rust

```bash
cargo test --offline --manifest-path portable/spe-core-rs/Cargo.toml
```

Required:

```text
0 failures
```

## WASM

Build two independent paths.

Require:

```text
identical bytes
identical SHA-256
imports = 0
exports =
memory
spe_alloc
spe_evaluate
spe_free
```

Previous Task57 WASM:

```text
dd57eb3ee6eb14297da8d49acb9803cf4853dbb89adcc5ef52f408379d643b22
```

becomes historical only.

## Mutation requirements

```text
Task57R new quality/proof mutants = all killed
Core-B mutants = >=12/12
Task57 original = 18/18
XCAT = 23/23
Effect = 11/11
```

## Web

From `apps/web`:

```bash
npm run build
npm run test:engine
npm run test:artifact
npm run test:create-intent
npm run test:execution-contract
npm run test:adversarial
npm run test:final-craft
npm run test:theme-routes
npm run test:dot-pattern
npm run test:capabilities-seo
npm run test:truth-privacy
npm run test:copy
npm run test:core-b
npm run test:quality-custody
npm run test:quality-wiring
npm run audit:egress
npx tsc --noEmit
```

Required:

```text
all exit 0
unexpected egress = none
```

## Deployment safety

```bash
node tools/deployment-safety-gate.mjs
```

Expected:

```text
exit 2
HOSTING=FORBIDDEN
```

---

# Task 11 — Final Task57R adjudication pack

Write:

```text
proofs/task57_quality_reconstruction_20260929/
PLANB_HISTORY_RECOVERY.md
TASK57R_RUNTIME_CUSTODY.md
TASK57R_CAUSAL_REPAIR.md
TASK57R_CORE_B.md
TASK57R_PRODUCT_WIRING.md
TASK57R_MUTATION_RESULTS.md
TASK57R_PARITY_RESULTS.md
TASK57R_PERFORMANCE.md
TASK57R_FINAL_REPORT.md
```

## Required final report

```text
SPE TASK 57R CORE-B / QUALITY PRODUCT CLOSURE REPORT
====================================================

BASE SHA:
352d05ee0fb97b46fea0171e958868da30f268d9

FINAL PR HEAD:
...

HISTORICAL PLAN-B RECOVERY:
PR39=
old_runtime_bytes=
verdict=

RUNTIME CUSTODY:
caller_can_mint_verified=
trusted_quality_path=
verified_wasm_sha=
receipt_subject_binding=

QUALITY DELTA:
...

CAUSAL RECONSTRUCTION:
max_attempts=
diagnosed_surface_only=
scope_escape=
protected_regressions=

VECTORS:
distinct_quality=
distinct_reconstruction=
distinct_validate=
padding_rows=

MUTATION:
task57_original=
task57r=
core_b=
xcat=
effect=

CORE B:
implemented=
semantic_authority=
raw_request_preserved=
network=
credentials=
external_effect=
recursion=
canonical=
verified=

NO-DEAD-END:
blank_success=
silent_failure=
fake_verification=

PRODUCT WIRING:
quality_kernel_called=
ui_computes_semantic_verdict=
fallback_visible=
fallback_exported_as_canonical=

PYTHON:
passed=
failed=

RUST:
passed=
failed=

WASM:
previous_sha=
new_sha=
bytes=
imports=
exports=
reproducible=

PARITY:
Python↔Rust=
Rust↔WASM=
Python↔WASM=

PERFORMANCE:
python_n=
python_median=
python_p95=
python_max=
wasm_n=
wasm_median=
wasm_p95=
wasm_max=
core_b_n=
core_b_median=
core_b_p95=
core_b_max=

EGRESS:
...

DEPLOYMENT:
2

HOSTING:
FORBIDDEN

PR:
#57

FINAL:
TASK57R_CORE_B_QUALITY_PRODUCT_CLOSURE_PASS

or exact HOLD reason.

STOP.
```

---

# Absolute acceptance gate

Do **not** call Task57R complete unless:

```text
CALLER_MINTED_ENFORCEMENT_VERIFIED = 0

RECEIPT_BINDS_REAL_WASM_SHA = YES

RECEIPT_BINDS_SUBJECT_DIGEST = YES

MAX_RECONSTRUCTION_ATTEMPTS = 1

REPAIR_SCOPE_ESCAPE = 0

PROTECTED_INTENT_DRIFT = 0

XCAT_DRIFT = 0

K3_DRIFT = 0

AUTHORITY_ESCALATION = 0

UNKNOWN_LAUNDERING = 0

CORE_B_IMPLEMENTED = YES

CORE_B_SEMANTIC_BRAIN = NO

CORE_B_NETWORK = 0

CORE_B_CREDENTIALS = 0

CORE_B_EXTERNAL_EFFECT = 0

CORE_B_RECURSION = 0

CORE_B_CANONICAL_OUTPUT = 0

CORE_B_FAKE_VERIFICATION = 0

RAW_REQUEST_LOSS = 0

BLANK_SUCCESS = 0

SILENT_FAILURE = 0

PRODUCT_QUALITY_WIRING = PASS

TS_SEMANTIC_VERDICT_ENGINE = NONE

PYTHON_RUST_WASM_PARITY = PASS

WASM_IMPORTS = 0

WASM_REPRODUCIBLE = YES

OFFICIAL_BUILD = PASS

UNEXPECTED_EGRESS = NONE

DEPLOYMENT_GATE = 2

HOSTING = FORBIDDEN
```

And absolutely no claim yet of:

```text
target-model success
human preference superiority
world-outcome correctness
100% universal task success
production qualification
world #1
```

Those require different evidence.

---

## Implementation sequence

The dependency order is deliberately:

```text
Frozen docs
   ↓
Trusted runtime custody
   ↓
Kernel receipt binding
   ↓
Causal reconstruction hardening
   ↓
Independent oracle vectors
   ↓
Core B
   ↓
Product wiring
   ↓
Failure injection
   ↓
True benchmarks
   ↓
Full regression
   ↓
Founder review
```

**Do not build Core B first.** If proof custody remains forgeable, the app could incorrectly label a fallback or untrusted result as verified.

**Do not wire the UI before causal repair is hardened.** Otherwise the screen would expose semantics we already know are under-tested.

Execution of this plan is authorized on the existing PR #57 branch. Authorization covers this plan only. No merge, no deployment, no hosting, and no Task58 until founder review of the resulting Task57R report.
