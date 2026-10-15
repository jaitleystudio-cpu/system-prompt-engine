import { useState, useEffect, useRef } from "react";
import {
  getCurrentDisplayState,
  setStoredComfortMode,
  subscribeToDisplayChanges,
  type DisplayState,
  type UserComfortMode,
} from "./adaptiveDisplayEngine.ts";
import {
  getActiveVisualVariant,
  applyVisualVariantToDom,
  emergencyRollbackToCanonical,
  registerOpenSessionAutoUpdater,
  type VisualEvolutionState,
} from "./dailyVisualEvolution.ts";

export function AdaptiveDisplayControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [displayState, setDisplayState] = useState<DisplayState>(() => getCurrentDisplayState());
  const [evolutionState, setEvolutionState] = useState<VisualEvolutionState>(() =>
    applyVisualVariantToDom(getActiveVisualVariant())
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Subscribe to capability or comfort updates
    const unsubscribe = subscribeToDisplayChanges((nextState) => {
      setDisplayState(nextState);
    });

    // Ensure active variant is applied on mount
    const initialVariant = getActiveVisualVariant();
    setEvolutionState(applyVisualVariantToDom(initialVariant));

    // Register open session auto updater across 02:17 IST boundary
    const cleanupSessionUpdater = registerOpenSessionAutoUpdater((updated) => {
      setEvolutionState(updated);
    });

    return () => {
      unsubscribe();
      cleanupSessionUpdater();
    };
  }, []);

  // Keyboard navigation & accessibility handlers
  useEffect(() => {
    if (!isOpen) return;

    // Focus initial element in dialog
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleComfortChange = (mode: UserComfortMode) => {
    setStoredComfortMode(mode);
    const nextState = getCurrentDisplayState();
    setDisplayState(nextState);
  };

  const handleRollback = () => {
    const rolled = emergencyRollbackToCanonical();
    setEvolutionState(rolled);
  };

  const profileBadgeLabel = {
    ESSENTIAL: "Essential (Low Motion)",
    STANDARD: "Standard sRGB",
    WIDE_COLOR: "Display P3 Gamut",
    HDR: `HDR (${displayState.hdrHeadroom}× Peak)`,
    IMMERSIVE: "Immersive WebGPU",
  }[displayState.effectiveProfile];

  return (
    <div className="spe-adaptive-display-control" style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        className="spe-display-pill"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Display Quality & Adaptive HDR Settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "9999px",
          background: "var(--spe-card-surface, rgba(14, 21, 38, 0.72))",
          border: "1px solid var(--spe-card-border-subtle, rgba(255, 255, 255, 0.12))",
          color: "var(--spe-accent-primary, #38bdf8)",
          font: "500 0.75rem/1.2 var(--spe-font-mono, monospace)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: "var(--spe-elevation-1, 0 1px 3px rgba(0, 0, 0, 0.2))",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: displayState.capabilities.supportsHdr ? "#10b981" : "var(--spe-accent-primary, #38bdf8)",
            boxShadow: "0 0 6px currentColor",
          }}
          aria-hidden="true"
        />
        <span>{profileBadgeLabel}</span>
        <span style={{ opacity: 0.6, fontSize: "0.68rem" }}>⚙</span>
      </button>

      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="spe-display-dialog-title"
          aria-describedby="spe-display-dialog-desc"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "min(90vw, 360px)",
            background: "var(--spe-card-surface-elevated, #0e1526)",
            border: "1px solid var(--spe-card-border-active, rgba(56, 189, 248, 0.3))",
            borderRadius: "1rem",
            padding: "1.25rem",
            boxShadow: "var(--spe-elevation-3, 0 16px 36px rgba(0,0,0,0.5))",
            zIndex: 9999,
            color: "#e2e8f0",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3
              id="spe-display-dialog-title"
              style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              Adaptive Display &amp; Visual Evolution
            </h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "1.1rem",
                padding: "0.2rem",
              }}
              aria-label="Close settings dialog"
            >
              ✕
            </button>
          </div>

          <div
            id="spe-display-dialog-desc"
            style={{ marginBottom: "1rem", fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5 }}
          >
            Adaptive HDR Content Harmony restrains body text luminance to nominal SDR (1.0) while allowing specular lasers and badges wide-gamut vibrancy.
          </div>

          {/* Comfort Mode Controls */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              COMFORT PROFILE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              {(["AUTOMATIC", "BALANCED", "ENHANCED", "SDR"] as const).map((mode) => {
                const isActive = displayState.comfortMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleComfortChange(mode)}
                    style={{
                      padding: "0.45rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: isActive
                        ? "1px solid var(--spe-accent-primary, #38bdf8)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isActive ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      color: isActive ? "#ffffff" : "#94a3b8",
                      fontSize: "0.72rem",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hardware Telemetry */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.65rem",
              background: "rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              fontSize: "0.72rem",
              marginBottom: "1rem",
              fontFamily: "var(--spe-font-mono, monospace)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ color: "#64748b" }}>Color Gamut:</span>
              <span style={{ color: displayState.isP3Active ? "#38bdf8" : "#94a3b8" }}>
                {displayState.capabilities.supportsWideColorP3 ? "Display P3 (Wide Gamut)" : "sRGB (Standard Gamut)"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ color: "#64748b" }}>Dynamic Range:</span>
              <span style={{ color: displayState.capabilities.supportsHdr ? "#10b981" : "#94a3b8" }}>
                {displayState.capabilities.supportsHdr
                  ? `HDR Active (${displayState.hdrHeadroom}× Headroom)`
                  : "SDR (Standard Luminance)"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>GPU Acceleration:</span>
              <span style={{ color: displayState.capabilities.supportsWebGpu ? "#a855f7" : "#94a3b8" }}>
                {displayState.capabilities.supportsWebGpu ? "WebGPU Active" : "WASM / WebGL Fallback"}
              </span>
            </div>
          </div>

          {/* Daily Evolution Status */}
          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#cbd5e1" }}>
                TODAY'S VISUAL VARIANT
              </span>
              <span style={{ fontSize: "0.68rem", color: "#10b981", fontFamily: "var(--spe-font-mono, monospace)" }}>
                ✓ WCAG AAA {evolutionState.activeVariant.measuredContrastDark}:1
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--spe-accent-primary, #38bdf8)", fontWeight: 500, marginBottom: "0.25rem" }}>
              {evolutionState.activeVariant.name}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.4, marginBottom: "0.6rem" }}>
              {evolutionState.activeVariant.rationale}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#64748b" }}>
              <span>Publication: {evolutionState.scheduledTimeIst}</span>
              <button
                type="button"
                onClick={handleRollback}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "0.68rem",
                  padding: 0,
                }}
              >
                Reset to Canonical
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
