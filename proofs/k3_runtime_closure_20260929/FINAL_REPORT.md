# SPE K3 runtime closure

BASE SHA: `98632cfb712d20eb7f7f6962a09f6326d7e942f6`
FINAL SHA: `98bc160184afa0cf95f17ff23392645c16ccc516`

K3 contract source: G1R-7R `a6b7e572b66632aab3837242983afec96672c148` (`select_prompt_techniques`), kept as the existing selector by the 2026-09-24 context-grounding design. Requirement-graph inputs were not ported.

Selector version: `k3.g1r7r`
Owner: `spe_runtime/k3/selector.py` and `spe_core_rs::k3::select`
Technique count: 9
Ids: `ZERO_SHOT`, `FEW_SHOT`, `ROLE_PERSONA`, `CONTEXTUAL`, `STEP_BACK`, `DECOMPOSE_PLAN_SOLVE`, `RETRIEVE_REASON`, `CRITIQUE_REVISE`, `STRUCTURED_OUTPUT`

Python: 776 passed, 0 failed
Rust spe-core-rs: 40 passed, 0 failed
WASM sha256: `8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f`
WASM imports: 0
WASM exports: `memory`, `spe_alloc`, `spe_evaluate`, `spe_free`
Vectors: 25 normal, 15 adversarial, 0 mismatches
Parity: Python↔Rust PASS, Rust↔WASM PASS, Python↔WASM PASS
ProtectedIntent / constraints / budget / authority / provenance: unchanged
Compiler: `compile_with_k3` attaches K3 beside an unchanged execution contract
TypeScript second brain: NO
K3 mutants: 7 defined, 7 killed, 0 survived
Performance warm median / p95 / max: 0.076 ms / 0.086 ms / 2.329 ms
Official build: exit 0
Deployment gate: exit 2
Hosting: FORBIDDEN

Claim classification:

- K3_SPECIFIED
- K3_IMPLEMENTED_PYTHON
- K3_IMPLEMENTED_RUST
- K3_IMPLEMENTED_WASM
- K3_PARITY_PROVEN
- K3_COMPILER_INTEGRATED
- K3_MUTATION_TESTED_WITHIN_DEFINED_K3_SCOPE

Not claimed: repository-wide mutation framework, all XCAT, full founder plan, WORLD #1.
