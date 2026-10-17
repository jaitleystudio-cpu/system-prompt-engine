# Budget invariants

`input_budget`, the explicit `budget` atom value, and `output_bound_budget` are the same value.

Checked representations, stored exactly, kind `MUST`:

| Input | Preserved |
|---|---|
| integer `2000` | yes |
| `0` | yes, not treated as absent |
| decimal string `2000.50` | yes, not coerced to a float |
| `$2,000` | yes |
| `USD 2000` | yes |
| `{amount, currency}` | yes |
| `{amount, bound: maximum}` | yes |
| `under $2,000` | yes, not parsed to 2000 |
| `up to $2,000` | yes |
| `exactly $2,000` | yes |
| `No paid ads` | yes, as the supplied string or as a hard constraint |
| `No extra spending` | yes |

Absent or null budget adds no budget atom.

A second budget value on semantic key `budget` stays in `budget_values`. `output_bound_budget` stays the explicit field. It does not become the other amount.

K3, category ids, and prompt strategy do not rewrite the bound. No provider adapter was added.
