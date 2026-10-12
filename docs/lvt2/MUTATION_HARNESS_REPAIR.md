# LVT-2 mutation harness repair (scripts/run_mutations.py)

Status: PROPOSED PATCH for the LVT-2 owner (Antigravity, PR #147). Not merged, not pushed.
Base: 9637907459334cb31d2f8e0c481baf896a9ce5a4 (PR #147 head).

## Symptom (R1, 2026-10-12)
Output stopped at `Testing mutant M01: Ignore oracle key allowlist...` with **no traceback**
(evidence/lvt2_harness_repair/original_r1_crash_output.txt). M01's mutated source stayed in
learning_validator.py, and a stray learning_validator.py.orig_backup was left behind.

## Full traceback
None exists. The process was killed by a signal, not by a Python exception, so no traceback was
ever emitted. This is stated plainly rather than fabricated.

## Root cause (reproduced)
1. Restoration was only in a `finally:` block. On SIGTERM/SIGHUP, Python's default handler ends
   the process without unwinding, so `finally` never ran. The R1 harness was a background job
   in an agent shell session that got reaped.
   Reproduction with the old harness: SIGTERM 4 s after start left M02 applied, plus a backup,
   and the sha256 check FAILED (evidence/lvt2_harness_repair/repro_sigterm_old_harness.txt).
2. No subprocess timeout. A hung test could hang the gate forever.
3. Custody hazard: the harness preferred a hard-coded pytest at
   `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv` (another
   agent's checkout). Tests could then run under a foreign interpreter or site-packages.
4. Gate weakness: any non-zero pytest exit (including 2 = collection error, 4 = usage error) was
   counted as KILLED. A broken environment could therefore "pass" the gate.

## Repair (does not weaken the gate)
- SIGTERM/SIGHUP/SIGINT handlers plus atexit restore every active mutant byte-for-byte and remove its backup.
- Per-test timeout (default 600 s). A timeout counts as ERROR, not KILLED.
- Pytest always runs as `sys.executable -m pytest`. No foreign checkout is used.
- **Stricter:** only exit code 1 counts as KILLED. 0 = SURVIVED; other codes = ERROR. A failed restoration = ERROR. The gate fails on any non-KILLED result or failed restoration.
- Optional JSON log (SPE_MUTATION_JSON_LOG) and mutant selection (`M01 M02` args).
- The mutant list, targets, replacements and tests are unchanged.

## Regression tests (tests/research/lvt/test_mutation_harness_regression.py)
These use a throwaway repo; production sources are never mutated.
- SIGTERM mid-mutant restores the source and removes the backup.
- A collection error is not counted as a kill.
- A real kill is counted, with byte restoration.
- The harness never references a foreign checkout's pytest.

Against the OLD harness: 3 of these 4 fail. Against the repaired harness: 4/4 pass.

## Verification
- LVT-2 suite: 172 passed (168 original + 4 regression), exit 0.
- Mutation gate: **30/30 KILLED**, MUT_EXIT=0 (all on-disk mutants M01–M30).
- 385 non-cache files under spe_runtime are byte-identical before and after (sha256 lists in evidence). `git diff -- spe_runtime` is clean.
