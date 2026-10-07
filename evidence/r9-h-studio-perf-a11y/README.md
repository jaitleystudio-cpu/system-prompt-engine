# SPE-R9-H Studio perf + a11y evidence

- subject SHA: `30c6657a41fb24d3aec55ba017f1e9927e432fb5`
- command: `npm run measure:studio-perf-a11y` (in `apps/web`)
- field CWV: **UNKNOWN** (not measured in field; not faked; `pass: false`)
- lab frames: `measure.json` → `frames` (`BROWSER_HARNESS` MEASURED rAF intervals only)
- a11y: no critical blockers (single `#main`, stage `role=region`, reduced-motion 2D fallback, ≥44px targets desktop+390×844)

Honesty: this is a local lab harness, not a field Core Web Vitals claim.
