# Gap 7 — No unbounded paid API loops

**HOSTING=FORBIDDEN.**

## Local WASM core

- Product compile: `apps/web/src/engine/engine.worker.ts` loads `/spe_wasm.wasm` + integrity JSON same-origin.
- Egress proof script: `apps/web/scripts/egress-proof.mjs` (zero fetch/websocket during evaluate).
- SW regression + privacy copy assert no remote compiler substitute.

## Optional external paths (bounded)

| Path | Bound | Paid? |
|---|---|---|
| URL ingest (`urlIngest.ts`) | 200 KB, 12 s timeout, abortable, user-initiated | No paid proxy |
| ONNX vision | Same-origin models; vision budget; lazy | No cloud vision API |
| Speech | Browser Web Speech; device-qualified optional | No SPE-billed STT |

## Mandatory cloud LLM

**None.** No OpenAI/Anthropic/etc. client in the web package dependencies or compile path.

## Conclusion

Existing zero-egress proofs still hold for the WASM compile core. Optional paths remain bounded. No new mandatory paid API added in gap-closure.
