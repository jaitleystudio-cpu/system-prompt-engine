import {
  observeImageData,
  observationToPromptBlock,
} from "./imageObserve";
import { buildSemanticFromLite } from "./semanticCompose";
import { semanticToPromptBlock } from "./semanticCompose";
import {
  assertVideoFileBounds,
  MAX_ANALYSIS_SIDE,
  MAX_VIDEO_DURATION_SEC,
  MAX_VIDEO_FRAMES,
  SEEK_TIMEOUT_MS,
} from "./limits";
import { wrapUntrustedData } from "./untrusted";
import { detectTextLikeRegions } from "./ocrLite";
import type { ImageObservation, VideoObservation } from "./types";
import type { SemanticObservation } from "./semanticTypes";

function pickUniformTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const n = Math.min(MAX_VIDEO_FRAMES, Math.max(3, Math.ceil(duration / 4)));
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * duration;
    return Math.min(duration - 0.05, Math.max(0, t));
  });
}

function seek(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek in this video."));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Seek timed out after ${SEEK_TIMEOUT_MS}ms.`));
    }, SEEK_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

export function frameSignature(f: ImageObservation): number[] {
  return [
    f.brightness.mean,
    f.edgeDensity,
    f.brightness.darkShare,
    f.dominantColors[0]?.share ?? 0,
    ...f.grid.map((g) => g.meanBrightness / 255),
  ];
}

export function sceneDistance(a: ImageObservation, b: ImageObservation): number {
  const sa = frameSignature(a);
  const sb = frameSignature(b);
  let sum = 0;
  for (let i = 0; i < sa.length; i++) {
    const d = (sa[i] ?? 0) - (sb[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Keep frames that look like scene changes; always keep first + last. */
export function selectSceneKeyframes(
  frames: ImageObservation[],
  times: number[],
  threshold = 0.35,
): { frames: ImageObservation[]; times: number[] } {
  if (!frames.length) return { frames: [], times: [] };
  const keptF: ImageObservation[] = [frames[0]];
  const keptT: number[] = [times[0]];
  for (let i = 1; i < frames.length - 1; i++) {
    if (sceneDistance(keptF[keptF.length - 1], frames[i]) >= threshold) {
      keptF.push(frames[i]);
      keptT.push(times[i]);
    }
  }
  const last = frames.length - 1;
  if (
    last > 0 &&
    (keptT[keptT.length - 1] !== times[last] ||
      sceneDistance(keptF[keptF.length - 1], frames[last]) >= threshold * 0.5)
  ) {
    if (keptT[keptT.length - 1] !== times[last]) {
      keptF.push(frames[last]);
      keptT.push(times[last]);
    }
  }
  return { frames: keptF, times: keptT };
}

/** Drop near-duplicate frames by brightness + edge signature. */
export function dedupeFrames(
  frames: ImageObservation[],
  times: number[],
): { frames: ImageObservation[]; times: number[] } {
  const keptF: ImageObservation[] = [];
  const keptT: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const prev = keptF[keptF.length - 1];
    if (
      prev &&
      Math.abs(prev.brightness.mean - f.brightness.mean) < 6 &&
      Math.abs(prev.edgeDensity - f.edgeDensity) < 0.04 &&
      (prev.dominantColors[0]?.hex ?? "") === (f.dominantColors[0]?.hex ?? "")
    ) {
      continue;
    }
    keptF.push(f);
    keptT.push(times[i]);
  }
  if (!keptF.length && frames.length) {
    return { frames: [frames[0]], times: [times[0]] };
  }
  return { frames: keptF, times: keptT };
}

export function summarizeSequence(
  frames: ImageObservation[],
  times: number[],
  durationSec: number,
  pacingCues: string[],
): string {
  if (!frames.length) return "No frames sampled.";
  const first = frames[0];
  const last = frames[frames.length - 1];
  const brightShift = last.brightness.mean - first.brightness.mean;
  const edgeShift = last.edgeDensity - first.edgeDensity;
  const cuts = Math.max(0, frames.length - 1);
  const pace =
    durationSec > 0 && cuts / durationSec > 0.25
      ? "fast cuts"
      : cuts / Math.max(1, durationSec) < 0.05
        ? "slow / continuous"
        : "moderate pacing";
  return [
    `Sequence across ${durationSec}s with ${frames.length} scene-aware keyframes (${cuts} transitions, ${pace}).`,
    `Brightness trend: ${brightShift > 12 ? "brightening" : brightShift < -12 ? "darkening" : "stable"} (${first.brightness.mean.toFixed(0)} → ${last.brightness.mean.toFixed(0)}).`,
    `Structure trend: ${edgeShift > 0.08 ? "more detail appears" : edgeShift < -0.08 ? "simplifies" : "similar complexity"}.`,
    pacingCues.length ? `Pacing cues: ${pacingCues.join("; ")}.` : null,
    `Keyframe times (s): ${times.join(", ")}.`,
    "Audio is not transcribed.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type VideoSemanticBundle = VideoObservation & {
  frameSemantics: SemanticObservation[];
};

export async function observeVideoFile(
  file: File,
  signal?: AbortSignal,
): Promise<VideoObservation> {
  const bundle = await observeVideoFileSemantic(file, { signal, tier: "LITE" });
  return bundle;
}

export async function observeVideoFileSemantic(
  file: File,
  opts: { signal?: AbortSignal; tier?: "LITE" | "STANDARD" } = {},
): Promise<VideoSemanticBundle> {
  const signal = opts.signal;
  assertVideoFileBounds(file);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      video.onloadedmetadata = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      video.onerror = () => {
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Could not decode this video."));
      };
    });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("This video has no readable duration.");
    }
    if (duration > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        `Video is too long (max ${MAX_VIDEO_DURATION_SEC}s for local sampling).`,
      );
    }
    const times = pickUniformTimes(duration);
    const rawFrames: ImageObservation[] = [];
    const rawData: ImageData[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    for (const t of times) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await seek(video, t, signal);
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(vw, vh));
      const w = Math.max(1, Math.round(vw * scale));
      const h = Math.max(1, Math.round(vh * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      rawData.push(data);
      rawFrames.push(
        observeImageData(data, {
          fileName: `${file.name} @ ${t.toFixed(2)}s`,
          fileBytes: null,
          mimeType: "image/frame",
          sourceWidth: vw,
          sourceHeight: vh,
        }),
      );
    }
    const scene = selectSceneKeyframes(rawFrames, times);
    const { frames, times: keptTimes } = dedupeFrames(scene.frames, scene.times);
    const pacingCues: string[] = [];
    for (let i = 1; i < keptTimes.length; i++) {
      const dt = keptTimes[i] - keptTimes[i - 1];
      if (dt < 1.2) pacingCues.push(`quick shift at ${keptTimes[i].toFixed(1)}s`);
      else if (dt > duration * 0.35)
        pacingCues.push(`held scene until ${keptTimes[i].toFixed(1)}s`);
    }
    const sequenceSummary = summarizeSequence(
      frames,
      keptTimes,
      duration,
      pacingCues.slice(0, 4),
    );

    // Bound semantic work: max 4 keyframes, LITE by default to protect resources
    const frameSemantics: SemanticObservation[] = [];
    const semCap = Math.min(4, frames.length);
    for (let i = 0; i < semCap; i++) {
      const idx = rawFrames.indexOf(frames[i]);
      const data = idx >= 0 ? rawData[idx] : null;
      const ocr = data ? detectTextLikeRegions(data) : [];
      frameSemantics.push(
        buildSemanticFromLite(frames[i], {
          tier: "LITE",
          elapsedMs: 0,
          ocrBlocks: ocr,
          methodNotes: [
            "video-keyframe",
            opts.tier === "STANDARD"
              ? "STANDARD deferred per-frame to bound memory — sequence uses structure+OCR-likeness"
              : "LITE frame semantics",
          ],
          imageData: data,
        }),
      );
    }

    return {
      kind: "video",
      durationSec: Math.round(duration * 100) / 100,
      width: video.videoWidth,
      height: video.videoHeight,
      fileName: file.name,
      fileBytes: file.size,
      mimeType: file.type || null,
      sampleTimesSec: keptTimes.map((t) => Math.round(t * 100) / 100),
      frames,
      sequenceSummary,
      notes: [
        `Sampled ${rawFrames.length} frames, kept ${frames.length} after scene-change + dedupe across ${duration.toFixed(1)}s (bounded, local).`,
        "No audio transcription.",
      ],
      uncertainty: [
        "Audio is not transcribed.",
        "Motion tracking is not performed — sparse scene-aware keyframes only.",
        "Scene boundaries use brightness/edge/grid signatures, not a dedicated shot-boundary network.",
      ],
      frameSemantics,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export function videoObservationToPromptBlock(
  obs: VideoObservation & { frameSemantics?: SemanticObservation[] },
): string {
  const frameBlocks =
    obs.frameSemantics && obs.frameSemantics.length
      ? obs.frameSemantics
          .slice(0, 4)
          .map(
            (s, i) =>
              `Keyframe ${i + 1} @ ${obs.sampleTimesSec[i]}s\n${semanticToPromptBlock(s)}`,
          )
          .join("\n\n")
      : obs.frames
          .slice(0, 4)
          .map(
            (f, i) =>
              `Frame ${i + 1} @ ${obs.sampleTimesSec[i]}s\n${observationToPromptBlock(f)}`,
          )
          .join("\n\n");
  const body = [
    "VIDEO SEQUENCE SUMMARY:",
    obs.sequenceSummary,
    "",
    `File: ${obs.fileName ?? "video"} (${obs.width}×${obs.height}, ${obs.durationSec}s)`,
    obs.fileBytes != null ? `Bytes: ${obs.fileBytes}` : null,
    `Notes: ${obs.notes.join(" ")}`,
    `Uncertainty: ${obs.uncertainty.join(" ")}`,
    "",
    "KEYFRAME SEMANTIC OBSERVATIONS (bounded — not 8× diagnostic dumps):",
    frameBlocks,
  ]
    .filter(Boolean)
    .join("\n");
  return wrapUntrustedData("local-video-observation", body);
}
