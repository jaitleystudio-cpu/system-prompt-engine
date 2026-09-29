# Bounded reconstruction contract

Version: `spe.reconstruction_plan.v1`.

Plan B is one automatic repair of a diagnosed deficit.

- `attempt_index` is never greater than `max_attempts`
- `max_attempts` is 1
- a second attempt, or a subject that already records one reconstruction, is `REFUSED` with `ATTEMPT_BUDGET_EXCEEDED`
- the repaired candidate is kept only when Quality Delta is `IMPROVED` and `protected_regressions` is empty
- a non-improving or regressed repair is discarded and the original candidate is kept
- dispositions: `ACCEPTED`, `NO_IMPROVEMENT`, `UNRESOLVED`, `NOT_TRIGGERED`, `REFUSED`

The plan records triggering deficit ids, cause codes, the single repair operation, forbidden changes, source digest, and candidate digest.

Protected intent on the kept candidate is the protected intent on the source. Reconstruction does not change goal, facts, category, K3 technique, or authority grants.
