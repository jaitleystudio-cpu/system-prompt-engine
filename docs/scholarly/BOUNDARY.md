# Lane C boundary — scholarly evidence fabric

Owner: Lane C. Entry point: `spe_runtime.scholarly.compile_evidence_package`.

```
research query
  → open scholarly source registry
  → PaperRecord
  → DOI / PMID / PMCID / arXiv identity
  → dedup
  → correction / retraction state
  → foundational / frontier / contradictory / replication groups
  → ClaimEvidenceGraph + ContradictionMap + GapUnknownMap
  → ContextCapsule candidates
  → EvidencePackage
```

## Not this lane

This package does not import or write:

- `spe_runtime.xcat`
- `spe_runtime.k3`
- `spe_runtime.quality`
- `spe_runtime.grounding` (`ContextCapsule` stays a later mapping)
- Massive Intent storage
- Search / SEO infrastructure
- Visual IR

`EvidencePackage.integration.status` is `NOT_WIRED`.
`semantic_authority` is `NONE` on the package and on the integration block.
`wired_to_k3`, `wired_to_xcat`, and `wired_to_quality` are false.

The outbound scholarly query is the minimized topic. A private prompt, uploaded document, profile, or project context is not sent to a source, including abstract and full-text requests. Full text is retrieved only when the source and the record lawfully expose it (Europe PMC / PMC open full text). An arXiv-only record stays a preprint and its PDF is not downloaded.

Later path, not implemented here:

`EvidencePackage → ContextCapsule → Category Protocol → K3`

Capsule candidates use `integration_status=CANDIDATE_NOT_WIRED`. Their confidence is capped at 0.6. `support_status` is never `SUPPORTED`. Caller assertions are tainted `CALLER_ASSERTED`. An abstract or full-text phrase match is `TENTATIVE` and tainted `CONTENT_TENTATIVE`. It does not make the graph `VALID`.

## Closure rules

- No identifier → the hit is quarantined (`IDENTITY_UNKNOWN`), not admitted.
- Same canonical key with incompatible titles → the cluster is quarantined.
- Retraction omission is `UNKNOWN`, not `NONE`.
- Positive retraction evidence outranks an explicit `NONE` from another source.
- `NONE` plus `UNKNOWN` stays `UNKNOWN`.
- Replication from a title alone is `TITLE_HEURISTIC` and does not create a replication-map link. A link requires a structured publication type or an explicit abstract statement, plus the original record when a hint names it. Result relation stays `UNKNOWN` unless the result phrase is in the abstract or lawful full text.
- Foundational membership is not the oldest paper. It needs a citation count at or above the cohort median and either an older-than-frontier year or a review / systematic review / meta-analysis type. No citation counts yields `FOUNDATIONAL_UNAVAILABLE`.
- Frontier membership is a verified year inside the caller window. The basis includes `NOT_STRENGTH`. Latest is not strongest.
- Contradiction pairs keep both sides. `resolution` is `NONE`. A larger paper count is not a winner.
- Paper type comes from structured publication types. An arXiv-only source is `PREPRINT` and `NOT_PEER_REVIEWED`. A journal article with no mapped type is `OTHER`, and peer-review status stays `UNKNOWN`.
- An absent abstract on a parsed record is `ABSTRACT_ABSENT`. A parser or transport failure is `SOURCE_UNAVAILABLE` or `SOURCE_SHAPE_UNKNOWN`, not a fake absence. Unknown license stays `UNKNOWN`, not open. An open-access flag is not a license name.
- `as_of` is caller-supplied `YYYY-MM-DD`. The fabric does not call the clock.
- `VALID` means the package closed identity, retraction, structured polarity, identity crosswalk, and source fetches. It does not mean the claim is true.

## Run

```python
from spe_runtime.scholarly import ClaimAssertion, compile_evidence_package

package = compile_evidence_package(
    "Does example compound change the outcome?",
    as_of="2026-09-29",
    transport=injected_transport,
    assertions=(
        ClaimAssertion(
            claim_text="Does example compound change the outcome?",
            polarity="SUPPORT",
            doi="10.1000/example.2018",
        ),
    ),
)
```

`allow_network=True` opts into the stdlib client and the registry allowlist. Hosting and deploy are out of scope.
