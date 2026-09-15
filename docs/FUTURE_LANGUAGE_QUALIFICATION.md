# Future Language Qualification (NOT Sprint 4)

This document describes how non-Python SPE implementations will qualify later.
**Do NOT implement Rust / TypeScript / Kotlin / Swift / WASM runtimes in Sprint 4.**

## Qualification gates (future)

1. Consume `spe.universal-abi.v1` without semantic drift.
2. Pass `data/conformance/universal_core_v1.jsonl` (≥50 positives).
3. Pass `data/conformance/universal_negative_v1.jsonl` with **exact** reason codes.
4. Preserve `semantic_equivalent` protected fields (provenance, uncertainty, hard constraints, authority, privacy/trust).
5. Deterministic canonical JSON (UTF-8, stable enums, no language-native tuple/struct leaks).
6. Capability downgrade law: `CAPABILITY_MISSING` / `BLOCKED` / `DEFER` — never fake success.
7. Offline-first conformance: `network_mode=NONE` for the universal suite.
8. Honest platform registry status — no premature `RELEASED` / `PASS`.

## Languages (planned only)

| Language | Platform ID | Sprint 4 action |
| --- | --- | --- |
| Rust | `PLATFORM:RUST_KERNEL` | Document only |
| TypeScript | `PLATFORM:TYPESCRIPT` | Document only |
| Kotlin | `PLATFORM:KOTLIN_ANDROID` | Document only |
| Swift | `PLATFORM:SWIFT_IOS` | Document only |

## Non-goals here

Building clients, store listings, WASM kernels, MCP servers, or AI plugins.
