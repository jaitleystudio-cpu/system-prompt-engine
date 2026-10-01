/**
 * MM-Ω: Multimodal Runtime Contract & Invariant Types
 *
 * Defines the unified interfaces for local-first speech, OCR, video,
 * screenshot-to-code, and 3D scene execution.
 *
 * NON-NEGOTIABLE PRIVACY LAW:
 * RAW_USER_DATA_EGRESS = 0
 * (RAW_AUDIO_EGRESS = 0, RAW_VIDEO_EGRESS = 0, RAW_SCREENSHOT_EGRESS = 0, RAW_PROMPT_EGRESS = 0)
 */

export type RuntimeBackend = "WEBGPU" | "WASM" | "UNAVAILABLE";

export type ModelPackState =
  | "NOT_INSTALLED"
  | "DOWNLOADING"
  | "VERIFYING"
  | "READY"
  | "FAILED"
  | "INCOMPATIBLE";

export type ProvisioningMode =
  | "BUNDLED"
  | "EXPLICIT_DOWNLOAD"
  | "OFFLINE_SIDELOAD";

export type MultimodalTask =
  | "asr-speech-transcription"
  | "ocr-text-recognition"
  | "ui-segmentation"
  | "scene-3d-compilation";

export interface ModelManifestFile {
  name: string;
  sizeBytes: number;
  sha256: string;
  required: boolean;
}

export interface ModelDigest {
  algorithm: "sha256";
  expectedDigest: string;
  actualDigest: string | null;
  verified: boolean;
}

export interface ModelCapability {
  task: MultimodalTask;
  supportedTasks: MultimodalTask[];
  supportedLanguages: string[];
  supportedRuntimes: RuntimeBackend[];
  quantization: "INT8" | "FP16" | "FP32";
  minimumMemoryMb: number;
}

export interface ModelManifest {
  modelId: string;
  version: string;
  displayName: string;
  task: MultimodalTask;
  supportedTasks: MultimodalTask[];
  source: string;
  license: string;
  expectedSizeBytes: number;
  sha256: string;
  files: ModelManifestFile[];
  supportedRuntimes: RuntimeBackend[];
  supportedLanguages: string[];
  minimumMemoryMb: number;
  quantization: "INT8" | "FP16" | "FP32";
  provenance: string;
  qualificationState:
    | "DECLARED"
    | "PROVENANCE_VERIFIED"
    | "BYTES_VERIFIED"
    | "INFERENCE_VERIFIED"
    | "BENCHMARKED"
    | "QUALIFIED"
    | "CANDIDATE"
    | "MANIFEST_ONLY"
    | "ARTIFACT_UNVERIFIED"
    | "DEGRADED"
    | "FALLBACK"
    | "UNAVAILABLE"
    | "UNTESTED";
  opsetVersion?: number;
}

export interface ModelPack {
  manifest: ModelManifest;
  state: ModelPackState;
  provisioning: ProvisioningMode;
  installedBytes: number;
  activeBackend: RuntimeBackend;
  verifiedDigest: string | null;
  errorMessage?: string;
  installedAt?: string;
  artifactClass?: "PRODUCTION_RELEASE" | "TEST_FIXTURE";
  productionQualificationAllowed?: boolean;
}

export interface OfflineModelPackage {
  magic: "SPEMODEL";
  formatVersion: 1;
  modelId: string;
  manifest: ModelManifest;
  files: Record<string, Uint8Array>;
  archiveDigest: string;
  packagedAt: string;
  artifactClass: "PRODUCTION_RELEASE" | "TEST_FIXTURE";
  productionQualificationAllowed: boolean;
}

export interface NetworkObservabilityTrace {
  modelDownloadNetworkBytes: number;
  inferenceNetworkBytes: 0;
  rawMediaEgressBytes: 0;
  derivedTextEgressBytes: 0;
  telemetryEgressBytes: 0;
}

export type CodeSwitchStatus =
  | "NOT_TESTED"
  | "DATASET_READY"
  | "BENCHMARKED"
  | "QUALIFIED_WITHIN_TESTED_SCOPE";

export interface LanguageQualificationStatus {
  locale: string;
  uiLocaleAvailable: boolean;
  readbackTemplateAvailable: boolean;
  asrModelSupportDeclared: boolean;
  asrBenchmarked: boolean;
  ocrModelSupportDeclared: boolean;
  ocrBenchmarked: boolean;
  fixtureCoverage: boolean;
  modelSupportDeclared: boolean;
  realModelBytesVerified: boolean;
  realInferenceExecuted: boolean;
  realBenchmarkExecuted: boolean;
  codeSwitchStatus?: CodeSwitchStatus;
}

export interface DeviceCapability {
  hasWebGpu: boolean;
  webGpuAdapterInfo?: string;
  hasWasmSimd: boolean;
  hasWasmThreads: boolean;
  deviceMemoryGb?: number;
  hardwareConcurrency: number;
  isMobile: boolean;
  browserFamily: "chrome" | "firefox" | "safari" | "edge" | "other";
  osFamily: "macos" | "windows" | "linux" | "android" | "ios" | "other";
}

export interface InferenceSession {
  sessionId: string;
  modelId: string;
  backend: RuntimeBackend;
  state: "INITIALIZING" | "READY" | "BUSY" | "TERMINATED" | "ERROR";
  deviceCapability: DeviceCapability;
  createdAt: string;
}

export interface InferenceSessionReceipt {
  sessionId: string;
  modelId: string;
  backend: RuntimeBackend;
  deviceCapability: DeviceCapability;
  inferenceTimeMs: number;
  peakMemoryMb?: number;
  inputDigest: string;
  outputDigest: string;
  timestamp: string;
  rawUserDataEgress: 0;
  artifactClass?: "PRODUCTION_RELEASE" | "TEST_FIXTURE";
  productionQualificationAllowed?: boolean;
  networkTrace?: NetworkObservabilityTrace;
  sessionCreateProven?: boolean;
  sessionRunProven?: boolean;
  executionProvider?: RuntimeBackend;
  realModelExecuted?: boolean;
  isMockSession?: boolean;
  hasHardcodedTranscript?: boolean;
  hasHardcodedOcrText?: boolean;
}

export type InferenceReceipt = InferenceSessionReceipt;

/**
 * Validates inference receipt against non-negotiable zero user data egress and qualification laws.
 */
export function validateInferenceReceipt(receipt: InferenceSessionReceipt): boolean {
  if (!receipt) {
    throw new Error("Receipt validation failed: missing receipt object");
  }
  if (receipt.rawUserDataEgress !== 0) {
    throw new Error(
      `PRIVACY VIOLATION: rawUserDataEgress must be strictly 0, got ${receipt.rawUserDataEgress}`,
    );
  }
  if (!receipt.sessionId || !receipt.modelId || !receipt.timestamp) {
    throw new Error("Invalid receipt: missing required identification fields");
  }
  // Anti-fraud gate: TEST_FIXTURE claiming production qualification is invalid
  if (receipt.artifactClass === "TEST_FIXTURE" && receipt.productionQualificationAllowed === true) {
    throw new Error(
      "QUALIFICATION FRAUD: artifactClass TEST_FIXTURE cannot claim productionQualificationAllowed=true",
    );
  }
  // MM-Q3 Law: Mock session claiming real execution or production qualification is rejected
  if (receipt.isMockSession && (receipt.sessionRunProven === true || receipt.realModelExecuted === true)) {
    throw new Error(
      "EXECUTION INTEGRITY VIOLATION: Mocked session cannot claim sessionRunProven=true or realModelExecuted=true",
    );
  }
  // MM-Q3 Law: Session create proven without session run proven cannot claim production qualification
  if (receipt.sessionCreateProven === true && receipt.sessionRunProven !== true && receipt.productionQualificationAllowed === true) {
    throw new Error(
      "EXECUTION INTEGRITY VIOLATION: session created but session.run was not proven to execute",
    );
  }
  // MM-Q3 Law: Hardcoded transcript claiming production qualification is rejected
  if (receipt.hasHardcodedTranscript === true && receipt.productionQualificationAllowed === true) {
    throw new Error(
      "EPISTEMIC VIOLATION: Hardcoded transcript cannot be claimed as production inference",
    );
  }
  // MM-Q3 Law: Hardcoded OCR text claiming production qualification is rejected
  if (receipt.hasHardcodedOcrText === true && receipt.productionQualificationAllowed === true) {
    throw new Error(
      "EPISTEMIC VIOLATION: Hardcoded OCR text cannot be claimed as production inference",
    );
  }
  // MM-Q3 Law: realModelExecuted must be true to claim production qualification
  if (receipt.realModelExecuted === false && receipt.productionQualificationAllowed === true) {
    throw new Error(
      "QUALIFICATION FRAUD: realModelExecuted must be true to claim productionQualificationAllowed=true",
    );
  }
  // Validate network observability trace if attached
  if (receipt.networkTrace) {
    if (receipt.networkTrace.inferenceNetworkBytes !== 0) {
      throw new Error(
        `PRIVACY VIOLATION: inferenceNetworkBytes must be 0 during inference, got ${receipt.networkTrace.inferenceNetworkBytes}`,
      );
    }
    if (receipt.networkTrace.rawMediaEgressBytes !== 0) {
      throw new Error(
        `PRIVACY VIOLATION: rawMediaEgressBytes must be 0, got ${receipt.networkTrace.rawMediaEgressBytes}`,
      );
    }
    if (receipt.networkTrace.derivedTextEgressBytes !== 0) {
      throw new Error(
        `PRIVACY VIOLATION: derivedTextEgressBytes must be 0, got ${receipt.networkTrace.derivedTextEgressBytes}`,
      );
    }
    if (receipt.networkTrace.telemetryEgressBytes !== 0) {
      throw new Error(
        `PRIVACY VIOLATION: telemetryEgressBytes must be 0, got ${receipt.networkTrace.telemetryEgressBytes}`,
      );
    }
  }
  return true;
}

/**
 * Validates benchmark report against epistemic laws:
 * - Real model evaluation cannot be reported if realModelExecuted=false.
 * - Empty/vacuous benchmark fixture lists cannot report PASS.
 */
export function validateBenchmarkReport(report: {
  fixturesEvaluated: number;
  benchmarkClass?: "REAL_MODEL_EVALUATION" | "SYNTHETIC_FIXTURE_EVALUATION";
  realModelExecuted?: boolean;
}): boolean {
  if (!report || report.fixturesEvaluated === 0) {
    throw new Error("VACUOUS BENCHMARK: No fixtures evaluated");
  }
  if (report.benchmarkClass === "REAL_MODEL_EVALUATION" && report.realModelExecuted !== true) {
    throw new Error(
      "EPISTEMIC VIOLATION: Cannot report REAL_MODEL_EVALUATION when realModelExecuted=false. Fixture evaluation must be labeled SYNTHETIC_FIXTURE_EVALUATION.",
    );
  }
  return true;
}


// -------------------------------------------------------------
// MM-1: ASR / Speech Types
// -------------------------------------------------------------

export type AsrTruthState =
  | "LOCAL_ASR_QUALIFIED"
  | "LOCAL_ASR_UNAVAILABLE"
  | "BROWSER_FALLBACK"
  | "NO_TRANSCRIPTION";

export interface AsrTimestampSegment {
  id: number;
  startSec: number;
  endSec: number;
  text: string;
  confidence: number;
  speakerId?: string;
}

export interface AsrResult {
  text: string;
  language: string;
  segments: AsrTimestampSegment[];
  durationSec: number;
  realTimeFactor: number;
  backend: RuntimeBackend;
  truthState: AsrTruthState;
  receipt: InferenceSessionReceipt;
}

// -------------------------------------------------------------
// MM-2: OCR Types
// -------------------------------------------------------------

export type OcrTruthState =
  | "LOCAL_OCR_QUALIFIED"
  | "LOCAL_OCR_UNAVAILABLE"
  | "HEURISTIC_ROI_ONLY"
  | "SCRIPT_DETECTION_ONLY"
  | "NO_OCR";

export interface NormalizedBox {
  x: number; // 0.0 - 1.0
  y: number; // 0.0 - 1.0
  w: number; // 0.0 - 1.0
  h: number; // 0.0 - 1.0
}

export type ScriptType =
  | "Latin"
  | "Devanagari"
  | "Telugu"
  | "Tamil"
  | "Bengali"
  | "Gujarati"
  | "Kannada"
  | "Malayalam"
  | "Gurmukhi"
  | "Thai"
  | "Hangul"
  | "Japanese"
  | "Arabic"
  | "Han"
  | "Cyrillic"
  | "Code"
  | "Mixed"
  | "Unknown";

export interface OcrRecognizedRegion {
  id: string;
  text: string;
  bounds: NormalizedBox;
  confidence: number;
  script: ScriptType;
  method: "neural-ocr" | "heuristic-projection" | "sideload-tesseract";
  provenance: "UNTRUSTED_SOURCE";
}

export interface OcrResult {
  regions: OcrRecognizedRegion[];
  fullText: string;
  scriptsDetected: string[];
  backend: RuntimeBackend;
  truthState: OcrTruthState;
  receipt: InferenceSessionReceipt;
}

// -------------------------------------------------------------
// MM-3: Video Timeline Types
// -------------------------------------------------------------

export type VideoTimelineEntryType =
  | "TRANSCRIPT"
  | "ON_SCREEN_TEXT"
  | "VISUAL_OBSERVATION"
  | "INFERENCE";

export interface VideoTimelineEvent {
  startSec: number;
  endSec: number;
  type: VideoTimelineEntryType;
  content: string;
  confidence: number;
  provenance: "LOCAL_ASR" | "LOCAL_OCR" | "VISUAL_DIFF" | "HEURISTIC" | "UNTRUSTED_SOURCE";
  associatedBounds?: NormalizedBox;
  speech?: string;
  visibleText?: string;
  visualChange?: string;
}

export interface VideoTimelineIR {
  version: "video-timeline/1";
  videoDigest: string;
  durationSec: number;
  fps: number;
  keyframesCount: number;
  events: VideoTimelineEvent[];
  audioTranscribed: boolean;
  ocrExecuted: boolean;
  visualSceneCuts: number;
  summary: {
    speechSummary: string;
    onScreenTextSummary: string;
    visualPacingSummary: string;
  };
}

// -------------------------------------------------------------
// MM-4: Screenshot to Code V2 Types
// -------------------------------------------------------------

export type TargetFramework =
  | "html-css-js"
  | "react"
  | "swiftui"
  | "compose"
  | "flutter"
  | "react-native"
  | "html-tailwind"
  | "vue"
  | "svelte";

export interface FidelityReceipt {
  receiptId: string;
  target: TargetFramework;
  viewport: { width: number; height: number };
  ssim: number; // 0.0 to 1.0
  pixelDifferencePercent: number; // e.g. 2.4%
  pixelDifference: number; // MM-4 alias
  structuralMatchScore: number; // 0.0 to 1.0
  structuralMatch: number; // MM-4 alias
  textMatchScore: number; // 0.0 to 1.0
  textMatch: number; // MM-4 alias
  iterationsRun: number;
  iterationCount: number; // MM-4 alias
  candidateDigest: string;
  status: "QUALIFIED_FIDELITY" | "FIDELITY_UNPROVEN";
  measuredTimestamp: string;
  repairedDefects: string[];
}

export interface OcrBenchmarkFixture {
  id: string;
  name: string;
  script: OcrRecognizedRegion["script"];
  groundTruthText: string;
  expectedBounds: NormalizedBox;
  isDarkTheme?: boolean;
  isLowContrast?: boolean;
  isMobileScreenshot?: boolean;
  imageData?: ImageData;
}

export interface OcrBenchmarkReport {
  fixturesEvaluated: number;
  cerByScript: Record<string, number>;
  averageWer: number;
  averageBoxIou: number;
  averageLatencyMs: number;
  peakMemoryMb: number;
  modelSizeBytes: number;
  allScriptsQualified: boolean;
  benchmarkClass?: "REAL_MODEL_EVALUATION" | "SYNTHETIC_FIXTURE_EVALUATION";
  realModelExecuted?: boolean;
}

export interface AsrBenchmarkFixture {
  id: string;
  name: string;
  language: string;
  groundTruthText: string;
  audioBytes: Uint8Array;
  sampleRate?: number;
}

export interface AsrBenchmarkReport {
  fixturesEvaluated: number;
  werByLanguage: Record<string, number>;
  cerByLanguage: Record<string, number>;
  averageRtf: number;
  coldLoadSec: number;
  warmLoadMs: number;
  allLanguagesQualified: boolean;
  benchmarkClass?: "REAL_MODEL_EVALUATION" | "SYNTHETIC_FIXTURE_EVALUATION";
  realModelExecuted?: boolean;
}


export interface ReconstructionCandidate {
  target: TargetFramework;
  code: string;
  designTokens: Record<string, string>;
  fidelity: FidelityReceipt;
}

// -------------------------------------------------------------
// MM-5: SceneIR & 3D Website Types
// -------------------------------------------------------------

export type Scene3DStatus = "AVAILABLE" | "NOT_AVAILABLE" | "DEGRADED_2D_FALLBACK";

export interface Scene3DCamera {
  type: "perspective" | "orthographic";
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  near: number;
  far: number;
}

export interface Scene3DGeometry {
  type: "box" | "sphere" | "cylinder" | "plane" | "torus" | "wave-mesh";
  parameters: Record<string, number>;
}

export interface Scene3DMaterial {
  type: "standard" | "physical" | "basic";
  color: string;
  roughness: number;
  metalness: number;
  wireframe?: boolean;
  opacity?: number;
  transparent?: boolean;
  emissive?: string;
}

export interface Scene3DLight {
  id: string;
  type: "ambient" | "directional" | "point";
  color: string;
  intensity: number;
  position?: [number, number, number];
  castShadow?: boolean;
}

export interface Scene3DObject {
  id: string;
  name: string;
  geometry: Scene3DGeometry;
  material: Scene3DMaterial;
  position: [number, number, number];
  rotation: [number, number, number]; // in radians
  scale: [number, number, number];
  interactive?: {
    hoverColor?: string;
    onClickAction?: "modal" | "scroll" | "focus";
    ariaLabel: string;
  };
}

export interface Scene3DScrollTrack {
  objectId: string;
  property: "position.y" | "position.x" | "position.z" | "rotation.y" | "rotation.x" | "scale";
  startScrollRatio: number; // 0.0 to 1.0
  endScrollRatio: number;   // 0.0 to 1.0
  fromValue: number;
  toValue: number;
}

export interface Scene3DPerformanceBudget {
  maxDpr: number; // e.g. 1.5 or 2.0
  maxDrawCalls: number;
  maxTriangles: number;
  targetFps: number;
}

export interface SceneIR {
  sceneVersion: "scene-ir/1";
  title: string;
  theme: "dark" | "light";
  camera: Scene3DCamera;
  environment: {
    backgroundColor: string;
    fogColor?: string;
    fogDensity?: number;
  };
  lighting: Scene3DLight[];
  objects: Scene3DObject[];
  scrollTracks: Scene3DScrollTrack[];
  performanceBudget: Scene3DPerformanceBudget;
  accessibilityFallback: {
    hero2dSvg: string;
    textDescription: string;
    ariaRegionLabel: string;
  };
}

export interface Scene3DCompilationResult {
  sceneId: string;
  standaloneHtml: string;
  totalTriangles: number;
  status: Scene3DStatus;
  memoryFootprintKb: number;
  threeVersion: string;
  reducedMotionSupported: boolean;
  contextLossRecoverySupported: boolean;
}
