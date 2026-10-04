/** Shell mount ledger. Website UI is mounted. /media uses createLocalMediaHost in production static serve and Vite. PRODUCT_MEDIA_V1 is NOT_PASS. */
export const MOUNT_PENDING = [] as const;

export const MEDIA_MOUNT = {
  id: "media",
  sha: "a93e87d0efb247204883ecbd18203fe248c5c8e5",
  route: "/media",
  component: "MediaProductPanel",
  productMediaV1: "NOT_PASS",
  remainingGap:
    "PRODUCT_MEDIA_V1 stays NOT_PASS until an independent verifier confirms the production static /media journey with SPE_MEDIA_ROOT assets.",
  runtime: "pinnedWhisperRuntime",
  localNeuralInBrowser: "ONLY_WHEN_NEURAL_SESSION_RAN",
} as const;

export const WEBSITE_MOUNT = {
  id: "website",
  sha: "53028b17d28a233bef3076f33f38e9817d6fdb37",
  contract: "apps/web/src/website/mount-contract.ts",
  status: "MOUNTED",
} as const;
