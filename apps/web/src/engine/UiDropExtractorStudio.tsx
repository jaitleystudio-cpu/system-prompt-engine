/**
 * UIDrop Design System Extractor & AI Prompt Compiler Studio
 * Pixel-perfect dark-mode inspector panel modeled after UIDrop.
 * Features:
 *   - Headless Playwright DOM extraction & WCAG 2.1 contrast math
 *   - Draggable screenshot preview for direct drag-and-drop into AI chats
 *   - 3 classification pills: Density, Corner Profile, Theme
 *   - Semantic Color Palette, Swatch Strip, Typography Scale, Radius Tokens
 *   - Dual-format AI prompt compiler: Natural-Language Prompt & system.md
 *   - 3x2 SEND TO matrix: Claude, GPT, Gemini, Lovable, Manus, Cursor with official brand icons
 *   - Persistent Snap Library (IndexedDB + LocalStorage hybrid)
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  DesignSystemSnap,
  LauncherTool,
  ContrastPair,
} from "../types/design-system";
import {
  extractDesignOffline,
  extractDesignFromImage,
  tuneColorToPassAA,
} from "./uidrop/extractorCore";
import { evaluateContrastPair } from "./uidrop/wcagContrast";
import { saveSnap, loadSnaps, deleteSnap } from "./uidrop/snapStorage";

const LAUNCHER_TOOLS: LauncherTool[] = [
  {
    id: "claude",
    name: "Claude",
    description: "Send to claude.ai with anti-cloning tokens",
    url: "https://claude.ai/new",
    accentColor: "#D97706",
    iconType: "anthropic",
  },
  {
    id: "gpt",
    name: "ChatGPT",
    description: "Launch in ChatGPT 4o / Canvas",
    url: "https://chatgpt.com/",
    accentColor: "#10A37F",
    iconType: "openai",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Send to Gemini Advanced workspace",
    url: "https://gemini.google.com/app",
    accentColor: "#38BDF8",
    iconType: "gemini",
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "Generate full-stack app in Lovable.dev",
    url: "https://lovable.dev/",
    accentColor: "#FF3366",
    iconType: "lovable",
  },
  {
    id: "manus",
    name: "Manus",
    description: "Execute autonomous workflow in Manus.im",
    url: "https://manus.im/",
    accentColor: "#6366F1",
    iconType: "manus",
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "Open in Cursor AI IDE (cursor:// deep link)",
    url: "cursor://",
    accentColor: "#3B82F6",
    iconType: "cursor",
  },
];

/**
 * Authentic SVG Brand Icons for AI tools
 */
const BrandIcon: React.FC<{ id: string; color: string }> = ({ id, color }) => {
  if (id === "claude") {
    // Anthropic Claude sunburst / spark symbol
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M13.5 3L11.5 9.5L5 11.5L11.5 13.5L13.5 20L15.5 13.5L22 11.5L15.5 9.5L13.5 3Z"
          fill={color}
        />
        <path
          d="M6 3L5 6L2 7L5 8L6 11L7 8L10 7L7 6L6 3Z"
          fill={color}
          opacity="0.8"
        />
      </svg>
    );
  }
  if (id === "gpt") {
    // OpenAI ChatGPT rosette / swirl
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75">
        <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.2" />
        <path d="M12 2C8.5 2 5.5 4 4 7L6.5 8.5C7.5 6.5 9.5 5 12 5C14.5 5 16.5 6.5 17.5 8.5L20 7C18.5 4 15.5 2 12 2Z" />
        <path d="M22 12C22 8.5 20 5.5 17 4L15.5 6.5C17.5 7.5 19 9.5 19 12C19 14.5 17.5 16.5 15.5 17.5L17 20C20 18.5 22 15.5 22 12Z" />
        <path d="M12 22C15.5 22 18.5 20 20 17L17.5 15.5C16.5 17.5 14.5 19 12 19C9.5 19 7.5 17.5 6.5 15.5L4 17C5.5 20 8.5 22 12 22Z" />
        <path d="M2 12C2 15.5 4 18.5 7 20L8.5 17.5C6.5 16.5 5 14.5 5 12C5 9.5 6.5 7.5 8.5 6.5L7 4C4 5.5 2 8.5 2 12Z" />
      </svg>
    );
  }
  if (id === "gemini") {
    // Google Gemini four-pointed star
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
          fill={color}
        />
      </svg>
    );
  }
  if (id === "lovable") {
    // Lovable Heart-L monogram
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
          fill={color}
        />
      </svg>
    );
  }
  if (id === "manus") {
    // Manus Hexagonal crystal glyph
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" fill={color} fillOpacity="0.2" />
        <path d="M8 9L12 12L16 9M12 12V18" />
      </svg>
    );
  }
  if (id === "cursor") {
    // Cursor isometric 3D box
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" fill={color} fillOpacity="0.15" />
        <path d="M12 22V12" />
        <path d="M21 7L12 12L3 7" />
      </svg>
    );
  }
  return <span style={{ color }}>⚡</span>;
};

interface UiDropExtractorStudioProps {
  onClose?: () => void;
  defaultUrl?: string;
  isPro?: boolean;
}

export const UiDropExtractorStudio: React.FC<UiDropExtractorStudioProps> = ({
  onClose,
  defaultUrl = "https://uidrop.studiocms.dev",
  isPro = true,
}) => {
  const [url, setUrl] = useState<string>(defaultUrl);
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [activeOutputMode, setActiveOutputMode] = useState<
    "prompt" | "system.md" | "tailwind" | "css" | "dtcg" | "react"
  >("prompt");
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [snapLibraryOpen, setSnapLibraryOpen] = useState<boolean>(false);
  const [savedSnaps, setSavedSnaps] = useState<DesignSystemSnap[]>([]);
  const [currentSnap, setCurrentSnap] = useState<DesignSystemSnap>(() =>
    extractDesignOffline(defaultUrl),
  );

  // Load saved snaps from IndexedDB / LocalStorage hybrid store
  useEffect(() => {
    let mounted = true;
    loadSnaps()
      .then((snaps) => {
        if (mounted && snaps && snaps.length > 0) {
          setSavedSnaps(snaps);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const persistSnap = useCallback(async (snap: DesignSystemSnap) => {
    await saveSnap(snap);
    setSavedSnaps((prev) => {
      const filtered = prev.filter((s) => s.id !== snap.id && s.domain !== snap.domain);
      return [snap, ...filtered].slice(0, 20);
    });
  }, []);

  const handleSnap = async (targetUrl = url) => {
    if (!targetUrl.trim()) return;
    setIsSnapping(true);

    try {
      let snap: DesignSystemSnap | null = null;

      // 1. Attempt Next.js API route first if available
      try {
        const storedKey = typeof localStorage !== "undefined" ? localStorage.getItem("spe_entitlement_key") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (storedKey) {
          headers["x-spe-entitlement-key"] = storedKey;
        }

        const resp = await fetch("/api/extract-design", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: targetUrl.trim(), preferOffline: !isPro }),
        });

        if (resp.ok) {
          snap = await resp.json();
        } else if (resp.status === 401 || resp.status === 403) {
          // Entitlement required, fall back gracefully to free offline archetype
          const offlineResp = await fetch("/api/extract-design", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: targetUrl.trim(), preferOffline: true }),
          });
          if (offlineResp.ok) {
            snap = await offlineResp.json();
            showToast("Live capture requires Pro. Loaded offline reference archetype.");
          }
        } else {
          const errData = await resp.json().catch(() => ({}));
          if (errData.code === "SSRF_BLOCKED") {
            showToast(`SSRF Blocked: ${errData.error || "Destination disallowed"}`);
            setIsSnapping(false);
            return;
          }
        }
      } catch {
        // Network error or local air-gap mode, fall back to offline extractor
      }

      // 2. Deterministic offline fallback if API is unreachable
      if (!snap) {
        snap = extractDesignOffline(targetUrl.trim());
      }

      setCurrentSnap(snap);
      await persistSnap(snap);
      showToast(`Extracted design tokens from ${snap.domain}!`);
    } catch (err: any) {
      const fallbackSnap = extractDesignOffline(targetUrl.trim());
      setCurrentSnap(fallbackSnap);
      await persistSnap(fallbackSnap);
      showToast(`Extraction completed for ${fallbackSnap.domain}`);
    } finally {
      setIsSnapping(false);
    }
  };

  const getActiveCompiledText = (): string => {
    switch (activeOutputMode) {
      case "prompt":
        return currentSnap.compiledPrompt;
      case "system.md":
        return currentSnap.systemMd;
      case "tailwind":
        return currentSnap.tailwindTheme || "";
      case "css":
        return currentSnap.cssVariables || "";
      case "dtcg":
        return currentSnap.dtcgTokensJson || "";
      case "react":
        return currentSnap.reactScaffoldTsx || "";
      default:
        return currentSnap.compiledPrompt;
    }
  };

  const handleDownloadActive = (text: string) => {
    const filenameMap: Record<string, { name: string; type: string }> = {
      prompt: { name: `${currentSnap.domain}-prompt.txt`, type: "text/plain" },
      "system.md": { name: "system.md", type: "text/markdown" },
      tailwind: { name: "tailwind-theme.css", type: "text/css" },
      css: { name: "design-tokens.css", type: "text/css" },
      dtcg: { name: "tokens.json", type: "application/json" },
      react: { name: "ComponentScaffold.tsx", type: "text/typescript" },
    };
    const { name, type } = filenameMap[activeOutputMode] || { name: "export.txt", type: "text/plain" };
    const blob = new Blob([text], { type });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    a.click();
    URL.revokeObjectURL(blobUrl);
    showToast(`Downloaded ${name}!`);
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please drop an image file (PNG, JPG, SVG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setIsSnapping(true);
        try {
          const snap = extractDesignFromImage(dataUrl, file.name);
          setCurrentSnap(snap);
          await persistSnap(snap);
          showToast(`Extracted design tokens from ${file.name}!`);
        } catch {
          showToast("Failed to parse image file.");
        } finally {
          setIsSnapping(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAutoTuneContrast = (pairKey: "textOnSurface" | "primaryOnSurface" | "mutedOnSurface") => {
    const pair = currentSnap.palette.contrast[pairKey];
    if (!pair) return;
    const target = pairKey === "primaryOnSurface" ? 3.0 : 4.5;
    const tuned = tuneColorToPassAA(pair.foreground, pair.background, target);

    const updatedPalette = { ...currentSnap.palette };
    if (pairKey === "textOnSurface") updatedPalette.text = tuned.tunedHex;
    else if (pairKey === "primaryOnSurface") updatedPalette.primary = tuned.tunedHex;
    else if (pairKey === "mutedOnSurface") updatedPalette.muted = tuned.tunedHex;

    updatedPalette.contrast = {
      textOnSurface: evaluateContrastPair(updatedPalette.text, updatedPalette.surface, "Text on Surface"),
      primaryOnSurface: evaluateContrastPair(updatedPalette.primary, updatedPalette.surface, "Primary on Surface", true),
      mutedOnSurface: evaluateContrastPair(updatedPalette.muted, updatedPalette.surface, "Muted on Surface"),
    };

    const updatedSnap: DesignSystemSnap = {
      ...currentSnap,
      palette: updatedPalette,
    };
    setCurrentSnap(updatedSnap);
    void persistSnap(updatedSnap);
    showToast(`Tuned ${pair.label} to ${tuned.tunedHex} (${tuned.formattedRatio} AA PASS)!`);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied to clipboard!`);
    });
  };

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      showToast(`Copied ${hex}`);
      setTimeout(() => setCopiedHex(null), 1500);
    });
  };

  const handleLaunchTool = (tool: LauncherTool) => {
    const textToCopy = getActiveCompiledText();
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(`Prompt copied! Paste into ${tool.name}`);
      if (tool.id === "cursor") {
        window.location.href = tool.url;
      } else {
        window.open(tool.url, "_blank", "noopener,noreferrer");
      }
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    const text = getActiveCompiledText();
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.setData("text/uri-list", currentSnap.screenshotBase64);
    e.dataTransfer.setData(
      "text/html",
      `<img src="${currentSnap.screenshotBase64}" alt="Design screenshot from ${currentSnap.domain}" />\n<pre>${text}</pre>`,
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDeleteSavedSnap = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSnap(id);
    setSavedSnaps((prev) => prev.filter((s) => s.id !== id));
    showToast("Snap removed from library");
  };

  const isCurrentUrlAlreadySnapped =
    currentSnap &&
    (currentSnap.url === url || currentSnap.domain === url.replace(/https?:\/\//, "").split("/")[0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        background: "#0D0E12",
        color: "#F8FAFC",
        borderRadius: "20px",
        padding: "1.75rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.75)",
        fontFamily: "var(--spe-font-sans, system-ui, -apple-system, sans-serif)",
        position: "relative",
      }}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: "20px",
            right: "24px",
            zIndex: 100,
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            color: "#FFFFFF",
            padding: "8px 16px",
            borderRadius: "999px",
            fontSize: "0.82rem",
            fontWeight: 600,
            boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.6)",
          }}
        >
          ✓ {toastMsg}
        </div>
      )}

      {/* Top Bar: Title & URL Input */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #5E6AD2 0%, #6366F1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "0 4px 14px rgba(94, 106, 210, 0.4)",
            }}
          >
            🎨
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                UIDrop Design System Extractor
              </h2>
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: isPro ? "rgba(99, 102, 241, 0.18)" : "rgba(255, 255, 255, 0.08)",
                  color: isPro ? "#818CF8" : "#94A3B8",
                  border: `1px solid ${isPro ? "rgba(99, 102, 241, 0.35)" : "rgba(255, 255, 255, 0.15)"}`,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {isPro ? "PRO Paid" : "Standard"}
              </span>
              {currentSnap.sourceMode && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background:
                      currentSnap.sourceMode === "LIVE_DOM_CAPTURE"
                        ? "rgba(16, 185, 129, 0.18)"
                        : currentSnap.sourceMode === "LOCAL_REFERENCE_ARCHETYPE"
                        ? "rgba(99, 102, 241, 0.18)"
                        : currentSnap.sourceMode === "SCREENSHOT_EXTRACT"
                        ? "rgba(236, 72, 153, 0.18)"
                        : currentSnap.sourceMode === "SYNTHETIC_PREVIEW"
                        ? "rgba(245, 158, 11, 0.18)"
                        : "rgba(239, 68, 68, 0.18)",
                    color:
                      currentSnap.sourceMode === "LIVE_DOM_CAPTURE"
                        ? "#34D399"
                        : currentSnap.sourceMode === "LOCAL_REFERENCE_ARCHETYPE"
                        ? "#818CF8"
                        : currentSnap.sourceMode === "SCREENSHOT_EXTRACT"
                        ? "#F472B6"
                        : currentSnap.sourceMode === "SYNTHETIC_PREVIEW"
                        ? "#FBBF24"
                        : "#F87171",
                    border: `1px solid ${
                      currentSnap.sourceMode === "LIVE_DOM_CAPTURE"
                        ? "rgba(16, 185, 129, 0.35)"
                        : currentSnap.sourceMode === "LOCAL_REFERENCE_ARCHETYPE"
                        ? "rgba(99, 102, 241, 0.35)"
                        : currentSnap.sourceMode === "SCREENSHOT_EXTRACT"
                        ? "rgba(236, 72, 153, 0.35)"
                        : currentSnap.sourceMode === "SYNTHETIC_PREVIEW"
                        ? "rgba(245, 158, 11, 0.35)"
                        : "rgba(239, 68, 68, 0.35)"
                    }`,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                  title={currentSnap.provenanceNotice || currentSnap.sourceMode}
                >
                  {currentSnap.sourceMode === "LIVE_DOM_CAPTURE"
                    ? "● Live DOM Capture"
                    : currentSnap.sourceMode === "LOCAL_REFERENCE_ARCHETYPE"
                    ? "● Reference Archetype"
                    : currentSnap.sourceMode === "SCREENSHOT_EXTRACT"
                    ? "● Screenshot Extract"
                    : currentSnap.sourceMode === "SYNTHETIC_PREVIEW"
                    ? "● Synthetic Preview"
                    : "● Extraction Failed"}
                </span>
              )}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#94A3B8" }}>
              Live Playwright DOM evaluation, WCAG contrast audit & multi-format AI prompt compiler
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => setExtensionModalOpen(true)}
            style={{
              background: "rgba(255, 106, 0, 0.12)",
              border: "1px solid rgba(255, 106, 0, 0.35)",
              borderRadius: "8px",
              color: "#FF8C38",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>🔌</span> PromptCard Extension
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#94A3B8",
                cursor: "pointer",
                padding: "6px 12px",
                fontSize: "0.8rem",
              }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* URL Input Bar & Action CTA */}
      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          alignItems: "center",
          background: "#16181D",
          padding: "6px 6px 6px 14px",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.09)",
        }}
      >
        <span style={{ color: "#64748B", fontSize: "0.95rem" }}>🌐</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSnap(url)}
          placeholder="https://example.com"
          disabled={isSnapping}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "#FFFFFF",
            fontSize: "0.92rem",
            outline: "none",
            fontFamily: "var(--spe-font-mono, monospace)",
          }}
        />

        <button
          onClick={() => handleSnap(url)}
          disabled={isSnapping}
          style={{
            background: isSnapping
              ? "#334155"
              : "linear-gradient(135deg, #5E6AD2 0%, #6366F1 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "8px 18px",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: isSnapping ? "not-allowed" : "pointer",
            boxShadow: isSnapping ? "none" : "0 4px 14px rgba(94, 106, 210, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease",
          }}
        >
          {isSnapping ? (
            <>
              <span style={{ display: "inline-block", animation: "spin 1s infinite linear" }}>⚡</span>
              Snapping...
            </>
          ) : isCurrentUrlAlreadySnapped ? (
            <>
              <span>🔄</span>
              Snap again
            </>
          ) : (
            <>
              <span>📸</span>
              Snap this page
            </>
          )}
        </button>

        <button
          onClick={() => setSnapLibraryOpen(!snapLibraryOpen)}
          title="Toggle Snap Library"
          style={{
            background: snapLibraryOpen ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "8px 12px",
            color: snapLibraryOpen ? "#818CF8" : "#94A3B8",
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
        >
          📚 Library ({savedSnaps.length})
        </button>
      </div>

      {/* Dual Input Mode: Live URL or Drag-and-Drop Screenshot */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageFile(e.dataTransfer.files[0]);
          }
        }}
        style={{
          border: isDraggingOver ? "2px dashed #818CF8" : "1px dashed rgba(255, 255, 255, 0.15)",
          borderRadius: "12px",
          padding: "10px 16px",
          background: isDraggingOver ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.6rem",
          transition: "all 0.2s ease",
          fontSize: "0.82rem",
          color: "#94A3B8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🖼️</span>
          <span>
            <strong style={{ color: "#F1F5F9" }}>Drag & Drop any UI Screenshot or Mockup here</strong>
            <span style={{ display: "block", fontSize: "0.72rem", color: "#64748B" }}>
              Extracts palette, density, corner profile & WCAG contrast in-browser ($0 cloud compute)
            </span>
          </span>
        </div>
        <label
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            color: "#E2E8F0",
            padding: "5px 14px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.75rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.15s ease",
          }}
        >
          <span>📁</span> Browse Image
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
              }
            }}
          />
        </label>
      </div>

      {/* PromptCard Extension Info Modal */}
      {extensionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setExtensionModalOpen(false)}
        >
          <div
            style={{
              background: "#12141A",
              border: "1px solid rgba(255, 106, 0, 0.35)",
              borderRadius: "16px",
              maxWidth: "540px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 106, 0, 0.15)",
              color: "#F8FAFC",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #FF7A18, #FF4500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(255, 106, 0, 0.4)",
                  }}
                >
                  ⚡
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>PromptCard - Image to Prompt AI</h3>
                  <span style={{ fontSize: "0.72rem", color: "#FF8C38", fontWeight: 600 }}>Manifest V3 Browser Extension (V1.4.0)</span>
                </div>
              </div>
              <button
                onClick={() => setExtensionModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: 1.5, marginBottom: "16px" }}>
              Reverse-engineer any image on the web directly from your browser! Right-click any image, snip screen regions, and extract strict 12-clause semicolon prompts with 4 aesthetic style pills into Midjourney, FLUX, or UIDrop.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", fontSize: "0.8rem", color: "#94A3B8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#34D399" }}>✓</span> Right-click any web image → "Analyze image with PromptCard"
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#34D399" }}>✓</span> Trilingual output: English, 中文, and 日本語 with structured JSON
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#34D399" }}>✓</span> 100% private in-browser mode ($0.00 cloud inference bill) or BYOK frontier VLM
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setExtensionModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#FFFFFF",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snap Library Drawer (Collapsible) */}
      {snapLibraryOpen && (
        <div
          style={{
            background: "#16181D",
            borderRadius: "12px",
            padding: "1rem",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#94A3B8" }}>
              Saved Extractions ({savedSnaps.length})
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
              Stored in LocalStorage + IndexedDB
            </span>
          </div>

          {savedSnaps.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
              No extractions saved yet. Click "Snap this page" above to save extractions.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "0.6rem",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              {savedSnaps.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentSnap(item);
                    setUrl(item.url);
                    showToast(`Loaded ${item.domain}`);
                  }}
                  style={{
                    background: item.id === currentSnap.id ? "rgba(99, 102, 241, 0.15)" : "#0D0E12",
                    border: item.id === currentSnap.id ? "1px solid #6366F1" : "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#FFFFFF", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {item.domain}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSavedSnap(e, item.id)}
                    title="Delete"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748B",
                      cursor: "pointer",
                      padding: "2px 6px",
                      fontSize: "0.8rem",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Left Column (Preview & Tokens) + Right Column (SEND TO Launchers & Code) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Screenshot & Inspector Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Draggable Screenshot Card */}
          <div
            draggable
            onDragStart={handleDragStart}
            style={{
              background: "#16181D",
              borderRadius: "14px",
              padding: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              cursor: "grab",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "240px",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={currentSnap.screenshotBase64}
                alt={`Rendered viewport of ${currentSnap.domain}`}
                draggable
                onDragStart={handleDragStart}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  cursor: "grab",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 4px",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>👆</span> Drag the screenshot above into Claude, Cursor, or any AI chat
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontFamily: "var(--spe-font-mono, monospace)",
                  color: "#64748B",
                }}
              >
                1440 × 900
              </span>
            </div>
          </div>

          {/* Header Bar: Domain & 3 Classification Pills */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#16181D",
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FFFFFF" }}>
                {currentSnap.domain}
              </span>
            </div>

            {/* 3 Classification Pills: Density, Corner Profile, Theme */}
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "#E2E8F0",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textTransform: "capitalize",
                }}
              >
                {currentSnap.classification.density}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "#E2E8F0",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textTransform: "capitalize",
                }}
              >
                {currentSnap.classification.shapeProfile}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: currentSnap.classification.theme === "light" ? "rgba(251, 191, 36, 0.15)" : "rgba(129, 140, 248, 0.15)",
                  color: currentSnap.classification.theme === "light" ? "#FBBF24" : "#818CF8",
                  border: `1px solid ${currentSnap.classification.theme === "light" ? "rgba(251, 191, 36, 0.3)" : "rgba(129, 140, 248, 0.3)"}`,
                }}
              >
                {currentSnap.classification.theme === "light" ? "☼ Light" : "☾ Dark"}
              </span>
            </div>
          </div>

          {/* Token Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            {/* PALETTE Card */}
            <div
              style={{
                background: "#16181D",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94A3B8", textTransform: "uppercase" }}>
                PALETTE
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {[
                  { role: "primary", hex: currentSnap.palette.primary },
                  { role: "accent", hex: currentSnap.palette.accent },
                  { role: "surface", hex: currentSnap.palette.surface },
                  { role: "elevated", hex: currentSnap.palette.elevated },
                  { role: "text", hex: currentSnap.palette.text },
                  { role: "muted", hex: currentSnap.palette.muted },
                ].map((item) => (
                  <div
                    key={item.role}
                    onClick={() => handleCopyHex(item.hex)}
                    title={`Click to copy ${item.hex}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 6px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.02)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          background: item.hex,
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                        }}
                      />
                      <span style={{ fontSize: "0.74rem", color: "#CBD5E1", textTransform: "capitalize" }}>
                        {item.role}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontFamily: "var(--spe-font-mono, monospace)",
                        color: copiedHex === item.hex ? "#10B981" : "#94A3B8",
                      }}
                    >
                      {copiedHex === item.hex ? "Copied!" : item.hex}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* TYPOGRAPHY Card & TOKENS Breakdown */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {/* TYPOGRAPHY Card */}
              <div
                style={{
                  background: "#16181D",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94A3B8", textTransform: "uppercase" }}>
                  TYPOGRAPHY
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.74rem" }}>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.66rem" }}>HEADING</span>
                    <span style={{ color: "#F1F5F9", fontWeight: 600 }}>{currentSnap.typography.heading}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.66rem" }}>BODY</span>
                    <span style={{ color: "#F1F5F9" }}>{currentSnap.typography.body}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.66rem" }}>SCALE</span>
                    <span style={{ color: "#38BDF8", fontFamily: "var(--spe-font-mono, monospace)" }}>
                      {currentSnap.typography.scale}
                    </span>
                  </div>
                </div>
              </div>

              {/* TOKENS Card */}
              <div
                style={{
                  background: "#16181D",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94A3B8", textTransform: "uppercase" }}>
                  TOKENS
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.74rem" }}>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.66rem" }}>RADII</span>
                    <span style={{ color: "#CBD5E1" }}>
                      {currentSnap.tokens.buttonRadiusLabel}, {currentSnap.tokens.cardRadius} cards, {currentSnap.tokens.inputRadius} inputs
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: "0.66rem" }}>SHADOWS</span>
                    <span style={{ color: "#94A3B8" }}>{currentSnap.tokens.shadowSummary}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Swatch Strip & WCAG Contrast Audit */}
          <div
            style={{
              background: "#16181D",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94A3B8", textTransform: "uppercase" }}>
                SWATCH STRIP & WCAG 2.1 CONTRAST
              </span>
              <span style={{ fontSize: "0.68rem", color: "#10B981", fontWeight: 600 }}>
                100% Calculated
              </span>
            </div>

            {/* Horizontal Swatch Strip */}
            <div
              style={{
                display: "flex",
                height: "22px",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {currentSnap.palette.swatches.map((color, idx) => (
                <div
                  key={`${color}-${idx}`}
                  onClick={() => handleCopyHex(color)}
                  title={`Copy ${color}`}
                  style={{
                    flex: 1,
                    background: color,
                    cursor: "pointer",
                    transition: "transform 0.1s ease",
                  }}
                />
              ))}
            </div>

            {/* 3 WCAG Contrast Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {[
                currentSnap.palette.contrast.textOnSurface,
                currentSnap.palette.contrast.primaryOnSurface,
                currentSnap.palette.contrast.mutedOnSurface,
              ].map((pair: ContrastPair) => (
                <div
                  key={pair.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    {/* Visual Aa preview pill */}
                    <div
                      style={{
                        width: "28px",
                        height: "20px",
                        borderRadius: "4px",
                        background: pair.background,
                        color: pair.foreground,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      Aa
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#E2E8F0" }}>{pair.label}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontFamily: "var(--spe-font-mono, monospace)",
                        color: "#94A3B8",
                      }}
                    >
                      {pair.formattedRatio}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background:
                          pair.score === "AAA"
                            ? "rgba(16, 185, 129, 0.18)"
                            : pair.score === "AA"
                              ? "rgba(56, 189, 248, 0.18)"
                              : "rgba(239, 68, 68, 0.18)",
                        color:
                          pair.score === "AAA"
                            ? "#34D399"
                            : pair.score === "AA"
                              ? "#38BDF8"
                              : "#F87171",
                        border: `1px solid ${
                          pair.score === "AAA"
                            ? "rgba(16, 185, 129, 0.3)"
                            : pair.score === "AA"
                              ? "rgba(56, 189, 248, 0.3)"
                              : "rgba(239, 68, 68, 0.3)"
                        }`,
                      }}
                    >
                      {pair.score}
                    </span>
                    {pair.score === "FAIL" && (
                      <button
                        onClick={() => {
                          const pairKey =
                            pair.label === "Text on Surface"
                              ? "textOnSurface"
                              : pair.label === "Primary on Surface"
                              ? "primaryOnSurface"
                              : "mutedOnSurface";
                          handleAutoTuneContrast(pairKey);
                        }}
                        title={`Auto-tune ${pair.foreground} to achieve AA contrast against ${pair.background}`}
                        style={{
                          background: "rgba(99, 102, 241, 0.2)",
                          border: "1px solid rgba(99, 102, 241, 0.4)",
                          color: "#A5B4FC",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ⚡ Fix AA
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: SEND TO Integration Matrix & Compiled Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* SEND TO Header & Segmented Toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#16181D",
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94A3B8", textTransform: "uppercase" }}>
              SEND TO
            </span>

            {/* Segmented Toggle: Prompt | system.md | Tailwind v4 | CSS Vars | DTCG JSON | React Scaffold */}
            <div
              style={{
                display: "flex",
                background: "#0D0E12",
                borderRadius: "8px",
                padding: "2px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                flexWrap: "wrap",
                gap: "2px",
              }}
            >
              {[
                { id: "prompt", label: "Prompt" },
                { id: "system.md", label: "system.md" },
                { id: "tailwind", label: "Tailwind v4" },
                { id: "css", label: "CSS Vars" },
                { id: "dtcg", label: "DTCG JSON" },
                { id: "react", label: "React Scaffold" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveOutputMode(tab.id as any)}
                  style={{
                    background: activeOutputMode === tab.id ? "#5E6AD2" : "transparent",
                    color: activeOutputMode === tab.id ? "#FFFFFF" : "#94A3B8",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3x2 Launcher Grid with Official Brand Icons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.6rem",
            }}
          >
            {LAUNCHER_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleLaunchTool(tool)}
                title={tool.description}
                style={{
                  background: "#16181D",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "10px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.35rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  color: "#FFFFFF",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = tool.accentColor;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${tool.accentColor}40`,
                  }}
                >
                  <BrandIcon id={tool.id} color={tool.accentColor} />
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{tool.name}</span>
                <span style={{ fontSize: "0.62rem", color: "#64748B" }}>Launch ↗</span>
              </button>
            ))}
          </div>

          {/* Full-width Copy Button */}
          <button
            onClick={() => handleCopyText(getActiveCompiledText(), "Design system schema")}
            style={{
              background: "linear-gradient(135deg, rgba(94, 106, 210, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "#C7D2FE",
              borderRadius: "10px",
              padding: "10px",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            📋 Copy schema to clipboard
          </button>

          {/* Code Preview Pane */}
          <div
            style={{
              background: "#16181D",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontFamily: "var(--spe-font-mono, monospace)",
                  color: "#94A3B8",
                }}
              >
                {activeOutputMode === "prompt"
                  ? "anti-cloning-prompt.txt"
                  : activeOutputMode === "system.md"
                  ? "system.md"
                  : activeOutputMode === "tailwind"
                  ? "tailwind-theme.css"
                  : activeOutputMode === "css"
                  ? "design-tokens.css"
                  : activeOutputMode === "dtcg"
                  ? "tokens.json"
                  : "ComponentScaffold.tsx"}
              </span>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  onClick={() => handleCopyText(getActiveCompiledText(), "Active snippet")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#818CF8",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => handleDownloadActive(getActiveCompiledText())}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#34D399",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  📥 Download
                </button>
              </div>
            </div>

            <pre
              style={{
                margin: 0,
                padding: "12px",
                fontSize: "0.72rem",
                fontFamily: "var(--spe-font-mono, monospace)",
                color: "#E2E8F0",
                lineHeight: "1.5",
                maxHeight: "260px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {getActiveCompiledText()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
