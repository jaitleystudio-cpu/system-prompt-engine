#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — Workstream A mutation/falsification gate.
 *
 * Mutates temporary copies only. Production source is never modified.
 */
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, "../src/website-studio/model");

function runMutation(name, mutate, runnerBody) {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "spe-studio-mutation-"));
  const modelDir = path.join(tmpRoot, "model");
  try {
    cpSync(sourceDir, modelDir, { recursive: true });
    mutate(modelDir);
    const runner = path.join(tmpRoot, "runner.mjs");
    writeFileSync(
      runner,
      [
        'import assert from "node:assert/strict";',
        'import { pathToFileURL } from "node:url";',
        'import path from "node:path";',
        'const model = await import(pathToFileURL(path.join(process.argv[2], "websiteSpecV2.ts")).href);',
        runnerBody,
      ].join("\n"),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", runner, modelDir],
      { encoding: "utf8" },
    );
    assert.notEqual(
      result.status,
      0,
      name + " mutation survived the canonical acceptance assertion",
    );
    assert.match(
      result.stderr + result.stdout,
      /AssertionError|Missing expected exception/,
      name + " must fail for the expected assertion reason",
    );
    console.log("KILLED:", name);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

runMutation(
  "wildcard-agent-authority",
  (modelDir) => {
    const file = path.join(modelDir, "agentPolicy.ts");
    const source = readFileSync(file, "utf8");
    const needle = 'if (list.includes("*")) throw new Error("wildcard agent authority is forbidden");';
    assert.ok(source.includes(needle), "mutation anchor missing");
    writeFileSync(
      file,
      source.replace(
        needle,
        'if (false && list.includes("*")) throw new Error("wildcard agent authority is forbidden");',
      ),
    );
  },
  [
    "const spec = model.createDefaultWebsiteSpecV2();",
    'spec.agentPolicy.execute = ["*"];',
    "assert.throws(() => model.validateWebsiteSpecV2(spec), model.WebsiteSpecV2ValidationError);",
  ].join("\n"),
);

runMutation(
  "reversed-motion-range",
  (modelDir) => {
    const file = path.join(modelDir, "motionBlock.ts");
    const source = readFileSync(file, "utf8");
    const needle = "block.start < 0 || block.end > 1 || block.end < block.start";
    assert.ok(source.includes(needle), "mutation anchor missing");
    writeFileSync(
      file,
      source.replace(
        needle,
        "block.start < 0 || block.end > 1 || false",
      ),
    );
  },
  [
    "const spec = model.createDefaultWebsiteSpecV2();",
    'spec.motionBlocks.push({ id: "bad", semanticType: "custom", start: 0.8, end: 0.2, tracks: {} });',
    "assert.throws(() => model.validateWebsiteSpecV2(spec), model.WebsiteSpecV2ValidationError);",
  ].join("\n"),
);

console.log("PASS: Workstream A canonical-model mutations killed.");
