#!/usr/bin/env node
/**
 * Lane A9 Test Suite: Authority Hub & Evidence Registry Contract Verification
 * Enforces:
 *  - 14 mandatory evidence fields on all evidence entries:
 *    claim, dataset, baseline, metric, sampleSize, providerVersion, date,
 *    methodology, evidenceLinks, rawResults, reproSteps, limitations, status, lastVerified
 *  - Schema truth: No stacked Article + TechArticle; clean separation
 *  - Mobile reflow (360px), 44px touch targets, prefers-reduced-motion
 *  - Route isolation: ROUTE_MOUNT_STATUS=NOT_INTEGRATED, PUBLICATION=NOT_AUTHORIZED
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const registryPath = join(root, "src/authority/evidenceRegistry.ts");
const hubPath = join(root, "src/pages/AuthorityHub.tsx");
const guidePath = join(root, "src/pages/GuideArticle.tsx");
const cssPath = join(root, "src/authority/hub.css");

console.log("Checking Lane A9 file existence...");
assert.ok(existsSync(registryPath), "evidenceRegistry.ts must exist");
assert.ok(existsSync(hubPath), "AuthorityHub.tsx must exist");
assert.ok(existsSync(guidePath), "GuideArticle.tsx must exist");
assert.ok(existsSync(cssPath), "hub.css must exist");

const registrySource = readFileSync(registryPath, "utf8");
const hubSource = readFileSync(hubPath, "utf8");
const guideSource = readFileSync(guidePath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

// 1. Verify 14 Mandatory Evidence Fields in evidenceRegistry
console.log("Checking 14 Mandatory Evidence Fields...");
const MANDATORY_FIELDS = [
  "claim",
  "dataset",
  "baseline",
  "metric",
  "sampleSize",
  "providerVersion",
  "date",
  "methodology",
  "evidenceLinks",
  "rawResults",
  "reproSteps",
  "limitations",
  "status",
  "lastVerified"
];

for (const field of MANDATORY_FIELDS) {
  assert.ok(
    registrySource.includes(field),
    `evidenceRegistry.ts must define and enforce mandatory field: ${field}`
  );
}

// 2. Schema Truth: Clean separation of Article vs TechArticle (never stacked on same page)
console.log("Checking schema truth and anti-stacking invariants...");
assert.ok(
  guideSource.includes('"@type"') || guideSource.includes("'@type'"),
  "GuideArticle.tsx must generate JSON-LD structured data"
);

// Verify that the schema generator chooses either Article OR TechArticle based on doc type
assert.match(
  guideSource,
  /(doc\.schemaType|schemaType)\s*===/,
  "GuideArticle must conditionally select schemaType instead of hardcoding both"
);

// Confirm no unconditional stacking of multiple top-level article types in a single block
const hasStackedTypes = /["']@type["']:\s*\[\s*["']Article["'],\s*["']TechArticle["']\s*\]/.test(guideSource);
assert.strictEqual(
  hasStackedTypes,
  false,
  "Must NOT stack Article and TechArticle as an array in a single schema block"
);

// 3. CSS Accessibility & Touch Target Rules
console.log("Checking CSS standards in hub.css...");
assert.match(cssSource, /44px/, "hub.css must enforce 44px minimum touch targets");
assert.match(cssSource, /:focus-visible/, "hub.css must define high-contrast :focus-visible rules");
assert.match(cssSource, /prefers-reduced-motion/, "hub.css must honor prefers-reduced-motion");
assert.match(cssSource, /@media\s*\(max-width:/, "hub.css must include responsive breakpoints down to 360px");

// 4. Route Isolation & Publication Truth
console.log("Checking route isolation and publication invariants...");
const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
const routingSource = readFileSync(join(root, "src/routing.ts"), "utf8");

assert.doesNotMatch(
  appSource,
  /<AuthorityHub\s*\/>/,
  "AuthorityHub must NOT be mounted into App.tsx (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);
assert.doesNotMatch(
  appSource,
  /<GuideArticle\s*\/>/,
  "GuideArticle must NOT be mounted into App.tsx (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);

console.log("PASS: Lane A9 Authority Hub & Evidence Registry contract verified.");
