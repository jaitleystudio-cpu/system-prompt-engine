/**
 * UIDrop DOM Extraction Engine Core
 * Evaluates live rendered DOM (window.getComputedStyle, CSSOM, layout tree)
 * and provides air-gapped deterministic extraction when offline.
 */

import type {
  DesignSystemSnap,
  DesignSystemClassification,
  ColorPalette,
  TypographyTokens,
  ComponentTokens,
  LayoutTokens,
  MotionTokens,
  ResponsiveTokens,
  PageStructureTokens,
} from "../../types/design-system";
import {
  evaluateContrastPair,
  normalizeToHex,
  determineThemeFromSurface,
} from "./wcagContrast";
import { compileDesignPrompt, compileSystemMd } from "./promptCompiler";

/**
 * Generates an SVG data URL screenshot placeholder for crisp visual rendering in preview.
 */
export function generatePlaceholderScreenshotSvg(
  domain: string,
  theme: "light" | "dark",
  primaryHex: string,
): string {
  const bg = theme === "dark" ? "#0D0E12" : "#F8FAFC";
  const cardBg = theme === "dark" ? "#16181D" : "#FFFFFF";
  const textCol = theme === "dark" ? "#EDEDED" : "#0F172A";
  const subText = theme === "dark" ? "#8A8F98" : "#64748B";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <rect width="1440" height="900" fill="${bg}"/>
  <!-- Nav Bar -->
  <rect x="0" y="0" width="1440" height="72" fill="${cardBg}" opacity="0.9"/>
  <rect x="120" y="24" width="140" height="24" rx="6" fill="${textCol}" opacity="0.8"/>
  <rect x="1140" y="18" width="180" height="36" rx="18" fill="${primaryHex}"/>
  
  <!-- Hero Section -->
  <rect x="120" y="160" width="180" height="28" rx="14" fill="${primaryHex}" opacity="0.15"/>
  <rect x="132" y="166" width="120" height="16" rx="4" fill="${primaryHex}"/>
  
  <rect x="120" y="220" width="620" height="64" rx="8" fill="${textCol}"/>
  <rect x="120" y="296" width="480" height="40" rx="6" fill="${textCol}" opacity="0.6"/>
  <rect x="120" y="360" width="540" height="20" rx="4" fill="${subText}"/>
  <rect x="120" y="390" width="420" height="20" rx="4" fill="${subText}"/>

  <!-- CTA Buttons -->
  <rect x="120" y="440" width="160" height="48" rx="24" fill="${primaryHex}"/>
  <rect x="296" y="440" width="160" height="48" rx="24" fill="${cardBg}" stroke="${subText}" stroke-width="1"/>

  <!-- Card Grid -->
  <g transform="translate(120, 540)">
    <rect x="0" y="0" width="370" height="260" rx="16" fill="${cardBg}" stroke="rgba(255,255,255,0.06)"/>
    <rect x="24" y="24" width="48" height="48" rx="12" fill="${primaryHex}" opacity="0.2"/>
    <rect x="24" y="96" width="180" height="24" rx="4" fill="${textCol}"/>
    <rect x="24" y="132" width="310" height="16" rx="4" fill="${subText}"/>
    <rect x="24" y="156" width="260" height="16" rx="4" fill="${subText}"/>
    
    <rect x="410" y="0" width="370" height="260" rx="16" fill="${cardBg}" stroke="rgba(255,255,255,0.06)"/>
    <rect x="434" y="24" width="48" height="48" rx="12" fill="${primaryHex}" opacity="0.2"/>
    <rect x="434" y="96" width="180" height="24" rx="4" fill="${textCol}"/>
    <rect x="434" y="132" width="310" height="16" rx="4" fill="${subText}"/>
    <rect x="434" y="156" width="260" height="16" rx="4" fill="${subText}"/>

    <rect x="820" y="0" width="370" height="260" rx="16" fill="${cardBg}" stroke="rgba(255,255,255,0.06)"/>
    <rect x="844" y="24" width="48" height="48" rx="12" fill="${primaryHex}" opacity="0.2"/>
    <rect x="844" y="96" width="180" height="24" rx="4" fill="${textCol}"/>
    <rect x="844" y="132" width="310" height="16" rx="4" fill="${subText}"/>
    <rect x="844" y="156" width="260" height="16" rx="4" fill="${subText}"/>
  </g>

  <!-- Watermark badge -->
  <g transform="translate(1180, 830)">
    <rect width="180" height="32" rx="16" fill="${cardBg}" stroke="rgba(255,255,255,0.1)"/>
    <text x="90" y="21" fill="${subText}" font-family="system-ui, sans-serif" font-size="12" text-anchor="middle">${domain}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Cleans font family string by removing quotes, fallback generics, and clean name.
 */
export function sanitizeFontFamily(familyStr: string): string {
  if (!familyStr) return "Inter";
  const first = familyStr.split(",")[0].trim().replace(/['"]/g, "");
  return first || "Inter";
}

/**
 * Converts pixel line-height string to unitless ratio relative to font-size.
 */
export function computeUnitlessLineHeight(lhStr: string, fontSizePx: number): string {
  if (!lhStr || lhStr === "normal") return "1.5";
  if (lhStr.endsWith("px")) {
    const lhPx = parseFloat(lhStr);
    if (fontSizePx > 0) {
      return (lhPx / fontSizePx).toFixed(1);
    }
  }
  const parsed = parseFloat(lhStr);
  return isNaN(parsed) ? "1.5" : parsed.toFixed(1);
}

/**
 * Offline Archetype Catalog for iconic design patterns ($0 egress, local air-gap).
 */
interface DomainArchetype {
  domainPattern: RegExp;
  theme: "light" | "dark";
  density: "balanced" | "compact" | "spacious";
  shapeProfile: "rounded" | "pill" | "sharp";
  primary: string;
  accent: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  swatches: string[];
  h1: { family: string; size: string; weight: string; lineHeight: string; tracking: string };
  h2: { family: string; size: string; weight: string; lineHeight: string; tracking: string };
  h3: { family: string; size: string; weight: string; lineHeight: string; tracking: string };
  h4: { family: string; size: string; weight: string; lineHeight: string; tracking: string };
  body: { family: string; size: string; weight: string; lineHeight: string; tracking: string };
  scale: string;
  buttonRadiusLabel: string;
  cardRadius: string;
  inputRadius: string;
  shadowSummary: string;
  maxWidth: string;
  gutter: string;
  gridBase: string;
  spacingScale: string;
  hoverEffects: string;
  transitionDuration: string;
  breakpoints: string;
  responsiveChangesBullets: string[];
  landmarks: string[];
  pageStructure: string;
  zIndexLayers: string;
}

const DOMAIN_ARCHETYPES: DomainArchetype[] = [
  {
    domainPattern: /uidrop|studiocms/i,
    theme: "light",
    density: "balanced",
    shapeProfile: "rounded",
    primary: "#5E6AD2",
    accent: "#6366F1",
    surface: "#FAFAF9",
    elevated: "#FFFFFF",
    text: "#1C1917",
    muted: "#78716C",
    swatches: [
      "#5E6AD2",
      "#6366F1",
      "#1C1917",
      "#44403C",
      "#78716C",
      "#A8A29E",
      "#D6D3D1",
      "#E7E5E4",
      "#F5F5F4",
      "#FAFAF9",
      "#FFFFFF",
    ],
    h1: { family: "Fraunces", size: "60px", weight: "700", lineHeight: "1.1", tracking: "-1px" },
    h2: { family: "Fraunces", size: "40px", weight: "700", lineHeight: "1.2", tracking: "-0.5px" },
    h3: { family: "Fraunces", size: "28px", weight: "600", lineHeight: "1.3", tracking: "-0.2px" },
    h4: { family: "Fraunces", size: "20px", weight: "600", lineHeight: "1.4", tracking: "0px" },
    body: { family: "Sora", size: "15px", weight: "400", lineHeight: "1.8", tracking: "0px" },
    scale: "60px / 40px / 18px",
    buttonRadiusLabel: "pill buttons",
    cardRadius: "16px",
    inputRadius: "18px",
    shadowSummary: "soft elevated shadows",
    maxWidth: "1128px",
    gutter: "16px",
    gridBase: "4px",
    spacingScale: "4px / 8px / 12px / 16px / 20px / 24px / 28px / 32px / 40px / 48px / 64px",
    hoverEffects: "translateY(-2px), shadow rgba(0, 0, 0, 0.1) 0px 4px 12px",
    transitionDuration: "200ms ease",
    breakpoints: "500px, 900px",
    responsiveChangesBullets: [
      "at 900px: .nav -> padding: 1rem 1.5rem",
      "at 900px: .hero-grid -> grid-template-columns: 1fr",
      "at 500px: .type-scale -> h1 downscales to 38px",
    ],
    landmarks: ["nav", "hero", "feature-grid", "pricing", "testimonials", "section", "contact"],
    pageStructure: "nav + hero + feature-grid + pricing + testimonials + section + contact",
    zIndexLayers: "nav: 100, modal: 1000",
  },
  {
    domainPattern: /linear/i,
    theme: "dark",
    density: "compact",
    shapeProfile: "rounded",
    primary: "#5E6AD2",
    accent: "#8B5CF6",
    surface: "#0D0E12",
    elevated: "#16181D",
    text: "#EDEDED",
    muted: "#8A8F98",
    swatches: [
      "#5E6AD2",
      "#8B5CF6",
      "#EDEDED",
      "#C5C7CB",
      "#8A8F98",
      "#45484E",
      "#2E3035",
      "#16181D",
      "#121316",
      "#0D0E12",
    ],
    h1: { family: "Inter", size: "56px", weight: "600", lineHeight: "1.1", tracking: "-1.5px" },
    h2: { family: "Inter", size: "36px", weight: "600", lineHeight: "1.2", tracking: "-1px" },
    h3: { family: "Inter", size: "24px", weight: "500", lineHeight: "1.3", tracking: "-0.5px" },
    h4: { family: "Inter", size: "18px", weight: "500", lineHeight: "1.4", tracking: "0px" },
    body: { family: "Inter", size: "14px", weight: "400", lineHeight: "1.6", tracking: "0px" },
    scale: "56px / 36px / 14px",
    buttonRadiusLabel: "8px buttons",
    cardRadius: "12px",
    inputRadius: "8px",
    shadowSummary: "subtle dark depth borders",
    maxWidth: "1200px",
    gutter: "24px",
    gridBase: "8px",
    spacingScale: "4px / 8px / 16px / 24px / 32px / 48px / 64px",
    hoverEffects: "borderColor rgba(255, 255, 255, 0.2), background rgba(255, 255, 255, 0.04)",
    transitionDuration: "150ms ease-out",
    breakpoints: "640px, 1024px",
    responsiveChangesBullets: [
      "at 1024px: sidebar transitions to floating modal drawer",
      "at 640px: table view folds into card stack",
    ],
    landmarks: ["header", "workspace-nav", "issue-board", "detail-pane"],
    pageStructure: "header + workspace-nav + issue-board + detail-pane",
    zIndexLayers: "nav: 50, popover: 200, modal: 500",
  },
  {
    domainPattern: /stripe/i,
    theme: "light",
    density: "spacious",
    shapeProfile: "rounded",
    primary: "#635BFF",
    accent: "#00D4FF",
    surface: "#FFFFFF",
    elevated: "#F8FAFC",
    text: "#0A2540",
    muted: "#425466",
    swatches: [
      "#635BFF",
      "#00D4FF",
      "#0A2540",
      "#425466",
      "#687B8E",
      "#A1B0CB",
      "#E3E8EE",
      "#F6F9FC",
      "#FFFFFF",
      "#FAFAF9",
    ],
    h1: { family: "Söhne", size: "64px", weight: "700", lineHeight: "1.1", tracking: "-1.2px" },
    h2: { family: "Söhne", size: "42px", weight: "600", lineHeight: "1.2", tracking: "-0.8px" },
    h3: { family: "Söhne", size: "28px", weight: "600", lineHeight: "1.3", tracking: "-0.4px" },
    h4: { family: "Söhne", size: "20px", weight: "500", lineHeight: "1.4", tracking: "0px" },
    body: { family: "Söhne", size: "16px", weight: "400", lineHeight: "1.7", tracking: "0px" },
    scale: "64px / 42px / 16px",
    buttonRadiusLabel: "pill buttons",
    cardRadius: "16px",
    inputRadius: "12px",
    shadowSummary: "soft elevated 3D diffusion shadows",
    maxWidth: "1180px",
    gutter: "32px",
    gridBase: "8px",
    spacingScale: "8px / 16px / 24px / 32px / 48px / 64px / 96px",
    hoverEffects: "translateY(-3px), shadow 0 13px 27px -5px rgba(50,50,93,.25)",
    transitionDuration: "250ms cubic-bezier(.165,.84,.44,1)",
    breakpoints: "768px, 1024px",
    responsiveChangesBullets: [
      "at 1024px: mega menu folds into hierarchical mobile navigation",
      "at 768px: two-column checkout aligns vertically",
    ],
    landmarks: ["nav", "hero-glow", "product-columns", "code-terminal", "footer"],
    pageStructure: "nav + hero-glow + product-columns + code-terminal + footer",
    zIndexLayers: "nav: 100, dropdown: 300, toast: 1000",
  },
];

/**
 * Derives a deterministic design system snap for any given URL using
 * domain patterns or algorithmic parameterization ($0 egress air-gapped).
 */
export function extractDesignOffline(rawUrl: string): DesignSystemSnap {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  let domain = "example.com";
  try {
    const parsed = new URL(url);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    domain = url.replace(/https?:\/\//, "").split("/")[0] || "example.com";
  }

  // Check matching archetype
  const matched = DOMAIN_ARCHETYPES.find((a) => a.domainPattern.test(domain));

  // If not matched, generate an algorithmic yet tasteful aesthetic profile
  const hash = domain.split("").reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
  const isDark = matched ? matched.theme === "dark" : Math.abs(hash % 2) === 1;

  const primaryHex = matched
    ? matched.primary
    : isDark
      ? ["#6366F1", "#38BDF8", "#10B981", "#A855F7", "#F59E0B"][Math.abs(hash) % 5]
      : ["#4F46E5", "#0284C7", "#059669", "#7C3AED", "#D97706"][Math.abs(hash) % 5];

  const surfaceHex = matched
    ? matched.surface
    : isDark
      ? "#0F172A"
      : "#FFFFFF";

  const theme = matched ? matched.theme : determineThemeFromSurface(surfaceHex);

  const elevatedHex = matched
    ? matched.elevated
    : isDark
      ? "#1E293B"
      : "#F8FAFC";

  const textHex = matched
    ? matched.text
    : isDark
      ? "#F8FAFC"
      : "#0F172A";

  const mutedHex = matched
    ? matched.muted
    : isDark
      ? "#94A3B8"
      : "#64748B";

  const accentHex = matched ? matched.accent : isDark ? "#818CF8" : "#2563EB";

  const swatches = matched
    ? matched.swatches
    : [
        primaryHex,
        accentHex,
        textHex,
        mutedHex,
        isDark ? "#334155" : "#CBD5E1",
        isDark ? "#1E293B" : "#E2E8F0",
        elevatedHex,
        surfaceHex,
        isDark ? "#0D0E12" : "#F1F5F9",
        isDark ? "#475569" : "#94A3B8",
      ];

  const density = matched ? matched.density : "balanced";
  const shapeProfile = matched ? matched.shapeProfile : "rounded";

  // WCAG Evaluations
  const textOnSurface = evaluateContrastPair(textHex, surfaceHex, "Text on Surface");
  const primaryOnSurface = evaluateContrastPair(primaryHex, surfaceHex, "Primary on Surface", true);
  const mutedOnSurface = evaluateContrastPair(mutedHex, surfaceHex, "Muted on Surface");

  const palette: ColorPalette = {
    primary: normalizeToHex(primaryHex),
    accent: normalizeToHex(accentHex),
    surface: normalizeToHex(surfaceHex),
    elevated: normalizeToHex(elevatedHex),
    text: normalizeToHex(textHex),
    muted: normalizeToHex(mutedHex),
    swatches: swatches.map(normalizeToHex),
    contrast: {
      textOnSurface,
      primaryOnSurface,
      mutedOnSurface,
    },
  };

  const h1 = matched?.h1 || { family: "Inter", size: "52px", weight: "700", lineHeight: "1.1", tracking: "-1px" };
  const h2 = matched?.h2 || { family: "Inter", size: "36px", weight: "600", lineHeight: "1.2", tracking: "-0.5px" };
  const h3 = matched?.h3 || { family: "Inter", size: "24px", weight: "600", lineHeight: "1.3", tracking: "-0.2px" };
  const h4 = matched?.h4 || { family: "Inter", size: "18px", weight: "500", lineHeight: "1.4", tracking: "0px" };
  const body = matched?.body || { family: "Inter", size: "15px", weight: "400", lineHeight: "1.6", tracking: "0px" };
  const scale = matched?.scale || `${h1.size} / ${h2.size} / ${body.size}`;

  const typography: TypographyTokens = {
    heading: `${h1.family} ${h1.weight}`,
    body: `${body.family} ${body.size} ${body.weight}, ${body.lineHeight} line-height`,
    scale,
    h1,
    h2,
    h3,
    h4,
    bodyDetail: body,
  };

  const tokens: ComponentTokens = {
    buttonRadiusLabel: matched?.buttonRadiusLabel || "pill buttons",
    cardRadius: matched?.cardRadius || "16px",
    inputRadius: matched?.inputRadius || "12px",
    shapeLabel: shapeProfile,
    shadowSummary: matched?.shadowSummary || "soft elevated shadows",
  };

  const layout: LayoutTokens = {
    maxWidth: matched?.maxWidth || "1200px",
    gutter: matched?.gutter || "16px",
    gridBase: matched?.gridBase || "4px",
    spacingScale: matched?.spacingScale || "4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px",
  };

  const motion: MotionTokens = {
    hoverEffects: matched?.hoverEffects || "translateY(-2px), shadow rgba(0, 0, 0, 0.1) 0px 4px 12px",
    transitionDuration: matched?.transitionDuration || "200ms ease",
  };

  const responsive: ResponsiveTokens = {
    breakpoints: matched?.breakpoints || "640px, 1024px",
    responsiveChangesBullets: matched?.responsiveChangesBullets || [
      "at 1024px: .nav -> padding: 1rem 1.5rem",
      "at 640px: grid-template-columns collapses to single column",
    ],
  };

  const structure: PageStructureTokens = {
    landmarks: matched?.landmarks || ["nav", "hero", "features", "pricing", "footer"],
    pageStructure: matched?.pageStructure || "nav + hero + features + pricing + footer",
    zIndexLayers: matched?.zIndexLayers || "nav: 100, modal: 1000",
  };

  const classification: DesignSystemClassification = {
    theme,
    density,
    shapeProfile,
  };

  const isArchetype = Boolean(matched);
  const sourceMode = isArchetype ? ("LOCAL_REFERENCE_ARCHETYPE" as const) : ("SYNTHETIC_PREVIEW" as const);
  const provenanceNotice = isArchetype
    ? "Derived from local reference archetype pattern. Air-gapped offline execution ($0 network egress)."
    : "Synthesized offline preview derived from domain hash heuristics. Air-gapped offline execution ($0 network egress).";

  const screenshotBase64 = generatePlaceholderScreenshotSvg(domain, theme, palette.primary);

  const partialSnap: Omit<DesignSystemSnap, "compiledPrompt" | "systemMd"> = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    url,
    domain,
    timestamp: new Date().toISOString(),
    screenshotBase64,
    viewport: {
      width: 1440,
      height: 900,
    },
    classification,
    palette,
    typography,
    tokens,
    layout,
    motion,
    responsive,
    structure,
    sourceMode,
    screenshotSource: "SYNTHETIC_FALLBACK_VECTOR_RENDER",
    requestedUrl: rawUrl,
    finalResolvedUrl: url,
    extractionTimestamp: new Date().toISOString(),
    extractionCompleteness: isArchetype ? 85 : 60,
    capturedViewport: { width: 1440, height: 900 },
    unavailableTokenCategories: isArchetype
      ? ["live_viewport_raster", "runtime_computed_keyframes"]
      : ["live_viewport_raster", "live_computed_styles", "runtime_keyframes"],
    relevantContentDigest: `offline_digest_${domain}_${theme}_${palette.primary.replace("#", "")}`,
    provenanceNotice,
  };

  const snap: DesignSystemSnap = {
    ...partialSnap,
    compiledPrompt: compileDesignPrompt(partialSnap as DesignSystemSnap),
    systemMd: compileSystemMd(partialSnap as DesignSystemSnap),
  };

  return snap;
}

/**
 * JavaScript source to be evaluated inside live browser/Playwright DOM.
 * Extracts styles using window.getComputedStyle, CSSOM stylesheets, and layout bounding boxes.
 */
export const BROWSER_DOM_EXTRACTION_SCRIPT = `
(() => {
  try {
    const isTransparent = (c) => !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)';
    const cleanFont = (f) => (f ? f.split(',')[0].trim().replace(/['"]/g, '') : 'Inter');

    // 1. Surface background color (traverse ancestors to find actual canvas color)
    let surface = '#FFFFFF';
    const surfaceCandidates = [
      document.body,
      document.documentElement,
      document.querySelector('main'),
      document.querySelector('#root'),
      document.querySelector('#__next'),
      document.querySelector('.app'),
    ].filter(Boolean);

    for (const el of surfaceCandidates) {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (!isTransparent(bg)) {
        surface = bg;
        break;
      }
    }

    // 2. Primary text color
    const bodyStyle = window.getComputedStyle(document.body || document.documentElement);
    const mainEl = document.querySelector('main') || document.body || document.documentElement;
    const mainStyle = window.getComputedStyle(mainEl);
    let text = !isTransparent(bodyStyle.color) ? bodyStyle.color : '#111827';

    // 3. CTA Buttons & Radius
    const buttonEls = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"], [class*="btn-primary"], [class*="cta"], .btn'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 12 && rect.height > 12;
      });

    let primary = '#5E6AD2';
    let buttonRadiusLabel = 'pill buttons';
    let buttonRadiusNum = 999;

    for (const btn of buttonEls) {
      const bStyle = window.getComputedStyle(btn);
      if (!isTransparent(bStyle.backgroundColor)) {
        primary = bStyle.backgroundColor;
        const bRad = bStyle.borderRadius || '999px';
        buttonRadiusNum = parseFloat(bRad) || 0;
        if (buttonRadiusNum >= 999 || bRad.includes('50%') || buttonRadiusNum >= 24) {
          buttonRadiusLabel = 'pill buttons';
        } else if (buttonRadiusNum <= 2) {
          buttonRadiusLabel = '0px buttons';
        } else {
          buttonRadiusLabel = Math.round(buttonRadiusNum) + 'px buttons';
        }
        break;
      }
    }

    // 4. Cards & Elevated Containers
    const cardEls = Array.from(document.querySelectorAll('.card, article, [class*="card"], [class*="box"], section > div, [role="dialog"], header, nav'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 100 && rect.height > 50;
      });

    let elevated = '#F8FAFC';
    let cardRadius = '16px';
    let cardRadiusNum = 16;
    for (const c of cardEls) {
      const cStyle = window.getComputedStyle(c);
      if (!isTransparent(cStyle.backgroundColor) && cStyle.backgroundColor !== surface) {
        elevated = cStyle.backgroundColor;
        if (cStyle.borderRadius && cStyle.borderRadius !== '0px') {
          cardRadius = cStyle.borderRadius;
          cardRadiusNum = parseFloat(cardRadius) || 16;
        }
        break;
      }
    }

    // 5. Inputs
    const inputEls = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input:not([type="hidden"]), textarea'));
    let inputRadius = '18px';
    if (inputEls.length > 0) {
      const iStyle = window.getComputedStyle(inputEls[0]);
      if (iStyle.borderRadius && iStyle.borderRadius !== '0px') {
        inputRadius = Math.round(parseFloat(iStyle.borderRadius) || 18) + 'px';
      }
    }

    // 6. Accent color (links, badges, active tabs)
    let accent = '#6366F1';
    const accentCandidates = Array.from(document.querySelectorAll('a:not([role="button"]), [class*="badge"], [class*="tag"], [class*="active"], [class*="accent"]'));
    for (const aEl of accentCandidates) {
      const aStyle = window.getComputedStyle(aEl);
      const col = !isTransparent(aStyle.color) && aStyle.color !== text ? aStyle.color : (!isTransparent(aStyle.backgroundColor) ? aStyle.backgroundColor : null);
      if (col && col !== surface && col !== primary) {
        accent = col;
        break;
      }
    }

    // 7. Muted subtext
    let muted = '#78716C';
    const mutedCandidates = Array.from(document.querySelectorAll('p.text-muted, p.text-secondary, [class*="muted"], small, footer p, span[class*="desc"]'));
    for (const mEl of mutedCandidates) {
      const mStyle = window.getComputedStyle(mEl);
      if (!isTransparent(mStyle.color) && mStyle.color !== text) {
        muted = mStyle.color;
        break;
      }
    }

    // 8. Swatches Strip (Collect real top visible colors across DOM)
    const colorCounts = {};
    const recordColor = (c) => {
      if (!c || isTransparent(c)) return;
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    };

    const sampledNodes = Array.from(document.querySelectorAll('header, nav, main, section, button, a, h1, h2, h3, p, footer, div[class*="card"]')).slice(0, 80);
    for (const node of sampledNodes) {
      const s = window.getComputedStyle(node);
      recordColor(s.backgroundColor);
      recordColor(s.color);
      if (s.borderColor && !isTransparent(s.borderColor)) recordColor(s.borderColor);
    }

    // Top sorted swatches
    const rawSwatches = Object.keys(colorCounts)
      .sort((a, b) => colorCounts[b] - colorCounts[a])
      .slice(0, 12);

    const swatches = rawSwatches.length >= 6
      ? rawSwatches
      : [primary, accent, surface, elevated, text, muted];

    // 9. Typography hierarchy
    const getHeading = (tag) => {
      const el = document.querySelector(tag);
      if (!el) return null;
      const s = window.getComputedStyle(el);
      const fs = parseFloat(s.fontSize) || 16;
      const lh = s.lineHeight.endsWith('px')
        ? (parseFloat(s.lineHeight) / fs).toFixed(1)
        : (parseFloat(s.lineHeight) || 1.2).toString();
      return {
        family: cleanFont(s.fontFamily),
        size: Math.round(fs) + 'px',
        weight: s.fontWeight || '700',
        lineHeight: lh,
        tracking: s.letterSpacing === 'normal' ? '0px' : s.letterSpacing,
      };
    };

    const pEl = document.querySelector('p') || document.body || document.documentElement;
    const pStyle = window.getComputedStyle(pEl);
    const pFs = parseFloat(pStyle.fontSize) || 15;
    const pLh = pStyle.lineHeight.endsWith('px')
      ? (parseFloat(pStyle.lineHeight) / pFs).toFixed(1)
      : (parseFloat(pStyle.lineHeight) || 1.6).toString();
    const fallbackFont = cleanFont(pStyle.fontFamily) || 'Inter';

    const h1 = getHeading('h1') || { family: fallbackFont, size: '60px', weight: '700', lineHeight: '1.1', tracking: '-1px' };
    const h2 = getHeading('h2') || { family: h1.family, size: '40px', weight: '700', lineHeight: '1.2', tracking: '-0.5px' };
    const h3 = getHeading('h3') || { family: h1.family, size: '28px', weight: '600', lineHeight: '1.3', tracking: '-0.2px' };
    const h4 = getHeading('h4') || { family: h1.family, size: '20px', weight: '600', lineHeight: '1.4', tracking: '0px' };

    const bodyToken = {
      family: cleanFont(pStyle.fontFamily),
      size: Math.round(pFs) + 'px',
      weight: pStyle.fontWeight || '400',
      lineHeight: pLh,
      tracking: pStyle.letterSpacing === 'normal' ? '0px' : pStyle.letterSpacing,
    };

    // Calculate distinct top 3 sizes for scale
    const sizes = Array.from(new Set([h1.size, h2.size, h3.size, h4.size, bodyToken.size]))
      .map((s) => parseFloat(s) || 16)
      .sort((a, b) => b - a);
    const scale = sizes.slice(0, 3).map((n) => Math.round(n) + 'px').join(' / ');

    // 10. CSSOM Stylesheet Rules: Breakpoints & Hover
    const breakpoints = [];
    const hoverEffects = [];
    const responsiveChanges = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.type === CSSRule.MEDIA_RULE || rule.constructor?.name === 'CSSMediaRule') {
              const mText = rule.conditionText || rule.media?.mediaText || '';
              const matches = mText.match(/(?:min|max)-width:\s*(\d+(?:px|em|rem))/g);
              if (matches) {
                matches.forEach((m) => {
                  const val = m.replace(/.*:\s*/, '');
                  if (!breakpoints.includes(val)) breakpoints.push(val);
                });
              }
              if (responsiveChanges.length < 3 && rule.cssRules && rule.cssRules.length > 0) {
                const subRule = rule.cssRules[0];
                if (subRule.selectorText && subRule.style && subRule.style.length > 0) {
                  const prop = subRule.style[0];
                  responsiveChanges.push('at ' + mText.slice(0, 24) + ': ' + subRule.selectorText + ' -> ' + prop + ': ' + subRule.style.getPropertyValue(prop));
                }
              }
            } else if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.includes(':hover')) {
              if (hoverEffects.length < 2 && (rule.style.transform || rule.style.boxShadow)) {
                const fx = [rule.style.transform, rule.style.boxShadow].filter(Boolean).join(', ');
                hoverEffects.push(fx);
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet security barrier, skip
        }
      }
    } catch (e) {}

    // 11. Z-Index layers
    const zIndexLayers = [];
    const zCandidates = ['header', 'nav', 'dialog', '[role="dialog"]', '[class*="modal"]', '[class*="drawer"]', '[class*="popover"]'];
    for (const sel of zCandidates) {
      const el = document.querySelector(sel);
      if (el) {
        const z = window.getComputedStyle(el).zIndex;
        if (z && z !== 'auto' && z !== '0') {
          const tag = el.tagName.toLowerCase();
          if (!zIndexLayers.some((l) => l.startsWith(tag))) {
            zIndexLayers.push(tag + ': ' + z);
          }
        }
      }
    }
    if (zIndexLayers.length === 0) zIndexLayers.push('nav: 100, modal: 1000');

    // 12. Section Padding & Density
    const sections = Array.from(document.querySelectorAll('section, main > div, article'));
    let totalPad = 0;
    let padCount = 0;
    for (const sec of sections.slice(0, 6)) {
      const sPad = parseFloat(window.getComputedStyle(sec).paddingTop) || 0;
      if (sPad > 0) {
        totalPad += sPad;
        padCount++;
      }
    }
    const avgPadding = padCount > 0 ? totalPad / padCount : 48;
    const lhNum = parseFloat(bodyToken.lineHeight) || 1.6;
    let density = 'balanced';
    if (avgPadding < 36 || lhNum <= 1.35) {
      density = 'compact';
    } else if (avgPadding > 64 || lhNum >= 1.75) {
      density = 'spacious';
    }

    // 13. Shape Profile
    let shapeProfile = 'rounded';
    if (buttonRadiusLabel.includes('pill')) {
      shapeProfile = 'pill';
    } else if (buttonRadiusNum <= 2 && cardRadiusNum <= 2) {
      shapeProfile = 'sharp';
    }

    // 14. Shadow Summary
    let shadowSummary = 'soft elevated shadows';
    if (cardEls.length > 0) {
      const bShadow = window.getComputedStyle(cardEls[0]).boxShadow;
      if (!bShadow || bShadow === 'none') shadowSummary = 'flat (no shadows)';
    }

    // 15. Semantic Page Structure (Walk DOM in natural order)
    const landmarks = [];
    const walkStructure = (root) => {
      for (const child of Array.from(root.children)) {
        const tag = child.tagName.toLowerCase();
        const id = (child.id || '').toLowerCase();
        const cls = (child.className || '').toString().toLowerCase();

        if (tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'main' || tag === 'aside') {
          if (!landmarks.includes(tag)) landmarks.push(tag);
        } else if (id.includes('hero') || cls.includes('hero')) {
          if (!landmarks.includes('hero')) landmarks.push('hero');
        } else if (id.includes('feature') || cls.includes('feature') || cls.includes('grid')) {
          if (!landmarks.includes('feature-grid')) landmarks.push('feature-grid');
        } else if (id.includes('price') || cls.includes('pricing')) {
          if (!landmarks.includes('pricing')) landmarks.push('pricing');
        } else if (id.includes('testimonial') || cls.includes('testimonial') || cls.includes('review')) {
          if (!landmarks.includes('testimonials')) landmarks.push('testimonials');
        } else if (id.includes('contact') || cls.includes('contact')) {
          if (!landmarks.includes('contact')) landmarks.push('contact');
        } else if (tag === 'section') {
          landmarks.push('section');
        }
      }
    };
    walkStructure(document.body);
    if (document.querySelector('main')) walkStructure(document.querySelector('main'));

    const dedupedLandmarks = landmarks.filter((v, i, a) => a.indexOf(v) === i);
    const finalLandmarks = dedupedLandmarks.length >= 3
      ? dedupedLandmarks
      : ['nav', 'hero', 'feature-grid', 'pricing', 'testimonials', 'section', 'contact'];

    // 16. Layout Max Width & Gutter
    const maxW = mainStyle.maxWidth && mainStyle.maxWidth !== 'none' ? mainStyle.maxWidth : '1128px';

    return {
      surface,
      text,
      primary,
      elevated,
      muted,
      accent,
      swatches,
      h1,
      h2,
      h3,
      h4,
      body: bodyToken,
      scale,
      buttonRadiusLabel,
      cardRadius: Math.round(cardRadiusNum) + 'px',
      inputRadius,
      shapeProfile,
      density,
      shadowSummary,
      maxWidth: maxW,
      gutter: '16px',
      breakpoints: breakpoints.length > 0 ? breakpoints.join(', ') : '500px, 900px',
      hoverEffects: hoverEffects.length > 0 ? hoverEffects.join(', ') : 'translateY(-2px), shadow rgba(0, 0, 0, 0.1) 0px 4px 12px',
      landmarks: finalLandmarks,
      pageStructure: finalLandmarks.join(' + '),
      zIndexLayers: zIndexLayers.join(', '),
      responsiveChanges: responsiveChanges.length > 0 ? responsiveChanges : ['at 900px: .nav -> padding: 1rem 1.5rem'],
    };
  } catch (err) {
    return null;
  }
})()
`;
