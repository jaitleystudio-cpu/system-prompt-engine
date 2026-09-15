# Universal Platform Roadmap (Sprint 4)

Status legend used in this document:

| Status | Meaning |
| --- | --- |
| **IMPLEMENTED** | Code exists in-repo for the contract surface |
| **CONFORMANCE-PROVEN** | Passing universal conformance suite with proofs |
| **PLANNED** | Declared in registry; not implemented |
| **STORE-PENDING** | Future store packaging; not started |

Sprint 4 delivers the **Universal SPE ABI + conformance harness only**.  
No Android / iOS / desktop / web / PWA / extension / Rust kernel / WASM / MCP / AI plugin apps.

## Platform registry (honest)

| Platform ID | Status | Conformance | Notes |
| --- | --- | --- | --- |
| `PLATFORM:PYTHON_REFERENCE` | IMPLEMENTING / CONFORMANCE_PARTIAL | PARTIAL | ReferenceRuntime adapter over existing SPE; Sprint 4 proofs |
| `PLATFORM:RUST_KERNEL` | PLANNED | NOT_RUN | Future language qualification — do not implement in S4 |
| `PLATFORM:TYPESCRIPT` | PLANNED | NOT_RUN | Future language qualification — do not implement in S4 |
| `PLATFORM:KOTLIN_ANDROID` | PLANNED | NOT_RUN | Store client — forbidden in Sprint 4 |
| `PLATFORM:SWIFT_IOS` | PLANNED | NOT_RUN | Store client — forbidden in Sprint 4 |
| `PLATFORM:WASM` | PLANNED | NOT_RUN | Forbidden in Sprint 4 |
| `PLATFORM:DESKTOP_NATIVE` | PLANNED | NOT_RUN | Forbidden in Sprint 4 |
| `PLATFORM:WEB_PWA` | IMPLEMENTING / CONFORMANCE_PARTIAL | PARTIAL | Sprint 6 Web/PWA foundation (not released; not_a_release=true) |
| `PLATFORM:BROWSER_EXTENSION` | PLANNED | NOT_RUN | Forbidden in Sprint 4 |
| `PLATFORM:MCP_SERVER` | PLANNED | NOT_RUN | Forbidden in Sprint 4 |
| `PLATFORM:AI_PLUGIN` | PLANNED | NOT_RUN | Forbidden in Sprint 4 |

**Law:** never mark unimplemented platforms `RELEASED` or conformance `PASS`.

## Sprint 4 implemented surfaces

- `schemas/spe_universal_abi.schema.json` — **IMPLEMENTED**
- `spe_runtime/portability/*` — **IMPLEMENTED** (Python reference)
- `data/conformance/universal_*` — **IMPLEMENTED** + suite-exercised
- Offline validation / conformance (`network_mode=NONE`) — **CONFORMANCE-PROVEN** (Sprint 4 proofs)
- Non-Python language runtimes — **PLANNED** only (see `docs/FUTURE_LANGUAGE_QUALIFICATION.md`)
- Store clients — **STORE-PENDING**

## Out of scope (explicit)

Android, iOS, desktop, web, PWA, browser extension, Rust kernel, WASM, MCP server apps, AI plugin apps, paid APIs, paid packages, hosting.
