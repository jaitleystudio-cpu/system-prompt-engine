# SPE home hero — design QA

**final result: passed**

This is the scoped implementation QA result, not an award rating or founder approval. Founder PASS/HOLD remains pending. Product Design audit, image-to-code interpretation and design-QA skills were used. The user explicitly required native DOM/SVG animation; that takes precedence over the generic skill instruction against recreating illustrative assets with code.

## Visual truth and comparison method

- Source: `apps/web/public/hero/founder-hero-story.png`, 1376 × 768 pixels, horizontal dark storyboard, no browser frame.
- Implementation: `proofs/hero_revision/final/dark-desktop.png` and `light-desktop.png`, 1440 × 1000 CSS/pixels, device scale factor 1, home route, final prompt step.
- Additional evidence: `final/mobile-hero.png` at 390 CSS px width; `final/tablet-hero.png` at 768 CSS px; `final/reduced-motion.png` at 1440 × 1000. Full-height hero crops extend beyond the viewport to show the vertical story. Viewport-only images and local WebM recordings are alongside them.
- The founder source and final desktop/reduced-motion implementation images were opened together in one comparison input. Mobile, tablet and light captures were also visually inspected. No claim of pixel matching: the source is a standalone horizontal illustration; the implementation has a dominant left headline and native scene on the right, with an intentional vertical adaptation through 1100 px.
- No resampling was used to infer exact typography or pixel geometry. Comparisons concern hierarchy, restrained palette, layered fragments, meaning panels, compact SPE element, structure and assembled output. The full-resolution comparison showed the native illustration details clearly enough for this composition review; separate focused crops were not needed. The mobile/tablet hero crops provide a larger readable view of each fragment and prompt line.

## Findings and correction history

1. **P1, rejected baseline:** the previous implementation was a grid of explanatory cards, not one composed scene. Evidence: `proofs/hero_native/after/dark-desktop.png`. Fix: replace the grid with a single native layered illustration. Source thought fragments, intermediate meaning, SPE and final paper share one visual space.
2. **P2, revision round 1:** source-document text overlapped the meaning panel; long headline wrapping weakened hierarchy; mobile prompt and caption collided. Evidence: `proofs/hero_revision/round1/`. Fix: opaque meaning plane, reposition source document, shorter selected title, slightly smaller display type, taller vertical scene and new positions. Verified in `round2/` and final desktop/mobile captures.
3. **P2, tablet follow-up:** the 768 px two-column layout covered part of SPE and compressed the example. Evidence: `proofs/hero_revision/tablet.png`. Fix: extend the vertical composition through 1100 px, center the story within a 600 px maximum width. Verified in `final/tablet-hero.png`; SPE and the final prompt are now separate and readable.
4. No remaining actionable P0/P1/P2 issue was found in the final scoped visual comparison. Existing global navigation and below-hero product surfaces were not redesigned.

## Required fidelity surfaces

- **Fonts/typography:** large Arial/Helvetica headline with an italic Georgia accent; no new font request. The source itself has no equivalent hero headline, so this is intentional editorial hierarchy rather than a font-match claim. Text remains live; no raster text. All 31 title pairs are checked at phone, tablet and wide desktop widths. Small labels are supporting detail; large captions and a semantic text equivalent carry the narrative.
- **Spacing/layout:** a dominant left headline and compact right story on desktop; a vertical art-directed scene on phone/tablet. Final paper no longer touches the caption. Controls have usable hit areas. No horizontal overflow in tested widths; 200% zoom checked.
- **Colors/tokens:** navy/ink, ivory, graphite, cool blue and a restrained champagne edge. Light mode uses ivory canvas and dark text. No neon reactor treatment. Automated hero contrast/accessibility tests cover dark/light/system states.
- **Image quality/assets:** founder PNG unchanged and retained only as reference; it is never requested by the hero. Crisp native text and SVG fragments replace a flat hero picture by explicit user instruction. This is an intentional non-photoreal interpretation, not a claim to match the rendered metal sculpture in the source.
- **Copy/content:** short human English in the headline, support, action and captions. Daily headlines are reviewed rather than generated. The example keeps useful prompt detail. Actual prompt generation and all non-hero copy are preserved.

## Interaction / accessibility evidence

Five stages can be selected; keyboard pause/resume/replay checked. Animation finishes, suspends offscreen and in a hidden document, and reduced motion exposes a complete still composition. The full semantic explanation remains available independently of motion. Runtime errors and PNG requests checked; zero axe violations in the tested hero themes. See `proofs/hero_revision/tests.json` and recordings.

## Remaining limits / follow-up polish

- Founder visual acceptance and independent human usability/language testing remain open.
- No field Core Web Vitals or physical low-end-device claim.
- The illustrative engine is intentionally a compact plate, not a photoreal mechanical recreation.
- Full release build is blocked by the existing WASM packaging issue; local preview build passes. No hosting action.

## Implementation checklist

- [x] Native animated scene and simple website text.
- [x] Local-midnight title rotation and returning-tab refresh.
- [x] Desktop, phone, tablet, light, dark, system and reduced-motion evidence.
- [x] Corrected visual findings and rechecked the rendered result.
- [x] Scoped automated checks and source/evidence manifest.
- [ ] Founder PASS/HOLD.
