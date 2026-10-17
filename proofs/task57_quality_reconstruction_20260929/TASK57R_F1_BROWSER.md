# Task57R-F1 browser

Local Google Chrome 154.0.8037.58, headless, against the built `apps/web/dist` on `127.0.0.1`. Service workers were blocked so the page used that local server. This is not a static source reading.

| Case | Result |
| --- | --- |
| Canonical Create click | PASS. A prompt was shown. |
| Repairable / reconstructed prompt | NOT_OBSERVED. The quality receipt did not say `IMPROVED`, so the page kept the canonical prompt. |
| Unresolved / original remains | PASS. The visible prompt stayed the canonical prompt. |
| Core A unavailable | PASS. Aborting `spe_wasm.wasm` showed Safe fallback, preserved the request text, did not say verified, and did not offer `.spe`. |
| Export consistency | PASS. Visible prompt matched copy, JSON `rendered_prompt`, `.spe` `rendered_prompt`, history artifact prompt, and the history preview prefix. |

The live Create request was: "Write a four-week launch checklist. Budget must remain $2000. Do not invent extra spend." The kernel did not accept a repair for that subject, so the UI correctly did not swap in another prompt. Accepted repair display is covered by the kernel cases and `bindEffectiveSurfaces` tests, not by this click.

This `NOT_OBSERVED` result stays as the F1 historical record. F2 replaced the receipt-text pass with a test-only fault injection. See `TASK57R_F2_REAL_REPAIRED_BROWSER.md`.
