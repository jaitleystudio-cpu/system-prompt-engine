# Master audit delta (K3 rows only)

Parent tree: `98632cfb712d20eb7f7f6962a09f6326d7e942f6`.
Audit source for the old status: `b66bc23` `proofs/spe_master_audit_20260928/03_GAP_MAP.md` and `04_CLAIM_EVIDENCE_GRAPH.md` (not present as files on this branch).

| Topic | OLD STATUS | NEW STATUS | EVIDENCE | REMAINING GAP |
|---|---|---|---|---|
| K3 sole prompt-technique selector | SPECIFIED_ONLY | IMPLEMENTED | `select_prompt_techniques`; Rust `k3::select`; WASM `spe_api=k3`; `tests/unit/test_k3_runtime.py` | Web passes the explicit display label and empty task flags. It does not infer technique flags from prose. |
| Second selector cannot override | absent | TESTED | `CANONICAL_SELECTOR`; TypeScript transport returns ids or `[]`; `render.ts` does not invent a technique list | — |
| Cross-runtime parity for K3 | none | PROVEN for the 40 K3 vectors | `PARITY_RESULTS.md` | Existing non-K3 parity rows were not re-audited as a new claim |
| K3 proof / evidence | none | PRESENT | `proofs/k3_runtime_closure_20260929/` | Not a repository-wide mutation framework |
| Provider-portable K3 output | unspecified on this tree | JSON sidecar, not a provider adapter | `compile_with_k3` does not change `ExecutionContract`; no new provider | `.spe` still has no technique-selection slot, by the frozen identity split |
| XCAT C04 C05 C08–C12 | missing | UNCHANGED | `NO_SELECTION` / `xcat_implemented: false` | Still not implemented |

Missing category engines, Requirement Graph, quality-delta, Plan B, VALIDATE_ONLY, Massive Intent, and MCP were not promoted.
