# Privacy binding preflight — Lane N into I11

Product-binding map only. Lane N stays the qualified privacy runtime. This document records the later I11 calls and leaves every one unwired.

## Custody

- Lane: C10 privacy binding preflight
- Branch: `cursor/spe-privacy-binding-preflight-20260930`
- SOURCE_SHA: `885d75d615d91e712668660592ffc4e1c584bce5`
- VERIFIED_TIP: `f7c2e66930aef3cb4fe5f25c8392321d569847b0`
- Remote `cursor/spe-privacy-analytics-v1-20260930` at fetch matched VERIFIED_TIP
- Privacy runtime blobs at VERIFIED_TIP match SOURCE_SHA
- COLLECTOR: NONE
- NETWORK_REQUESTS: 0
- OBSERVATION_ONLY: true
- SEMANTIC_AUTHORITY: false
- I11_WIRING: NOT_WIRED

`spe_runtime/privacy` is the behavior under test. This lane adds no collector, no network client, and no semantic authority.

## Qualified contract this map binds later

Schema `spe.privacy-analytics.v1`. An empty registry holds no events. Measurement slots and observations stay `UNKNOWN` until `import_measurement` or `import_observation` accepts evidence bytes. `IMPORTED` records that evidence was copied. It is a status, and the string `PASS` is refused. `UNKNOWN` stays the unmeasured sentinel.

| Gate | Entry | Unmeasured state |
| --- | --- | --- |
| SEARCH_CONSOLE | `import_measurement` | UNKNOWN |
| CORE_WEB_VITALS | `import_measurement` | UNKNOWN |
| REVENUE | `import_measurement` | UNKNOWN |
| COUNTRY_AGGREGATE | `import_observation` | UNKNOWN |
| SESSION_AGGREGATE | `import_observation` | UNKNOWN |
| REFERRER_CLASS | `import_observation` | UNKNOWN |
| FEATURE_ADOPTION | `import_observation` | UNKNOWN |

Evidence bytes are hashed and dropped. Stored records keep the digest, the audit label, the day, and allowlisted numbers. Prompt fields, emails, network addresses, UUIDs, session ids, device ids, fingerprints, click ids, and full referring URLs are refused. Refusal text names the field.

Ordinary events stay inside `PAGE_VIEW_BUCKET` and `NAVIGATION_BUCKET`, with route families `HOME`, `CREATE`, `CAPABILITIES`, `CONTRACT`, and `OTHER_PUBLIC`. The registry stores admitted buckets and does not publish a live total.

## I11 touch points

<!-- I11_WIRING: NOT_WIRED -->

Each row is the call a later I11 integration would make. The surface column is what exists today. The wiring column is the preflight result.

| ID | Later call | Surface today | Wiring |
| --- | --- | --- | --- |
| I11-PAGE-BUCKET | record_event PAGE_VIEW_BUCKET and NAVIGATION_BUCKET | apps/web/src/routing.ts views home, create, code, lab, my-work, privacy, capabilities, workspace | NOT_WIRED |
| I11-SEARCH-CONSOLE | import_measurement SEARCH_CONSOLE | no product importer | NOT_WIRED |
| I11-CORE-WEB-VITALS | import_measurement CORE_WEB_VITALS | no product importer | NOT_WIRED |
| I11-REVENUE | import_measurement REVENUE | apps/web/src/routing.ts schema.org Offer price is catalog copy | NOT_WIRED |
| I11-COUNTRY-AGGREGATE | import_observation COUNTRY_AGGREGATE | no product importer | NOT_WIRED |
| I11-SESSION-AGGREGATE | import_observation SESSION_AGGREGATE | apps/web My Work local history is on-device storage | NOT_WIRED |
| I11-REFERRER-CLASS | import_observation REFERRER_CLASS | apps/web/src/pages/PrivacyProof.tsx names Referrer-Policy no-referrer | NOT_WIRED |
| I11-FEATURE-ADOPTION | import_observation FEATURE_ADOPTION | apps/web/src/pages/Capabilities.tsx describes public capabilities in prose | NOT_WIRED |
| I11-QUALIFICATION | qualification_checklist and registry_document | apps/web/src/pages/PrivacyProof.tsx is static copy | NOT_WIRED |
| I11-COLLECTOR | network client or ad beacon | spe_runtime/privacy network_law collector NONE | NOT_WIRED |
| I11-SEMANTIC-AUTHORITY | observation becomes an authority grant | spe_runtime/authority has no privacy import | NOT_WIRED |

`I11-PAGE-BUCKET` would later admit counts only into the closed route families already defined by Lane N. No function in `apps/web/src/routing.ts` classifies those views into `HOME`, `CREATE`, `CAPABILITIES`, `CONTRACT`, or `OTHER_PUBLIC`.

`I11-REVENUE` would later require evidence bytes. The schema.org price on the public route metadata is page metadata.

`I11-COLLECTOR` stays closed. `apps/web/index.html` sets `connect-src 'self'` and loads `/src/main.tsx` only. Product code contains no Google Analytics, Meta Pixel, or ad beacon.

`I11-SEMANTIC-AUTHORITY` stays closed. `SEMANTIC_AUTHORITY` is false. An `EVIDENCE_RECORDED` checklist verdict is an observation record.

## Lane boundary

C10 writes this map, the lock tests, and the proof. It leaves `spe_runtime/privacy` byte-identical to SOURCE_SHA. It leaves `spe_runtime/xcat`, `spe_runtime/k3`, `spe_runtime/quality`, and `portable/spe-core-rs` untouched.
