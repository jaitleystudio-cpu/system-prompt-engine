#!/usr/bin/env node
/**
 * Free-deps audit for SPE web.
 * COST ₹0. NEW_IMPLEMENTATION. not_a_release=true.
 *
 * SPE-WEB-02 allows locally-bundled Three.js / R3F for cinematic product UX.
 * CDN Three.js, analytics, ads, billing remain forbidden.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const pkg = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8"));
const lockPath = join(webRoot, "package-lock.json");
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const j = (parts) => parts.join("");
const banned = [
  "electron",
  j(["@capacitor/", "core"]),
  "cordova",
  j(["react-", "native"]),
  "expo",
  "stripe",
  j(["@sentry/", "browser"]),
  j(["mix", "panel", "-browser"]),
  j(["ampli", "tude", "-js"]),
  j(["@ampli", "tude/", "analytics-browser"]),
  j(["post", "hog", "-js"]),
  j(["@", "analytics/", "google-", "analytics"]),
  "react-ga",
  "react-ga4",
  j(["plausible-", "tracker"]),
  "firebase",
  "next",
  j(["@", "vercel/", "analytics"]),
];

const hits = banned.filter((name) => name in deps);
if (hits.length) {
  console.error("audit-deps: banned packages present:", hits.join(", "));
  process.exit(1);
}

if (!existsSync(lockPath)) {
  console.error("audit-deps: package-lock.json missing");
  process.exit(1);
}
const lock = readFileSync(lockPath, "utf8");
if (!lock.includes("registry.npmjs.org")) {
  console.error("audit-deps: expected registry.npmjs.org in lockfile");
  process.exit(1);
}
const lockBanned = [
  j(["fonts.", "googleapis"]),
  j(["unpkg.com/", "three"]),
  j(["cdn.jsdelivr", ".net/npm/three"]),
  j(["stripe", ".com"]),
];
for (const token of lockBanned) {
  if (lock.includes(token)) {
    console.error(`audit-deps: banned token in lockfile: ${token}`);
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      free_deps_only: true,
      not_a_release: true,
      new_implementation: true,
      package_count: Object.keys(deps).length,
      allowed_visual: ["three", "@react-three/fiber"],
      banned_hits: [],
    },
    null,
    2,
  ),
);
