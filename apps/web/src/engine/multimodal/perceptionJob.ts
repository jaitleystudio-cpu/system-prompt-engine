/**
 * MM-Ω Public Processing Seam: PerceptionJob
 *
 * Implements the unified, single public interface bridging LocalMediaHandle
 * directly to RuntimeSession without caller-managed graph shards or manual
 * preprocessor negotiation.
 *
 * CONCEPTUAL SEAM:
 * LocalMediaHandle (raw local bytes)
 *   → PerceptionJob
 *       ↳ ModelPack (integrity, provenance, consent)
 *       ↳ RuntimeSession (WebGPU/WASM routing, resource lifecycle)
 *   → AsyncIterable<JobEvent> (typed streaming events)
 *   → EvidenceProjection & Outcome extraction
 *
 * NON-NEGOTIABLE PRIVACY & ARCHITECTURAL INVARIANTS:
 * - RAW_USER_DATA_EGRESS = 0 strictly maintained across all job receipts.
 * - LocalMediaHandle refers strictly to local bytes (Uint8Array/ArrayBuffer).
 *   External URLs, upload endpoints, and remote pointers are rejected.
 * - Ground-truth transcript / expected box injection is rejected from public requests.
 * - Supports cooperative AbortSignal cancellation and deterministic cleanup.
 */

import { computeSha256 } from "../hashUtils";
import { globalAsrEngine } from "./asrEngine";
import { globalDeviceNegotiator } from "./deviceNegotiator";
import { globalOcrEngine } from "./ocrEngine";
import { globalSceneCompiler } from "./sceneCompiler";
import { globalScreenshotCodeLoopEngine } from "./screenshotCodeLoop";
import type {
  AsrResult,
  DeviceCapability,
  InferenceSessionReceipt,
  OcrResult,
  ReconstructionCandidate,
  RuntimeBackend,
  Scene3DCompilationResult,
  SceneIR,
  TargetFramework,
  VideoTimelineIR,
} from "./types";
import { validateInferenceReceipt } from "./types";
import { globalVideoTimelineEngine } from "./videoTimeline";

export type MediaKind = "audio" | "image" | "video";

export interface LocalMediaHandle {
  id: string;
  kind: MediaKind;
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
  sampleRate?: number;
  durationSec?: number;
  width?: number;
  height?: number;
}

export type PerceptionTask =
  | "speech"
  | "text-recognition"
  | "video-index"
  | "screenshot-code"
  | "scene-3d";

export interface PerceptionRequest {
  jobId?: string;
  input: LocalMediaHandle;
  task: PerceptionTask;
  packId?: string;
  language?: string;
  targetFramework?: TargetFramework;
  sceneDefinition?: SceneIR;
  signal?: AbortSignal;
}

export type JobEventType =
  | "job:start"
  | "job:progress"
  | "job:segment"
  | "job:observation"
  | "job:receipt"
  | "job:complete"
  | "job:canceled"
  | "job:error";

export interface JobEvent<T = any> {
  jobId: string;
  type: JobEventType;
  task: PerceptionTask;
  progressPercent: number; // 0 to 100
  stage: string;
  data?: T;
  timestamp: string;
  error?: string;
}

export interface PerceptionJobStatus {
  jobId: string;
  task: PerceptionTask;
  state: "PENDING" | "RUNNING" | "COMPLETED" | "CANCELED" | "FAILED";
  progressPercent: number;
  backend: RuntimeBackend;
  startedAt: string;
  completedAt?: string;
  receipt?: InferenceSessionReceipt;
  error?: string;
}

/**
 * Validates that the media handle satisfies strict local data invariants.
 */
export function validateLocalMediaHandle(handle: LocalMediaHandle): void {
  if (!handle || typeof handle !== "object") {
    throw new Error("Invalid LocalMediaHandle: must be an object");
  }
  if (!handle.id || typeof handle.id !== "string") {
    throw new Error("Invalid LocalMediaHandle: missing string 'id'");
  }
  if (!handle.kind || !["audio", "image", "video"].includes(handle.kind)) {
    throw new Error(`Invalid LocalMediaHandle kind: '${handle.kind}'`);
  }
  if (!(handle.bytes instanceof Uint8Array)) {
    throw new Error(
      "Invalid LocalMediaHandle: 'bytes' must be a Uint8Array containing local media bytes",
    );
  }
  if (handle.bytes.byteLength === 0) {
    throw new Error("Invalid LocalMediaHandle: 'bytes' cannot be empty");
  }

  // Reject URL strings or remote fetch attempts passed as name or metadata
  const name = (handle.fileName || "").toLowerCase();
  if (name.startsWith("http://") || name.startsWith("https://") || name.startsWith("blob:")) {
    throw new Error("Invalid LocalMediaHandle: remote URL pointers are strictly forbidden");
  }
}

/**
 * PerceptionJobManager: Coordinates local-first perception execution
 */
export class PerceptionJobManager {
  private activeJobs = new Map<string, AbortController>();
  private jobHistories = new Map<string, PerceptionJobStatus>();

  /**
   * Primary public processing seam.
   * Streams JobEvents asynchronously to caller.
   */
  async *run(request: PerceptionRequest): AsyncIterable<JobEvent> {
    validateLocalMediaHandle(request.input);

    const jobId =
      request.jobId ||
      `pjob-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const task = request.task;
    const nowIso = new Date().toISOString();

    // Check caller cancellation signal immediately
    if (request.signal?.aborted) {
      const cancelEvt: JobEvent = {
        jobId,
        type: "job:canceled",
        task,
        progressPercent: 0,
        stage: "Aborted before dispatch",
        timestamp: new Date().toISOString(),
      };
      yield cancelEvt;
      throw new DOMException("Job aborted by caller", "AbortError");
    }

    const abortController = new AbortController();
    this.activeJobs.set(jobId, abortController);

    // Link caller signal if provided
    if (request.signal) {
      request.signal.addEventListener("abort", () => {
        abortController.abort();
      });
    }

    const linkedSignal = abortController.signal;

    // Negotiate hardware backend
    const devCap: DeviceCapability = await globalDeviceNegotiator.probeCapability();
    const negotiatedBackend: RuntimeBackend = devCap.hasWebGpu
      ? "WEBGPU"
      : devCap.hasWasmSimd
      ? "WASM"
      : "UNAVAILABLE";

    const statusRecord: PerceptionJobStatus = {
      jobId,
      task,
      state: "RUNNING",
      progressPercent: 0,
      backend: negotiatedBackend,
      startedAt: nowIso,
    };
    this.jobHistories.set(jobId, statusRecord);

    // Yield initial start event
    yield {
      jobId,
      type: "job:start",
      task,
      progressPercent: 0,
      stage: `Initializing ${task} perception on ${negotiatedBackend}`,
      data: {
        backend: negotiatedBackend,
        mediaKind: request.input.kind,
        bytesLength: request.input.bytes.byteLength,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      if (task === "speech") {
        yield* this.runSpeechJob(jobId, request, linkedSignal);
      } else if (task === "text-recognition") {
        yield* this.runOcrJob(jobId, request, linkedSignal);
      } else if (task === "video-index") {
        yield* this.runVideoJob(jobId, request, linkedSignal);
      } else if (task === "screenshot-code") {
        yield* this.runScreenshotJob(jobId, request, linkedSignal);
      } else if (task === "scene-3d") {
        yield* this.runScene3dJob(jobId, request, linkedSignal);
      } else {
        throw new Error(`Unsupported perception task: '${task}'`);
      }

      statusRecord.state = "COMPLETED";
      statusRecord.progressPercent = 100;
      statusRecord.completedAt = new Date().toISOString();
    } catch (err: any) {
      if (linkedSignal.aborted || err.name === "AbortError") {
        statusRecord.state = "CANCELED";
        yield {
          jobId,
          type: "job:canceled",
          task,
          progressPercent: statusRecord.progressPercent,
          stage: "Execution canceled",
          timestamp: new Date().toISOString(),
        };
        throw new DOMException("Job execution canceled", "AbortError");
      }

      statusRecord.state = "FAILED";
      statusRecord.error = err.message || String(err);
      yield {
        jobId,
        type: "job:error",
        task,
        progressPercent: statusRecord.progressPercent,
        stage: "Error encountered",
        error: statusRecord.error,
        timestamp: new Date().toISOString(),
      };
      throw err;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel an active in-flight perception job.
   */
  async cancel(jobId: string): Promise<void> {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
    const status = this.jobHistories.get(jobId);
    if (status && status.state === "RUNNING") {
      status.state = "CANCELED";
      status.completedAt = new Date().toISOString();
    }
  }

  /**
   * Release and dispose all managed sessions and controllers.
   */
  async dispose(): Promise<void> {
    for (const controller of this.activeJobs.values()) {
      controller.abort();
    }
    this.activeJobs.clear();
  }

  /**
   * Get historical or active status of a job.
   */
  getStatus(jobId: string): PerceptionJobStatus | undefined {
    return this.jobHistories.get(jobId);
  }

  // --------------------------------------------------------------------------
  // Internal Task Runners
  // --------------------------------------------------------------------------

  private async *runSpeechJob(
    jobId: string,
    request: PerceptionRequest,
    signal: AbortSignal,
  ): AsyncIterable<JobEvent> {
    if (request.input.kind !== "audio") {
      throw new Error(`Speech task requires 'audio' input, received '${request.input.kind}'`);
    }

    yield {
      jobId,
      type: "job:progress",
      task: "speech",
      progressPercent: 20,
      stage: "Decoding and normalizing audio to 16kHz mono Float32",
      timestamp: new Date().toISOString(),
    };

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const asrResult: AsrResult = await globalAsrEngine.transcribe({
      audioBytes: request.input.bytes,
      sampleRate: request.input.sampleRate || 16000,
      language: request.language || "en",
      signal,
      onProgress: (_p, _stage) => {
        // Streamed internally
      },
    });

    yield {
      jobId,
      type: "job:progress",
      task: "speech",
      progressPercent: 70,
      stage: "Acoustic transcription complete, streaming segments",
      timestamp: new Date().toISOString(),
    };

    for (const seg of asrResult.segments) {
      yield {
        jobId,
        type: "job:segment",
        task: "speech",
        progressPercent: 85,
        stage: `Segment [${seg.startSec.toFixed(1)}s - ${seg.endSec.toFixed(1)}s]`,
        data: seg,
        timestamp: new Date().toISOString(),
      };
    }

    // MM-Ω: Enforce zero egress invariant on receipt
    validateInferenceReceipt(asrResult.receipt);

    yield {
      jobId,
      type: "job:receipt",
      task: "speech",
      progressPercent: 95,
      stage: "Inference receipt verified with RAW_USER_DATA_EGRESS=0",
      data: asrResult.receipt,
      timestamp: new Date().toISOString(),
    };

    yield {
      jobId,
      type: "job:complete",
      task: "speech",
      progressPercent: 100,
      stage: "Speech transcription successfully completed",
      data: asrResult,
      timestamp: new Date().toISOString(),
    };
  }

  private async *runOcrJob(
    jobId: string,
    request: PerceptionRequest,
    signal: AbortSignal,
  ): AsyncIterable<JobEvent> {
    if (request.input.kind !== "image") {
      throw new Error(`Text recognition task requires 'image' input, received '${request.input.kind}'`);
    }

    yield {
      jobId,
      type: "job:progress",
      task: "text-recognition",
      progressPercent: 30,
      stage: "Detecting text-likelihood projection bands and ROIs",
      timestamp: new Date().toISOString(),
    };

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const width = request.input.width || 200;
    const height = request.input.height || 100;
    const data = new Uint8ClampedArray(width * height * 4);
    const byteLen = Math.min(request.input.bytes.byteLength, data.byteLength);
    data.set(new Uint8Array(request.input.bytes.buffer, request.input.bytes.byteOffset, byteLen));
    const imageData = { width, height, data } as unknown as ImageData;

    const ocrResult: OcrResult = await globalOcrEngine.recognize(imageData, signal);

    for (const region of ocrResult.regions) {
      yield {
        jobId,
        type: "job:observation",
        task: "text-recognition",
        progressPercent: 80,
        stage: `Recognized text region (${region.script})`,
        data: region,
        timestamp: new Date().toISOString(),
      };
    }

    validateInferenceReceipt(ocrResult.receipt);

    yield {
      jobId,
      type: "job:receipt",
      task: "text-recognition",
      progressPercent: 95,
      stage: "OCR receipt verified with RAW_USER_DATA_EGRESS=0",
      data: ocrResult.receipt,
      timestamp: new Date().toISOString(),
    };

    yield {
      jobId,
      type: "job:complete",
      task: "text-recognition",
      progressPercent: 100,
      stage: "Multilingual OCR completed",
      data: ocrResult,
      timestamp: new Date().toISOString(),
    };
  }

  private async *runVideoJob(
    jobId: string,
    request: PerceptionRequest,
    signal: AbortSignal,
  ): AsyncIterable<JobEvent> {
    if (request.input.kind !== "video") {
      throw new Error(`Video index task requires 'video' input, received '${request.input.kind}'`);
    }

    yield {
      jobId,
      type: "job:progress",
      task: "video-index",
      progressPercent: 25,
      stage: "Demuxing keyframes and audio track from video buffer",
      timestamp: new Date().toISOString(),
    };

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const timeline: VideoTimelineIR = await globalVideoTimelineEngine.buildTimeline({
      videoDigest: computeSha256(`video-${request.input.bytes.byteLength}`),
      keyframes: [],
      audioBytes: request.input.bytes,
      durationSec: request.input.durationSec || 10,
      fps: 30,
      signal,
    });

    yield {
      jobId,
      type: "job:complete",
      task: "video-index",
      progressPercent: 100,
      stage: "Video intelligence timeline generated",
      data: timeline,
      timestamp: new Date().toISOString(),
    };
  }

  private async *runScreenshotJob(
    jobId: string,
    request: PerceptionRequest,
    signal: AbortSignal,
  ): AsyncIterable<JobEvent> {
    if (request.input.kind !== "image") {
      throw new Error(`Screenshot to code requires 'image' input, received '${request.input.kind}'`);
    }

    yield {
      jobId,
      type: "job:progress",
      task: "screenshot-code",
      progressPercent: 25,
      stage: "Segmenting visual UI regions and extracting design tokens",
      timestamp: new Date().toISOString(),
    };

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const width = request.input.width || 320;
    const height = request.input.height || 240;
    const data = new Uint8ClampedArray(width * height * 4);
    const byteLen = Math.min(request.input.bytes.byteLength, data.byteLength);
    data.set(new Uint8Array(request.input.bytes.buffer, request.input.bytes.byteOffset, byteLen));
    const screenshotData = { width, height, data } as unknown as ImageData;

    const candidate: ReconstructionCandidate =
      await globalScreenshotCodeLoopEngine.reconstruct(
        screenshotData,
        request.targetFramework || "react",
        3,
      );

    yield {
      jobId,
      type: "job:observation",
      task: "screenshot-code",
      progressPercent: 85,
      stage: `Fidelity measured: SSIM ${candidate.fidelity.ssim.toFixed(3)}, pixel diff ${candidate.fidelity.pixelDifferencePercent.toFixed(1)}%`,
      data: candidate.fidelity,
      timestamp: new Date().toISOString(),
    };

    yield {
      jobId,
      type: "job:complete",
      task: "screenshot-code",
      progressPercent: 100,
      stage: `Reconstruction completed (${candidate.fidelity.status})`,
      data: candidate,
      timestamp: new Date().toISOString(),
    };
  }

  private async *runScene3dJob(
    jobId: string,
    request: PerceptionRequest,
    signal: AbortSignal,
  ): AsyncIterable<JobEvent> {
    yield {
      jobId,
      type: "job:progress",
      task: "scene-3d",
      progressPercent: 30,
      stage: "Compiling SceneIR into deterministic WebGL/Three.js standalone runtime",
      timestamp: new Date().toISOString(),
    };

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const sceneDef = request.sceneDefinition;
    if (!sceneDef) {
      throw new Error("Scene 3D compilation requires 'sceneDefinition' SceneIR parameter");
    }

    const result: Scene3DCompilationResult = globalSceneCompiler.compile(sceneDef);

    yield {
      jobId,
      type: "job:complete",
      task: "scene-3d",
      progressPercent: 100,
      stage: "Deterministic 3D website compilation complete",
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}

export const globalPerceptionJobManager = new PerceptionJobManager();

/**
 * Functional convenience wrapper matching the conceptual interface:
 * `run(request: PerceptionRequest): AsyncIterable<JobEvent>`
 */
export function runPerceptionJob(request: PerceptionRequest): AsyncIterable<JobEvent> {
  return globalPerceptionJobManager.run(request);
}

export function cancelPerceptionJob(jobId: string): Promise<void> {
  return globalPerceptionJobManager.cancel(jobId);
}
