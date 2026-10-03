import assert from "node:assert/strict";
import test from "node:test";
import { labReport, summarize } from "../../tools/r3g/lab_stats.mjs";
import { assessPublishedCwv } from "../../tools/r3g/cwv_truth.mjs";

test("median and p95 use the measured samples only", () => {
  const stats = summarize([10, 30, 20, 40, 50]);
  assert.equal(stats.n, 5);
  assert.equal(stats.median, 30);
  assert.equal(stats.p95, 50);
});

test("empty samples stay unmeasured", () => {
  const stats = summarize([]);
  assert.equal(stats.n, 0);
  assert.equal(stats.median, null);
  assert.equal(stats.p95, null);
});

test("lab numbers do not publish field CWV", () => {
  const lab = labReport([100, 120], [40, 42, 41, 39]);
  assert.equal(lab.field_cwv, "UNKNOWN");
  assert.equal(lab.pass, false);
  assert.equal(lab.cold.n, 2);
  assert.equal(lab.warm.n, 4);
  const cwv = assessPublishedCwv({
    lcpMs: lab.cold.median,
    cls: 0,
    inpMs: lab.warm.median,
    command: "node tools/r3g/browser_egress_harness.mjs",
    sha: "8afc3564ae608f818e172d15f9e7c38a79a7a9ab",
    field: false,
  });
  assert.equal(cwv.status, "UNKNOWN");
  assert.equal(cwv.lcp, "UNKNOWN");
  assert.equal(cwv.field_cwv, "UNKNOWN");
  assert.equal(cwv.pass, false);
});
