# SPE AGI BRAIN Ω — R0 Architecture Map

Status: **RESEARCH_PROPOSAL — NOT AGI_PROVEN.** No claim of AGI, novelty or superiority is made anywhere in this package.
Availability intent (owner): core is free for all users; heavy compute is optional and opt-in. This round costs ₹0 (local CPU, no LLM/API).

## R0 custody
| Item | Value |
|---|---|
| Base branch / commit | `grok/lvt3-research-r1` @ `8dfb09fd0fc99b63ac26b513f87dd95a87ca7897` |
| Work branch | `grok/agi-brain-r0` (worktree `/Volumes/4TB-WD/spe-worktrees/spe-agi-brain-r0`) |
| Untouched | main, candidate/2026-10-26, DeepCoder checkout, `grok/lvt3-research-r2`, all frozen contracts (incl. `docs/lvt3/CONTRACT.md`) |
| Push / deploy | none |

## Six intelligences → existing modules (no new registries)
| Brief capability | Existing SPE module reused | What R0/R1 adds | Duplicate registry? |
|---|---|---|---|
| 0. Objective grounding / protection | ProtectedIntent (`spe_runtime/instruction_record/models.py`, `spe_runtime/prompt/meta_compiler.py`) | Frozen contracts act as the protected intent of each experiment | No |
| 1. Frontier reasoning (multiple methods) | — (R1 uses search + constructions + transfer as distinct methods) | `agi_brain/netsearch.py` conditions A–D | No |
| 2. Research intelligence (literature) | Live scholarly lanes (`r*-scholarly` branches; not mounted here) | Citation table below (manual WebFetch/WebSearch) | No |
| 3. Experimental intelligence | CSC world/discriminator (`research/csc/world_discriminator.py`) concept; LVT-3 stats (`research/lvt3/experiment.py: ci_t, ci_boot, _sd` **imported**, not copied) | Condition D counterexample world model + discriminating-experiment ordering (CEGIS-style) | No — D's model is per-run state, not a registry |
| 4. Creative invention + verified reuse | LVT-3 Registry pattern (`research/lvt3/registry.py`: admit only after re-verification); WDIC continuation (`research/wdic_vct`) | C's library admits train solutions only after the **independent** evaluator accepts them | No — library is an in-memory dict per seed; production reuse must go through the LVT registry |
| 5. Long-horizon autonomy | WDIC continuation engine (`research/wdic_vct/continuation_engine.py`) | `agi_brain/longdoc.py` resumable job (R7 slice) | No |
| 6. Failure learning / safety | Failure Genome (`spe_runtime/failure_genome/store.py`) | R1 rows log every independent rejection (false_success); wiring them into FailureGenomeStore.ingest is R2 work | No |

E (LVT-3 capability-evolution mechanism) is intentionally **not** in R1; it waits for LVT-3 R2 (another worker, branch `grok/lvt3-research-r2`).

## Citation check (paper 2 brief, visible sections)
Method: WebFetch of the cited URL where the brief gave one; otherwise WebSearch → primary page (arXiv / publisher / PMLR / Nature / PNAS). Existence + claim-match only, not an exhaustive novelty review. Note: the brief's sections between §1 and §Phase 5 were truncated in the copy this worker received (~47k chars), so citations only appearing there are **NOT_CHECKED**.

| # | Brief's citation & claim | Resolved source | Status |
|---|---|---|---|
| 1 | "DeepWriter, AAAI 2026, >100k-word books" linked to `proceedings.mlr.press/v306/wang26d.html` | That URL is **FIRE-Bench** (Wang, Bai, Luo … Xing; ICML 2026, PMLR 306:124896–124929). DeepWriter itself exists: AAAI-26, doi 10.1609/aaai.v40i39.40648 (Ming Wang et al.), planning-then-generation, books >100k words, BookScore 80.92 | **WRONG_ATTRIBUTION** (link) — claim itself VERIFIED at the correct DOI |
| 2 | AlphaEvolve, PNAS 2026, 67 math problems | PNAS 123(40) e2536158123, 30 Sep 2026 "Mathematical discovery and exploration can be done at scale"; arXiv 2511.02864 (Georgiev, Gómez-Serrano, Tao, Wagner): 67 problems, rediscovered most, improved several | VERIFIED |
| 3 | AlphaProof: RL + Lean-verified proofs | Nature, doi 10.1038/s41586-025-09833-y (Hubert et al.): AlphaZero-style RL in Lean, test-time RL, IMO 2024 silver-equivalent with AlphaGeometry 2 | VERIFIED |
| 4 | Kosmos: long-horizon research with structured world model | arXiv 2511.02824 (Mitchener et al.): up to 12 h, ~200 rollouts, 42k LOC, 1,500 papers/run, 79.4% statements judged accurate | VERIFIED |
| 5 | ScientistTwo: candidate papers + executable implementations | arXiv 2609.19644, scientist-two.github.io: autonomous paper + re-runnable code; reported 86/107 tasks above human SOTA (self-reported, AI-reviewer ratings) | VERIFIED (claims are the authors' own) |
| 6 | FIRE-Bench: leading agents struggle (<50 F1) | PMLR v306 wang26d (fetched directly) | VERIFIED |
| — | Citations in the truncated middle sections (§2–§16 body) | not received | NOT_CHECKED |

Owner's earlier flag (DeepWriter/FIRE-Bench mix-up) is **confirmed**: the brief's DeepWriter link points to FIRE-Bench.

## Roadmap slices in this round
- R0: this file + custody. R1: `CONTRACT_R1.md` (frozen), `experiment_r1.py`, `RESULTS_R1.md`. R7 slice: `longdoc.py` (mechanics only). R3 slice: independent evaluator `evaluator_r1.py` (shares no code with the generator; enforced by test).
