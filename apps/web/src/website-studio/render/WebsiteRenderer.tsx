import React, { useEffect, useRef, useState } from "react";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

export interface WebsiteRendererProps {
  spec: WebsiteSpecV2;
  viewMode?: "desktop" | "tablet" | "mobile";
  reducedMotion?: boolean;
}

export const WebsiteRenderer: React.FC<WebsiteRendererProps> = ({
  spec,
  viewMode = "desktop",
  reducedMotion: reducedMotionProp,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglActive] = useState(true);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const reducedMotion = reducedMotionProp ?? systemReducedMotion;

  const getViewportWidth = () => {
    switch (viewMode) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      case "desktop":
      default:
        return "100%";
    }
  };

  const currentPage = spec.pages[0] || {
    id: "home",
    path: "index.html",
    title: spec.metadata.title,
  };

  const ariaRegionLabel =
    spec.scene?.accessibilityFallback?.ariaRegionLabel || "Website preview";
  const fallbackSvg =
    spec.scene?.accessibilityFallback?.hero2dSvg ||
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Static scene fallback"><rect width="64" height="64" rx="12" fill="#0b0d12"/></svg>';
  const fallbackText =
    spec.scene?.accessibilityFallback?.textDescription || "3D scene preview";

  return (
    <div
      className="website-renderer"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#06070a",
        position: "relative",
        overflow: "hidden",
      }}
      data-testid="website-renderer"
      data-view-mode={viewMode}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div
        className="website-preview-viewport"
        style={{
          width: getViewportWidth(),
          height: "100%",
          maxWidth: "100%",
          backgroundColor: spec.scene?.environment?.backgroundColor || "#0a0c10",
          position: "relative",
          boxShadow: viewMode !== "desktop" ? "0 0 40px rgba(0,0,0,0.8)" : "none",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
        role="region"
        aria-label={ariaRegionLabel}
      >
        {/* 3D Scene Layer — decorative; semantic DOM carries meaning */}
        <div
          ref={containerRef}
          className="stage-3d-layer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          {reducedMotion || !webglActive ? (
            <div
              data-testid="accessible-2d-fallback"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              dangerouslySetInnerHTML={{ __html: fallbackSvg }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                fontSize: "12px",
              }}
            >
              [ Interactive 3D WebGL Canvas Layer ]
            </div>
          )}
        </div>

        {/* Semantic DOM Layer — App owns the page landmark; preview uses section/region */}
        <div
          className="semantic-dom-layer"
          style={{
            position: "relative",
            zIndex: 2,
            padding: "40px 24px",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{spec.metadata.title}</h2>
            <nav aria-label="Preview sections" style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#94a3b8" }}>
              <span>Overview</span>
              <span>Features</span>
              <span>Contact</span>
            </nav>
          </header>

          <section
            aria-label="Preview content"
            style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <h1 style={{ fontSize: "32px", fontWeight: 800, margin: 0, lineHeight: "1.2" }}>
              {currentPage.title}
            </h1>
            <p style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "480px", margin: 0 }}>
              Interactive 3D experience with accessible semantic DOM hierarchy and tested camera motion.
            </p>
            {reducedMotion && (
              <p style={{ fontSize: "13px", color: "#cbd5e1", margin: 0 }} role="status">
                Reduced motion: showing static fallback — {fallbackText}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                style={{ padding: "10px 20px" }}
              >
                Explore Experience
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
