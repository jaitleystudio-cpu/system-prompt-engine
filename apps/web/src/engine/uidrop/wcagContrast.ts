/**
 * WCAG 2.1 Contrast Engine & Relative Luminance Calculator
 * Computes exact relative luminance according to W3C Rec 2.1:
 *   L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Contrast ratio:
 *   (L1 + 0.05) / (L2 + 0.05) where L1 is lighter (L1 >= L2).
 */

import type { ContrastPair, ContrastScore } from "../../types/design-system";

export interface RgbColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a?: number; // 0..1
}

/**
 * Parses hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) or rgb/rgba string into RGB object.
 */
export function parseColorToRgb(color: string): RgbColor {
  const c = color.trim().toLowerCase();

  // Hex format
  if (c.startsWith("#")) {
    const raw = c.slice(1);
    if (raw.length === 3 || raw.length === 4) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      const a = raw.length === 4 ? parseInt(raw[3] + raw[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (raw.length === 6 || raw.length === 8) {
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb/rgba format: rgb(255, 255, 255) or rgba(0, 0, 0, 0.8)
  const rgbMatch = c.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const a = rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1;
    return { r, g, b, a };
  }

  // Fallback defaults
  if (c === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (c === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  return { r: 13, g: 14, b: 18, a: 1 };
}

/**
 * Normalizes any color representation into 6-digit uppercase hex (#RRGGBB).
 */
export function normalizeToHex(color: string): string {
  const rgb = parseColorToRgb(color);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Computes WCAG 2.1 relative luminance for an sRGB component.
 * Value returned is in [0.0, 1.0].
 */
export function getChannelLuminance(val255: number): number {
  const srgb = val255 / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Calculates WCAG relative luminance for a given hex/rgb color.
 */
export function calculateRelativeLuminance(color: string): number {
  const { r, g, b } = parseColorToRgb(color);
  const rLin = getChannelLuminance(r);
  const gLin = getChannelLuminance(g);
  const bLin = getChannelLuminance(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two colors:
 *   (L1 + 0.05) / (L2 + 0.05)
 * Returns a number between 1.0 and 21.0, rounded to 2 decimal places.
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = calculateRelativeLuminance(color1);
  const l2 = calculateRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(rawRatio * 100) / 100;
}

/**
 * Evaluates contrast pair against WCAG 2.1 levels:
 * - AAA: >= 7.0 (enhanced contrast)
 * - AA:  >= 4.5 (minimum normal text contrast) or >= 3.0 for UI/large text
 * - FAIL: < 4.5 (or < 3.0)
 */
export function evaluateContrastPair(
  foreground: string,
  background: string,
  label: string,
  isLargeOrUI = false,
): ContrastPair {
  const fgHex = normalizeToHex(foreground);
  const bgHex = normalizeToHex(background);
  const ratio = calculateContrastRatio(fgHex, bgHex);
  const formattedRatio = `${ratio.toFixed(1)}:1`;

  const aaThreshold = isLargeOrUI ? 3.0 : 4.5;
  const passesAA = ratio >= aaThreshold;
  const passesAAA = ratio >= 7.0;

  let score: ContrastScore = "FAIL";
  if (passesAAA) {
    score = "AAA";
  } else if (passesAA) {
    score = "AA";
  }

  return {
    label,
    foreground: fgHex,
    background: bgHex,
    ratio,
    formattedRatio,
    score,
    passesAA,
    passesAAA,
  };
}

/**
 * Determines theme ("light" | "dark") from background/surface luminance.
 * WCAG threshold > 0.4 indicates light background; <= 0.4 indicates dark.
 */
export function determineThemeFromSurface(surfaceHex: string): "light" | "dark" {
  const lum = calculateRelativeLuminance(surfaceHex);
  return lum > 0.4 ? "light" : "dark";
}
