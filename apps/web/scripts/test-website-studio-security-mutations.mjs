#!/usr/bin/env node
/**
 * SPE-R9-G — adversarial mutation gate for Studio security.
 * Mutates temporary copies only. Production source is never modified.
 * Each deliberate defect must be killed by the canonical acceptance assertions.
 */
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const studioSrc = path.join(__dirname, "../src/website-studio");
const urlSecuritySrc = path.join(
  __dirname,
  "../src/engine/multimodal/urlSecurity.ts",
);

function runMutation(name, mutate, assertionBody) {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "spe-r9g-sec-mut-"));
  const studioDir = path.join(tmpRoot, "website-studio");
  const engineDir = path.join(tmpRoot, "engine/multimodal");
  try {
    cpSync(studioSrc, studioDir, { recursive: true });
    mkdirSync(engineDir, { recursive: true });
    cpSync(urlSecuritySrc, path.join(engineDir, "urlSecurity.ts"));
    mutate(studioDir);

    const runner = path.join(tmpRoot, "runner.mjs");
    writeFileSync(
      runner,
      [
        'import assert from "node:assert/strict";',
        'import { pathToFileURL } from "node:url";',
        'import path from "node:path";',
        "const root = process.argv[2];",
        'const security = await import(pathToFileURL(path.join(root, "security/studioSecurity.ts")).href);',
        'const dataBinding = await import(pathToFileURL(path.join(root, "model/dataBinding.ts")).href);',
        assertionBody,
      ].join("\n"),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", runner, studioDir],
      { encoding: "utf8" },
    );
    assert.notEqual(
      result.status,
      0,
      name + " mutation survived\n" + result.stdout + "\n" + result.stderr,
    );
    assert.match(
      result.stderr + result.stdout,
      /AssertionError|Missing expected exception/i,
      name +
        " must fail for the expected assertion reason\n" +
        result.stdout +
        "\n" +
        result.stderr,
    );
    console.log("KILLED:", name);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

runMutation(
  "disable-active-document-gate",
  (studioDir) => {
    const file = path.join(studioDir, "security/studioSecurity.ts");
    const source = readFileSync(file, "utf8");
    const needle =
      "const ACTIVE_DOCUMENT =\n  /<\\s*script\\b|javascript\\s*:|vbscript\\s*:|<\\s*iframe\\b|<\\s*object\\b|<\\s*embed\\b|<\\s*foreignObject\\b|\\son[a-z]+\\s*=/i;";
    assert.ok(source.includes("const ACTIVE_DOCUMENT ="), "mutation anchor missing");
    // Replace matching regex with never-matching pattern.
    const mutated = source.replace(
      /const ACTIVE_DOCUMENT =\n  \/[^;]+;/m,
      "const ACTIVE_DOCUMENT =\n  /(?!)/;",
    );
    assert.notEqual(mutated, source, "ACTIVE_DOCUMENT mutation did not apply");
    writeFileSync(file, mutated);
  },
  [
    "try {",
    '  security.sanitizeStudioSvg(\'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>\');',
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

runMutation(
  "disable-ssrf-url-gate",
  (studioDir) => {
    const file = path.join(studioDir, "security/studioSecurity.ts");
    const source = readFileSync(file, "utf8");
    const needle = "if (!check.safe) {";
    assert.ok(source.includes(needle), "mutation anchor missing: SSRF check");
    writeFileSync(file, source.replace(needle, "if (false && !check.safe) {"));
  },
  [
    "try {",
    '  security.assertSafeStudioFetchUrl("http://127.0.0.1/secret");',
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

runMutation(
  "disable-package-size-bound",
  (studioDir) => {
    const file = path.join(studioDir, "security/studioSecurity.ts");
    const source = readFileSync(file, "utf8");
    const needle =
      "if (utf8ByteLength(raw) > MAX_STUDIO_PACKAGE_BYTES) {";
    assert.ok(source.includes(needle), "mutation anchor missing: package bound");
    writeFileSync(
      file,
      source.replace(
        needle,
        "if (false && utf8ByteLength(raw) > MAX_STUDIO_PACKAGE_BYTES) {",
      ),
    );
  },
  [
    "try {",
    "  security.assertStudioPackageBounds('y'.repeat(security.MAX_STUDIO_PACKAGE_BYTES + 1));",
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

runMutation(
  "disable-proto-pollution-json-reviver",
  (studioDir) => {
    const file = path.join(studioDir, "security/studioSecurity.ts");
    const source = readFileSync(file, "utf8");
    const needle =
      'if (key !== "" && FORBIDDEN_PROTO_KEYS.has(key)) {';
    assert.ok(source.includes(needle), "mutation anchor missing: proto reviver");
    writeFileSync(
      file,
      source.replace(
        needle,
        'if (false && key !== "" && FORBIDDEN_PROTO_KEYS.has(key)) {',
      ),
    );
  },
  [
    "try {",
    '  security.safeStudioJsonParse(\'{"a":1,"__proto__":{"admin":true}}\');',
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

runMutation(
  "disable-public-fetch-boundary",
  (studioDir) => {
    const file = path.join(studioDir, "model/dataBinding.ts");
    const source = readFileSync(file, "utf8");
    const needle =
      'if (binding.privacyBoundary !== "PUBLIC_FETCH") {';
    assert.ok(
      source.includes(needle),
      "mutation anchor missing: PUBLIC_FETCH boundary",
    );
    writeFileSync(
      file,
      source.replace(
        needle,
        'if (false && binding.privacyBoundary !== "PUBLIC_FETCH") {',
      ),
    );
  },
  [
    "try {",
    "  dataBinding.validateDataBinding({",
    '    id: "b", variable: "v", consumers: [],',
    '    source: { type: "PUBLIC_FETCH", url: "https://example.com/x" },',
    '    privacyBoundary: "LOCAL",',
    "  });",
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

runMutation(
  "disable-remote-url-svg-gate",
  (studioDir) => {
    const file = path.join(studioDir, "security/studioSecurity.ts");
    const source = readFileSync(file, "utf8");
    const needle = "REMOTE_URL.test(stripped) ||";
    assert.ok(source.includes(needle), "mutation anchor missing: REMOTE_URL");
    writeFileSync(
      file,
      source.replace(needle, "false && REMOTE_URL.test(stripped) ||"),
    );
  },
  [
    "try {",
    '  security.sanitizeStudioSvg(\'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>\');',
    '  throw new Error("Missing expected exception");',
    "} catch (err) {",
    '  if (String(err?.message || err).includes("Missing expected exception")) throw err;',
    "}",
  ].join("\n"),
);

console.log("PASS: SPE-R9-G Studio security mutations killed.");
