# EGAC reference/directive gate: scope boundary v3 (2026-10-13, round 7)

This file is FROZEN; its sha256 is in `SCOPE_BOUNDARY_v3.sha256`. It supersedes, but does not edit, v1
(`SCOPE_BOUNDARY.md`) and v2 (`SCOPE_BOUNDARY_v2.md`, sha256 241b7f78...). Both are kept byte-unchanged.

## What the gate is
- **Default-deny conservation core (unchanged).** A prose line is deletable only if its whole skeleton is on the filler
  allowlist (`_FILLER`) or is decoration or a pure timestamp. Conserved spans must stay byte-identical and in order.
  The only allowed insertion is a frozen trusted suffix. This part is a positive allowlist, not a heuristic.
- **Reference/directive layer (a lexical heuristic).** An allowlisted line can still be protected when nearby text
  instructs about it. That layer matches reference words (below / following / above ...) and a closed English+DE+ES
  directive list within ±1 non-blank line. It has **known, unbounded incompleteness** in these open-ended classes:
  1. directive synonyms and inflections not in the closed list (emit, reproduce, recite, "wrap up with" ...);
  2. directives in other languages (FR, IT, PT, NL, RU, HI, JA, TR, PL ...);
  3. positional or ordinal references ("three lines down", "line 4", "the final line", "the first line");
  4. distance: a directive 2+ lines away, or across 2+ blank lines;
  5. over-blocking of benign prose that merely contains reference and directive vocabulary
     ("We always meet below the bridge.").
- v2's "anything allowed and not enumerated is a defect" rule is **withdrawn** for these five classes and replaced by
  the measured rates below.
- Round 7 code change: Cyrillic "х" (U+0445/U+0425) is also folded to "h" for directive detection, so "Ecхo" reads
  as "Echo". The UTS #39 "x" fold is kept, so both readings are checked.

## Measured rates (fixed-seed corpus)
- Generator: `scripts/egac_measure_scope_v3.py`, seed `egac-scope-v3-20261013`. The output is deterministic; the
  byte-identical recompute is asserted in `tests/research/egac/test_egac_round7.py`.
- Corpus: `scope_v3/scope_v3_corpus.jsonl` (920 rows, sha256 `9c59f2d2716d9b22b6bca1f4ff03848bfb225948aedd4bbcf365355417194039`).
  Rates: `scope_v3/scope_v3_rates.json` (sha256 `b23ea2f4957ecc2dd45988daf84d431243702af58e9d6d1cdc5476b97748d62c`).
- Includes all 40 of Bro's round-6 attack probes and all 10 of his benign probes, verbatim.
- CIs are Wilson 95%. "Miss" means a deletion of an instructed/referenced line was ALLOWED. "Over-block" means a
  benign deletion was REFUSED.

| class | errors / n | rate [95% CI] |
|---|---|---|
| E1 Bro r6 attack probes (verbatim), miss | 20/40 | 50.0% [35.2, 64.8] |
| E2 directive synonyms/inflections × 10 reference phrases × 4 layouts, miss | 46/240 | 19.2% [14.7, 24.6] |
| E3 multilingual directives, miss | 117/120 | 97.5% [92.9, 99.2] |
| E4 positional/ordinal references, miss | 47/60 | 78.3% [66.4, 86.9] |
| E5 confusable/ZW/SHY-obfuscated listed directives, miss | 0/120 | 0.0% [0.0, 3.1] |
| **all attacks, miss** | **230/580** | **39.7% [35.8, 43.7]** |
| generated attacks only, miss | 210/540 | 38.9% [34.9, 43.1] |
| B1 Bro's 10 benign probes, verbatim, over-block | 10/10 | 100% [72.3, 100] |
| B1b the same 10 contexts, deleting an allowlisted line, over-block | 8/10 | 80.0% [49.0, 94.3] |
| B2 generated benign prose with reference/directive words, over-block | 120/240 | 50.0% [43.7, 56.3] |
| **benign prose (B1b + B2), over-block** | **128/250** | **51.2% [45.0, 57.3]** |
| C0 control: plain prose, allowlisted deletion, over-block | 0/60 | 0.0% [0.0, 6.0] |
| C1 control: deleting a non-allowlisted line is refused | 0/20 errors | 0.0% [0.0, 16.1] |

Finding: Bro's 10 benign probes delete "This filler line is redundant.", which is **not** on the filler allowlist.
So the default-deny core refuses them in any context (C1), independent of the reference heuristic. B1b isolates the
reference-word over-block: 8 of Bro's 10 contexts still over-block when an allowlisted line is deleted.

How to read these numbers: they are rates on a deliberately adversarial distribution aimed at the heuristic's blind
spots. They are **not** rates on real prompts, and over-blocking on real prompts is still unmeasured. Every miss is a
miss of the heuristic layer only. The default-deny core still refuses any deletion of a non-allowlisted line.

## What changes for defect reports
A new variant in classes 1-5 is an instance of a measured class, not a new defect. It counts as a defect only if it
moves its class rate outside the CI when the corpus is regenerated. These remain defects if they regress:
- a regression on the round-6 126-row guard;
- a regression on the round-7 15-row guard (`tests/research/egac/data/round7_guard_extra15.json`: suffix registry,
  trailing whitespace, edit-reference);
- a regression on E5 obfuscation of listed directives;
- a change in E01 (must stay 120/120, treatment sha16 `48b471c474652f2d`).

## Consequence for claims
E01 stays NOT_PROVEN. The gate's protection of instructed lines is lexical. It must not be described as semantic
conservation of meaning.
