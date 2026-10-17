# SPE full-site recovery review

Baseline: `ba11607694a4febc09012d3339dfd8c1be89e44b`

This pass keeps the native animated hero and the existing compiler. It removes the below-hero Three.js story from the Home flow, tightens plain-English copy, and adjusts layout so the primary task stays ahead of optional settings.

## What changed

- Home keeps Hero and HeroStory. ScrollStory is no longer mounted. HomeQuiet states what SPE does, why it is different, and what to do next.
- Create order is idea, desired output, build, then optional sources. Mode switches keep the typed idea.
- Code opens with upload, next step, and what you receive.
- Execution Contract simple view explains the same state as Inspect. Unknown stays unknown.
- My Work, Privacy, Daily Lab, Features, and Workspace use shorter human wording. Daily Lab pause and reduced-motion update without a reload.
- Sources summary uses block layout so an open details element does not steal clicks from controls above it.

## Checks

- Hero story: 62 pass, 0 fail.
- Daily titles: 9635 assertions pass.
- Copy gate: 2361 entries, 0 unreviewed, 0 violations.
- TypeScript and vite build pass.
- Official `npm run build` exits 1 at the existing missing WASM release artifact. The engine artifact was not rebuilt.
- Deployment safety gate exits 2. HOSTING=FORBIDDEN.
- axe on the eight reviewed routes: 0 violations.
- No horizontal overflow at 320, 390, 768, 1024, 1440, 1920, or home at 200% zoom.
- Create flow: idea text survived Text, Speech, Image, Screenshot, Video, URL, and Example. Compile, .spe download, local dry-run, and reopen kept the $2000 budget.

## Not claimed

WORLD #1 is not proven. This is not a WCAG certification and not a human screen-reader pass. Recordings cover Home, Create's basic path, and a Features scroll only.

## Residual

`npm run test:dot-pattern` fails because Hero.tsx has no `<DotPattern surface="hero"/>`. That marker is already absent at the baseline. The native hero was not edited to satisfy it.
