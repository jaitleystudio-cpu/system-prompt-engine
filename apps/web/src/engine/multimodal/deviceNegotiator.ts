/**
 * MM-7 & MM-8: Device & Browser Capability Negotiator
 *
 * Probes browser capabilities (WebGPU, WASM SIMD, multithreading, memory),
 * maintains qualification matrix, and decides safe execution routing:
 * WebGPU → WASM → Deterministic Fallback → Explicit UNAVAILABLE.
 *
 * INVARIANTS:
 * - Chrome PASS != Safari PASS
 * - WebGPU PASS != WASM PASS
 * - Desktop PASS != Mobile PASS
 * - Never fabricate capability.
 */

import type { DeviceCapability, RuntimeBackend } from "./types";

export type QualificationStatus =
  | "QUALIFIED"
  | "DEGRADED"
  | "FALLBACK"
  | "UNAVAILABLE"
  | "UNTESTED";

export interface BrowserDeviceQualification {
  environmentId: string;
  browser: "chrome" | "firefox" | "safari" | "edge" | "other";
  os: "macos" | "windows" | "linux" | "android" | "ios" | "other";
  webGpuStatus: QualificationStatus;
  wasmStatus: QualificationStatus;
  notes: string;
}

/**
 * Historical and tested browser/device qualification matrix.
 */
export const BROWSER_QUALIFICATION_MATRIX: BrowserDeviceQualification[] = [
  {
    environmentId: "chrome-macos",
    browser: "chrome",
    os: "macos",
    webGpuStatus: "QUALIFIED",
    wasmStatus: "QUALIFIED",
    notes: "Metal-backed WebGPU, SIMD-enabled WASM",
  },
  {
    environmentId: "chrome-windows",
    browser: "chrome",
    os: "windows",
    webGpuStatus: "QUALIFIED",
    wasmStatus: "QUALIFIED",
    notes: "Direct3D 12 WebGPU, full SIMD",
  },
  {
    environmentId: "chrome-android",
    browser: "chrome",
    os: "android",
    webGpuStatus: "DEGRADED",
    wasmStatus: "QUALIFIED",
    notes: "Vulkan WebGPU variability; WASM preferred for thermal budget",
  },
  {
    environmentId: "edge-windows",
    browser: "edge",
    os: "windows",
    webGpuStatus: "QUALIFIED",
    wasmStatus: "QUALIFIED",
    notes: "Chromium base matches Chrome Windows",
  },
  {
    environmentId: "firefox-desktop",
    browser: "firefox",
    os: "macos",
    webGpuStatus: "FALLBACK",
    wasmStatus: "QUALIFIED",
    notes: "WebGPU behind pref flag on some versions; WASM fully qualified",
  },
  {
    environmentId: "safari-macos",
    browser: "safari",
    os: "macos",
    webGpuStatus: "DEGRADED",
    wasmStatus: "QUALIFIED",
    notes: "Safari 18+ WebGPU enabled; buffer alignment constraints exist",
  },
  {
    environmentId: "safari-ios",
    browser: "safari",
    os: "ios",
    webGpuStatus: "DEGRADED",
    wasmStatus: "DEGRADED",
    notes: "Strict iOS memory limits; quantized INT8 models required",
  },
];

export class DeviceNegotiator {
  private cachedCapability: DeviceCapability | null = null;
  private deviceLostHandlers: Array<() => void> = [];

  /**
   * Probe device runtime capabilities.
   */
  async probeCapability(): Promise<DeviceCapability> {
    if (this.cachedCapability) return this.cachedCapability;

    // Detect browser & OS
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    let browser: DeviceCapability["browserFamily"] = "other";
    if (ua.includes("edg/")) browser = "edge";
    else if (ua.includes("chrome") && !ua.includes("edg/")) browser = "chrome";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "safari";
    else if (ua.includes("firefox")) browser = "firefox";

    let os: DeviceCapability["osFamily"] = "other";
    if (ua.includes("mac os") || ua.includes("macintosh")) os = "macos";
    else if (ua.includes("windows")) os = "windows";
    else if (ua.includes("android")) os = "android";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "ios";
    else if (ua.includes("linux")) os = "linux";

    const isMobile = os === "android" || os === "ios" || ua.includes("mobile");

    // Probe WebGPU
    let hasWebGpu = false;
    let adapterInfo: string | undefined = undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navGpu = (navigator as any)?.gpu;
      if (navGpu && typeof navGpu.requestAdapter === "function") {
        const adapter = await navGpu.requestAdapter();
        if (adapter) {
          hasWebGpu = true;
          if (typeof adapter.requestAdapterInfo === "function") {
            const info = await adapter.requestAdapterInfo();
            adapterInfo = `${info.vendor || "generic"} ${info.architecture || ""} ${info.device || ""}`.trim();
          }
        }
      }
    } catch {
      hasWebGpu = false;
    }

    // Probe WASM SIMD support (16-byte fixed vector instruction)
    let hasWasmSimd = false;
    try {
      hasWasmSimd = WebAssembly.validate(
        new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60,
          0x00, 0x01, 0x7b, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
          0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0b,
        ]),
      );
    } catch {
      hasWasmSimd = false;
    }

    // Hardware concurrency & memory
    const hardwareConcurrency = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deviceMemoryGb = typeof navigator !== "undefined" ? (navigator as any).deviceMemory : undefined;

    this.cachedCapability = {
      hasWebGpu,
      webGpuAdapterInfo: adapterInfo,
      hasWasmSimd,
      hasWasmThreads: typeof SharedArrayBuffer !== "undefined",
      deviceMemoryGb,
      hardwareConcurrency,
      isMobile,
      browserFamily: browser,
      osFamily: os,
    };

    return this.cachedCapability;
  }

  /**
   * Determine the optimal qualified backend for a specific task.
   */
  async resolveBackend(
    _task: "asr" | "ocr" | "ui-segment" | "3d",
    requested?: RuntimeBackend,
  ): Promise<RuntimeBackend> {
    const cap = await this.probeCapability();

    // If caller specifically requested an available backend, verify it
    if (requested === "WEBGPU" && cap.hasWebGpu) {
      return "WEBGPU";
    }
    if (requested === "WASM" && (cap.hasWasmSimd || !cap.isMobile)) {
      return "WASM";
    }

    // Default priority order: WebGPU -> WASM -> UNAVAILABLE
    if (cap.hasWebGpu && !cap.isMobile) {
      return "WEBGPU";
    }
    if (cap.hasWasmSimd || cap.hardwareConcurrency >= 2) {
      return "WASM";
    }

    return "UNAVAILABLE";
  }

  /**
   * Check qualification record for current environment.
   */
  async getQualificationRecord(): Promise<BrowserDeviceQualification> {
    const cap = await this.probeCapability();
    const match = BROWSER_QUALIFICATION_MATRIX.find(
      (m) => m.browser === cap.browserFamily && m.os === cap.osFamily,
    );
    if (match) return match;

    return {
      environmentId: `${cap.browserFamily}-${cap.osFamily}`,
      browser: cap.browserFamily,
      os: cap.osFamily,
      webGpuStatus: cap.hasWebGpu ? "QUALIFIED" : "UNAVAILABLE",
      wasmStatus: cap.hasWasmSimd ? "QUALIFIED" : "DEGRADED",
      notes: "Dynamically evaluated device environment",
    };
  }

  /**
   * Register a callback when WebGPU device is lost so inference can fall back to WASM seamlessly.
   */
  onDeviceLost(handler: () => void): () => void {
    this.deviceLostHandlers.push(handler);
    return () => {
      this.deviceLostHandlers = this.deviceLostHandlers.filter((h) => h !== handler);
    };
  }

  triggerDeviceLost(): void {
    if (this.cachedCapability) {
      this.cachedCapability.hasWebGpu = false;
    }
    for (const handler of this.deviceLostHandlers) {
      try {
        handler();
      } catch {
        /* ignore error in listener */
      }
    }
  }

  /**
   * Qualifies a browser/OS environment against strict criteria.
   * If a browser/OS combination lacks required hardware or SIMD capabilities,
   * it cannot be falsely marked QUALIFIED.
   */
  qualifyBrowserEnvironment(env: {
    browser: "chrome" | "firefox" | "safari" | "edge" | "other";
    os: "macos" | "windows" | "linux" | "android" | "ios" | "other";
    hasWebGpu?: boolean;
    hasWasmSimd?: boolean;
  }): QualificationStatus {
    if (env.browser === "other" || (!env.hasWebGpu && !env.hasWasmSimd)) {
      return "UNAVAILABLE";
    }
    const match = BROWSER_QUALIFICATION_MATRIX.find(
      (m) => m.browser === env.browser && m.os === env.os,
    );
    if (!match) {
      return env.hasWasmSimd ? "FALLBACK" : "UNAVAILABLE";
    }
    if (match.wasmStatus === "DEGRADED" || match.webGpuStatus === "DEGRADED") {
      return "DEGRADED";
    }
    return match.wasmStatus === "QUALIFIED" ? "QUALIFIED" : "FALLBACK";
  }
}

export const globalDeviceNegotiator = new DeviceNegotiator();
