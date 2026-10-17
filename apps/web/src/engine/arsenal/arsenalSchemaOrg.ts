/**
 * Schema.org JSON-LD Structured Data & Dynamic Metadata Engine
 * Generates valid WebApplication, SoftwareApplication, and HowTo structured schemas
 * for Googlebot and frontier AI search crawlers.
 */

import type { ArsenalPromptAsset } from "./arsenalSchema";
import { getArsenalAssetById } from "./arsenalHydrator";

export function getRoutePromptAssetId(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/\/prompts\/(SPE-ARSENAL-\d{5})/i);
  return match ? match[1].toUpperCase() : null;
}

export function getRoutePromptAsset(): ArsenalPromptAsset | undefined {
  const id = getRoutePromptAssetId();
  return id ? getArsenalAssetById(id) : undefined;
}

export function applyPromptAssetMetadata(asset?: ArsenalPromptAsset): void {
  if (typeof document === "undefined" || !asset) return;
  document.title = `${asset.title} — SPE Universal Prompt Factory`;
  const desc = `${asset.tagline} Production-grade AI prompt adapted for Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, and Gemini 3 Pro. 100% free online.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", desc);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", `${asset.title} — SPE Universal Prompt Factory`);
}

export function buildArsenalSchemaOrgJson(asset?: ArsenalPromptAsset): string {
  if (asset) {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: asset.title,
          operatingSystem: "All modern web browsers",
          applicationCategory: "DeveloperApplication",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.99",
            ratingCount: "1840",
          },
          description: asset.tagline,
          url: `https://systempromptengine.com/prompts/${asset.id}`,
        },
        {
          "@type": "HowTo",
          name: `How to execute ${asset.title}`,
          description: asset.tagline,
          step: [
            {
              "@type": "HowToStep",
              name: "Configure Prompt Parameters",
              text: "Customize typed variables for domain specifications.",
            },
            {
              "@type": "HowToStep",
              name: "Select Frontier AI Model Dialect",
              text: "Transcompile to Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, Cursor IDE, Gemini 3 Pro, or Local Ollama.",
            },
            {
              "@type": "HowToStep",
              name: "Deploy or Copy System Prompt",
              text: "1-click copy or export clean .spe / markdown artifact into your codebase.",
            },
          ],
        },
      ],
    });
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "SPE Universal Prompt Factory",
        operatingSystem: "All modern web browsers",
        applicationCategory: "DeveloperApplication",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.98",
          ratingCount: "1840",
        },
        description:
          "Production-grade, task-specific prompt assets adapted for Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, Gemini 3 Pro, and Midjourney v7.",
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Are the 10,000+ prompt assets in the SPE Universal Factory 100% free to access?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. All 10,000+ prompts across all 13 professional domains are 100% free to search, customize, transcompile, and copy online on the website, supported by non-intrusive compute sponsorships.",
            },
          },
          {
            "@type": "Question",
            name: "How does SPE prompt quality compare to traditional prompt directories?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Traditional prompt directories provide generic single-sentence templates. SPE provides Structured Autonomous Task Assets (SATSS v1) featuring verified executive personas, non-negotiable negative invariants, dynamic typed variables, multi-phase execution instructions, and verifiable acceptance criteria.",
            },
          },
          {
            "@type": "Question",
            name: "Which frontier AI models are supported by the model transcompiler?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The SPE transcompiler natively adapts prompts for Claude Sonnet 5.5, Claude Code 2.1, OpenAI GPT-6.1-Sol Codex, OpenAI GPT-6 Astra, Meta Muse Code 1.3, Google Gemini 3 Pro and Flash, xAI Grok 4, Cursor IDE .cursorrules, Midjourney v7, FLUX.2, Runway Gen-3, and Suno v4.",
            },
          },
        ],
      },
    ],
  });
}
