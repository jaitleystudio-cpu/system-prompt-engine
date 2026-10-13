// Pick the Playwright engine from ENGINE=chromium|webkit|firefox (default chromium).
// Firefox has no isMobile emulation, so that option is dropped there (viewport + touch still apply).
// PW_MODULE: optional path to a newer playwright (e.g. /tmp/pwnew/node_modules/playwright/index.mjs) for engines the pinned 1.49 cannot run on this macOS.
const pw = await import(process.env.PW_MODULE || "playwright");
export const ENGINE = process.env.ENGINE || "chromium";
const strip = (o) => { if (ENGINE === "firefox" && o) { const { isMobile, ...r } = o; return r; } return o; };
export const chromium = { launch: async (opts = {}) => {
  if (ENGINE !== "chromium") { if (opts.channel) throw new Error("channel only for chromium"); }
  const b = await pw[ENGINE].launch(opts); const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = (o) => nc(strip(o)); b.newPage = (o) => np(strip(o)); return b; } };
