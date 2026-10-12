import assert from "node:assert/strict"; import { mcnemar, pairedDiff } from "./stats.mjs"; let n = 0;
const m = mcnemar([1,1,1,1,1,1,0,1],[0,0,0,0,0,0,0,1]); assert.equal(m.baseline_only, 6); assert.equal(m.candidate_only, 0); assert.ok(Math.abs(m.p - 0.03125) < 1e-9); n++;
assert.equal(mcnemar([1,0],[1,0]).p, 1); n++;
const d = pairedDiff([1,1,1,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0]); assert.equal(d.mean, -0.4); assert.ok(d.lo < -0.4 && d.hi > -0.4 && d.hi < 0); n++;
console.log(JSON.stringify({ suite: "stats-r1", passed: n, failed: 0 }));
