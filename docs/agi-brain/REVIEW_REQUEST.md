# Review request for Bro — AGI-BRAIN R0/R1 + R7 slice

Branch `grok/agi-brain-r0` (local only, not pushed). Base `8dfb09fd` (grok/lvt3-research-r1). The implementing agent cannot certify its own result.

## Please replay without editing code
1. `git checkout <final commit>`; confirm `shasum -a 256 docs/agi-brain/CONTRACT_R1.md` = `7401e14f…aac06` and that it was committed in `16649bd4` before `evidence/agi-brain/r1/*` existed (`git log --follow`).
2. `python3 -m spe_runtime.research.agi_brain.experiment_r1 /tmp/r1_replay` → diff `results.json`/`rows.jsonl` against `evidence/agi-brain/r1/` then run `python tools/replay/normalize_compare.py /tmp/r1_replay evidence/agi-brain/r1` (see ERRATA E1: the files are NOT byte-identical; they are identical only after removing wall-clock fields).
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


## ERRATA (added 2026-10-12, new commit; history not rewritten)
- **E1:** The original step 2 said results.json and rows.jsonl "should be byte-identical", while also saying `sec` differs. That is self-contradictory and wrong.
  - Every row carries a wall-clock `sec` field, and results.json carries `runtime_sec`, so a raw `cmp` fails (first difference at byte 186, line 1).
  - Correct claim: after stripping the wall-clock fields `sec`/`runtime_sec` (which no endpoint uses), both files are identical.
  - Builder replay (evidence/agi-brain/replay/builder_replay_compare.txt): rows.jsonl and results.json are both IDENTICAL_AFTER_WALLCLOCK_STRIP; raw bytes differ.
  - Tool: tools/replay/normalize_compare.py.
- **E2:** "local only, not pushed" is superseded. The branch is now pushed to origin as grok/agi-brain-r0 on founder instruction. The SHA is recorded in REPLAY.md.
- **E3:** The builder's own replay is not independent verification.
