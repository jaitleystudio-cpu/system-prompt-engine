/**
 * Shell lane mounts /media. The app server starts the pinned LocalMediaSession
 * and the route calls that host on the same origin. No page global. No second engine.
 * PRODUCT_MEDIA_V1 is PASS only after speech, silence, cancel, and corrupt input
 * all ran through that normal route.
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
