# Mutation gate, oracle v6 (run7_oracle_v6.json): 65/65 killed

- Start: 61 mutants (run6, v5).
- **Retired 2 as equivalent** (not weakened tests): `|| DOMAIN_SOFT_RE.test(d)` removal and the `(?!\s+[A-Z])`
  prose guard in DOMAIN_SOFT_RE. The restored v4 spaced-DEFANG path catches every input DOMAIN_SOFT_RE catches, so
  neither mutation changes any observable output; both SURVIVED in the first v6 run for that reason. (The first
  string also no longer matched the edited line.)
- **Added 6** (killed by oracle_v6.test.mjs): drop the restored v4 path from domainHit; drop the spaced
  `\s+(DOT|PERIOD)\s+` branch of DEFANG_V4; make the v4 view skip DEFANG_V4; disable Unicode digit mapping; drop
  U+2E31 from DOTLIKE; drop the U+02D9 pre-NFKC map.
- The v5 mutant dropping PERIOD from the tight `(…)` defang survived once (the restored path covers the spaced
  form); a new oracle_v3 test ("attacker example(period)com", seen only by the v5 path) now kills it.
- 61 − 2 + 6 = 65. Killed 65, survived 0, not applied 0, sources byte-identical after.
