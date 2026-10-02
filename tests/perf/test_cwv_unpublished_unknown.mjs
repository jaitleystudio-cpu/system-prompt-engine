/**
 * Lane perf-truth: unpublished or missing Core Web Vitals stay UNKNOWN.
 * They must not become PASS. This file does not claim a vitals or pixel PASS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assessPublishedCwv } from "../../tools/perf/cwv_truth.mjs";

const START_SHA = "e55fd369f1e5412b5ce7f665a3f354e879ad0779";

test("missing, blank, and omitted vitals stay UNKNOWN rather than PASS", () => {
  const fixtures = [
    {},
    { lcpMs: null, cls: null, inpMs: null },
    { lcpMs: "", cls: "", inpMs: "" },
    { lcpMs: undefined, cls: undefined, inpMs: undefined },
    { status: "PASS" },
    { lcpMs: null, cls: 0, inpMs: null, status: "PASS" },
  ];
  for (const sample of fixtures) {
    const scored = assessPublishedCwv(sample);
    assert.equal(scored.status, "UNKNOWN");
    assert.notEqual(scored.status, "PASS");
    assert.equal(scored.pass, false);
    assert.equal(scored.lcp, "UNKNOWN");
    assert.equal(scored.cls, "UNKNOWN");
    assert.equal(scored.inp, "UNKNOWN");
  }
});

test("finite vitals without a command and SHA stay unpublished UNKNOWN", () => {
  const scored = assessPublishedCwv({
    lcpMs: 120,
    cls: 0.01,
    inpMs: 40,
    status: "PASS",
  });
  assert.equal(scored.status, "UNKNOWN");
  assert.notEqual(scored.status, "PASS");
  assert.equal(scored.lcp, "UNKNOWN");
  assert.equal(scored.cls, "UNKNOWN");
  assert.equal(scored.inp, "UNKNOWN");
  assert.equal(scored.pass, false);
});

test("a published finite sample is not promoted to a vitals PASS", () => {
  const scored = assessPublishedCwv({
    lcpMs: 120,
    cls: 0.01,
    inpMs: 40,
    command: "node tools/perf/measure_lane_cwv.mjs",
    sha: START_SHA,
    status: "PASS",
  });
  assert.equal(scored.status, "MEASURED");
  assert.notEqual(scored.status, "PASS");
  assert.equal(scored.pass, false);
  assert.equal(scored.lcp, 120);
  assert.equal(scored.cls, 0.01);
  assert.equal(scored.inp, 40);
});

test("one unobserved vital keeps the lane UNKNOWN", () => {
  const scored = assessPublishedCwv({
    lcpMs: 800,
    cls: 0,
    inpMs: null,
    command: "node tools/perf/measure_lane_cwv.mjs",
    sha: START_SHA,
    status: "PASS",
  });
  assert.equal(scored.lcp, 800);
  assert.equal(scored.cls, 0);
  assert.equal(scored.inp, "UNKNOWN");
  assert.equal(scored.status, "UNKNOWN");
  assert.notEqual(scored.status, "PASS");
});

test("checked-in lane evidence matches the honesty rule and is not a PASS", () => {
  const evidence = JSON.parse(
    readFileSync(new URL("../../evidence/lane-perf/cwv.json", import.meta.url), "utf8"),
  );
  assert.equal(evidence.subject_sha, START_SHA);
  assert.equal(typeof evidence.command, "string");
  assert.ok(evidence.command.includes("tools/perf/measure_lane_cwv.mjs"));
  const scored = assessPublishedCwv({
    lcpMs: evidence.lcpMs,
    cls: evidence.cls,
    inpMs: evidence.inpMs,
    command: evidence.command,
    sha: evidence.subject_sha,
    status: evidence.status,
  });
  assert.equal(evidence.status, scored.status);
  assert.notEqual(evidence.status, "PASS");
  assert.equal(evidence.pass, false);
  assert.equal(evidence.pixel_pass, false);
  for (const key of ["lcp", "inp", "cls"]) {
    assert.equal(evidence[key], scored[key]);
    if (evidence[key] !== "UNKNOWN") {
      assert.equal(typeof evidence[key], "number");
      assert.ok(Number.isFinite(evidence[key]));
    }
  }
});
