# Review request for Bro — AGI-BRAIN R0/R1 + R7 slice

Branch `grok/agi-brain-r0` (local only, not pushed). Base `8dfb09fd` (grok/lvt3-research-r1). The implementing agent cannot certify its own result.

## Please replay without editing code
1. `git checkout <final commit>`; confirm `shasum -a 256 docs/agi-brain/CONTRACT_R1.md` = `7401e14f…aac06` and that it was committed in `16649bd4` before `evidence/agi-brain/r1/*` existed (`git log --follow`).
2. `python3 -m spe_runtime.research.agi_brain.experiment_r1 /tmp/r1_replay` → diff `results.json`/`rows.jsonl` against `evidence/agi-brain/r1/` (should be byte-identical: fully seeded, no wall-clock in endpoints; `sec` field in rows will differ).
3. `uv run --no-project --with pytest python -m pytest -q tests/research/agi_brain tests/research/lvt3`.

## Please attack
- Evaluator independence (`evaluator_r1.py` must not share logic with `netsearch.py`; 0/1 principle + random integer checks). Try to get a wrong network accepted.
- Fairness of A (32-sample check) — is H3 a strawman? (We think partly yes; report it.)
- Whether excluding library-build cost biases C/D.
- Median check in `netsearch._ok_bits` (bit-sliced popcount) vs evaluator.
- Long-doc engine: resumption, corrupt-section regeneration, tmp-file crash, claim downgrading (`tests/research/agi_brain/test_longdoc.py`).
- Citation table in `ARCHITECTURE.md` (esp. DeepWriter link = FIRE-Bench).

## Verdict options
REPLAY_PASS / REPLAY_FAIL (with diff) / METHOD_DEFECT (with description).
