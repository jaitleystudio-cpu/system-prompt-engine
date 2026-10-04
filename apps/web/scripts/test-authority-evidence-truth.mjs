import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("..", import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server.browser';
      import { AuthorityHub } from './src/pages/AuthorityHub';
      import { GuideArticle } from './src/pages/GuideArticle';
      export { EVIDENCE_LEDGER, AUTHORITY_DOCUMENTS } from './src/authority/evidenceRegistry';
      export const renderHub = () => renderToStaticMarkup(React.createElement(AuthorityHub));
      export const renderGuide = (document) => renderToStaticMarkup(React.createElement(GuideArticle, { document }));
    `,
    resolveDir: web,
  },
  bundle: true, write: false, format: "esm", platform: "browser",
  jsx: "automatic", loader: { ".css": "empty" },
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));

// These three donor records have no attributable measurement receipts.
// Promoting any one, inventing results, or labelling its card verified must fail.
assert.deepEqual(api.EVIDENCE_LEDGER.map((e) => e.id), [
  "EV-2026-COMPILER-01", "EV-2026-PRIVACY-02", "EV-2026-ADAPT-03",
]);
for (const record of api.EVIDENCE_LEDGER) {
  assert.equal(record.status, "provisional", record.id + " must not claim verification without a receipt");
  for (const field of ["dataset", "baseline", "sampleSize", "providerVersion", "date", "rawResults", "lastVerified"])
    assert.equal(record[field], "UNKNOWN", record.id + ": " + field);
  assert.deepEqual(record.evidenceLinks, [], record.id + " must not link invented receipts");
}
const hub = api.renderHub();
assert.ok(hub.includes("0 / 3"), "hub must display zero verified records");
assert.ok(!hub.includes("Verified Evidence Records"), "provisional cards must not be labelled verified");
for (const doc of api.AUTHORITY_DOCUMENTS) {
  const html = api.renderGuide(doc);
  assert.ok(html.includes("UNKNOWN"), doc.slug + " must expose absent results");
  assert.ok(!html.includes("independently evaluated"), doc.slug + " must not invent independent review");
  assert.ok(!html.includes("Invalid Date"), doc.slug + " must render absent verification dates honestly");
  assert.ok(!/sub-50ms|18\.4ms|39\.2ms|500\/500|under 40 milliseconds|16 megabytes|All tests confirmed/.test(html), doc.slug + " must not publish donor fixture measurements as facts");
}
console.log("PASS: all three unreceipted authority records remain provisional; rendered claims and dates are honest.");
