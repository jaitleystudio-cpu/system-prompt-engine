# Task57R product wiring

`App.tsx` captures raw-request custody before Core A, calls `requestQualityReceipt` with `fromK3QualityRequest` after a lawful K3 binding, and uses `delivery-policy.mjs` for terminal routing.

- Prompt brief and conflict: clarification, no fallback.
- Refusal and unsupported: no fallback.
- Engine or K3 failure before a canonical prompt: `SAFE_FALLBACK_PROMPT`.
- Quality failure after a canonical prompt: keep the canonical prompt and validation `UNKNOWN`.
- The screen shows kernel receipt words. It does not calculate a disposition.
- Safe fallback copy is labeled. The `.spe` export button is disabled when there is no canonical artifact.
- `apps/web/scripts/test-quality-product-wiring.mjs` passed.

Gap: `evaluate_from_k3` returns a validation receipt and subject. It does not yet attach a reconstruction record. The app will display a repaired prompt only when the kernel returns `reconstruction.kept == "repaired"` and `plan.disposition == "ACCEPTED"`. That return is not produced by `from_k3` today, so the live Create path keeps the canonical prompt after validation. One-shot `reconstruct` remains tested in the kernel.

The Create screen was not clicked through in a browser in this session. TypeScript `--noEmit` passed, and the wiring script passed.
