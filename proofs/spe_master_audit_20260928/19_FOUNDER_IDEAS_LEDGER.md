# Founder ideas ledger

Every ID 1–370 is one row in `01_REQUIREMENTS_LEDGER.csv`.

| Bucket | Count | Rule |
| --- | --- | --- |
| TOTAL | 370 | |
| PROVEN | 69 | implementation and a current passing check |
| PARTIAL | 197 | some of the required behavior |
| MISSING | 48 | NOT_FOUND (42) + SPECIFIED_ONLY (6) |
| IMPLEMENTED_UNPROVEN | 41 | code exists; this SHA did not execute a covering test |
| BLOCKED | 3 | official wasm packaging and DNS policy |
| EXTERNAL_VALIDATION_REQUIRED | 12 | humans, fresh machines |

Missing is not the same as partial. Unproven Python code is not counted as missing.

## Largest missing ideas

- K3 selector (specified only)
- Requirement graph, quality-delta, Plan B, VALIDATE_ONLY, budget preservation (not found)
- Massive Intent modes, OPFS, chunking, provider packing (not found)
- Inline assistant and real provider/MCP adapters (not found or planned only)
- URL scroll storytelling, design DNA, implementation contract (not found)
- Real human ratings (external; sentinel says none yet)
