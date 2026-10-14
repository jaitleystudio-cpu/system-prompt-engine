/**
 * SPE Ω — Universal Prompt Arsenal Dedicated Sub-Page
 * Full-screen directory of 10,000+ production prompts with multi-model transcompilers,
 * Model Atlas switcher, native sponsored compute ads, and offline Pro entitlement gates.
 */

import { useEffect, useMemo } from "react";
import type { AppView } from "../routing";
import type { CategoryId } from "@spe/web-runtime";
import {
  applyPromptAssetMetadata,
  buildArsenalSchemaOrgJson,
  getRoutePromptAsset,
  getRoutePromptAssetId,
} from "../engine/arsenal/arsenalSchemaOrg";
import { PromptVaultPanel } from "../landing/PromptVaultPanel";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";
import "./prompt-arsenal-page.css";

interface Props {
  onNavigate: (view: AppView) => void;
  onSelectPrompt: (compiledPrompt: string, category: CategoryId) => void;
}

export function PromptArsenalPage({ onNavigate, onSelectPrompt }: Props) {
  const routeAssetId = useMemo(() => getRoutePromptAssetId(), []);
  const deepLinkedAsset = useMemo(() => getRoutePromptAsset(), []);

  useEffect(() => {
    applyPromptAssetMetadata(deepLinkedAsset);
  }, [deepLinkedAsset]);

  const schemaJson = useMemo(
    () => buildArsenalSchemaOrgJson(deepLinkedAsset),
    [deepLinkedAsset],
  );

  return (
    <div className="spe-arsenal-subpage" data-copy-depth="PRODUCT">
      <div className="spe-arsenal-container">
        <nav className="spe-arsenal-breadcrumbs" aria-label="Breadcrumb">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("home");
            }}
          >
            Home
          </a>
          <span aria-hidden="true">&rsaquo;</span>
          <span aria-current="page">Universal Prompt Arsenal</span>
        </nav>

        <header className="spe-arsenal-hero-header">
          <div className="spe-arsenal-kicker-badge">
            <span aria-hidden="true">⚡</span>
            10,000+ Task Assets • 100% Free on the Web
          </div>
          <h1 className="spe-arsenal-hero-title">
            Universal <span className="spe-gradient-text">Prompt Arsenal</span>
          </h1>
          <p className="spe-arsenal-hero-desc">
            Production-grade, task-specific prompt assets adapted for Claude 3.7 Sonnet, OpenAI o3-mini, Gemini 2.0, Grok 3, DeepSeek-R1, and Midjourney. Browse across 13 professional domains with real-time model transcompilation.
          </p>

          <div className="spe-arsenal-trust-strip">
            <div className="spe-arsenal-trust-item">
              <span aria-hidden="true">✓</span>
              <span>26 Verified Real AI Models</span>
            </div>
            <div className="spe-arsenal-trust-item">
              <span aria-hidden="true">✓</span>
              <span>13 Professional Domains</span>
            </div>
            <div className="spe-arsenal-trust-item">
              <span aria-hidden="true">✓</span>
              <span>100% Free Online Access</span>
            </div>
            <div className="spe-arsenal-trust-item">
              <span aria-hidden="true">✓</span>
              <span>Air-Gapped Offline Mode (Pro)</span>
            </div>
          </div>
        </header>

        {/* Schema.org Structured Data for Search Engine Indexing */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: schemaJson,
          }}
        />

        <ContextualAdSlot slotId="arsenal-top-leaderboard" format="leaderboard" className="spe-arsenal-top-ad" />

        <main id="arsenal-content">
          <PromptVaultPanel
            onSelectPrompt={onSelectPrompt}
            initialAssetId={routeAssetId ?? undefined}
          />
        </main>

        <ContextualAdSlot slotId="arsenal-footer-leaderboard" format="leaderboard" className="spe-arsenal-bottom-ad" />
      </div>
    </div>
  );
}

export default PromptArsenalPage;
