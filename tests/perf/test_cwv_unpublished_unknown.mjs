import assert from "node:assert/strict";
import test from "node:test";
import { assessPublishedCwv } from "../../tools/r3g/cwv_truth.mjs";

const SHA = "8afc3564ae608f818e172d15f9e7c38a79a7a9ab";

test("missing metrics stay UNKNOWN", () => {
  const out = assessPublishedCwv({ command: "x", sha: SHA, field: true });
  assert.equal(out.status, "UNKNOWN");
  assert.equal(out.lcp, "UNKNOWN");
  assert.equal(out.cls, "UNKNOWN");
  assert.equal(out.inp, "UNKNOWN");
  assert.equal(out.pass, false);
  assert.equal(out.field_cwv, "UNKNOWN");
});

test("a local lab sample is not a published field score", () => {
  const out = assessPublishedCwv({
    lcpMs: 40,
    cls: 0,
    inpMs: 16,
    command: "node tools/r3g/browser_egress_harness.mjs",
    sha: SHA,
    field: false,
    status: "PASS",
  });
  assert.equal(out.status, "UNKNOWN");
  assert.equal(out.pass, false);
  assert.equal(out.field_cwv, "UNKNOWN");
});

test("numeric vitals without a field publication stay UNKNOWN", () => {
  const out = assessPublishedCwv({
    lcpMs: 40,
    cls: 0,
    inpMs: 16,
    command: "",
    sha: "",
  });
  assert.equal(out.status, "UNKNOWN");
  assert.equal(out.pass, false);
});

test("even a fully populated field-shaped record does not PASS", () => {
  const out = assessPublishedCwv({
    lcpMs: 40,
    cls: 0,
    inpMs: 16,
    command: "field-collector",
    sha: SHA,
    field: true,
  });
  assert.equal(out.status, "MEASURED");
  assert.equal(out.pass, false);
  assert.equal(out.field_cwv, "UNKNOWN");
});

test("non-finite numbers stay UNKNOWN", () => {
  const out = assessPublishedCwv({
    lcpMs: "fast",
    cls: 0,
    inpMs: 1,
    command: "field-collector",
    sha: SHA,
    field: true,
  });
  assert.equal(out.lcp, "UNKNOWN");
  assert.equal(out.status, "UNKNOWN");
  assert.equal(out.pass, false);
});
