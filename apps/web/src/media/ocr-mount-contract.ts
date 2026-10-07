/**
 * Shell lane mounts /ocr. No page global. No second engine.
 * The runtime is createLocalOcrHost → spe_runtime.ocr_product.route_host
 * (LocalOcrSession over the relative ocr-pack). OCR_PRODUCT stays HOLD in
 * source. LOCAL_OCR is execution evidence from the route, not a release pass.
 */
export const OCR_PRODUCT_ROUTE_PATH = "/ocr" as const;
export const OCR_PRODUCT_COMPONENT_NAME = "OcrRoute" as const;

export const OCR_PRODUCT_MOUNT = {
  routePath: OCR_PRODUCT_ROUTE_PATH,
  componentName: OCR_PRODUCT_COMPONENT_NAME,
  source: "apps/web/src/media/OcrRoute.tsx",
  OCR_PRODUCT: "HOLD",
  uiMounted: true,
  execution: "NOT_RUN",
  missing: "RELEASE_NOT_QUALIFIED",
  runtime: "ocrLite.recognizeImageFile → /api/ocr/recognize",
} as const;
