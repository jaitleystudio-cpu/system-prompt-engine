/**
 * Mount contract for the shell lane.
 * This lane does not edit App, routing, Nav, shell, a11y, SeoHead, or sitemap.
 * routeMountStatus stays NOT_INTEGRATED until that lane mounts WebsiteProduct.
 */
export const websiteMountContract = {
  id: "spe.web.website-product",
  status: "READY_FOR_SHELL_MOUNT",
  routeMountStatus: "NOT_INTEGRATED",
  importPath: "apps/web/src/website/WebsiteProduct.tsx",
  exportName: "WebsiteProduct",
  flowPath: "apps/web/src/website/productFlow.ts",
  shellEditsInThisLane: false,
  silentFetch: false,
  capabilities: {
    aiGeneration: "NOT_AVAILABLE",
    scene3d: "NOT_AVAILABLE",
    liveUrlReconstruction: "NOT_AVAILABLE",
    hostedPublish: "HOLD",
    sandbox: "UNSUPPORTED",
  },
  sceneIrWired: false,
  webglContextLossDisposal: "NOT_APPLICABLE_SCENE_IR_NOT_WIRED",
  reused: {
    browserCompiler: "apps/web/src/builder/websiteSpecModel.ts",
    canonicalGenerator: "packages/website-generator",
    canonicalWebrecon: "spe_runtime/webrecon",
    sceneEngine: "NOT_REUSED_SCENE_IR_ABSENT",
  },
  inputModes: ["website_spec", "local_saved_html", "live_url"],
  localSavedHtmlIsLiveUrl: false,
} as const;

export type WebsiteMountContract = typeof websiteMountContract;
