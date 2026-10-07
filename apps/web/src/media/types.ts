/** Shared media → grounded observation types (browser-local, zero paid APIs). */

export type ColorSwatch = {
  hex: string;
  share: number;
};

export type ImageObservation = {
  kind: "image";
  /** Dimensions used for analysis (may be downscaled). */
  width: number;
  height: number;
  /** Original source pixel dimensions before analysis downscale. */
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio: string;
  megapixels: number;
  fileName: string | null;
  fileBytes: number | null;
  mimeType: string | null;
  dominantColors: ColorSwatch[];
  brightness: {
    mean: number;
    darkShare: number;
    lightShare: number;
  };
  edgeDensity: number;
  grid: { row: number; col: number; meanBrightness: number }[];
  notes: string[];
  uncertainty: string[];
  licenseNote: string;
};

export type VideoObservation = {
  kind: "video";
  durationSec: number;
  width: number;
  height: number;
  fileName: string | null;
  fileBytes: number | null;
  mimeType: string | null;
  sampleTimesSec: number[];
  frames: ImageObservation[];
  sequenceSummary: string;
  notes: string[];
  uncertainty: string[];
};

export type UiRegion = {
  id: string;
  roleGuess: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: "high" | "medium" | "low";
  notes: string;
};

/** Tight glyph ink measured inside an OCR box. Pixels, not a preset size. */
export type ObservedFontInk = {
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: number;
  color: string;
};

export type UiObservedText = {
  id: string;
  text: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: "high" | "medium" | "low";
  provenance: "observed-ocr";
  fontInk?: ObservedFontInk;
};

export type UiSpec = {
  frameworkTargets: readonly string[];
  layout: string;
  regions: UiRegion[];
  palette: ColorSwatch[];
  observations: ImageObservation;
  uncertainty: string[];
  /** Genuine OCR only. Missing recognition stays absent, not a guessed label. */
  textBlocks?: UiObservedText[];
};

export type CodeScaffold = {
  target: string;
  label: string;
  language: string;
  code: string;
  prompt: string;
};

/** Provenance for intentionally bounded URL/HTML source material. */
export type SourceBounds = {
  original_size: number;
  used_size: number;
  truncated: boolean;
  limit: number;
  reason: string | null;
};

export type UrlIngestResult =
  | {
      status: "ok";
      url: string;
      finalUrl: string;
      title: string | null;
      description: string | null;
      textExcerpt: string;
      buildBrief: string | null;
      notes: string[];
      sourceBounds: SourceBounds;
    }
  | {
      /** Remote page HTML was not read; URL kept as a reference only. */
      status: "url_reference_only";
      url: string;
      message: string;
      reason: "csp_connect_src_self" | "remote_fetch_unavailable" | "destination_binding_unverifiable";
      fallbacks: string[];
    }
  | {
      status: "cors_blocked" | "network_error" | "invalid_url" | "timeout" | "aborted";
      url: string;
      finalUrl?: string;
      /** Execution-boundary refusal code for hard security refusals (machine code, not UX copy). */
      refusal?: string;
      message: string;
      fallbacks: string[];
    };
