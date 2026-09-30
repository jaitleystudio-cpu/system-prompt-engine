# A6-Q Universal Shell browser QA

**FINAL: A6_Q_UNIVERSAL_SHELL_QA_HOLD**

| Custody | Value |
| --- | --- |
| SHA | `8f6a7870290891020efcc3fde8e9d98a548d4365` |
| Surface | `apps/web` (Vite `127.0.0.1:5173`, no `wasm:build-canonical`) |
| MERGED | NO |
| DEPLOYED | NO |
| HOSTED | NO |
| I1 / I2 / WASM pin | not touched |

Local Chromium (Playwright 1.49) against the dev server. Settled home load: zero console errors, zero HTTP ≥400. No document-level horizontal overflow at 360, 390, 700, 820, 980, 1100, 1280, or 1440 CSS px. No focus trap: forward Tab moves, and the closed mobile nav is `display: none`.

Routes that render their own title and an `h1`: `/`, `/create`, `/code`, `/daily-lab`, `/my-work`, `/capabilities`, `/privacy`, `/workspace`. Daily Lab “Open in SPE” lands on `/create` with the specimen seed and an acquisition chip. The primary nav keeps an in-progress idea. Create’s Build control stays disabled until there is text.

## Defects

### P1 — Footer and SEO links drop the unsaved idea

Primary nav calls `preventDefault` and keeps React state. Footer links in `App.tsx` and the home SEO list in `SeoContent.tsx` are plain `<a href>`. Clicking them is a full document navigation (`performance.navigation.type = navigate`).

Reproduced: type `keep this draft across seo link` on `/`, activate the last `a[href="/create"]` (footer). Result path `/create`, textarea value `""`. The same wipe happens from the footer Create link. The header Create link preserves the draft.

### P1 — Private route is still indexable; no `noindex` anywhere

`apps/web/src` and `index.html` contain no `noindex` / `meta name="robots"`. Runtime check on `/` and `/workspace`: `meta[name=robots]` is null.

`/workspace` is `Disallow` in `apps/web/public/robots.txt`, but `SeoHead` still sets

- canonical `https://systempromptengine.com/workspace`
- Open Graph URL to that same production origin
- `spe-jsonld-app` (`WebApplication`, `url: https://systempromptengine.com`) on every view, including workspace

`robots.txt` itself says hosting is founder-gated, then `Allow: /` plus `Sitemap: https://systempromptengine.com/sitemap.xml`. That is an indexable publication posture. A disallow line is not a noindex.

### P1 — Empty Workspace Build claims preparation was interrupted

`/workspace` enables Build with an empty idea (`disabled` is only `busy`). Create disables Build until there is text.

Clicking Build on an empty workspace shows:

> Your brief is still here.  
> Something interrupted preparation. Review the details below, then try again.

`compile()` actually set `INVALID_JSON` / `Enter what you want SPE to build.` `HumanError` maps every non-timeout code to `ui.errorSupport`, so the real reason stays inside the closed “Technical details” disclosure. The visible alert states an interruption that did not happen.

Evidence: `workspace-empty-alert.png`.

### P2 — Default dark theme strips the primary nav CTA fill

`.spe-nav-links a` (`background: transparent; color: inherit`) beats `.spe-nav-cta`. Light theme has a later `!important` repair. Dark theme (the default) does not.

Computed style, dark: color `rgb(238, 241, 250)`, background `rgba(0, 0, 0, 0)`, opacity `1`.  
Computed style, light: color `rgb(244, 241, 234)`, background `rgb(20, 24, 32)`.

Text on the navy bar is still readable. The control is not dead. The filled pill is gone on the default theme. Crops: `cta-dark.png`, `cta-light.png`.

### P2 — Unknown paths become Home

`viewFromPath` falls through to `home`, then the mount effect `replaceState`s to `/`. Reproduced for `/no-such-route` and `/CREATE` (case-sensitive miss). No not-found state. Title becomes the home title.

### P2 — Load focus skips the skip link and the primary nav

On load, `document.activeElement` is `#main` (`App.tsx` focuses `#main` on every view, including the first). `main:focus { outline: none }`.

The next six Tab stops are inside the hero (`Make my prompt`, story-step buttons), not the skip link and not the primary nav. Escape does not dismiss the mobile menu (`aria-expanded` stays `true` until the burger is clicked again). Closed menu links are not focusable.

### P2 — Daily Lab prints publication status

Visible meta on `/daily-lab`: `PUBLISH DATE 2026-09-16` and `STATUS published` (specimen `d3d-06` in this session). That is queue metadata, and it is the word the shell shows for a research preview that must not claim publication.

## Not defects

- Quiet home load: no console `error`, no failed responses. Preload of `/art/intent-core.webp` returns `image/webp` (the file is in `public/art/`).
- Mode switch labels render as Create / Inspect / Proof.
- Speech controls have text names (`Start microphone`, and so on). An earlier unnamed-button note was a false positive from `innerText` inside a closed panel.
- No focus trap and no horizontal page overflow in the widths above.
- Mobile header at 390px does not overlap: brand, “SYSTEM PROMPT ENGINE”, theme toggle, and burger sit in separate boxes inside a 72px bar (`nav-390-header.png`).
