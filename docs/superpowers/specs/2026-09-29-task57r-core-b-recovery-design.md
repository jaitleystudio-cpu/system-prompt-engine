# Task57R Design — Core-B Recovery and Quality Product Closure

**Date:** 2026-09-29  
**Status:** Founder-approved and frozen as the design basis  
**Base PR HEAD:** `352d05ee0fb97b46fea0171e958868da30f268d9`  
**Branch:** `cursor/spe-quality-delta-planb-validate-only-20260929`  
**PR:** #57 (draft, open, unmerged)  
**Lineage:** Task54 / Task55 / Task56 frozen. Task57 Quality Delta / one-shot reconstruction / `VALIDATE_ONLY` is the foundation this design extends.  
**Release claim:** not a release. No target-model success, human-preference superiority, world-outcome correctness, 100% universal task success, production qualification, or world #1 claim.

## Custody of this document

The founder approved this design as the frozen basis for Task57R and required it to be persisted before implementation. The local execution handoff did not include a separate pre-plan design essay on disk. This file freezes the design laws stated in that approval. It does not add requirements beyond that approved text. The graceful-degradation literature supports preserving reduced, truthful functionality under component failure. It does not change the stricter SPE proof requirements below.

## Purpose

Turn Task57's working Quality Delta / one-shot reconstruction / `VALIDATE_ONLY` foundation into the actual SPE product loop, harden proof custody and causal reconstruction, and implement the founder's independent deterministic Core-B no-dead-end fallback.

## Architecture

Core A remains the sole semantic authority:

```text
ProtectedIntent → Requirement Graph → XCAT → K3 → PromptEffectPlan → Quality → one repair → validation
```

Core B is deliberately outside that semantic chain. It produces only a clearly non-canonical `SAFE_FALLBACK_PROMPT` from independently preserved raw input when Core A cannot produce a lawful usable prompt.

```text
CORE A = semantic intelligence
CORE B = deterministic degraded delivery
SAFE_FALLBACK_PROMPT != CANONICAL_SPE_PROMPT
SAFE_FALLBACK_PROMPT != VERIFIED_PROMPT
NO EFFECT PLAN → NO CANONICAL FINAL PROMPT
```

Core B is intentionally not Rust/WASM, because Core B must survive Rust/WASM failure. It is plain deterministic JavaScript that can run in the browser and under Node tests.

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

Do not start Task58. Do not weaken Task54/55/56 frozen semantics. Do not invent PASS evidence. If a required invariant cannot be proven, return HOLD. Do not work around it.

## Tech stack

Python 3, Rust, WASM, TypeScript/React, Web Worker, Vite, Node.js, deterministic JSON vectors.

Task57 already owns Quality Delta / reconstruction semantics. Do not create a second quality engine.

The Worker already verifies the real WASM SHA before instantiation and refuses host imports. Preserve that boundary.

## Review boundaries

The five highest-risk boundaries reviewers must attack are:

1. **Caller-controlled proof state** — no request field may mint `ENFORCEMENT_VERIFIED`.
2. **Core-A failure after raw input capture** — the original request must survive even if WASM/Worker/K3 completely fail.
3. **Repair scope escape** — a repair fixing one diagnosed obligation must not silently modify unrelated protected content.
4. **Fallback as safety bypass** — conflict, refusal, unsupported state or authority denial must never be converted into a convenient fallback prompt.
5. **UI truthfulness** — the screen must distinguish canonical, reconstructed, validation-unknown and safe-fallback outputs without TypeScript inventing semantic verdicts.

## Proof custody

Task57's public quality path must no longer accept caller declarations such as:

```text
wasm_available=true
enforcement=AVAILABLE
proof_class=ENFORCEMENT_VERIFIED
```

as proof.

Caller-provided runtime-attestation fields must be removed or overwritten before WASM evaluation. A fake `wasm_sha256` supplied by the caller is ignored or refused. A generic evaluate carrying `spe_api=quality` must not create a trusted quality receipt. The real quality worker path carries the actual verified WASM hash. A WASM hash mismatch yields no verified receipt. A WASM import count greater than 0 yields no verified receipt.

### Dedicated quality transport

```ts
export type QualityCompileRequest = {
  spe_api: "quality";
  op: string;
  [key: string]: unknown;
};
```

`EngineClient.compileQuality(request, onPhase)` sends a Worker request:

```ts
{
  id: string;
  type: "quality";
  request: QualityCompileRequest;
}
```

`qualityTransport.ts` calls `client.compileQuality(...)`, not generic `client.compile(...)`. The module stays transport-only.

### Verified WASM session

The WASM host exposes an internal verified-session abstraction:

```js
createVerifiedWasmSession({
  wasmBytes,
  expectedSha256,
  onPhase,
})
```

It computes the actual SHA, compares the manifest SHA, compiles the module, verifies imports == 0, instantiates the required exports, and returns the actual SHA plus an evaluator. `loadAndEvaluate()` remains a compatibility wrapper over the verified session so existing callers do not break.

The `type === "quality"` Worker route:

```text
1. fetch bytes + manifest
2. verify actual bytes
3. instantiate trusted WASM
4. overwrite any caller runtime metadata
5. inject host-observed runtime evidence
6. evaluate quality request
7. return exact WASM output + actual sha/imports
```

## Kernel receipt and `from_k3`

The app must not reconstruct Requirement Graph / XCAT / K3 semantics in TypeScript. Current K3 already produces, inside WASM:

```text
category_context
protected_binding
requirement_graph
selection_id
techniques
prompt_effect_plan
```

Use those exact kernel outputs. Extend `K3Binding` to retain the raw WASM K3 output as an opaque field (`rawOutput: unknown`). Do not reconstruct it in TypeScript.

### New quality operation

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

Python:

```python
def subject_from_k3(
    k3_output: Mapping[str, Any],
    compiled_prompt: str,
) -> dict[str, Any]

def evaluate_from_k3(
    payload: Mapping[str, Any],
) -> dict[str, Any]
```

Canonical mappings happen inside the semantic core:

```text
protected_intent ← k3_output.protected_binding
requirement_graph ← k3_output.requirement_graph
xcat ← k3_output.category_context.xcat_id
k3 ← selection_id + techniques
effect_plan ← prompt_effect_plan
compiled_prompt ← provided rendered candidate
```

Normalize `CAT:C01` → `C01` inside the semantic core, not TypeScript.

The receipt must bind:

```text
subject_digest
wasm_sha256
runtime_path
integrity_state
mode
verdict
proof_class
```

Proof law:

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

Rust ports the exact Python semantics. No Rust reinterpretation. Python, Rust, and WASM `from_k3` results require exact JSON equality.

## Causal reconstruction

Keep the six existing repair operations. Do not add more intelligence.

Deterministic diagnosis:

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

Section comparison uses parsed canonical sections. Raw byte diff is not semantic authority.

`RENDER_FROM_BOUND_EFFECT_PLAN` is valid only when the cause is `FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN` and the bound plan already passes its own binding checks. Otherwise the disposition is `UNRESOLVED`.

Hostile cases that must fail closed include: constraint prefix collision, duplicate heading, right constraint text in the wrong section, a repair that modifies Objective while fixing a constraint, a repair that modifies Facts while fixing an output contract, a repair that changes category, technique, or authority, and a repair that fixes the target but changes an unrelated protected obligation.

`MAX_AUTOMATIC_RECONSTRUCTION` remains 1. Attempt 2 is refused.

## Oracle vectors

Current Quality vectors include `q-goal-0` through `q-goal-20`, so raw count overstates semantic diversity. Replace count-padding with real distinct fixtures. Each JSON vector contains actual input, not only an ID.

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

Mandatory unique cases, at minimum:

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

Files:

```text
QUALITY_VECTORS.json
RECONSTRUCTION_VECTORS.json
VALIDATE_ONLY_VECTORS.json
```

Python, Rust, and WASM read the exact same frozen JSON vectors. No helper may secretly manufacture the semantic input differently for each runtime.

Real guard-deletion mutants, at minimum:

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

Required mutation results:

```text
Task57 original mutants = 18/18
Task56 XCAT mutants = 23/23
Effect mutants = 11/11
Task57R new mutants = all killed
```

## Core B

File: `apps/web/src/engine/core-b.mjs`

Plain deterministic JavaScript with JSDoc typing.

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

Artifact:

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

The exact raw text must appear losslessly in the fallback. Core B may not rewrite it. Target is preserved only if explicit. Explicit constraints are preserved only if supplied. Core B invents no constraint.

Fixed versioned template only. No category detection, K3, persona selection, examples, retrieval, semantic inference, facts, network, credentials, or execution.

`core-b.mjs` must import none of: `EngineClient`, `k3Transport`, `qualityTransport`, WASM host, or itself. Fallback never recurses. The same input yields the same prompt. No `VERIFIED` wording or state. No canonical flag.

## Product wiring

`App.tsx` today renders and stores a prompt on the canonical path, but any thrown engine error clears `result`, `rendered`, and `artifact` and enters `ENGINE_UNAVAILABLE`. That is the no-dead-end gap.

New React state, conceptually: `qualityReceipt` and `safeFallback`. Do not replace canonical `artifact` with fallback.

Compile flow:

```text
1. capture RawRequestCustody before Core A starts
2. Core A
3. K3 binding
4. canonical rendering
5. requestQualityReceipt(from_k3)
6. if reconstruction accepted, use returned repaired prompt
7. display validation receipt
```

Failure policy:

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

Quality request:

```ts
requestQualityReceipt(client, {
  spe_api: "quality",
  op: "from_k3",
  k3_output: rawOutput,
  compiled_prompt: prompt.finalPrompt,
  mode: "VALIDATE_ONLY"
})
```

`QualityReceiptPanel.tsx` may display only these semantic words, and only as values returned by the kernel:

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

React does not calculate them.

Safe fallback copy:

> **Safe fallback** — SPE's full engine was unavailable. This prompt preserves your original request but has not received SPE's normal semantic verification.

Fallback can be copied. Fallback must not enable canonical `.spe` export.

The existing Execution Contract surface states that local preparation does not run a target AI or side-effect tool. Preserve that language and authority separation.

## No-dead-end failure injection

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

Never: success + blank prompt, undefined success, silent state loss, recursive retry, or fake PASS.

Core-B mutations, at least these 12, all killed:

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

## Measurement

Do not label a path that starts from an already-constructed subject as a full compile-evaluate-repair-validate loop. The historical `0.464 ms` label is corrected.

Python benchmark measures:

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

Minimum `N >= 100`. Report median, p95, max, sample count, and machine/runtime.

WASM benchmark measures the real Worker/WASM or Node WASM round trip, including integrity check separately from warm evaluation when useful. Do not mix cold and warm results without labeling.

Core-B benchmark measures raw custody plus fallback rendering separately. Do not market these numbers.

## WASM identity

Build two independent paths. Require identical bytes, identical SHA-256, imports = 0, and exports:

```text
memory
spe_alloc
spe_evaluate
spe_free
```

Previous Task57 WASM `dd57eb3ee6eb14297da8d49acb9803cf4853dbb89adcc5ef52f408379d643b22` becomes historical only.

Deployment safety gate remains exit 2, `HOSTING=FORBIDDEN`. Unexpected egress remains none.

## Absolute acceptance gate

Do not call Task57R complete unless:

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

## Dependency order

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

Do not build Core B first. If proof custody remains forgeable, the app could incorrectly label a fallback or untrusted result as verified.

Do not wire the UI before causal repair is hardened.

## Out of scope

Merge of PR #57, modification of PR #56, deployment, hosting, DNS changes, edits under `.github/workflows/**`, Task58, and any weakening of Task54/55/56.
