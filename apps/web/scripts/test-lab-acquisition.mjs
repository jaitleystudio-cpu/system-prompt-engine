#!/usr/bin/env node
/**
 * Batch G: Daily Lab acquisition handoff + finite-queue honesty + deep-link helpers.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

const acquisitionPath = join(src, "lab/labAcquisition.ts");
assert.ok(existsSync(acquisitionPath), "labAcquisition.ts missing");

const specimensSrc = readFileSync(join(src, "lab/specimens.ts"), "utf8");
assert.equal((specimensSrc.match(/id: "d3d-/g) || []).length, 14);
assert.match(specimensSrc, /DAILY_QUEUE_DAYS/);
assert.match(specimensSrc, /not an endless|not endless|Curated queue of/i);

const gallerySrc = readFileSync(join(src, "lab/gallery/promptGallery.ts"), "utf8");
assert.ok((gallerySrc.match(/id: "gal-/g) || []).length >= 30);

const dailyLab = readFileSync(join(src, "lab/DailyLab.tsx"), "utf8");
assert.match(dailyLab, /specimenIdFromSearch|replaceLabSpecimenParam/);
assert.match(dailyLab, /FINITE_QUEUE/);
assert.match(dailyLab, /PromptGallery/);
assert.match(dailyLab, /LabStageBoundary/);
assert.ok(existsSync(join(src, "lab/LabStageBoundary.tsx")));

const galleryUi = readFileSync(join(src, "lab/PromptGallery.tsx"), "utf8");
assert.match(galleryUi, /ordinary prompt cards/);
assert.match(galleryUi, /separate from the Daily 3D/);

const app = readFileSync(join(src, "App.tsx"), "utf8");
assert.match(app, /applyLabAcquisition/);
assert.match(app, /acquisitionSeedFromLabItem/);
assert.match(app, /spe-acquisition-chip/);
assert.match(app, /mapLabCategory\(seed\.categoryRaw\)/);
assert.match(app, /desiredOutputSeed/);
assert.match(app, /invalidate\(\)/);

const stage = readFileSync(join(src, "lab/LabStage.tsx"), "utf8");
assert.match(stage, /prefers-reduced-motion|reduced|matchMedia/);

const routing = readFileSync(join(src, "routing.ts"), "utf8");
assert.match(routing, /\/daily-lab/);

const css = readFileSync(join(src, "index.css"), "utf8");
assert.match(css, /\.spe-acquisition-chip/);

// Executable mapping via esbuild (no React)
const bundle = await build({
  entryPoints: [acquisitionPath],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const specimen = mod.findSpecimenById("d3d-01");
assert.ok(specimen, "d3d-01 present");
const seed = mod.acquisitionSeedFromLabItem(specimen);
assert.equal(seed.source, "daily_3d");
assert.equal(seed.id, "d3d-01");
assert.equal(seed.mode, "simple");
assert.equal(seed.intentProvenance, "AUTO_DERIVED_INTENT");
assert.equal(seed.clearPriorDraft, true);
assert.ok(seed.userRequest.length > 10);
assert.match(seed.provenanceLabel, /^From Daily Lab:/);
assert.ok(seed.desiredOutputSeed);
assert.equal(seed.categoryRaw, specimen.category);

const card = mod.findGalleryCardById("gal-01");
assert.ok(card);
const gSeed = mod.acquisitionSeedFromLabItem(card);
assert.equal(gSeed.source, "prompt_gallery");
assert.match(gSeed.provenanceLabel, /^From Prompt Gallery:/);
assert.equal(gSeed.userRequest, card.seedIdea);

assert.equal(mod.specimenIdFromSearch("?specimen=d3d-01"), "d3d-01");
assert.equal(mod.specimenIdFromSearch("?specimen=nope"), null);
assert.equal(mod.specimenIdFromSearch(""), null);
assert.equal(mod.provenanceLabelFor("daily_3d", "Brushed orbit"), "From Daily Lab: Brushed orbit");

console.log(
  JSON.stringify({
    ok: true,
    cases: [
      "finite_14_queue_honesty",
      "gallery_separated",
      "handoff_seed_specimen",
      "handoff_seed_gallery",
      "deep_link_specimen_parse",
      "app_wires_applyLabAcquisition",
      "acquisition_chip_css",
      "reduced_motion_stage",
    ],
  }),
);
