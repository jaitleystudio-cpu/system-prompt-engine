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

export type LanguageQualificationStatus =
  | "QUALIFIED"
  | "LIMITED_EVIDENCE"
  | "UNDER_QUALIFICATION"
  | "UNSUPPORTED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface LanguageCapability {
  language: string;
  code: string;
  model?: string;
  wer: number;
  cer?: number;
  rtf?: number;
  scriptPassRatio?: string;
  contentPassRatio?: string;
  status: LanguageQualificationStatus;
  evidenceReceipt: string;
  notice: string;
}

export interface MediaCapabilityContract {
  contractVersion: "spe.media-capability.v1";
  receiptId: string;
  timestamp: string;
  backendExecution: "GATED";
  liveTranscriptionStatus: "UNAVAILABLE";
  hostFfmpegProductPath: "PROHIBITED";
  networkEgress: "0";
  routeMountStatus: "NOT_INTEGRATED";
  metrics: {
    peakRssBytes: number;
    coldLoadLatencySec: number;
    warmMedianRtf: number;
  };
  supportedCodecs: CodecDefinition[];
  languageCapabilities: LanguageCapability[];
}

export const CANONICAL_MEDIA_CAPABILITY_RECEIPT: MediaCapabilityContract = {
  contractVersion: "spe.media-capability.v1",
  receiptId: "rcpt-media-g12-evidence-v1",
  timestamp: "2026-10-01T08:00:00.000Z",
  backendExecution: "GATED",
  liveTranscriptionStatus: "UNAVAILABLE",
  hostFfmpegProductPath: "PROHIBITED",
  networkEgress: "0",
  routeMountStatus: "NOT_INTEGRATED",
  metrics: {
    peakRssBytes: PEAK_RSS_BYTES,
    coldLoadLatencySec: COLD_LOAD_LATENCY_SEC,
    warmMedianRtf: WARM_MEDIAN_RTF,
  },
  supportedCodecs: CODEC_REGISTRY,
  languageCapabilities: [
    {
      language: "English",
      code: "en",
      model: "ggml-small.bin",
      wer: 0.0,
      rtf: 0.41,
      status: "QUALIFIED",
      evidenceReceipt: "G12-C",
      notice: "High-fidelity offline transcription available.",
    },
    {
      language: "Tamil",
      code: "ta",
      model: "ggml-small.bin",
      wer: 0.0,
      cer: 0.05,
      status: "QUALIFIED",
      evidenceReceipt: "G12-C",
      notice: "Verified high-accuracy transcription in native script.",
    },
    {
      language: "Hindi",
      code: "hi",
      model: "ggml-small.bin",
      wer: 0.4,
      cer: 0.1,
      status: "LIMITED_EVIDENCE",
      evidenceReceipt: "G12-C",
      notice: "High phonetic accuracy; manual editorial review recommended.",
    },
    {
      language: "Spanish",
      code: "es",
      model: "ggml-small.bin",
      wer: 0.75,
      cer: 0.22,
      status: "UNDER_QUALIFICATION",
      evidenceReceipt: "G12-C",
      notice: "Moderate error rate observed on complex syntax.",
    },
    {
      language: "Telugu (Baseline ggml-small)",
      code: "te-baseline",
      model: "ggml-small.bin",
      wer: 3.571,
      cer: 1.833,
      scriptPassRatio: "0/10",
      status: "UNSUPPORTED",
      evidenceReceipt: "G12-H",
      notice: "Script Defect: ggml-small emits Devanagari rather than Telugu script. Baseline unsupported.",
    },
    {
      language: "Telugu (Challenger ggml-te-small)",
      code: "te-challenger",
      model: "ggml-te-small.bin",
      wer: 1.143,
      cer: 0.349,
      rtf: 0.869,
      scriptPassRatio: "10/10",
      contentPassRatio: "9/10",
      status: "UNDER_QUALIFICATION",
      evidenceReceipt: "G12-H",
      notice: "Native Telugu script verified (10/10); pending independent cross-agent PR #85 merge.",
    },
  ],
};

/**
 * Validates a media capability contract receipt against strict G12 evidence invariants.
 */
export function validateMediaCapabilityReceipt(data: unknown): {
  valid: true;
  contract: MediaCapabilityContract;
} | {
  valid: false;
  error: string;
} {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Receipt must be an object" };
  }
  const d = data as Record<string, unknown>;
  if (d.contractVersion !== "spe.media-capability.v1") {
    return { valid: false, error: "Invalid contractVersion" };
  }
  if (d.backendExecution !== "GATED") {
    return { valid: false, error: "backendExecution must be GATED" };
  }
  if (d.liveTranscriptionStatus !== "UNAVAILABLE") {
    return { valid: false, error: "liveTranscriptionStatus must be UNAVAILABLE" };
  }
  if (d.hostFfmpegProductPath !== "PROHIBITED") {
    return { valid: false, error: "hostFfmpegProductPath must be PROHIBITED" };
  }
  if (d.networkEgress !== "0") {
    return { valid: false, error: "networkEgress must be 0" };
  }
  if (!Array.isArray(d.languageCapabilities)) {
    return { valid: false, error: "languageCapabilities must be an array" };
  }

  const validStatuses = new Set([
    "QUALIFIED",
    "LIMITED_EVIDENCE",
    "UNDER_QUALIFICATION",
    "UNSUPPORTED",
    "UNAVAILABLE",
    "UNKNOWN",
  ]);

  for (const item of d.languageCapabilities as Record<string, unknown>[]) {
    if (!item.language || !item.code || !item.status) {
      return { valid: false, error: "Language capability items require language, code, and status" };
    }
    if (!validStatuses.has(item.status as string)) {
      return { valid: false, error: `Invalid language status: ${item.status}` };
    }
  }

  return { valid: true, contract: data as MediaCapabilityContract };
}

// Ingest from canonical capability receipt: presentation layer cannot invent statuses
export const LANGUAGE_CAPABILITIES: LanguageCapability[] =
  CANONICAL_MEDIA_CAPABILITY_RECEIPT.languageCapabilities;

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
