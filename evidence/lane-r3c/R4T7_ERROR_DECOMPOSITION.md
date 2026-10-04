# R4-T7 vision root cause

Frozen parent `ea2a8a7c`. Architecture is the screenshot-IR HTML scaffold plus palette-ground, region-mean-fill, and hide-invented-chrome. Bar stays SSIM >= 0.95. This file is not a product PASS.

Re-measured with `compareVisualBuffers` (`SPE_WINDOWED_SSIM_PIXELMATCH_V1`) on the frozen fixture bytes. Every fixture matched the prior recorded SSIM.

| fixture | measured SSIM | prior | gap to 0.95 | pixel delta % |
|---|---:|---:|---:|---:|
| desktop-landing | 0.9153 | 0.9153 | 0.0347 | 2.311 |
| mobile-app | 0.8375 | 0.8375 | 0.1125 | 24.093 |
| form | 0.8087 | 0.8087 | 0.1413 | 15.745 |
| dashboard-sidebar | 0.7758 | 0.7758 | 0.1742 | 99.965 |
| card-grid | 0.7952 | 0.7952 | 0.1548 | 99.977 |
| dark-difficult | 0.4921 | 0.4921 | 0.4579 | 99.741 |

## Desktop-landing, why 0.0347 short

Exclusive squared-error share, then SSIM if that class of pixels is replaced by the fixture inside the measurement only.

| factor | MSE share | SSIM if class matched | SSIM lift |
|---|---:|---:|---:|
| fontMetrics | 0.8296 | 0.9733 | 0.058 |
| color | 0.1404 | 0.9272 | 0.0119 |
| images | 0.0059 | 0.9155 | 0.0002 |
| gradient | 0.0052 | 0.9158 | 0.0005 |
| lineHeight | 0.0051 | 0.9201 | 0.0048 |
| layoutGeometry | 0.0045 | 0.9154 | 0.0001 |
| letterSpacing | 0.0038 | 0.9123 | -0.003 |
| shadow | 0.0034 | 0.9155 | 0.0002 |
| borderRadius | 0.0021 | 0.9153 | 0 |
| antiAliasing | 0.0001 | 0.9153 | 0 |

Responsive structure at 1280px: the `@media (max-width: 640px)` rule is inactive, so its pixel MSE share is 0.

Font metrics dominate (MSE share 0.8296, lift 0.058 to 0.9733). Color is second and, even if perfect, stops at 0.9272, still under 0.95. The lite IR reports 0 text blocks and typography scale `unknown`, so there is no reconstructed glyph run to emit. Painting OCR words from fixture ink boxes was not used as a repair.

## Repairs not kept

- Region-flow copy inside IR regions, fixed 14/20/12px system-ui, palette ink `#0f172a`: desktop SSIM 0.8929 (worse).
- Collapsing hidden header/footer: desktop SSIM 0.9153 (no change).
- Dominant palette background instead of the region mean: desktop SSIM 0.9138 (worse).

Verdict: HOLD. No product gate was set to PASS.
