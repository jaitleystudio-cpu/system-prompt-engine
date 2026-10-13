# Mutation gate, oracle v7 (run8_oracle_v7.json): 68/68 killed

- Start: 65 mutants (run7, v6). None retired.
- 1 mutant re-targeted (same mutation): "skip DEFANG_V4 on the v4 view" now matches the line
  `skel(t).replace(DEFANG_V4, ".").replace(TIGHT_SEP, ".")` and drops only the DEFANG_V4 replace.
- Added 3 (killed by oracle_v7.test.mjs): drop `.replace(TIGHT_SEP, ".")`; drop PERIOD from the tight separator;
  drop the tight-separator form from the before-TLD lookbehind.
- 65 + 3 = 68. Killed 68, survived 0, not applied 0, sources byte-identical after.
