#!/usr/bin/env node
/**
 * SPE-R9-G repair — mutation gate for the network execution boundary.
 * Mutates a temporary copy of engine/multimodal/urlSecurity.ts only; the
 * production source is never modified. Each mutant must be killed by
 * scripts/test-network-execution-boundary.mjs with an AssertionError.
 */
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(__dirname, "../src/engine/multimodal/urlSecurity.ts");
const gate = path.join(__dirname, "test-network-execution-boundary.mjs");

const MUTANTS = [
  ["skip-per-hop-lexical-validation", "const lexical = isSsrfSafeUrl(parsed);\n    if (!lexical.safe) {", "const lexical = isSsrfSafeUrl(parsed);\n    if (false && !lexical.safe) {"],
  ["accept-private-resolved-address", "if (check.forbidden) return { ok: false, reason: `RESOLVED_", "if (false && check.forbidden) return { ok: false, reason: `RESOLVED_"],
  ["dns-failure-fails-open", 'return { ok: false, reason: "DNS_RESOLUTION_FAILED" };', 'return { ok: true, addresses: ["93.184.215.14"], literal: false };'],
  ["validate-only-first-dns-answer", "for (const answer of answers) {", "for (const answer of answers.slice(0, 1)) {"],
  ["accept-opaque-browser-redirect", 'if (response.type === "opaqueredirect") {', 'if (false && response.type === "opaqueredirect") {'],
  ["transport-auto-follows-redirects", '{ ...(opts.init || {}), redirect: "manual" }', '{ ...(opts.init || {}), redirect: "follow" }'],
  ["drop-pinned-binding-requirement", "} else if (policy === DestinationPolicies.REQUIRE_PINNED_RESOLUTION) {", "} else if (false) {"],
  ["drop-embedded-ipv6-lexical-classification", "if (literalCheck.family !== 6 || literalCheck.forbidden) {", "if (false) {"],
  ["ipv4-mapped-private-treated-public", "      ? { family: 6, forbidden: true, reason: `IPV4_MAPPED_${check.reason}` }", "      ? { family: 6, forbidden: false }"],
  ["drop-redirect-limit", "if (redirects + 1 > maxRedirects) {", "if (false) {"],
];

const original = readFileSync(source, "utf8");
let killed = 0;
for (const [name, needle, replacement] of MUTANTS) {
  assert.ok(original.includes(needle), `mutation anchor missing: ${name}`);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "spe-r9g-net-mut-"));
  try {
    const mutatedPath = path.join(tmp, "urlSecurity.ts");
    cpSync(source, mutatedPath);
    const mutated = original.replace(needle, replacement);
    assert.notEqual(mutated, original, `mutation did not apply: ${name}`);
    writeFileSync(mutatedPath, mutated);
    const result = spawnSync(process.execPath, ["--experimental-strip-types", gate], {
      encoding: "utf8",
      env: { ...process.env, SPE_URL_SECURITY_PATH: mutatedPath },
    });
    assert.notEqual(result.status, 0, `${name} mutation SURVIVED\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr + result.stdout, /AssertionError/, `${name} must die by assertion\n${result.stderr}`);
    killed += 1;
    console.log("KILLED:", name);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(`PASS: ${killed}/${MUTANTS.length} network execution-boundary mutants killed.`);
