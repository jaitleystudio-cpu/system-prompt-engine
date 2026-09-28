# SPE requirement graph closure

Status: `REQUIREMENT_GRAPH_CLOSURE_PASS`

Base: `ae54a1a5a17d8d568b00e94f3d128d2858c60fd8`

Contract source: G1R-3 `3f0847d`, unchanged at G1R-7R `a6b7e57`.
Version: `requirement_graph.g1r3`
Owner: `spe_runtime.requirements.project.build_requirement_graph`

Node type: `RequirementAtom` with kinds `MUST`, `MUST_NOT`, `SHOULD`, `PREFERENCE`.
Edge type: `CONFLICTS_WITH`.

Graph vectors: 30 normal, 20 adversarial, 0 mismatches.
Parity: Python↔Rust 0, Rust↔WASM 0, Python↔WASM 0.

ProtectedIntent unchanged. Hard constraints preserved. Budget preserved. Provenance preserved.
Invented requirements 0. Invented facts 0. Unknown laundering 0. Silent contradiction resolution 0.

Graph mutants 10/10 killed.
K3 uses the canonical graph. Existing K3 mutants 7/7 killed.
TypeScript does not own graph semantics.

WASM previous pre-graph K3: `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f`
WASM new: `9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686`
Two-path reproducible: yes. Imports 0. Exports unchanged.

Official build exit 0.
Unexpected egress: none.
Deployment gate exit 2.
Hosting forbidden.

`PORTABLE_GRAPH_BINDING = DEFERRED_BY_SCHEMA`

Stopped before K3 strategy-effect binding, missing category engines, quality-delta, Plan B, VALIDATE_ONLY, Massive Intent, MCP, and the inline assistant.
