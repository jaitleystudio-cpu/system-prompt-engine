import React from "react";
import { UiDropExtractorStudio } from "../engine/UiDropExtractorStudio";
import type { AppView } from "../routing";

interface UiDropPageProps {
  onNavigate?: (view: AppView) => void;
}

export const UiDropPage: React.FC<UiDropPageProps> = ({ onNavigate }) => {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 20px 80px",
        fontFamily: "var(--spe-font-sans, system-ui, -apple-system, sans-serif)",
        color: "#F8FAFC",
      }}
    >
      {/* Breadcrumb Header */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.82rem",
          color: "#94A3B8",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => onNavigate?.("home")}
          style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 0 }}
        >
          Home
        </button>
        <span>/</span>
        <span style={{ color: "#818CF8", fontWeight: 600 }}>UIDrop Design System Extractor</span>
      </nav>

      {/* Hero Intro */}
      <header style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: "999px",
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818CF8",
              border: "1px solid rgba(99, 102, 241, 0.3)",
            }}
          >
            Design Intelligence Engine
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34D399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            $0 Cloud Compute
          </span>
        </div>
        <h1
          style={{
            fontSize: "2.2rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0 0 10px",
            lineHeight: 1.15,
          }}
        >
          UIDrop Web Design System Extractor & AI Prompt Compiler
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            color: "#94A3B8",
            maxWidth: "840px",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Extract semantic design tokens, WCAG 2.1 contrast scores, spatial rhythms, and anti-cloning prompts from any live URL or uploaded screenshot — ready to export to Claude Code, Cursor, Tailwind v4, and Figma.
        </p>
      </header>

      {/* Main Extractor Studio Mount */}
      <section style={{ marginBottom: "48px" }}>
        <UiDropExtractorStudio defaultUrl="https://uidrop.studiocms.dev" isPro={true} />
      </section>

      {/* 3 Core Architecture Pillars */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
          marginBottom: "48px",
        }}
      >
        <div
          style={{
            background: "#16181D",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "10px" }}>🌐</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 8px" }}>
            DOM & Token Extraction
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
            Inspects computed styles, font families, letter-spacing, component border-radii, and responsive breakpoints from live DOM trees or synthesized archetypes.
          </p>
        </div>

        <div
          style={{
            background: "#16181D",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "10px" }}>⚖️</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 8px" }}>
            WCAG 2.1 Contrast Engine & Auto-Tuner
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
            Evaluates relative luminance with unrounded mathematical precision to prevent false passes. Fix failing color combinations with 1-click AA contrast auto-tuning.
          </p>
        </div>

        <div
          style={{
            background: "#16181D",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "10px" }}>📦</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 8px" }}>
            6-Format Multi-Format Exporter
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
            Compiles tokens into Natural Language Anti-Cloning Prompts, system.md, Tailwind CSS v4 @theme, CSS Custom Properties, DTCG JSON, and React Component Scaffolds.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section
        style={{
          background: "#16181D",
          borderRadius: "16px",
          padding: "28px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "18px" }}>
          Frequently Asked Questions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#F1F5F9", margin: "0 0 4px" }}>
              How does in-browser extraction work without server GPU compute?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>
              UIDrop runs a deterministic AST parser and mathematical contrast calculator directly in your browser. When extracting in-browser or from uploaded screenshots, it uses local canvas heuristics and reference archetypes with zero cloud egress.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#F1F5F9", margin: "0 0 4px" }}>
              How does UIDrop connect with the PromptCard Chrome Extension?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>
              The PromptCard browser extension allows you to right-click any image on the web or snip screen regions to reverse-engineer dense 12-clause visual prompts. From PromptCard, you can click "Open in UIDrop" to immediately extract matching design tokens and WCAG contrast palettes.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#F1F5F9", margin: "0 0 4px" }}>
              Is the anti-cloning prompt safe from copyright issues?
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>
              Yes. The anti-cloning prompt explicitly instructs AI models to use the extracted geometric rhythm, palette, and typography as an abstract design foundation while strictly prohibiting copying brand trademarks, logos, copy, or copyrighted assets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UiDropPage;
