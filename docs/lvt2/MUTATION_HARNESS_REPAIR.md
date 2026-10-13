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

## Round 2: Bro's independent replay findings (2026-10-13 @ 56c6ca14)
Bro's replay confirmed the claims above (172 tests, 30/30 killed, 2,791 files byte-identical after restore) and found:

### 1. Two surviving mutants in `LearningValidator.verify_transaction_signature`
- **BRO1 / M31 — REVOKED check removed:** survived because no test had a receipt that was validly hashed and signed while its status said REVOKED. New test `test_validly_signed_but_revoked_receipt_is_rejected` re-binds and re-signs a receipt with status REVOKED under the validator's own key; only the explicit check rejects it.
- **BRO2 / M32 — artifact_hash check removed:** the return value is *equivalent* (the later sha256 comparison also fails on an empty hash), so it can only be killed by pinning the fail-closed order. New test `test_missing_artifact_hash_fails_closed_before_any_lookup` asserts the verifier returns False without calling `is_tombstoned` or `_build_receipt_dict`. Disclosed as an ordering/fail-fast contract, not a new security property.
- Both added to the harness as M31/M32. **Mutation gate now 32/32 KILLED, MUT_EXIT=0** (evidence/lvt2_harness_repair/mutations_r2_20261013.{txt,json}); all git-tracked files under spe_runtime byte-identical before/after the gate.

### 2. SIGKILL leftover (undisclosed in round 1)
- **Observed by Bro:** a hard kill (SIGKILL) mid-run left **M05 applied to `learning_validator.py` plus `learning_validator.py.orig_backup`**, i.e. the original R1 symptom (Bro kept a copy: /tmp/bro-replay-20261013b/M05_leftover_mutant.py on the Mac mini).
- **Why:** SIGKILL cannot be caught; signal handlers, `atexit` and `finally` never run. The round-1 repair only covers SIGTERM/SIGHUP/SIGINT. The claim above ("restore every active mutant") holds for trappable signals only.
- **What fixed it:** the *next* harness run's startup recovery (`main()`: every `*.orig_backup` under REPO_ROOT is written back over its source, then deleted) restored the file before any mutant ran.
- **Residual risk:** between a SIGKILL and the next harness run, the working tree holds a mutated production source. Anyone running tests or committing in that window sees mutant code. Mitigation: always run the harness (or `git status`/check for `*.orig_backup`) after an interrupted run; never commit with a `*.orig_backup` present.
- **Test:** `test_sigkill_leftover_is_recovered_by_next_run_startup` (throwaway repo) SIGKILLs the harness mid-mutant, asserts the leftover state, then asserts the next run restores bytes and removes the backup.

### 3. `lvt/types.py` shadowing stdlib `types`
- Running `spe_runtime/research/lvt/cli.py` as a script puts `lvt/` first on `sys.path`, so `import types` (via argparse/dataclasses) loaded `lvt/types.py` → circular-import crash, exit 1 (3 CLI tests failed without an editable install).
- **Fix:** `cli.py` removes its own directory from `sys.path` before importing any stdlib module that needs `types`. Not renamed, because 26 files import `spe_runtime.research.lvt.types`. New test `test_cli_script_runs_without_editable_install` (`python -S`, cwd outside repo) fails on the old cli (4/4 CLI tests fail) and passes on the new one.

### Verification (round 2)
- `pytest tests/research/lvt tests/research/rbpd`: **186 passed**, exit 0.
- Mutation gate: **32/32 KILLED**, MUT_EXIT=0, restoration byte-identical.

## Round 3 (2026-10-13, Bro replay 2): BRO3 and BRO4 killed
- **BRO3:** a properly signed attestation whose verdict is not APPROVED was accepted. Now covered by `test_signed_attestation_with_non_approved_verdict_is_rejected` and mutant **M33** (the verdict != APPROVED check is removed). Result: KILLED.
- **BRO4:** a revoked validator key could be re-enrolled. Now covered by `test_revoked_validator_key_cannot_be_re_enrolled` and mutant **M34** (the revocation check on enrol is dropped). Result: KILLED.
- Gate: **34/34 mutants KILLED**. The unmutated control is BYTES_IDENTICAL. `tests/research/lvt` + `rbpd`: **188 passed**.
- Evidence: `evidence/lvt2_harness_repair/mutations_r3.json` and `mutations_r3_log.txt`.

## Round 4 (2026-10-13, Bro replay 3): BRO5, BRO6 and BRO8 killed
New file: `tests/research/lvt/test_transfer_receipt_mutant_killers.py`.

Every attack is a **fully re-sealed** transfer report. All digests, the evidence hash, the oracle attestation and the validator receipt signature are recomputed with the legitimate keys. So the only check that can reject the report is the one under test. A reseal control confirms that an authentic report still verifies.
- **BRO5, duplicate replay:** a re-sealed report with a duplicated `item_id` or a duplicated `content_sha256` is rejected ("Duplicate").
  - M35 removes the check.
  - M38 keeps only the `item_id` part.
  - M39 keeps only the `content_sha256` part.
  - All three are KILLED.
- **BRO6, significance:** 12 big-win and 12 small-loss families give macro delta ≥ the effect floor but sign-test p = 1 > α/m.
  - The authentic report verifies as authentic but **not** a transfer.
  - A re-sealed `transfers_successfully=True` is rejected.
  - M36 (`p_val <= 1.0`) is KILLED.
- **BRO8, effective protocol floor:** tested directly with 24 real families, so only the protocol floor check can bite.
  - `min_heldout_families` set to 0, 2, 10 or 19 is rejected; 20 is accepted.
  - M37 (floor 20 → 2) and M40 (off by one, < 19) are KILLED.
- **Gate:** **40/40 mutants KILLED**. The unmutated source is BYTES_IDENTICAL. `tests/research/lvt` + `rbpd`: **194 passed**.
- **Evidence:** `evidence/lvt2_harness_repair/mutations_r4.json` and `mutations_r4_log.txt`.

## Round 4 (Bro round-3 falsification @ 3094f984)
- BRO9 (Bonferroni dropped), BRO10 (study-path `p_value <= alpha_adjusted` deleted), BRO11 (ties counted positive) survived 185/185.
- New killers: `tests/research/lvt/test_alpha_and_ties_mutant_killers.py` (5 tests; authentic re-sealed reports at p=0.0320 with multiplicity 2, 4 wins + 20 exact ties at p=0.0625, and a study result with p = 1.5 x alpha_adjusted).
- Gate: M41-M43 added; `evidence/lvt2_harness_repair/mutations_r5.json` / `mutations_r5_log.txt`: 43/43 KILLED, all sources restored. Production code unchanged. Verdicts unchanged.
