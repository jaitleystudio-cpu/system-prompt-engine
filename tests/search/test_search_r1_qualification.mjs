/**
 * Search R1 qualification. A failure is preserved donor evidence.
 * Do not weaken an assertion to make a donor defect pass.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { LEDGER, runAll } from "../../qualification/search_r1/oracles.mjs";

const result = await runAll();

test("ledger keeps missing live data unknown", () => {
  assert.equal(LEDGER.liveSerp, "NO");
  assert.equal(LEDGER.searchConsole, "NO");
  assert.equal(LEDGER.fieldCwv, "UNKNOWN");
  assert.notEqual(LEDGER.fieldCwv, 0);
  assert.notEqual(LEDGER.fieldCwv, "PASS");
  assert.equal(LEDGER.semanticAuthority, "NONE");
  assert.equal(LEDGER.hreflangLiveHost, "UNKNOWN");
  assert.equal(LEDGER.lastmodContentAccuracy, "UNKNOWN");
  assert.equal(LEDGER.indexingClaimed, false);
  assert.equal(LEDGER.rankingClaimed, false);
});

for (const [name, row] of Object.entries(result.checks)) {
  test(name, () => {
    assert.deepEqual(row.failures, [], row.failures.join("\n"));
  });
}
