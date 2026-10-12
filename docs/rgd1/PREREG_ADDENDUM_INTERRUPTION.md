# PREREG addendum — infrastructure interruption of the single holdout run (disclosure)

Added 2026-10-12 23:14 IST in a new commit. PREREG.md (sha256 49a125ec…8b08) is unchanged.

- The holdout run started 2026-10-12 22:52 IST with the exact preregistered command.
- It was killed at about 23:00 IST when the controlling agent session was interrupted. No EXIT line was logged.
- **No outcome rows were written.** run.py writes rows.jsonl only at the end, so evidence/rgd1/holdout/ was empty.
- **No holdout metric was computed, printed or inspected.**
- Side effects that persist in the on-disk caches (gitignored data/rgd1_cache/):
  - LLM-generated queries for about 28 holdout tasks;
  - 30 OpenAlex live-search responses for the OA arm (keyless; credits already spent).
- The prereg has no explicit rerun rule. The builder applies the conservative rule: **complete the same single run** with unchanged code, corpus, tasks, seeds and prereg hash.
  - Every cached item is deterministic (temperature 0, seed 0) or is the identical API response, so the completed run equals an uninterrupted one.
  - The OA arm is not re-queried.
- This is disclosed as a deviation. Bro should treat it as such.
