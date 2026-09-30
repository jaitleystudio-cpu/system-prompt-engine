/**
 * Repair regression for the two Search R1 donor CWV defects.
 * A missing vital stays UNKNOWN. A supplied finite 0 stays a measurement.
 * Omitted keys must not pass. An unobserved lab vital is not a invented duration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assessLabVitals } from "../../apps/web/scripts/measure-cwv.mjs";

const source = readFileSync(
  new URL("../../apps/web/scripts/measure-cwv.mjs", import.meta.url),
  "utf8",
);

test("null and blank lab vitals stay UNKNOWN", () => {
  for (const sample of [
    { lcpMs: null, cls: null, inpMs: null },
    { lcpMs: "", cls: "", inpMs: "" },
  ]) {
    const scored = assessLabVitals(sample);
    assert.equal(scored.lcp, "UNKNOWN");
    assert.equal(scored.cls, "UNKNOWN");
    assert.equal(scored.inp, "UNKNOWN");
  }
});

test("supplied finite zero remains a measurement", () => {
  const scored = assessLabVitals({ lcpMs: 0, cls: 0, inpMs: 0 });
  assert.equal(scored.lcp, true);
  assert.equal(scored.cls, true);
  assert.equal(scored.inp, true);
});

test("omitted keys do not pass", () => {
  const omitted = assessLabVitals({});
  assert.notEqual(omitted.lcp, true);
  assert.notEqual(omitted.cls, true);
  assert.notEqual(omitted.inp, true);
  assert.equal(Boolean(omitted.cls), false);
  assert.equal(Boolean(omitted.inp), false);
  const partial = assessLabVitals({ lcpMs: 100 });
  assert.equal(partial.lcp, true);
  assert.equal(Boolean(partial.cls), false);
  assert.equal(Boolean(partial.inp), false);
});

test("unobserved lab vitals are not replaced with a duration", () => {
  assert.doesNotMatch(source, /lcpMs:\s*vitals\.lcpMs\s*\|\|\s*Date\.now\(\)\s*-\s*started/);
  assert.doesNotMatch(source, /inpMs:\s*vitals\.inpMs\s*\|\|\s*clickMs/);
  assert.match(source, /lcpMs:\s*null/);
  assert.match(source, /inpMs:\s*null/);
  const unobserved = assessLabVitals({ lcpMs: null, cls: 0, inpMs: null });
  assert.equal(unobserved.lcp, "UNKNOWN");
  assert.equal(unobserved.inp, "UNKNOWN");
  assert.equal(unobserved.cls, true);
});
