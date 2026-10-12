# LVT-3 Frozen Experiment Contract (H11 + H12)

Status: FROZEN before any LVT-3 code was written or run. Builder: Grok (executor). Independent verifier: Bro (not the builder).
Base: PR #147 head 9637907459334cb31d2f8e0c481baf896a9ce5a4 (antigravity/lvt2-r2-trust-root-repair). Branch: grok/lvt3-research-r1.
Scope note: the owner brief text available to the builder was truncated in places. Configurations A–E, fail conditions and thresholds below are the builder's operationalisation and are frozen as written; any mismatch with the original brief is a known limitation, not a reason to retune.

## 0. Honesty boundary
- No model weights are trained. "Learning" = admitting, guarding, reusing and revoking qualified reusable procedures (capabilities).
- All tasks are deterministic synthetic integer-list transformation programs. Results say nothing about LLM tasks, real users or production.
- ₹0: no paid APIs, no models, no network during the experiment.

## 1. Domain
Program DSL: a program is a sequence of 1–2 primitive ops applied to a list of ints. Primitives (52 instances):
add(k) k∈[-5,5]; mul(k) k∈{-3,-2,-1,1,2,3}; mod(m) m∈[2,7] (Python %); abs; neg; rev; sort; sortd; take(n) n∈[1,5]; drop(n) n∈[1,5]; rot(k) k∈[1,4] (left rotate, k mod len, empty-safe); cumsum; fgt(t) t∈[-3,3] (keep x>t); feven (keep even); dedup (stable, keep first).

Inputs:
- Visible generator (underspecified, like visible tests): 3 examples, length 3–6, distinct values in [1,9].
- Broad generator (hidden tests and probe pool): length 0–9, values in [-9,9], duplicates allowed.
- Hidden verification set: 12 broad inputs per task from the evaluator's own seed stream. Probe pool: 64 broad inputs per task from a separate seed stream; any probe input equal to a hidden input is removed.

## 2. Task families and family-level splits (20 tasks per family, params uniform over the stated ranges)
- TRAIN (feedback allowed): T1 [sort, take(n)]; T2 [add(k), rev]; T3 [mul(k), cumsum]; T4 [fgt(t), sort]; T5 [rot(k)]; T6 [mod(m), dedup]
- DEV (feedback allowed, used only for transfer qualification/revocation; NOT for tuning): D1 [sortd, take(n)]; D2 [add(k), cumsum]; D3 [abs, sort]
- HIDDEN (no feedback; primary evaluation): H1 [sort, drop(n)]; H2 [abs, rev]; H3 [add(k), rev] (in-family transfer of T2); H4 [mul(k), cumsum] (in-family transfer of T3); H5 [dedup, sort]; H6 [rot(k)] (in-family transfer of T5)
Transfer subset = {H3, H4, H6}. Trap subset (visible distribution cannot distinguish from a simpler program) = {H2, H5}.

## 3. Ground truth and independence
- Generator module samples (family, params) and visible inputs; it never computes hidden verdicts.
- Evaluator module has its OWN reference implementation of every primitive (does not import the solver's interpreter), its own seed stream, and is the only source of: hidden verdicts, probe answers, and train/dev outcome feedback.
- A task is VERIFIED_SUCCESS iff the declared program's outputs equal the evaluator's reference outputs on all 12 hidden inputs.

## 4. Configurations (matched budgets: every config gets the same per-task compute cap of 4000 executions and exactly k=4 oracle probes)
Common loop: find a candidate consistent with all known examples → spend probes one at a time → if a probe answer contradicts the candidate, add it as an example and resume search → after probes are spent (or cap reached), declare the current consistent candidate (or ABSTAIN if none).
- A — Base search: random-order enumeration of the full DSL (seeded), random probes. No memory.
- B — Naive memory: A + library of every declared program (unverified, unguarded, grows in all phases incl. hidden); library programs tried first.
- C — Outcome-qualified library: a structure (op names without params) is admitted after ≥2 verified train/dev successes and success ratio ≥0.8; reuse = param-only search inside admitted structures (most-supported first) before full search; random probes; no guard, no revocation.
- D — H11 joint qualification: C + (i) applicability guard = qualified input envelope (max length, negatives seen, duplicates seen) plus "capability candidate must survive all probes", (ii) transfer qualification on DEV (per-structure transfer record), (iii) revocation when failures ≥2 and success ratio <0.7; random probes.
- E — H11 + H12: D, but each probe is chosen from the pool to maximise the prior-weighted entropy of predicted outputs over the counterfactual rival set = {current candidate} ∪ {param fits of every admitted structure consistent with known examples} ∪ {all single-edit mutations of the candidate consistent with known examples}. Rival generation executions count toward compute cost.
- E_shuf — randomized-feedback control: E where every evaluator feedback used for admission/revocation and every probe answer is replaced by the answer of a different, randomly chosen task's ground-truth program.

## 5. Metrics (computed per seed on HIDDEN tasks; 120 tasks per seed)
1. verified success rate
2. false-success acceptance = declared ∧ hidden-fail / declared
3. randomized-feedback control gap = E − E_shuf verified success
4. transfer = verified success on {H3,H4,H6}
5. cost per verified success = total executions (search + rival generation) / verified successes
6. stability = SD across seeds
Also reported: abstain rate, trap-subset success, DEV metrics (descriptive only).

## 6. Statistics
- 10 seeds (0–9). Per-seed metric values. Paired differences across seeds.
- 95% CI: Student t (df=9, t=2.262) on paired differences, and percentile bootstrap (10,000 resamples of seeds, fixed RNG 12345). Both reported; decisions use the t-interval.

## 7. Decision rule (frozen)
QUALIFIED_WITHIN_TESTED_SCOPE only if ALL hold:
 (Q1) E − max(A,B,C,D) verified success: 95% CI lower bound > 0 (vs each baseline separately);
 (Q2) E false-success acceptance ≤ each of A–D (CI upper bound of E − X ≤ 0.02);
 (Q3) E − E_shuf verified success CI lower bound > 0;
 (Q4) E transfer subset success ≥ A transfer success (CI upper bound of A − E ≤ 0.02);
 (Q5) E cost per verified success ≤ 1.2 × A's (mean over seeds);
 (Q6) all qualifier mutation tests (forged / leaky / overfit / revoked-reuse) pass.
FAIL if any: E verified success significantly below A (CI upper < 0); E false-success significantly above A (CI lower > 0); any mutation test fails; E_shuf ≥ E with CI lower of (E_shuf − E) > 0.
Otherwise NOT_PROVEN. Component claims: H11 supported iff D − C CI lower > 0 on verified success or C − D CI lower > 0 on false-success; H12 supported iff E − D CI lower > 0 on verified success or D − E CI lower > 0 on false-success.

## 8. Prohibited after freeze
No change to families, splits, generators, budgets, k, thresholds, seeds or decision rule after the contract commit. Bugs found after the run are fixed and the whole run is re-executed and both runs are reported.
