# Batch G — Daily Lab acquisition matrix (Turn 1 inspect)

**Base tip:** `90adbaedba8afcd9b1d48cad7d10b7d21c865e40` (Batch F PASS)  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**Inspected:** 2026-09-26 Asia/Calcutta  
**HOSTING:** FORBIDDEN · **WORLD#1:** NOT_PROVEN

| # | Requirement | Pre-G | Owner(s) | Batch G action |
|---|---|---|---|---|
| 1 | Finite honest queue + date-deterministic rotation | **PRESENT** | `lab/specimens.ts` (`DAILY_3D_QUEUE`=14, `specimensForDate`, `queueHonestyLine`) | Keep; do not expand to 36 3D |
| 2 | Premium 3D stage + reduced-motion path | **PRESENT** | `lab/LabStage.tsx` (`prefers-reduced-motion`) | Keep; no aesthetic redesign |
| 3 | Open in SPE handoff → Create fields | **PARTIAL** | Inline in `App.tsx` `onOpenInSpe` (idea/category/intent/mode) | Extract single owner `lab/labAcquisition.ts`; wire App |
| 4 | Acquisition provenance visible on Create | **MISSING** | — | Banner/chip “From Daily Lab: {title}” / gallery; dismissible |
| 5 | No contamination (invalidate prior draft) | **PRESENT** | `App.tsx` `invalidate()` before seed | Keep via handoff apply path |
| 6 | Desired Output / Example mode compatibility | **PARTIAL** | Batch B `desired-output` / `desired-example` in composer | Seed Desired Output from blurb when empty |
| 7 | Deep-link / shareable specimen | **MISSING** | Pathname-only router | Add cheap `?specimen=<id>` on `/daily-lab` |
| 8 | Copy build prompt CTA reliability | **PRESENT** | `onCopyIdea` + clipboard fallback notice | Keep |
| 9 | Prompt Gallery separated from Daily 3D | **PRESENT** | `PromptGallery.tsx` honesty copy | Keep |
| 10 | Tests: handoff + route + a11y basics | **PARTIAL** | theme-routes `/daily-lab`; adversarial finite-14; Python media/lab | Add `test-lab-acquisition.mjs` |
| 11 | Screenshots dark/light/mobile + post-Open Create | **MISSING** (for G) | — | Capture under `proofs/.../batch_g/` |

## High-value gaps to implement

1. Structured acquisition handoff helper (LabSpecimen | GalleryCard → Create seed).
2. Visible Create provenance chip.
3. Optional Desired Output seed from specimen/gallery blurb.
4. `?specimen=` deep-link on Daily Lab.
5. Focused acquisition tests + Batch G evidence screenshots.

## Explicit non-goals

- No endless daily content claims
- No 36 3D specimens
- No LabStage redesign
- No hosting / workflows / Batch H+
