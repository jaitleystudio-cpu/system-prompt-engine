import { useState, useEffect, useCallback } from "react";
import type { AppView } from "../routing";
import "../landing/hero-platform-rotator.css";

export type PlatformCategory = "assistant" | "model" | "coding_tool";

export interface HeroRotatorPlatform {
  id: string;
  displayName: string;
  provider: string;
  category: PlatformCategory;
  categoryLabel?: string;
  dialectKey: string;
  targetPlatformKey: string;
  description: string;
}

/**
 * Authoritative registry of approved hero rotating platforms.
 * Reuses SPE's model dialect targets and provider governance.
 * Distinguishes models, assistants, and coding applications internally.
 * Does not imply partnerships, endorsements, or certifications.
 */
export const HERO_ROTATOR_PLATFORMS: readonly HeroRotatorPlatform[] = [
  {
    id: "chatgpt",
    displayName: "CHATGPT",
    provider: "OpenAI",
    category: "assistant",
    dialectKey: "openai-markdown",
    targetPlatformKey: "chatgpt",
    description: "Conversational & general intelligence assistant",
  },
  {
    id: "gemini",
    displayName: "GEMINI",
    provider: "Google",
    category: "assistant",
    dialectKey: "gemini-agent",
    targetPlatformKey: "gemini",
    description: "Multimodal frontier assistant & grounding engine",
  },
  {
    id: "claude",
    displayName: "CLAUDE",
    provider: "Anthropic",
    category: "assistant",
    dialectKey: "claude-xml",
    targetPlatformKey: "claude",
    description: "Deep reasoning & analytical synthesis assistant",
  },
  {
    id: "grok",
    displayName: "GROK",
    provider: "xAI",
    category: "assistant",
    dialectKey: "grok",
    targetPlatformKey: "grok",
    description: "Real-time search & mathematical reasoning assistant",
  },
  {
    id: "deepseek",
    displayName: "DEEPSEEK",
    provider: "DeepSeek",
    category: "model",
    categoryLabel: "Model",
    dialectKey: "open-weights",
    targetPlatformKey: "local",
    description: "Open-weights chain-of-thought reasoning model",
  },
  {
    id: "claude-code",
    displayName: "CLAUDE CODE",
    provider: "Anthropic",
    category: "coding_tool",
    categoryLabel: "Agent",
    dialectKey: "claude-code",
    targetPlatformKey: "claude",
    description: "Autonomous terminal coding agent & CLI tool",
  },
  {
    id: "copilot",
    displayName: "COPILOT",
    provider: "Microsoft / GitHub",
    category: "assistant",
    categoryLabel: "Companion",
    dialectKey: "cursor-rules",
    targetPlatformKey: "cursor",
    description: "Developer companion & workflow assistant",
  },
  {
    id: "perplexity",
    displayName: "PERPLEXITY",
    provider: "Perplexity AI",
    category: "assistant",
    dialectKey: "openai-markdown",
    targetPlatformKey: "chatgpt",
    description: "Conversational search & knowledge discovery engine",
  },
  {
    id: "cursor",
    displayName: "CURSOR",
    provider: "Anysphere",
    category: "coding_tool",
    categoryLabel: "IDE",
    dialectKey: "cursor-rules",
    targetPlatformKey: "cursor",
    description: "AI-native code editor & rules engine",
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
      } catch (e) {}

      // Dispatch custom event for prompt studio / vault listeners
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("spe:target-platform-selected", {
            detail: {
              platformId: platform.id,
              displayName: platform.displayName,
              dialectKey: platform.dialectKey,
              targetPlatformKey: platform.targetPlatformKey,
            },
          })
        );
      }

      // Smooth scroll to Prompt Studio or navigate to Create
      const studio = document.getElementById("prompt-studio");
      if (studio) {
        studio.scrollIntoView({ behavior: "smooth" });
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
      aria-label="Supported AI Platforms"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Accessible text for screen readers (prevents repeating announcement every 4.5s) */}
      <span className="visually-hidden">
        A clear start for any AI, including ChatGPT, Gemini, Claude, Grok, DeepSeek, Claude Code, Copilot, Perplexity, and Cursor.
      </span>

      {/* Visual presentation */}
      <span aria-hidden="true" className="spe-rotator-visual">
        <span className="spe-rotator-prefix">A CLEAR START FOR</span>{" "}
        <span className="spe-rotator-slot">
          {mode === "interactive" ? (
            <button
              type="button"
              className="spe-rotator-button"
              aria-label={`Target AI Platform: ${currentPlatform.displayName}. Click to preselect in Prompt Studio.`}
              onClick={() => handleSelect(currentPlatform)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            >
              <span key={currentPlatform.id} className="spe-rotator-name">
                {currentPlatform.displayName}
              </span>
              {currentPlatform.categoryLabel && (
                <span className="spe-rotator-category-badge">
                  {currentPlatform.categoryLabel}
                </span>
              )}
              {selectedPlatform === currentPlatform.id && (
                <span className="spe-rotator-selected-chip">✓</span>
              )}
            </button>
          ) : (
            <span key={currentPlatform.id} className="spe-rotator-name">
              {currentPlatform.displayName}
            </span>
          )}
        </span>
      </span>
    </p>
  );
}
