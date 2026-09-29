# Privacy analytics v1

Lineage: NEW_IMPLEMENTATION

Aggregate-only measurement architecture. It does not collect user-level analytics, store raw prompts, fingerprint browsers, or call third-party ad beacons. It does not publish live metrics. Missing measurements stay `UNKNOWN`.

## Flow

```text
admit_event(payload)
  collect refusals
  if any refusal
    raise, store nothing
  else
    keep the closed aggregate bucket

import_measurement(slot, evidence bytes)
  if bytes missing or unsafe
    slot stays UNKNOWN
  else
    hash bytes, copy allowlisted numbers, discard bytes
    omitted metrics stay UNKNOWN
    status = IMPORTED
```

`IMPORTED` means evidence was accepted. It is not a success score. Privacy analytics supplies observations only. It does not create semantic authority.

Country, session count, referrer class, and feature adoption are separate pre-aggregated observations. They are not fields on an ordinary event. A per-event `country`, session id, referring URL, or free-text feature label is refused. Missing observations stay `UNKNOWN`.

## Aggregate event

An event has only:

| Field | Closed value |
| --- | --- |
| schema_id | `spe.privacy-analytics.v1` |
| event_kind | `PAGE_VIEW_BUCKET` or `NAVIGATION_BUCKET` |
| day | calendar day |
| route_family | `HOME`, `CREATE`, `CAPABILITIES`, `CONTRACT`, `OTHER_PUBLIC` |
| count | non-negative integer |

The registry stores admitted events. It does not sum them into a live total.

## Measurement slots

| Slot | Metrics, each `UNKNOWN` until import |
| --- | --- |
| `SEARCH_CONSOLE` | clicks, impressions, ctr, position |
| `CORE_WEB_VITALS` | lcp_ms, inp_ms, cls, ttfb_ms |
| `REVENUE` | amount_minor, transaction_count, currency |

`empty_registry()` sets every slot to `UNKNOWN` and every metric to the string `UNKNOWN`. Null, empty string, and an unmeasured zero are not substitutes for `UNKNOWN`. A zero is recorded only when evidence bytes contain that zero.

`import_measurement` does not open `artifact_ref` and does not fetch Search Console, field vitals, or payment data. The caller supplies evidence bytes. Those bytes are hashed with SHA-256 and discarded. A prompt inside the bytes refuses the import and leaves the slot `UNKNOWN`.

Currency is not defaulted. A revenue import that omits currency leaves currency `UNKNOWN`.

## Pre-aggregated observations

| Observation | Stored when evidence is imported | Refused |
| --- | --- | --- |
| `COUNTRY_AGGREGATE` | ISO 3166-1 alpha-2 code and a count | per-event country, city, region, postal code, coordinates, IP, user id |
| `SESSION_AGGREGATE` | `session_count` only | `session_id`, session timeline, per-user session history |
| `REFERRER_CLASS` | counts for `DIRECT`, `SEARCH`, `SOCIAL`, `REFERRAL`, `INTERNAL`, `OTHER`, `UNKNOWN` | full referring URL, query string, path, click id |
| `FEATURE_ADOPTION` | counts for the closed public capability ids | arbitrary event names, free-text labels, user journey |

Omitted class or feature counts stay `UNKNOWN`. A zero is stored only when the evidence bytes contain that zero. The collector is `NONE` and this module makes no network request.

## Qualification checklist

| Id | Name | Disposition before evidence |
| --- | --- | --- |
| PA-01 | aggregate_only | ENCODED |
| PA-02 | no_user_level_tracking | ENCODED |
| PA-03 | no_raw_prompt_storage | ENCODED |
| PA-04 | no_fingerprinting | ENCODED |
| PA-05 | no_third_party_ad_beacons | ENCODED |
| PA-06 | no_user_content | ENCODED |
| PA-07 | no_identifiers | ENCODED |
| PA-08 | no_pass_scores | ENCODED |
| PA-09 | no_invented_metrics | ENCODED |
| PA-10 | search_console | UNKNOWN |
| PA-11 | core_web_vitals | UNKNOWN |
| PA-12 | revenue | UNKNOWN |
| PA-13 | country_aggregate | UNKNOWN |
| PA-14 | session_aggregate | UNKNOWN |
| PA-15 | referrer_class | UNKNOWN |
| PA-16 | feature_adoption | UNKNOWN |

Verdicts are `ARCHITECTURE_HOLD`, `EVIDENCE_RECORDED`, and `REFUSED`. After one real import, that row becomes `EVIDENCE_RECORDED` and the other measurement rows stay `UNKNOWN`.

## Refusals

| Code | Rejects |
| --- | --- |
| `PA_RAW_PROMPT` | raw prompt fields and prompt values |
| `PA_USER_CONTENT` | messages, queries, notes, and free text |
| `PA_IDENTIFIER` | email, IP, phone, account id, UUID |
| `PA_USER_LEVEL_TRACKING` | user, session, device, cookie, and third-party analytics hosts |
| `PA_FINGERPRINT` | canvas, user agent, locale, and coarse location fields |
| `PA_THIRD_PARTY_AD_BEACON` | ad pixels, click ids, and ad hosts |
| `PA_PASS_SCORE_FORBIDDEN` | success scores and numeric grades |
| `PA_INVENTED_METRIC` | a number on a slot that has no evidence |
| `PA_UNKNOWN_COLLAPSED` | null or empty string used in place of UNKNOWN |
| `PA_NOT_AGGREGATE` | lists, paths, or other non-bucket shapes |
| `PA_EVIDENCE_REQUIRED` | an import or self-declared import without evidence bytes |
| `PA_SCHEMA_INVALID` | a value outside the closed contract |

Refusal text names the field. It does not echo the rejected value.

## Non-goals

No network client, no hosted collection, no ad SDK, and no live Search Console, Core Web Vitals, or revenue figures. Those stay `UNKNOWN` until a later import brings evidence bytes.
