# C9_R_LOCALIZATION_REPAIR_REPORT

BASE_SHA: `42bede827816e950925138615dc3fcd7dc749500`
SCORED_SHA: `eac717e43bd95804309b15a9a6bb2c9c0bcb5c5b`
DONOR_SHA: `693030a4419d76d7da6a648eb6af5129fcec81f8`
BRANCH: `cursor/spe-localization-r1-repair-20261001`
QUALIFICATION_BRANCH: `cursor/spe-localization-r1q-20260930` remains at `42bede827816e950925138615dc3fcd7dc749500`
NETWORK: NONE
LIVE_FETCH: false
SEMANTIC_AUTHORITY: unraised
GRAPHIFY_OUT_COMMITTED: NO
I1_TOUCHED: NO
I2_STARTED: NO
PIN_MODIFIED: NO

FINAL: **LOCALIZATION_R1_REPAIR_PASS**

The seven donor oracles were reproduced on the qualification head before the patch. All thirty localization oracles then passed. No locales, routes, or live host were added.

## HREFLANG

PASS

`buildHreflangAlternates(url, { publishedLocales: [] })` emits no alternates. With `publishedLocales: ["es"]` and a resolver that returns `https://systempromptengine.com/es/create`, `x-default` uses that published URL. `PUBLISHED_LOCALES` stays `["en"]`. Registered locales `es`, `ar`, `ja`, `zh-Hans`, `hi`, `pt-BR`, `de`, and `fr` are omitted unless they are published and a resolver returns a real URL. A null resolver does not invent a URL. Default publication still emits only `x-default` and `en` at `https://systempromptengine.com/create`.

## RTL

PASS

`isolateBidi` drops U+202A LRE, U+202B RLE, U+202C PDF, U+202D LRO, and U+202E RLO. Ordinary Arabic `مرحبا` stays inside U+2068 / U+2069. LTR neighbors stay outside that isolate.

## UNTRANSLATED

PASS

`formatMessage("de"|"fr"|"pt-BR"|"unknown-lang", "nav.home")` returns `{status:"untranslated", translated:false}`. An empty catalog value returns that same mark. `resolveLocale("zh-Hant")` does not become `zh-Hans`. `resolveLocale("pt-PT")` does not become `pt-BR`. `resolveLocale("es-MX")` does not inherit `es-ES` numbering. `formatMessage("BR", "nav.home")` is untranslated. A missing key still returns the key. No translations were invented for unpublished locales. Existing catalogs for `en`, `es`, `ar`, `ja`, `zh-Hans`, and `hi` are unchanged.

## Tests

Command: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/python3.14 -m pytest tests/web/test_localization_architecture.py tests/web/test_localization_r1_qualification.py -q --tb=line`

| Suite | collected | passed | failed | skipped | errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 36 | 36 | 0 | 0 | 0 |

`tests/web/test_localization_r1_qualification.py` and `tests/web/test_localization_architecture.py` were not edited. The architecture harness now requires the repaired fail-closed laws.

## Mutants

Scored on `eac717e43bd95804309b15a9a6bb2c9c0bcb5c5b`. Defined L10N1-01 through L10N1-20. Killed 20. Survived 0. Broken 0. Baseline failures 0. Source runtime was clean.

| ID | Defect | Result |
| --- | --- | --- |
| L10N1-01 | hreflang for unpublished locale | KILLED |
| L10N1-02 | hreflang for registered-only locale | KILLED |
| L10N1-03 | alternate URL invented | KILLED |
| L10N1-04 | x-default forged | KILLED |
| L10N1-05 | RTL marks stripped | KILLED |
| L10N1-06 | bidi override accepted as content | KILLED |
| L10N1-07 | untranslated becomes translated | KILLED |
| L10N1-08 | empty string becomes translation | KILLED |
| L10N1-09 | locale fallback silently changes meaning | KILLED |
| L10N1-10 | language tag fabricated | KILLED |
| L10N1-11 | region treated as translation | KILLED |
| L10N1-12 | canonical locale dropped | KILLED |
| L10N1-13 | semantic authority elevated | KILLED |
| L10N1-14 | hreflang for registered-only locale | KILLED |
| L10N1-15 | x-default forged | KILLED |
| L10N1-16 | RTL marks stripped | KILLED |
| L10N1-17 | bidi override accepted as content | KILLED |
| L10N1-18 | untranslated becomes translated | KILLED |
| L10N1-19 | language tag fabricated | KILLED |
| L10N1-20 | semantic authority elevated | KILLED |

## Evidence

- `proofs/localization_r1_repair_20261001/pytest.txt`
- `proofs/localization_r1_repair_20261001/junit.xml`
- `proofs/localization_r1_repair_20261001/baseline_oracles.json`
- `proofs/localization_r1_repair_20261001/mutation_results.json`

Donor HOLD evidence in `proofs/localization_r1_20260930/` was left in place. No merge. No deploy. No host. No I2.
