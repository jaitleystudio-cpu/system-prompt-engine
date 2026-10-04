# R5 font-metric iteration

Parent before this change: `fd933d4ccfbf0724ef7f58d4f1b94900758b1705`.
Bar unchanged: SSIM >= 0.95 and pixel delta <= 5%. This is not a product PASS. Non-HTML targets stay HOLD_UNPROVEN. Independent verification is still required.

Reproduced frozen scaffold before the engine change: desktop-landing SSIM 0.9153, pixel delta 2.311.

## Iteration 1 — KEPT

CAUSE: Font-metric pixels were 0.8296 of desktop squared error because the scaffold hid invented labels and never emitted reconstructed glyphs. Region-flow text at a fixed 14/20/12px scale had already been measured at 0.8929 and was not repeated.

CHANGE: `fontMetricLayout.ts` clusters OCR word boxes into runs, chooses a system sans family and weight by advance-width error, fits font size to ink height, caps letter-spacing, and aligns the baseline from canvas ink metrics. Ink is the palette neutral with the strongest contrast to the dominant swatch; a second neutral is used only for shorter runs. The scored HTML is static text. It does not sample per-word fixture RGB, draw the screenshot, or lower the bar.

EXPECTED_DELTA: Desktop SSIM up by about 0.04, toward the font-metric oracle of 0.9733, without a large drop on the other frozen fixtures.

MEASURED_SSIM: desktop-landing 0.9547 (pixel delta 2.136). mobile-app 0.8547 (was 0.8375). form 0.8202 (was 0.8087). dashboard-sidebar 0.7712 (was 0.7758). card-grid 0.8101 (was 0.7952). dark-difficult 0.5008 (was 0.4921).

REGRESSION: dashboard-sidebar −0.0046. Not large. The other fixtures rose. Rectangle replay still fails closed.

KEPT: yes. Desktop clears 0.95. Lane verdict stays HOLD because the other fixtures remain under the bar and React, SwiftUI, Compose, Flutter, and React Native were not visually qualified.
