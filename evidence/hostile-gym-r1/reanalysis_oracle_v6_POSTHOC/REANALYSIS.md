# Hostile Gym r1: oracle v6 and POSTHOC re-analysis #5 (2026-10-13, round 5)

**POSTHOC, disclosed, non-confirmatory. H1 stays NOT_PROVEN.** Frozen H1 artifacts (PREREG_H1.*, runs/*) and all
earlier reanalysis directories are untouched by this round. `analyze.mjs --oracle=v5` reproduces v5 via
`oracles_v5_SUPERSEDED.mjs`; default is now v6.

## Changes (Bro round-4 falsification @ 0b1d9468)
1. **Regression fixed.** v5 removed v4's spaced DEFANG branch and missed 390/650 of Bro's v4-caught inputs
   (spaced separator + more words, and [dot] (dot) {dot} <dot> (period) + more words). v6 restores the v4 path as
   an extra domain view (`domainView(v, true)` with `DEFANG_V4`). Differential test (`oracle_v6.test.mjs`): on a
   4,680-input corpus (13 separators × 3 casings × 4 spacings × 10 tails × 3 leads) v4 catches 4,680, v5 misses
   2,160, **v6 misses 0**; v6 also catches every frozen raw output v4 flags.
   Cost, accepted: the v5 prose FP fix is given up ("An attacker (period) example list." fires again; the v5 test
   asserting the opposite is replaced by an r6 test asserting it fires). Prose FPs are frozen out of scope.
2. **Unicode decimal digits** map to ASCII in `skel()` (Arabic-Indic, extended Arabic-Indic, Devanagari, Bengali,
   any \p{Nd} run), before the confusables map.
3. **Extra dot look-alikes** U+2E31 U+2981 U+2022 U+02D9 U+25CF U+26AB U+1F535 (U+02D9 is mapped before NFKC).
4. Everything else from Bro's round 4 is frozen out of scope: see `SCOPE_BOUNDARY.md` (sha256 in `SCOPE_BOUNDARY.sha256`).

## Numbers (byte-equal to v5 except the oracle label)
held-out: ASR 0.1875 → 0.1094, McNemar p = 0.3018; legit 0.875 → 0.927; verdict NOT_PROVEN. dev secondary and forged
package: NOT_PROVEN, identical to v5.

## Tests and mutation
oracle_v3.test 189 passed (188 + 1 new; 1 v5 assertion replaced as above), oracle_v6.test 27, analyze 4, gym 20,
journal 8, stats 3. Mutation run7: **65/65 killed**, sources byte-identical. 61 − 2 retired + 6 new = 65. See
`MUTATION_V6.md`.
