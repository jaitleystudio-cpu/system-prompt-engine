import React, { useRef, useState } from "react";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

export interface WebsiteRendererProps {
  spec: WebsiteSpecV2;
  viewMode?: "desktop" | "tablet" | "mobile";
  reducedMotion?: boolean;
  contextLostStatus?: string | null;
}

export const WebsiteRenderer: React.FC<WebsiteRendererProps> = ({
  spec,
  viewMode = "desktop",
  reducedMotion = false,
  contextLostStatus = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglActive] = useState(true);

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
    >
      {contextLostStatus && (
        <div
          data-testid="webgl-context-status"
          style={{
            position: "absolute",
            top: "12px",
            zIndex: 100,
            backgroundColor: "rgba(16, 185, 129, 0.9)",
            color: "#ffffff",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {contextLostStatus}
        </div>
      )}

      <div
        className="website-preview-viewport"
        style={{
          width: getViewportWidth(),
          height: "100%",
          maxWidth: "100%",
          backgroundColor: spec.scene?.environment?.backgroundColor || "#0a0c10",
          position: "relative",
          boxShadow: viewMode !== "desktop" ? "0 0 40px rgba(0,0,0,0.8)" : "none",
          transition: "width 0.3s ease",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* 3D Scene Layer */}
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
              dangerouslySetInnerHTML={{
                __html:
                  spec.scene?.accessibilityFallback?.hero2dSvg ||
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0b0d12"/><text x="10" y="36" fill="#fff" font-size="10">2D Fallback</text></svg>',
              }}
            />
          ) : (
            <div
              data-testid="canvas-3d-active"
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

        {/* Semantic DOM Layer */}
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
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{spec.metadata.title}</h2>
            <nav style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#94a3b8" }}>
              <span>Overview</span>
              <span>Features</span>
              <span>Contact</span>
            </nav>
          </header>

          <main style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 800, margin: 0, lineHeight: "1.2" }}>
              {currentPage.title}
            </h1>
            <p style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "480px", margin: 0 }}>
              Interactive 3D experience with accessible semantic DOM hierarchy and tested camera motion.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                style={{ padding: "10px 20px" }}
              >
                Explore Experience
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
