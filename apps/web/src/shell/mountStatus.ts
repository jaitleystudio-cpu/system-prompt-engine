/** Shell mount ledger. Website UI is mounted. Media panel is mounted with no browser neural runtime. */
export const MOUNT_PENDING = [] as const;

export const MEDIA_MOUNT = {
  id: "media",
  sha: "a93e87d0efb247204883ecbd18203fe248c5c8e5",
  route: "/media",
  component: "MediaProductPanel",
  productMediaV1: "NOT_PASS",
  runtime: null,
  localNeuralInBrowser: "UNAVAILABLE",
} as const;

export const WEBSITE_MOUNT = {
  id: "website",
  sha: "53028b17d28a233bef3076f33f38e9817d6fdb37",
  contract: "apps/web/src/website/mount-contract.ts",
  status: "MOUNTED",
} as const;
