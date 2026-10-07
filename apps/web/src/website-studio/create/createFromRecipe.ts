/**
 * Explore → Create factory. Owns no new WebsiteSpec / SceneIR schemas —
 * only composes the existing v1.1 contract factories already on tip.
 */
import {
  createDefaultWebsiteSpecV2,
  type WebsiteSpecV2,
} from "../model/websiteSpecV2.ts";
import { createEmptySceneIR } from "../model/sceneIR.ts";
import {
  createCameraPlanFromPreset,
  type CameraPreset,
} from "../camera/cameraDirector.ts";
import type { InspirationItem } from "../explore/inspirationRecipes.ts";
import type { NarrativeMotionBlock } from "../model/motionBlock.ts";
import { createEmptyBehaviorGraph } from "../model/behaviorGraph.ts";

function presetForRecipe(item: InspirationItem): CameraPreset {
  const hay = `${item.id} ${item.title} ${item.tags?.join(" ") ?? ""}`.toLowerCase();
  if (/architect|flythrough|space/.test(hay)) return "Architectural Flythrough";
  if (/orbit|luxury|product/.test(hay)) return "Luxury Orbit";
  if (/push|dramatic|kinetic/.test(hay)) return "Dramatic Push-In";
  if (/macro|detail/.test(hay)) return "Macro Detail";
  if (/telemetry|data|story/.test(hay)) return "Story Journey";
  return "Hero Reveal";
}

function motionBlockForRecipe(item: InspirationItem): NarrativeMotionBlock {
  const semanticType = /orbit|luxury|product/.test(item.id)
    ? "orbit"
    : /reveal|product/.test(item.id)
      ? "product-reveal"
      : "hero-arrival";
  return {
    id: `${item.id}-arrival`,
    semanticType,
    start: 0,
    end: 0.55,
    tracks: {
      camera: [{ targetId: "camera", property: "position.z" }],
    },
    mobileTransform: { mode: "simplify" },
    reducedMotionTransform: { mode: "static" },
  };
}

export function createBlankStudioProject(title = "Untitled SPE Website"): WebsiteSpecV2 {
  const spec = createDefaultWebsiteSpecV2();
  spec.metadata = { ...spec.metadata, title };
  spec.scene = createEmptySceneIR();
  spec.scene.title = title;
  return spec;
}

export function createFromRecipe(item: InspirationItem): WebsiteSpecV2 {
  const spec = createBlankStudioProject(item.title);
  spec.cameraPlan = createCameraPlanFromPreset(presetForRecipe(item));
  spec.motionBlocks = [motionBlockForRecipe(item)];
  spec.behaviorGraph = createEmptyBehaviorGraph();
  spec.pages = [
    {
      id: "home",
      path: "index.html",
      title: item.title,
    },
  ];
  if (spec.scene) {
    spec.scene.title = item.title;
    spec.scene.accessibilityFallback = {
      ...spec.scene.accessibilityFallback,
      textDescription: item.description,
      ariaRegionLabel: `${item.title} interactive scene`,
    };
  }
  return spec;
}
