# LVT-3 R2 — Preregistration (frozen before the holdout run)

Branch grok/lvt3-research-r2 (from R1 8dfb09fd; the R1 verdict NOT_PROVEN is unchanged). Builder: Grok Bot. Independent verifier: Bro.
The holdout split has NOT been executed by any config as of this commit.

## 1. Tasks
- Synthetic integer-list DSL (52 ops from spe_runtime/research/lvt3/dsl.py). Hidden verdicts come from the independent evaluator (lvt3/evaluator.py: own semantics, HMAC-signed verdicts, 12 broad hidden inputs per task).
- Family = op-name structure. Splits are disjoint by family (spe_runtime/research/lvt3r2/tasks.py, `family_plan()`).
- Family counts:
  - train: 50 (30 two-op, 20 three-op)
  - dev: 15
  - val: 20
  - **holdout: 80**
- Each dev/val/holdout family is three-op and has a kind, in the repeating pattern transfer, novel, transfer, novel, long:
  - **transfer:** contains a train two-op structure.
  - **novel:** shares no contiguous two-op sub-structure with train.
  - **long:** a transfer structure with visible inputs of length 10–12, beyond any verification envelope.
- 5 tasks per family × 3 seeds (0, 1, 2).
- **Manifest sha256** (`manifest_hash(family_plan())`): `cb07aaad7dc4fe11574adaab9d16a0b64783a7ba0e8818bedb18a744ab2b2a99`
- Agents learn on train then dev, with evaluator feedback only on those splits, and are then scored on the eval split with no feedback.

## 2. Configurations (spe_runtime/research/lvt3r2/agent.py)
- A: random search over programs of up to 3 ops; search cap 4000 executions.
- B: naive library (every declared structure, unverified, plus 1-op extensions), using the same interleaved scheduler and the **same hard per-task budget** as E_CAPPED.
- E: outcome-qualified registry (signed verdicts, fresh re-verification, envelope/transfer guard, revocation) plus extensions plus entropy probes. Uncapped library and probe cost.
- E_CAPPED: E with an interleaved library/search scheduler (`LVT3R2_CAPPED_MODE=interleave`) and a hard per-task total-execution **budget of 3335.8 = 1.2 × 2779.8**, which is A's measured mean executions per task on **val**.
- Ablations:
  - E_noguard (H11): no guard, no revocation.
  - E_randprobe (H12): random probes.
- E_shufv: qualification verdicts computed on a decoy spec (randomized-feedback control).
- Cost = every program execution (consistency checks, library candidates, probe scoring). Evaluator probes are k ≤ 4 for every config.

## 3. Endpoints and statistics
- Unit of inference: the holdout family (n = 80). Per-family score = verified success averaged over 15 tasks (5 × 3 seeds).
- **Primary:** E_CAPPED − B, paired across families. H1: mean > 0.
- Confirmatory family (Holm, α = 0.05, one-sided sign-flip permutation p-values, 20,000 permutations, RNG 20261012): {E_CAPPED − B, E_CAPPED − A, E − B}. 95% paired-t CIs are reported.
- **Minimum effect δ = 0.10** absolute verified success.
- Power: val SD of family differences (E_CAPPED − B) = 0.155. For one-sided α = 0.05/3 and 80% power, n_required = 22 families at δ = 0.10, so the planned 80 is adequate. δ = 0.05 would need about 200, which is infeasible here, so δ = 0.10 is the smallest powered effect.
- **Gates for the primary claim:** all of the following.
  - (G1) Holm rejects for E_CAPPED − B, AND its mean ≥ δ, AND its 95% CI lower bound > 0.
  - (G2) E_CAPPED mean executions per task on holdout ≤ 1.2 × A's holdout mean.
  - (G3) E_CAPPED false-success rate ≤ B's + 0.02.
  - (G4) E − E_shufv CI lower bound > 0.
  - (G5) LVT-2 mutation gate passes (30/30, harness branch grok/lvt2-mutation-harness-repair f2a0512c).
- **Secondary / descriptive (no confirmatory claim):**
  - H11: E − E_noguard overall and on long families.
  - H12: E − E_randprobe overall and on novel families.
  - Per-kind breakdowns.
  - H11 or H12 is "supported" only if the overall CI lower bound > 0.

## 4. Verdict rule (provisional until Bro replicates)
- **BLOCKED:** G5 fails, or the holdout cannot be run as specified.
- **REJECTED:** primary CI upper bound < δ (a benefit ≥ δ is ruled out), or primary CI upper bound < 0.
- **PROVEN_WITHIN_TESTED_SCOPE:** G1–G5 all pass.
- **NOT_PROVEN:** anything else.

## 5. No peeking / execution
- The holdout is run exactly once, with the code at this commit:
  `python -m spe_runtime.research.lvt3r2.run holdout evidence/lvt3r2/holdout --budget 3335.8 --expect-prereg-sha <sha256 of this file>`
  The runner refuses if this file or the lvt3r2 package is modified or uncommitted.
- Analysis command: `python -m spe_runtime.research.lvt3r2.analyze evidence/lvt3r2/holdout --delta 0.10`.

## 6. Disclosed val-stage design iterations (forking paths)
All of these used val only; holdout was untouched.
1. **Library-first budget sharing:** E_CAPPED 0.173 vs B 0.157 (budgeted); E uncapped 0.680 at 17.5k executions per task.
2. **Interleave scheduler for E_CAPPED:** 0.363.
3. **The same scheduler applied to B (fairness fix, so the primary isolates qualification and probes rather than scheduling):** B 0.317.

Val result at freeze: E_CAPPED − B = +0.047, CI [−0.026, 0.119]. E_CAPPED − A = −0.053. The builder's prior expectation is that the primary will NOT pass.

Evidence: evidence/lvt3r2/val/.
