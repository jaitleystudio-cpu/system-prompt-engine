# SPE-R9-H Studio perf + a11y evidence

- subject SHA: `f406fb709bafafdb2714d1e858768c81bcc1bc80`
- command: `npm run measure:studio-perf-a11y` (in `apps/web`)
- field CWV: **UNKNOWN** (not measured in field; not faked; `pass: false`)
- lab frames: `measure.json` → `frames` (`BROWSER_HARNESS` MEASURED rAF intervals only)
- a11y: no critical blockers (single `#main`, stage `role=region`, reduced-motion 2D fallback, ≥44px targets desktop+390×844)

Honesty: this is a local lab harness, not a field Core Web Vitals claim.
