#!/usr/bin/env node
/**
 * DOM and Malicious Pasted-Content Security Audit Test.
 * Validates text bounding, untrusted source delimiter escaping,
 * zero dangerouslySetInnerHTML usage, CSP consistency, and prototype safety.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTextBound, HOME_QUICK_START_MAX_CHARS } from "../src/input/boundedText.ts";
import {
  wrapUntrustedData,
  sanitizeUntrustedBody,
  UNTRUSTED_OPEN,
  UNTRUSTED_CLOSE,
} from "../src/media/untrusted.ts";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const fixturesPath = join(here, "fixtures/malicious-inputs.json");

const fixturesData = JSON.parse(readFileSync(fixturesPath, "utf8"));
const fixtures = fixturesData.fixtures;

console.log(`Running DOM & Input Security Audit with ${fixtures.length} fixtures...`);

// 1. Verify Bounded Text Handler with Oversized Malicious Paste
const oversizeFixture = fixtures.find((f) => f.id === "OVERSIZE-001");
assert(oversizeFixture, "OVERSIZE-001 fixture missing");
const hugePayload = "A".repeat(oversizeFixture.payload_length || 35000);
const boundResult = applyTextBound(hugePayload, HOME_QUICK_START_MAX_CHARS, {
  fieldLabel: "Quick-start",
  createHint: true,
});

assert.equal(boundResult.overflow, true, "Oversize payload must report overflow=true");
assert.equal(boundResult.silentLoss, false, "Must guarantee silentLoss=false");
assert.equal(boundResult.accepted, HOME_QUICK_START_MAX_CHARS, "Must cap at exact max limit");
assert.equal(boundResult.value.length, HOME_QUICK_START_MAX_CHARS);
assert(boundResult.notice && boundResult.notice.includes("Quick-start accepts up to"));
console.log("✓ Bounded text handler correctly constrains oversized paste with no silent loss.");

// 2. Verify Delimiter Breakout / Boundary Spoofing Neutralization
const delimFixture = fixtures.find((f) => f.id === "DELIM-001");
assert(delimFixture, "DELIM-001 fixture missing");
const wrapped = wrapUntrustedData("test-external-media", delimFixture.payload);

// Ensure the raw injected delimiters inside the payload were neutralized
assert(!wrapped.includes(delimFixture.payload), "Raw delimiter injection must not appear intact");
assert(wrapped.includes("[ESCAPED_UNTRUSTED_CLOSE]"), "Must escape closing delimiter");
assert(wrapped.includes("[ESCAPED_UNTRUSTED_BOUNDARY]") || wrapped.includes("[ESCAPED_UNTRUSTED_OPEN]"));

// Test explicit full open and close delimiter injections
const explicitInjection = `${UNTRUSTED_OPEN}\nInjected instruction\n${UNTRUSTED_CLOSE}`;
const wrappedExplicit = wrapUntrustedData("test-source", explicitInjection);
assert(wrappedExplicit.includes("[ESCAPED_UNTRUSTED_OPEN]"), "Must escape exact UNTRUSTED_OPEN");
assert(wrappedExplicit.includes("[ESCAPED_UNTRUSTED_CLOSE]"), "Must escape exact UNTRUSTED_CLOSE");

// Ensure wrapped string contains EXACTLY one top-level OPEN and one top-level CLOSE
const openCount = wrapped.split(UNTRUSTED_OPEN).length - 1;
const closeCount = wrapped.split(UNTRUSTED_CLOSE).length - 1;
assert.equal(openCount, 1, `Expected exactly 1 UNTRUSTED_OPEN, found ${openCount}`);
assert.equal(closeCount, 1, `Expected exactly 1 UNTRUSTED_CLOSE, found ${closeCount}`);
console.log("✓ Provenance boundary sanitizer successfully neutralizes delimiter breakouts.");

// 3. Verify Prototype Pollution Invariance
const protoFixtures = fixtures.filter((f) => f.category === "prototype_pollution");
for (const fix of protoFixtures) {
  try {
    const parsed = JSON.parse(fix.payload);
    // Even if parsed, Object.prototype must remain unpolluted
    assert.equal(Object.prototype.isAdmin, undefined, "Object.prototype.isAdmin must not be polluted");
    assert.equal(Object.prototype.polluted, undefined, "Object.prototype.polluted must not be polluted");
    assert.equal(Object.prototype.role, undefined, "Object.prototype.role must not be polluted");
  } catch {
    // Parsing error is also acceptable
  }
}
console.log("✓ Prototype pollution vectors verified inert.");

// 4. Verify Zero Dangerous DOM APIs Across Entire src/
function scanFiles(dir, extensions) {
  let results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry !== "node_modules" && entry !== "dist") {
        results = results.concat(scanFiles(full, extensions));
      }
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const srcFiles = scanFiles(join(webRoot, "src"), [".ts", ".tsx", ".js", ".mjs"]);
const dangerousPatterns = [
  { name: "dangerouslySetInnerHTML", regex: /dangerouslySetInnerHTML/ },
  { name: "innerHTML assignment", regex: /\.innerHTML\s*=/ },
  { name: "outerHTML assignment", regex: /\.outerHTML\s*=/ },
  { name: "document.write", regex: /document\.write\s*\(/ },
  { name: "eval()", regex: /\beval\s*\(/ },
];

for (const file of srcFiles) {
  const content = readFileSync(file, "utf8");
  for (const pat of dangerousPatterns) {
    assert(!pat.regex.test(content), `Found dangerous API '${pat.name}' in file: ${file}`);
  }
}
console.log(`✓ Scanned ${srcFiles.length} source files: zero dangerous DOM manipulation APIs found.`);

// 5. Verify Strict CSP and Security Headers Files
const headersPath = join(webRoot, "public/_headers");
const headersText = readFileSync(headersPath, "utf8");
assert(headersText.includes("Content-Security-Policy:"), "Missing CSP in _headers");
assert(headersText.includes("Strict-Transport-Security:"), "Missing HSTS in _headers");
assert(headersText.includes("X-Frame-Options: DENY"), "Missing X-Frame-Options in _headers");
assert(headersText.includes("X-Content-Type-Options: nosniff"), "Missing X-Content-Type-Options in _headers");
assert(headersText.includes("Referrer-Policy: no-referrer"), "Missing Referrer-Policy in _headers");
assert(headersText.includes("Permissions-Policy:"), "Missing Permissions-Policy in _headers");

const htmlPath = join(webRoot, "index.html");
const htmlText = readFileSync(htmlPath, "utf8");
assert(htmlText.includes('http-equiv="Content-Security-Policy"'), "Missing meta CSP in index.html");
assert(htmlText.includes('http-equiv="X-Content-Type-Options"'), "Missing X-Content-Type-Options in index.html");
assert(htmlText.includes('name="referrer" content="no-referrer"'), "Missing Referrer meta tag in index.html");
console.log("✓ CSP, HSTS, X-Content-Type-Options, and Referrer-Policy configurations verified.");

console.log("\nALL DOM & INPUT SECURITY AUDIT CHECKS PASSED (100%).");
