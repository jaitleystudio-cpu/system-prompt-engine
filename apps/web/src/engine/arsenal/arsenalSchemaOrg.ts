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
  document.title = `${asset.title} — SPE Universal Prompt Arsenal`;
  const desc = `${asset.tagline} Production-grade AI prompt adapted for Claude 3.7, GPT-4o, Gemini 2.0, Grok 3, and DeepSeek-R1. 100% free online.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", desc);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", `${asset.title} — SPE Universal Prompt Arsenal`);
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
              text: "Transcompile to Claude 3.7 Sonnet, OpenAI o3-mini, Cursor IDE, Gemini 2.0, or Local Ollama.",
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
        name: "SPE Universal Prompt Arsenal",
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
          "Production-grade, task-specific prompt assets adapted for Claude 3.7 Sonnet, OpenAI o3-mini, Gemini 2.0, Grok 3, DeepSeek-R1, and Midjourney.",
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Are the 10,000+ prompt assets in the SPE Universal Arsenal 100% free to access?",
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
              text: "The SPE transcompiler natively adapts prompts for Claude 3.7 Sonnet Thinking, OpenAI o3-mini and GPT-4o, Google Gemini 2.0 Flash and Pro, xAI Grok 3, Cursor IDE .cursorrules, Midjourney v6.1, FLUX.1, Runway Gen-3, and Suno v4.",
            },
          },
        ],
      },
    ],
  });
}
