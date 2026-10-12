# SPE Premium Redesign r1 — Design Direction (PREVIEW ONLY)

Status: proposal for owner review. Preview route `/redesign/` (noindex, unlinked, separate Vite entry
`apps/web/vite.redesign.config.ts`, not part of the production bundle). Copy: HUMAN_COPY_REVIEW_REQUIRED
(see `COPY_MANIFEST.json`). Base: `9637907` (PR #147 head). Not pushed, not deployed.

## 1. What winning dev-tool / AI sites share (research)
| Observation | Source |
|---|---|
| Juries score Design 40%, Usability 30%, Creativity 20%, Content 10%; Dev Award scores Semantics/SEO, Animations, Accessibility, WPO (performance), Responsive, Markup separately | https://www.awwwards.com/sites/cerebrium (SOTD Sep 10 2026), https://www.awwwards.com/sites/ai-in-design-report-2026 (SOTD + Dev Award Aug 26 2026) |
| AI/tech SOTDs pair a near-black base with one or two saturated accents (Oryzo #100904 + #FF8539; Cerebrium #172B76 + #902177) | https://www.awwwards.com/sites/oryzo-ai, https://www.awwwards.com/sites/cerebrium |
| Linear: Inter Variable, 64 px display at weight ~510, tight negative tracking (-1.4 px), 4 px spacing base, accent only on CTAs and one accent moment per screen | https://designlang.vercel.app/gallery/linear-app/linear-app-design-language.md, https://designlang.vercel.app/gallery/linear-app/brand.html |
| Vercel: one sans + one mono, display weight 600 with -2.4 px tracking at 48 px, sentence case, mono only for technical labels; colour lives in one atmospheric gradient | https://www.shadcn.io/design/vercel/raw |
| Raycast: marketing page reads like the product UI scaled up; near-black surface ladder, hairline 1 px borders, 6–10 px card radii, accent reserved for glows/eyebrows/emphasis; never two centred sections in a row | https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md, https://kage.design/designs/raycast-landing-page |
| A11y as a hard constraint: fix the colour, not the check; 4.5:1 body text; visible focus; skip link; semantic headings; live regions for dynamic content | Ads-mcp `ads_get_a11y_guidelines` (colors, focus, screenReaders, aria); Linear brand rule 4 above |

Godly, SiteInspire, FWA, CSS Design Awards and LottieFiles were listed as free sources; in this pass only
Awwwards pages and the design-language write-ups above were actually read. The others: NOT_CONSULTED.
Refero and Mobbin: BLOCKED (paid). No Lottie assets used (motion is hand-written CSS/DOM).

## 2. Type (Inter Variable + JetBrains Mono Variable, both SIL OFL 1.1, self-hosted, latin subset)
Strict hierarchy: exactly one h1; every section h2; every card/FAQ item h3. No skipped levels.
| Role | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|
| h1 | clamp(40px, 7.2vw, 80px) | 620 | 1.02 | -0.035em |
| h2 | clamp(32px, 4.4vw, 52px) | 600 | 1.08 | -0.028em |
| h3 | 20px | 600 | 28px | -0.01em |
| lead | clamp(18px,1.6vw,21px) | 400 | 1.55 | 0 |
| body | 17px | 400 | 1.6 | 0 |
| eyebrow / labels (mono) | 12–13px | 500 | 16px | +0.08em, uppercase |
Inter `cv11`/`ss03` alternates (Raycast-style single-storey a/g detail). `font-display: optional` + preload,
chosen after Lighthouse showed a 0.31 CLS from the font swap on the hero stage.

## 3. Colour (restrained: one accent, four semantic slot hues used only inside the signature moment)
- Surfaces: `#08090B` → `#0F1114` → `#15181D`; hairlines `#252932` / `#343A45`.
- Text: `#F3F4F6` (primary), `#A6ADBA` (secondary, 8.83:1 on bg, 7.89:1 on the lightest surface), `#8A92A0` (tertiary labels, 5.68:1 worst case).
- Accent "signal mint" `#8EF0C6` — eyebrows, focus ring, step numbers, one glow. Nothing else.
- Slot hues (role/goal/constraint/output): `#8EF0C6`, `#9DB8FF`, `#FFB38A`, `#E3A8FF` — all ≥ 9:1 on every surface.

## 4. Grid and spacing
8 px base. Allowed steps: 8, 12 (inner only), 16, 24, 32, 40, 48, 64, 80, 96, 128. Container 1200 px,
24 px gutters. Section rhythm 128 px desktop / 80 px mobile. Radii 12 px (cards inside) / 20 px (panels).
All interactive targets ≥ 48 × 48 px (verified by script: 0 undersized targets at 1440 and 390).

## 5. Motion principles
1. Motion explains, never decorates: the only looping motion is the product story itself.
2. One easing (`cubic-bezier(.2,.8,.2,1)`), 200–600 ms; transform/opacity only (no layout thrash).
3. No WebGL/3D on the critical path. Total page weight ≈ 97 KiB.
4. `prefers-reduced-motion: reduce` → final state, no loop, no caret (verified: 4/4 slots shown).
5. Visible Pause/Play control (WCAG 2.2.2) and pause when the tab is hidden.

## 6. Signature interaction — "The brief resolves"
The hero is a product window (`brief.txt → system-prompt.md`). A plain-English request sits on the left.
Phrase by phrase, each fragment lights up in its semantic hue and its counterpart lands in a structured slot
on the right: Role → Goal → Constraint → Output. It shows what SPE does in ~5 s without a single claim.
Inspired by Raycast's "marketing page as product UI" and Linear's single accent moment per screen.

## 7. Copy rules
Short, specific, sentence case, truthful. Banned: "100%", "zero", "guaranteed", "air-gapped", "live",
savings figures, rankings. Every string is in COPY_MANIFEST.json, status HUMAN_COPY_REVIEW_REQUIRED.
Capability and privacy lines must be checked against the product-truth ledger before release.
