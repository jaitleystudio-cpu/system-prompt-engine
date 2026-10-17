#!/usr/bin/env node
/**
 * SPE Ω — Frontier Breakthrough Capabilities Unified Test Harness
 * Master runner for Crown 1 (ILD), Crown 2 (IRT), and Crown 3 (PBE).
 */

import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║     SPE Ω — THREE CROWN BREAKTHROUGH CAPABILITIES QUALIFICATION BATTERY  ║");
console.log("║     1. Intent Loss Detector (ILD)                                        ║");
console.log("║     2. Independent Repair Tournament (IRT)                               ║");
console.log("║     3. Privacy-Budgeted Evolution & Telemetry Minimization (PBE)         ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

const suites = [
  { name: "Crown 1: Intent Loss Detector", script: "test-intent-loss-detector.mjs" },
  { name: "Crown 2: Independent Repair Tournament", script: "test-independent-repair-tournament.mjs" },
  { name: "Crown 3: Privacy-Budgeted Evolution", script: "test-privacy-budgeted-evolution.mjs" },
];

let allPassed = true;
for (const suite of suites) {
  const scriptPath = resolve(__dirname, suite.script);
  console.log(`▶ Executing ${suite.name} (${suite.script})...`);
  try {
    const output = execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
    console.log(output);
  } catch (err) {
    console.error(`❌ Suite failed: ${suite.name}`);
    console.error(err.stdout || err.message);
    allPassed = false;
    process.exit(1);
  }
}

if (allPassed) {
  console.log("🎯 ALL 3 CROWN BREAKTHROUGH SUITES PASSED CONSECUTIVELY AND INDEPENDENTLY (100%)");
}
