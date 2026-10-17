/**
 * SPE Ω — Featured Arsenal Preview Component
 * Clean, prestigious showcase on the Home Landing Page that previews 10,000+
 * production prompts and directs users cleanly to the dedicated /prompts sub-page.
 */

import type { AppView } from "../routing";
import type { CategoryId } from "@spe/web-runtime";
import { ARSENAL_CATALOG_ASSETS } from "../engine/arsenal/arsenalCatalogData";
import { transcompilePromptForPlatform } from "../engine/arsenal/modelTranscompiler";
import "./featured-arsenal-preview.css";

interface Props {
  onNavigate: (view: AppView) => void;
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
}

const DOMAIN_ALLOCATIONS = [
  { name: "Software & DevOps", count: "1,600", icon: "💻" },
  { name: "Digital Marketing & SEO", count: "1,200", icon: "📈" },
  { name: "Business & Operations", count: "1,000", icon: "🏢" },
  { name: "UI/UX & Web Design", count: "850", icon: "🎨" },
  { name: "Research & Education", count: "850", icon: "🔬" },
  { name: "Image Generation", count: "900", icon: "🖼️" },
  { name: "Video & Motion", count: "700", icon: "🎬" },
  { name: "Audio, Speech & Music", count: "600", icon: "🎵" },
  { name: "Sales & CRM", count: "650", icon: "💼" },
  { name: "Finance & Analytics", count: "450", icon: "📊" },
  { name: "Customer Support & HR", count: "600", icon: "🤝" },
  { name: "Legal & Compliance", count: "250", icon: "⚖️" },
  { name: "Writing & Productivity", count: "350", icon: "✍️" },
];

export function FeaturedArsenalPreview({ onNavigate, onSelectPrompt }: Props) {
  // Select 3 top diverse preview cards
  const previewCards = ARSENAL_CATALOG_ASSETS.slice(0, 3);

  const handleQuickLoad = (cardId: string) => {
    const asset = ARSENAL_CATALOG_ASSETS.find((a) => a.id === cardId);
    if (!asset) return;
    const compiled = transcompilePromptForPlatform(asset, "claude", {}, {
      tier: "COMMUNITY_FREE",
    });
    let targetCat: CategoryId = "Coding";
    if (asset.domain === "Digital Marketing & SEO" || asset.domain === "Business & Operations") {
      targetCat = "Business";
    }
    onSelectPrompt(compiled, targetCat);
    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="spe-featured-arsenal-section" aria-label="Universal Prompt Arsenal Overview" data-copy-depth="PRODUCT">
      <div className="spe-featured-arsenal-card">
        <header className="spe-featured-arsenal-header">
          <div className="spe-featured-kicker">
            <span aria-hidden="true">⚡</span>
            10,000+ Production Prompts • 100% Free on the Web
          </div>
          <h2 className="spe-featured-title">Universal Prompt Arsenal</h2>
          <p className="spe-featured-desc">
            Explore 10,000+ battle-tested AI prompt assets engineered for real-world tasks across 13 domains. Dynamically adapted for Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, Gemini 3 Pro, and DeepSeek Frontier.
          </p>
        </header>

        {/* Domain Allocation Chips */}
        <div className="spe-featured-domains-scroll">
          {DOMAIN_ALLOCATIONS.map((dom) => (
            <button
              type="button"
              key={dom.name}
              className="spe-featured-domain-pill"
              onClick={() => {
                onNavigate("prompts");
                window.scrollTo(0, 0);
              }}
              title={`View ${dom.name} prompts in catalog`}
            >
              <span aria-hidden="true">{dom.icon}</span>
              <span>{dom.name}</span>
              <span className="spe-featured-domain-count">{dom.count}</span>
            </button>
          ))}
        </div>

        {/* 3 Curated Sample Cards Grid */}
        <div className="spe-featured-sample-grid">
          {previewCards.map((p) => (
            <div className="spe-featured-sample-card" key={p.id}>
              <div>
                <div className="spe-sample-card-head">
                  <span className="spe-sample-icon" aria-hidden="true">{p.icon}</span>
                  <div className="spe-sample-meta">
                    <div className="spe-sample-badge">{p.domain}</div>
                    <h3>{p.title}</h3>
                  </div>
                </div>
                <p className="spe-sample-tagline">{p.tagline}</p>
              </div>

              <div className="spe-sample-actions">
                <button
                  type="button"
                  className="spe-btn-load"
                  onClick={() => handleQuickLoad(p.id)}
                >
                  Load into Studio ⚡
                </button>
                <button
                  type="button"
                  className="spe-btn-secondary"
                  onClick={() => {
                    onNavigate("prompts");
                    window.scrollTo(0, 0);
                  }}
                >
                  View in Arsenal ↗
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Direct Link to Dedicated Sub-Page */}
        <div className="spe-featured-arsenal-cta">
          <a
            href="/prompts"
            className="spe-arsenal-explore-btn"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("prompts");
              window.scrollTo(0, 0);
            }}
          >
            <span>⚡ Browse Full 10,000+ Prompt Arsenal</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          <div className="spe-arsenal-cta-subtext">
            Searchable catalog with multi-model transcompilers, live variable customizer, and ad-supported free web access.
          </div>
        </div>
      </div>
    </section>
  );
}
