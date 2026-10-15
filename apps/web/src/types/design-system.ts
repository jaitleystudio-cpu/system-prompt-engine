/**
 * UIDrop Design System Extractor & AI Prompt Compiler Types
 * Production TypeScript interfaces for extracted live DOM primitives,
 * WCAG 2.1 contrast ratios, component tokens, and AI prompt compilers.
 */

export type ThemeTag = "light" | "dark";
export type DensityTag = "balanced" | "compact" | "spacious";
export type ShapeProfileTag = "rounded" | "pill" | "sharp";
export type ContrastScore = "AAA" | "AA" | "FAIL";

export interface ContrastPair {
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  formattedRatio: string;
  score: ContrastScore;
  passesAA: boolean;
  passesAAA: boolean;
}

export interface ColorPalette {
  primary: string;
  accent: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  swatches: string[];
  contrast: {
    textOnSurface: ContrastPair;
    primaryOnSurface: ContrastPair;
    mutedOnSurface: ContrastPair;
  };
}

export interface TypeLevelToken {
  family: string;
  size: string;
  weight: string;
  lineHeight: string;
  tracking: string;
}

export interface TypographyTokens {
  heading: string;
  body: string;
  scale: string;
  h1: TypeLevelToken;
  h2: TypeLevelToken;
  h3: TypeLevelToken;
  h4: TypeLevelToken;
  bodyDetail: TypeLevelToken;
}

export type TypographyScale = TypographyTokens;

export interface ComponentTokens {
  buttonRadiusLabel: string;
  cardRadius: string;
  inputRadius: string;
  shapeLabel: ShapeProfileTag;
  shadowSummary: string;
}

export interface LayoutTokens {
  maxWidth: string;
  gutter: string;
  gridBase: string;
  spacingScale: string;
}

export interface MotionTokens {
  hoverEffects: string;
  transitionDuration: string;
}

export interface ResponsiveTokens {
  breakpoints: string;
  responsiveChangesBullets: string[];
}

export interface PageStructureTokens {
  landmarks: string[];
  pageStructure: string;
  zIndexLayers: string;
}

export interface DesignSystemClassification {
  theme: ThemeTag;
  density: DensityTag;
  shapeProfile: ShapeProfileTag;
}

export type ExtractionSourceMode =
  | "LIVE_DOM_CAPTURE"
  | "LOCAL_REFERENCE_ARCHETYPE"
  | "SYNTHETIC_PREVIEW"
  | "SCREENSHOT_EXTRACT"
  | "EXTRACTION_FAILED";

export type ScreenshotSource =
  | "HEADLESS_CHROMIUM_VIEWPORT"
  | "SYNTHETIC_FALLBACK_VECTOR_RENDER"
  | "USER_UPLOADED_SCREENSHOT"
  | "NONE";

export interface DesignSystemSnap {
  id: string;
  url: string;
  domain: string;
  timestamp: string;
  screenshotBase64: string;
  viewport: {
    width: number;
    height: number;
  };
  classification: DesignSystemClassification;
  palette: ColorPalette;
  typography: TypographyTokens;
  tokens: ComponentTokens;
  layout: LayoutTokens;
  motion: MotionTokens;
  responsive: ResponsiveTokens;
  structure: PageStructureTokens;
  compiledPrompt: string;
  systemMd: string;
  tailwindTheme?: string;
  cssVariables?: string;
  dtcgTokensJson?: string;
  reactScaffoldTsx?: string;
  sourceMode?: ExtractionSourceMode;
  screenshotSource?: ScreenshotSource;
  requestedUrl?: string;
  finalResolvedUrl?: string;
  extractionTimestamp?: string;
  extractionCompleteness?: number;
  capturedViewport?: {
    width: number;
    height: number;
  };
  unavailableTokenCategories?: string[];
  relevantContentDigest?: string;
  provenanceNotice?: string;
}

export type LauncherToolId =
  | "claude"
  | "gpt"
  | "gemini"
  | "lovable"
  | "manus"
  | "cursor";

export interface LauncherTool {
  id: LauncherToolId;
  name: string;
  description: string;
  url: string;
  accentColor: string;
  iconType: string;
}
