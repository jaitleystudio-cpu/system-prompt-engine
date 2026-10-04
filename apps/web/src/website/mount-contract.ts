/**
 * Mount contract for the shell lane.
 * This lane does not edit App, routing, Nav, shell, a11y, SeoHead, or sitemap.
 * routeMountStatus stays NOT_INTEGRATED / SHELL_MOUNT=NOT_DONE until that lane mounts WebsiteProduct.
 */
export const websiteMountContract = {
  id: "spe.web.website-product",
  status: "READY_FOR_SHELL_MOUNT",
  routeMountStatus: "NOT_INTEGRATED",
  shellMount: "NOT_DONE",
  importPath: "apps/web/src/website/WebsiteProduct.tsx",
  exportName: "WebsiteProduct",
  flowPath: "apps/web/src/website/productFlow.ts",
  shellEditsInThisLane: false,
  silentFetch: false,
  capabilities: {
    aiGeneration: "NOT_AVAILABLE",
    scene3d: "OWNER_WIRED",
    liveUrlReconstruction: "NOT_AVAILABLE",
    hostedPublish: "HOLD",
    sandbox: "UNSUPPORTED",
  },
  sceneIrWired: true,
  sceneIrOwnerPath: "apps/web/src/engine/multimodal/sceneCompiler.ts",
  sceneIrSourceSha: "c08c6929ad57885a3d16eb10f1cd07b2a5ed4949",
  webglContextLossDisposal: "NOT_IMPLEMENTED",
  webglExecution: "NOT_RUN",
  reused: {
    browserCompiler: "apps/web/src/builder/websiteSpecModel.ts",
    canonicalGenerator: "packages/website-generator",
    canonicalWebrecon: "spe_runtime/webrecon",
    sceneEngine: "apps/web/src/engine/multimodal/sceneCompiler.ts",
  },
  inputModes: ["website_spec", "local_saved_html", "live_url"],
  localSavedHtmlIsLiveUrl: false,
} as const;

export type WebsiteMountContract = typeof websiteMountContract;
