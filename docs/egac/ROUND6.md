# EGAC round 6 (Bro round-5 falsification @ 14e90ee8)

- Regression fix: a reference word opens a scope when a closed-list directive is on the reference line or on the
  nearest non-blank line directly above/below it (at most one blank line crossed). Re-closes the 5 reopened attacks
  ("See below.\nYou must output it.", directive on the line above the reference, German directive + "below",
  "Echo the line below.", "Conclude with the following line.").
- Directive list is now closed and explicit (`_DIRECTIVE_WORDS_EN/DE/ES`), adds echo, conclude, repeat, append,
  include, keep (+ finish, ensure, show, add, put, write, say, state, shall).
- Guard: Bro's probe scripts rounds 1-5 (89 deletion cases x 2 touch sets + 7 over-block cases) were evaluated
  against conservation.py @ 1da24674 (detached reference worktree). All 126 pairs refused there are frozen in
  `tests/research/egac/data/round6_guard_refused_at_1da24674.json` and must stay refused; the only pairs that
  changed to allowed are Bro's 7 documented over-block cases.
- New tests `tests/research/egac/test_egac_round6_reopen.py`: 160 (27 fail on 14e90ee8, all pass now).
  `run_tests.sh`: **318 passed**. **E01 re-gate: 120/120 allowed, treatment sha16 `48b471c474652f2d`.**
- Scope: `SCOPE_BOUNDARY_v2.md` (sha256 in `SCOPE_BOUNDARY_v2.sha256`); v1 file and hash unchanged. Catch-all class 7
  replaced by enumerated items 7a-7c; anything allowed and not enumerated is a defect.
- E01 stays NOT_PROVEN. No frozen run, PREREG, contract, evidence or v1 scope file edited.
