# Lighthouse 12 on local `vite preview` (127.0.0.1:4180/redesign/), Playwright Chromium 1148 headless — LAB data, not field data
Host: Mac mini under heavy unrelated load (load avg 8.5–13.6; Antigravity, Chrome running). Run 3 coincided with load 13.6.
| run | mobile perf/a11y/bp/seo | mobile LCP / TBT / CLS | desktop perf/a11y/bp/seo | desktop LCP / TBT / CLS |
|---|---|---|---|---|
| 1 | 100/100/100/60 | 1.6 s / 0 ms / 0 | 99/100/100/60 | 0.5 s / 80 ms / 0 |
| 2 | 100/100/100/60 | 1.6 s / 0 ms / 0 | 99/100/100/60 | 0.7 s / 40 ms / 0 |
| 3 | 82/100/100/60 | 2.0 s / 650 ms / 0 | 29/100/100/60 | 4.0 s / 3,610 ms / 0 |
SEO 60 is caused solely by `is-crawlable` = 0 (the preview is intentionally noindex). Page JS is 1.8 kB, total ≈ 97 KiB.
Earlier runs before the `font-display: optional` fix: desktop CLS 0.314 (font swap on hero stage) — fixed.
Full reports: ~/spe-premium-r1/lh-*-run*.report.html on the Mac mini (not committed).
