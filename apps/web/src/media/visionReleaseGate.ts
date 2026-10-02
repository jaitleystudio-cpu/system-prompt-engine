/**
 * Lane G3 release judge over the existing screenshot engine.
 * Does not decode a second vision model and does not invent scores.
 * PASS is refused unless measured SSIM, pixel delta, and a paired
 * narrow-viewport SSIM all clear the existing A12 bar.
 */
import { CODE_TARGETS, type CodeTarget } from "./screenshotToCode";

export const DECLARED_CODE_TARGETS = CODE_TARGETS;
export const MAX_REPAIR_ATTEMPTS = 3;
export const PASS_MIN_SSIM = 0.95;
export const PASS_MAX_PIXEL_DELTA_PERCENT = 5;

export type ReleaseStatus =
  | "PASS"
  | "MEASURED_BELOW_BAR"
  | "HOLD_UNPROVEN"
  | "UNSUPPORTED_TARGET"
  | "FAIL_CONTRACT";

export type OcrTruth = {
  mode: "REAL_OCR" | "EXPLICIT_FALLBACK" | "ABSENT";
  method: string;
  characterTextClaimed: boolean;
};

export type ReleaseInput = {
  target: string;
  ocrMode: OcrTruth["mode"];
  layoutRegionCount: number;
  designTokenCount: number;
  promptNonEmpty: boolean;
  syntaxOk: boolean;
  repairAttempts: number;
  responsive: {
    nativeCompared: boolean;
    narrowRenderProduced: boolean;
    narrowSsim: number | null;
  };
  ssimScore: number | null;
  pixelDeltaPercentage: number | null;
  rendered: boolean;
};

const REAL_OCR_METHODS = new Set(["tesseract", "tesseract.js"]);

export function classifyTarget(target: string):
  | { supported: true; target: CodeTarget }
  | { supported: false; status: "UNSUPPORTED_TARGET"; reason: string } {
  if ((DECLARED_CODE_TARGETS as readonly string[]).includes(target)) {
    return { supported: true, target: target as CodeTarget };
  }
  return {
    supported: false,
    status: "UNSUPPORTED_TARGET",
    reason: `${target} is not a declared screenshot code target`,
  };
}

export function ocrTruth(blocks: { method?: string; text?: string }[]): OcrTruth {
  if (!blocks.length) {
    return { mode: "ABSENT", method: "none", characterTextClaimed: false };
  }
  const methods = blocks.map((b) => String(b.method || "unknown"));
  if (methods.some((m) => REAL_OCR_METHODS.has(m))) {
    return { mode: "REAL_OCR", method: methods.find((m) => REAL_OCR_METHODS.has(m)) || "tesseract", characterTextClaimed: true };
  }
  return {
    mode: "EXPLICIT_FALLBACK",
    method: methods[0],
    characterTextClaimed: false,
  };
}

export function designTokensFromIR(ir: { palette?: { hex?: string }[] }): { colors: string[]; source: "ui-observation-palette" } {
  const colors = (ir.palette || []).map((c) => c.hex).filter((hex): hex is string => Boolean(hex));
  return { colors, source: "ui-observation-palette" };
}

function balanced(code: string, open: string, close: string): boolean {
  let n = 0;
  for (const ch of code) {
    if (ch === open) n += 1;
    else if (ch === close) n -= 1;
    if (n < 0) return false;
  }
  return n === 0;
}

export function syntaxValidate(target: string, code: string): { ok: boolean; reason: string } {
  const classified = classifyTarget(target);
  if (!classified.supported) return { ok: false, reason: classified.reason };
  if (!code || !code.trim()) return { ok: false, reason: "empty scaffold" };
  if (!balanced(code, "{", "}")) return { ok: false, reason: "unbalanced braces" };
  if (!balanced(code, "(", ")")) return { ok: false, reason: "unbalanced parens" };
  const rules: Record<CodeTarget, RegExp[]> = {
    "html-css-js": [/<!doctype html>/i, /<html\b/i, /<\/html>/i, /<style\b/i],
    react: [/export default function /, /return \(/],
    swiftui: [/import SwiftUI/, /struct ScreenFromScreenshot/, /some View/],
    compose: [/@Composable/, /fun ScreenFromScreenshot/],
    flutter: [/package:flutter\/material\.dart/, /StatelessWidget/, /Widget build/],
    "react-native": [/from "react-native"/, /useWindowDimensions/, /export default function /],
  };
  for (const re of rules[classified.target]) {
    if (!re.test(code)) return { ok: false, reason: `missing ${re}` };
  }
  return { ok: true, reason: "syntax markers present" };
}

export function responsiveMarkers(target: string, code: string): { ok: boolean; reason: string } {
  const classified = classifyTarget(target);
  if (!classified.supported) return { ok: false, reason: classified.reason };
  const rules: Record<CodeTarget, RegExp> = {
    "html-css-js": /@media \(max-width: 640px\)[\s\S]*grid-template-columns:1fr/,
    react: /gridTemplateColumns|bounds\.x \* 100/,
    swiftui: /GeometryReader/,
    compose: /BoxWithConstraints/,
    flutter: /MediaQuery\.of\(context\)\.size/,
    "react-native": /useWindowDimensions/,
  };
  const re = rules[classified.target];
  if (!re.test(code)) return { ok: false, reason: `missing responsive marker ${re}` };
  if (classified.target === "html-css-js" && !/width=device-width/.test(code)) {
    return { ok: false, reason: "missing viewport meta" };
  }
  return { ok: true, reason: "responsive marker present" };
}

export function applyBoundedRepair(
  code: string,
  target: string,
  attempt: number,
): { code: string; attempt: number; applied: boolean; refused?: string } {
  if (attempt >= MAX_REPAIR_ATTEMPTS) {
    return { code, attempt, applied: false, refused: "REPAIR_CAP" };
  }
  const classified = classifyTarget(target);
  if (!classified.supported) return { code, attempt, applied: false, refused: "UNSUPPORTED_TARGET" };
  if (classified.target === "html-css-js" && !/<!doctype html>/i.test(code)) {
    return { code: `<!doctype html>\n${code}`, attempt: attempt + 1, applied: true };
  }
  return { code, attempt, applied: false };
}

export type VisualRepairSpec = {
  backgroundHex: string;
  foregroundHex: string;
  regions: { id: string; hex: string }[];
};

const VISUAL_REPAIR_NAMES = ["palette-ground", "region-mean-fill", "hide-invented-chrome"] as const;

function safeHex(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000";
}

function safeId(id: string): string | null {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(id) ? id : null;
}

function visualRepairCss(name: (typeof VISUAL_REPAIR_NAMES)[number], spec: VisualRepairSpec): string {
  const bg = safeHex(spec.backgroundHex);
  const fg = safeHex(spec.foregroundHex);
  const palette = `html,body{margin:0;background:${bg} !important;color:${fg} !important}body,.shell,main.spe-main,header.spe-top,footer.spe-foot,aside.spe-rail{background:${bg} !important;color:${fg} !important}.spe-region{outline:none !important;background:transparent}`;
  const fills = spec.regions
    .map((region) => {
      const id = safeId(region.id);
      return id ? `#${id}{background:${safeHex(region.hex)} !important}` : "";
    })
    .filter(Boolean)
    .join("");
  const regionFill = `${palette}${fills}h1,h2,p,a,strong,li{color:${fg}}`;
  const chrome = `${regionFill}header.spe-top,footer.spe-foot,nav{visibility:hidden !important}h1,h2,p,a,strong,li,button,label{font-size:0 !important;color:transparent !important}html,body,.shell,main.spe-main{overflow:hidden}`;
  if (name === "palette-ground") return palette;
  if (name === "region-mean-fill") return regionFill;
  return chrome;
}

/** Cumulative HTML/CSS repair. attempt is how many repairs already applied (0..3). */
export function applyVisualRepair(
  html: string,
  attempt: number,
  spec: VisualRepairSpec,
): { html: string; attempt: number; name: string; applied: boolean; refused?: string } {
  if (attempt >= MAX_REPAIR_ATTEMPTS) {
    return { html, attempt, name: "none", applied: false, refused: "REPAIR_CAP" };
  }
  const name = VISUAL_REPAIR_NAMES[attempt];
  const css = visualRepairCss(name, spec);
  const stripped = html.replace(/<style id="spe-repair">[\s\S]*?<\/style>/g, "");
  const block = `<style id="spe-repair">${css}</style>`;
  const next = stripped.includes("</head>") ? stripped.replace("</head>", `${block}</head>`) : `${stripped}${block}`;
  return { html: next, attempt: attempt + 1, name, applied: true };
}

export function judgeRelease(input: ReleaseInput): {
  status: ReleaseStatus;
  pixelPerfect: boolean;
  reasons: string[];
} {
  const classified = classifyTarget(input.target);
  if (!classified.supported) {
    return { status: "UNSUPPORTED_TARGET", pixelPerfect: false, reasons: [classified.reason] };
  }
  if (input.repairAttempts > MAX_REPAIR_ATTEMPTS) {
    return { status: "FAIL_CONTRACT", pixelPerfect: false, reasons: ["repair attempts exceed 3"] };
  }
  const reasons: string[] = [];
  if (input.ocrMode === "ABSENT") reasons.push("ocr truth absent");
  if (input.layoutRegionCount < 1) reasons.push("layout segmentation absent");
  if (input.designTokenCount < 1) reasons.push("design tokens absent");
  if (!input.promptNonEmpty) reasons.push("image-to-prompt empty");
  if (!input.syntaxOk) reasons.push("syntax invalid");
  if (!input.rendered || input.ssimScore == null || input.pixelDeltaPercentage == null || !input.responsive.nativeCompared) {
    reasons.push("rendered comparison not measured");
  }
  if (!input.responsive.narrowRenderProduced || input.responsive.narrowSsim == null) {
    reasons.push("responsive narrow-viewport SSIM UNKNOWN");
  } else if (
    input.responsive.narrowSsim < PASS_MIN_SSIM
  ) {
    reasons.push("responsive narrow-viewport SSIM below bar");
  }
  if (input.ssimScore != null && input.ssimScore < PASS_MIN_SSIM) reasons.push("native SSIM below bar");
  if (input.pixelDeltaPercentage != null && input.pixelDeltaPercentage > PASS_MAX_PIXEL_DELTA_PERCENT) {
    reasons.push("pixel delta above bar");
  }
  const measured = input.rendered && input.ssimScore != null && input.pixelDeltaPercentage != null;
  let status: ReleaseStatus;
  if (reasons.length === 0) status = "PASS";
  else if (measured) status = "MEASURED_BELOW_BAR";
  else status = "HOLD_UNPROVEN";
  const pixelPerfect =
    status === "PASS" &&
    input.ssimScore != null &&
    input.ssimScore >= PASS_MIN_SSIM &&
    input.pixelDeltaPercentage != null &&
    input.pixelDeltaPercentage <= PASS_MAX_PIXEL_DELTA_PERCENT &&
    input.responsive.narrowSsim != null &&
    input.responsive.narrowSsim >= PASS_MIN_SSIM;
  return { status, pixelPerfect, reasons };
}
