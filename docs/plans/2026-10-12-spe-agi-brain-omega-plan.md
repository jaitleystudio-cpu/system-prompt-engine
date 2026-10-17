# SPE AGI BRAIN Ω — Frontier-Science Architecture Plan
**October 12, 2026 | Approved Research Specification & Prototype (Quarantine Track)**

---

## 1. Executive Summary & Core Objective

The mission of **SPE AGI BRAIN Ω** is to upgrade System Prompt Engine Pro from a prompt optimization utility into a frontier-science invention and problem-solving platform. Rather than merely rearranging existing knowledge into persuasive prose, SPE AGI BRAIN Ω is designed to **create, test, and transfer new scientific knowledge**.

### The 6 Interacting Forms of Intelligence
1. **Intelligence I: Scientific Knowledge Reconstruction**: Reconstructs assumptions, boundary conditions, citation chains, and points of theoretical divergence where predictions disagree.
2. **Intelligence II: Executable Scientific World Models**: Constructs executable simulations, symbolic Lean 4 constraints, and differential equation models, strictly distinguishing simulation predictions from independent observations.
3. **Intelligence III: Open-Ended Scientific Imagination**: Deploys 12 distinct invention strategies (contradiction-driven, cross-domain transfer, inverse design, first-principles, evolutionary, neuro-symbolic, causal intervention, constraint relaxation, boundary search, representation discovery, compositional, counterexample-guided).
4. **Intelligence IV: Mathematical & Experimental Verification**: Enforces mechanical proof checks (Lean 4), property-based execution testing, and truth conservation (strictly preserving `UNKNOWN` when unproven; 0 false PASS).
5. **Intelligence V: Learning How to Discover**: Meta-learns scientific search policies across problems and evaluates transfer on unseen task families.
6. **Intelligence VI: Controlled Self-Improvement**: Evaluates modifications to search policies and experiment selection in isolated sandboxes while strictly locking semantic and authority boundaries against self-modification.

---

## 2. Core Mathematical Invariants

### 1. The Discovery Utility Objective
$$\operatorname{Utility}(e) = \frac{\mathbb{E}[\Delta K_{\text{verified}}] + \lambda \mathbb{E}[\Delta T_{\text{transfer}}]}{C_{\text{compute}} + C_{\text{measurement}} + C_{\text{human}}} - R_{\text{false acceptance}}$$
* **$\Delta K_{\text{verified}}$**: Increase in independently supported, non-self-certified scientific knowledge.
* **$\Delta T_{\text{transfer}}$**: Statistically validated improvement on holdout task families.
* **$R_{\text{false acceptance}}$**: Heavy penalty for ungrounded claims or hallucinated successes.
* **Cost Terms**: Denominated in exact integer `NanoUSD` ($10^9 \text{ nanos} = \$1.00$).

### 2. DeepWriter 100,000-Word Hierarchical Generation Law
* **Single Instruction Entry**: One user prompt triggers a persistent generation job.
* **Context Decomposition**: Hierarchical outline $\to$ Section dependency graph $\to$ Chapter generation $\to$ Cross-chapter consistency graph $\to$ Citation & provenance classification (Verified / Cited / Proposed / Theoretical / Speculative).
* **Downstream Delivery**: Complete document compiled into `.spe` artifact, with provider-specific distilled prompt for downstream models.

### 3. Gilden 24/7 Autonomous Maintenance Law
* Observability $\to$ Gilden Job Engine $\to$ issue diagnosis $\to$ SPE research $\to$ candidate fix $\to$ isolated testing $\to$ policy approval $\to$ audit receipt.
* Reversible, non-destructive, spending-capped, zero unprompted credential or production mutations.

---

## 3. Work Breakdown & Implementation Schedule

- [x] **Phase 1: Architecture Specification & Master Prompt**: Record ADR and Master System Prompt in `docs/spec/SPE_AGI_BRAIN_OMEGA_MASTER_PROMPT.md`.
- [x] **Phase 2: Core Kernel Modules (`spe_runtime/research/agi_brain/`)**:
  - `types.py`: Typed definitions, exact integer NanoUSD.
  - `knowledge_reconstruction.py`: Assumptions, gap analysis, theoretical divergence.
  - `scientific_world_models.py`: Executable physics/math/code simulations vs observations.
  - `scientific_imagination.py`: 12 invention strategies and feasibility scoring.
  - `experimental_verification.py`: Lean 4 / property verifiers, truth conservation.
  - `discovery_learning.py`: Search policy meta-learning and holdout transfer.
  - `controlled_self_improvement.py`: Sandboxed self-adaptation under immutable gates.
  - `objective.py`: NanoUSD discovery utility calculator.
  - `long_horizon_writer.py`: 100k-word hierarchical planner & compiler.
  - `gilden_ops_bridge.py`: 24/7 autonomous maintenance monitor.
  - `prompt_contract.py`: 6-stage scientific prompt compiler.
  - `engine.py`: Unified `SpeAgiBrain` orchestrator.
- [x] **Phase 3: Adversarial Test Battery (`tests/research/agi_brain/`)**:
  - 10 targeted test modules covering all 6 intelligences, 12 strategies, 100k writer, Gilden ops, and the 5-arm comparative benchmark trial.
- [x] **Phase 4: Web UI Upgrade & Static Verification**:
  - `apps/web/src/engine/SpeAgiBrainStudio.tsx` & CSS.
  - Copy check clean (`tools/copy-check.mjs`).
  - TypeScript clean (`tsc --noEmit`).
  - Pinned WASM SHA256 invariant verified.
