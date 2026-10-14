# DRY_RUN — plumbing only, NOT results
Backend: deterministic Stub (answers "1" to every eval question), so identical errors across arms are EXPECTED
and say nothing about CWC. Dev tasks dugongs/direct, peregrines/direct, seed 900. Holdout untouched.
Checks (tests/research/cwc1/check_dry_run.py): eval ground truth identical across A/B/C; C witness chosen index =
argmax spread for 10/10 steps; all files labelled DRY_RUN; a second run is byte-identical (6/6 files).
Real-model dry run: NOT_RUN — no usable free model (see RESULTS/REVIEW).
