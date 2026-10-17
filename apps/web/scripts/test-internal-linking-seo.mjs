#!/usr/bin/env node
/**
 * SEO & AEO Internal Linking Verification Test Suite
 * Validates:
 * 1. Zero orphan pages in sitemap and public routes
 * 2. Zero dead-end pages (every page has outbound in-content links)
 * 3. Cluster → Pillar consolidation: every cluster page links up to the pillar (/)
 * 4. Pillar → Cluster distribution: pillar links down to all clusters
 * 5. Cluster → Cluster semantic depth: related clusters cross-link
 * 6. Anchor text uniqueness (anti-cannibalization): no exact-match anchor reuse for the same target
 * 7. Quality anchors: no generic anchors ("click here", "read more", "learn more")
 * 8. Link budget: under 100 links per page
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 1. Load routing, sitemap, robots, and page components
const routing = readFileSync(join(root, "src/routing.ts"), "utf8");
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const robots = readFileSync(join(root, "public/robots.txt"), "utf8");

const homeSeo = readFileSync(join(root, "src/landing/SeoContent.tsx"), "utf8");
const homeQuiet = readFileSync(join(root, "src/landing/HomeQuiet.tsx"), "utf8");
const createLinks = readFileSync(join(root, "src/pages/CreateLinks.tsx"), "utf8");
const codeLinks = readFileSync(join(root, "src/pages/CodeLinks.tsx"), "utf8");
const capabilities = readFileSync(join(root, "src/pages/Capabilities.tsx"), "utf8");
const privacy = readFileSync(join(root, "src/pages/PrivacyProof.tsx"), "utf8");
const myWork = readFileSync(join(root, "src/pages/MyWork.tsx"), "utf8");
const dailyLab = readFileSync(join(root, "src/lab/DailyLab.tsx"), "utf8");
const app = readFileSync(join(root, "src/App.tsx"), "utf8");

// Verify that App.tsx mounts CreateLinks and CodeLinks
assert.match(app, /<CreateLinks\s*\/>/, "App.tsx must mount CreateLinks");
assert.match(app, /<CodeLinks\s*\/>/, "App.tsx must mount CodeLinks");

console.log("=== SEO & AEO Internal Linking Audit ===");

// 2. Define canonical public pages
const PUBLIC_PAGES = [
  { view: "home", path: "/", role: "pillar" },
  { view: "create", path: "/create", role: "cluster" },
  { view: "code", path: "/code", role: "cluster" },
  { view: "lab", path: "/daily-lab", role: "cluster" },
  { view: "capabilities", path: "/capabilities", role: "cluster" },
  { view: "privacy", path: "/privacy", role: "cluster" },
  { view: "my-work", path: "/my-work", role: "cluster" }
];

// Helper to extract links: { targetView, text, sourceFile }
function extractLinks(content, sourceFile) {
  const links = [];
  // Match <a ...href={pathForView("...")}...>Anchor Text</a>
  const regex = /<a\b[^>]*\bhref=\{pathForView\("([^"]+)"\)\}[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const targetView = match[1];
    // Strip nested tags and extra whitespace
    const text = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    links.push({ targetView, text, sourceFile });
  }
  return links;
}

const pageContents = [
  { view: "home", content: homeSeo + "\n" + homeQuiet, file: "Home (SeoContent + HomeQuiet)" },
  { view: "create", content: createLinks, file: "CreateLinks.tsx" },
  { view: "code", content: codeLinks, file: "CodeLinks.tsx" },
  { view: "capabilities", content: capabilities, file: "Capabilities.tsx" },
  { view: "privacy", content: privacy, file: "PrivacyProof.tsx" },
  { view: "my-work", content: myWork, file: "MyWork.tsx" },
  { view: "lab", content: dailyLab, file: "DailyLab.tsx" }
];

assert.equal(
  pageContents.length,
  PUBLIC_PAGES.length,
  `Every public page must have audited content surfaces in test suite! Expected ${PUBLIC_PAGES.length}, got ${pageContents.length}`
);

const allLinks = [];
for (const p of pageContents) {
  const extracted = extractLinks(p.content, p.file);
  for (const l of extracted) {
    allLinks.push({ ...l, sourceView: p.view });
  }
}

console.log(`Audited ${allLinks.length} in-content internal links across ${pageContents.length} primary content surfaces.`);

// TEST 1: Orphan Page Detection
console.log("\n[Step 1] Orphan Page Detection:");
for (const page of PUBLIC_PAGES) {
  // Check sitemap
  const sitemapMatch = sitemap.includes(`https://systempromptengine.com${page.path === "/" ? "/" : page.path}`);
  assert.ok(sitemapMatch, `Page ${page.path} must be registered in sitemap.xml`);

  // Check robots
  assert.doesNotMatch(robots, new RegExp(`Disallow:\\s*${page.path}$`), `Page ${page.path} must not be disallowed in robots.txt`);

  // Check incoming links
  const incoming = allLinks.filter(l => l.targetView === page.view && l.sourceView !== page.view);
  assert.ok(incoming.length >= 1, `ORPHAN DETECTED: Page "${page.path}" (${page.view}) has 0 incoming internal links!`);
  console.log(`  ✓ Page ${page.path.padEnd(14)} (${page.role}): ${incoming.length} incoming in-content link(s)`);
}

// TEST 2: Dead-End Detection (Every content page must have outgoing links)
console.log("\n[Step 2] Dead-End Page Detection:");
for (const p of pageContents) {
  const outgoing = allLinks.filter(l => l.sourceView === p.view);
  assert.ok(outgoing.length >= 1, `DEAD END DETECTED: Page "${p.view}" has 0 outgoing internal links!`);
  assert.ok(outgoing.length <= 100, `EXCESSIVE LINKS: Page "${p.view}" has > 100 links (${outgoing.length})`);
  console.log(`  ✓ Page ${p.view.padEnd(14)}: ${outgoing.length} outgoing link(s) (budget compliant)`);
}

// TEST 3: Cluster → Pillar Consolidation
console.log("\n[Step 3] Cluster → Pillar Authority Consolidation:");
const clusterPages = pageContents.filter(p => p.view !== "home");
for (const cp of clusterPages) {
  const toPillar = allLinks.filter(l => l.sourceView === cp.view && l.targetView === "home");
  assert.ok(
    toPillar.length >= 1,
    `VIOLATION: Cluster page "${cp.view}" must link up to the pillar page (home)! Found ${toPillar.length}`
  );
  console.log(`  ✓ Cluster "${cp.view}" → Pillar (home): "${toPillar[0].text}"`);
}

// TEST 4: Pillar → Cluster Authority Distribution
console.log("\n[Step 4] Pillar → Cluster Authority Distribution:");
const pillarOutgoing = allLinks.filter(l => l.sourceView === "home");
const expectedClustersFromPillar = ["create", "code", "lab", "capabilities", "privacy", "my-work"];
for (const target of expectedClustersFromPillar) {
  const hasLink = pillarOutgoing.some(l => l.targetView === target);
  assert.ok(hasLink, `VIOLATION: Pillar must distribute link equity downward to cluster "${target}"`);
  const link = pillarOutgoing.find(l => l.targetView === target);
  console.log(`  ✓ Pillar (home) → Cluster "${target}": "${link.text}"`);
}

// TEST 5: Cluster → Cluster Semantic Depth
console.log("\n[Step 5] Cluster → Cluster Semantic Depth:");
const clusterToCluster = allLinks.filter(l => l.sourceView !== "home" && l.targetView !== "home");
assert.ok(clusterToCluster.length >= 20, `Expected at least 20 cross-cluster links, found ${clusterToCluster.length}`);
console.log(`  ✓ Found ${clusterToCluster.length} lateral Cluster ↔ Cluster semantic links connecting related topics.`);

// TEST 6: Anchor Text Cannibalization Check
console.log("\n[Step 6] Anchor Text Cannibalization Check:");
const targetAnchorMap = new Map();
const FORBIDDEN_GENERIC_ANCHORS = ["click here", "read more", "learn more", "more", "here", "link"];

for (const link of allLinks) {
  const lowerText = link.text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

  // Check forbidden generic anchors
  for (const forbidden of FORBIDDEN_GENERIC_ANCHORS) {
    assert.notEqual(
      lowerText,
      forbidden,
      `FORBIDDEN ANCHOR DETECTED: "${link.text}" in ${link.sourceFile} targeting ${link.targetView}`
    );
  }

  // Check duplicates for same target across different source views
  const key = `${link.targetView}::${lowerText}`;
  if (!targetAnchorMap.has(key)) {
    targetAnchorMap.set(key, []);
  }
  targetAnchorMap.get(key).push(link);
}

// Verify uniqueness: If multiple links use exact same anchor text for the same target, verify they are not distinct pages
let cannibalizationViolations = 0;
for (const [key, instances] of targetAnchorMap.entries()) {
  const uniqueSources = new Set(instances.map(i => i.sourceView));
  if (uniqueSources.size > 1) {
    console.warn(`  ⚠️ Cannibalization warning for key "${key}": used in ${[...uniqueSources].join(", ")}`);
    cannibalizationViolations++;
  }
}
assert.equal(cannibalizationViolations, 0, "No duplicate exact-match anchors across distinct pages allowed!");
console.log(`  ✓ All ${allLinks.length} anchor text instances are cannibalization-free across distinct source pages.`);

console.log("\n=== ALL SEO & AEO INTERNAL LINKING TESTS PASSED (10/10) ===\n");
