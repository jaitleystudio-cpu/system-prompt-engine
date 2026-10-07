/**
 * Progressive media prompt generators for instant UI yield (<30ms).
 * Located in /engine/ to cleanly isolate dynamic prompt generation from static UI copy inventory.
 */
export function createProgressiveScreenshotPrompt(
  codeTargetLabel: string,
  width: number,
  height: number,
): string {
  return [
    "Screenshot → code request:",
    `Rebuild the UI shown in this screenshot for ${codeTargetLabel}.`,
    `Source resolution: ${width}×${height}px.`,
    "",
    `Generate clean, responsive ${codeTargetLabel} implementation code matching this layout.`,
  ].join("\n");
}

export function createProgressiveImagePrompt(block: string): string {
  return [
    "Image → prompt request:",
    "Using only the grounded observations / model judgments below (not verified facts), help me write a strong prompt about this image.",
    "",
    block,
  ].join("\n");
}

export const PROGRESSIVE_NOTE = "instant-progressive grounded visual pass";
