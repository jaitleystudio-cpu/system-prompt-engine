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

## Round 5 (Bro round-4 falsification @ de9bb1c9)
- BRO12 (study-path shuffled-control > 0 removed), BRO13 (EFFECT_FLOOR_UNMET ignored), BRO14 (evaluator_id != generator_id removed), BRO16 (four-arm held-out is_statistically_significant dropped) survived 190/190.
- New killers: `tests/research/lvt/test_conjunct_guard_mutant_killers.py` (4 tests; each flips one input of the fully qualified R5 fixture, asserts the control conjuncts are all True first, then that the specific conjunct goes False; BRO14 is checked on the study and four-arm paths).
- Gate: M44-M47 added with Bro's exact targets; `evidence/lvt2_harness_repair/mutations_r6.json` / `mutations_r6_log.txt`: **47/47 KILLED**, all sources restored (pre/post tree hash identical apart from the new evidence files). `tests/research/lvt`: 194 passed; `lvt` + `rbpd`: 203 passed. Production code unchanged. Verdicts unchanged.

## Round 6 (Bro round-5 falsification @ a93d50b6)
- BRO17 (owner attestation `ts <= 0` removed), BRO19 (transfer-report family floor `max(20, ...)` -> `max(2, ...)`), BRO20 (study-path `family_macro_delta >= 0` dropped from ImprovementSupported), BRO21 (receipt `committed_timestamp` requirement dropped) survived 194/194.
- New killers: `tests/research/lvt/test_round5_survivor_killers.py` (4 tests, all with genuinely signed / re-sealed inputs and a passing control): signed attestations at ts 0, -1.0, 0; a 10-family re-sealed transfer report; a study with family_macro_delta = -0.01; receipts re-signed with committed_timestamp None/0/0.0.
- Finding (not fixed, production code unchanged): BRO19 is only observable because the protocol precheck `proto.min_heldout_families < 20` lets NaN through (NaN < 20 is False). With `min_heldout_families = NaN` the hard floor 20 at the family count is the only remaining guard; the M49 test pins it. Consider rejecting non-finite / non-int `min_heldout_families` in the precheck.
- Gate: M48-M51 added with Bro's exact targets; `evidence/lvt2_harness_repair/mutations_r7.json` / `mutations_r7_log.txt`: **51/51 KILLED**, all sources restored. `tests/research/lvt`: 198 passed; `lvt` + `rbpd`: 207 passed. Verdicts unchanged.

## Round 7 (Bro round-6 falsification @ 3966d052): study-path floor bypass closed, strict numerics
**SERIOUS (fixed):** on the study path, `min_heldout_families=1` (or 5) with 6 families gave
`RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED` (p=0.0156), and `validate_and_commit` minted **QUALIFIED**. The floor of
20 existed only on the transfer path.

Production changes:
- `paired_gate_v2.HARD_MIN_HELDOUT_FAMILIES = 20` is now enforced in four places:
  - `run_study`: `len(families) < max(20, min_heldout_families)` gives `INSUFFICIENT_INDEPENDENT_FAMILIES`
    (INCONCLUSIVE).
  - `evaluate_conjuncts`: `holdout_family_count >= 20` is required for `ImprovementSupported`.
  - `validate_and_commit`: an explicit hard-floor and numeric check runs before any QUALIFIED/RESEARCH_SUPPORTED mint.
    On failure the result is REJECTED and the signature and timestamp are cleared.
  - The transfer path, which already had it.
- Strict numerics via `strict_int`, `strict_finite`, `strict_timestamp` and `study_numeric_violations`:
  - Fields covered: `holdout_family_count`, `p_value`, `alpha_adjusted`, `family_macro_delta`, train deltas,
    held-out deltas and means.
  - Rejected: NaN, ±inf, str, None, bool, negatives and out-of-range values. These are checked before any
    comparison, so there is no TypeError.
- Transfer verify path: `_transfer_protocol_numeric_violations` rejects a non-int, bool or negative
  `min_heldout_families` and an invalid `alpha`, `multiplicity` or `primary_effect_floor` cleanly. Bro's "nan", "20"
  and None TypeErrors and the accepted NaN protocol minimum are now clean rejections. The existing `< 20` floor check
  and its message are unchanged.
- Receipt `committed_timestamp` must be a finite, strictly positive int or float. NaN, ±inf, -1, "x" and True are
  rejected.
  - Deviation from "positive int": production mints `time.time()` (a float), so a float is accepted. Requiring an int
    would make every legitimately minted receipt unverifiable.
- The early in-report family floor moved into `_report_family_floor_ok` (same expression). M49's target moved with it.

Tests: `tests/research/lvt/test_round7_floor_and_numeric_strictness.py`, 36 tests.
- **BRO23** (cluster floor 20 → 2) and **BRO24** (family condition dropped from the recomputed success) were masked
  by earlier layers. They are now pinned by disabling those layers via monkeypatch, which proves each later floor is
  independently load-bearing.
- The round-5 NaN test (M49) gets the same treatment: one monkeypatch line was added and its assertion is unchanged.
- M51 (BRO21) became masked by `strict_timestamp`. It is re-pinned by a layered test, and the harness now accepts
  several test node ids for one mutant.

Gate: new mutants M52-M62.
- M52: run_study floor dropped.
- M53: conjunct floor dropped.
- M54: validate_and_commit block disabled.
- M55: conjunct numeric layer disabled.
- M56: numeric family floor lowered 20 → 0.
- M57: transfer numeric precheck disabled.
- M58: timestamp strictness dropped.
- M59: BRO23.
- M60: BRO24.
- M61: strict_finite accepts bool.
- M62: strict_int accepts bool.

Verification (round 7): `tests/research/lvt` **234 passed**; `lvt` + `rbpd` **243 passed**. Mutation gate r8 (`evidence/lvt2_harness_repair/mutations_r8.json` / `mutations_r8_log.txt`): **62/62 KILLED**, MUT_EXIT=0, all 369 spe_runtime .py files byte-identical before/after. QUALIFIED audit (read-only, all local + origin grok/* refs): no committed LVT receipt, study result or transfer report artifact exists on any grok/* branch, so nothing was QUALIFIED through the bypass. Verdicts unchanged.
