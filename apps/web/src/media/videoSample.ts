import { observeImageData, observationToPromptBlock } from "./imageObserve";
import {
  assertVideoFileBounds,
  MAX_ANALYSIS_SIDE,
  MAX_VIDEO_DURATION_SEC,
  MAX_VIDEO_FRAMES,
  SEEK_TIMEOUT_MS,
} from "./limits";
import { wrapUntrustedData } from "./untrusted";
import type { ImageObservation, VideoObservation } from "./types";

function pickSampleTimes(duration: number): number[] {
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
): string {
  if (!frames.length) return "No frames sampled.";
  const first = frames[0];
  const last = frames[frames.length - 1];
  const brightShift = last.brightness.mean - first.brightness.mean;
  const edgeShift = last.edgeDensity - first.edgeDensity;
  return [
    `Sequence across ${durationSec}s with ${frames.length} distinct samples.`,
    `Brightness trend: ${brightShift > 12 ? "brightening" : brightShift < -12 ? "darkening" : "stable"} (${first.brightness.mean.toFixed(0)} → ${last.brightness.mean.toFixed(0)}).`,
    `Structure trend: ${edgeShift > 0.08 ? "more detail appears" : edgeShift < -0.08 ? "simplifies" : "similar complexity"}.`,
    `Sample times (s): ${times.join(", ")}.`,
  ].join(" ");
}

export async function observeVideoFile(
  file: File,
  signal?: AbortSignal,
): Promise<VideoObservation> {
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
    const times = pickSampleTimes(duration);
    const rawFrames: ImageObservation[] = [];
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
      rawFrames.push(
        observeImageData(ctx.getImageData(0, 0, w, h), {
          fileName: `${file.name} @ ${t.toFixed(2)}s`,
          fileBytes: null,
          mimeType: "image/frame",
          sourceWidth: vw,
          sourceHeight: vh,
        }),
      );
    }
    const { frames, times: keptTimes } = dedupeFrames(rawFrames, times);
    const sequenceSummary = summarizeSequence(frames, keptTimes, duration);
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
        `Sampled ${rawFrames.length} frames, kept ${frames.length} after scene dedupe across ${duration.toFixed(1)}s (bounded, local).`,
      ],
      uncertainty: [
        "Audio is not transcribed.",
        "Motion and object tracking are not performed — only sparse frame observations.",
        "Scene boundaries are brightness/edge heuristics, not ML shot detection.",
      ],
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export function videoObservationToPromptBlock(obs: VideoObservation): string {
  const frames = obs.frames
    .slice(0, 6)
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
    "FRAME OBSERVATIONS:",
    frames,
  ]
    .filter(Boolean)
    .join("\n");
  return wrapUntrustedData("local-video-observation", body);
}
