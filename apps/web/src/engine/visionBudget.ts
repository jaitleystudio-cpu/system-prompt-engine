/**
 * Homepage must keep VISION_MODEL_BYTES === 0 until Image / Screenshot / Video
 * actually requests the STANDARD semantic pack. Never silent media egress.
 * Human-readable pack docs: apps/web/public/models/LICENSE.md
 */

let loadedBytes = 0;
const loadedAssets = new Set<string>();

export function getVisionModelBytes(): number {
  return loadedBytes;
}

export function visionModelInventory(): { bytes: number; assets: string[] } {
  return { bytes: loadedBytes, assets: [...loadedAssets] };
}

/** Record a same-origin model/runtime asset load (not user media upload). */
export function recordVisionAssetLoad(assetId: string, bytes: number): void {
  if (loadedAssets.has(assetId)) return;
  loadedAssets.add(assetId);
  loadedBytes += Math.max(0, bytes | 0);
}

export function resetVisionBudgetForTests(): void {
  loadedBytes = 0;
  loadedAssets.clear();
}

/** Machine-readable constants only (no marketing copy). */
export const VISION_PACK_DOCS = {
  homepageBytes: 0,
  classifierApproxBytes: 3_500_000,
  ortWasmApproxBytes: 11_000_000,
  modelPath: "/models/mobilenetv2-12-int8.onnx",
  ortWasmPath: "/ort/ort-wasm-simd-threaded.wasm",
} as const;
