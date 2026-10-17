#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("👁️ [Test Phase 2] Building and evaluating Multimodal Neural Vision-to-Architecture Inverse-Compiler...");

// Build bundle for visionInverseCompiler.ts
const bundle = await build({
  entryPoints: [join(root, "src/engine/visionInverseCompiler.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const compiler = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 1. Verify Preset Layouts
const presets = Object.keys(compiler.PRESET_LAYOUTS);
assert.ok(presets.includes("saas-dashboard"), "Must include saas-dashboard preset");
assert.ok(presets.includes("ecommerce-checkout"), "Must include ecommerce-checkout preset");
assert.ok(presets.includes("ai-workbench"), "Must include ai-workbench preset");
console.log(`✓ Presets verified: ${presets.join(", ")}`);

// 2. Test Visual Pixel Analysis (Dark vs Light theme luminance detection)
const darkPixels = new Uint8ClampedArray(400); // all zeroes = dark
for (let i = 0; i < darkPixels.length; i += 4) {
  darkPixels[i] = 15;     // R
  darkPixels[i + 1] = 23; // G
  darkPixels[i + 2] = 42; // B
  darkPixels[i + 3] = 255;
}
const darkAnalysis = compiler.analyzeLayoutFromImageData(1200, 800, darkPixels);
assert.equal(darkAnalysis.theme, "dark", "Must classify dark background correctly");
assert.ok(darkAnalysis.components.length >= 3, "Must segment into >=3 visual components");

const lightPixels = new Uint8ClampedArray(400);
for (let i = 0; i < lightPixels.length; i += 4) {
  lightPixels[i] = 245;    // R
  lightPixels[i + 1] = 245; // G
  lightPixels[i + 2] = 250; // B
  lightPixels[i + 3] = 255;
}
const lightAnalysis = compiler.analyzeLayoutFromImageData(1200, 800, lightPixels);
assert.equal(lightAnalysis.theme, "light", "Must classify light background correctly");
console.log("✓ Local luminance analysis and theme detection verified.");

// 3. Test Inverse Compilation into Typed Architectures
const start = Date.now();
const compiled = compiler.compileArchitectureFromLayout(darkAnalysis, "Production Cloud Dashboard");
const elapsedMs = Date.now() - start;

// Check TypeScript Interfaces
assert.ok(compiled.componentHierarchyTypeScript.includes("export interface"), "Must export TS interfaces");
assert.ok(compiled.componentHierarchyTypeScript.includes("React.FC"), "Must generate React components");

// Check State Machine
assert.ok(compiled.stateMachineModel.includes("applicationReducer"), "Must generate state reducer");
assert.ok(compiled.stateMachineModel.includes("ApplicationState"), "Must define state interface");

// Check OpenAPI Schema
assert.ok(compiled.apiSchemaEndpoints.includes("openapi: 3.1.0"), "Must generate OpenAPI 3.1 contract");

// Check System Prompt Structure
assert.ok(compiled.compiledSystemPrompt.includes("# System Role & Persona"), "Must contain Role header");
assert.ok(compiled.compiledSystemPrompt.includes("# Objective & Boundary Scope"), "Must contain Objective header");
assert.ok(compiled.compiledSystemPrompt.includes("# Architectural Layout Hierarchy"), "Must contain Hierarchy header");
assert.ok(compiled.compiledSystemPrompt.includes("# Operational & Security Invariants"), "Must contain Invariants header");
assert.ok(compiled.compiledSystemPrompt.includes("# Acceptance Checks & Verification Battery"), "Must contain Acceptance Checks header");

// Check Wireframe ASCII
assert.ok(compiled.wireframeAscii.includes("+---"), "Must generate visual ASCII wireframe");

assert.ok(elapsedMs < 100, `Inverse compilation must be supersonic (<100ms), took ${elapsedMs}ms`);

console.log(`✓ Architecture inverse-compilation executed in ${elapsedMs}ms.`);
console.log("✅ Phase 2: Multimodal Neural Vision-to-Architecture Inverse-Compiler PASSED!");
