# Counterfactual Capability Foundry (CCF)

## Goal
Build an autonomous local-first capability compilation engine that converts repetitive agent reasoning traces into sandboxed, causally verified WebAssembly capability capsules $\chi = (P, C, G, W, I, T, R)$ executing for $0 token cost.

## Tasks
- [x] Task 1: Define Canonical Capability Capsule Schema and State Machine (`schemas/capability_capsule.schema.json`, `spe_runtime/capabilities/capsule.py`) → Verify: `pytest tests/unit/test_capability_capsule_schema.py` passes.
- [x] Task 2: Implement Isolated AST/WASM Capability Sandbox (`spe_runtime/capabilities/sandbox.py`) → Verify: Security tests pass blocking unauthorized imports, filesystem, and network access.
- [x] Task 3: Build Wald Sequential Causal Evaluator (`spe_runtime/capabilities/causal_evaluator.py`) → Verify: Early-stopping SPRT halts defective candidates in $\le 2$ evaluations and correctly computes $LCB_{95\%}(\Delta_\chi)$.
- [x] Task 4: Implement Adversarial Counterfactual Mutator (`spe_runtime/capabilities/counterfactual_mutator.py`) → Verify: Property-based boundary mutations reliably expose overfitted synthetic procedures.
- [x] Task 5: Implement Cross-Model Transfer & Invalidation Matrix (`spe_runtime/capabilities/transfer_matrix.py`) → Verify: Model version and dependency hash changes automatically trigger `SUSPENDED` revocation.
- [x] Task 6: Implement Web/CLI Capability Host Bridge (`packages/web-runtime/src/capabilityHost.ts`) → Verify: TypeScript unit tests confirm deterministic round-trip execution of admitted capsules.
- [x] Task 7: Build Capability Foundry UI Studio Panel (`apps/web/src/capabilities/CapabilityFoundryStudio.tsx`) → Verify: `node tools/copy-check.mjs` reports 0 unreviewed copy violations; UI renders live telemetry.
- [x] Task 8: End-to-End Integration & Amortized Economics Verification (`tests/integration/test_counterfactual_foundry_e2e.py`) → Verify: Autonomous trace synthesis $\rightarrow$ Wald qualification $\rightarrow$ local zero-cost execution verifies 100% accuracy.

## Done When
- [x] All 8 tasks pass their individual verification criteria.
- [x] A sample repetitive software diagnostic task is autonomously compiled from reasoning into a WASM/AST capsule and re-executed at $0 cost with identical precision.
- [x] Copy-check passes with 0 violations and TypeScript typecheck passes with 0 errors.

## Notes
- Enforces strict Wald early-stopping to avoid the runaway qualification cost trap ($C_Q \gg C_B$).
- Pure local-first execution ensures zero host security exposure and zero data leakage.
