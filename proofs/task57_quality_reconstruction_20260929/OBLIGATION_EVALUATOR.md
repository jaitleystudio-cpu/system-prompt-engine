# Obligation evaluator

The evaluator reads one candidate and returns per-obligation records:

- `obligation_id`
- `obligation_type`
- `source_ref`
- `status`
- `evidence_refs`
- `reason_codes`

Statuses are only `SATISFIED`, `UNSATISFIED`, `CONFLICT`, `UNKNOWN`, and `NOT_APPLICABLE`. `UNKNOWN` is never stored as `SATISFIED`.

Checked obligations include goal identity, each hard constraint, authority line, each protected fact, unauthorized facts, unsupported claims, invented examples, unknown markers, authorized deliverable text, each bound effect operation, protected-field binding, requirement-graph digest, K3 technique identity, XCAT category identity, and proof presence.

A malformed prompt yields `UNKNOWN` / `MALFORMED_ARTIFACT`. A missing proof yields `UNKNOWN` / `MISSING_PROOF`. A waived hard constraint yields `CONFLICT` / `CONSTRAINT_WEAKENED`.

This evaluator measures SPE-controlled contract evidence. It does not claim that a target model will follow the prompt, that an answer is factually correct, or that a person prefers it.
