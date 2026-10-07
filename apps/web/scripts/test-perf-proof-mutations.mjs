#!/usr/bin/env node
/**
 * SPE-R9-H repair — source mutation gate for perf proof semantics.
 * Mutates TEMPORARY copies of measureScene.ts only; production source is
 * never modified. Each mutant re-introduces one proof defect (including the
 * original desktop×1.3 mobile derivation) and must be killed by the
 * canonical suite scripts/test-v1-1-performance-telemetry.mjs.
 * COST ₹0. not_a_release=true.
 */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "../src");
const suite = path.join(here, "test-v1-1-performance-telemetry.mjs");

function sandbox() {
  const root = mkdtempSync(path.join(os.tmpdir(), "spe-r9h-perf-mut-"));
  mkdirSync(path.join(root, "website-studio/performance"), { recursive: true });
  mkdirSync(path.join(root, "website-studio/model"), { recursive: true });
  mkdirSync(path.join(root, "engine"), { recursive: true });
  cpSync(
    path.join(src, "website-studio/performance/measureScene.ts"),
    path.join(root, "website-studio/performance/measureScene.ts"),
  );
  cpSync(path.join(src, "engine/hashUtils.ts"), path.join(root, "engine/hashUtils.ts"));
  return root;
}

function runSuite(modulePath) {
  return spawnSync(process.execPath, ["--experimental-strip-types", suite], {
    encoding: "utf8",
    env: { ...process.env, SPE_PERF_MODULE_PATH: modulePath },
  });
}

// Baseline: unmutated temp copy must pass, proving the sandbox is faithful.
{
  const root = sandbox();
  try {
    const result = runSuite(path.join(root, "website-studio/performance/measureScene.ts"));
    assert.equal(result.status, 0, `baseline copy failed\n${result.stdout}\n${result.stderr}`);
    console.log("BASELINE: unmutated copy passes canonical suite");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const killed = [];
function mutant(name, needle, replacement) {
  const root = sandbox();
  const file = path.join(root, "website-studio/performance/measureScene.ts");
  try {
    const source = readFileSync(file, "utf8");
    assert.ok(source.includes(needle), `${name}: mutation anchor missing`);
    const mutated = source.replace(needle, replacement);
    assert.notEqual(mutated, source, `${name}: mutation did not apply`);
    writeFileSync(file, mutated);
    const result = runSuite(file);
    assert.notEqual(result.status, 0, `${name} SURVIVED\n${result.stdout}\n${result.stderr}`);
    assert.match(
      result.stdout + result.stderr,
      /AssertionError|mutation survived/,
      `${name} must fail on an assertion, not a crash\n${result.stdout}\n${result.stderr}`,
    );
    killed.push(name);
    console.log("KILLED:", name);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

mutant(
  "S1 desktop×1.3 mobile derivation re-introduced",
  "    mobileFrameP95: environments.mobile.frameP95,\n",
  "    mobileFrameP95:\n      environments.mobile.frameP95 ??\n      (environments.desktop.frameP95 != null ? Number((environments.desktop.frameP95 * 1.3).toFixed(2)) : undefined),\n",
);
mutant(
  "S2 copied-samples guard removed (attach)",
  "  if (sameSamples(candidate.frameTimingsMs, other.frameTimingsMs)) {",
  "  if (false) {",
);
mutant(
  "S3 scaled-samples guard removed (attach)",
  "  if (scaledSamples(candidate.frameTimingsMs, other.frameTimingsMs)) {",
  "  if (false) {",
);
mutant(
  "S4 copied-samples check removed (validator)",
  '      reasons.push("MOBILE_SAMPLES_COPIED_FROM_DESKTOP");',
  "      void 0;",
);
mutant(
  "S5 missing-samples check removed (validator)",
  "    reasons.push(`${tag}_MISSING_FRAME_SAMPLES`);\n",
  "",
);
mutant(
  "S6 MEASURED accepted without BROWSER_HARNESS source (validator)",
  '  if (environment.source !== "BROWSER_HARNESS") {',
  "  if (false) {",
);
mutant(
  "S7 percentile recomputation removed (attach)",
  '    reject("statistical telemetry percentile mismatch");',
  "    void 0;",
);
mutant("S8 minimum samples lowered 60→1", "  minSamples: 60,", "  minSamples: 1,");
mutant("S9 minimum warmup lowered 10→0", "  minWarmupDiscarded: 10,", "  minWarmupDiscarded: 0,");
mutant(
  "S10 mobile viewport class check removed (attach)",
  '    reject("mobile receipt viewport is not a mobile viewport");',
  "    void 0;",
);
mutant(
  "S11 missing-viewport check removed (validator)",
  "    reasons.push(`${tag}_VIEWPORT_MISSING`);",
  "    void 0;",
);
mutant(
  "S12 field CWV pass accepted without field evidence",
  '    if (status.pass !== false) reasons.push("FIELD_PASS_WITHOUT_FIELD_EVIDENCE");',
  "",
);
mutant(
  "S13 aggregate state not weakest-link (MEASURED always)",
  "function weakestState(environments: FrameEnvironmentReceipts): MeasurementState {\n",
  'function weakestState(environments: FrameEnvironmentReceipts): MeasurementState {\n  return "MEASURED";\n',
);
mutant(
  "S14 mirror/environment agreement check removed (validator)",
  '    reasons.push("MOBILE_MIRROR_DISAGREES_WITH_ENVIRONMENT");',
  "    void 0;",
);

console.log(`\nKILLED ${killed.length}/14 source mutants (perf proof semantics). TESTED_LOCALLY only.`);
assert.equal(killed.length, 14);
