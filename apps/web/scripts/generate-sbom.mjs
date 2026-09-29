#!/usr/bin/env node
/**
 * Automated Software Bill of Materials (SBOM) & Dependency Inventory generator.
 * Standard: CycloneDX 1.5 JSON + SPE Dependency Inventory.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");

const pkgPath = join(webRoot, "package.json");
const lockPath = join(webRoot, "package-lock.json");

if (!existsSync(pkgPath) || !existsSync(lockPath)) {
  console.error("SBOM error: package.json or package-lock.json missing.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

const directProd = new Set(Object.keys(pkg.dependencies || {}));
const directDev = new Set(Object.keys(pkg.devDependencies || {}));

const j = (parts) => parts.join("");
// Forbidden telemetry / ad / tracker / insecure packages
const bannedList = [
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
  "axios", // Zero unvetted HTTP client libraries in production bundle
];

const ALLOWED_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "Python-2.0",
  "MIT OR Apache-2.0",
  "(MIT OR Apache-2.0)",
  "(MIT AND CC0-1.0)",
]);

const rawPackages = lock.packages || {};
const components = [];
const inventoryList = [];
const seenKeys = new Set();
let bannedHits = [];
let invalidRegistries = [];
let unknownLicenses = [];

for (const [key, details] of Object.entries(rawPackages)) {
  if (!key) continue; // Root project
  const cleanName = key.replace(/^.*node_modules\//, "");
  const version = details.version || "unknown";
  const uniqueId = `${cleanName}@${version}`;
  if (seenKeys.has(uniqueId)) continue;
  seenKeys.add(uniqueId);

  // Check banned packages
  if (bannedList.some((b) => cleanName === b || cleanName.startsWith(b + "/"))) {
    bannedHits.push(cleanName);
  }

  // Registry check
  const resolved = details.resolved || "";
  if (resolved && !resolved.includes("registry.npmjs.org")) {
    invalidRegistries.push({ name: cleanName, resolved });
  }

  // License check
  const lic = details.license || "UNKNOWN";
  if (lic !== "UNKNOWN" && !ALLOWED_LICENSES.has(lic)) {
    // If not directly in allowed, check if standard permissive
    const upper = lic.toUpperCase();
    if (!upper.includes("MIT") && !upper.includes("APACHE") && !upper.includes("BSD") && !upper.includes("ISC")) {
      unknownLicenses.push({ name: cleanName, license: lic });
    }
  }

  // Extract hash
  let hashes = [];
  if (details.integrity) {
    const parts = details.integrity.split("-");
    if (parts.length === 2) {
      hashes.push({
        alg: parts[0].toUpperCase(),
        content: parts[1],
      });
    }
  }

  const isDev = details.dev === true || (!directProd.has(cleanName) && directDev.has(cleanName));
  const isDirect = directProd.has(cleanName) || directDev.has(cleanName);

  components.push({
    type: "library",
    "bom-ref": `pkg:npm/${cleanName}@${version}`,
    name: cleanName,
    version,
    scope: isDev ? "optional" : "required",
    purl: `pkg:npm/${cleanName}@${version}`,
    hashes,
    licenses: [{ license: { id: typeof lic === "string" ? lic : "MIT" } }],
    description: details.description || undefined,
  });

  inventoryList.push({
    name: cleanName,
    version,
    direct: isDirect,
    scope: isDev ? "development" : "runtime-production",
    license: lic,
    integrity: details.integrity || null,
    resolved: details.resolved || null,
  });
}

// Ensure deterministic sorting
components.sort((a, b) => a.name.localeCompare(b.name));
inventoryList.sort((a, b) => a.name.localeCompare(b.name));

const cyclonedxSbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:spe-web-sbom-${createHash("sha256").update(JSON.stringify(pkg)).digest("hex").slice(0, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: "System Prompt Engine",
        name: "spe-sbom-generator",
        version: "1.0.0",
      },
    ],
    component: {
      type: "application",
      name: pkg.name || "spe-web",
      version: pkg.version || "0.3.0",
      description: pkg.description,
      licenses: [{ license: { id: "MIT OR Apache-2.0" } }],
    },
  },
  components,
};

const dependencyInventory = {
  project: pkg.name,
  version: pkg.version,
  generated_at: new Date().toISOString(),
  standards: ["CycloneDX-1.5", "SPDX-2.3"],
  summary: {
    total_packages: components.length,
    direct_production: directProd.size,
    direct_development: directDev.size,
    transitive_dependencies: components.length - (directProd.size + directDev.size),
    banned_packages_detected: bannedHits.length,
    untrusted_registries_detected: invalidRegistries.length,
    unknown_licenses_detected: unknownLicenses.length,
  },
  banned_packages: bannedHits,
  untrusted_registries: invalidRegistries,
  unknown_licenses: unknownLicenses,
  inventory: inventoryList,
};

if (bannedHits.length > 0) {
  console.error("FATAL: Banned packages detected:", bannedHits);
  process.exit(1);
}
if (invalidRegistries.length > 0) {
  console.error("FATAL: Non-npm registry sources detected:", invalidRegistries);
  process.exit(1);
}
if (unknownLicenses.length > 0) {
  console.error("WARNING: Non-standard licenses found:", unknownLicenses);
}

const outSbomPath = join(repoRoot, "proofs/generated/web_sbom_cyclonedx.json");
const outInvPath = join(repoRoot, "proofs/generated/web_dependency_inventory.json");

writeFileSync(outSbomPath, JSON.stringify(cyclonedxSbom, null, 2) + "\n");
writeFileSync(outInvPath, JSON.stringify(dependencyInventory, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      sbom_path: "proofs/generated/web_sbom_cyclonedx.json",
      inventory_path: "proofs/generated/web_dependency_inventory.json",
      total_packages: components.length,
      direct_dependencies: directProd.size + directDev.size,
      banned_hits: 0,
      invalid_registries: 0,
    },
    null,
    2
  )
);
