# SPE Ω — Batch D Execution Contract Report

**Scope:** Execution Contract → local dry-run → durable run record → conformance  
**Base tip:** `709e75c57e706b6991521ba733d22a10be033316`  
**Tested implementation tip:** `f62b8e0106cfa61ce3021ce94ed7b816ee9ec539`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44, stacked on the frozen PR #43 branch  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Live-owner matrix

| Capability | Before Batch D | Owner / decision | After Batch D |
|---|---|---|---|
| ProtectedIntent | PRESENT | Existing web/runtime + artifact | PRESENT, unchanged |
| WASM Execution Contract | PRESENT, under-displayed | Rust/WASM context protocol | **PRESENT and user-visible** |
| XCAT authority state | PRESENT in envelope | Existing authority state / grants | **Visible and checked for non-escalation** |
| Constraint monotonicity | PRESENT in XCAT/Rust laws | Reused in web local checks | **Visible PASS/FAIL check** |
| `quality_record` | PRESENT | Existing auditable protocol record | **Preserved and used for conformance** |
| ProofReceipt | BLOCKED / STUB | `schemas/proof_receipt.schema.json`, forbidden protocol key | **Not implemented** |
| OperationJournal | MISSING | No such owner; Python has K7 `DurableJournal` | **Not duplicated** |
| Web local dry-run | MISSING | Existing artifact + WASM contract | **PRESENT, no side effects** |
| Durable web execution record | MISSING | Optional field on existing `.spe` artifact | **PRESENT as `execution_record`** |
| Conformance surface | PARTIAL | WASM quality record + XCAT laws | **PASS / FAIL / UNKNOWN UI** |
| External execution | BLOCKED / out of scope | Python C07 requires external grant | **Still blocked** |

## Vertical slice

1. Create compiles the protected brief through the existing local WASM path.
2. The actual WASM `execution_contract` and `quality_record` are displayed.
3. CONTRACT shows the goal, protocol, depth, HARD constraints, Desired Output,
   acceptance criteria, and planned stages.
4. AUTHORITY separately shows status, level, grants, side effects, and
   `recommend ≠ authorize ≠ execute`.
5. A local dry-run checks:
   - actual WASM contract presence
   - ProtectedIntent constraint monotonicity
   - Desired Output remains HARD
   - no authority or grant self-escalation
   - Example remains `USER_SUPPLIED / NON-AUTHORITATIVE`
   - protocol node/evaluator outcome from the real `quality_record`
6. LOCAL RUN RECORD binds build tip, input artifact digest, contract digest,
   hard-constraint digest, quality digest, prompt digest, and record digest.
7. CONFORMANCE reports individual PASS/FAIL/UNKNOWN and an overall status.
   Any FAIL dominates; any UNKNOWN prevents PASS.
8. The final `.spe` artifact integrity covers the durable `execution_record`.
   My Work artifact reopen restores it read-only.

The record always states `executed: false`, `side_effects: NONE`, and either
`NOT_EXECUTED` or `BLOCKED`. Planned EXECUTE / VERIFY / DELIVER contract stages
are explicitly labeled `PLANNED` and state that the dry-run does not execute
them.

## Naming correction

The requested screenshot remains named `receipt-after-run.png` for the Batch D
acceptance list. The implemented product object and UI are deliberately named
**Local run record**, not ProofReceipt:

- protocol payloads forbid `receipt` / `receipts`
- `ProofReceipt` is an explicit unimplemented stub
- `quality_record` is auditable but never authority or verified-success proof
- the serialized Batch D field is `execution_record`

No serialized `receipt` key is introduced.

## Files changed

- `packages/web-runtime/src/executionRecord.ts`
- `packages/web-runtime/src/speArtifact.ts`
- `packages/web-runtime/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/workspace/ExecutionContractPanel.tsx`
- `apps/web/src/index.css`
- `apps/web/vite.config.ts`
- `apps/web/src/vite-env.d.ts`
- `apps/web/scripts/test-execution-contract.mjs`
- `apps/web/package.json`
- `tests/copy/reviewed-inventory.json`
- `proofs/spe_v1_continuation/batch_d/**`

No Python C07/XCAT owner, Rust contract compiler, hero, Batch B/C behavior,
hosting, DNS, workflow, paid dependency, Tailwind/shadcn, or external provider
integration was changed.

## Tests and exits

| Check | Exit |
|---|---:|
| `cd apps/web && npm run build` | `0` |
| `cd apps/web && npm run test:execution-contract` | `0` |
| `cd apps/web && node scripts/e2e-context-protocol.mjs` | `0` (21 checks) |
| `cd apps/web && npm run test:artifact` | `0` |
| `cd apps/web && npm run test:create-intent` | `0` |
| `cd apps/web && npm run test:hero-story` | `0` |
| `cd apps/web && npm run test:dot-pattern` | `0` |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` |
| `cd apps/web && npm run test:predeploy-qa` | `0` |
| `node tools/copy-check.mjs` | `0` |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` |
| `node proofs/spe_v1_continuation/batch_d/capture_execution.mjs` | `0` |
| `node tools/deployment-safety-gate.mjs` | **`2`** (expected fail-closed) |

The Batch D executable test covers stable digests, constraint weakening,
Example promotion, authority escalation, PASS/FAIL/UNKNOWN reduction, durable
artifact round-trip, and rejection of UNKNOWN→PASS laundering.

## Screenshot evidence

- `create-contract-dark.png`
- `create-contract-light.png`
- `receipt-after-run.png`
- `conformance-pass.png`
- `conformance-blocked-or-unknown.png`
- `mobile-contract.png`
- `screenshot-manifest.json`

All files are under `proofs/spe_v1_continuation/batch_d/`; the manifest binds
them to the tested implementation SHA.

## Residuals

1. Overall conformance is intentionally UNKNOWN after a preparation dry-run
   because required target-execution protocol nodes remain open.
2. PASS applies only to specific local checks; it is not a claim that the target
   task, final answer, or external effect succeeded.
3. Web Batch D does not bridge into Python C07 side-effect execution. C07 still
   requires a real external authority grant.
4. K7 `DurableJournal` remains the Python execution journal; no TypeScript
   journal duplicate was created.
5. Build tip identity is injected at Vite build time and can be overridden by
   `SPE_BUILD_SHA` in controlled builds.
6. Aikido was invoked for Batch D files but remains blocked on integration
   authentication; no alternate credential or bypass was used.
7. Full human screen-reader testing remains outside the automated accessibility
   pass.

## Explicit stop

Batch D is complete for founder review. Batch E was not started.
