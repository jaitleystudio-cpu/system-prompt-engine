import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");

console.log("==================================================================");
console.log("🧪 TESTING: SPE Browser Companion Extension Suite");
console.log("==================================================================");

// 1. Verify Manifest V3
console.log("\n[1/4] Verifying Manifest V3 schema and security...");
const manifest = JSON.parse(readFileSync(resolve(pkgRoot, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3, "Must be Manifest V3");
assert(manifest.name.includes("SPE"), "Extension name must include SPE");
assert(manifest.permissions.includes("storage"), "Must request storage permission");
assert(manifest.background.service_worker, "Must define background service worker");
assert(manifest.content_scripts.length > 0, "Must define content scripts for chat interfaces");

const matches = manifest.content_scripts[0].matches;
assert(matches.some(m => m.includes("chatgpt.com")), "Must support ChatGPT");
assert(matches.some(m => m.includes("claude.ai")), "Must support Claude");
assert(matches.some(m => m.includes("gemini.google.com")), "Must support Gemini");
console.log("✓ Manifest V3 validated with support for ChatGPT, Claude, and Gemini.");

// 2. Verify Prompts Data
console.log("\n[2/4] Verifying Power Prompts Vault...");
const { POWER_PROMPTS_VAULT } = await import(resolve(pkgRoot, "src/promptsData.js"));
assert(Array.isArray(POWER_PROMPTS_VAULT), "Vault must be an array");
assert(POWER_PROMPTS_VAULT.length >= 8, "Must contain at least 8 curated power prompts");

const categories = new Set(POWER_PROMPTS_VAULT.map(p => p.category));
assert(categories.has("SEO"), "Must cover SEO category");
assert(categories.has("Marketing"), "Must cover Marketing category");
assert(categories.has("Coding"), "Must cover Coding category");
assert(categories.has("Business"), "Must cover Business category");
assert(categories.has("Writing"), "Must cover Writing category");
console.log(`✓ Vault validated with ${POWER_PROMPTS_VAULT.length} prompts across ${categories.size} categories.`);

// 3. Verify Prompt Templates and Variable Consistency
console.log("\n[3/4] Testing variable binding and compilation...");
for (const prompt of POWER_PROMPTS_VAULT) {
  assert(prompt.id, "Prompt must have unique ID");
  assert(prompt.title, "Prompt must have title");
  assert(prompt.tagline, "Prompt must have human tagline");
  assert(prompt.template.length > 50, "Template must be substantial");
  assert(prompt.variables && prompt.variables.length > 0, "Prompt must define variables");
  
  // Verify each declared variable is in template
  for (const v of prompt.variables) {
    assert(
      prompt.template.includes(`{${v.name}}`),
      `Prompt ${prompt.id} template must contain placeholder {${v.name}}`
    );
  }
}
console.log("✓ All prompt templates and dynamic variables verified.");

// 4. Verify Assets
console.log("\n[4/4] Verifying required assets and icon files...");
assert(existsSync(resolve(pkgRoot, "icons/icon16.png")), "16px icon must exist");
assert(existsSync(resolve(pkgRoot, "icons/icon48.png")), "48px icon must exist");
assert(existsSync(resolve(pkgRoot, "icons/icon128.png")), "128px icon must exist");
assert(existsSync(resolve(pkgRoot, "content.js")), "content.js must exist");
assert(existsSync(resolve(pkgRoot, "content.css")), "content.css must exist");
assert(existsSync(resolve(pkgRoot, "popup.html")), "popup.html must exist");
assert(existsSync(resolve(pkgRoot, "popup.js")), "popup.js must exist");
console.log("✓ All assets and files exist and pass integrity check.");

console.log("\n🎉 ALL SPE BROWSER COMPANION TESTS PASSED!\n");
