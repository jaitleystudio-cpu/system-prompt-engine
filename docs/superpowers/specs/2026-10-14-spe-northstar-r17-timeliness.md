# SPE Ω North Star R17 — Source-Claimed Revision Timeliness

**Scope: DRAFT / CI qualification only / no real market leadership claim.**
Base: R16 PR #170 @ 24b23b5c066924805f89e5427f27cec1034471de.

## Problem
The R6 Statuspage adapter could append an older or equal-time incident
version with different content if it reappeared later in a cache or feed.
This created false new notices and misleading detection-speed reporting.

## Change within existing owners
- R6 source observer compares each changed incident payload to the last
  persisted R2 source revision timestamp and holds any equal/older clock.
- Original source timestamps are *provider-controlled*, not independently
  authenticated original first-publication times. The observer measures
  only age of a claimed source revision when first seen in THIS journal.
- Previously unseen old provider events may be archived in custody, but
  must not be promoted to fresh headlines or fast-detection claims.
- Duplicate IDs in a single feed page are held as an ambiguous entire batch.
- Reported age, archival counts and stale revision count are bounded
  per-run local metadata without raw source body, user prompts or PII.

## Measurable future launch qualification
1. Frozen source chronology test set with benign orderings, cached stale
   responses, timezone variants, future dates and forged equal-time updates.
2. False fresh-alert rate on held-out incident fixture set = 0.
3. Independent real source timestamps and SPE observed timestamps collected
   in an explicitly approved external service, with clock synchronization
   and provider-specific polling limits. Without it, speed is UNKNOWN.
4. Compare median, p95 and p99 source observation delay on real events,
   alongside negative cases, missed events, and hourly provider freshness.
5. Separately verify any published claim. No system can guarantee it will
   be the first in every country or within seconds of every AI headline.

## Preserved product boundaries
R17 does not replace XCAT, K3, Rust/WASM, Worker, .spe, LVT, Quality Delta,
Failure Genome, CI receipt owner, or G6-H. No outside provider calls in
tests, credentials, autonomous public posts, user tracking, paid model
access, redirects, release permission or deployment. All drafts remain
unmerged, and owner/independent evidence controls remain authoritative.
