# Quality Delta contract

Version: `spe.quality_delta.v1`.

Quality Delta answers which obligations improved, regressed, stayed unchanged, or stayed unresolved between two candidates. It does not emit a 0–100 score, a confidence percentage, or a win probability.

`IMPROVED` requires all of the following:

- at least one obligation moves `UNSATISFIED` or `CONFLICT` to `SATISFIED`
- `protected_regressions` is empty
- no hard constraint is weakened
- protected intent digests match
- XCAT, K3, requirement-graph, and effect-plan identity match
- authority does not expand
- `UNKNOWN` is not rewritten into `SATISFIED`
- no new unsupported fact, example, or claim appears
- proof references are present
- the change is not only a longer or shorter prompt

Other dispositions: `NON_INFERIOR`, `REGRESSED`, `UNRESOLVED`.

A protected-intent mismatch is `UNRESOLVED` with `PROTECTED_INTENT_MISMATCH`. It is not an improvement.

Every `IMPROVED` result lists improved, unchanged, and unresolved obligation ids, evidence refs, and an empty protected-regression list.
