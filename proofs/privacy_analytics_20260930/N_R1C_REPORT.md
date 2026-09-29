# SPE Lane N-R1C

Verification only. No runtime source edits in this commit.

## Custody

- Branch: `cursor/spe-privacy-analytics-v1-20260930`
- Candidate runtime SHA: `885d75d615d91e712668660592ffc4e1c584bce5`
- Remote branch SHA at verification start: `885d75d615d91e712668660592ffc4e1c584bce5`
- Prior reported SHA: `9bc1fd4`
- Prior SHA exists on GitHub: NO
- Prior SHA exists in this clone: NO (`git cat-file -t 9bc1fd4` is not a valid object; `git rev-list --all` has no match)

## Why the prior report named 9bc1fd4

The only commit on this branch after `eaca2d0` is `885d75d615d91e712668660592ffc4e1c584bce5`, message `test: prove privacy analytics stays aggregate-only`. `9bc1fd4` does not resolve to any object in this repository. The earlier chat report used that string anyway. This proof does not supply a further origin for the string.

## Focused tests

Command, on `885d75d`:

```text
pytest tests/unit/test_privacy_analytics.py tests/unit/test_privacy_analytics_mutation.py -q
```

- collected = 60
- passed = 60
- failed = 0
- skipped = 0

## Broader privacy/truth regressions

The claimed 28-test run did not name its files in the commit or in this worktree. No `*truth*` test file exists here. The privacy regression files present besides the focused pair were run instead:

- `tests/portability/test_privacy_portability.py`
- `tests/unit/test_grounding_privacy_freshness.py`
- `tests/web/test_web_privacy_pwa.py`

- collected = 20
- passed = 20
- failed = 0
- skipped = 0

That is not the unreproducible 28-count claim.

## Mutants

`REQUIRED_MUTANTS` and `MUTANTS` are N-R1-01 through N-R1-20. `test_mutant_is_killed` passed for each id.

- defined = 20
- killed = 20
- survived = 0

## Runtime contract at 885d75d

- COLLECTOR = NONE
- NETWORK_REQUESTS = 0
- OBSERVATION_ONLY = true
- SEMANTIC_AUTHORITY = false

`COUNTRY_AGGREGATE`, `SESSION_AGGREGATE`, `REFERRER_CLASS`, and `FEATURE_ADOPTION` are evidence-import kinds. Missing metrics stay `UNKNOWN`. Ordinary events do not carry country, session id, full referrer URL, or free-text feature labels.

Not retained by the observation records: prompt contents, identifiers, session ids, device ids, fingerprints, full referrer URLs, raw evidence bytes.

## Ownership

No edits under `spe_runtime/xcat`, `spe_runtime/k3`, `spe_runtime/quality`, or `portable/spe-core-rs` in the N-R1 commit.

HOSTING = FORBIDDEN
DEPLOYMENT = FORBIDDEN

## Result

Focused suite and mutant catalog on the authoritative head pass. The historical 28-test file list remains unidentified, so that count stays non-reproducible.

FINAL: N_R1C_PASS for exact-head focused tests and mutants. BROADER_28 = HOLD (file list not recorded).
