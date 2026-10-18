#!/usr/bin/env node
// Pro Studio test runner. The box/CI Node may be 20.x (no --experimental-strip-types), so each
// pro-api/test/*.test.ts file is bundled with esbuild and run with the built-in node:test runner.
// Usage: node scripts/test-pro-studio.mjs [filter]
import { build } from "esbuild";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "pro-api/test");
const out = join(root, "node_modules/.cache/pro-tests");
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const filter = process.argv[2] || "";
const files = readdirSync(dir).filter((f) => f.endsWith(".test.ts") && f.includes(filter)).sort();
if (!files.length) { console.error("No test files matched."); process.exit(2); }
const outs = []; const buildFailed = [];
for (const f of files) {
  const o = join(out, f.replace(/\.ts$/, ".mjs"));
  try { await build({ entryPoints: [join(dir, f)], bundle: true, platform: "node", format: "esm", target: "node20", outfile: o, logLevel: "error", jsx: "automatic",
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
  outs.push(o); } catch (e) { buildFailed.push(f); console.error(`BUILD FAILED (counts as failing): ${f}\n${String(e.message).split("\n").slice(0, 4).join("\n")}`); }
}
const r = outs.length ? spawnSync(process.execPath, ["--no-warnings", "--test", "--test-reporter=spec", ...outs], { stdio: "inherit", env: { ...process.env, PRO_TEST_ROOT: root } }) : { status: 1 };
if (buildFailed.length) console.error(`\n${buildFailed.length} test file(s) failed to build: ${buildFailed.join(", ")}`);
process.exit(buildFailed.length ? 1 : r.status ?? 1);
