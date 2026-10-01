/**
 * Lane A10: Media UX Capability Model & Constants
 * Strictly maps to A10_MEDIA_CAPABILITY_UX_PREFLIGHT.md and G12-C backend qualification.
 *
 * Mandatory Invariants:
 * - LIVE_TRANSCRIPTION_STATUS = UNAVAILABLE
 * - BACKEND_EXECUTION = GATED
 * - HOST_FFMPEG_PRODUCT_PATH = PROHIBITED
 * - NETWORK_EGRESS = 0
 * - ROUTE_MOUNT_STATUS = NOT_INTEGRATED
 */

export const LIVE_TRANSCRIPTION_STATUS = "UNAVAILABLE" as const;
export const BACKEND_EXECUTION = "GATED" as const;
export const HOST_FFMPEG_PRODUCT_PATH = "PROHIBITED" as const;
export const NETWORK_EGRESS = "0" as const;
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
export const PRODUCT_INTEGRATED = false as const;

export const PEAK_RSS_BYTES = 826294272; // ~788 MiB
export const COLD_LOAD_LATENCY_SEC = 3.81;
export const WARM_MEDIAN_RTF = 3.23;

export type CodecStatus = "ACCEPTED" | "REJECTED";

export interface CodecDefinition {
  format: string;
  mimeTypes: string[];
  extensions: string[];
  decoderEngine: string;
  status: CodecStatus;
  feedback: string;
}

export const CODEC_REGISTRY: CodecDefinition[] = [
  {
    format: "WAV / PCM",
    mimeTypes: ["audio/wav", "audio/x-wav"],
    extensions: [".wav"],
    decoderEngine: "Symphonia / PCM",
    status: "ACCEPTED",
    feedback: "WAV PCM audio ready for offline analysis.",
  },
  {
    format: "MP3",
    mimeTypes: ["audio/mpeg"],
    extensions: [".mp3"],
    decoderEngine: "Symphonia / MP3",
    status: "ACCEPTED",
    feedback: "MP3 audio ready for offline analysis.",
  },
  {
    format: "AAC / M4A",
    mimeTypes: ["audio/aac", "audio/mp4", "audio/x-m4a"],
    extensions: [".aac", ".m4a"],
    decoderEngine: "Symphonia / AAC",
    status: "ACCEPTED",
    feedback: "AAC/M4A audio ready for offline analysis.",
  },
  {
    format: "FLAC",
    mimeTypes: ["audio/flac"],
    extensions: [".flac"],
    decoderEngine: "Symphonia / FLAC",
    status: "ACCEPTED",
    feedback: "Lossless FLAC audio ready for offline analysis.",
  },
  {
    format: "OGG / Vorbis",
    mimeTypes: ["audio/ogg"],
    extensions: [".ogg"],
    decoderEngine: "Symphonia / Vorbis",
    status: "ACCEPTED",
    feedback: "Ogg Vorbis audio ready for offline analysis.",
  },
  {
    format: "ALAC",
    mimeTypes: ["audio/alac"],
    extensions: [".caf"],
    decoderEngine: "Symphonia / ALAC",
    status: "ACCEPTED",
    feedback: "Apple Lossless audio ready for offline analysis.",
  },
  {
    format: "MKV / WebM",
    mimeTypes: ["video/webm", "video/x-matroska"],
    extensions: [".webm", ".mkv"],
    decoderEngine: "Symphonia / MKV",
    status: "ACCEPTED",
    feedback: "Video container audio track accepted.",
  },
  {
    format: "Opus",
    mimeTypes: ["audio/opus"],
    extensions: [".opus"],
    decoderEngine: "Symphonia (Unsupported)",
    status: "REJECTED",
    feedback: "Opus codec is unsupported in offline mode. Please provide PCM, MP3, or AAC.",
  },
  {
    format: "AC-3 / E-AC-3",
    mimeTypes: ["audio/ac3", "audio/eac3"],
    extensions: [".ac3", ".eac3"],
    decoderEngine: "Symphonia (Unsupported)",
    status: "REJECTED",
    feedback: "Dolby AC-3 audio is unsupported. Please convert to stereo PCM or AAC.",
  },
  {
    format: "DTS",
    mimeTypes: ["audio/vnd.dts"],
    extensions: [".dts"],
    decoderEngine: "Symphonia (Unsupported)",
    status: "REJECTED",
    feedback: "DTS audio is unsupported. Please provide standard PCM or MP3.",
  },
];

export type LanguageQualificationStatus = "QUALIFIED" | "BETA" | "EXPERIMENTAL" | "GATED";

export interface LanguageCapability {
  language: string;
  code: string;
  wer: number;
  cer?: number;
  rtf?: number;
  status: LanguageQualificationStatus;
  notice: string;
}

export const LANGUAGE_CAPABILITIES: LanguageCapability[] = [
  {
    language: "English",
    code: "en",
    wer: 0.0,
    rtf: 0.41,
    status: "QUALIFIED",
    notice: "High-fidelity offline transcription available.",
  },
  {
    language: "Tamil",
    code: "ta",
    wer: 0.0,
    cer: 0.05,
    status: "QUALIFIED",
    notice: "Verified high-accuracy transcription in native script.",
  },
  {
    language: "Hindi",
    code: "hi",
    wer: 0.4,
    cer: 0.1,
    status: "BETA",
    notice: "High phonetic accuracy; manual editorial review recommended.",
  },
  {
    language: "Spanish",
    code: "es",
    wer: 0.75,
    cer: 0.22,
    status: "EXPERIMENTAL",
    notice: "Moderate error rate observed on complex syntax.",
  },
  {
    language: "Telugu",
    code: "te",
    wer: 1.0,
    cer: 1.0,
    status: "GATED",
    notice: "Script Defect: ggml-small emits Devanagari rather than Telugu script. Language gated pending G12-F root-cause resolution.",
  },
];

export function inspectMediaFile(file: File): {
  accepted: boolean;
  format: string;
  feedback: string;
  decoderEngine: string;
} {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  for (const item of CODEC_REGISTRY) {
    const extMatch = item.extensions.some((ext) => fileName.endsWith(ext));
    const mimeMatch = item.mimeTypes.some((mime) => fileType.startsWith(mime));

    if (extMatch || mimeMatch) {
      return {
        accepted: item.status === "ACCEPTED",
        format: item.format,
        feedback: item.feedback,
        decoderEngine: item.decoderEngine,
      };
    }
  }

  return {
    accepted: false,
    format: "Unknown / Unsupported",
    feedback: "Unrecognized media format. Please upload standard WAV, MP3, AAC, or FLAC.",
    decoderEngine: "None",
  };
}
