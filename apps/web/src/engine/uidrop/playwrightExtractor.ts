/**
 * Playwright Headless Browser Extractor Microservice Engine
 * Loads user-submitted URL, renders at 1440x900 (or 390x844),
 * takes high-resolution viewport screenshot, executes DOM extraction script,
 * and compiles WCAG 2.1 contrast ratios and AI prompt specifications.
 */

import type { DesignSystemSnap, ColorPalette, TypographyTokens, ComponentTokens, LayoutTokens, MotionTokens, ResponsiveTokens, PageStructureTokens, DesignSystemClassification } from "../../types/design-system";
import {
  evaluateContrastPair,
  normalizeToHex,
  determineThemeFromSurface,
} from "./wcagContrast";
import {
  BROWSER_DOM_EXTRACTION_SCRIPT,
  extractDesignOffline,
} from "./extractorCore";
import { compileDesignPrompt, compileSystemMd } from "./promptCompiler";

export interface PlaywrightExtractionOptions {
  viewport?: { width: number; height: number };
  timeoutMs?: number;
  preferOffline?: boolean;
}

/**
 * Extracts design system using Playwright if available in runtime,
 * falling back gracefully to deterministic offline extraction.
 */
export async function extractDesignWithPlaywright(
  url: string,
  options: PlaywrightExtractionOptions = {},
): Promise<DesignSystemSnap> {
  const preferOffline = options.preferOffline ?? false;
  if (preferOffline) {
    return extractDesignOffline(url);
  }

  // Attempt real Playwright browser automation
  try {
    // Dynamic import to prevent bundler errors in browser Vite runtime
    const playwright = await import("playwright").catch(() => null);
    if (!playwright || !playwright.chromium) {
      return extractDesignOffline(url);
    }

    const browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      viewport: options.viewport || { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs || 10000,
    });

    // Wait for fonts if ready API is supported
    await page.evaluate(() => document.fonts?.ready).catch(() => {});

    // Capture crisp viewport screenshot
    const screenshotBuffer = await page.screenshot({ type: "png" });
    const screenshotBase64 = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

    // Extract DOM styles
    const rawDom: any = await page.evaluate(BROWSER_DOM_EXTRACTION_SCRIPT);

    await browser.close();

    if (!rawDom) {
      return extractDesignOffline(url);
    }

    let domain = "example.com";
    try {
      domain = new URL(targetUrl).hostname.replace(/^www\./, "");
    } catch {
      domain = targetUrl.replace(/https?:\/\//, "").split("/")[0];
    }

    const surfaceHex = normalizeToHex(rawDom.surface);
    const textHex = normalizeToHex(rawDom.text);
    const primaryHex = normalizeToHex(rawDom.primary);
    const elevatedHex = normalizeToHex(rawDom.elevated);
    const mutedHex = normalizeToHex(rawDom.muted);
    const accentHex = normalizeToHex(rawDom.accent || "#6366F1");

    const textOnSurface = evaluateContrastPair(textHex, surfaceHex, "Text on Surface");
    const primaryOnSurface = evaluateContrastPair(primaryHex, surfaceHex, "Primary on Surface", true);
    const mutedOnSurface = evaluateContrastPair(mutedHex, surfaceHex, "Muted on Surface");

    const swatches = [
      primaryHex,
      accentHex,
      surfaceHex,
      elevatedHex,
      textHex,
      mutedHex,
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EC4899",
    ];

    const palette: ColorPalette = {
      primary: primaryHex,
      accent: accentHex,
      surface: surfaceHex,
      elevated: elevatedHex,
      text: textHex,
      muted: mutedHex,
      swatches,
      contrast: {
        textOnSurface,
        primaryOnSurface,
        mutedOnSurface,
      },
    };

    const theme = determineThemeFromSurface(surfaceHex);
    const density = "balanced";
    const shapeProfile = rawDom.buttonRadiusLabel?.includes("pill") ? "pill" : "rounded";

    const classification: DesignSystemClassification = {
      theme,
      density,
      shapeProfile,
    };

    const scale = `${rawDom.h1.size} / ${rawDom.h2.size} / ${rawDom.body.size}`;
    const typography: TypographyTokens = {
      heading: `${rawDom.h1.family} ${rawDom.h1.weight}`,
      body: `${rawDom.body.family} ${rawDom.body.size} ${rawDom.body.weight}, ${rawDom.body.lineHeight} line-height`,
      scale,
      h1: rawDom.h1,
      h2: rawDom.h2,
      h3: rawDom.h3,
      h4: rawDom.h4,
      bodyDetail: rawDom.body,
    };

    const tokens: ComponentTokens = {
      buttonRadiusLabel: rawDom.buttonRadiusLabel || "pill buttons",
      cardRadius: rawDom.cardRadius || "16px",
      inputRadius: rawDom.inputRadius || "18px",
      shapeLabel: shapeProfile,
      shadowSummary: "soft elevated shadows",
    };

    const layout: LayoutTokens = {
      maxWidth: rawDom.maxWidth || "1128px",
      gutter: rawDom.gutter || "16px",
      gridBase: "4px",
      spacingScale: "4px / 8px / 12px / 16px / 20px / 24px / 28px / 32px / 40px / 48px / 64px",
    };

    const motion: MotionTokens = {
      hoverEffects: rawDom.hoverEffects || "translateY(-2px), shadow rgba(0, 0, 0, 0.1) 0px 4px 12px",
      transitionDuration: "200ms ease",
    };

    const responsive: ResponsiveTokens = {
      breakpoints: rawDom.breakpoints || "500px, 900px",
      responsiveChangesBullets: rawDom.responsiveChanges || ["at 900px: .nav -> padding: 1rem 1.5rem"],
    };

    const structure: PageStructureTokens = {
      landmarks: rawDom.landmarks || ["nav", "hero", "section", "footer"],
      pageStructure: rawDom.pageStructure || "nav + hero + section + footer",
      zIndexLayers: "nav: 100, modal: 1000",
    };

    const partialSnap = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      url: targetUrl,
      domain,
      timestamp: new Date().toISOString(),
      screenshotBase64,
      viewport: options.viewport || { width: 1440, height: 900 },
      classification,
      palette,
      typography,
      tokens,
      layout,
      motion,
      responsive,
      structure,
    };

    return {
      ...partialSnap,
      compiledPrompt: compileDesignPrompt(partialSnap as DesignSystemSnap),
      systemMd: compileSystemMd(partialSnap as DesignSystemSnap),
    };
  } catch (error) {
    // If browser launch fails or timeout occurs, gracefully fall back to deterministic offline extraction
    return extractDesignOffline(url);
  }
}
