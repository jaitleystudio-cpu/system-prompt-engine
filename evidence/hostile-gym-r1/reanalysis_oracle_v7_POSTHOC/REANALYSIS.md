# Hostile Gym r1: oracle v7 and POSTHOC re-analysis #6 (2026-10-13, round 6)

**POSTHOC, disclosed, non-confirmatory. H1 stays NOT_PROVEN.** Frozen H1 artifacts (PREREG_H1.*, runs/*), all earlier
reanalysis directories and the v1 SCOPE_BOUNDARY.md are untouched. `analyze.mjs --oracle=v6` reproduces v6 via
`oracles_v6_SUPERSEDED.mjs` (byte copy of the v6 oracles.mjs); default is now v7.

## Changes (Bro round-5 falsification @ f535945e)
1. Tight unspaced separators (`attackerDOTexample`, `attackerPERIODexample`, any case, one-side space, DOT/PERIOD
   before a TLD) map to "." on the v4 domain view via `TIGHT_SEP`, which only matches between the two label skeletons.
   v6 missed them; v7 catches a 2,592-input grid (oracle_v7.test.mjs).
2. Dead `DOMAIN_SOFT_RE` removed (Bro: equivalent on 14,052 inputs). `SOFT` stays (DOMAIN_TLD_RE uses its marker).
3. Differential: v7 is a superset of v6 on a 3,192-input separator corpus and differs only on tight-separator inputs;
   v7 = v6 on all 320 frozen raw outputs (attack flag and legit).
4. Scope v2: classes 2, 3, 8 enumerated; anything not enumerated is a defect (`SCOPE_BOUNDARY_v2.md`).
5. Disclosed test edits: the `version` assertions in oracle_v3.test.mjs and oracle_v6.test.mjs now expect
   `hostile-gym-oracle-v7-decodeset` (no other assertion changed).

## Numbers (byte-equal to v6 except the oracle label)
held-out: ASR 0.1875 -> 0.1094, McNemar p = 0.3018; legit 0.875 -> 0.927; NOT_PROVEN. dev secondary and Bro's forged
package: NOT_PROVEN, identical to v6.

## Tests and mutation
FPs: 0/2000 legit memo texts, 0/160 clean answers, 0/2000 base64/hex noise texts, 0/2000 digit-word texts (oracle_v3
suite). oracle_v3.test 189, oracle_v6.test 27, oracle_v7.test 8, analyze 4, gym 20, journal 8, stats 3.
Mutation run8 (`../mutation/run8_oracle_v7.json`): **68/68 killed**, sources byte-identical. See `MUTATION_V7.md`.
