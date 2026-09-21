export type VisualQuality = "HIGH" | "BALANCED" | "LITE";

export function detectVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "LITE";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return "LITE";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  if (narrow || coarse) return "LITE";
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");
  if (!gl) return "LITE";

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 4) return "BALANCED";
  return "HIGH";
}
