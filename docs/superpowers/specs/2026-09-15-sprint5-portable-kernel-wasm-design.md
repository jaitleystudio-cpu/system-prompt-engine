# Sprint 5 Design — Portable Rust Kernel + WASM Conformance

**Date:** 2026-09-15  
**ABI:** `spe.universal-abi.v1` (MAJOR=1 only)  
**Lineage:** `NEW_IMPLEMENTATION`  
**Release claim:** `not_a_release=true`  
**Cost law:** paid API = NO, paid package = NO, new hosting = NO, additional owner spend = ₹0  
**Network:** focused conformance `network_mode=NONE`

## Purpose

Qualify a zero-cost Rust portable semantic kernel (native + `wasm32-unknown-unknown`) against the frozen Sprint-4 Python oracle and `spe.universal-abi.v1` corpus. Python remains the semantic oracle. Rust must not mint, broaden, revive, or infer authority.

## In scope

- Deterministic ABI transport (`ABSENT != NULL != UNKNOWN`)
- Protected-semantic comparison (explicit field manifest; no dynamic inference)
- Capability containment / downgrade (never fake SUCCESS)
- Cross-category handoff validation required by the existing conformance corpus
- Authority / privacy / proof / operation-ID preservation
- Thin WASM wrapper over the same `spe-core-rs` crate (no duplicated validators)
- Local subprocess conformance harness; native Rust tests; WASM build artifact hash

## Out of scope (hard)

Website, PWA, Android, iOS, Windows/macOS/Linux apps, extensions, MCP, AI plugins/skills, providers, ads, billing, deployment. No `RELEASED` / world-leadership / `#1` claims.

## Architecture

```
Python oracle (spe_runtime.portability.*)
        ^
        |  fixtures  data/conformance/universal_{core,negative}_v1.jsonl
        |
tools/sprint5_conformance.py  --subprocess-->  spe-core-eval (native)
                                                    |
                                            portable/spe-core-rs
                                                    ^
                                                    |
                                            portable/spe-wasm  (cdylib wrapper)
```

- `spe-core-rs` is the only semantic implementation in Rust.
- `spe-wasm` depends on `spe-core-rs` by path and exposes JSON-in/JSON-out.
- Disagreement with Python is a Rust defect (or an honest investigation), never a fixture weaken.

## Protected-semantic manifest (explicit)

Must preserve and compare:

- `envelope_id`, `goal_identity`
- `facts`, `provenance`, `uncertainties`
- `hard_constraints`, `user_preferences`
- `recommendation` (including status / conditionality / recommended option)
- `authority_state`, `execution_grants` (target, argument bounds, expiry/revoke/consume)
- `failures` (UNKNOWN ≠ PASS; absent ≠ null ≠ UNKNOWN)
- `taint_labels`, `sensitivity_labels`
- `operation_id`, `outcome` / proof state

Incidental ABI-approved differences (map key order, NFC-normalized Unicode, UTC-Z timestamps) are not drift.

## Capability law

- Runtime capabilities are declared, never inferred from OS / language / library.
- Required fixture capabilities must be a subset of declared capabilities.
- Missing required capability → `PORTABILITY_REQUIRED_CAPABILITY_MISSING`.
- `CORE_CONTRACT` runtime cannot run a `LOCAL_EXECUTION` fixture.
- `MISSING` / `BLOCKED` / `DEFER` never report SUCCESS.

## Transport refusals (kernel)

| Code | When |
| --- | --- |
| `PORTABILITY_INVALID_FIXTURE` | non-object root / malformed JSON fixture |
| `PORTABILITY_ABI_UNSUPPORTED` | ABI id/major not `spe.universal-abi.v1` / 1 |
| `PORTABILITY_NONPORTABLE_NUMBER` | NaN / Infinity |
| `PORTABILITY_TIMESTAMP_AMBIGUOUS` | local-time-only authority timestamps |
| `PORTABILITY_REQUIRED_CAPABILITY_MISSING` | fixture requires undeclared capability |

Frozen Sprint-4 detector codes (`P_*`, `X01_*`, `C07_*`, …) remain the exact negative-attribution oracle.

## Dependencies

Initial Cargo dependencies: `serde` + `serde_json` only. Any extra crate requires an in-tree justification (license, no paid service, why std is insufficient).

## Proof posture

- Historical Sprint 1–4 RED/GREEN files are immutable.
- New proofs: `sprint5_portable_kernel_{RED,GREEN}.txt`, `sprint5_cross_language_conformance.json`, `sprint5_proof_summary.json`.
- Summary status is `VERIFIED_LOCAL_PORTABLE_SUBSET` only. Not RELEASED.
