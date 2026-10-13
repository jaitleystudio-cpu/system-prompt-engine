# SPE Ω — North Star R1: Source → Replay → Quality → Causal Proof Chain

**Date:** 2026-10-13  
**Governance:** draft, experimental, offline/read-only; NO MERGE, NO DEPLOY, NO PUBLICATION, NO MODEL BILLING.  
**Dependency:** R0 draft PR #151; R1 is a stacked review, not a replacement.

## Commercial north star

Make SPE the most useful, trusted destination when an AI model fails:
an original, reproducible explanation, clear UNKNOWNs, and demonstrably
useful prompts. "World #1" is a goal subject to independent comparative
proof, global usage measurement, and owner review, never a programmatic PASS.

## What R1 actually connects

- **Failure Genome** remains the owner of the failure specimen and preflight.
- **Existing authenticated receipts** verify an owner-enrolled signer for a
  specific source-review message. Signer enrollment and independent source
  verification remain separate authority boundaries.
- **Existing Replay Capsule** verifies a hash-bound capsule matches the model
  revision, incident ID and reproducer. This is data integrity, NOT a real
  model execution. A forged local capsule is cryptographically self-consistent
  but not independent evidence.
- **Quality Delta** compares supplied before and after canonical subjects and
  records measured static obligation movement, including protected regressions.
  It does NOT assert successful external task repair.
- **Causal Proof Graph** stores an evidence-only relationship among the
  incident, review signature, capsule integrity and static prompt comparison.
  It asserts no provider-internal root cause.
- **Existing LVT/G6-H and publishing/SEO owner** retain final authority;
  neither evidence stitching nor a green CI run is release qualification.

## Trust and identity boundaries

The source receipt payload binds schema, review scope, failure ID, exact
model ID/revision, SHA-256 reproducer digest, ordered source URLs and exact
source publication/observation timestamps. The signature must verify against
an owner-pinned public key provided **outside** the incident/report, with
an exact, recognized signer ID. A self-signed receipt cannot add its own key
to this allowlist. Even an authentic receipt establishes a trusted reviewer's
claim about source metadata, NOT truth of the underlying incident.

Replay capsule integrity is checked without executing its replay_fn or making
provider requests. An unsigned self-consistent capsule is NOT evidence of
remote-model reproduction. Repeated, independently observed model runs,
proper tool/environment controls and real model-version provenance must
be separately qualified before any such claim.

Quality Delta is the existing bounded obligation-level evaluation. It does
not measure latent model capability, correctness of a provider output, global
success rates, or causal mechanism. Never infer any of those.

## Required adversarial gates

1. Unenrolled/self-signed source receipt must yield HOLD.
2. Signer signature, payload, source timestamp, URL and model revision
   mutation must yield HOLD.
3. A public source report for a private or unconsented specimen must yield HOLD.
4. Replay capsule with wrong revision, incident, input, or edited output must
   yield HOLD.
5. Verified source metadata + correct capsule must only yield
   READY_FOR_INDEPENDENT_REVIEW, never published/repaired/caused VERIFIED.
6. Static Quality Delta improvement must NOT assert external repair.
7. Static Quality Delta regression must NOT be masked or upgraded.
8. Original prompts, raw model output, secret data, and receipt private keys
   must not leak into the evidence graph or public output.
9. Source-replay chain must not call the network, external model, filesystem,
   or automatically apply any repair.
10. Unit CI and existing canonical WASM and egress checks must pass at
    exact commit; mutation/independent-review gates remain separate.

## Next qualification after R1

A **separately approved R2** may ingest an allowlisted public primary feed
through the existing website/Worker owner and persist an append-only,
timestamped event journal. Record event-observed time separately from
the provider's publication time and from the actual incident start (which
often remains UNKNOWN). Retries, deduplication, feed poisoning, rate limits,
and corrections must be explicitly tested. It must not replace the offline
prompt engine or collect private user prompts.

An **R3** may run *authorized* real provider model evaluations under explicit
credentials and cost bounds. Pin model revisions, frozen dataset, oracles,
tool permissions and independent human/negative controls; measure repeat
failure and outcome improvement across the original and repaired prompts.

A **R4** may present qualified incidents publicly through the existing
SEO/site owner after the independent publishing gate. Unverified,
unlicensed or private material remains off the public index.

## Measurable decision metrics (targets, not results)

- 0 untrusted/self-signed receipts accepted by the owner-pinned verifier.
- 0 model failures or repair claims promoted solely from data hashes.
- 0 regressions of ProtectedIntent accepted as an improved repair.
- 0 synthetic incident or competitor benchmark pages becoming indexable.
- 100% test coverage of the ten adversarial gate families before R1 review.
- Subsequent authenticated-feed pilot: measure latency from source receipt
  (not real-world incident onset), source-claim accuracy and correction delay.
- Subsequent controlled external-model pilot: paired held-out task success,
  error rates and confidence intervals, with preregistered effect thresholds.
- Subsequent distribution pilot: qualified visitor task success, search
  impressions and returning-user rate; never fabricate global #1 rankings.

Current R1 scope offers no validated real external failure, diagnosis,
automated news publishing or quantified competitive superiority.
