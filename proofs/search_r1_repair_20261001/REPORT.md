# SPE CURSOR C6 SEARCH R1 REPAIR PROOF

BASE_SHA: `1d83c47bb378c3e9873dd1c2750157bfbee48eac`
CODE_SHA: `82d3dce6236d4633afba4c77a3f5977ff121e0c4`
BRANCH: `cursor/spe-search-r1-repair-20261001`
QUALIFICATION_BRANCH: `cursor/spe-search-r1q-20260930` stays at `1d83c47bb378c3e9873dd1c2750157bfbee48eac`
DONOR_SHA: `975a0793726f4b7741beb19732ac01cea5e13198`
SOURCE_RUNTIME_MODIFIED: false
LIVE_SERP: NO
SEARCH_CONSOLE: NO
FIELD_CWV: UNKNOWN
CWV_NULL_BLANK: UNKNOWN
CWV_UNOBSERVED: UNKNOWN
SEMANTIC_AUTHORITY: NONE

`proofs/search_r1_20260930/` is the unchanged qualification HOLD. This directory is the repair re-score. The harness JSON in this directory still names the qualification branch because that label is hardcoded in the scorer. The repair branch is the one scored here.

FINAL: **SEARCH_R1_REPAIR_PASS**

## Tests

Existing search foundation: exit 0
Existing capabilities SEO: exit 0
New qualification suite: tests=33 passed=33 failed=0

## Mutants

Defined SR1-01 through SR1-20. Killed 20. Survived 0. Broken 0.

| ID | Defect | Result | Killed by |
| --- | --- | --- | --- |
| SR1-01 | robots ignored | KILLED | robots_honored |
| SR1-02 | 404 treated as indexable | KILLED | not_found_not_indexable |
| SR1-03 | canonical invented | KILLED | canonicals_not_invented |
| SR1-04 | sitemap URL fabricated | KILLED | sitemap_urls_not_fabricated |
| SR1-05 | missing metadata becomes a title | KILLED | metadata_not_invented |
| SR1-06 | schema invented | KILLED | schema_not_invented |
| SR1-07 | CWV missing becomes zero | KILLED | cwv_omitted_not_pass |
| SR1-08 | CWV missing becomes PASS | KILLED | cwv_slow_sample_fails |
| SR1-09 | live SERP claimed | KILLED | live_serp_not_claimed |
| SR1-10 | Search Console claimed without evidence | KILLED | search_console_not_claimed |
| SR1-11 | network enabled | KILLED | network_not_enabled |
| SR1-12 | private URL crawled | KILLED | private_url_not_indexed |
| SR1-13 | credential URL retained | KILLED | credential_urls_rejected |
| SR1-14 | duplicate URL silently collapsed as proven | KILLED | duplicates_not_proven |
| SR1-15 | noindex becomes index | KILLED | noindex_stays_noindex |
| SR1-16 | unknown route becomes 200 | KILLED | unknown_route_404 |
| SR1-17 | redirect loop marked complete | KILLED | redirects_not_a_completed_loop |
| SR1-18 | trailing-slash identity forged | KILLED | trailing_slash_identity |
| SR1-19 | semantic authority elevated | KILLED | semantic_authority_none |
| SR1-20 | gap removed without evidence | KILLED | known_gaps_remain |

## Ledger

```json
{
  "liveSerp": "NO",
  "searchConsole": "NO",
  "fieldCwv": "UNKNOWN",
  "hreflangLiveHost": "UNKNOWN",
  "lastmodContentAccuracy": "UNKNOWN",
  "semanticAuthority": "NONE",
  "indexingClaimed": false,
  "rankingClaimed": false
}
```

