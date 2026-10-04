/**
 * Shell lane mounts /media. No page global. No second engine.
 * The runtime is createLocalMediaHost. The pack is the relative
 * media-pack directory in this candidate (manifest committed). The ggml
 * file may be fetched from the manifest SOURCE when absent. whisper-cli
 * stays gitignored and has no binary URL. When it is absent the product
 * builds the pinned whisper.cpp commit into this pack (static, no absolute
 * rpath). No sibling-worktree path.
 */
export const MEDIA_PRODUCT_ROUTE_PATH = "/media" as const;
export const MEDIA_PRODUCT_COMPONENT_NAME = "MediaProductPanel" as const;

export const MEDIA_PRODUCT_MOUNT = {
  routePath: MEDIA_PRODUCT_ROUTE_PATH,
  componentName: MEDIA_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/MediaProductPanel.tsx",
  productMediaV1: "NOT_PASS",
  uiMounted: true,
  remainingGap: "clean checkout does not obtain the model and the CLI in one journey; both were pre-seeded.",
} as const;
