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
  webglExecution: "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7",
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
