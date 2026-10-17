# Contradiction results

Detector: frozen `detect_conflicts`. No second engine.

Budget `{amount: 2000, bound: ceiling}` plus a hard constraint with `semantic_key: budget` and value `{amount: 3000}`:

- validity `CONFLICTED`
- conflict type `MUTUALLY_EXCLUSIVE`
- `resolution_state` `UNRESOLVED`
- both values remain in `budget_values`
- `output_bound_budget` stays the explicit 2000 object

A `[CONFLICT]` statement and a non-empty `conflicts` list add `EXPLICIT_CONFIRMED` records and `CONFLICTS_WITH` edges. They are not deleted.

K3 returns disposition `UNKNOWN` with `claims_pass` false when the graph is `CONFLICTED`. It does not pick a budget.
