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

The outbound scholarly query is the minimized topic. A private prompt, uploaded document, profile, or project context is not sent to a source. Full text is not retrieved. An arXiv-only record stays a preprint.

Later path, not implemented here:

`EvidencePackage → ContextCapsule → Category Protocol → K3`

Capsule candidates use `integration_status=CANDIDATE_NOT_WIRED`. Their confidence is capped at 0.6. `support_status` is never `SUPPORTED`, because this lane does not verify full text. Caller assertions are tainted `CALLER_ASSERTED`.

## Closure rules

- No identifier → the hit is quarantined (`IDENTITY_UNKNOWN`), not admitted.
- Same canonical key with incompatible titles → the cluster is quarantined.
- Retraction omission is `UNKNOWN`, not `NONE`.
- Positive retraction evidence outranks an explicit `NONE` from another source.
- `NONE` plus `UNKNOWN` stays `UNKNOWN`.
- Foundational membership needs a citation count at or above the cohort median, and either an older-than-frontier year or a review / systematic review / meta-analysis type.
- Frontier membership needs a year inside the caller-supplied window (`as_of` minus `frontier_years`).
- Replication from a title alone is `TITLE_HEURISTIC`.
- Contradiction pairs exist only when structured assertions on the same query claim oppose each other (`SUPPORT` and `REFUTE`).
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
