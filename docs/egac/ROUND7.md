# EGAC round 7 (Bro round-6 falsification @ a8d432e8)
- `conservation.py`: directive detection also reads Cyrillic х/Х as "h" (`_directive_skeleton`), so "Ecхo the line
  below." is refused. Every other classifier still uses the plain UTS #39 skeleton (х→x), and "eхactly" is still
  detected.
- Guard: `tests/research/egac/data/round7_guard_extra15.json` holds Bro's 15 missed probes, all refused at 1da24674
  and still refused, each tested under touches R and RU:
  - 9 suffix-registry probes;
  - 3 trailing-whitespace probes;
  - 3 edit-reference probes.
- How the guard was built: Bro's scripts in `/tmp/bro-fix{,2,3,4,5}-20261013/egac/` were re-executed while every
  `run_gated` call was recorded, and each recorded call was replayed against a detached 1da24674 worktree.
- Another 63 probes from rounds 1-2 were also refused at 1da24674 and are absent from both guards. They were not
  added, because several are benign edits that are over-blocked (typo fix, double-space collapse) and pinning them
  would freeze over-blocking.
- Scope: `SCOPE_BOUNDARY_v3.md` describes the gate as lexical and replaces the exact lists with measured miss and
  over-block rates on a fixed-seed corpus (`scripts/egac_measure_scope_v3.py`, `docs/egac/scope_v3/`).
- Tests: `run_tests.sh` gives **356 passed** (318 + 38 new). E01 re-gate: **120/120, treatment sha16
  `48b471c474652f2d`**.
- No frozen run, PREREG, contract, evidence or v1/v2 scope file was edited. E01 stays NOT_PROVEN.
