# Disclosure: in-place edit of a prior REANALYSIS doc

In commit 9f478a4e (round 4, 2026-10-13 12:57 IST) the file
`evidence/hostile-gym-r1/reanalysis_oracle_v4_POSTHOC/REANALYSIS.md` was **edited in place** (1 line changed:
the "two v3 mutants retired" statement corrected to 4 dropped / 17 added). That should have been an appended
correction file. The content change is a documentation correction only (no numbers, verdicts, runs or PREREG
changed), and it is reproduced in `reanalysis_oracle_v5_POSTHOC/REANALYSIS.md`. The original line is recoverable
with `git show d1a27550:evidence/hostile-gym-r1/reanalysis_oracle_v4_POSTHOC/REANALYSIS.md`. The file is left as
is (reverting would be a second in-place edit). From round 5 on, earlier REANALYSIS docs are not edited.
