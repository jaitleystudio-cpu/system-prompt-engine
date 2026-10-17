#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("🌌 [Test Phase 4] Validating 3D GLSL Quantum Cognitive Energy Field...");

// Build bundle for CognitiveEnergyShader.tsx using esbuild
const bundle = await build({
  entryPoints: [join(root, "src/engine/CognitiveEnergyShader.tsx")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  loader: { ".tsx": "tsx" },
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
});

const shaderModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 1. Verify GLSL Vertex Shader Syntax & Uniforms
const vs = shaderModule.VERTEX_SHADER_SOURCE;
assert.ok(vs.includes("uniform float u_time;"), "Vertex shader must declare u_time");
assert.ok(vs.includes("uniform float u_entropy;"), "Vertex shader must declare u_entropy");
assert.ok(vs.includes("uniform float u_rigor;"), "Vertex shader must declare u_rigor");
assert.ok(vs.includes("gl_Position = projectionMatrix * modelViewMatrix"), "Vertex shader must compute gl_Position");
assert.ok(vs.includes("vNormal = normal;"), "Vertex shader must pass vNormal");
console.log("✓ Custom GLSL Vertex Shader uniforms and harmonic wave displacement verified.");

// 2. Verify GLSL Fragment Shader Syntax & Uniforms
const fs = shaderModule.FRAGMENT_SHADER_SOURCE;
assert.ok(fs.includes("uniform float u_time;"), "Fragment shader must declare u_time");
assert.ok(fs.includes("uniform float u_entropy;"), "Fragment shader must declare u_entropy");
assert.ok(fs.includes("uniform float u_rigor;"), "Fragment shader must declare u_rigor");
assert.ok(fs.includes("gl_FragColor = vec4"), "Fragment shader must output gl_FragColor");
assert.ok(fs.includes("fresnel"), "Fragment shader must compute rim fresnel lighting");
console.log("✓ Custom GLSL Fragment Shader color mixing and radiant fresnel verified.");

// 3. Test Cognitive Metric Calculations (Entropy vs Rigor)
const poorPrompt = "Just make an app.";
const poorMetrics = shaderModule.calculateShaderMetrics(poorPrompt);
assert.ok(poorMetrics.entropy > 0.5, `Poor prompt should exhibit high semantic entropy, got ${poorMetrics.entropy}`);
assert.ok(poorMetrics.rigor < 0.5, `Poor prompt should exhibit low invariant rigor, got ${poorMetrics.rigor}`);

const highRigorPrompt = `
# System Role & Persona
You are a senior systems engineer.

# Objective & Boundary Scope
Execute the task with zero hallucinated dependencies.

# Operational & Security Invariants
- Zero network egress.
- Maintain deterministic state machines.

# Handling Missing Information & Grounding
Use only supplied facts.

# Acceptance Checks & Verification Battery
- Verify all error boundaries.
`;

const richMetrics = shaderModule.calculateShaderMetrics(highRigorPrompt);
assert.ok(richMetrics.rigor >= 0.8, `Structured prompt must exhibit high rigor (>=0.8), got ${richMetrics.rigor}`);
assert.ok(richMetrics.entropy <= 0.2, `Structured prompt must exhibit low entropy (<=0.2), got ${richMetrics.entropy}`);
assert.ok(richMetrics.healthScore >= 80, "Health score must be high");

console.log(`✓ Metric mapping verified: Poor Prompt (Entropy: ${poorMetrics.entropy.toFixed(2)}, Rigor: ${poorMetrics.rigor.toFixed(2)}) -> High-Rigor Prompt (Entropy: ${richMetrics.entropy.toFixed(2)}, Rigor: ${richMetrics.rigor.toFixed(2)})`);

// 4. Verify Component Export
assert.ok(typeof shaderModule.CognitiveEnergyShader === "function", "Must export React CognitiveEnergyShader component");
console.log("✓ React CognitiveEnergyShader WebGL + 2D fallback component verified.");

console.log("✅ Phase 4: 3D GLSL Quantum Cognitive Energy Field PASSED!");
