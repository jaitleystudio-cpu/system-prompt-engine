#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — Workstream B intent compiler gate.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function load(name) {
  return import(pathToFileURL(path.join(__dirname, "../src/website-studio/intent/", name)).href);
}

const { compileWebsiteIntent, WebsiteIntentCompileError } = await load("compileWebsiteIntent.ts");
const { compileBehaviorIntent } = await load("compileBehaviorIntent.ts");
const { compileCameraIntent } = await load("compileCameraIntent.ts");
const { compileDataIntent } = await load("compileDataIntent.ts");

const brief = compileWebsiteIntent(
  "Build a cinematic 3D website for an electric motorcycle brand with a product reveal and final booking CTA.",
);
assert.equal(brief.siteType, "product");
assert.match(brief.purpose, /electric motorcycle/i);
assert.equal(brief.primaryAction, "booking");
assert.ok(brief.sections.some((s) => /product/i.test(s.intent)));
assert.ok(brief.sections.some((s) => /booking|cta/i.test(s.intent)));

const behavior = compileBehaviorIntent(
  "When visitors reach the product section, rotate the motorcycle and reveal the specifications. On mobile use a simple fade.",
);
assert.equal(behavior.version, "behavior-graph/1");
assert.equal(behavior.rules.length, 1);
assert.equal(behavior.rules[0].trigger.type, "visibility");
assert.equal(behavior.rules[0].trigger.targetId, "product");
assert.ok(behavior.rules[0].actions.some((a) => a.type === "scene-rotate"));
assert.ok(behavior.rules[0].actions.some((a) => a.type === "dom-show"));
assert.ok((behavior.rules[0].fallback || []).some((a) => a.type === "dom-show"));

const hover = compileBehaviorIntent("When users hover the product, rotate it gently.");
assert.equal(hover.rules[0].trigger.type, "hover");

const timer = compileBehaviorIntent("After 5 seconds, reveal the call to action.");
assert.equal(timer.rules[0].trigger.type, "timer");
assert.equal(timer.rules[0].trigger.value, 5000);

const camera = compileCameraIntent(
  "Give this hero a premium automotive camera sequence with a slow orbit and dramatic push-in.",
);
assert.ok(camera);
assert.ok(camera.shots.length >= 2);
assert.ok(camera.shots.every((shot) => shot.start >= 0 && shot.end <= 1));
assert.ok(camera.shots.every((shot) => shot.reducedMotionVariant));

const bindings = compileDataIntent(
  "If product stock is zero, show Sold Out and stop the product rotation.",
);
assert.equal(bindings.length, 1);
assert.equal(bindings[0].variable, "product.stock");
assert.equal(bindings[0].privacyBoundary, "LOCAL");

assert.throws(
  () => compileWebsiteIntent("Build a site with no animation and a full cinematic camera flight on every section."),
  WebsiteIntentCompileError,
  "contradictory motion requirements must not be resolved silently",
);

console.log("PASS: Workstream B typed intent compilers.");
