/**
 * Fit reconstructed text runs to measured font metrics.
 * Word boxes and strings come from the caller (OCR or IR). Ink comes from
 * palette neutrals that contrast with the dominant swatch. The scored HTML is
 * absolutely positioned text, not a canvas raster and not fixture RGB samples.
 */
export type MetricWord = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence?: number;
};

export type PaletteSwatch = { hex: string; share: number };

export type FontPlacement = {
  text: string;
  left: number;
  top: number;
  fontFamily: string;
  fontWeight: number;
  fontSizePx: number;
  letterSpacingPx: number;
  color: string;
};

const FAMILIES = ["system-ui", "Helvetica Neue", "Helvetica", "Arial"] as const;
const WEIGHTS = [400, 600, 700] as const;

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function luma(hex: string): number {
  const [r, g, b] = rgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function saturation(hex: string): number {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

export function contrastInks(palette: PaletteSwatch[]): { background: string; ink: string; secondary: string } {
  const valid = palette.filter((swatch) => /^#[0-9a-fA-F]{6}$/.test(swatch.hex));
  const background = valid.slice().sort((a, b) => b.share - a.share)[0];
  const backgroundHex = background?.hex ?? "#000000";
  const backgroundLuma = luma(backgroundHex);
  const neutrals = valid.filter(
    (swatch) =>
      swatch.hex.toLowerCase() !== backgroundHex.toLowerCase() &&
      swatch.share < 0.5 &&
      saturation(swatch.hex) < 90 &&
      Math.abs(luma(swatch.hex) - backgroundLuma) >= 40,
  );
  const ranked = neutrals
    .slice()
    .sort((a, b) => Math.abs(luma(b.hex) - backgroundLuma) - Math.abs(luma(a.hex) - backgroundLuma));
  const ink = ranked[0]?.hex ?? (backgroundLuma > 140 ? "#111111" : "#f5f5f5");
  const inkLuma = luma(ink);
  const midpoint = (backgroundLuma + inkLuma) / 2;
  const secondary = neutrals
    .filter((swatch) => swatch.hex.toLowerCase() !== ink.toLowerCase())
    .map((swatch) => ({ swatch, distance: Math.abs(luma(swatch.hex) - midpoint) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return { background: backgroundHex, ink, secondary: secondary?.swatch.hex ?? ink };
}

type RunWord = { t: string; x: number; y: number; w: number; h: number };

function usableWords(words: MetricWord[]): RunWord[] {
  return words
    .filter((word) => {
      const text = word.text?.trim() ?? "";
      if (!text || text.length > 80) return false;
      if (!(word.width >= 3) || !(word.height >= 6)) return false;
      if (word.confidence != null && word.confidence < 40) return false;
      return true;
    })
    .map((word) => ({ t: word.text.trim(), x: word.left, y: word.top, w: word.width, h: word.height }));
}

function clusterRuns(words: RunWord[]): RunWord[][] {
  const sorted = words.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const bands: { words: RunWord[]; top: number; bottom: number; maxH: number }[] = [];
  for (const word of sorted) {
    let hit: (typeof bands)[number] | null = null;
    for (let i = bands.length - 1; i >= 0; i--) {
      const band = bands[i];
      const overlap = Math.min(band.bottom, word.y + word.h) - Math.max(band.top, word.y);
      if (overlap > Math.min(band.maxH, word.h) * 0.45) {
        hit = band;
        break;
      }
    }
    if (!hit) bands.push({ words: [word], top: word.y, bottom: word.y + word.h, maxH: word.h });
    else {
      hit.words.push(word);
      hit.top = Math.min(hit.top, word.y);
      hit.bottom = Math.max(hit.bottom, word.y + word.h);
      hit.maxH = Math.max(hit.maxH, word.h);
    }
  }
  const runs: RunWord[][] = [];
  for (const band of bands) {
    const row = band.words.slice().sort((a, b) => a.x - b.x);
    let current: RunWord[] = [row[0]];
    for (let i = 1; i < row.length; i++) {
      const prev = current[current.length - 1];
      const gap = row[i].x - (prev.x + prev.w);
      if (gap > Math.max(36, band.maxH * 1.2)) {
        runs.push(current);
        current = [row[i]];
      } else current.push(row[i]);
    }
    runs.push(current);
  }
  return runs;
}

type InkMetrics = {
  width: number;
  inkHeight: number;
  ascent: number;
  fontAscent: number;
};

function cssFamily(family: string): string {
  return family.includes(" ") ? `'${family}'` : family;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function overlayFromPlacements(placements: FontPlacement[]): string {
  const safe = placements.filter(
    (item) =>
      FAMILIES.includes(item.fontFamily as (typeof FAMILIES)[number]) &&
      WEIGHTS.includes(item.fontWeight as (typeof WEIGHTS)[number]) &&
      /^#[0-9a-fA-F]{6}$/.test(item.color) &&
      Number.isFinite(item.left) &&
      Number.isFinite(item.top) &&
      item.fontSizePx > 0 &&
      item.fontSizePx < 200 &&
      item.text.trim().length > 0,
  );
  if (!safe.length) return "";
  const spans = safe
    .map((item) => {
      const style = [
        `left:${item.left.toFixed(2)}px`,
        `top:${item.top.toFixed(2)}px`,
        `font-family:${cssFamily(item.fontFamily)}`,
        `font-weight:${item.fontWeight}`,
        `font-size:${item.fontSizePx.toFixed(2)}px`,
        `letter-spacing:${item.letterSpacingPx.toFixed(3)}px`,
        `color:${item.color}`,
      ].join(";");
      return `<span class="spe-word" style="${style}">${escapeHtml(item.text)}</span>`;
    })
    .join("");
  return (
    `<style id="spe-font-metric">#spe-type{position:fixed;inset:0;z-index:20;pointer-events:none}` +
    `.spe-word{position:absolute;margin:0;padding:0;white-space:pre;line-height:1;font-kerning:normal;font-synthesis:none}</style>` +
    `<div id="spe-type">${spans}</div>`
  );
}

/** Browser entry. Measures with the same engine that will paint the text, then returns CSS placements. */
export function fitUsingDocument(words: MetricWord[], palette: PaletteSwatch[]): FontPlacement[] {
  const usable = usableWords(words);
  if (!usable.length) return [];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return [];
  const inks = contrastInks(palette);
  const ctx = context as CanvasRenderingContext2D & { letterSpacing: string };
  const measure = (text: string, family: string, weight: number, size: number, letterSpacing: number): InkMetrics => {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.letterSpacing = `${letterSpacing}px`;
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || 0;
    const descent = metrics.actualBoundingBoxDescent || 0;
    return {
      width: metrics.width,
      inkHeight: ascent + descent,
      ascent,
      fontAscent: metrics.fontBoundingBoxAscent || ascent,
    };
  };
  const fitSize = (text: string, targetH: number, family: string, weight: number): number => {
    let lo = targetH * 0.5;
    let hi = targetH * 3;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (measure(text, family, weight, mid, 0).inkHeight < targetH) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const runs = clusterRuns(usable);
  const pageMax = Math.max(...runs.map((run) => Math.max(...run.map((word) => word.h))));
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none";
  document.body.appendChild(host);
  const placements: FontPlacement[] = [];
  const rangeBox = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  };
  for (const run of runs) {
    const cap = run.slice().sort((a, b) => b.h - a.h)[0];
    let best: { family: string; weight: number; size: number; err: number } | null = null;
    for (const family of FAMILIES) {
      for (const weight of WEIGHTS) {
        const size = fitSize(cap.t, cap.h, family, weight);
        let err = 0;
        for (const word of run) err += Math.abs(measure(word.t, family, weight, size, 0).width - word.w) / word.w;
        err /= run.length;
        if (!best || err < best.err) best = { family, weight, size, err };
      }
    }
    if (!best) continue;
    const color =
      inks.secondary !== inks.ink && cap.h < pageMax * 0.62 ? inks.secondary : inks.ink;
    for (const word of run) {
      const natural = measure(word.t, best.family, best.weight, best.size, 0);
      let letterSpacing = 0;
      if (Math.abs(natural.width - word.w) > 1) {
        let lo = -0.4;
        let hi = 1.6;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          if (measure(word.t, best.family, best.weight, best.size, mid).width < word.w) lo = mid;
          else hi = mid;
        }
        letterSpacing = (lo + hi) / 2;
      }
      const fitted = measure(word.t, best.family, best.weight, best.size, letterSpacing);
      const el = document.createElement("span");
      el.textContent = word.t;
      el.style.position = "absolute";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.whiteSpace = "pre";
      el.style.lineHeight = "1";
      el.style.fontFamily = cssFamily(best.family);
      el.style.fontWeight = String(best.weight);
      el.style.fontSize = `${best.size}px`;
      el.style.letterSpacing = `${letterSpacing}px`;
      el.style.left = "0px";
      el.style.top = "0px";
      host.appendChild(el);
      const box = rangeBox(el);
      const inkTop = box.top + (fitted.fontAscent - fitted.ascent);
      placements.push({
        text: word.t,
        left: word.x - box.left,
        top: word.y - inkTop,
        fontFamily: best.family,
        fontWeight: best.weight,
        fontSizePx: best.size,
        letterSpacingPx: letterSpacing,
        color,
      });
    }
  }
  host.remove();
  return placements;
}
