"""R1 task families: comparator-network discovery. A family is (kind, n).
kind: 'sort' (full sort), 'minmax' (wire 0 = min, wire n-1 = max), 'median' (middle wire = median, odd n).
REFERENCE_SIZE is the size of a fixed, documented reference network (pruned odd-even transposition /
insertion constructions below) used only to normalise quality; BEST_KNOWN is literature optimum for sort
(Knuth TAOCP 5.3.4) and the classical ceil(3n/2)-2 for minmax. Shared by generator and evaluator only as data."""
from __future__ import annotations
from typing import Dict, List, Tuple

Family = Tuple[str, int]
FAMILIES: List[Family] = ([("sort", n) for n in (4, 5, 6, 7, 8, 9, 10, 11, 12)] +
                          [("minmax", n) for n in (4, 5, 6, 7, 8, 9, 10, 11, 12)] +
                          [("median", n) for n in (3, 5, 7, 9, 11)])
BEST_KNOWN: Dict[Family, int] = {("sort", 4): 5, ("sort", 5): 9, ("sort", 6): 12, ("sort", 7): 16, ("sort", 8): 19,
              ("sort", 9): 25, ("sort", 10): 29, ("sort", 11): 35, ("sort", 12): 39}
for _n in (4, 5, 6, 7, 8, 9, 10, 11, 12):
    BEST_KNOWN[("minmax", _n)] = -(-3 * _n // 2) - 2


def fid(f: Family) -> str:
    return f"{f[0]}{f[1]}"
