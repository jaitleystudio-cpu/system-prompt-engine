/** Shared media → grounded observation types (browser-local, zero paid APIs). */

export type ColorSwatch = {
  hex: string;
  share: number;
};

export type ImageObservation = {
  kind: "image";
  width: number;
  height: number;
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

export type UiSpec = {
  frameworkTargets: readonly string[];
  layout: string;
  regions: UiRegion[];
  palette: ColorSwatch[];
  observations: ImageObservation;
  uncertainty: string[];
};

export type CodeScaffold = {
  target: string;
  label: string;
  language: string;
  code: string;
  prompt: string;
};

export type UrlIngestResult =
  | {
      status: "ok";
      url: string;
      title: string | null;
      description: string | null;
      textExcerpt: string;
      notes: string[];
    }
  | {
      status: "cors_blocked" | "network_error" | "invalid_url";
      url: string;
      message: string;
      fallbacks: string[];
    };
