# Sprint 4 — Universal Portability + Conformance

- ABI: `spe.universal-abi.v1` (MAJOR/MINOR/PATCH) + `abi_compatible`
- Package: `spe_runtime/portability/` (+ `oracle.py` independent detector)
- ReferenceRuntime wraps existing XCAT/categories without changing handoff semantics
- Conformance data under `data/conformance/` (protected_semantics in manifest)
- Proofs: `sprint4_portability_RED.txt`, `sprint4_portability_GREEN.txt`
- Merge-gate: `sprint4_merge_gate_REVIEW_FAIL.txt` → `sprint4_merge_gate_GREEN_fresh.txt`
- `not_a_release=true`
- COST: paid=NO, APIs=NO, hosting=NO, ₹0
- Lineage: NEW_IMPLEMENTATION
