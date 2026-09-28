# SPE Canonical WASM Promotion Report — 2026-09-28

## Mission

Controlled promotion of the independently reproduced canonical SPE WASM
candidate into `apps/web/public/`, plus official build-pipeline closure so
`npm run build` is reproducible from source.

## SHA binding (do not conflate)

| Role | SHA |
| --- | --- |
| SEMANTIC SOURCE SHA | `e0497f79898689a00a30abeab67652d5f6a9193c` |
| TASK A RECIPE SHA | `96ce1ceb000ff04d8fcd324de1da5dfe0d70c909` |
| TASK B INDEPENDENT REPRODUCTION SHA | `c0959b9e73c45a342fc3a90e890e4a49a1fbe0e2` |
| TASK C PROMOTION BRANCH tip (pre-commit) | `c0959b9e73c45a342fc3a90e890e4a49a1fbe0e2` + promotion commits |

The new public WASM does **not** represent new semantic source. Semantic
engines remain frozen at `e0497f7`. Task A added deterministic release
tooling. Task B independently reproduced the candidate. Task C promotes
those bytes and closes the official build path.

## Ancestry

```
e0497f7 (semantic product base)
  → 96ce1ce (Task A recipe)
    → c0959b9 (Task B independent reproduction)
      → cursor/spe-wasm-promotion-20260928 (Task C)
```

## Decision inputs

- Task A canonical candidate = PASS
- Task B independent reproduction = PASS
- Founder promotion approval subject to Task C gates

## Outcomes (summary)

See `FINAL_REPORT.md` for the machine-readable acceptance matrix.
