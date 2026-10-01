# SPE — Task Continuation Engine Self-Review & Evidence Limits

## Core Evidence Invariants
1. `CLAIMED != VERIFIED`: An assertion in an agent's report is an unverified claim until proven against executable artifacts.
2. `SOURCE_PRESENT != EXECUTION_PROVEN`: Code committed or present does not prove tests ran or invariants held.
3. `EXIT_0 != ASSERTIONS_OBSERVED`: Process exit code 0 alone does not prove tests ran if 0 tests were selected or all were skipped.
4. `UNKNOWN != PASS`: Unverified hypotheses or missing execution telemetry evaluate to UNKNOWN or HOLD, never PASS.
5. `GILDEN_CAN_SELF_GRANT_AUTHORITY = NO`: SPE reviews and continuation contracts are strictly advisory and never grant elevated authority.
