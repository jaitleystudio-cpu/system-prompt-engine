# SPE-R9-H Studio perf + a11y evidence

- subject SHA: `895a3230d445089b3fdb48fbbb101e7b539f58c8`
- command: `npm run measure:studio-perf-a11y` (in `apps/web`)
- field CWV: **UNKNOWN** (not measured in field; not faked; `pass: false`)
- lab frames: `measure.json` → `frames` (`BROWSER_HARNESS` MEASURED rAF intervals only)
- a11y: no critical blockers (single `#main`, stage `role=region`, reduced-motion 2D fallback, ≥44px targets desktop+390×844)

Honesty: this is a local lab harness, not a field Core Web Vitals claim.
