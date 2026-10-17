import { useState, useEffect, useCallback, type CSSProperties } from "react";
import type { AppView } from "../routing";
import type { TargetId } from "@spe/web-runtime";
import "../landing/hero-platform-rotator.css";

export type PlatformCategory = "assistant" | "model" | "coding_tool";

export interface HeroRotatorPlatform {
  id: string;
  displayName: string;
  country: string;
  countryCode: string;
  countryFlag: string;
  brandColor: string;
  provider: string;
  category: PlatformCategory;
  categoryLabel: string;
  dialectKey: string;
  studioTargetId: TargetId | null;
  isDirectStudioTarget: boolean;
  description: string;
}

/**
 * Authoritative registry of approved hero rotating platforms.
 * Highlights the world's top AI models and coding agents across countries with their official brand colors.
 * Distinguishes models, assistants, and coding applications internally.
 * Preserves strict platform correctness: does not invent compatibility or false equivalences.
 */
export const HERO_ROTATOR_PLATFORMS: readonly HeroRotatorPlatform[] = [
  {
    id: "chatgpt",
    displayName: "CHATGPT",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#10A37F",
    provider: "OpenAI",
    category: "assistant",
    categoryLabel: "Assistant",
    dialectKey: "openai-markdown",
    studioTargetId: "chatgpt",
    isDirectStudioTarget: true,
    description: "Frontier multimodal reasoning & general intelligence assistant",
  },
  {
    id: "gemini",
    displayName: "GEMINI",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#4E89FF",
    provider: "Google DeepMind",
    category: "assistant",
    categoryLabel: "Multimodal",
    dialectKey: "gemini-agent",
    studioTargetId: "gemini",
    isDirectStudioTarget: true,
    description: "Multimodal frontier assistant & grounding directives",
  },
  {
    id: "claude",
    displayName: "CLAUDE",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#CC785C",
    provider: "Anthropic",
    category: "assistant",
    categoryLabel: "Reasoning",
    dialectKey: "claude-xml",
    studioTargetId: "claude",
    isDirectStudioTarget: true,
    description: "Deep analytical synthesis & strict XML tag boundaries",
  },
  {
    id: "mistral",
    displayName: "MISTRAL",
    country: "France",
    countryCode: "FR",
    countryFlag: "🇫🇷",
    brandColor: "#FF7000",
    provider: "Mistral AI",
    category: "model",
    categoryLabel: "Open Frontier",
    dialectKey: "open-weights",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "European frontier reasoning & high-efficiency open models",
  },
  {
    id: "deepseek",
    displayName: "DEEPSEEK",
    country: "China",
    countryCode: "CN",
    countryFlag: "🇨🇳",
    brandColor: "#4D6BFE",
    provider: "DeepSeek",
    category: "model",
    categoryLabel: "Open MoE",
    dialectKey: "open-weights",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Open-weights chain-of-thought MoE reasoning model",
  },
  {
    id: "sarvam",
    displayName: "SARVAM",
    country: "India",
    countryCode: "IN",
    countryFlag: "🇮🇳",
    brandColor: "#FF9933",
    provider: "Sarvam AI",
    category: "model",
    categoryLabel: "Indic Sovereign",
    dialectKey: "open-weights",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "India sovereign multilingual 10+ Indic language model",
  },
  {
    id: "qwen",
    displayName: "QWEN",
    country: "China",
    countryCode: "CN",
    countryFlag: "🇨🇳",
    brandColor: "#615CED",
    provider: "Alibaba Cloud",
    category: "model",
    categoryLabel: "Code & Vision",
    dialectKey: "open-weights",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Frontier multilingual code & agentic reasoning model",
  },
  {
    id: "kimi",
    displayName: "KIMI",
    country: "China",
    countryCode: "CN",
    countryFlag: "🇨🇳",
    brandColor: "#0066FF",
    provider: "Moonshot AI",
    category: "model",
    categoryLabel: "2M Context",
    dialectKey: "kimi",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Moonshot AI ultra-long context reasoning model with anchor directives",
  },
  {
    id: "grok",
    displayName: "GROK",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#E5E7EB",
    provider: "xAI",
    category: "assistant",
    categoryLabel: "Realtime",
    dialectKey: "grok",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Real-time search & mathematical reasoning assistant",
  },
  {
    id: "falcon",
    displayName: "FALCON",
    country: "United Arab Emirates",
    countryCode: "AE",
    countryFlag: "🇦🇪",
    brandColor: "#C99700",
    provider: "TII UAE",
    category: "model",
    categoryLabel: "Open Sovereign",
    dialectKey: "open-weights",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "UAE sovereign open-source frontier foundation model",
  },
  {
    id: "llama",
    displayName: "LLAMA",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#0668E1",
    provider: "Meta",
    category: "model",
    categoryLabel: "Open Standard",
    dialectKey: "open-weights",
    studioTargetId: "local",
    isDirectStudioTarget: true,
    description: "Open-weights foundation model standard with [INST] directives",
  },
  {
    id: "claude-code",
    displayName: "CLAUDE CODE",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#E07A5F",
    provider: "Anthropic",
    category: "coding_tool",
    categoryLabel: "CLI Agent",
    dialectKey: "claude-code",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Autonomous terminal coding agent with CLAUDE.md guidelines",
  },
  {
    id: "copilot",
    displayName: "COPILOT",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#0078D4",
    provider: "Microsoft / GitHub",
    category: "assistant",
    categoryLabel: "Companion",
    dialectKey: "openai-markdown",
    studioTargetId: "copilot",
    isDirectStudioTarget: true,
    description: "Developer companion & workflow assistant",
  },
  {
    id: "perplexity",
    displayName: "PERPLEXITY",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#22B8CD",
    provider: "Perplexity AI",
    category: "assistant",
    categoryLabel: "Search Engine",
    dialectKey: "openai-markdown",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "Conversational answer engine & live research synthesis",
  },
  {
    id: "cursor",
    displayName: "CURSOR",
    country: "United States",
    countryCode: "US",
    countryFlag: "🇺🇸",
    brandColor: "#7C3AED",
    provider: "Anysphere",
    category: "coding_tool",
    categoryLabel: "AI Editor",
    dialectKey: "cursor-rules",
    studioTargetId: null,
    isDirectStudioTarget: false,
    description: "AI-native code editor with .cursor/rules enforcement",
  },
] as const;

export type RotatorMode = "static" | "decorative" | "interactive";

export interface HeroPlatformRotatorProps {
  onNavigate?: (view: AppView) => void;
  defaultMode?: RotatorMode;
  rotationIntervalMs?: number;
}

export function HeroPlatformRotator({
  onNavigate,
  defaultMode = "interactive",
  rotationIntervalMs = 4500,
}: HeroPlatformRotatorProps) {
  // Check URL query override for experiment testing (?rotator=static|decorative|interactive)
  const [mode] = useState<RotatorMode>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("rotator");
      if (param === "static" || param === "decorative" || param === "interactive") {
        return param;
      }
    }
    return defaultMode;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Monitor prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Monitor document visibility to pause timer when backgrounded
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      setIsPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Automated gentle rotation every 4.5 seconds
  useEffect(() => {
    if (mode === "static" || prefersReducedMotion || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_ROTATOR_PLATFORMS.length);
    }, rotationIntervalMs);

    return () => clearInterval(timer);
  }, [mode, prefersReducedMotion, isPaused, rotationIntervalMs]);

  const currentPlatform = HERO_ROTATOR_PLATFORMS[currentIndex];

  const handleSelect = useCallback(
    (platform: HeroRotatorPlatform) => {
      setSelectedPlatform(platform.id);

      // Record selection in session storage
      try {
        sessionStorage.setItem("spe_selected_hero_platform", platform.id);
        sessionStorage.setItem("spe_selected_hero_dialect", platform.dialectKey);
        if (platform.studioTargetId) {
          sessionStorage.setItem("spe_selected_hero_target", platform.studioTargetId);
        } else {
          sessionStorage.removeItem("spe_selected_hero_target");
        }
      } catch (e) {}

      // Dispatch custom event for App.tsx and Prompt Studio listeners
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("spe:target-platform-selected", {
            detail: {
              platformId: platform.id,
              displayName: platform.displayName,
              country: platform.country,
              countryCode: platform.countryCode,
              brandColor: platform.brandColor,
              studioTargetId: platform.studioTargetId,
              isDirectStudioTarget: platform.isDirectStudioTarget,
              dialectKey: platform.dialectKey,
              categoryLabel: platform.categoryLabel,
            },
          })
        );
      }

      // Smooth scroll to Prompt Studio or navigate to Create
      const studio = document.getElementById("prompt-studio");
      if (studio) {
        studio.scrollIntoView({ behavior: "smooth" });
        const input = document.getElementById("spe-one-line");
        if (input) {
          setTimeout(() => input.focus(), 400);
        }
      } else if (onNavigate) {
        onNavigate("create");
      }
    },
    [onNavigate]
  );

  // If reduced motion is active or static mode is forced, render original static label
  if (prefersReducedMotion || mode === "static") {
    return (
      <p className="eyebrow spe-hero-rotator spe-hero-rotator--static">
        A CLEAR START FOR ANY AI
      </p>
    );
  }

  return (
    <p
      className="eyebrow spe-hero-rotator"
      role="region"
      aria-label="Supported Global AI Platforms"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Screen reader static announcement */}
      <span className="visually-hidden">
        A clear start for any AI across nations: ChatGPT, Gemini, Claude, Mistral, DeepSeek, Sarvam, Qwen, Kimi, Grok, Falcon, Llama, Copilot, Claude Code, and Cursor.
      </span>

      {/* Visual content - NOT hidden with aria-hidden so button is accessible */}
      <span className="spe-rotator-visual">
        <span className="spe-rotator-prefix">A CLEAR START FOR</span>{" "}
        <span className="spe-rotator-slot">
          {mode === "interactive" ? (
            <button
              type="button"
              className="spe-rotator-button"
              aria-label={`Target AI Platform: ${currentPlatform.displayName} (${currentPlatform.country}). Click to configure in Prompt Studio.`}
              onClick={() => handleSelect(currentPlatform)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              style={
                {
                  "--spe-rotator-brand": currentPlatform.brandColor,
                } as CSSProperties
              }
            >
              <span className="spe-rotator-flag" aria-hidden="true">
                {currentPlatform.countryFlag}
              </span>
              <span
                key={currentPlatform.id}
                className="spe-rotator-name"
                style={{ color: currentPlatform.brandColor }}
              >
                {currentPlatform.displayName}
              </span>
              <span
                className="spe-rotator-country-badge"
                style={{
                  color: currentPlatform.brandColor,
                  borderColor: `${currentPlatform.brandColor}55`,
                  backgroundColor: `${currentPlatform.brandColor}15`,
                }}
              >
                {currentPlatform.countryCode}
              </span>
              {currentPlatform.categoryLabel && (
                <span className="spe-rotator-category-badge">
                  {currentPlatform.categoryLabel}
                </span>
              )}
              {selectedPlatform === currentPlatform.id && (
                <span className="spe-rotator-selected-chip" aria-label="Selected">
                  ✓
                </span>
              )}
            </button>
          ) : (
            <span
              key={currentPlatform.id}
              className="spe-rotator-name"
              style={{ color: currentPlatform.brandColor }}
            >
              <span className="spe-rotator-flag" aria-hidden="true">
                {currentPlatform.countryFlag}
              </span>{" "}
              {currentPlatform.displayName}
            </span>
          )}
        </span>
      </span>
    </p>
  );
}

export function getInitialSelectedHeroTarget(): TargetId {
  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem("spe_selected_hero_target") as TargetId;
      if (
        saved &&
        ["any", "chatgpt", "claude", "gemini", "copilot", "local", "custom"].includes(saved)
      ) {
        return saved;
      }
    } catch {}
  }
  return "any";
}

export function subscribeHeroPlatformSelection(
  onSelect: (targetId: TargetId) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (
      detail?.studioTargetId &&
      ["any", "chatgpt", "claude", "gemini", "copilot", "local", "custom"].includes(detail.studioTargetId)
    ) {
      onSelect(detail.studioTargetId as TargetId);
      try {
        sessionStorage.setItem("spe_selected_hero_target", detail.studioTargetId);
      } catch {}
    }
  };
  window.addEventListener("spe:target-platform-selected", handler);
  return () => window.removeEventListener("spe:target-platform-selected", handler);
}

