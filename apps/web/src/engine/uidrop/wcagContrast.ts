/**
 * WCAG 2.1 Contrast Engine & Relative Luminance Calculator
 * Computes exact relative luminance according to W3C Rec 2.1:
 *   L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Contrast ratio:
 *   (L1 + 0.05) / (L2 + 0.05) where L1 is lighter (L1 >= L2).
 * Includes alpha compositing over surface background for true physical rendering.
 */

import type { ContrastPair, ContrastScore } from "../../types/design-system";

export interface RgbColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a?: number; // 0..1
}

const COMMON_NAMED_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [239, 68, 68],
  green: [34, 197, 94],
  blue: [59, 130, 246],
  yellow: [234, 179, 8],
  gray: [107, 114, 128],
  grey: [107, 114, 128],
  lightgray: [229, 231, 235],
  darkgray: [55, 65, 81],
  slate: [100, 116, 139],
  indigo: [99, 102, 241],
  purple: [168, 85, 247],
  pink: [236, 72, 153],
  orange: [249, 115, 22],
  cyan: [6, 182, 212],
  teal: [20, 184, 166],
};

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

/**
 * Parses hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA), rgb/rgba (comma or space separated),
 * hsl/hsla, or named colors into RGB object.
 */
export function parseColorToRgb(color: string): RgbColor {
  if (!color || typeof color !== "string") {
    return { r: 13, g: 14, b: 18, a: 1 };
  }

  const c = color.trim().toLowerCase();

  // Transparent special case
  if (c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "rgba(0,0,0,0)") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Hex format: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
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

  // Comma-separated rgb/rgba: rgb(255, 255, 255) or rgba(0, 0, 0, 0.8)
  const rgbCommaMatch = c.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbCommaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbCommaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbCommaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbCommaMatch[3], 10)));
    const a =
      rgbCommaMatch[4] !== undefined
        ? Math.min(1, Math.max(0, parseFloat(rgbCommaMatch[4])))
        : 1;
    return { r, g, b, a };
  }

  // Space-separated rgb/rgba (CSS Color 4): rgb(255 255 255 / 0.8) or rgb(255 255 255)
  const rgbSpaceMatch = c.match(
    /rgba?\s*\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\s*\)/,
  );
  if (rgbSpaceMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbSpaceMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbSpaceMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbSpaceMatch[3], 10)));
    let a = 1;
    if (rgbSpaceMatch[4]) {
      const alphaStr = rgbSpaceMatch[4];
      a = alphaStr.endsWith("%")
        ? parseFloat(alphaStr) / 100
        : parseFloat(alphaStr);
      a = Math.min(1, Math.max(0, isNaN(a) ? 1 : a));
    }
    return { r, g, b, a };
  }

  // HSL / HSLA: hsl(240, 100%, 50%) or hsl(240 100% 50% / 0.8)
  const hslCommaMatch = c.match(
    /hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (hslCommaMatch) {
    const h = parseFloat(hslCommaMatch[1]);
    const s = parseFloat(hslCommaMatch[2]);
    const l = parseFloat(hslCommaMatch[3]);
    const [r, g, b] = hslToRgb(h, s, l);
    const a =
      hslCommaMatch[4] !== undefined
        ? Math.min(1, Math.max(0, parseFloat(hslCommaMatch[4])))
        : 1;
    return { r, g, b, a };
  }

  const hslSpaceMatch = c.match(
    /hsla?\s*\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?\s*\)/,
  );
  if (hslSpaceMatch) {
    const h = parseFloat(hslSpaceMatch[1]);
    const s = parseFloat(hslSpaceMatch[2]);
    const l = parseFloat(hslSpaceMatch[3]);
    const [r, g, b] = hslToRgb(h, s, l);
    let a = 1;
    if (hslSpaceMatch[4]) {
      const alphaStr = hslSpaceMatch[4];
      a = alphaStr.endsWith("%")
        ? parseFloat(alphaStr) / 100
        : parseFloat(alphaStr);
      a = Math.min(1, Math.max(0, isNaN(a) ? 1 : a));
    }
    return { r, g, b, a };
  }

  // Named colors
  if (COMMON_NAMED_COLORS[c]) {
    const [r, g, b] = COMMON_NAMED_COLORS[c];
    return { r, g, b, a: 1 };
  }

  // Safe fallback default
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
 * Blends a foreground color containing alpha over an opaque background color.
 */
export function blendColors(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = foreground.a !== undefined ? foreground.a : 1;
  if (alpha >= 1) return { ...foreground, a: 1 };
  if (alpha <= 0) return { ...background, a: 1 };

  return {
    r: Math.round(foreground.r * alpha + background.r * (1 - alpha)),
    g: Math.round(foreground.g * alpha + background.g * (1 - alpha)),
    b: Math.round(foreground.b * alpha + background.b * (1 - alpha)),
    a: 1,
  };
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
 * Performs physical alpha blending if foreground has opacity.
 */
export function evaluateContrastPair(
  foreground: string,
  background: string,
  label: string,
  isLargeOrUI = false,
): ContrastPair {
  const fgRgb = parseColorToRgb(foreground);
  const bgRgb = parseColorToRgb(background);

  // If foreground has alpha < 1, composite it over the background color
  const blendedFgRgb = blendColors(fgRgb, bgRgb);
  const fgHex = normalizeToHex(
    `rgb(${blendedFgRgb.r}, ${blendedFgRgb.g}, ${blendedFgRgb.b})`,
  );
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
    foreground: normalizeToHex(foreground),
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
