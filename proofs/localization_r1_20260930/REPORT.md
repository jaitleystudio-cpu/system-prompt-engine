# SPE CURSOR C9 LOCALIZATION R1 REPORT

DONOR_SHA: `693030a4419d76d7da6a648eb6af5129fcec81f8`
DONOR_BRANCH: `antigravity/spe-localization-v1-20260930`
PR_NUMBER: none
QUALIFICATION_BRANCH: `cursor/spe-localization-r1q-20260930`
SCORED_HEAD: `693030a4419d76d7da6a648eb6af5129fcec81f8`
SOURCE_RUNTIME_MODIFIED: false
NETWORK: NONE
LIVE_FETCH: false
K3_INTEGRATED: false

FINAL: **HOLD**

`LOCALIZATION_R1_QUALIFICATION_HOLD`

The donor runtime is unchanged. The seven failing oracles are preserved. Tests were not weakened.

No pull request exists for `antigravity/spe-localization-v1-20260930`. The remote head of that branch is the donor SHA above. Lane H's worktree is at the same SHA.

## HREFLANG_LAW

**HOLD**

Default publication, which is what `SeoHead` calls, emits only `x-default` and `en`, both with href `https://systempromptengine.com/create`. `PUBLISHED_LOCALES` is `["en"]`. The route table is `/`, `/create`, `/code`, `/daily-lab`, `/my-work`, `/privacy`, `/capabilities`, `/workspace`. Registered locales `es`, `ar`, `ja`, `zh-Hans`, `hi`, `pt-BR`, `de`, and `fr` are absent from that default hreflang set. A published `es` route is emitted when `publishedLocales` contains `es` and `resolveLocalizedUrl` returns `https://systempromptengine.com/es/create`. A null resolver does not invent that URL.

Failing evidence:

- `buildHreflangAlternates(url, { publishedLocales: [] })` returns `[{"hreflang":"x-default","href":"https://systempromptengine.com/create"}]`.
- With `publishedLocales: ["es"]` and a resolver that returns `https://systempromptengine.com/es/create`, `x-default` still points at `https://systempromptengine.com/create`.

## RTL

**HOLD**

Ordinary Arabic `مرحبا` stays inside U+2068 / U+2069. The LTR neighbors `Alpha` and `Omega` stay outside that isolate. `direction: rtl` appears only under `html[dir="rtl"]`. `bdi` sets `unicode-bidi: isolate`.

Failing evidence: `isolateBidi` keeps U+202A LRE, U+202B RLE, U+202C PDF, U+202D LRO, and U+202E RLO in the returned string.

## UNTRANSLATED

**HOLD**

`formatMessage("de", "nav.home")`, `formatMessage("fr", "nav.home")`, `formatMessage("pt-BR", "nav.home")`, and `formatMessage("unknown-lang", "nav.home")` each return `"Home"`, the English gloss, with no `{status:"untranslated", translated:false}` mark.

An empty catalog value is treated as success: inserting `MESSAGES.en["probe.empty.l10n1"] = ""` makes `formatMessage("en", "probe.empty.l10n1")` return `""`.

`resolveLocale("zh-Hant")` returns id `zh-Hans`, script `Hans`. `resolveLocale("pt-PT")` returns id `pt-BR`, region `BR`. `resolveLocale("es-MX")` returns id `es`, numberLocale `es-ES`. `formatMessage("BR", "nav.home")` returns `"Home"`.

A missing key on the current catalogs returns the key `missing.key`, which is neither an empty string nor the English gloss `Home`.

## Tests

Command: `/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/python3.14 -m pytest tests/web/test_localization_architecture.py tests/web/test_localization_r1_qualification.py -q --tb=line`

| Suite | collected | passed | failed | skipped | errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 36 | 29 | 7 | 0 | 0 |

Pytest summary: `7 failed, 29 passed`. JUnit: `tests=36 failures=7 skipped=0 errors=0`.

The five existing localization architecture tests passed inside that total. The seven failures are the R1 obligations named above.

## Mutants

Defined L10N1-01 through L10N1-20. Killed 20. Survived 0. Broken 0.

A kill means an oracle that passes on the unmodified donor fails on a temporary copy. The worktree locale module is not patched.

The donor already fails the target oracle for L10N1-06, L10N1-07, L10N1-08, L10N1-09, L10N1-11, and L10N1-15. Those six mutants are still killed by a different oracle that passes on the donor.

| ID | Defect | Result | Killed by |
| --- | --- | --- | --- |
| L10N1-01 | hreflang for unpublished locale | KILLED | unpublished registered locales omitted |
| L10N1-02 | hreflang for registered-only locale | KILLED | unpublished registered locales omitted |
| L10N1-03 | alternate URL invented | KILLED | published locale without a resolver invents no URL |
| L10N1-04 | x-default forged | KILLED | default alternates point at the published canonical |
| L10N1-05 | RTL marks stripped | KILLED | RTL text preserved inside the isolate |
| L10N1-06 | bidi override accepted as content | KILLED | isolate still wraps with FSI/PDI |
| L10N1-07 | untranslated becomes translated | KILLED | missing key stays off the English gloss |
| L10N1-08 | empty string becomes translation | KILLED | missing key stays off the empty string |
| L10N1-09 | locale fallback silently changes meaning | KILLED | exact locale identity kept |
| L10N1-10 | language tag fabricated | KILLED | hreflang tags stay registered or x-default |
| L10N1-11 | region treated as translation | KILLED | translated catalog kept |
| L10N1-12 | canonical locale dropped | KILLED | canonical en emitted when published |
| L10N1-13 | semantic authority elevated | KILLED | semantic authority stays unraised |
| L10N1-14 | hreflang for registered-only locale | KILLED | publication registry stays en only |
| L10N1-15 | x-default forged | KILLED | default alternates point at the published canonical |
| L10N1-16 | RTL marks stripped | KILLED | isolate wraps with FSI and PDI |
| L10N1-17 | bidi override accepted as content | KILLED | isolate opens with FSI |
| L10N1-18 | untranslated becomes translated | KILLED | translated catalog kept |
| L10N1-19 | language tag fabricated | KILLED | fallback locale id stays registered |
| L10N1-20 | semantic authority elevated | KILLED | semantic authority stays unraised |

## Evidence

- `proofs/localization_r1_20260930/pytest.txt`
- `proofs/localization_r1_20260930/junit.xml`
- `proofs/localization_r1_20260930/baseline_oracles.json`
- `proofs/localization_r1_20260930/mutation_results.json`

No merge. No deploy. No host. No main. No I2.
