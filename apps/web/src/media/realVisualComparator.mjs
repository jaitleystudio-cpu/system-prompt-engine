/**
 * SPE Ω — Real Mathematical Visual Fidelity Comparator (Lane A12-R)
 * Strictly decodes PNG buffers to raw RGBA pixel arrays and calculates:
 * 1. Normalized Pixel Delta Count & Percentage
 * 2. Windowed Structural Similarity Index (SSIM) over luminance
 *
 * ABSOLUTELY FORBIDDEN:
 * - Hardcoded scores (0.985, 0.45)
 * - Hash equality replacing SSIM calculation
 * - Unchecked viewports or DPR mismatches
 */

import { createHash } from "node:crypto";
import { PNG } from "pngjs";

export class IncomparableViewportError extends Error {
  constructor(message) {
    super(message);
    this.name = "IncomparableViewportError";
  }
}

export class IncomparableDprError extends Error {
  constructor(message) {
    super(message);
    this.name = "IncomparableDprError";
  }
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Decodes a PNG Buffer into raw RGBA pixel array and dimensions.
 */
export function decodePngBuffer(buffer) {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: png.data, // Buffer of length width * height * 4
  };
}

/**
 * Computes exact pixel mismatches and windowed SSIM on decoded RGBA buffers.
 */
export function computeMathematicalParity(refRgba, candRgba, width, height, blockSize = 16) {
  const numPixels = width * height;
  const len = numPixels * 4;

  let mismatchedPixels = 0;
  const lumA = new Float64Array(numPixels);
  const lumB = new Float64Array(numPixels);

  // 1. Pixel Difference & Luminance extraction
  // Y = 0.299*R + 0.587*G + 0.114*B
  for (let i = 0, p = 0; i < len; i += 4, p++) {
    const dr = Math.abs(refRgba[i] - candRgba[i]);
    const dg = Math.abs(refRgba[i + 1] - candRgba[i + 1]);
    const db = Math.abs(refRgba[i + 2] - candRgba[i + 2]);
    const da = Math.abs(refRgba[i + 3] - candRgba[i + 3]);

    // Channel delta threshold >= 10
    if (dr > 10 || dg > 10 || db > 10 || da > 10) {
      mismatchedPixels++;
    }

    lumA[p] = refRgba[i] * 0.299 + refRgba[i + 1] * 0.587 + refRgba[i + 2] * 0.114;
    lumB[p] = candRgba[i] * 0.299 + candRgba[i + 1] * 0.587 + candRgba[i + 2] * 0.114;
  }

  const pixelDeltaPercentage = (mismatchedPixels / numPixels) * 100;

  // 2. Block-based Windowed SSIM
  const C1 = 6.5025; // (0.01 * 255)^2
  const C2 = 58.5225; // (0.03 * 255)^2

  let ssimSum = 0;
  let blockCount = 0;

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const actualBlockW = Math.min(blockSize, width - bx);
      const actualBlockH = Math.min(blockSize, height - by);
      const N = actualBlockW * actualBlockH;

      let sumX = 0;
      let sumY = 0;

      for (let y = 0; y < actualBlockH; y++) {
        const rowOffset = (by + y) * width + bx;
        for (let x = 0; x < actualBlockW; x++) {
          const idx = rowOffset + x;
          sumX += lumA[idx];
          sumY += lumB[idx];
        }
      }

      const meanX = sumX / N;
      const meanY = sumY / N;

      let varX = 0;
      let varY = 0;
      let covXY = 0;

      for (let y = 0; y < actualBlockH; y++) {
        const rowOffset = (by + y) * width + bx;
        for (let x = 0; x < actualBlockW; x++) {
          const idx = rowOffset + x;
          const diffX = lumA[idx] - meanX;
          const diffY = lumB[idx] - meanY;
          varX += diffX * diffX;
          varY += diffY * diffY;
          covXY += diffX * diffY;
        }
      }

      varX = N > 1 ? varX / (N - 1) : 0;
      varY = N > 1 ? varY / (N - 1) : 0;
      covXY = N > 1 ? covXY / (N - 1) : 0;

      const num = (2 * meanX * meanY + C1) * (2 * covXY + C2);
      const den = (meanX * meanX + meanY * meanY + C1) * (varX + varY + C2);
      const blockSsim = den !== 0 ? num / den : 1.0;

      ssimSum += blockSsim;
      blockCount++;
    }
  }

  const meanSsim = blockCount > 0 ? ssimSum / blockCount : 1.0;
  const boundedSsim = Math.min(1.0, Math.max(0.0, meanSsim));

  return {
    mismatchedPixelCount: mismatchedPixels,
    pixelDeltaPercentage: Math.round(pixelDeltaPercentage * 1000) / 1000,
    ssimScore: Math.round(boundedSsim * 10000) / 10000,
  };
}

/**
 * Main Comparison Pipeline
 */
export function compareVisualBuffers(refBuffer, candBuffer, options = {}) {
  const refSha256 = sha256(refBuffer);
  const candSha256 = sha256(candBuffer);

  const refSourceSha256 = options.referenceSource ? sha256(options.referenceSource) : refSha256;
  const candSourceSha256 = options.candidateSource ? sha256(options.candidateSource) : candSha256;

  // Viewport and DPR validation
  const refViewport = options.viewport || { width: 1280, height: 800, devicePixelRatio: 1.0 };
  const candViewport = options.candidateViewport || refViewport;

  if (
    refViewport.width !== candViewport.width ||
    refViewport.height !== candViewport.height
  ) {
    throw new IncomparableViewportError(
      `INCOMPARABLE_VIEWPORT: reference (${refViewport.width}x${refViewport.height}) does not match candidate (${candViewport.width}x${candViewport.height})`
    );
  }

  const refDpr = options.viewport?.devicePixelRatio || options.dpr || 1.0;
  const candDpr = options.candidateDpr || options.candidateViewport?.devicePixelRatio || refDpr;

  if (refDpr !== candDpr) {
    throw new IncomparableDprError(
      `INCOMPARABLE_DPR: reference DPR (${refDpr}) does not match candidate DPR (${candDpr})`
    );
  }

  // Decode raw PNGs
  const refDecoded = decodePngBuffer(refBuffer);
  const candDecoded = decodePngBuffer(candBuffer);

  if (
    refDecoded.width !== candDecoded.width ||
    refDecoded.height !== candDecoded.height
  ) {
    throw new IncomparableViewportError(
      `INCOMPARABLE_VIEWPORT_RASTER: raster width/height mismatch (${refDecoded.width}x${refDecoded.height} vs ${candDecoded.width}x${candDecoded.height})`
    );
  }

  // Mathematical Calculation on raw RGBA
  const parity = computeMathematicalParity(
    refDecoded.data,
    candDecoded.data,
    refDecoded.width,
    refDecoded.height
  );

  const minSsim = options.thresholds?.minSsim || 0.95;
  const maxDelta = options.thresholds?.maxPixelDeltaPercent || 5.0;

  const status =
    parity.ssimScore >= minSsim && parity.pixelDeltaPercentage <= maxDelta
      ? "MEASURED"
      : "UNPROVEN";

  const receiptId = `rcpt-${sha256(
    refSha256 + candSha256 + parity.ssimScore + parity.pixelDeltaPercentage
  ).slice(0, 16)}`;

  return {
    receiptId,
    timestamp: new Date().toISOString(),
    referenceSha256: refSha256,
    renderSha256: candSha256,
    referenceSourceSha256: refSourceSha256,
    candidateSourceSha256: candSourceSha256,
    viewportWidth: refDecoded.width,
    viewportHeight: refDecoded.height,
    DPR: refDpr,
    comparatorAlgorithm: "SPE_WINDOWED_SSIM_PIXELMATCH_V1",
    comparatorVersion: "1.0.0",
    thresholdVersion: "1.0.0",
    ssimScore: parity.ssimScore,
    pixelDeltaPercentage: parity.pixelDeltaPercentage,
    mismatchedPixelCount: parity.mismatchedPixelCount,
    captureEngine: "playwright-chromium",
    browserVersion: options.browserVersion || "Chrome/Chromium Headless",
    status,
    fidelityStatus: status,
  };
}
