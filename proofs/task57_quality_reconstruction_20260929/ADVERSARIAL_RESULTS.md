# Adversarial results

Source: `tests/unit/test_quality_task57.py`.

| Suite | Normal | Adversarial | Result |
| --- | --- | --- | --- |
| Quality Delta | 30 | 26 | dispositions match the vector index |
| Reconstruction | 25 | 20 | plan dispositions match the vector index |
| VALIDATE_ONLY | 20 | 20 | verdicts match the vector index |

Covered attacks include a longer prompt, a lost hard constraint, laundered `UNKNOWN`, inserted authority, an invented fact, a protected-intent mismatch, a conflicting requirement graph, a malformed artifact, missing proof, an unbound effect plan, category and K3 mismatches, a second reconstruction attempt, forbidden repairs, a repair that would regress the candidate, enforcement unavailable, network, credential, external write, execute, and a fabricated `EXECUTION_OBSERVED` proof class.

No adversarial case produced a global quality percentage or an accepted regression.
