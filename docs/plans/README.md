# SPE Architecture & Engineering Plans

Index of master engineering plans, upgrade proposals, and mathematical specifications for the **System Prompt Engine (SPE)**.

---

## Active & Upcoming Plans

| Plan File | Scope / Focus | Status | Target Date |
| :--- | :--- | :--- | :--- |
| [**`2026-10-09-wpem-witness-preserving-execution-morphing-plan.md`**](./2026-10-09-wpem-witness-preserving-execution-morphing-plan.md) | **Witness-Preserving Execution Morphing (WPEM)**: Computational elasticity under hard semantic invariants. Dynamic graph rewriting across models, deterministic programs, and hardware backends under thermal/memory pressure. | **Approved Research Candidate (Quarantine)** | October 2026 |
| [**`2026-10-09-csc-counterfactual-specification-closure-plan.md`**](./2026-10-09-csc-counterfactual-specification-closure-plan.md) | **Counterfactual Specification Closure (CSC)**: From self-improving to self-challenging intelligence. Dual competing searches (WDIC Forward vs CSC Adversarial), evidence-compatible world pairs, and distinguishing probe optimization. | **Approved Research Candidate (Quarantine)** | October 2026 |
| [**`2026-10-09-wdes-evidence-supercompiler-plan.md`**](./2026-10-09-wdes-evidence-supercompiler-plan.md) | **Witness-Directed Evidence Supercompiler (WDES)**: Unifies Paper 1 (BWFS) & Paper 2 (WDIC) with C4P-X+ Counterfactual Envelopes and PCSC Continuations. | **Implemented in Research Quarantine (12/12 Tests Passing)** | October 2026 |
| [**`2026-10-09-spe-planetary-monopoly-harness-plan.md`**](./2026-10-09-spe-planetary-monopoly-harness-plan.md) | **Whole-Harness Supercompiler (WHS) & Planetary Monopoly**: Hybrid local-device-first switchboard ($0 local engine vs 2PC cloud escrow) & 10/10 Worldwide Standard Gap Roadmap. | **Approved for Build** | October 2026 |
| [**`2026-10-07-spe-v1.4-blockbuster-upgrade.md`**](./2026-10-07-spe-v1.4-blockbuster-upgrade.md) | **SPE v1.4 Blockbuster Upgrade Plan**: Core production runtime stabilization, entitlement, and mutation defenses. | **Completed & Passing (751/751 Unit Tests)** | October 2026 |

---

## Governance & Verification Standards

1. **Strict Research Isolation**: Research prototypes and theoretical extensions must remain quarantined under `spe_runtime/research/` and `tests/research/` until passing red-team and fleet qualification.
2. **Deterministic-First Principle**: Deterministic probes and local computation ($0 tokens) must always take precedence over stochastic cloud model inference.
3. **Exact Integer Accounting**: All financial transactions, token ledgers, and escrow pools must be denominated in integer `NanoUSD` ($10^9\text{ nanos} = \$1.00\text{ USD}$).
4. **Kleene 3-Valued Qualification**: No safety-critical obligation can be marked fulfilled while in the `UNKNOWN` state.
