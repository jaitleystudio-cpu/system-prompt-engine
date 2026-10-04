/** Shell mount ledger. Website UI is mounted. /media uses createLocalMediaHost and the relative media-pack. */
export const MOUNT_PENDING = [] as const;

export const MEDIA_MOUNT = {
  id: "media",
  sha: "a93e87d0efb247204883ecbd18203fe248c5c8e5",
  route: "/media",
  component: "MediaProductPanel",
  productMediaV1: "PASS",
  remainingGap: "NONE",
  runtime: "pinnedWhisperRuntime",
  localNeuralInBrowser: "ONLY_WHEN_NEURAL_SESSION_RAN",
} as const;

export const WEBSITE_MOUNT = {
  id: "website",
  sha: "53028b17d28a233bef3076f33f38e9817d6fdb37",
  contract: "apps/web/src/website/mount-contract.ts",
  status: "MOUNTED",
} as const;
