import { test } from "node:test";
import assert from "node:assert/strict";
import { breakdown, createBlind, revealBlind } from "../../src/pro-studio/core/evalx.ts";

test("breakdown groups by category and language, worst first, small samples flagged, unproven is not pass", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => ({ category: "billing", language: "en", status: i < 5 ? "VERIFIED" : "FAILED" })),
    { category: "legal", language: "hi", status: "FAILED" }, { category: "legal", language: "hi", status: "UNPROVEN" },
  ] as const;
  const g = breakdown(rows as never, "category");
  assert.equal(g[0].group, "legal"); assert.equal(g[0].pass, 0); assert.equal(g[0].unproven, 1); assert.equal(g[0].smallSample, true);
  assert.equal(g[1].group, "billing"); assert.equal(g[1].n, 6); assert.equal(g[1].pass, 5); assert.equal(g[1].smallSample, false);
  const l = breakdown(rows as never, "language"); assert.deepEqual(l.map((x) => x.group), ["hi", "en"]);
  assert.equal(breakdown([{ status: "VERIFIED" }] as never, "language")[0].group, "(none)");
});
test("blind A/B: order is randomised per case, browser view hides the source, reveal maps picks back", () => {
  const cases = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }];
  const seq = [0.1, 0.9, 0.2, 0.8]; let i = 0;
  const b = createBlind(cases, ["a1", "a2", "a3", "a4"], ["b1", "b2", "b3", "b4"], () => seq[i++]);
  assert.ok(!JSON.stringify(b.view).match(/"A"|"B"|xIs/), "view leaks mapping");
  assert.equal(b.view[0].x, "a1"); assert.equal(b.view[1].x, "b2");
  const r = revealBlind(b.mapping, { c1: "x", c2: "x", c3: "tie", c4: "y" });
  assert.deepEqual(r.totals, { A: 2, B: 1, tie: 1, unpicked: 0 });
  assert.equal(r.rows[1].winner, "B");
});
test("blind A/B: unpicked cases are counted as unpicked, never as wins", () => {
  const b = createBlind([{ id: "c1" }], ["a"], ["b"], () => 0.3);
  assert.deepEqual(revealBlind(b.mapping, {}).totals, { A: 0, B: 0, tie: 0, unpicked: 1 });
});
