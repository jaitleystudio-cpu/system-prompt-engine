# Constraint invariants

Hard-constraint items stay `MUST` or `MUST_NOT`.

A structured `kind` or `strength` of `PREFERENCE` / `SOFT` inside `hard_constraints` does not downgrade the atom. `MUST_NOT` stays `MUST_NOT`.

Statements such as "must", "do not", "never", "No paid ads", and "No extra spending" remain hard atoms. Their text is not parsed into a new numeric budget.

Distinct hard constraints use `hard_constraint:<source_ref>`. Two compatible obligations are not a `MUTUALLY_EXCLUSIVE` clash. That would have made K3 return `UNKNOWN` for an ordinary multi-constraint brief.

Desired output that is not an example stays `MUST`. An example marker stays `user_supplied_pattern` / `PREFERENCE`.
