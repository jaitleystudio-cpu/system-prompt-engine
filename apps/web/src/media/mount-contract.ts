/**
 * Shell lane mounts this. R3-B does not edit App.tsx, routing.ts, or Nav.
 * PRODUCT_MEDIA_V1 is PASS only after the /media route runtime ran speech, silence, and cancel in Chrome.
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
