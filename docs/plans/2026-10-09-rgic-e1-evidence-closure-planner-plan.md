# RGIC-E1 Evidence Closure Planner Plan
## Objective
Implement RGIC-E1 Evidence Closure Planner.

1. Implement RGIC-E1 Kernel:
- `types.py`: `Obligation`, `ObligationState` (`PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE`), `VerificationAction`, `EvidenceReceipt`, `ClaimScope` (`VERIFIED`, `LIMITED`, `UNRESOLVED`), `EvidenceClosureContract`.
- `closure_planner.py`: Bidirectional evidence compiler: Outcome -> Obligations -> Missing Evidence -> Minimal Probe. Utility optimization.
- `adjudicator.py`: Enforces the conservation law.
- `portable_contract.py`: Implements RFC 8785 canonical serialization of `spe_evidence_closure`.

2. Adversarial Test Battery:
- Rejects ungrounded claims.
- Rejects unauthorized verification actions.
- Strictly preserves `UNKNOWN` on ambiguous/unresolvable tasks.
- Verifies minimal utility-maximizing probe selection.
- Verifies cross-model evidence closure receipt portability and verification.
