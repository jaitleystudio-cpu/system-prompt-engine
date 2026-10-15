/**
 * SPE Ω — Adaptive Display Quality & HDR Management Engine
 * Provides client-side display capability adaptation across 5 profiles:
 * - ESSENTIAL: Reduced motion, low contrast, or minimal battery profile.
 * - STANDARD: Calibrated sRGB baseline with clean typography.
 * - WIDE_COLOR: Enriched Display P3 wide-gamut fidelity.
 * - HDR: Controlled high-dynamic-range highlights with HDR Content Harmony.
 * - IMMERSIVE: Hardware-accelerated WebGPU/WebGL ambient depth & real-time compute.
 *
 * Implements user comfort overrides (AUTOMATIC, BALANCED, ENHANCED, SDR)
 * and progressive SDR fallback with zero external network egress.
 */

export type DisplayProfile =
  | "ESSENTIAL"
  | "STANDARD"
  | "WIDE_COLOR"
  | "HDR"
  | "IMMERSIVE";

export type UserComfortMode =
  | "AUTOMATIC"
  | "BALANCED"
  | "ENHANCED"
  | "SDR";

export interface DisplayCapabilities {
  supportsHdr: boolean;
  supportsWideColorP3: boolean;
  supportsWebGpu: boolean;
  prefersReducedMotion: boolean;
  colorDepth: number;
  devicePixelRatio: number;
}

export interface DisplayState {
  capabilities: DisplayCapabilities;
  comfortMode: UserComfortMode;
  effectiveProfile: DisplayProfile;
  hdrHeadroom: number;
  isP3Active: boolean;
  timestamp: number;
}

const STORAGE_KEY = "spe:display_comfort_preference";

type DisplayChangeListener = (state: DisplayState) => void;
const listeners = new Set<DisplayChangeListener>();

/**
 * Detect client hardware and display media query capabilities safely in browser or SSR.
 */
export function detectDisplayCapabilities(): DisplayCapabilities {
  if (typeof window === "undefined") {
    return {
      supportsHdr: false,
      supportsWideColorP3: false,
      supportsWebGpu: false,
      prefersReducedMotion: false,
      colorDepth: 24,
      devicePixelRatio: 1,
    };
  }

  const supportsHdr =
    window.matchMedia &&
    (window.matchMedia("(dynamic-range: high)").matches ||
      window.matchMedia("(video-dynamic-range: high)").matches);

  const supportsWideColorP3 =
    window.matchMedia &&
    (window.matchMedia("(color-gamut: p3)").matches ||
      window.matchMedia("(color-gamut: rec2020)").matches);

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const supportsWebGpu =
    typeof navigator !== "undefined" &&
    Boolean((navigator as unknown as { gpu?: unknown }).gpu);

  const colorDepth =
    typeof window.screen !== "undefined" ? window.screen.colorDepth || 24 : 24;

  const devicePixelRatio =
    typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;

  return {
    supportsHdr: Boolean(supportsHdr),
    supportsWideColorP3: Boolean(supportsWideColorP3),
    supportsWebGpu,
    prefersReducedMotion: Boolean(prefersReducedMotion),
    colorDepth,
    devicePixelRatio,
  };
}

/**
 * Resolve the effective active display profile given physical capabilities and user comfort mode.
 */
export function resolveEffectiveProfile(
  caps: DisplayCapabilities,
  comfort: UserComfortMode,
): DisplayProfile {
  // If user explicitly asks for SDR or system asks for reduced motion, fallback progressively
  if (comfort === "SDR") {
    return caps.prefersReducedMotion ? "ESSENTIAL" : "STANDARD";
  }

  if (caps.prefersReducedMotion) {
    return "ESSENTIAL";
  }

  if (comfort === "BALANCED") {
    // Balanced caps at WIDE_COLOR even if HDR is physically available, keeping highlights smooth
    if (caps.supportsWideColorP3) return "WIDE_COLOR";
    return "STANDARD";
  }

  // AUTOMATIC or ENHANCED:
  if (caps.supportsHdr && (comfort === "ENHANCED" || comfort === "AUTOMATIC")) {
    if (caps.supportsWebGpu) return "IMMERSIVE";
    return "HDR";
  }

  if (caps.supportsWideColorP3) {
    if (caps.supportsWebGpu && comfort === "ENHANCED") return "IMMERSIVE";
    return "WIDE_COLOR";
  }

  if (caps.supportsWebGpu && comfort === "ENHANCED") {
    return "IMMERSIVE";
  }

  return "STANDARD";
}

/**
 * Get stored user comfort mode or default to AUTOMATIC.
 */
export function getStoredComfortMode(): UserComfortMode {
  if (typeof window === "undefined" || !window.localStorage) {
    return "AUTOMATIC";
  }
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (val === "AUTOMATIC" || val === "BALANCED" || val === "ENHANCED" || val === "SDR") {
      return val;
    }
  } catch {
    // Ignore storage restrictions
  }
  return "AUTOMATIC";
}

/**
 * Store user comfort mode and trigger re-adaptation.
 */
export function setStoredComfortMode(mode: UserComfortMode): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage restrictions
    }
  }
  applyAdaptiveDisplay();
}

/**
 * Computes the complete current display state snapshot.
 */
export function getCurrentDisplayState(): DisplayState {
  const capabilities = detectDisplayCapabilities();
  const comfortMode = getStoredComfortMode();
  const effectiveProfile = resolveEffectiveProfile(capabilities, comfortMode);

  // HDR Content Harmony: headroom is elevated strictly for HDR highlights, not for body text
  let hdrHeadroom = 1.0;
  if (effectiveProfile === "HDR" || effectiveProfile === "IMMERSIVE") {
    hdrHeadroom = comfortMode === "ENHANCED" ? 1.6 : 1.35;
  }

  const isP3Active =
    (effectiveProfile === "WIDE_COLOR" ||
      effectiveProfile === "HDR" ||
      effectiveProfile === "IMMERSIVE") &&
    comfortMode !== "SDR";

  return {
    capabilities,
    comfortMode,
    effectiveProfile,
    hdrHeadroom,
    isP3Active,
    timestamp: Date.now(),
  };
}

/**
 * Apply display profile and comfort mode datasets to document root element.
 */
export function applyAdaptiveDisplay(): DisplayState {
  const state = getCurrentDisplayState();

  if (typeof document !== "undefined" && document.documentElement) {
    const root = document.documentElement;
    root.dataset.displayProfile = state.effectiveProfile.toLowerCase();
    root.dataset.comfortMode = state.comfortMode.toLowerCase();
    root.style.setProperty("--spe-hdr-headroom", state.hdrHeadroom.toFixed(2));
  }

  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.warn("SPE AdaptiveDisplay listener error:", err);
    }
  }

  return state;
}

/**
 * Subscribe to display state updates (media query changes or user preference changes).
 */
export function subscribeToDisplayChanges(listener: DisplayChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Initialize automatic listeners on window matchMedia queries.
 */
export function initAdaptiveDisplayListeners(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQueries = [
    "(dynamic-range: high)",
    "(color-gamut: p3)",
    "(prefers-reduced-motion: reduce)",
  ].map((q) => window.matchMedia(q));

  const handler = () => {
    applyAdaptiveDisplay();
  };

  for (const mq of mediaQueries) {
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else if ((mq as unknown as { addListener?: (h: () => void) => void }).addListener) {
      (mq as unknown as { addListener: (h: () => void) => void }).addListener(handler);
    }
  }

  // Initial application
  applyAdaptiveDisplay();

  return () => {
    for (const mq of mediaQueries) {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else if ((mq as unknown as { removeListener?: (h: () => void) => void }).removeListener) {
        (mq as unknown as { removeListener: (h: () => void) => void }).removeListener(handler);
      }
    }
  };
}
