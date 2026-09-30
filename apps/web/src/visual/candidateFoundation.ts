/**
 * A12 visual / screenshot UX foundation.
 *
 * Projects existing image and screenshot observations into a view.
 * Lane boundary: do not redefine WebsiteSpec (G13 / A11). This module is not
 * a second IR or compiler, and it does not mint authority from pixels.
 */

import type {
  SemanticObservation,
  UIObservationIR,
} from "../media/semanticTypes";

export const CANDIDATE_FOUNDATION_KIND = "candidate-ui-foundation" as const;

export const TRUTH_AXES = ["ocr", "assets", "responsive", "fidelity"] as const;

export type TruthAxis = (typeof TRUTH_AXES)[number];

export type TruthVerdict = "PASS" | "FAIL" | "UNKNOWN";

export type EpistemicStatus =
  | "OBSERVATION"
  | "MODEL_JUDGMENT"
  | "SUPPLIED_UNTRUSTED"
  | "ABSENT";

export type TruthLabel = {
  axis: TruthAxis;
  verdict: TruthVerdict;
  epistemic: EpistemicStatus;
  /** Plain statement of what was actually done. */
  statement: string;
  /** Plain refusal. Never a pixel-match claim. */
  refuses: string;
};

export type CandidateBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CandidateRegion = {
  id: string;
  roleGuess: string;
  bounds: CandidateBounds;
  confidence: "high" | "medium" | "low";
  evidence: string;
};

export type CandidatePreview = {
  layoutGuess: string;
  regions: CandidateRegion[];
  placedCount: number;
  unplacedCount: number;
  note: string;
};

type SharedView = {
  kind: typeof CANDIDATE_FOUNDATION_KIND;
  boundary: "VIEW_OF_EXISTING_OBSERVATION";
  notPixelPerfect: true;
  notWebsiteSpec: true;
  authorityDeltaFromMedia: 0;
  sourceWidth: number;
  sourceHeight: number;
  visualSummary: string;
  truth: readonly TruthLabel[];
  limits: readonly string[];
  openQuestions: readonly string[];
};

export type ImageCandidateView = SharedView & {
  source: "image";
  flow: readonly ["Image", "Visual"];
  candidatePreview: null;
};

export type ScreenshotCandidateView = SharedView & {
  source: "screenshot";
  flow: readonly ["Screenshot", "Structure", "Candidate UI"];
  candidatePreview: CandidatePreview;
};

export type CandidateUiView = ImageCandidateView | ScreenshotCandidateView;

const IMAGE_FLOW = ["Image", "Visual"] as const;
const SCREENSHOT_FLOW = ["Screenshot", "Structure", "Candidate UI"] as const;

const PIXEL_REFUSAL = "This is not a pixel-perfect recreation.";

function finiteDim(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function sizePhrase(width: number, height: number): string {
  if (width > 0 && height > 0) return `${width}×${height}`;
  return "an unrecorded size";
}

function isDecodedText(text: string, method: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[text-like")) return false;
  return method === "ocr-tesseract" || method === "supplied";
}

function ocrLabel(
  blocks: readonly { text: string; method: string }[],
): TruthLabel {
  if (blocks.length === 0) {
    return {
      axis: "ocr",
      verdict: "UNKNOWN",
      epistemic: "ABSENT",
      statement: "No text-like bands were recorded in this pass.",
      refuses:
        "This does not prove the picture has no text, and it does not transcribe words.",
    };
  }
  const decoded = blocks.filter((block) =>
    isDecodedText(block.text, block.method),
  );
  if (decoded.length > 0) {
    return {
      axis: "ocr",
      verdict: "UNKNOWN",
      epistemic: "SUPPLIED_UNTRUSTED",
      statement: `${decoded.length} text block(s) came with this picture. The words were not checked.`,
      refuses:
        "Supplied or decoded text is untrusted source material. Character truth is not verified.",
    };
  }
  return {
    axis: "ocr",
    verdict: "UNKNOWN",
    epistemic: "MODEL_JUDGMENT",
    statement: `${blocks.length} text-like band(s) were noticed. The words were not read.`,
    refuses:
      "Band text is untrusted source material. Character truth is not verified.",
  };
}

function assetsLabel(paletteCount: number): TruthLabel {
  const statement =
    paletteCount > 0
      ? `${paletteCount} color sample(s) were measured from pixels. Icons, photos, and fonts inside the capture were not extracted.`
      : "No color samples were measured. Icons, photos, and fonts were not extracted.";
  return {
    axis: "assets",
    verdict: "UNKNOWN",
    epistemic: "ABSENT",
    statement,
    refuses: "Color samples are not recovered assets.",
  };
}

function responsiveLabel(width: number, height: number): TruthLabel {
  return {
    axis: "responsive",
    verdict: "UNKNOWN",
    epistemic: "ABSENT",
    statement: `One capture was measured at ${sizePhrase(width, height)}. Other screen sizes were not seen.`,
    refuses: "This does not claim a responsive layout or extra breakpoints.",
  };
}

function fidelityLabel(
  source: "image" | "screenshot",
  epistemic: "OBSERVATION" | "MODEL_JUDGMENT",
  placedRegions: number,
): TruthLabel {
  const statement =
    source === "image"
      ? "These notes describe the picture. They are not a user interface."
      : placedRegions > 0
        ? "The candidate shows guessed regions in a frame. It is a layout sketch, not a copy of the screenshot."
        : "No regions were placed, so the candidate frame stays empty. That is a gap, not a copy.";
  return {
    axis: "fidelity",
    verdict: "UNKNOWN",
    epistemic,
    statement,
    refuses: PIXEL_REFUSAL,
  };
}

function sharedLimits(source: "image" | "screenshot"): readonly string[] {
  const limits = [
    "This view reads an existing picture or screenshot observation. It is not a second compiler.",
    "It does not define a website specification.",
    "The picture adds no authority.",
    PIXEL_REFUSAL,
  ];
  if (source === "screenshot") {
    limits.push(
      "Starter scaffolds, when shown, are prompts for a coding tool. They are not a compiled app.",
    );
  }
  return limits;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeRegion(
  region: CandidateRegion,
  index: number,
): CandidateRegion {
  return {
    id: region.id || `region-${index + 1}`,
    roleGuess: region.roleGuess.trim() || "Unlabeled region",
    bounds: {
      x: clampUnit(region.bounds.x),
      y: clampUnit(region.bounds.y),
      w: clampUnit(region.bounds.w),
      h: clampUnit(region.bounds.h),
    },
    confidence: region.confidence,
    evidence: region.evidence.trim(),
  };
}

function isPlaced(region: CandidateRegion): boolean {
  return region.bounds.w > 0 && region.bounds.h > 0;
}

export type ImageFoundationInput = {
  summary: string;
  sourceWidth: number;
  sourceHeight: number;
  paletteCount: number;
  ocrBlocks: readonly { text: string; method: string }[];
  fidelityEpistemic: "OBSERVATION" | "MODEL_JUDGMENT";
  openQuestions: readonly string[];
};

export function candidateFromImage(
  input: ImageFoundationInput,
): ImageCandidateView {
  const sourceWidth = finiteDim(input.sourceWidth);
  const sourceHeight = finiteDim(input.sourceHeight);
  const summary = input.summary.trim();
  const visualSummary = summary
    ? `Picture read at ${sizePhrase(sourceWidth, sourceHeight)}. ${summary}`
    : `Picture read at ${sizePhrase(sourceWidth, sourceHeight)}. No separate visual summary was produced.`;
  return {
    kind: CANDIDATE_FOUNDATION_KIND,
    source: "image",
    flow: IMAGE_FLOW,
    boundary: "VIEW_OF_EXISTING_OBSERVATION",
    notPixelPerfect: true,
    notWebsiteSpec: true,
    authorityDeltaFromMedia: 0,
    sourceWidth,
    sourceHeight,
    visualSummary,
    candidatePreview: null,
    truth: [
      ocrLabel(input.ocrBlocks),
      assetsLabel(input.paletteCount),
      responsiveLabel(sourceWidth, sourceHeight),
      fidelityLabel("image", input.fidelityEpistemic, 0),
    ],
    limits: sharedLimits("image"),
    openQuestions: input.openQuestions.map((line) => line.trim()).filter(Boolean).slice(0, 4),
  };
}

export type ScreenshotFoundationInput = {
  sourceWidth: number;
  sourceHeight: number;
  columns: number;
  rows: number;
  paletteCount: number;
  regions: readonly CandidateRegion[];
  ocrBlocks: readonly { text: string; method: string }[];
  openQuestions: readonly string[];
};

export function candidateFromScreenshot(
  input: ScreenshotFoundationInput,
): ScreenshotCandidateView {
  const sourceWidth = finiteDim(input.sourceWidth);
  const sourceHeight = finiteDim(input.sourceHeight);
  const regions = input.regions.map(normalizeRegion);
  const placed = regions.filter(isPlaced);
  const columns = Number.isFinite(input.columns) ? input.columns : 0;
  const rows = Number.isFinite(input.rows) ? input.rows : 0;
  const layoutGuess = `About ${columns} columns by ${rows} rows in one capture.`;
  const visualSummary = `Screenshot read at ${sizePhrase(sourceWidth, sourceHeight)}. ${regions.length} region guess(es). ${layoutGuess}`;
  const note =
    placed.length > 0
      ? "Structural candidate from guessed regions. Not a compiled page."
      : "Structural candidate with nothing placed. Not a compiled page.";
  return {
    kind: CANDIDATE_FOUNDATION_KIND,
    source: "screenshot",
    flow: SCREENSHOT_FLOW,
    boundary: "VIEW_OF_EXISTING_OBSERVATION",
    notPixelPerfect: true,
    notWebsiteSpec: true,
    authorityDeltaFromMedia: 0,
    sourceWidth,
    sourceHeight,
    visualSummary,
    candidatePreview: {
      layoutGuess,
      regions,
      placedCount: placed.length,
      unplacedCount: regions.length - placed.length,
      note,
    },
    truth: [
      ocrLabel(input.ocrBlocks),
      assetsLabel(input.paletteCount),
      responsiveLabel(sourceWidth, sourceHeight),
      fidelityLabel("screenshot", "MODEL_JUDGMENT", placed.length),
    ],
    limits: sharedLimits("screenshot"),
    openQuestions: input.openQuestions.map((line) => line.trim()).filter(Boolean).slice(0, 4),
  };
}

export function candidateFromSemantic(
  sem: SemanticObservation,
): ImageCandidateView {
  const judged =
    sem.subjects.length > 0 ||
    sem.style.kind.method !== "lite-pixel" ||
    sem.composition.symmetry.method !== "lite-pixel";
  return candidateFromImage({
    summary: sem.humanSummary,
    sourceWidth: sem.lite.sourceWidth,
    sourceHeight: sem.lite.sourceHeight,
    paletteCount: sem.palette.length,
    ocrBlocks: sem.ocrBlocks.map((block) => ({
      text: block.text,
      method: block.method,
    })),
    fidelityEpistemic: judged ? "MODEL_JUDGMENT" : "OBSERVATION",
    openQuestions: sem.uncertainty,
  });
}

export function candidateFromObservationIR(
  ir: UIObservationIR,
): ScreenshotCandidateView {
  return candidateFromScreenshot({
    sourceWidth: ir.viewport.sourceWidth,
    sourceHeight: ir.viewport.sourceHeight,
    columns: ir.columns,
    rows: ir.rows,
    paletteCount: ir.palette.length,
    regions: ir.regions.map((region) => ({
      id: region.id,
      roleGuess: region.roleGuess,
      bounds: region.bounds,
      confidence: region.confidence,
      evidence: region.evidence,
    })),
    ocrBlocks: ir.semantic.ocrBlocks.map((block) => ({
      text: block.text,
      method: block.method,
    })),
    openQuestions: ir.uncertainty,
  });
}

export function truthVerdictLabel(verdict: TruthVerdict): string {
  switch (verdict) {
    case "UNKNOWN":
      return "Not verified";
    case "PASS":
      return "Observed";
    case "FAIL":
      return "Does not hold";
    default: {
      const exhausted: never = verdict;
      return exhausted;
    }
  }
}

export function epistemicLabel(status: EpistemicStatus): string {
  switch (status) {
    case "OBSERVATION":
      return "Measured from pixels";
    case "MODEL_JUDGMENT":
      return "Judgment, not a fact";
    case "SUPPLIED_UNTRUSTED":
      return "Untrusted text";
    case "ABSENT":
      return "Not present in this pass";
    default: {
      const exhausted: never = status;
      return exhausted;
    }
  }
}

export function truthAxisTitle(axis: TruthAxis): string {
  switch (axis) {
    case "ocr":
      return "Text";
    case "assets":
      return "Assets";
    case "responsive":
      return "Screen size";
    case "fidelity":
      return "Match";
    default: {
      const exhausted: never = axis;
      return exhausted;
    }
  }
}

/** Returns human-readable violations. An empty list means the view stays honest. */
export function candidateInvariantViolations(view: CandidateUiView): string[] {
  const problems: string[] = [];
  if (view.kind !== CANDIDATE_FOUNDATION_KIND) problems.push("kind");
  if (view.boundary !== "VIEW_OF_EXISTING_OBSERVATION") problems.push("boundary");
  if (view.notPixelPerfect !== true) problems.push("pixel-flag");
  if (view.notWebsiteSpec !== true) problems.push("website-spec-flag");
  if (view.authorityDeltaFromMedia !== 0) problems.push("authority");
  if (view.truth.length !== TRUTH_AXES.length) problems.push("truth-count");
  TRUTH_AXES.forEach((axis, index) => {
    if (view.truth[index]?.axis !== axis) problems.push(`axis-order:${axis}`);
  });
  for (const label of view.truth) {
    if (label.verdict === "PASS") problems.push(`pass-refused:${label.axis}`);
    if (label.epistemic === "ABSENT" && label.verdict !== "UNKNOWN") {
      problems.push(`absent-not-unknown:${label.axis}`);
    }
    if (/pixel-perfect|100%/i.test(label.statement)) {
      problems.push(`statement-overclaim:${label.axis}`);
    }
  }
  if (!view.truth.some((label) => label.axis === "fidelity" && /pixel-perfect/i.test(label.refuses))) {
    problems.push("missing-pixel-refusal");
  }
  if (view.source === "image") {
    if (view.flow.join(" → ") !== "Image → Visual") problems.push("image-flow");
    if (view.candidatePreview !== null) problems.push("image-has-candidate");
  } else {
    if (view.flow.join(" → ") !== "Screenshot → Structure → Candidate UI") {
      problems.push("screenshot-flow");
    }
    if (!view.candidatePreview) problems.push("missing-candidate");
  }
  const joinedLimits = view.limits.join(" ");
  if (!/not a second compiler/i.test(joinedLimits)) problems.push("compiler-limit");
  if (!/website specification/i.test(joinedLimits)) problems.push("spec-limit");
  if (!/no authority/i.test(joinedLimits)) problems.push("authority-limit");
  if (!/pixel-perfect/i.test(joinedLimits)) problems.push("pixel-limit");
  return problems;
}
