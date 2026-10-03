/**
 * Shell lane mounts this. R3-B does not edit App.tsx, routing.ts, or Nav.
 * PRODUCT_MEDIA_V1 stays NOT_PASS until a tested browser runs the mounted journey.
 */
export const MEDIA_PRODUCT_ROUTE_PATH = "/media" as const;
export const MEDIA_PRODUCT_COMPONENT_NAME = "MediaProductPanel" as const;

export const MEDIA_PRODUCT_MOUNT = {
  routePath: MEDIA_PRODUCT_ROUTE_PATH,
  componentName: MEDIA_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/MediaProductPanel.tsx",
  productMediaV1: "NOT_PASS",
  uiMounted: false,
  remainingGap: "SHELL_MOUNT",
} as const;
