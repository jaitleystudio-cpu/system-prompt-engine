/**
 * SPE Ω — Power Prompts Vault & Catalog
 * Curated, verified, drift-resilient 1-click prompts for modern frontier models
 * (Claude 3.7 Sonnet, GPT-4o, Gemini 2.0 Flash)
 */

export interface PromptVariable {
  name: string;
  label: string;
  placeholder: string;
  default?: string;
}

export interface PowerPrompt {
  id: string;
  title: string;
  tagline: string;
  category: "SEO" | "Marketing" | "Coding" | "Business" | "Writing";
  icon: string;
  outcome: string;
  author: string;
  verified: boolean;
  upvotes: number;
  uses: number;
  targetModels: Array<"openai-6" | "claude-6" | "astra-6-1" | "fable-5" | "local">;
  variables: PromptVariable[];
  template: string;
}

export const POWER_PROMPTS_VAULT: PowerPrompt[] = [
  // --- SEO & SEARCH ---
  {
    id: "seo-outrank-competitor",
    title: "#1 Google Outranking Blueprint",
    tagline: "Outrank any competitor article with complete E-E-A-T depth and zero fluff",
    category: "SEO",
    icon: "🎯",
    outcome: "Full 2,000+ word rank-ready article with semantic entities, FAQs & zero fluff",
    author: "SPE SEO Lab",
    verified: true,
    upvotes: 4892,
    uses: 68420,
    targetModels: ["openai-6", "claude-6", "astra-6-1", "fable-5"],
    variables: [
      { name: "keyword", label: "Target Keyword", placeholder: "e.g. best crm for startups", default: "best crm for small business" },
      { name: "competitor_focus", label: "Competitor Topic / Weakness", placeholder: "e.g. competitor lacks real pricing comparison", default: "focus on hidden fees and real team onboarding" }
    ],
    template: `Act as a world-class SEO strategist and domain expert writer.
Your objective is to write an exhaustive, authoritative, search-dominant article targeting the primary keyword: "{keyword}".

Core Content Requirements:
1. User Intent: Deliver immediate value within the first 100 words. Answer the search intent directly before delving into sub-topics.
2. Competitive Advantage: Specifically outperform competitors on {competitor_focus}.
3. Entity Coverage: Semantically incorporate relevant industry concepts, real-world examples, and data points.
4. Structure:
   - Catchy H1 with high click-through appeal.
   - H2 and H3 subheadings matching search intent questions.
   - Comparison / Decision Framework table where appropriate.
   - Actionable step-by-step guidance.
   - 4-5 High-value FAQ schema answers answering "People Also Ask" questions.
5. Voice: Authoritative, natural, human tone. Never use generic AI fluff (banned: "delve", "testament", "tapestry", "in today's fast-paced world").`
  },
  {
    id: "seo-semantic-keyword-cluster",
    title: "Semantic Keyword & Topic Cluster Architect",
    tagline: "Turn 1 keyword into a complete 30-day topical authority blueprint",
    category: "SEO",
    icon: "🗺️",
    outcome: "Full pillar-cluster map with search intents and content priorities",
    author: "SPE SEO Lab",
    verified: true,
    upvotes: 3740,
    uses: 41900,
    targetModels: ["openai-6", "claude-6", "astra-6-1", "fable-5"],
    variables: [
      { name: "seed_topic", label: "Seed Topic / Niche", placeholder: "e.g. cold email automation", default: "b2b lead generation" }
    ],
    template: `Act as a Senior SEO Topical Authority Architect.
Analyze the seed topic "{seed_topic}" and build a comprehensive Topical Authority Cluster.

Generate:
1. The Core Pillar Page: Define the overarching comprehensive guide title and core angle.
2. 5 Sub-Topic Clusters: For each cluster:
   - Cluster Name & Strategic Purpose.
   - 4 Supporting Article Titles targeting long-tail queries.
   - Search Intent Classification (Informational, Commercial, or Transactional).
   - Internal Linking Architecture: How each article links back to the pillar and siblings.
3. Content Production Priority: Ranked list from highest commercial value to supportive educational content.`
  },
  {
    id: "seo-schema-and-meta-suite",
    title: "Technical Schema & High-CTR Meta Suite",
    tagline: "Generate JSON-LD Rich Snippets & 10 Click-Magnetic Meta Titles",
    category: "SEO",
    icon: "⚡",
    outcome: "Google Rich-Result ready JSON-LD code and high CTR titles under 60 chars",
    author: "SPE SEO Lab",
    verified: true,
    upvotes: 2950,
    uses: 33100,
    targetModels: ["openai-6", "claude-6"],
    variables: [
      { name: "page_topic", label: "Page Topic or Product", placeholder: "e.g. AI Prompt Optimization Tool", default: "System Prompt Engine" },
      { name: "primary_benefit", label: "Main Value Proposition", placeholder: "e.g. 1-click power prompts without hallucinations", default: "Zero-hallucination verified prompts for Claude & ChatGPT" }
    ],
    template: `Act as a Technical SEO and CTR Optimization Engineer.
For a page about "{page_topic}" delivering "{primary_benefit}":

1. High-CTR Title Tags: Provide 8 distinct meta title options strictly between 50 and 60 characters. Include brackets/numbers/emotional hooks where effective.
2. Meta Descriptions: Provide 5 high-converting meta descriptions strictly between 140 and 155 characters with a compelling call-to-action.
3. Valid JSON-LD Structured Data: Generate a production-ready, validated JSON-LD schema block (Article + FAQPage combined). Ensure zero syntax errors.`
  },

  // --- MARKETING & COPYWRITING ---
  {
    id: "copy-high-converting-landing-page",
    title: "High-Converting SaaS Landing Page Copy",
    tagline: "Write a high-converting landing page using direct-response principles",
    category: "Marketing",
    icon: "💎",
    outcome: "Hero, PAS problem agitation, social proof, feature-benefits, and CTA",
    author: "SPE Growth Lab",
    verified: true,
    upvotes: 5610,
    uses: 89100,
    targetModels: ["openai-6", "claude-6", "astra-6-1", "fable-5"],
    variables: [
      { name: "product_name", label: "Product Name", placeholder: "e.g. FlowState", default: "SPE" },
      { name: "target_audience", label: "Target Audience", placeholder: "e.g. busy founders & marketers", default: "marketers, agency owners, and AI creators" },
      { name: "core_pain", label: "Biggest Pain Point", placeholder: "e.g. wasting hours on generic ChatGPT outputs", default: "wasting hours wrestling with brittle, hallucinating AI prompts" },
      { name: "unique_solution", label: "Unique Solution / Mechanism", placeholder: "e.g. 1-click verified prompts that never drift", default: "1-click verified prompts with mathematical hallucination shields" }
    ],
    template: `Act as an elite Direct-Response SaaS Copywriter (in the lineage of Eugene Schwartz and David Ogilvy).
Write the complete high-converting landing page copy for {product_name}.

Context:
- Target Customer: {target_audience}
- Acute Pain: {core_pain}
- Unique Mechanism: {unique_solution}

Write out each section clearly:
1. Above-The-Fold Hero Section:
   - Punchy Pre-Headline (Badge/Social proof)
   - Primary Headline (Bold, clear, outcome-focused)
   - Sub-headline (Specific, removes friction, handles #1 objection)
   - Primary Call-to-Action button text + Microcopy ("No credit card required / 30-sec setup")
2. The "Villain & Problem" Agitation (PAS Framework):
   - Paint the current painful reality without the solution.
3. The Breakthrough Mechanism:
   - Introduce how {unique_solution} solves this permanently.
4. 3 Core Benefit Blocks (Feature -> Human Transformation):
   - Format: [Punchy Benefit Headline] -> [What it actually does for the user's day].
5. Risk Reversal & Final Action Push:
   - Guarantee block and final urgent CTA.`
  },
  {
    id: "copy-viral-hook-and-thread",
    title: "Viral Social Hook & Thought Leadership Post",
    tagline: "Turn any complex idea into a high-engagement LinkedIn & X post",
    category: "Marketing",
    icon: "🚀",
    outcome: "Scroll-stopping hook, 8-part narrative progression, zero AI cringe",
    author: "SPE Growth Lab",
    verified: true,
    upvotes: 4120,
    uses: 57200,
    targetModels: ["openai-6", "claude-6"],
    variables: [
      { name: "core_insight", label: "Core Insight / Story", placeholder: "e.g. why 90% of AI prompts fail in production", default: "why most AI prompt tools are selling 2023 snake oil and how real prompt engineering works" },
      { name: "target_reader", label: "Target Reader", placeholder: "e.g. founders & developers", default: "AI founders, developers, and tech marketers" }
    ],
    template: `Act as a top 0.1% Tech Creator & Social Storyteller.
Transform this core insight: "{core_insight}" into a viral, high-authority social post tailored for {target_reader}.

Requirements:
1. 3 Alternative Hooks (1st line):
   - Hook A: The Counter-Intuitive Truth (shatters a common belief)
   - Hook B: The Hard Lesson (personal vulnerability + high stakes)
   - Hook C: The Data / Case Study Revelation
2. Post Body:
   - Short, punchy sentences. High whitespace.
   - Deliver 3-5 concrete, immediately actionable takeaways.
   - Use concrete specifics rather than abstract generalities.
3. Zero Fluff: Completely ban AI tropes ("Here's the kicker", "Let's dive in", "Agree or disagree?").
4. Closing: Memorable punchline + genuine discussion starter.`
  },
  {
    id: "copy-cold-email-sequence",
    title: "B2B Cold Outreach Email Sequence",
    tagline: "3-step cold email campaign with 40%+ open rates and friction-free reply hooks",
    category: "Marketing",
    icon: "✉️",
    outcome: "Day 1 Hook, Day 4 Value Add, and Day 8 Breakup Email with subject lines",
    author: "SPE Growth Lab",
    verified: true,
    upvotes: 3820,
    uses: 48900,
    targetModels: ["openai-6", "claude-6"],
    variables: [
      { name: "offer", label: "Your Offer / Product", placeholder: "e.g. automated security audit tool", default: "automated AI prompt verification and quality assurance" },
      { name: "prospect_role", label: "Prospect Job Title", placeholder: "e.g. VP of Marketing", default: "Head of AI / Product Lead" },
      { name: "prospect_pain", label: "Their Primary Pain", placeholder: "e.g. AI agent hallucinations causing customer complaints", default: "brittle prompts breaking whenever underlying models update" }
    ],
    template: `Act as a B2B Outbound Sales Specialist specializing in high-reply cold outreach.
Write a 3-touch cold email sequence pitching "{offer}" to a "{prospect_role}" experiencing "{prospect_pain}".

Sequence Specifications:
1. Email 1 (Day 1 - The 50-word Observation):
   - Subject lines: 3 ultra-short, curiosity-driven subject lines (2-4 words, lowercase).
   - Hook: Reference a relevant industry reality without sounding fake.
   - Value: One clear sentence on how we eliminate {prospect_pain}.
   - Call to Action: Low-friction interest CTA (e.g. "Worth a quick 2-min loom, or terrible timing?"). Under 75 words total.
2. Email 2 (Day 4 - The Concrete Proof / Insight):
   - Reference previous message with a 1-sentence value teardown or micro-case study.
3. Email 3 (Day 8 - The Polite Permission Breakup):
   - Clean, professional closing that gives permission to say no while leaving the door open.`
  },

  // --- CODING & TECH ---
  {
    id: "code-fullstack-feature-architect",
    title: "Full-Stack Feature Architecture & Implementation Plan",
    tagline: "Architect complex features with end-to-end contracts, DB schemas & tests",
    category: "Coding",
    icon: "🛠️",
    outcome: "Step-by-step TDD implementation plan with typed schemas and zero guesswork",
    author: "SPE Engineering Lab",
    verified: true,
    upvotes: 6180,
    uses: 92400,
    targetModels: ["claude-6", "openai-6"],
    variables: [
      { name: "feature_desc", label: "Feature Description", placeholder: "e.g. Multi-tenant team invitation system with role-based permissions", default: "Browser extension companion for 1-click prompt injection into ChatGPT and Claude" },
      { name: "tech_stack", label: "Tech Stack", placeholder: "e.g. Next.js 15, PostgreSQL, Drizzle, Tailwind", default: "TypeScript, Chrome Manifest V3, Vite, React" }
    ],
    template: `Act as a Principal Full-Stack Software Architect.
Produce an end-to-end, production-grade Implementation Plan for:
"{feature_desc}"
Stack: {tech_stack}

Structure the architecture blueprint into:
1. Domain Model & Data Schemas: Strict TypeScript interfaces, database tables/entities, and migration constraints.
2. API / Communication Contracts: Request/response payloads, validation rules, and error envelopes.
3. Edge Cases & Failure Modes: Identify at least 5 potential race conditions, auth bypasses, or boundary errors with concrete mitigations.
4. Step-by-Step Implementation Checklist:
   - Phase 1: Core domain types & storage
   - Phase 2: Runtime engine & handler logic
   - Phase 3: UI components & user state flow
   - Phase 4: Unit, integration, and security test gates.
Ensure zero speculative dependencies.`
  },
  {
    id: "code-root-cause-debugger",
    title: "Production Root-Cause Debugger & Fixer",
    tagline: "Diagnose mysterious bugs, explain root causes & output minimal clean diffs",
    category: "Coding",
    icon: "🩺",
    outcome: "Root cause diagnosis, reproduction steps, exact fix, and regression test",
    author: "SPE Engineering Lab",
    verified: true,
    upvotes: 5310,
    uses: 76800,
    targetModels: ["claude-6", "openai-6"],
    variables: [
      { name: "error_or_bug", label: "Error Message / Bug Behavior", placeholder: "e.g. TypeError: Cannot read properties of undefined (reading 'token')", default: "Event listener memory leak when switching tabs in Chrome extension" },
      { name: "code_context", label: "Relevant Code Context", placeholder: "Paste code snippet or component logic", default: "chrome.tabs.onUpdated.addListener(...) without removal on unmount" }
    ],
    template: `Act as an elite Systems Debugger and Senior Staff Engineer.
Analyze this issue:
Bug / Error: {error_or_bug}
Code Context: {code_context}

Provide a disciplined diagnostic report:
1. Root Cause Analysis: Explain the exact mechanism of the failure down to the language runtime / event lifecycle level.
2. Reproduction Scenario: Minimal conditions required to reliably trigger this bug.
3. The Minimal Correct Fix: Provide the exact code replacement (clean, readable diff) without touching unrelated logic.
4. Regression Test: Provide an automated unit test that fails on the buggy code and passes on the fix.`
  },

  // --- BUSINESS & STRATEGY ---
  {
    id: "biz-yc-pitch-deck-scrutinizer",
    title: "YC Pitch Deck Scrutinizer & Moat Stress-Tester",
    tagline: "Stress-test your startup pitch against ruthless venture partner critiques",
    category: "Business",
    icon: "🏛️",
    outcome: "Vulnerability audit, defensibility teardown, and 5 unanswerable partner questions",
    author: "SPE Strategy Lab",
    verified: true,
    upvotes: 4420,
    uses: 51200,
    targetModels: ["claude-6", "openai-6"],
    variables: [
      { name: "startup_summary", label: "Startup Elevator Pitch", placeholder: "e.g. AI customer support agent that learns from Slack tickets", default: "System Prompt Engine: the open compiler and browser companion for AI instruction assurance and prompt optimization" },
      { name: "pricing_model", label: "Business Model / Pricing", placeholder: "e.g. Freemium with $29/mo pro and enterprise seats", default: "Free browser companion + $20/mo Pro + Enterprise compliance assurance" }
    ],
    template: `Act as a cynical, top-tier Silicon Valley Venture Partner (ex-Y Combinator / Benchmark partner).
Critique this startup concept:
Pitch: {startup_summary}
Model: {pricing_model}

Deliver a brutal, high-stakes evaluation:
1. The Fatal Blind Spot: What is the single biggest assumption that could kill this company in the next 18 months?
2. Defensibility & Moat Analysis: Why won't OpenAI, Google, or Anthropic obsolete this in their next release? What prevents copycats?
3. Distribution Velocity: How does this reach 100,000 users without spending all funding on Google/Meta ads?
4. 5 Ruthless Partner Questions: Give the 5 hardest questions the founders will be asked in a partner meeting, along with the ideal evidence-backed answer.`
  },

  // --- HUMAN WRITING & CREATIVE ---
  {
    id: "write-100-percent-humanizer",
    title: "100% Human Style Rewriter (AI Fluff Stripper)",
    tagline: "Strip generic robotic AI prose and rewrite in authentic, punchy human cadence",
    category: "Writing",
    icon: "✍️",
    outcome: "Natural, engaging human copy that sounds like a master human essayist",
    author: "SPE Writing Lab",
    verified: true,
    upvotes: 7290,
    uses: 114000,
    targetModels: ["claude-6", "openai-6", "astra-6-1"],
    variables: [
      { name: "draft_text", label: "Text to Humanize", placeholder: "Paste your AI-generated text here", default: "In today's fast-paced digital world, leveraging AI is crucial for businesses seeking to maximize efficiency and unlock unparalleled growth..." }
    ],
    template: `Act as an award-winning editor and literary essayist.
Rewrite the following text into authentic, engaging, natural human voice:
"{draft_text}"

Editing Invariants:
1. Ban AI Clichés: Completely purge words like: "delve", "tapestry", "beacon", "crucial", "testament", "fast-paced world", "unparalleled", "realm", "paramount", "in conclusion".
2. Vary Sentence Rhythm: Mix short 3-word punchy sentences with longer, rhythmic observations.
3. Show, Don't Preach: Replace vague corporate claims with concrete examples and active verbs.
4. Keep the Original Meaning: Preserve all factual information while upgrading the craft.`
  }
];

export function compilePowerPrompt(prompt: PowerPrompt, varValues: Record<string, string>): string {
  let result = prompt.template;
  for (const v of prompt.variables) {
    const val = varValues[v.name]?.trim() || v.default || v.placeholder;
    result = result.replace(new RegExp(`\\{${v.name}\\}`, "g"), val);
  }
  return result;
}
