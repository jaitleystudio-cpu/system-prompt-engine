/**
 * Shell lane mounts this. R3-B does not edit App.tsx, routing.ts, or Nav.
 * PRODUCT_MEDIA_V1 is NOT_PASS. A normal /media visit stays NOT_MOUNTED
 * unless a test plants window.__speWhisper. The pinned session lives in
 * the r3-b worktree, not in this branch. This lane does not ship that session.
 */
export const MEDIA_PRODUCT_ROUTE_PATH = "/media" as const;
export const MEDIA_PRODUCT_COMPONENT_NAME = "MediaProductPanel" as const;

export const MEDIA_PRODUCT_MOUNT = {
  routePath: MEDIA_PRODUCT_ROUTE_PATH,
  componentName: MEDIA_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/MediaProductPanel.tsx",
  productMediaV1: "NOT_PASS",
  uiMounted: true,
  remainingGap:
    "A normal /media visit stays NOT_MOUNTED unless a test plants window.__speWhisper, and the pinned session lives in the r3-b worktree, not in this branch.",
} as const;
