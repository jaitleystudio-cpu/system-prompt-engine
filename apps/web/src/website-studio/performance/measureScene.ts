import { computeSha256 } from "../../engine/hashUtils.ts";
import type { SceneIR } from "../model/sceneIR.ts";

export type MeasurementState = "MEASURED" | "ESTIMATED" | "UNKNOWN";
export type FrameEnvironmentClass = "DESKTOP" | "MOBILE";
export type FrameMeasurementSource = "BROWSER_HARNESS" | "ANALYTICAL_ESTIMATE" | "NONE";

/**
 * Sampling floor for a MEASURED frame receipt. Each environment must meet
 * this on its own; one environment can never satisfy it for another.
 */
export const FRAME_SAMPLING_MINIMUMS = Object.freeze({
  minSamples: 60,
  minWarmupDiscarded: 10,
});

/** CSS-pixel width rules that tie an environment class to its viewport. */
export const VIEWPORT_CLASS_RULES = Object.freeze({
  mobileMaxCssWidth: 600,
  desktopMinCssWidth: 1024,
});

const PERCENTILE_TOLERANCE_MS = 0.01;

export interface BrowserTelemetryEvidence {
  environment: "BROWSER_HARNESS";
  environmentClass: FrameEnvironmentClass;
  browser: string;
  userAgent: string;
  viewport: { width: number; height: number };
  dpr: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  sampleCount: number;
  warmupDiscarded: number;
  frameTimingsMs: number[];
  frameP50: number;
  frameP95: number;
  frameP99: number;
  drawCalls: number;
  triangles: number;
  textureBytes: number;
  memoryBytes?: number;
  timestamp: number;
  sceneFixtureId?: string;
  harnessSignature?: string;
}

/** One environment's frame evidence. Desktop and mobile never share one. */
export interface EnvironmentFrameReceipt {
  environmentClass: FrameEnvironmentClass;
  state: MeasurementState;
  source: FrameMeasurementSource;
  viewport?: { width: number; height: number };
  dpr?: number;
  browser?: string;
  userAgent?: string;
  isMobile?: boolean;
  hasTouch?: boolean;
  sampleCount: number;
  warmupDiscarded: number;
  frameTimingsMs?: number[];
  frameP50?: number;
  frameP95?: number;
  frameP99?: number;
  timestamp?: number;
  sceneFixtureId?: string;
  samplesDigest?: string;
  receiptHash?: string;
}

export interface FrameEnvironmentReceipts {
  desktop: EnvironmentFrameReceipt;
  mobile: EnvironmentFrameReceipt;
}

export interface ScenePerformanceReceipt {
  triangles: number;
  drawCalls: number;
  textureBytes: number;
  geometryBytes: number;
  materials: number;
  lights: number;
  particles: number;
  webglContexts: number;
  /** Mirror of frameEnvironments.desktop.frameP95. Read its state there. */
  desktopFrameP95?: number;
  /** Mirror of frameEnvironments.mobile.frameP95. Never derived from desktop. */
  mobileFrameP95?: number;
  /** Weakest state across environments. MEASURED only when every environment is MEASURED. */
  frameMeasurementState: MeasurementState;
  frameEnvironments?: FrameEnvironmentReceipts;
  findings: string[];
  telemetryEvidence?: {
    environment: "BROWSER_HARNESS";
    browser: string;
    viewport: { width: number; height: number };
    dpr: number;
    sampleCount: number;
    warmup: number;
    frameP50: number;
    frameP95: number;
    frameP99: number;
    memoryBytes?: number;
    timestamp: number;
    receiptHash: string;
  };
}

const TRIANGLES: Record<string, number> = {
  box: 12,
  sphere: 960,
  cylinder: 128,
  plane: 2,
  torus: 3200,
  "wave-mesh": 5000,
};

function unknownEnvironment(environmentClass: FrameEnvironmentClass): EnvironmentFrameReceipt {
  return {
    environmentClass,
    state: "UNKNOWN",
    source: "NONE",
    sampleCount: 0,
    warmupDiscarded: 0,
  };
}

const STATE_RANK: Record<MeasurementState, number> = {
  UNKNOWN: 0,
  ESTIMATED: 1,
  MEASURED: 2,
};

function weakestState(environments: FrameEnvironmentReceipts): MeasurementState {
  return STATE_RANK[environments.desktop.state] <= STATE_RANK[environments.mobile.state]
    ? environments.desktop.state
    : environments.mobile.state;
}

function withEnvironments(
  receipt: ScenePerformanceReceipt,
  environments: FrameEnvironmentReceipts,
): ScenePerformanceReceipt {
  return {
    ...receipt,
    frameEnvironments: environments,
    desktopFrameP95: environments.desktop.frameP95,
    mobileFrameP95: environments.mobile.frameP95,
    frameMeasurementState: weakestState(environments),
  };
}

export function measureSceneStatic(scene: SceneIR): ScenePerformanceReceipt {
  const triangles = scene.objects.reduce(
    (sum, object) => sum + (TRIANGLES[object.geometry.type] ?? 0),
    0,
  );
  const materialKeys = new Set(
    scene.objects.map((object) =>
      JSON.stringify({
        type: object.material.type,
        color: object.material.color,
        roughness: object.material.roughness,
        metalness: object.material.metalness,
      }),
    ),
  );
  const findings: string[] = [];
  if (triangles > scene.performanceBudget.maxTriangles) {
    findings.push("TRIANGLE_BUDGET_EXCEEDED");
  }
  if (scene.objects.length > scene.performanceBudget.maxDrawCalls) {
    findings.push("DRAW_CALL_BUDGET_EXCEEDED");
  }
  return {
    triangles,
    drawCalls: scene.objects.length,
    textureBytes: 0,
    geometryBytes: triangles * 3 * 3 * 4,
    materials: materialKeys.size,
    lights: scene.lighting.length,
    particles: 0,
    webglContexts: 0,
    frameMeasurementState: "UNKNOWN",
    frameEnvironments: {
      desktop: unknownEnvironment("DESKTOP"),
      mobile: unknownEnvironment("MOBILE"),
    },
    findings,
  };
}

/**
 * Analytical estimate only. Never labels results as MEASURED / CWV PASS.
 * Desktop and mobile use separate formulas; neither is a multiple of the other.
 */
export function estimateScenePerformance(
  scene: SceneIR,
  deviceTier: "DESKTOP_HIGH" | "MOBILE_MID" = "DESKTOP_HIGH",
): ScenePerformanceReceipt {
  const base = measureSceneStatic(scene);
  const desktopEstimateMs =
    8.0 + (base.triangles / 20000) * 4.0 + (base.drawCalls / 50) * 3.0;
  const mobileEstimateMs =
    14.0 + (base.triangles / 10000) * 8.0 + (base.drawCalls / 30) * 6.0;
  const estimated = (
    environmentClass: FrameEnvironmentClass,
    value: number,
  ): EnvironmentFrameReceipt => ({
    environmentClass,
    state: "ESTIMATED",
    source: "ANALYTICAL_ESTIMATE",
    sampleCount: 0,
    warmupDiscarded: 0,
    frameP95: Number(value.toFixed(2)),
  });
  const receipt = withEnvironments(base, {
    desktop: estimated("DESKTOP", desktopEstimateMs),
    mobile: estimated("MOBILE", mobileEstimateMs),
  });
  return {
    ...receipt,
    frameMeasurementState: "ESTIMATED",
    findings: [...base.findings, `ESTIMATED_TIER_${deviceTier}`],
  };
}

/** Nearest-rank percentile over the post-warmup samples. */
export function computePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((percentile / 100) * sorted.length)),
  );
  return sorted[index];
}

function reject(reason: string): never {
  throw new Error(`PERFORMANCE_MEASUREMENT_UNVERIFIED: ${reason}`);
}

function sameSamples(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** True when every sample in `a` is the same constant multiple of `b`. */
function scaledSamples(a: number[], b: number[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const ratio = a[0] / b[0];
  // Ratio 1 is a copy, reported separately by sameSamples.
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 1e-9) return false;
  return a.every((value, index) => Math.abs(value - b[index] * ratio) <= 1e-6 * Math.max(1, value));
}

function samplesDigest(samples: number[]): string {
  return ["sha", "256-"].join("") + computeSha256(JSON.stringify(samples));
}

function environmentReceiptHash(environment: EnvironmentFrameReceipt): string {
  const payload = JSON.stringify({
    environmentClass: environment.environmentClass,
    browser: environment.browser,
    userAgent: environment.userAgent,
    viewport: environment.viewport,
    dpr: environment.dpr,
    sampleCount: environment.sampleCount,
    warmupDiscarded: environment.warmupDiscarded,
    samplesDigest: environment.samplesDigest,
    p50: environment.frameP50,
    p95: environment.frameP95,
    p99: environment.frameP99,
    timestamp: environment.timestamp,
    sceneFixtureId: environment.sceneFixtureId,
  });
  return ["sha", "256-"].join("") + computeSha256(payload);
}

function assertTelemetryShape(telemetry: BrowserTelemetryEvidence): void {
  if (!telemetry || telemetry.environment !== "BROWSER_HARNESS") {
    reject("telemetry must originate from BROWSER_HARNESS");
  }
  if (telemetry.environmentClass !== "DESKTOP" && telemetry.environmentClass !== "MOBILE") {
    reject("environment class must be DESKTOP or MOBILE");
  }
  if (!telemetry.browser || typeof telemetry.browser !== "string") {
    reject("browser metadata required");
  }
  if (!telemetry.userAgent || typeof telemetry.userAgent !== "string") {
    reject("user agent required");
  }
  const viewport = telemetry.viewport;
  if (
    !viewport ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    reject("valid viewport required");
  }
  if (
    telemetry.environmentClass === "MOBILE" &&
    viewport.width > VIEWPORT_CLASS_RULES.mobileMaxCssWidth
  ) {
    reject("mobile receipt viewport is not a mobile viewport");
  }
  if (
    telemetry.environmentClass === "DESKTOP" &&
    viewport.width < VIEWPORT_CLASS_RULES.desktopMinCssWidth
  ) {
    reject("desktop receipt viewport is not a desktop viewport");
  }
  if (!Number.isFinite(telemetry.dpr) || telemetry.dpr <= 0) {
    reject("valid DPR required");
  }
  if (!Array.isArray(telemetry.frameTimingsMs) || telemetry.frameTimingsMs.length === 0) {
    reject("frame samples required");
  }
  if (!telemetry.frameTimingsMs.every((value) => Number.isFinite(value) && value > 0)) {
    reject("frame samples must be finite positive intervals");
  }
  if (telemetry.frameTimingsMs.length < FRAME_SAMPLING_MINIMUMS.minSamples) {
    reject("minimum 60 sampled frames required");
  }
  if (telemetry.sampleCount !== telemetry.frameTimingsMs.length) {
    reject("sample count does not match frame samples");
  }
  if (
    !Number.isInteger(telemetry.warmupDiscarded) ||
    telemetry.warmupDiscarded < FRAME_SAMPLING_MINIMUMS.minWarmupDiscarded
  ) {
    reject("minimum 10 warmup frames must be discarded");
  }
  if (!Number.isFinite(telemetry.timestamp) || telemetry.timestamp <= 0) {
    reject("measurement timestamp required");
  }
  const computed = {
    p50: computePercentile(telemetry.frameTimingsMs, 50),
    p95: computePercentile(telemetry.frameTimingsMs, 95),
    p99: computePercentile(telemetry.frameTimingsMs, 99),
  };
  if (
    Math.abs(computed.p50 - telemetry.frameP50) > PERCENTILE_TOLERANCE_MS ||
    Math.abs(computed.p95 - telemetry.frameP95) > PERCENTILE_TOLERANCE_MS ||
    Math.abs(computed.p99 - telemetry.frameP99) > PERCENTILE_TOLERANCE_MS
  ) {
    reject("statistical telemetry percentile mismatch");
  }
}

function assertIndependentOf(
  candidate: BrowserTelemetryEvidence,
  other: EnvironmentFrameReceipt,
): void {
  if (other.state !== "MEASURED" || !other.frameTimingsMs) return;
  if (sameSamples(candidate.frameTimingsMs, other.frameTimingsMs)) {
    reject("frame samples copied from another environment");
  }
  if (scaledSamples(candidate.frameTimingsMs, other.frameTimingsMs)) {
    reject("frame samples derived from another environment");
  }
  if (
    other.viewport &&
    other.viewport.width === candidate.viewport.width &&
    other.viewport.height === candidate.viewport.height &&
    other.dpr === candidate.dpr
  ) {
    reject("viewport and DPR copied from another environment");
  }
  if (other.timestamp === candidate.timestamp) {
    reject("timestamp copied from another environment");
  }
}

/**
 * Certify MEASURED only from authentic BROWSER_HARNESS telemetry for ONE
 * environment. The other environment is left exactly as it was. A mobile
 * value is never calculated from desktop (or the reverse).
 */
export function attachVerifiedBrowserTelemetry(
  receipt: ScenePerformanceReceipt,
  telemetry: BrowserTelemetryEvidence,
): ScenePerformanceReceipt {
  assertTelemetryShape(telemetry);
  const environments: FrameEnvironmentReceipts = receipt.frameEnvironments
    ? { ...receipt.frameEnvironments }
    : { desktop: unknownEnvironment("DESKTOP"), mobile: unknownEnvironment("MOBILE") };
  const slot = telemetry.environmentClass === "DESKTOP" ? "desktop" : "mobile";
  const otherSlot = slot === "desktop" ? "mobile" : "desktop";
  assertIndependentOf(telemetry, environments[otherSlot]);

  const measured: EnvironmentFrameReceipt = {
    environmentClass: telemetry.environmentClass,
    state: "MEASURED",
    source: "BROWSER_HARNESS",
    viewport: { width: telemetry.viewport.width, height: telemetry.viewport.height },
    dpr: telemetry.dpr,
    browser: telemetry.browser,
    userAgent: telemetry.userAgent,
    isMobile: telemetry.isMobile,
    hasTouch: telemetry.hasTouch,
    sampleCount: telemetry.sampleCount,
    warmupDiscarded: telemetry.warmupDiscarded,
    frameTimingsMs: [...telemetry.frameTimingsMs],
    frameP50: telemetry.frameP50,
    frameP95: telemetry.frameP95,
    frameP99: telemetry.frameP99,
    timestamp: telemetry.timestamp,
    sceneFixtureId: telemetry.sceneFixtureId,
    samplesDigest: samplesDigest(telemetry.frameTimingsMs),
  };
  measured.receiptHash = environmentReceiptHash(measured);
  environments[slot] = measured;

  const next = withEnvironments(receipt, environments);
  if (slot === "desktop") {
    next.telemetryEvidence = {
      environment: "BROWSER_HARNESS",
      browser: telemetry.browser,
      viewport: measured.viewport!,
      dpr: telemetry.dpr,
      sampleCount: telemetry.sampleCount,
      warmup: telemetry.warmupDiscarded,
      frameP50: telemetry.frameP50,
      frameP95: telemetry.frameP95,
      frameP99: telemetry.frameP99,
      memoryBytes: telemetry.memoryBytes,
      timestamp: telemetry.timestamp,
      receiptHash: measured.receiptHash,
    };
  }
  return next;
}

/**
 * Legacy entry: rejects caller-supplied timings without verified harness telemetry.
 * Caller numbers are never copied into the receipt.
 */
export function attachMeasuredFrameTiming(
  receipt: ScenePerformanceReceipt,
  _desktopFrameP95: number,
  _mobileFrameP95?: number,
  telemetry?: BrowserTelemetryEvidence,
): ScenePerformanceReceipt {
  if (!telemetry) {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_REJECTED: caller-supplied values alone cannot declare MEASURED; verified browser telemetry harness required",
    );
  }
  return attachVerifiedBrowserTelemetry(receipt, telemetry);
}

export interface ReceiptValidation {
  valid: boolean;
  reasons: string[];
}

function validateMeasuredEnvironment(
  environment: EnvironmentFrameReceipt,
  expectedClass: FrameEnvironmentClass,
  reasons: string[],
): void {
  const tag = expectedClass;
  if (environment.environmentClass !== expectedClass) {
    reasons.push(`${tag}_ENVIRONMENT_CLASS_MISMATCH`);
  }
  if (environment.state !== "MEASURED") return;
  if (environment.source !== "BROWSER_HARNESS") {
    reasons.push(`${tag}_MEASURED_WITHOUT_BROWSER_TELEMETRY`);
    return;
  }
  const samples = environment.frameTimingsMs;
  if (!Array.isArray(samples) || samples.length === 0) {
    reasons.push(`${tag}_MISSING_FRAME_SAMPLES`);
    return;
  }
  if (samples.length < FRAME_SAMPLING_MINIMUMS.minSamples) {
    reasons.push(`${tag}_INSUFFICIENT_SAMPLES`);
  }
  if (environment.sampleCount !== samples.length) {
    reasons.push(`${tag}_SAMPLE_COUNT_MISMATCH`);
  }
  if (!(environment.warmupDiscarded >= FRAME_SAMPLING_MINIMUMS.minWarmupDiscarded)) {
    reasons.push(`${tag}_INSUFFICIENT_WARMUP`);
  }
  const viewport = environment.viewport;
  if (!viewport || !(viewport.width > 0) || !(viewport.height > 0)) {
    reasons.push(`${tag}_VIEWPORT_MISSING`);
  } else if (
    expectedClass === "MOBILE" &&
    viewport.width > VIEWPORT_CLASS_RULES.mobileMaxCssWidth
  ) {
    reasons.push("MOBILE_VIEWPORT_NOT_MOBILE");
  } else if (
    expectedClass === "DESKTOP" &&
    viewport.width < VIEWPORT_CLASS_RULES.desktopMinCssWidth
  ) {
    reasons.push("DESKTOP_VIEWPORT_NOT_DESKTOP");
  }
  if (!(Number(environment.dpr) > 0)) reasons.push(`${tag}_DPR_MISSING`);
  if (!environment.userAgent) reasons.push(`${tag}_USER_AGENT_MISSING`);
  const checks: Array<[number, number | undefined, string]> = [
    [50, environment.frameP50, "P50"],
    [95, environment.frameP95, "P95"],
    [99, environment.frameP99, "P99"],
  ];
  for (const [percentile, claimed, label] of checks) {
    if (
      typeof claimed !== "number" ||
      Math.abs(computePercentile(samples, percentile) - claimed) > PERCENTILE_TOLERANCE_MS
    ) {
      reasons.push(`${tag}_${label}_INCONSISTENT_WITH_SAMPLES`);
    }
  }
  if (environment.samplesDigest !== samplesDigest(samples)) {
    reasons.push(`${tag}_SAMPLES_DIGEST_MISMATCH`);
  }
  if (environment.receiptHash !== environmentReceiptHash(environment)) {
    reasons.push(`${tag}_RECEIPT_HASH_MISMATCH`);
  }
}

/**
 * Re-derives every MEASURED claim from its own samples. A receipt object
 * assembled by a caller (state set to MEASURED by hand, mobile copied or
 * scaled from desktop, mirrors that disagree with environments) is invalid.
 */
export function validateScenePerformanceReceipt(
  receipt: ScenePerformanceReceipt,
): ReceiptValidation {
  const reasons: string[] = [];
  const environments = receipt.frameEnvironments;
  if (!environments) {
    if (receipt.frameMeasurementState === "MEASURED") {
      reasons.push("MEASURED_WITHOUT_ENVIRONMENT_RECEIPTS");
    }
    if (receipt.desktopFrameP95 != null || receipt.mobileFrameP95 != null) {
      reasons.push("FRAME_VALUES_WITHOUT_ENVIRONMENT_RECEIPTS");
    }
    return { valid: reasons.length === 0, reasons };
  }
  validateMeasuredEnvironment(environments.desktop, "DESKTOP", reasons);
  validateMeasuredEnvironment(environments.mobile, "MOBILE", reasons);

  const desktop = environments.desktop;
  const mobile = environments.mobile;
  if (
    desktop.state === "MEASURED" &&
    mobile.state === "MEASURED" &&
    desktop.frameTimingsMs &&
    mobile.frameTimingsMs
  ) {
    if (sameSamples(mobile.frameTimingsMs, desktop.frameTimingsMs)) {
      reasons.push("MOBILE_SAMPLES_COPIED_FROM_DESKTOP");
    } else if (scaledSamples(mobile.frameTimingsMs, desktop.frameTimingsMs)) {
      reasons.push("MOBILE_SAMPLES_DERIVED_FROM_DESKTOP");
    }
  }
  if (receipt.desktopFrameP95 !== desktop.frameP95) {
    reasons.push("DESKTOP_MIRROR_DISAGREES_WITH_ENVIRONMENT");
  }
  if (receipt.mobileFrameP95 !== mobile.frameP95) {
    reasons.push("MOBILE_MIRROR_DISAGREES_WITH_ENVIRONMENT");
  }
  if (receipt.frameMeasurementState === "MEASURED" && weakestState(environments) !== "MEASURED") {
    reasons.push("AGGREGATE_MEASURED_WITHOUT_EVERY_ENVIRONMENT_MEASURED");
  }
  return { valid: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Field Core Web Vitals. Lab frames are never field evidence.
// ---------------------------------------------------------------------------

export type FieldMetricValue = number | "UNKNOWN";

export interface FieldCwvEvidence {
  source: "FIELD_RUM" | "CRUX";
  origin: string;
  collectionStart: string;
  collectionEnd: string;
  sampleCount: number;
  percentile: 75;
}

export interface FieldCwvStatus {
  lcp: FieldMetricValue;
  cls: FieldMetricValue;
  inp: FieldMetricValue;
  status: "UNKNOWN" | "MEASURED_FIELD";
  pass: boolean;
  evidence?: FieldCwvEvidence;
}

export function fieldCwvUnknown(): FieldCwvStatus {
  return { lcp: "UNKNOWN", cls: "UNKNOWN", inp: "UNKNOWN", status: "UNKNOWN", pass: false };
}

function hasFieldEvidence(evidence: FieldCwvEvidence | undefined): boolean {
  return Boolean(
    evidence &&
      (evidence.source === "FIELD_RUM" || evidence.source === "CRUX") &&
      typeof evidence.origin === "string" &&
      evidence.origin.length > 0 &&
      typeof evidence.collectionStart === "string" &&
      typeof evidence.collectionEnd === "string" &&
      Number.isInteger(evidence.sampleCount) &&
      evidence.sampleCount > 0 &&
      evidence.percentile === 75,
  );
}

/**
 * Without genuine field evidence every metric stays UNKNOWN and pass=false.
 * Lab harness frame timings cannot be offered as field evidence.
 */
export function validateFieldCwv(status: FieldCwvStatus): ReceiptValidation {
  const reasons: string[] = [];
  const metricsKnown = [status.lcp, status.cls, status.inp].some((value) => value !== "UNKNOWN");
  if (!hasFieldEvidence(status.evidence)) {
    if (metricsKnown) reasons.push("FIELD_METRIC_WITHOUT_FIELD_EVIDENCE");
    if (status.status !== "UNKNOWN") reasons.push("FIELD_STATUS_WITHOUT_FIELD_EVIDENCE");
    if (status.pass !== false) reasons.push("FIELD_PASS_WITHOUT_FIELD_EVIDENCE");
  } else if (
    status.pass === true &&
    [status.lcp, status.cls, status.inp].some((value) => value === "UNKNOWN")
  ) {
    reasons.push("FIELD_PASS_WITH_UNKNOWN_METRIC");
  }
  return { valid: reasons.length === 0, reasons };
}

export interface OptimizationProposal {
  targetDrawCalls: number;
  targetTriangles: number;
  maxDpr: number;
  actions: string[];
}

export function proposeOptimization(receipt: ScenePerformanceReceipt): OptimizationProposal {
  const actions: string[] = [];
  let targetTriangles = receipt.triangles;
  let targetDrawCalls = receipt.drawCalls;
  let maxDpr = 1.5;

  if (receipt.triangles > 8000) {
    actions.push("ENABLE_LOD_DECIMATION");
    targetTriangles = Math.round(receipt.triangles * 0.65);
  }
  if (receipt.drawCalls > 30) {
    actions.push("INSTANCED_MESH_BATCHING");
    targetDrawCalls = Math.min(25, receipt.drawCalls);
  }
  if (receipt.desktopFrameP95 && receipt.desktopFrameP95 > 16.6) {
    actions.push("CLAMP_MAX_DPR_1_25");
    maxDpr = 1.25;
  }

  return { targetDrawCalls, targetTriangles, maxDpr, actions };
}

export function applyOptimizationProposal(
  scene: SceneIR,
  proposal: OptimizationProposal,
): SceneIR {
  const next = structuredClone(scene);
  next.performanceBudget = {
    ...next.performanceBudget,
    maxTriangles: proposal.targetTriangles,
    maxDrawCalls: proposal.targetDrawCalls,
    maxDpr: proposal.maxDpr,
  };
  return next;
}
