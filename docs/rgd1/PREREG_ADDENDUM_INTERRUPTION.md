# PREREG addendum — infrastructure interruption of the single holdout run (disclosure)

Added 2026-10-12 23:14 IST in a new commit. PREREG.md (sha256 49a125ec…8b08) is unchanged.

- The holdout run started 2026-10-12 22:52 IST with the exact preregistered command.
- **Correction (found on inspection):** the run was not killed by the session interruption. It **crashed** at about 23:01 IST (EXIT=1): OpenAlex returned HTTP 400 on the live search for holdout retracted task #31 (the OA arm), title 'Exogenous t-PA Administration Increases Hippocampal Mature BDNF Levels. Plasmin- or NMDA-Dependent Mechanism?'. Traceback: evidence/rgd1/holdout_attempt1_traceback.txt.
- **No outcome rows were written.** run.py writes rows.jsonl only at the end, so evidence/rgd1/holdout/ was empty.
- **No holdout metric was computed, printed or inspected.**
- Side effects that persist in the on-disk caches (gitignored data/rgd1_cache/):
  - LLM-generated queries for about 28 holdout tasks;
  - 30 OpenAlex live-search responses for the OA arm (keyless; credits already spent).
- The prereg has no explicit rerun rule. The builder applies the conservative rule: **complete the same single run** with unchanged code, corpus, tasks, seeds and prereg hash.
  - Every cached item is deterministic (temperature 0, seed 0) or is the identical API response, so the completed run equals an uninterrupted one.
  - The OA arm is not re-queried.
- This is disclosed as a deviation. Bro should treat it as such.

## Code change after the freeze (deviation)
- run.py, OA arm only: on HTTP 400, retry once with punctuation stripped. If it fails again, score the OA task as a miss and count the extra call.
- No local arm (B1, B2, R03, R03T), corpus, task, prompt, seed or analysis is changed. PREREG.md is byte-identical (same sha256).
- The holdout is then completed once with this code. Cached OA responses for the first 30 tasks are reused, so no second paid-equivalent query is made.
