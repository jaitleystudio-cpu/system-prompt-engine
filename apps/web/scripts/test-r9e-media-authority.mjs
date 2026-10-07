#!/usr/bin/env node
/**
 * SPE-R9-E authority separation — the /media UI can never promote writer evidence.
 * Bundles the real MediaRoute.tsx and exercises readRouteClaim (the only path
 * by which /api/media/health updates the product flag). Also runs one mutation
 * (restore PASS acceptance) on a temp copy and requires it to be killed.
 * Builder regression only.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(here, "../src/media");

async function load(source) {
  const out = await build({
    stdin: { contents: source, resolveDir: mediaDir, sourcefile: "MediaRoute.tsx", loader: "tsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
  });
  const dir = mkdtempSync(join(os.tmpdir(), "spe-r9e-ui-"));
  const file = join(dir, "m.mjs");
  writeFileSync(file, out.outputFiles[0].text);
  try {
    return await import(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertions(mod) {
  const { readRouteClaim } = mod;
  assert.equal(typeof readRouteClaim, "function");
  assert.equal(readRouteClaim({ productMediaV1: "PASS", remainingGap: "NONE" }), null, "PASS claim must be ignored");
  assert.equal(readRouteClaim({ productMediaV1: "PASS", remainingGap: "INDEPENDENT_VERIFICATION_REQUIRED", runtimeJourney: "COMPLETE" }), null);
  assert.equal(readRouteClaim({ productMediaV1: "pass", remainingGap: "NONE" }), null);
  assert.equal(readRouteClaim(null), null);
  assert.equal(readRouteClaim("PASS"), null);
  const ok = readRouteClaim({ productMediaV1: "NOT_PASS", remainingGap: "INDEPENDENT_VERIFICATION_REQUIRED", runtimeJourney: "COMPLETE" });
  assert.deepEqual(ok, { flag: "NOT_PASS", gap: "INDEPENDENT_VERIFICATION_REQUIRED", runtimeJourney: "COMPLETE" });
  const incomplete = readRouteClaim({ productMediaV1: "NOT_PASS", remainingGap: "JOURNEY_NOT_RECORDED" });
  assert.deepEqual(incomplete, { flag: "NOT_PASS", gap: "JOURNEY_NOT_RECORDED", runtimeJourney: "" });
}

// Stub React and sibling UI modules so the bundle is a pure-function test of readRouteClaim.
const stub = (src) =>
  src.replace(/^import .* from "react";$/m, "const useEffect = () => {}; const useState = (v) => [v, () => {}];")
     .replace(/^import \{ MediaProductPanel \} from "\.\/MediaProductPanel";$/m, "const MediaProductPanel = () => null;")
     .replace(/^import \{ pinnedWhisperRuntime \} from "\.\/pinnedWhisperRuntime";$/m, "const pinnedWhisperRuntime = {};");

const original = readFileSync(join(mediaDir, "MediaRoute.tsx"), "utf8");
assertions(await load(stub(original)));
console.log("PASS /media UI ignores any PASS claim from the writer route");

const needle = 'if (next !== "NOT_PASS" || typeof nextGap !== "string" || !nextGap) return null;';
assert.ok(original.includes(needle), "mutation anchor missing");
const mutated = original
  .replace(needle, 'if ((next !== "NOT_PASS" && next !== "PASS") || typeof nextGap !== "string" || !nextGap) return null;')
  .replace('return { flag: next, gap: nextGap, runtimeJourney };', 'return { flag: next as "NOT_PASS", gap: nextGap, runtimeJourney };');
let killed = false;
try {
  assertions(await load(stub(mutated)));
} catch (err) {
  killed = err instanceof assert.AssertionError;
}
assert.equal(killed, true, "mutation restore-ui-pass-acceptance SURVIVED");
console.log("KILLED: restore-ui-pass-acceptance");
console.log("PASS: SPE-R9-E media UI authority gate (1/1 mutants killed)");
