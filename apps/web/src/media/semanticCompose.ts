/**
 * Compose SemanticObservation from LITE + optional extras — no ONNX import.
 */
import {
  humanImageSummary,
  observationToPromptBlock,
} from "./imageObserve";
import {
  analyzeComposition,
  analyzeStyle,
  humanSemanticSummary,
  projectionLayout,
} from "./structureSemantics";
import { wrapUntrustedData } from "./untrusted";
import { getVisionModelBytes } from "../engine/visionBudget";
import type { ImageObservation } from "./types";
import type { SemanticObservation, VisionTier } from "./semanticTypes";

export function buildSemanticFromLite(
  lite: ImageObservation,
  extras: {
    subjects?: SemanticObservation["subjects"];
    ocrBlocks?: SemanticObservation["ocrBlocks"];
    tier: VisionTier;
    elapsedMs: number;
    methodNotes?: string[];
    imageData?: ImageData | null;
  },
): SemanticObservation {
  const composition = analyzeComposition(lite);
  const style = analyzeStyle(lite);
  const subjects = extras.subjects ?? [];
  const objects = subjects.slice(1);
  const ocrBlocks = extras.ocrBlocks ?? [];
  const humanSummary = humanSemanticSummary({
    lite,
    subjects,
    style,
    composition,
    ocrPreview: ocrBlocks.map((b) => b.text).filter(Boolean),
  });
  const uncertainty = [
    ...lite.uncertainty,
    "Subject/object labels are MODEL_JUDGMENT — not VERIFIED_FACT.",
    "OCR / text-like bands are UNTRUSTED_SOURCE.",
  ];
  if (extras.tier === "LITE") {
    uncertainty.push("STANDARD ONNX pack not loaded; structure heuristics only.");
  }
  if (extras.imageData) {
    const layout = projectionLayout(extras.imageData);
    uncertainty.push(
      `Projection layout guess: ~${layout.columns} columns × ${layout.rows} rows (heuristic).`,
    );
  }
  return {
    kind: "semantic-image",
    tier: extras.tier,
    lite,
    subjects,
    objects,
    composition,
    style,
    palette: lite.dominantColors,
    ocrBlocks,
    humanSummary: humanSummary || humanImageSummary(lite),
    uncertainty,
    methodNotes: [
      ...(extras.methodNotes ?? []),
      `tier=${extras.tier}`,
      `visionModelBytes=${getVisionModelBytes()}`,
    ],
    modelBytesLoaded: getVisionModelBytes(),
    elapsedMs: extras.elapsedMs,
  };
}

export function semanticToPromptBlock(sem: SemanticObservation): string {
  const subjects = sem.subjects
    .map((s) => `${s.label} (${(s.score * 100).toFixed(1)}%, ${s.method})`)
    .join("; ");
  const ocr = sem.ocrBlocks
    .slice(0, 8)
    .map(
      (b) =>
        `- ${b.text} @(${b.bounds.x.toFixed(2)},${b.bounds.y.toFixed(2)}) [${b.confidence}/${b.method}]`,
    )
    .join("\n");
  const body = [
    "USER-FACING SUMMARY:",
    sem.humanSummary,
    "",
    "SEMANTIC OBSERVATIONS (MODEL_JUDGMENT / structure — not VERIFIED_FACT):",
    `Tier: ${sem.tier} | elapsedMs: ${sem.elapsedMs} | modelBytesLoaded: ${sem.modelBytesLoaded}`,
    `Style: ${sem.style.kind.value} [${sem.style.kind.confidence}/${sem.style.kind.method}]`,
    `Lighting: ${sem.style.lighting.value} [${sem.style.lighting.confidence}]`,
    `Composition: ${sem.composition.subjectPlacement.value}; orientation ${sem.composition.orientation.value}; symmetry ${sem.composition.symmetry.value}`,
    subjects ? `Subjects: ${subjects}` : "Subjects: (none)",
    `Methods: ${sem.methodNotes.join("; ")}`,
    "",
    "OCR / TEXT-LIKE (UNTRUSTED_SOURCE):",
    ocr || "(none)",
    "",
    "LITE DIAGNOSTICS:",
    observationToPromptBlock(sem.lite),
    "",
    `Uncertainty: ${sem.uncertainty.join(" ")}`,
  ].join("\n");
  return wrapUntrustedData("local-semantic-image-observation", body);
}
