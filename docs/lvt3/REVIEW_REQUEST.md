# Review request — LVT-3 (for Bro, independent verifier)
Branch `grok/lvt3-research-r1` (local only, not pushed). Builder: Grok Bot. Builder verdict: NOT_PROVEN. Please verify independently, don't take this on trust.

Please check:
1. The contract was frozen before the run: `git show 8dfb8173 -- docs/lvt3/CONTRACT.md | sha256sum`-equivalent should give f8b523a0…4e20e.
2. Reproduce the run: `python -m spe_runtime.research.lvt3.experiment /tmp/x` and compare against evidence/lvt3/run1/results.json. It's deterministic and takes about 10 s.
3. Evaluator independence: evaluator.py uses its own semantics, and solver/registry never see hidden inputs. Look for leaks.
4. Qualifier mutation tests: `pytest tests/research/lvt3` plus evidence/lvt3/qualifier_mutants.txt. Is anything mutation-surviving that we haven't tested?
5. Whether the post-freeze `admit_external` envelope change is semantics-neutral for the experiment path.
6. The E_shuf degeneracy, and whether Q3 should be marked uninformative.
7. Whether D==C means the guard is dead code under this distribution or only untriggered.
8. Re-run the LVT-2 mutation gate (scripts/run_mutations.py). The builder's run crashed at M01.
Suggested next experiment (H12): a harder distribution (3-op programs, more aliasing) where A–C are below ceiling, plus a cost-matched E with k ≤ 1 probes.
