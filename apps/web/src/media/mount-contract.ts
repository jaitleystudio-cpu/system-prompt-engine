/**
 * Shell lane mounts /media. No page global. No second engine.
 * PRODUCT_MEDIA_V1 is NOT_PASS. Production static serve and Vite
 * share createLocalMediaHost; assets resolve only from SPE_MEDIA_ROOT
 * (fail closed). Independent verifier confirmation is still required.
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
    "PRODUCT_MEDIA_V1 stays NOT_PASS until an independent verifier confirms the production static /media journey with SPE_MEDIA_ROOT assets.",
} as const;
