# SPE Ω — Reality-Bound Proof Dividend (RBPD) Design Specification

- **Document ID**: `SPE-SPEC-RBPD-2026-10-11`
- **Status**: `RESEARCH_QUARANTINE_PROTOTYPE`
- **Target Branch**: `antigravity/lvt2-r2-trust-root-repair` (PR #147) / `antigravity/rbpd-reality-bound-proof-dividend-r1`
- **Quarantine Scope**: `spe_runtime/research/rbpd/`, `tests/research/rbpd/`
- **Frozen Boundaries Respected**: `portable/spe-core-rs/`, `apps/web/public/spe_wasm.wasm`, `SPE-SPEC`, `PARALLEL_OWNERSHIP_MAP.json`

---

## 1. Problem Statement & First-Principles Diagnosis

Conventional AI verification and prompt/program qualification pipelines suffer from two symmetric failure modes:

1. **Stateless Re-Verification Tax (`FULL_RERUN`)**: Every localized code, prompt, or environment edit discards prior verification work and re-runs the entire test/oracle suite from scratch. Verification cost scales as $\mathcal{O}(|\text{History}| \times |\text{Suite}|)$, making rigorous formal/empirical qualification economically unviable in iterative engineering loops.
2. **Unsafe Caching & Proxy Goodhart Collapse (`ACTIVE_ONLY` / Unsound Reuse)**: Systems that cache prior test passes without formal dependency tracking silently reuse stale proofs across invalidated assumptions or model revisions. Conversely, systems that rely purely on active adaptive probe selection (`ACTIVE_ONLY`) optimize against their own selector prior, creating a Goodhart blind spot where generator adaptations pass the chosen probes while regressing on the broader task distribution.

**The Reality-Bound Proof Dividend (RBPD)** resolves this dilemma by turning verified evidence into a **cryptographically bound, selectively invalidatable, and Goodhart-resistant capital asset**:
- **Reality-Bound**: Every evidence asset is anchored to an owner-attested `LearningValidator` root of trust, an independent external oracle attestation (`OracleAttestation`), a verified model/runtime digest (`VERIFIED_MODEL_REVISION`), and explicit requirement/assumption hyperedges.
- **Proof Dividend**: When a localized change occurs, SPE computes the exact causal invalidation cone over the `CausalProofGraph` and `ObligationHypergraph`. Unaffected subgraphs reuse their verified receipts at $\mathcal{O}(1)$ cryptographic check cost, while invalidated subgraphs are re-qualified using a dual-channel witness selector (Channel A counterfactual EIG probes + Channel B sealed stratified random witnesses).
- **Epistemic Honesty**: Every claim is classified into a strict four-state epistemic lattice (`VALID`, `INVALID`, `STALE`, `UNKNOWN`). When initial proof construction cost exceeds single-change savings or when a root assumption changes globally, RBPD honestly reports a negative net dividend and refuses to claim a speedup.

---

## 2. Reused Canonical Owners & Anti-Sprawl Architecture

RBPD introduces **zero duplicate semantic engines, zero parallel authority registries, and zero duplicate Gilden workers**. It composes existing SPE canonical owners:

| Capability | Canonical Owner Reused | Integration Role in RBPD |
|---|---|---|
| Requirement & Intent Atoms | `spe_runtime/requirements/` (`ProtectedIntent`, `RequirementAtom`, `ConstraintAtom`) | Defines atomic requirement obligations bound into each `RealityBoundEvidenceAsset`. |
| Causal Dependency DAG | `spe_runtime/proof_graph/` (`CausalProofGraph`, `CausalClaim`, `CausalEvidence`) | Tracks claim-to-evidence dependencies and computes invalidated downstream slices on mutation. |
| Obligation Hypergraph | `spe_runtime/research/wdes/hypergraph.py` (`ObligationHypergraph`, `RequirementNode`, `EnvironmentNode`, `ProofHyperedge`) | Maps multi-requirement and environment assumption hyperedges for slice extraction. |
| Continuation & Specialization | `spe_runtime/research/wdic_vct/` (`WDICSpecializer`, `WDICContinuationEngine`, `CertificateState`) | Tracks residual obligations and continuation state across incremental edits. |
| Active Counterfactual Probes | `spe_runtime/research/csc/` (`ProbeOptimizer`, `AssumptionVerifier`, `OracleQualifier`, `EnvironmentAssumption`) | Supplies Channel A EIG-maximizing probes and assumption drift checks. |
| Trust Root, Receipts & Tombstones | `spe_runtime/research/lvt/` (`LearningValidator`, `LearningTransferProtocol`, `StudyProtocol`, `run_study`) | Enforces owner-root authority, Ed25519 RFC 8785 receipts, durable revocation tombstones, and cross-model non-inheritance. |
| Portable Artifact Container | `spe_runtime/spe_package/` (`SpePackage`, `spe_artifact`) | Packages verified RBPD assets with detached signatures and digest manifests. |
| Authority Enforcement | `spe_runtime/authority/` (`AuthorityGrant`, `RuntimeEnforcer`) | Enforces explicit authority grants for validator/oracle operations. |
| Cross-Runtime Conformance | `tools/sprint5_conformance.py` (`run_python_reference_case`, `run_rust_case`, `run_wasm_case`) | Verifies deterministic decision parity across Python, native Rust (`spe-core-eval`), and WASM (`spe_wasm.wasm`). |

---

## 3. Phase A — Reality-Bound Evidence Asset Contract (`spe_runtime/research/rbpd/contract.py`)

### 3.1 16-Field `RealityBoundEvidenceAsset` Schema
Every `RealityBoundEvidenceAsset` is a frozen, RFC 8785-canonicalizable dataclass containing all 16 mandatory fields:

1. `asset_id: str` — Unique deterministic identifier for the evidence asset.
2. `claim_id: str` — Identifier of the `CausalClaim` / `LearningClaim` supported by this asset.
3. `subject_digest: str` — 64-hex SHA-256 digest of the target code/prompt/configuration slice.
4. `requirement_atoms: Tuple[str, ...]` — Sorted tuple of `RequirementAtom` IDs covered by this asset.
5. `assumption_boundaries: Dict[str, Any]` — Explicit environment/assumption predicates (`EnvironmentAssumption` bounds).
6. `proof_slice_digest: str` — 64-hex SHA-256 digest of the `CausalProofGraph` / `ObligationHypergraph` subgraph.
7. `witness_protocol_digest: str` — 64-hex SHA-256 digest of the `StudyProtocol` and dual-channel witness parameters.
8. `oracle_identity: str` — Registered identifier of the independent external oracle.
9. `oracle_class: str` — Must be `"independent_static_oracle"` or `"independent_reality_witness"` (self-certification is rejected).
10. `model_or_runtime_digest: str` — 64-hex SHA-256 digest of the verified model revision or runtime binary.
11. `model_digest_type: str` — `"VERIFIED_MODEL_REVISION"` or `"SYNTHETIC_NAME_DERIVED"` (synthetic digests cannot qualify as verified revisions).
12. `validity_horizon: float` — Unix timestamp expiration horizon (`> committed_timestamp`).
13. `invalidation_triggers: Tuple[str, ...]` — Explicit trigger predicates (`SUBJECT_DIGEST_CHANGED`, `ASSUMPTION_VIOLATED`, `MODEL_REVISION_CHANGED`, `ORACLE_UNTRUSTED`, `TOMBSTONE_REVOKED`).
14. `revocation_tombstone_ref: str` — Reference key for durable tombstone lookup (`tx:{asset_id}` / `receipt_hash`).
15. `receipt_hash: str` — 64-hex SHA-256 digest of the RFC 8785 canonical asset payload.
16. `signature: str` — 128-hex Ed25519 signature over the canonical payload produced by an owner-authorized `LearningValidator`.

### 3.2 Four-State Epistemic Status (`EpistemicStatus`)
`ProofContractValidator.validate_asset(...)` evaluates an asset against current reality context and returns one of four mutually exclusive statuses:
- `VALID`: Cryptographic signature, owner authority, trusted oracle binding, non-tombstoned status, verified model revision identity, unbroken assumption boundaries, matching subject/slice digests, and unexpired horizon all hold.
- `INVALID`: Forged/corrupted signature, unauthorized validator, untrusted or self-certifying oracle, synthetic model digest disguised as `VERIFIED_MODEL_REVISION`, or durable revocation tombstone present.
- `STALE`: Asset was previously `VALID` (authentic signature and non-tombstoned), but its `validity_horizon` has expired or its `subject_digest`, `proof_slice_digest`, `assumption_boundaries`, or `model_or_runtime_digest` no longer match the current system state.
- `UNKNOWN`: No evidence asset exists for the obligation, or external qualification gates (`EXTERNAL_MODEL_QUALIFICATION`, `G6_H_BLINDED_HUMAN_EVALUATION`) remain unexecuted.

---

## 4. Phase B — Sound Invalidation & Selective Re-Qualification (`spe_runtime/research/rbpd/invalidation.py`)

`SelectiveRequalificationEngine` binds `RealityBoundEvidenceAsset` instances to nodes in `CausalProofGraph` and hyperedges in `ObligationHypergraph`:

1. **Dependency Slice Hashing**: Each obligation node $u$ has a local subject digest $H_{\text{local}}(u)$ and a transitive slice digest $H_{\text{slice}}(u) = \text{SHA256}(H_{\text{local}}(u) \parallel \{H_{\text{slice}}(v) : v \in \text{Deps}(u)\} \parallel H_{\text{assumptions}}(u))$.
2. **Exact Invalidation Cone**: Given a mutation event $\Delta$ (code/prompt diff, assumption drift detected by `AssumptionVerifier`, model revision change, oracle key rotation, or tombstone revocation):
   - Any asset whose `revocation_tombstone_ref` or `receipt_hash` is tombstoned transitions immediately to `INVALID`.
   - Any node $u$ directly touched by $\Delta$ or transitively dependent on a touched node/assumption has a changed $H_{\text{slice}}(u)$, transitioning its bound asset from `VALID` to `STALE`.
   - All nodes $w$ outside the causal cone retain an identical $H_{\text{slice}}(w)$, allowing their `VALID` assets to be reused without re-running external oracle probes.
3. **Monotonicity & Conservatism Invariant**: If an obligation's dependency state is ambiguous or missing from the graph, `SelectiveRequalificationEngine` marks it `UNKNOWN` and forces full qualification—never reusing across an unverified boundary.

---

## 5. Phase C — Goodhart-Resistant Reality Witness Selection (`spe_runtime/research/rbpd/witness_selector.py`)

To prevent adaptive selector overfitting (Goodhart's Law) while minimizing reverification cost on `STALE` obligations, `DualChannelWitnessSelector` combines two orthogonal witness streams:

1. **Channel A — Active Counterfactual Probes (`CSC` `ProbeOptimizer`)**:
   - Ranks candidate witnesses covering the `STALE`/`UNKNOWN` obligation slice by Expected Information Gain (EIG) per unit cost, prioritizing high-failure-prior boundary probes.
2. **Channel B — Sealed Independent Reality Witnesses (`SealedIndependentSampler`)**:
   - Enforces a hard floor (`sealed_witness_fraction >= 0.25`, `min_sealed_families >= 3` per incremental batch) drawn via deterministic HMAC-SHA256 stratified sampling seeded by `(parent_receipt_hash, edit_commit_digest, epoch_nonce)` from a sealed held-out family pool.
   - The active selector and prompt/code generator cannot exclude or re-weight Channel B witnesses.
3. **Anti-Goodhart Detection**:
   - Computes the generalization gap $\Delta_{\text{Goodhart}} = \text{Score}(\text{Channel A}) - \text{Score}(\text{Channel B})$.
   - If Channel A passes while Channel B fails or exhibits a statistically significant divergence ($\Delta_{\text{Goodhart}} > \tau_{\text{Goodhart}}$), the selector flags `GOODHART_DIVERGENCE_DETECTED`, blocks promotion to `VALID`, and triggers revocation/escalation.

---

## 6. Phase D — Lifecycle Proof-Dividend Benchmark (`spe_runtime/research/rbpd/dividend_benchmark.py`)

`ProofDividendBenchmark` evaluates the four strategies (`FULL_RERUN`, `RANDOM_ONLY`, `ACTIVE_ONLY`, `RBPD_DUAL_CHANNEL`) across a multi-step engineering lifecycle:

### 6.1 Full Lifecycle Cost Accounting (`LifecycleCostLedger`)
$$\text{Cost}_{\text{total}} = C_{\text{init\_proof}} + \sum_{t=1}^{T} \left( C_{\text{invalidation}}(t) + C_{\text{witness\_select}}(t) + C_{\text{reverify}}(t) + C_{\text{receipt\_verify}}(t) \right)$$

### 6.2 Primary Metrics
- **Verified Outcome Efficiency (VOE)**: $\text{VOE} = \frac{\text{Verified Correct Outcomes}}{\text{Cost}_{\text{total}}}$.
- **Incremental Reverification Reduction**: $1 - \frac{C_{\text{RBPD, incremental}}}{C_{\text{FULL\_RERUN, incremental}}}$.
- **False-Reuse / Escaped-Defect Rate**: Fraction of injected real regressions or Goodhart proxy traps missed by the strategy (must be `0.0` for `RBPD_DUAL_CHANNEL`).
- **Net Dividend Gate & Negative Control**:
  - On localized incremental edits ($T \ge 5$ steps over a modular obligation graph), `RBPD_DUAL_CHANNEL` achieves $\ge 90\%$ incremental reverification cost reduction after amortizing $C_{\text{init\_proof}}$, with $0$ escaped defects (whereas `RANDOM_ONLY` misses localized boundary bugs and `ACTIVE_ONLY` misses sealed-distribution Goodhart regressions).
  - **Mandatory Negative Control**: In a single-shot or global root-assumption mutation scenario where $C_{\text{init\_proof}} + C_{\text{invalidation}} + C_{\text{reverify}} \ge C_{\text{FULL\_RERUN}}$, `ProofDividendBenchmark` outputs `net_dividend_positive = False` and `claim_status = "NO_DIVIDEND_CLAIMED"`.

---

## 7. Phase E — Cross-Runtime & Cross-Model Portability (`spe_runtime/research/rbpd/dividend_benchmark.py`)

`PortabilityVerifier` enforces two strict portability invariants:
1. **Cross-Runtime Decision Conformance (Python / Rust / WASM)**:
   - Invokes `tools/sprint5_conformance.py` (`run_python_reference_case`, `run_rust_case`, `run_wasm_case`) on canonical admission/obligation vectors derived from the RBPD proof slice, verifying bit-for-bit verdict parity (`PASS` / `HOLD` / `FAIL` and identical obligation sets) across Python, native Rust (`spe-core-eval`), and WebAssembly (`spe_wasm.wasm`).
2. **Cross-Model Non-Inheritance (`LVT` Integration)**:
   - When `target_model_id != source_generator` or `model_or_runtime_digest` changes, `PortabilityVerifier` marks the asset `STALE` for the new model and requires an authenticated `LearningTransferProtocol.evaluate_cross_model_transfer` receipt before any reuse is permitted on the target model.

---

## 8. Product Human Interface (`spe_runtime/research/rbpd/explain.py` & `cli.py`)

`explain_proof_dividend(report)` and `python -m spe_runtime.research.rbpd.cli` produce a deterministic, human-readable audit report and JSON summary with five explicit sections:
1. **ESTABLISHED (`VALID`)**: Obligations backed by verified cryptographic receipts and reality witnesses.
2. **REUSED (Proof Dividend)**: Unchanged dependency slices reused at $\mathcal{O}(1)$ receipt-verification cost, with exact cost savings.
3. **REVERIFIED (`STALE` -> `VALID` / `INVALID`)**: Invalidated slices re-tested via Channel A (counterfactual EIG) + Channel B (sealed stratified witnesses), including any caught regressions or Goodhart traps.
4. **UNKNOWN / HELD (`UNKNOWN` / `HOLD`)**: Unverified obligations and held external gates (`EXTERNAL_MODEL_QUALIFICATION`, `G6_H_BLINDED_HUMAN_EVALUATION`).
5. **WHY (Causal & Epistemic Rationale)**: Concrete trigger trace explaining every invalidation, reuse decision, and negative-control refusal.
