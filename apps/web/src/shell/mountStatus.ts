/** Shell mount ledger. Website UI is mounted. /media uses createLocalMediaHost and the relative media-pack.
 * productMediaV1 is not a source pass. The media route reads the runtime journey.
 */
export const MOUNT_PENDING = [] as const;

export const MEDIA_MOUNT = {
  id: "media",
  sha: "a93e87d0efb247204883ecbd18203fe248c5c8e5",
  route: "/media",
  component: "MediaProductPanel",
  productMediaV1: "NOT_PASS",
  remainingGap: "JOURNEY_NOT_RECORDED",
  runtime: "pinnedWhisperRuntime",
  localNeuralInBrowser: "ONLY_WHEN_NEURAL_SESSION_RAN",
} as const;

export const WEBSITE_MOUNT = {
  id: "website",
  sha: "aa823977fc14db66d06f52fc38a85045d122ae05",
  route: "/website",
  contract: "apps/web/src/website/mount-contract.ts",
  status: "MOUNTED",
  WEBSITE_PRODUCT: "MOUNTED_LOCAL",
  SCENE3D: "OWNER_WIRED",
  LIVE_URL: "NOT_AVAILABLE",
  WEBGL_EXECUTION: "NOT_RUN",
} as const;

/** Stored research journey mounted on /research. Not a live pass. */
export const RESEARCH_MOUNT = {
  id: "research",
  route: "/research",
  component: "ResearchRoute",
  engine: "spe_runtime/grounding/research_journey.py",
  RESEARCH_PRODUCT: "MOUNTED_STORED",
  product_LIVE_INDEX: "HOLD",
  product_LIVE_RETRACTION: "HOLD",
  may_promote: false,
} as const;

/** Free 3D Website Studio mounted on /studio. Local preview only; not a publish pass. */
export const STUDIO_MOUNT = {
  id: "studio",
  route: "/studio",
  component: "Studio",
  STUDIO_PRODUCT: "MOUNTED_LOCAL",
  WEBSITE_SPEC_OWNER: "website-studio/model/websiteSpecV2",
  SCENE_IR_OWNER: "website-studio/model/sceneIR → engine/multimodal/types",
  LIVE_URL: "NOT_AVAILABLE",
  WEBGL_EXECUTION: "NOT_RUN",
} as const;
