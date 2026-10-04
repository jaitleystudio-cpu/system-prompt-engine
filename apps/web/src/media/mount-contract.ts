/**
 * Shell lane mounts /media. No page global. No second engine.
 * The runtime is createLocalMediaHost. The pack is the relative
 * media-pack directory in this candidate (manifest committed, bytes
 * gitignored). No sibling-worktree path.
 */
export const MEDIA_PRODUCT_ROUTE_PATH = "/media" as const;
export const MEDIA_PRODUCT_COMPONENT_NAME = "MediaProductPanel" as const;

export const MEDIA_PRODUCT_MOUNT = {
  routePath: MEDIA_PRODUCT_ROUTE_PATH,
  componentName: MEDIA_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/MediaProductPanel.tsx",
  productMediaV1: "PASS",
  uiMounted: true,
  remainingGap: "NONE",
} as const;
