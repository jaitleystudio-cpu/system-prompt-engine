import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shipped wasm sha256 json is the privacy-tree constant, not a rewritten pin", () => {
  const meta = JSON.parse(readFileSync(new URL("../../apps/web/public/spe_wasm.sha256.json", import.meta.url), "utf8"));
  assert.equal(meta.sha256, "a2a2041b0c2b485b5e61347d6e2f13ce613f3a25c1e2dcccc0e178a7aad347bf");
  assert.equal(JSON.stringify(meta).includes("b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b"), false);
});
