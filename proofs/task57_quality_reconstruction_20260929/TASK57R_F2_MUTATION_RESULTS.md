# Task57R-F2 mutation results

`killedRepairedBrowserMutants` in `apps/web/scripts/repaired-browser-qualification.mjs` builds one lawful control observation and then one illegal observation per mutant. The control passes. Each illegal observation fails `qualifyRepairedBrowserObservation`. Receipt text is ignored by that function.

| Mutant | Result |
| --- | --- |
| F2-01 UI ignores an accepted repaired prompt | killed |
| F2-02 repaired PASS from receipt text alone | killed; the old receipt check would accept it, the qualifier does not |
| F2-03 visible stays the corrupted candidate | killed |
| F2-04 artifact receives the corrupted candidate | killed |
| F2-05 history receives the corrupted candidate | killed |
| F2-06 clipboard receives the corrupted candidate | killed |
| F2-07 JSON receives the corrupted candidate | killed |
| F2-08 `.spe` receives the corrupted candidate | killed |
| F2-09 a second reconstruction post or attempt | killed |
| F2-10 a protected section other than the diagnosed constraint changes | killed |

10 defined, 10 killed, 0 survived.

The live Chrome fault did not reach `ACCEPTED`, so these kills do not convert that run into a repaired PASS.
