import React from "react";
import type { AppView } from "../routing";

export interface FeaturesHubProps {
  currentView?: AppView | string;
  onNavigate?: (view: AppView) => void;
}

export interface FeatureItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  view?: AppView;
  externalHref?: string;
  badge?: string;
  isExternal?: boolean;
}

export const FEATURES: FeatureItem[] = [
  {
    id: "3d-studio",
    view: "website",
    title: "🎮 3D Studio v1.2",
    subtitle: "Three.js WebGL & Motion Editor",
    href: "/website",
    externalHref: "http://localhost:4180",
    badge: "NEW",
  },
  {
    id: "lab",
    view: "lab",
    title: "🔬 Daily Lab",
    subtitle: "AI Prompts & Interactive Challenges",
    href: "/daily-lab",
  },
  {
    id: "media",
    view: "media",
    title: "🎙️ Media Studio",
    subtitle: "Speech & Audio to Prompt",
    href: "/media",
  },
  {
    id: "ocr",
    view: "ocr",
    title: "📄 Vision & OCR",
    subtitle: "Document & Screenshot Analysis",
    href: "/ocr",
  },
  {
    id: "research",
    view: "research",
    title: "🔍 Deep Research",
    subtitle: "Multi-Source Synthesis & Journeys",
    href: "/research",
  },
  {
    id: "capabilities",
    view: "capabilities",
    title: "⚡ Capabilities",
    subtitle: "Integrity, Zero-Egress Proofs",
    href: "/capabilities",
  },
];

export const FeaturesHub: React.FC<FeaturesHubProps> = ({ currentView, onNavigate }) => {
  const [filter, setFilter] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const visibleFeatures = filter.trim()
    ? FEATURES.filter((f) =>
        f.title.toLowerCase().includes(filter.toLowerCase()) ||
        f.subtitle.toLowerCase().includes(filter.toLowerCase()) ||
        f.id.toLowerCase().includes(filter.toLowerCase()),
      )
    : FEATURES;

  return (
    <aside
      className="spe-features-hub"
      aria-label="SPE Feature Navigation"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        borderRadius: "12px",
        background: "var(--spe-surface-card, rgba(255, 255, 255, 0.03))",
        border: "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.1))",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--spe-text-muted, #888)",
            }}
          >
            SPE UPGRADED PLATFORM SUITE
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "0.15rem 0.45rem",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              fontWeight: 600,
            }}
          >
            v1.2 LIVE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to feature (⌘K)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              outline: "none",
              width: "170px",
            }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--spe-text-muted, #777)",
            }}
          >
            All 7 Acquisition Pillars & Tools Available on Localhost
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.6rem",
        }}
      >
        {visibleFeatures.map((item) => {
          const isCurrent = Boolean(item.view && currentView === item.view);
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => {
                if (item.view && onNavigate) {
                  e.preventDefault();
                  onNavigate(item.view);
                } else if (item.isExternal) {
                  // Direct navigation to 3D Studio
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                textDecoration: "none",
                background: isCurrent
                  ? "var(--spe-accent-soft, rgba(99, 102, 241, 0.15))"
                  : "var(--spe-surface-hover, rgba(255, 255, 255, 0.02))",
                border: isCurrent
                  ? "1px solid var(--spe-accent, #6366f1)"
                  : "1px solid var(--spe-border-subtle, rgba(255, 255, 255, 0.06))",
                color: "inherit",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--spe-text-primary, #fff)",
                  }}
                >
                  {item.title}
                </span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      padding: "0.1rem 0.35rem",
                      borderRadius: "4px",
                      background: "linear-gradient(135deg, #6366f1, #a855f7)",
                      color: "#fff",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--spe-text-muted, #888)",
                  lineHeight: "1.2",
                }}
              >
                {item.subtitle}
              </span>
            </a>
          );
        })}
      </div>
    </aside>
  );
};
