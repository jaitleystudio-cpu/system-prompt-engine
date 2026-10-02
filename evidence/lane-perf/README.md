# Lane perf-truth evidence

CWV=UNKNOWN

Product shell was not measured. This lane does not own `apps/web` shell, navigation, or routing, so there is no product LCP/INP/CLS score and no vitals or pixel PASS.

- subject SHA: `e55fd369f1e5412b5ce7f665a3f354e879ad0779`
- command: `SPE_PLAYWRIGHT_MODULE=/tmp/spe-perf-pw/node_modules/playwright/index.js node tools/perf/measure_lane_cwv.mjs`
- git HEAD at run: `e55fd369f1e5412b5ce7f665a3f354e879ad0779` (measurer was still uncommitted; page source is that SHA)
- browser: local Google Chrome 154.0.8037.97 via Playwright `channel=chrome`, bound to 127.0.0.1
- result file: `evidence/lane-perf/cwv.json`
- top-level status: UNKNOWN
- pass: false
- pixel_pass: false

`cwv.json` `pages` entries are raw lab samples of standalone crawl documents from that command. They are not a field measurement and they are not a PASS.

Honesty test: `node --test tests/perf/test_cwv_unpublished_unknown.mjs`
