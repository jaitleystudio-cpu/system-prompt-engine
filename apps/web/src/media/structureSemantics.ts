/**
 * Structure-heuristic STANDARD helpers: composition / style / lighting / palette
 * derived from pixels. Method = structure-heuristic (MODEL_JUDGMENT, not VERIFIED_FACT).
 */
import type { ColorSwatch, ImageObservation } from "./types";
import type {
  CompositionAnalysis,
  ConfidenceLabel,
  LabeledJudgment,
  StyleAnalysis,
} from "./semanticTypes";

function label<T>(
  value: T,
  score: number,
  method: LabeledJudgment<T>["method"] = "structure-heuristic",
): LabeledJudgment<T> {
  const confidence: ConfidenceLabel =
    score >= 0.72 ? "high" : score >= 0.45 ? "medium" : "low";
  return { value, confidence, confidenceScore: Math.max(0, Math.min(1, score)), method };
}

function cellMean(obs: ImageObservation, row: number, col: number): number {
  return obs.grid.find((g) => g.row === row && g.col === col)?.meanBrightness ?? 0;
}

export function analyzeComposition(obs: ImageObservation): CompositionAnalysis {
  const left =
    (cellMean(obs, 0, 0) + cellMean(obs, 1, 0) + cellMean(obs, 2, 0)) / 3;
  const mid =
    (cellMean(obs, 0, 1) + cellMean(obs, 1, 1) + cellMean(obs, 2, 1)) / 3;
  const right =
    (cellMean(obs, 0, 2) + cellMean(obs, 1, 2) + cellMean(obs, 2, 2)) / 3;
  const top =
    (cellMean(obs, 0, 0) + cellMean(obs, 0, 1) + cellMean(obs, 0, 2)) / 3;
  const bot =
    (cellMean(obs, 2, 0) + cellMean(obs, 2, 1) + cellMean(obs, 2, 2)) / 3;

  const lr = Math.abs(left - right);
  const tb = Math.abs(top - bot);
  const centerPull = Math.abs(mid - (left + right) / 2);

  let bias: "left" | "center" | "right" | "balanced" = "balanced";
  let biasScore = 0.4;
  if (centerPull < 12 && lr < 18) {
    bias = "balanced";
    biasScore = 0.65;
  } else if (left < right - 20) {
    bias = "left";
    biasScore = Math.min(0.85, 0.45 + lr / 80);
  } else if (right < left - 20) {
    bias = "right";
    biasScore = Math.min(0.85, 0.45 + lr / 80);
  } else if (mid > left && mid > right) {
    bias = "center";
    biasScore = 0.55;
  }

  const symScore = 1 - Math.min(1, (lr + tb) / 120);
  const symmetryValue: "low" | "medium" | "high" =
    symScore > 0.7 ? "high" : symScore > 0.4 ? "medium" : "low";
  const symmetry = label(symmetryValue, symScore);

  const ar = obs.sourceWidth / Math.max(1, obs.sourceHeight);
  const orientationValue: "landscape" | "portrait" | "square" =
    ar > 1.12 ? "landscape" : ar < 0.88 ? "portrait" : "square";
  const orientation = label(orientationValue, 0.9, "lite-pixel");

  const subjectPlacement = label(
    bias === "balanced"
      ? "Mass distributed across frame"
      : `Visual weight leans ${bias}`,
    biasScore,
  );

  return {
    ruleOfThirdsBias: label(bias, biasScore),
    symmetry,
    subjectPlacement,
    orientation,
  };
}

export function analyzeStyle(obs: ImageObservation): StyleAnalysis {
  const edge = obs.edgeDensity;
  const bright = obs.brightness.mean;
  const colors = obs.dominantColors.length;
  const topShare = obs.dominantColors[0]?.share ?? 0;

  // UI screenshots: mid edges, flat large regions, few dominant colors with high share
  let kind: StyleAnalysis["kind"]["value"] = "unknown";
  let kindScore = 0.35;
  if (edge > 0.28 && colors >= 3 && topShare < 0.55) {
    kind = "photograph";
    kindScore = 0.55 + Math.min(0.25, edge);
  } else if (edge > 0.18 && topShare > 0.35 && colors <= 4) {
    kind = "ui-screenshot";
    kindScore = 0.5 + Math.min(0.3, topShare);
  } else if (edge < 0.12 && colors <= 3) {
    kind = "graphic";
    kindScore = 0.55;
  } else if (edge >= 0.12 && edge <= 0.28) {
    kind = "illustration";
    kindScore = 0.45;
  }

  let lighting: StyleAnalysis["lighting"]["value"] = "balanced";
  let lightScore = 0.5;
  if (bright < 45) {
    lighting = "low-key";
    lightScore = 0.75;
  } else if (bright < 70) {
    lighting = "dark";
    lightScore = 0.7;
  } else if (bright < 110) {
    lighting = "dim";
    lightScore = 0.6;
  } else if (bright < 170) {
    lighting = "balanced";
    lightScore = 0.65;
  } else if (bright < 210) {
    lighting = "bright";
    lightScore = 0.7;
  } else {
    lighting = "high-key";
    lightScore = 0.75;
  }

  const hexes = obs.dominantColors.slice(0, 3).map((c) => c.hex);
  const paletteMood = label(
    hexes.length
      ? `Dominant ${hexes.join(", ")}`
      : "Sparse opaque palette",
    hexes.length ? 0.7 : 0.3,
    "lite-pixel",
  );

  return {
    kind: label(kind as StyleAnalysis["kind"]["value"], kindScore),
    lighting: label(lighting as StyleAnalysis["lighting"]["value"], lightScore, "lite-pixel"),
    paletteMood,
  };
}

/** Horizontal / vertical projection peaks → column & row guesses. */
export function projectionLayout(
  data: ImageData,
  step = 2,
): { columns: number; rows: number; gutters: number[]; rowGaps: number[] } {
  const { width, height, data: px } = data;
  const colEnergy = new Float32Array(width);
  const rowEnergy = new Float32Array(height);
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const i = (y * width + x) * 4;
      if (px[i + 3] < 16) continue;
      const c = (px[i] + px[i + 1] + px[i + 2]) / 3;
      const right = (y * width + (x + 1)) * 4;
      const down = ((y + 1) * width + x) * 4;
      const mag =
        Math.abs(c - (px[right] + px[right + 1] + px[right + 2]) / 3) +
        Math.abs(c - (px[down] + px[down + 1] + px[down + 2]) / 3);
      colEnergy[x] += mag;
      rowEnergy[y] += mag;
    }
  }
  const gutters = findValleys(colEnergy, width * 0.04);
  const rowGaps = findValleys(rowEnergy, height * 0.04);
  const columns = Math.max(1, Math.min(6, gutters.length + 1));
  const rows = Math.max(1, Math.min(8, rowGaps.length + 1));
  return {
    columns,
    rows,
    gutters: gutters.map((x) => x / width),
    rowGaps: rowGaps.map((y) => y / height),
  };
}

function findValleys(energy: Float32Array, minGap: number): number[] {
  let max = 0;
  for (let i = 0; i < energy.length; i++) max = Math.max(max, energy[i]);
  if (max <= 0) return [];
  const thresh = max * 0.18;
  const valleys: number[] = [];
  let inValley = false;
  let start = 0;
  for (let i = 0; i < energy.length; i++) {
    if (energy[i] < thresh) {
      if (!inValley) {
        inValley = true;
        start = i;
      }
    } else if (inValley) {
      inValley = false;
      const mid = Math.floor((start + i) / 2);
      if (
        i - start >= minGap * 0.5 &&
        (valleys.length === 0 || mid - valleys[valleys.length - 1] >= minGap)
      ) {
        // skip edges
        if (mid > energy.length * 0.08 && mid < energy.length * 0.92) {
          valleys.push(mid);
        }
      }
    }
  }
  return valleys.slice(0, 5);
}

export function humanSemanticSummary(parts: {
  lite: ImageObservation;
  subjects: { label: string; score: number }[];
  style: StyleAnalysis;
  composition: CompositionAnalysis;
  ocrPreview: string[];
}): string {
  const subj = parts.subjects
    .slice(0, 3)
    .map((s) => s.label.replace(/_/g, " "))
    .join(", ");
  const colors = parts.lite.dominantColors
    .slice(0, 3)
    .map((c: ColorSwatch) => c.hex)
    .join(", ");
  const ocr =
    parts.ocrPreview.length > 0
      ? ` Visible text-like regions hint at: ${parts.ocrPreview.slice(0, 4).join(" · ")}.`
      : "";
  return [
    `A ${parts.composition.orientation.value} ${parts.lite.sourceWidth}×${parts.lite.sourceHeight} image.`,
    `Reads as ${parts.style.kind.value} with ${parts.style.lighting.value} lighting.`,
    subj ? `Likely subjects (model judgment): ${subj}.` : "Subject labels unavailable (LITE path).",
    colors ? `Palette leans ${colors}.` : "",
    parts.composition.subjectPlacement.value + ".",
    ocr,
  ]
    .filter(Boolean)
    .join(" ");
}
