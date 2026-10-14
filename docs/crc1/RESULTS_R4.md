# CRC-1 R4 — Planner-margin oracle endpoint: results

Contract: docs/crc1/CONTRACT_R4.md (prereg commit 2fa9ec69, sha256 cecc86a7…00a1), pushed before code 1aea4717.
Tests 11/11 pass; mutation gate 10/10 killed on first run (evidence/crc1/r4/tests_and_mutation_gate.txt).
Synthetic DGP only, Grok box (Mac mini offline), no LLM/Ollama, ₹0. Two independent runs: summary.json byte-identical
(sha256 0b96754a…ac9b). delta = 0.10, KS gate p < 0.01 (untuned from R3).

## Frozen margin (a-priori, from CONTRACT_R4)
Largest m ∈ {0.01..0.05} with n_needed(oracle(α−m), α=0.10) ≤ 500 on Pop(Random(999)):
**m = 0.05**, α−m = 0.05, r* = 0.043782, oracle_coverage(α−m) = **0.183753**, n_needed = **116**.
FEASIBILITY_FAIL = no. Recompute in summary matched contract (frozen_margin.match_contract = true).

## Verdicts (primary: n_cal = 500, 1000 draws)
| hypothesis | verdict | basis |
|---|---|---|
| H1 validity of ltt_r0_a10 (target 0.10) | SUPPORTED | violation 0.050, CP95 [0.037, 0.065] ≤ 0.10 |
| H2 coverage ≥ 0.85 × oracle(α−m) | SUPPORTED | 1.161× oracle(0.05), bootstrap one-sided 95% [1.118, 1.205]; LB ≥ 0.85 |
| H3 beats previous best (:= H2) | SUPPORTED | H2 pass under honest endpoint; x-oracle(0.10) = 0.487 (descriptive; same R0 selector — no claim of coverage gain vs R0) |
| H4 shift gate (a10 + KS) | SUPPORTED | gated violation 0.000 [0.000, 0.004], abstain-all 0.997 (CP [0.991, 0.999]) |
| Overall (H1 & H2 & H4) | **SUPPORTED** | |

## Continuity with R0 / previous best
| metric | R4 n_cal=500 | prior R0 / R3 note |
|---|---|---|
| a10 / oracle(0.10) | 0.487 [boot 0.468, 0.505] | R0 ≈ 0.48×; R3 a10 0.487× — same selector, same DGP |
| a10 / oracle(α−m=0.05) | **1.161** [1.118, 1.205] | new honest endpoint (this round) |
| raw mean coverage a10 | 0.213 | unchanged vs R3 a10 |

Honest answer on "beats previous best": under the **contract H3 definition** (H2 pass), yes. Under the colloquial reading
"does the selector cover more than R0 did vs oracle(0.10)?", **no** — it *is* the R0 selector (~0.487×). The upgrade is
endpoint honesty (planner-feasible compare-oracle), not a stronger arm.

## Arm table (violation [CP95] vs arm's own target; coverage; ratios; abstain)
| arm | base 500 | shift 500 | base 2000 (300) | shift 2000 (300) |
|---|---|---|---|---|
| ltt_r0_a10 | 0.050 [.037,.065]; cov 0.213; 1.161×am / 0.487×010; abstain 0.296 | 0.130 [.110,.152] FAIL; cov 0.132 | 0.063 [.039,.097]; cov 0.364; 1.982×am / 0.831×010 | 0.323 [.271,.379] FAIL |
| ltt_r0_a10_shiftgate | gate fired 8/704 (1.14%); paired cov cost −0.002 | 0.000 [.000,.004]; abstain **0.997**; cov ~0.001 | gate fired 0 on non-abstain | 0.000 [.000,.012]; abstain 1.000 |
| ltt_r0_a08 (descriptive) | 0.023 [.015,.034]; cov 0.108 | (not primary) | — | — |

Oracle(base): (0.05→0.184), (0.08→0.358), (0.10→0.439). Gate false-alarm on base ≈ nominal 1%.

Exploratory n_cal=2000: H1/H2/H4 all SUPPORTED; overall SUPPORTED; a10 / oracle(0.10) = 0.831.

## Product recommendation
**Yes — freeze R0 LTT (α=0.10, δ=0.10) + R3 KS shift gate as the shipped "verified" policy**, advertising the honest
planner-margin coverage number (≈1.16× oracle(0.05) / ≈0.49× oracle(0.10) at n_cal=500) rather than a 0.85×-of-oracle(0.10)
claim. Do not keep searching for a stronger selector on this DGP under a fixed-n_cal=500 budget; the planner already said
oracle(0.10) needs ~140k labels.

## Honest caveats
- H2 passes because m=0.05 (largest feasible) shrinks the compare-oracle coverage to 0.184; at m=0.03 (also feasible,
  n_needed=379) the same raw coverage 0.213 would be 0.213/0.304 ≈ 0.70× and would likely REFUTE or NOT_PROVE H2.
  The "largest m" rule was preregistered; critic should judge whether that choice is product-honest.
- Same R0 selector: x-oracle(0.10) unchanged at ~0.49. No coverage improvement over R0.
- KS gate still converts shift into ~total abstention (safe, not useful coverage under shift). Score-marginal only;
  concept/label shift with unchanged score marginal is invisible and untested.
- Synthetic DGP only. Mac mini offline; no Ollama/LLM. Bro replay requested because Overall SUPPORTED.
