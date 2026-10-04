/**
 * Shell lane mounts /media. No page global. No second engine.
 * PRODUCT_MEDIA_V1 is NOT_PASS. The runtime starts only from the Vite
 * dev/preview plugin (vite build and a static host do not start it). The
 * pinned CLI and model are sibling-worktree paths, not shipped with this
 * branch. Dev-server speech, silence, cancel, and corrupt observations are
 * evidence from that plugin, not a product pass.
 */
export const MEDIA_PRODUCT_ROUTE_PATH = "/media" as const;
export const MEDIA_PRODUCT_COMPONENT_NAME = "MediaProductPanel" as const;

export const MEDIA_PRODUCT_MOUNT = {
  routePath: MEDIA_PRODUCT_ROUTE_PATH,
  componentName: MEDIA_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/MediaProductPanel.tsx",
  productMediaV1: "NOT_PASS",
  uiMounted: true,
  remainingGap: "The runtime starts only from the Vite dev/preview plugin, and the pinned CLI and model are sibling-worktree paths, not shipped with this branch.",
} as const;
