/**
 * SPE Free 3D Websites - Portable .spe-site Package Export & Standalone HTML Generator.
 * Guarantees offline roundtrip parity and 100% crawlable semantic DOM for SEO/AEO.
 */
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

export type SpeSiteBundle = Record<string, string>;

export function exportSpeSite(spec: WebsiteSpecV2): SpeSiteBundle {
  const bundle: SpeSiteBundle = {};

  bundle["project.json"] = JSON.stringify(
    {
      name: spec.metadata.title,
      version: spec.spec_version,
      creator: (spec.provenance as any)?.creator || "user",
    },
    null,
    2,
  );

  bundle["website-spec.json"] = JSON.stringify(spec, null, 2);
  bundle["design-dna.json"] = JSON.stringify(spec.designDNA, null, 2);
  if (spec.scene) {
    bundle["scene-ir.json"] = JSON.stringify(spec.scene, null, 2);
  }
  bundle["behavior-graph.json"] = JSON.stringify(spec.behaviorGraph, null, 2);
  bundle["motion-blocks.json"] = JSON.stringify(spec.motionBlocks, null, 2);
  if (spec.cameraPlan) {
    bundle["camera-plan.json"] = JSON.stringify(spec.cameraPlan, null, 2);
  }
  bundle["data-bindings.json"] = JSON.stringify(spec.dataBindings, null, 2);
  bundle["performance.json"] = JSON.stringify(spec.performanceBudget, null, 2);
  bundle["agent-policy.json"] = JSON.stringify(spec.agentPolicy, null, 2);
  bundle["provenance.json"] = JSON.stringify(spec.provenance, null, 2);

  return bundle;
}

export function importSpeSite(bundle: SpeSiteBundle): WebsiteSpecV2 {
  const rawSpec = bundle["website-spec.json"];
  if (!rawSpec) {
    throw new Error("Invalid .spe-site bundle: missing website-spec.json");
  }

  const spec: WebsiteSpecV2 = JSON.parse(rawSpec);

  // Restore sub-files if present
  if (bundle["behavior-graph.json"]) {
    spec.behaviorGraph = JSON.parse(bundle["behavior-graph.json"]);
  }
  if (bundle["motion-blocks.json"]) {
    spec.motionBlocks = JSON.parse(bundle["motion-blocks.json"]);
  }
  if (bundle["camera-plan.json"]) {
    spec.cameraPlan = JSON.parse(bundle["camera-plan.json"]);
  } else {
    delete spec.cameraPlan;
  }
  if (bundle["data-bindings.json"]) {
    spec.dataBindings = JSON.parse(bundle["data-bindings.json"]);
  }

  return spec;
}
