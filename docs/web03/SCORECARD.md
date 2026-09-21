# SPE WEB-03 — evidence-based review scorecard

This is an internal review, not an award, independent jury result, or production qualification. A 10/10 visual score is not established.

| Gate | Result | Evidence / limitation |
|---|---|---|
| Mobile Lighthouse performance | 100/100 | Local production build, simulated mobile; LCP 1.4s, TBT 10ms, CLS 0. One lab run, not field INP. |
| Lighthouse accessibility | 100/100 | Automated checks only; no claim of full WCAG conformance. |
| Lighthouse best practices | 100/100 | Automated local audit. |
| axe accessibility | 0 violations | Home with result, workspace, Intent Lens, 320px viewport; WCAG 2 A/AA, 2.1 AA, 2.2 AA tags. |
| Existing Python regression | 450/450 | Exit 0; includes 37 web tests. |
| Rust core | 27/27 | Locked offline dependencies; unchanged core source. |
| Rust WASM tests | 2/2 | Exit 0; release WASM build also succeeds. |
| Real compile integration | PASS | Worker → WASM → spe-core-rs; five returned elements displayed in the tested request. |
| Offline / integrity | PASS | Offline reload + compile; corrupted bytes fail closed with WASM_INTEGRITY_MISMATCH and no result. |
| Responsive | PASS in tested matrix | 320, 360, 390, 768, 1024, 1440, 1920, 2560 CSS px; no horizontal overflow. 200% root text scaling also has no overflow. |
| 4K evidence | CAPTURED | 3840×2160 PNG, 1920×1080 CSS viewport at 2× DPR; no upscaling of a smaller screenshot. Canvas render DPR capped at 2. |
| Creative direction | CHANGES REQUIRED for award target | Original semantic-press geometry and coherent editorial identity; still needs independent art-direction review and richer material composition. |
| Product design | PASS for review build | Clear input, truthful runtime status, actual output, workspace and artifact controls; no usability study performed. |
| 3D / motion | CHANGES REQUIRED for award target | Real lit 3D, pointer perspective, output-driven assembly, scroll transition; not yet a fully choreographed ten-act cinematic experience. |
| Accessibility / mobile | PASS within automated scope | Static reduced-motion and mobile-first loading; physical screen-reader, device and touch testing remains. |
| Performance | PASS in local mobile lab | 100 score after explicit mobile opt-in 3D. Real-device GPU, sustained battery and field metrics remain unmeasured. |

## Verdict

**SPE_WEB03_VISUAL_REBUILD_REQUIRED** for the requested award-caliber / 10-of-10 claim. The implementation is available for review with engineering evidence; it is not being represented as the final award-quality bar.

Priority refinements: independent creative review; real-device GPU/motion validation; deeper semantic-to-artifact choreography without inventing engine phases; usability review of input-to-result flow. No fabricated numerical design rating or user preference data.
