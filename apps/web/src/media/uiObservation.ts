/**
 * UIObservationIR — structure-aware screenshot IR for Screenshot→Code.
 * Role guesses carry evidence + confidence. Method labeled. Not pixel-perfect OCR.
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

type Bounds = { x: number; y: number; w: number; h: number };

function rectMean(data: ImageData, b: Bounds): number {
  const x0 = Math.max(0, Math.floor(b.x * data.width));
  const y0 = Math.max(0, Math.floor(b.y * data.height));
  const x1 = Math.min(data.width, Math.ceil((b.x + b.w) * data.width));
  const y1 = Math.min(data.height, Math.ceil((b.y + b.h) * data.height));
  let sum = 0;
  let n = 0;
  const px = data.data;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * data.width + x) * 4;
      if (px[i + 3] < 16) continue;
      sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
      n++;
    }
  }
  return n ? sum / n : 0;
}

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

function zoneOf(b: Bounds): { h: "left" | "center" | "right"; v: "top" | "mid" | "bottom" } {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return {
    h: cx < 0.33 ? "left" : cx > 0.66 ? "right" : "center",
    v: cy < 0.33 ? "top" : cy > 0.66 ? "bottom" : "mid",
  };
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
  const structureHints: string[] = [];

  const headerH = Math.min(0.22, Math.max(0.08, layout.rowGaps[0] ?? 0.15));
  const footerH = Math.min(0.2, Math.max(0.08, 1 - (layout.rowGaps[layout.rowGaps.length - 1] ?? 0.85)));

  regions.push({
    id: "region-header",
    roleGuess: "Header / top bar",
    bounds: { x: 0, y: 0, w: 1, h: headerH },
    confidence: top.delta > 35 ? "high" : top.delta > 18 ? "medium" : "low",
    evidence: `Row-0 brightness ${top.mean.toFixed(0)}; Δ vs mid ${top.delta.toFixed(0)}; edgeDensity ${obs.edgeDensity}`,
  });
  regions.push({
    id: "region-main",
    roleGuess: "Main content",
    bounds: {
      x: 0,
      y: headerH,
      w: 1,
      h: Math.max(0.35, 1 - headerH - footerH),
    },
    confidence: "medium",
    evidence: `Central band; projection rows≈${layout.rows} cols≈${layout.columns}`,
  });
  regions.push({
    id: "region-footer",
    roleGuess: "Footer / bottom actions",
    bounds: { x: 0, y: 1 - footerH, w: 1, h: footerH },
    confidence: bot.delta > 30 ? "medium" : "low",
    evidence: `Bottom brightness ${bot.mean.toFixed(0)}; Δ vs mid ${bot.delta.toFixed(0)}`,
  });

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
        y: headerH,
        w: 1 / 3,
        h: Math.max(0.4, 1 - headerH - footerH),
      },
      confidence: "medium",
      evidence: `L/R brightness ${left.toFixed(0)} vs ${right.toFixed(0)}`,
    };
    regions.push(rail);
    containers.push(rail);
    structureHints.push("left-rail-candidate");
  }

  // Pixel-accurate structure probes (fixtures are synthetic but representative).
  const topStrip = rectMean(data, { x: 0, y: 0, w: 1, h: 0.14 });
  const centerPanel = rectMean(data, { x: 0.22, y: 0.28, w: 0.56, h: 0.44 });
  const surround =
    (rectMean(data, { x: 0, y: 0, w: 1, h: 0.18 }) +
      rectMean(data, { x: 0, y: 0.82, w: 1, h: 0.18 }) +
      rectMean(data, { x: 0, y: 0.18, w: 0.12, h: 0.64 }) +
      rectMean(data, { x: 0.88, y: 0.18, w: 0.12, h: 0.64 })) /
    4;
  const heroBand = rectMean(data, { x: 0.05, y: 0.18, w: 0.9, h: 0.38 });
  const belowHero = rectMean(data, { x: 0.05, y: 0.6, w: 0.9, h: 0.2 });

  // Toolbar + list: dark top + secondary toolbar strip + horizontal row striping
  const toolbarStrip = rectMean(data, { x: 0, y: 0.14, w: 1, h: 0.1 });
  const listRowA = rectMean(data, { x: 0.08, y: 0.32, w: 0.84, h: 0.1 });
  const listRowB = rectMean(data, { x: 0.08, y: 0.46, w: 0.84, h: 0.1 });
  const listRowC = rectMean(data, { x: 0.08, y: 0.6, w: 0.84, h: 0.1 });
  const listStripe =
    Math.abs(listRowA - listRowB) > 25 && Math.abs(listRowB - listRowC) > 25;
  if (topStrip < 70 && toolbarStrip < 90 && listStripe && Math.abs(left - right) < 35) {
    structureHints.push("toolbar-list-candidate");
    regions.push({
      id: "region-toolbar",
      roleGuess: "Toolbar / tool row",
      bounds: { x: 0, y: 0.12, w: 1, h: 0.12 },
      confidence: "medium",
      evidence: `Dark toolbar strip ${toolbarStrip.toFixed(0)} under header ${topStrip.toFixed(0)}`,
    });
    regions.push({
      id: "region-list",
      roleGuess: "List / stacked rows",
      bounds: { x: 0.06, y: 0.28, w: 0.88, h: 0.5 },
      confidence: "medium",
      evidence: `Alternating row brightness ${listRowA.toFixed(0)}/${listRowB.toFixed(0)}/${listRowC.toFixed(0)}`,
    });
    for (let i = 0; i < 3; i++) {
      regions.push({
        id: `region-list-row-${i}`,
        roleGuess: "List row",
        bounds: { x: 0.08, y: 0.3 + i * 0.14, w: 0.84, h: 0.12 },
        confidence: "low",
        evidence: "Inferred list row from horizontal striping",
      });
    }
  }

  // Form vs modal: share inset-panel geometry; discriminate with surround uniformity.
  const sideGutters =
    (rectMean(data, { x: 0, y: 0.3, w: 0.15, h: 0.4 }) +
      rectMean(data, { x: 0.85, y: 0.3, w: 0.15, h: 0.4 })) /
    2;
  const bottomStrip = rectMean(data, { x: 0, y: 0.82, w: 1, h: 0.18 });
  const surroundDark =
    surround < 85 && sideGutters < 90 && bottomStrip < 110 && topStrip < 90;
  const insetBright = centerPanel > 195 && centerPanel - sideGutters > 55;
  let formControl: UiControl | null = null;

  // Form first: dark header + bright inset + mid-tone page chrome (not a dimmed modal veil)
  if (
    topStrip < 80 &&
    insetBright &&
    bottomStrip > 70 &&
    Math.abs(left - right) < 35 &&
    !structureHints.includes("toolbar-list-candidate")
  ) {
    structureHints.push("form-panel-candidate");
    regions.push({
      id: "region-form",
      roleGuess: "Form / input panel",
      bounds: { x: 0.18, y: 0.28, w: 0.64, h: 0.42 },
      confidence: "medium",
      evidence: `Bright inset panel ${centerPanel.toFixed(0)} under dark header ${topStrip.toFixed(0)}; gutters ${sideGutters.toFixed(0)}; bottom ${bottomStrip.toFixed(0)}`,
    });
    formControl = {
      id: "ctrl-form-primary",
      roleGuess: "Primary form action",
      bounds: { x: 0.35, y: 0.62, w: 0.3, h: 0.08 },
      confidence: "low",
      evidence: "Inferred primary action under form panel",
      method: "structure-heuristic",
    };
  } else if (
    insetBright &&
    surroundDark &&
    bottomStrip < 70 &&
    Math.abs(left - right) < 40 &&
    !structureHints.includes("form-panel-candidate")
  ) {
    // Modal: dimmed veil on all sides (including bottom), bright dialog island
    structureHints.push("modal-or-dialog-candidate");
    regions.push({
      id: "region-modal",
      roleGuess: "Modal / dialog overlay",
      bounds: { x: 0.2, y: 0.2, w: 0.6, h: 0.55 },
      confidence: "medium",
      evidence: `Center panel ${centerPanel.toFixed(0)} vs surround ${surround.toFixed(0)} (bottom ${bottomStrip.toFixed(0)})`,
    });
  }

  // Card grid: checker across BOTH axes (avoid false positive on full-width hero)
  const cell = (r: number, c: number) =>
    obs.grid.find((g) => g.row === r && g.col === c)?.meanBrightness ?? 0;
  let checkerPairs = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      if (Math.abs(cell(r, c) - cell(r, c + 1)) > 80) checkerPairs++;
    }
  }
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 2; r++) {
      if (Math.abs(cell(r, c) - cell(r + 1, c)) > 80) checkerPairs++;
    }
  }
  const brightCells = obs.grid.filter((g) => g.meanBrightness > 160);
  const darkCells = obs.grid.filter((g) => g.meanBrightness < 100);
  const heroLike =
    topStrip < 80 &&
    heroBand > 180 &&
    Math.abs(cell(1, 0) - cell(1, 1)) < 40 &&
    Math.abs(cell(1, 1) - cell(1, 2)) < 40 &&
    belowHero < heroBand - 40;
  if (
    checkerPairs >= 4 &&
    brightCells.length >= 3 &&
    darkCells.length >= 3 &&
    !heroLike &&
    !structureHints.includes("modal-or-dialog-candidate") &&
    !structureHints.includes("form-panel-candidate") &&
    Math.abs(left - right) < 40
  ) {
    structureHints.push("card-grid-candidate");
    for (const g of brightCells) {
      regions.push({
        id: `region-card-r${g.row}c${g.col}`,
        roleGuess: "Card / tile",
        bounds: { x: g.col / 3, y: g.row / 3, w: 1 / 3, h: 1 / 3 },
        confidence: "low",
        evidence: `Checker brightness ${g.meanBrightness.toFixed(0)}; pairs=${checkerPairs}`,
      });
    }
  }

  // Nav + hero: dark header + bright full-width mid + darker lower
  if (
    heroLike &&
    !structureHints.includes("card-grid-candidate") &&
    !structureHints.includes("form-panel-candidate")
  ) {
    structureHints.push("nav-hero-candidate");
    regions.push({
      id: "region-hero",
      roleGuess: "Hero / featured band",
      bounds: { x: 0.05, y: headerH, w: 0.9, h: 0.4 },
      confidence: "medium",
      evidence: `Full-width bright mid ${heroBand.toFixed(0)} under dark nav ${topStrip.toFixed(0)}`,
    });
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
  if (formControl) controls.push(formControl);
  for (const g of obs.grid) {
    if (g.row === 0 || g.row === 2) {
      if (obs.edgeDensity > 0.12 && g.meanBrightness > 40 && g.meanBrightness < 220) {
        controls.push({
          id: `ctrl-r${g.row}c${g.col}`,
          roleGuess: g.row === 0 ? "Toolbar control" : "Action / tab",
          bounds: { x: g.col / 3, y: g.row / 3, w: 1 / 3, h: 1 / 3 },
          confidence: "low",
          evidence: `Band cell brightness ${g.meanBrightness.toFixed(0)}; not OCR-verified`,
          method: "structure-heuristic",
        });
      }
    }
  }

  const images: UiImageRegion[] = [];
  if (structureHints.includes("nav-hero-candidate") || obs.edgeDensity > 0.25) {
    images.push({
      id: "img-hero-guess",
      bounds: { x: 0.1, y: 0.22, w: 0.8, h: 0.36 },
      confidence: "low",
      evidence: structureHints.includes("nav-hero-candidate")
        ? "Hero band from nav-hero structure hint"
        : `Elevated edge density ${obs.edgeDensity}`,
    });
  }

  // Annotate region evidence with layout zones for codegen resemblance checks.
  for (const r of regions) {
    const z = zoneOf(r.bounds);
    r.evidence = `${r.evidence}; zone=${z.v}-${z.h}`;
  }

  const density: "sparse" | "comfortable" | "dense" =
    textBlocks.length > 6 ? "dense" : textBlocks.length > 2 ? "comfortable" : "sparse";

  const confidence: UIObservationIR["confidence"] =
    regions.filter((r) => r.confidence === "high").length >= 1 ? "medium" : "low";

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
    controls: controls.slice(0, 10),
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
      "Screenshot→Code scaffolds resemble observed structure; they are not pixel-perfect reconstructions.",
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
