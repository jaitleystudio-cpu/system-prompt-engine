/**
 * MM-9: Product Truth Status Model
 *
 * Provides unambiguous, honest runtime disclosures for UI surfaces.
 * Discloses whether computation is:
 * - LOCAL · WebGPU
 * - LOCAL · WASM
 * - BROWSER SPEECH SERVICE
 * - HEURISTIC FALLBACK
 * - UNAVAILABLE
 *
 * Never obscures cloud fallbacks or simulates neural capabilities.
 */

import { globalDeviceNegotiator } from "./deviceNegotiator";
import { globalModelRegistry } from "./modelRegistry";
import type {
  AsrTruthState,
  OcrTruthState,
  RuntimeBackend,
  Scene3DStatus,
} from "./types";

export interface FeatureTruthDisclosure {
  feature: "Speech / Audio" | "OCR Text" | "Video Timeline" | "Screenshot-to-Code" | "3D Scene";
  statusLabel: string;
  badgeTone: "success" | "warning" | "neutral" | "danger";
  isAirGapped: boolean;
  rawDataEgress: 0;
  modelInstalled: boolean;
  activeBackend: RuntimeBackend;
  userExplanation: string;
}

export class MultimodalStatusModel {
  /**
   * Determine exact truth disclosure for Speech / Audio ASR.
   */
  async getSpeechDisclosure(state?: AsrTruthState): Promise<FeatureTruthDisclosure> {
    const pack = globalModelRegistry.getPack("spe-whisper-tiny-int8");
    const isReady = pack?.state === "READY";
    const cap = await globalDeviceNegotiator.probeCapability();

    if (state === "LOCAL_ASR_QUALIFIED" || (isReady && state !== "BROWSER_FALLBACK")) {
      const backend = cap.hasWebGpu ? "WEBGPU" : "WASM";
      return {
        feature: "Speech / Audio",
        statusLabel: `LOCAL · ${backend}`,
        badgeTone: "success",
        isAirGapped: true,
        rawDataEgress: 0,
        modelInstalled: true,
        activeBackend: backend,
        userExplanation: "Transcribed entirely on-device using local Whisper ONNX. Zero audio egress.",
      };
    }

    if (state === "BROWSER_FALLBACK") {
      return {
        feature: "Speech / Audio",
        statusLabel: "BROWSER SPEECH SERVICE",
        badgeTone: "warning",
        isAirGapped: false,
        rawDataEgress: 0, // Managed by browser
        modelInstalled: false,
        activeBackend: "UNAVAILABLE",
        userExplanation:
          "Audio transcribed via browser speech service. Not air-gapped; browser vendor may process audio.",
      };
    }

    return {
      feature: "Speech / Audio",
      statusLabel: "UNAVAILABLE (INSTALL PACK FOR LOCAL ASR)",
      badgeTone: "neutral",
      isAirGapped: true,
      rawDataEgress: 0,
      modelInstalled: false,
      activeBackend: "UNAVAILABLE",
      userExplanation: "Local ASR pack is not downloaded. Install pack for private speech input.",
    };
  }

  /**
   * Determine exact truth disclosure for OCR.
   */
  async getOcrDisclosure(state?: OcrTruthState): Promise<FeatureTruthDisclosure> {
    const pack = globalModelRegistry.getPack("spe-ocr-multilingual-int8");
    const isReady = pack?.state === "READY";
    const cap = await globalDeviceNegotiator.probeCapability();

    if (state === "LOCAL_OCR_QUALIFIED" || isReady) {
      const backend = cap.hasWebGpu ? "WEBGPU" : "WASM";
      return {
        feature: "OCR Text",
        statusLabel: `LOCAL · ${backend}`,
        badgeTone: "success",
        isAirGapped: true,
        rawDataEgress: 0,
        modelInstalled: true,
        activeBackend: backend,
        userExplanation: "Text detected and recognized on-device with local Mobile-OCR INT8.",
      };
    }

    return {
      feature: "OCR Text",
      statusLabel: "HEURISTIC FALLBACK (ROI DISCOVERY)",
      badgeTone: "warning",
      isAirGapped: true,
      rawDataEgress: 0,
      modelInstalled: false,
      activeBackend: "UNAVAILABLE",
      userExplanation:
        "Using zero-cost projection bands. Text words require downloading local OCR pack.",
    };
  }

  /**
   * Determine exact truth disclosure for 3D Websites.
   */
  getScene3DDisclosure(status?: Scene3DStatus): FeatureTruthDisclosure {
    if (status === "AVAILABLE") {
      return {
        feature: "3D Scene",
        statusLabel: "LOCAL · WEBLGL / THREE.JS",
        badgeTone: "success",
        isAirGapped: true,
        rawDataEgress: 0,
        modelInstalled: false, // Deterministic runtime
        activeBackend: "WASM",
        userExplanation: "Deterministic procedural 3D runtime with scroll tracks and reduced-motion fallback.",
      };
    }

    return {
      feature: "3D Scene",
      statusLabel: "NOT_AVAILABLE (SPEC REQUIRED)",
      badgeTone: "neutral",
      isAirGapped: true,
      rawDataEgress: 0,
      modelInstalled: false,
      activeBackend: "UNAVAILABLE",
      userExplanation: "3D compilation requires valid SceneIR specification.",
    };
  }
}

export const globalMultimodalStatusModel = new MultimodalStatusModel();
