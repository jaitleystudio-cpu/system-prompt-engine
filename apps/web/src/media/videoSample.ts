import { observeImageData, observationToPromptBlock } from "./imageObserve";
import type { ImageObservation, VideoObservation } from "./types";

const MAX_SAMPLES = 8;
const MAX_SIDE = 960;

function pickSampleTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const n = Math.min(MAX_SAMPLES, Math.max(3, Math.ceil(duration / 4)));
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * duration;
    return Math.min(duration - 0.05, Math.max(0, t));
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek in this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

export async function observeVideoFile(file: File): Promise<VideoObservation> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not decode this video."));
    });
    const duration = video.duration;
    const times = pickSampleTimes(duration);
    const frames: ImageObservation[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    for (const t of times) {
      await seek(video, t);
      const scale = Math.min(
        1,
        MAX_SIDE / Math.max(video.videoWidth || 1, video.videoHeight || 1),
      );
      const w = Math.max(1, Math.round((video.videoWidth || 1) * scale));
      const h = Math.max(1, Math.round((video.videoHeight || 1) * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      frames.push(
        observeImageData(ctx.getImageData(0, 0, w, h), {
          fileName: `${file.name} @ ${t.toFixed(2)}s`,
          fileBytes: null,
          mimeType: "image/frame",
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
      sampleTimesSec: times.map((t) => Math.round(t * 100) / 100),
      frames,
      notes: [
        `Sampled ${frames.length} frames across ${duration.toFixed(1)}s (bounded, local).`,
      ],
      uncertainty: [
        "Audio is not transcribed.",
        "Motion and object tracking are not performed — only sparse frame observations.",
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
    .map(
      (f, i) =>
        `Frame ${i + 1} @ ${obs.sampleTimesSec[i]}s\n${observationToPromptBlock(f)}`,
    )
    .join("\n\n");
  return [
    "Video observations (browser-local bounded sampling):",
    `- File: ${obs.fileName ?? "video"} (${obs.width}×${obs.height}, ${obs.durationSec}s)`,
    obs.fileBytes != null ? `- Bytes: ${obs.fileBytes}` : null,
    `- Sample times (s): ${obs.sampleTimesSec.join(", ")}`,
    `- Notes: ${obs.notes.join(" ")}`,
    `- Uncertainty: ${obs.uncertainty.join(" ")}`,
    "",
    frames,
  ]
    .filter(Boolean)
    .join("\n");
}
