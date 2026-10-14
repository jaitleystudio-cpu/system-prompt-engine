# CRC-1 R3 — Feasible risk target (alpha=0.08) + KS shift gate: results

Contract: docs/crc1/CONTRACT_R3.md (prereg commit 56bb0284, sha256 0a168d53…a2fb), pushed before code e8bacd24.
Tests 11/11 pass; mutation gate 9/9 killed on first run (evidence/crc1/r3/tests_and_mutation_gate.txt).
Synthetic DGP only, Grok box (Mac mini offline), no LLM/Ollama, ₹0. Two independent runs: summary.json byte-identical
(sha256 b6d21fdc…0c7f). delta = 0.10, KS gate p < 0.01.

## Verdicts (primary: n_cal = 500, 1000 draws)
| hypothesis | verdict | basis |
|---|---|---|
| H1 validity of ltt_r0_a08 (target 0.08) | SUPPORTED | violation 0.023, CP95 [0.015, 0.034] <= 0.10 |
| H2 coverage >= 0.85 x oracle(0.08) | REFUTED | 0.303x, bootstrap one-sided 95% [0.283, 0.323]; UB < 0.85 |
| H3 beats previous best (:= H1 and H2) | NO | raw coverage a08 0.108 vs a10 0.213; paired a08-a10 -0.105 (UB -0.099) |
| H4 shift gate | SUPPORTED | gated arm violation 0.001 [0.00003, 0.0056], abstain-all 0.998 (CP [0.993, 1.000]) |
| Overall (H1 & H2 & H4) | NOT_PROVEN | H2 refuted |

## Oracle coverage by risk target (base population; shift population in brackets)
| r | 0.06 | 0.07 | 0.08 | 0.09 | 0.10 |
|---|---|---|---|---|---|
| coverage | 0.256 [0.099] | 0.304 [0.150] | 0.358 [0.186] | 0.397 [0.215] | 0.439 [0.250] |
| oracle risk | 0.0587 | 0.0678 | 0.0795 | 0.0884 | 0.0983 |
The 0.08 oracle sits at risk 0.0795, i.e. 0.0005 under the alpha=0.08 null, exactly the R0 boundary structure moved down.
Planner (r2.n_needed, power 0.8): at risk 0.0795 with alpha 0.08 -> refuses (> 200,000 labels); with alpha 0.10 -> 964.

## Arm table (violation rate [CP95] vs arm's own target; coverage; x oracle(own alpha); abstain-all rate)
| arm | base 500 | shift 500 | base 2000 (300) | shift 2000 (300) |
|---|---|---|---|---|
| ltt_r0_a10 | 0.050 [.037,.065]; 0.213; 0.487x; 0.296 | 0.130 [.110,.152] FAIL | 0.063 [.039,.097]; 0.364; 0.831x; 0.003 | 0.323 [.271,.379] FAIL |
| ltt_r0_a08 | 0.023 [.015,.034]; 0.108; 0.303x; 0.572 | 0.076 [.060,.094] ok | 0.050 [.028,.081]; 0.254; 0.712x; 0.073 | 0.220 [.174,.271] FAIL |
| ltt_r0_a08_shiftgate | 0.023 [.015,.034]; 0.107; 0.300x; 0.576 | 0.001 [.000,.006] ok; abstain 0.998 | same as a08 (gate fired 0/278) | 0.000 [.000,.012]; abstain 1.000 |
Gate on base: fired 4/428 non-abstain draws (0.93%, near the nominal 1%); paired coverage cost -0.0010 (n_cal 500), 0 (n_cal 2000).
Gate on shift: fired 426/428 (n_cal 500), 278/278 (n_cal 2000).
Exploratory n_cal=2000 verdicts: H1 SUPPORTED, H2 REFUTED (0.712x [0.688, 0.735]), H4 SUPPORTED, overall NOT_PROVEN.

## Secondary planner-feasible endpoint (descriptive, preregistered)
ltt_r0_a10 coverage / oracle(0.08): 0.597 [0.574, 0.619] at n_cal 500; 1.019 [1.004, 1.034] at n_cal 2000.
This is NOT a 0.08 guarantee: a10 certifies only risk <= 0.10, and >1x oracle(0.08) means it selects past the 0.08 point.

## Honest caveats
- H2 failed as the contract's a-priori note predicted: lowering alpha and the oracle together does not create feasibility;
  the coverage ratio got worse (0.303x vs R0's 0.487x at alpha 0.10). The feasible version of R2 Q4 is "certify at 0.10,
  compare to a stricter-risk oracle", which is the descriptive secondary above, not a verdict.
- H4's "expected break" of the ungated a08 arm did NOT happen at n_cal 500 (0.076 [0.060, 0.094] <= delta): a08 is
  conservative enough there. The gate's value at n_cal 500 is therefore shown mainly against a10 (0.130 FAIL) and at
  n_cal 2000 (a08 0.220 FAIL -> gated 0.000). The gate turns shift into abstention: coverage under shift ~0.
- The KS gate only sees score-marginal shift. Label/concept shift with an unchanged score marginal is invisible to it
  and was not tested. Asymptotic KS p-value (Stephens-corrected), not exact.
- The deploy sample is n_cal unlabeled items drawn fresh per draw; in SPE this means holding ~500 deploy prompts before
  "verified" can show. Calibration draws are shared between base and shift conditions by design (same seeds).
- Synthetic DGP only; NOT_RUN: real-LLM replay, Bro replay, concept-shift detector, Mac mini replay.
