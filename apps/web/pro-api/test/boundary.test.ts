// Client/server boundary: Pro logic must run on the server. Browser code under src/pro-studio (except core/)
// may import core modules only with `import type`, and may import shared/ for UI constants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.env.PRO_TEST_ROOT!;
const base = join(root, "src/pro-studio");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "core" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
test("browser code imports core only as types, never pro-api, never the old local trial verifier", () => {
  const bad: string[] = [];
  for (const f of walk(base)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) {
      const [, isType, spec] = m; const rel = relative(root, f);
      if (/(^|\/)core\//.test(spec) && !isType) bad.push(`${rel}: value import from ${spec}`);
      if (/pro-api/.test(spec)) bad.push(`${rel}: imports ${spec}`);
      if (/entitlementVerifier/.test(spec)) bad.push(`${rel}: uses local licence verifier ${spec}`);
    }
    if (/import\(\s*["'][^"']*core\//.test(src)) bad.push(`${relative(root, f)}: dynamic import of core`);
  }
  assert.deepEqual(bad, []);
});
test("shared/ modules do not import core values either", () => {
  const dir = join(base, "shared"); const bad: string[] = [];
  for (const f of readdirSync(dir)) { const src = readFileSync(join(dir, f), "utf8"); for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) if (!m[1] && /core\//.test(m[2])) bad.push(`${f}: ${m[2]}`); }
  assert.deepEqual(bad, []);
});
