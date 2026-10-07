#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — Workstream N runtime journey gate.
 * Explore → Create → edit → render → responsive preview → export must be
 * reachable through App routing and wired to canonical WebsiteSpecV2 / SceneIR.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const required = [
  "src/website-studio/Studio.tsx",
  "src/website-studio/explore/StudioExplore.tsx",
  "src/website-studio/render/WebsiteRenderer.tsx",
  "src/website-studio/export/projectPackage.ts",
  "src/website-studio/create/createFromRecipe.ts",
  "src/website-studio/explore/inspirationRecipes.ts",
  "src/routing.ts",
  "src/App.tsx",
  "src/layout/Nav.tsx",
];
const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
assert.deepEqual(missing, [], "Studio journey files missing:\n" + missing.join("\n"));

const { resolveRoute, pathForView, NOINDEX_VIEWS, VIEW_PATH } = await import(
  pathToFileURL(path.join(root, "src/routing.ts")).href
);

const resolved = resolveRoute("/studio");
assert.equal(resolved.kind, "view");
assert.equal(resolved.view, "studio");
assert.equal(resolved.canonicalPath, "/studio");
assert.equal(pathForView("studio"), "/studio");
assert.equal(VIEW_PATH.studio, "/studio");
assert.ok(NOINDEX_VIEWS.has("studio"), "Studio must remain a private/noindex surface");

const app = read("src/App.tsx");
const routing = read("src/routing.ts");
const nav = read("src/layout/Nav.tsx");
const studio = read("src/website-studio/Studio.tsx");
const explore = read("src/website-studio/explore/StudioExplore.tsx");
const renderer = read("src/website-studio/render/WebsiteRenderer.tsx");
const robots = read("public/robots.txt");
const mount = read("src/shell/mountStatus.ts");
const createFromRecipeSrc = read("src/website-studio/create/createFromRecipe.ts");

assert.match(app, /website-studio\/Studio/);
assert.match(app, /view === "studio"/);
assert.match(app, /<Studio[\s/>]/);
assert.match(nav, /id:\s*"studio"/);
assert.match(routing, /"studio"/);
assert.match(robots, /Disallow:\s*\/studio/);
assert.match(mount, /route:\s*"\/studio"/);
assert.match(mount, /STUDIO_PRODUCT:\s*"MOUNTED_LOCAL"/);

// Journey surface contracts inside Studio shell
assert.match(explore, /data-testid="studio-explore"/);
assert.match(studio, /StudioExplore/);
assert.match(studio, /createFromRecipe|Create blank|create blank/i);
assert.match(studio, /handleExport|serializeProjectPackage/);
assert.match(studio, /viewMode/);
assert.match(studio, /Desktop|Tablet|Mobile/);
assert.match(studio, /Apply Edit|createSitePatch|applySitePatch/);
assert.match(renderer, /data-testid="website-renderer"/);
assert.match(renderer, /viewMode/);
assert.match(renderer, /375px|mobile/i);

// Single owners — no second WebsiteSpec / SceneIR schemas
assert.match(createFromRecipeSrc, /createDefaultWebsiteSpecV2/);
assert.match(createFromRecipeSrc, /createEmptySceneIR|createCameraPlanFromPreset/);
assert.doesNotMatch(createFromRecipeSrc, /website-spec\/3|scene-ir\/2/);
assert.doesNotMatch(studio, /world(?:wide)?\s*(?:number\s*1|#1)/i);
assert.doesNotMatch(studio, /\bsignup\b/i);
assert.doesNotMatch(createFromRecipeSrc, /\bsignup\b/i);

const { createFromRecipe, createBlankStudioProject } = await import(
  pathToFileURL(path.join(root, "src/website-studio/create/createFromRecipe.ts")).href
);
const { serializeProjectPackage, deserializeProjectPackage } = await import(
  pathToFileURL(path.join(root, "src/website-studio/export/projectPackage.ts")).href
);
const { CURATED_INSPIRATION_RECIPES } = await import(
  pathToFileURL(path.join(root, "src/website-studio/explore/inspirationRecipes.ts")).href
);

const blank = createBlankStudioProject();
assert.equal(blank.spec_version, "website-spec/2");
assert.ok(blank.scene);
assert.equal(blank.scene.sceneVersion, "scene-ir/1");

const recipe = CURATED_INSPIRATION_RECIPES[0];
assert.ok(recipe, "curated recipes required for Explore → Create");
const created = createFromRecipe(recipe);
assert.equal(created.spec_version, "website-spec/2");
assert.equal(created.metadata.title, recipe.title);
assert.ok(created.scene);
assert.equal(created.scene.sceneVersion, "scene-ir/1");
assert.ok(created.cameraPlan?.shots?.length >= 1);
assert.ok(created.motionBlocks.length >= 1);
assert.equal(created.pages.length >= 1, true);

const pkg = await serializeProjectPackage(created);
assert.match(pkg, /"format":"spe-site\/1"/);
const roundTrip = await deserializeProjectPackage(pkg);
assert.equal(roundTrip.integrityVerified, true);
assert.equal(roundTrip.websiteSpec.metadata.title, recipe.title);

console.log(
  "PASS: Studio runtime journey routed at /studio — Explore → Create → edit → render → responsive → export.",
);
