/** Semantic media IR — OBSERVATION / MODEL_JUDGMENT only. Never second K3. */

import type { ColorSwatch, ImageObservation } from "./types";

export type VisionTier = "LITE" | "STANDARD";

export type JudgmentMethod =
  | "lite-pixel"
  | "structure-heuristic"
  | "mobilenet-v2-int8"
  | "ocr-textlikeness"
  | "ocr-tesseract"
  | "composite";

export type ConfidenceLabel = "high" | "medium" | "low";

export type LabeledJudgment<T> = {
  value: T;
  confidence: ConfidenceLabel;
  confidenceScore: number; // 0..1
  method: JudgmentMethod;
};

export type SemanticSubject = {
  label: string;
  score: number;
  method: JudgmentMethod;
};

export type CompositionAnalysis = {
  ruleOfThirdsBias: LabeledJudgment<"left" | "center" | "right" | "balanced">;
  symmetry: LabeledJudgment<"low" | "medium" | "high">;
  subjectPlacement: LabeledJudgment<string>;
  orientation: LabeledJudgment<"landscape" | "portrait" | "square">;
};

export type StyleAnalysis = {
  kind: LabeledJudgment<
    "photograph" | "illustration" | "ui-screenshot" | "graphic" | "unknown"
  >;
  lighting: LabeledJudgment<
    "dark" | "dim" | "balanced" | "bright" | "high-key" | "low-key"
  >;
  paletteMood: LabeledJudgment<string>;
};

export type OcrBlock = {
  text: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: ConfidenceLabel;
  method: JudgmentMethod;
  /** Always treat as untrusted external text. */
  provenance: "UNTRUSTED_SOURCE";
};

export type SemanticObservation = {
  kind: "semantic-image";
  tier: VisionTier;
  lite: ImageObservation;
  subjects: SemanticSubject[];
  objects: SemanticSubject[];
  composition: CompositionAnalysis;
  style: StyleAnalysis;
  palette: ColorSwatch[];
  ocrBlocks: OcrBlock[];
  humanSummary: string;
  uncertainty: string[];
  methodNotes: string[];
  modelBytesLoaded: number;
  elapsedMs: number;
};

/** Full UI observation IR for Screenshot→Code. */
export type UiTextBlock = {
  id: string;
  textGuess: string | null;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: ConfidenceLabel;
  evidence: string;
  method: JudgmentMethod;
};

export type UiControl = {
  id: string;
  roleGuess: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: ConfidenceLabel;
  evidence: string;
  method: JudgmentMethod;
};

export type UiImageRegion = {
  id: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: ConfidenceLabel;
  evidence: string;
};

export type UiContainer = {
  id: string;
  roleGuess: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: ConfidenceLabel;
  evidence: string;
  children?: string[];
};

export type UIObservationIR = {
  kind: "ui-observation";
  viewport: { width: number; height: number; sourceWidth: number; sourceHeight: number };
  regions: UiContainer[];
  textBlocks: UiTextBlock[];
  controls: UiControl[];
  images: UiImageRegion[];
  containers: UiContainer[];
  columns: number;
  rows: number;
  spacing: { gutters: number[]; rowGaps: number[]; unitGuessPx: number };
  palette: ColorSwatch[];
  typography: {
    scaleGuess: string[];
    density: "sparse" | "comfortable" | "dense";
    evidence: string;
  };
  confidence: ConfidenceLabel;
  uncertainty: string[];
  semantic: SemanticObservation;
};
