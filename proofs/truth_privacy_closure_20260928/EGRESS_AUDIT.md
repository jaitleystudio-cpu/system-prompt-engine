# EGRESS AUDIT

## Command

`npm run audit:egress` → **PASS**

```
zero_egress: true
fetch_during_evaluate: 0
websocket_during_evaluate: 0
used_ts_fallback: false
```

## Legitimate production network paths (same-origin / optional)

| Path | Purpose |
|---|---|
| `engine.worker.ts` fetch `/spe_wasm.wasm` + sha json | Local engine |
| `onnxSemantic.ts` fetch `/models/...` | Optional same-origin vision pack |
| `sw.js` fetch shell assets | PWA cache |
| `urlIngest.ts` fetch | Only when CSP allows (same-origin); remote → reference-only |

## Search

No analytics / telemetry / tracking pixels / third-party scripts found in product surfaces.
CSP forbids unexpected `connect-src` hosts.

## Unexpected private-prompt egress

**NONE**
