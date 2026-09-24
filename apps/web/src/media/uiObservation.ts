/**
 * UIObservationIR — replaces crude top/middle/bottom-only screenshot IR.
 * Role guesses require evidence + confidence. Method labeled.
 */
import { observeImageData } from "./imageObserve";
import type { SemanticObservation } from "./semanticTypes";
import { buildSemanticFromLite } from "./semanticCompose";
import { observeImageSemanticFromData } from "./semanticPipeline";
import { projectionLayout } from "./structureSemantics";
import { detectTextLikeRegions } from "./ocrLite";
import type {
  UIObservationIR,
  UiContainer,
  UiControl,
  UiImageRegion,
  UiTextBlock,
} from "./semanticTypes";
import type { ImageObservation } from "./types";

function bandContrast(
  obs: ImageObservation,
  row: number,
): { mean: number; delta: number } {
  const cells = obs.grid.filter((g) => g.row === row);
  const mean =
    cells.reduce((s, g) => s + g.meanBrightness, 0) / (cells.length || 1);
  const mid =
    obs.grid
      .filter((g) => g.row === 1)
      .reduce((s, g) => s + g.meanBrightness, 0) / 3;
  return { mean, delta: Math.abs(mean - mid) };
}

export function buildUIObservationIR(
  data: ImageData,
  semantic: SemanticObservation,
): UIObservationIR {
  const obs = semantic.lite;
  const layout = projectionLayout(data);
  const top = bandContrast(obs, 0);
  const bot = bandContrast(obs, 2);
  const regions: UiContainer[] = [];
  const containers: UiContainer[] = [];

  regions.push({
    id: "region-header",
    roleGuess: "Header / top bar",
    bounds: { x: 0, y: 0, w: 1, h: Math.min(0.28, layout.rowGaps[0] ?? 1 / 3) },
    confidence: top.delta > 35 ? "high" : top.delta > 18 ? "medium" : "low",
    evidence: `Row-0 brightness ${top.mean.toFixed(0)}; Δ vs mid ${top.delta.toFixed(0)}; edgeDensity ${obs.edgeDensity}`,
  });
  regions.push({
    id: "region-main",
    roleGuess: "Main content",
    bounds: {
      x: 0,
      y: regions[0].bounds.h,
      w: 1,
      h: Math.max(0.3, 1 - regions[0].bounds.h - 0.18),
    },
    confidence: "medium",
    evidence: `Central band; projection rows≈${layout.rows} cols≈${layout.columns}`,
  });
  regions.push({
    id: "region-footer",
    roleGuess: "Footer / bottom actions",
    bounds: {
      x: 0,
      y: 1 - Math.min(0.22, 1 - (layout.rowGaps[layout.rowGaps.length - 1] ?? 2 / 3)),
      w: 1,
      h: Math.min(0.22, 1 - (layout.rowGaps[layout.rowGaps.length - 1] ?? 2 / 3)),
    },
    confidence: bot.delta > 30 ? "medium" : "low",
    evidence: `Bottom brightness ${bot.mean.toFixed(0)}; Δ vs mid ${bot.delta.toFixed(0)}`,
  });

  // Side rail if left/right diverge
  const left =
    obs.grid.filter((g) => g.col === 0).reduce((s, g) => s + g.meanBrightness, 0) /
    3;
  const right =
    obs.grid.filter((g) => g.col === 2).reduce((s, g) => s + g.meanBrightness, 0) /
    3;
  if (Math.abs(left - right) > 40) {
    const rail: UiContainer = {
      id: "region-rail",
      roleGuess: "Side rail / navigation",
      bounds: {
        x: left < right ? 0 : 2 / 3,
        y: 0,
        w: 1 / 3,
        h: 1,
      },
      confidence: "low",
      evidence: `L/R brightness ${left.toFixed(0)} vs ${right.toFixed(0)}`,
    };
    regions.push(rail);
    containers.push(rail);
  }
  containers.push(...regions);

  const textBlocks: UiTextBlock[] = detectTextLikeRegions(data).map((b, i) => ({
    id: `text-${i}`,
    textGuess: b.text,
    bounds: b.bounds,
    confidence: b.confidence,
    evidence: `Text-likeness HF projection (${b.method})`,
    method: b.method,
  }));

  const controls: UiControl[] = [];
  // Compact mid-contrast cells → button-like guesses
  for (const g of obs.grid) {
    if (g.row === 0 || g.row === 2) {
      const localEdge = obs.edgeDensity;
      if (localEdge > 0.12 && g.meanBrightness > 40 && g.meanBrightness < 220) {
        controls.push({
          id: `ctrl-r${g.row}c${g.col}`,
          roleGuess: g.row === 0 ? "Toolbar control" : "Action / tab",
          bounds: {
            x: g.col / 3,
            y: g.row / 3,
            w: 1 / 3,
            h: 1 / 3,
          },
          confidence: "low",
          evidence: `Band cell brightness ${g.meanBrightness.toFixed(0)}; not OCR-verified`,
          method: "structure-heuristic",
        });
      }
    }
  }

  const images: UiImageRegion[] = [];
  if (obs.edgeDensity > 0.2) {
    images.push({
      id: "img-hero-guess",
      bounds: { x: 0.1, y: 0.25, w: 0.8, h: 0.4 },
      confidence: "low",
      evidence: `Elevated edge density ${obs.edgeDensity} in mid frame — possible media block`,
    });
  }

  const density =
    textBlocks.length > 6
      ? "dense"
      : textBlocks.length > 2
        ? "comfortable"
        : "sparse";

  // Structure hints from coarse geometry — used by code scaffolds (form/cards/modal).
  const structureHints: string[] = [];
  const midCells = obs.grid.filter((g) => g.row === 1);
  const midMean =
    midCells.reduce((s, g) => s + g.meanBrightness, 0) / (midCells.length || 1);
  const borderMean =
    obs.grid
      .filter((g) => g.row === 0 || g.row === 2 || g.col === 0 || g.col === 2)
      .reduce((s, g) => s + g.meanBrightness, 0) / 8;
  if (midMean - borderMean > 50 && obs.edgeDensity > 0.08) {
    structureHints.push("modal-or-dialog-candidate");
    regions.push({
      id: "region-modal",
      roleGuess: "Modal / dialog overlay",
      bounds: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
      confidence: "low",
      evidence: `Bright center (${midMean.toFixed(0)}) vs border (${borderMean.toFixed(0)})`,
    });
  }
  const checker =
    obs.grid.filter((g) => g.meanBrightness > 160).length >= 3 &&
    obs.grid.filter((g) => g.meanBrightness < 100).length >= 3;
  if (checker && Math.abs(left - right) < 40) {
    structureHints.push("card-grid-candidate");
    for (const g of obs.grid) {
      if (g.meanBrightness > 160 && g.row >= 0) {
        regions.push({
          id: `region-card-r${g.row}c${g.col}`,
          roleGuess: "Card / tile",
          bounds: { x: g.col / 3, y: g.row / 3, w: 1 / 3, h: 1 / 3 },
          confidence: "low",
          evidence: `Checker brightness ${g.meanBrightness.toFixed(0)}`,
        });
      }
    }
  }
  if (
    midMean > 180 &&
    top.mean < 80 &&
    obs.edgeDensity > 0.05 &&
    Math.abs(left - right) < 35
  ) {
    structureHints.push("form-panel-candidate");
    regions.push({
      id: "region-form",
      roleGuess: "Form / input panel",
      bounds: { x: 0.15, y: 0.25, w: 0.7, h: 0.5 },
      confidence: "low",
      evidence: `Bright mid panel ${midMean.toFixed(0)} under dark header`,
    });
    controls.push({
      id: "ctrl-form-primary",
      roleGuess: "Primary form action",
      bounds: { x: 0.35, y: 0.65, w: 0.3, h: 0.1 },
      confidence: "low",
      evidence: "Inferred from bright form panel geometry",
      method: "structure-heuristic",
    });
  }

    const confidence =
    regions.filter((r) => r.confidence === "high").length >= 1 &&
    layout.columns >= 1
      ? "medium"
      : "low";

  return {
    kind: "ui-observation",
    viewport: {
      width: obs.width,
      height: obs.height,
      sourceWidth: obs.sourceWidth,
      sourceHeight: obs.sourceHeight,
    },
    regions,
    textBlocks,
    controls: controls.slice(0, 8),
    images,
    containers,
    columns: layout.columns,
    rows: layout.rows,
    spacing: {
      gutters: layout.gutters,
      rowGaps: layout.rowGaps,
      unitGuessPx: Math.max(4, Math.round(obs.width / 40)),
    },
    palette: obs.dominantColors,
    typography: {
      scaleGuess: textBlocks.length
        ? ["body", textBlocks.some((t) => t.bounds.h > 0.06) ? "display" : "caption"]
        : ["unknown"],
      density,
      evidence: `${textBlocks.length} text-like bands; spacing unit ~${Math.round(obs.width / 40)}px`,
    },
    confidence,
    uncertainty: [
      ...semantic.uncertainty,
      "UI roles are structure heuristics + optional MobileNet context — verify against the screenshot.",
      "Typography sizes are guessed from band height, not measured fonts.",
      ...(structureHints.length
        ? [`Structure hints: ${structureHints.join(", ")}`]
        : []),
    ],
    semantic,
  };
}

export async function observeScreenshotIR(
  data: ImageData,
  meta: Parameters<typeof observeImageData>[1],
  opts?: { signal?: AbortSignal; onProgress?: (p: number, l: string) => void },
): Promise<UIObservationIR> {
  const semantic = await observeImageSemanticFromData(data, meta, {
    tier: "STANDARD",
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });
  return buildUIObservationIR(data, semantic);
}

/** Node/test helper without ONNX. */
export function observeScreenshotIRLite(data: ImageData): UIObservationIR {
  const lite = observeImageData(data, {
    sourceWidth: data.width,
    sourceHeight: data.height,
  });
  const semantic = buildSemanticFromLite(lite, {
    tier: "LITE",
    elapsedMs: 0,
    ocrBlocks: detectTextLikeRegions(data),
    methodNotes: ["ui-ir-lite"],
    imageData: data,
  });
  return buildUIObservationIR(data, semantic);
}
