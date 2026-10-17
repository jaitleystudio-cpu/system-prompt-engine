/**
 * SPE Ω PRO vs. Feedough.com — Empirical Head-to-Head & Competitive Intelligence Matrix
 * Isolates comparative benchmark figures and founder presets inside engine/ to keep UI copy clean.
 */

export interface CompetitorComparisonDimension {
  id: string;
  dimensionName: string;
  feedoughScore: number;
  speScore: number;
  winner: "SPE" | "Feedough" | "Tie";
  feedoughReality: string;
  speAdvantage: string;
}

export const FEEDOUGH_COMPETITIVE_MATRIX: readonly CompetitorComparisonDimension[] = [
  {
    id: "DIM-01",
    dimensionName: "Prompt Engineering & Cognitive Depth",
    feedoughScore: 3.0,
    speScore: 9.8,
    winner: "SPE",
    feedoughReality: "Naive web-form string concatenation with generic filler ('delve into', 'foster collaboration').",
    speAdvantage: "SATSS v1 enterprise cognitive constraints, formal propositional logic, and anti-drift invariants.",
  },
  {
    id: "DIM-02",
    dimensionName: "Adversarial Security & OWASP Red-Teaming",
    feedoughScore: 0.0,
    speScore: 9.9,
    winner: "SPE",
    feedoughReality: "Zero injection protection. Succumbs to 10/10 OWASP LLM attack probes with simple delimiter escapes.",
    speAdvantage: "1-Click SATSS v1 Automated Immunizer. Injects invariant seals and emits cryptographic certificates (100% pass).",
  },
  {
    id: "DIM-03",
    dimensionName: "Model-Specific Transcompilation",
    feedoughScore: 2.0,
    speScore: 9.7,
    winner: "SPE",
    feedoughReality: "Generic one-size-fits-all text dumped into a textarea.",
    speAdvantage: "Transcompiles bit-for-bit into Claude XML, Cursor .cursorrules, Windsurf, Grok 4, and Ollama Modelfiles across 44 models.",
  },
  {
    id: "DIM-04",
    dimensionName: "Live Evaluation & Assertion Engine",
    feedoughScore: 0.0,
    speScore: 9.6,
    winner: "SPE",
    feedoughReality: "No execution runner, no latency measurement, zero assertion validation.",
    speAdvantage: "EvalStudio runs live side-by-side matrices (Claude Sonnet 5.5 vs OpenAI GPT-6.1-Sol vs Gemini 3.8 Flash vs Aragon 4) with 50+ assertion rules.",
  },
  {
    id: "DIM-05",
    dimensionName: "Developer CLI & CI/CD Automation",
    feedoughScore: 0.0,
    speScore: 9.5,
    winner: "SPE",
    feedoughReality: "Pure browser web forms with zero automation or terminal integration.",
    speAdvantage: "38-command CLI battery (`spe continue -`, `spe eval`, `spe check --pre-commit`) and automated GitHub Actions.",
  },
  {
    id: "DIM-06",
    dimensionName: "Privacy, Data Custody & Air-Gap",
    feedoughScore: 2.0,
    speScore: 10.0,
    winner: "SPE",
    feedoughReality: "Sends user input to cloud servers packed with third-party advertising trackers and cookies.",
    speAdvantage: "100% client-side in-browser WebAssembly with zero network egress. Private workspaces are strictly ad-free.",
  },
  {
    id: "DIM-07",
    dimensionName: "Browser Extension Cross-Platform Reach",
    feedoughScore: 8.0,
    speScore: 9.5,
    winner: "SPE",
    feedoughReality: "Basic web extension for Chrome/Firefox injecting simple text prompts into chat boxes.",
    speAdvantage: "Universal Manifest V3 companion across Chrome, Safari (native Swift), Firefox, and Edge with auto-action engine.",
  },
  {
    id: "DIM-08",
    dimensionName: "Economics & Monetization Efficiency",
    feedoughScore: 4.0,
    speScore: 9.8,
    winner: "SPE",
    feedoughReality: "Dependent on low-CPM intrusive display ad banners ($2-$5 RPM) that degrade user experience.",
    speAdvantage: "$0 server GPU compute cost + high-margin $9/mo Pro and $99/mo Team subscriptions + clean developer sponsorships.",
  },
] as const;

export interface FounderStrategyPreset {
  id: string;
  title: string;
  category: "Strategy" | "Economics" | "Pitch" | "Validation";
  brief: string;
  targetModel: string;
  estimatedTokens: number;
  promptDirective: string;
}

export const FOUNDER_STRATEGY_PRESETS: readonly FounderStrategyPreset[] = [
  {
    id: "FND-01",
    title: "📊 Business Model Canvas (Osterwalder Framework)",
    category: "Strategy",
    brief: "Generate an exhaustive Business Model Canvas covering 9 value blocks, customer segments, revenue streams, and cost structures with zero fluff.",
    targetModel: "Claude Sonnet 5.5 / OpenAI GPT-6.1-Sol",
    estimatedTokens: 2400,
    promptDirective: `You are an elite enterprise strategy architect. Conduct an exhaustive Business Model Canvas analysis using Alexander Osterwalder's formal framework for the specified business.

Analyze and specify all 9 foundational blocks with quantitative precision:
1. Customer Segments: Primary ICP, secondary segments, non-customers, and demographic/psychographic boundaries.
2. Value Propositions: Differentiated benefits per segment, pains relieved, gains created, and unique structural advantage.
3. Channels: Awareness, evaluation, purchase, delivery, and post-purchase retention channels.
4. Customer Relationships: Acquisition model, retention mechanisms, switching barriers, and dedicated support tiering.
5. Revenue Streams: Pricing model (subscription, usage-based, licensing), gross margins, willingness-to-pay rationale, and expansion levers.
6. Key Resources: Physical, intellectual, human, financial, and proprietary data assets.
7. Key Activities: Product engineering, go-to-market execution, regulatory compliance, and platform operations.
8. Key Partnerships: Upstream suppliers, distribution alliances, platform co-marketing, and joint ventures.
9. Cost Structure: Fixed vs variable cost dynamics, unit economic drivers, economies of scale, and break-even trajectory.

Output the analysis in structured markdown tables followed by an executive summary highlighting the single most fragile vulnerability in the business model.`,
  },
  {
    id: "FND-02",
    title: "🏰 Strategic Moat & Competitive Defense Engine",
    category: "Strategy",
    brief: "Conduct a ruthless Porter's 5 Forces analysis examining switching costs, network effects, distribution monopolies, and substitution threats.",
    targetModel: "Claude Sonnet 5.5 / Grok 4",
    estimatedTokens: 2800,
    promptDirective: `You are a Principal at a top-tier venture firm specializing in competitive defensibility and structural moats.

Evaluate the subject company using Michael Porter's Five Forces Framework augmented with modern tech moat theory (Hamilton Helmer's 7 Powers):

1. Threat of New Entrants: Capital intensity, proprietary IP, regulatory barriers, and customer acquisition costs.
2. Bargaining Power of Suppliers: Key component concentration, platform risk (OpenAI, AWS, Apple App Store), and multi-vendor resilience.
3. Bargaining Power of Buyers: Switching costs, price sensitivity, commodity alternatives, and customer concentration ratio.
4. Threat of Substitute Products/Services: Adjacent software solutions, open-source alternatives, in-house DIY builds, and workflow inertia.
5. Intensity of Competitive Rivalry: Existing competitor matrix, pricing wars, feature parity pace, and gross margin pressure.

Assess Helmer's 7 Powers applicability: Scale Economies, Network Effects, Counter-Positioning, Switching Costs, Branding, Cornered Resource, and Process Power.

Assign a Defensibility Rating (0 to 100) for each dimension and conclude with 3 concrete offensive moat investments the founder must execute within 90 days.`,
  },
  {
    id: "FND-03",
    title: "📈 SaaS Unit Economics & CAC Payback Matrix",
    category: "Economics",
    brief: "Model unit economics, LTV/CAC ratios, Gross Margins, Net Revenue Retention (NRR), and cash-flow sensitivity curves for B2B SaaS.",
    targetModel: "Claude Haiku 5.5 / OpenAI GPT-6.1-Sol",
    estimatedTokens: 3200,
    promptDirective: `You are a Chief Financial Officer for high-growth software enterprises. Build an authoritative, mathematically rigorous unit economics and financial sensitivity model.

Calculate, format, and interpret the following financial metrics with explicit formulas:
1. Customer Lifetime Value (LTV): Gross Margin Adjusted LTV = (ARPU × Gross Margin %) / Churn Rate.
2. Customer Acquisition Cost (CAC): Blended CAC vs Fully-Loaded Paid CAC (including sales/marketing salaries, ad spend, and onboarding overhead).
3. LTV/CAC Ratio: Target benchmark (>3.0x healthy, >5.0x hyper-efficient).
4. CAC Payback Period (Months): CAC / (ARPU × Gross Margin %).
5. Net Revenue Retention (NRR) & Gross Revenue Retention (GRR): Expansion cohort modeling.
6. Magic Number & Burn Multiple: Net New ARR / Sales & Marketing Spend.
7. Sensitivity Matrix: Tabulate CAC Payback and LTV under 3 churn scenarios (0.5%/mo, 1.5%/mo, 3.0%/mo) and 3 pricing tiers.

Provide a clear executive financial diagnostic: Is this business economically viable for venture scale, and what is the optimal pricing strategy to maximize ARR growth?`,
  },
  {
    id: "FND-04",
    title: "🚀 Venture Capital Pitch Deck Architect (12 Slides)",
    category: "Pitch",
    brief: "Compile a 12-slide investor pitch deck structure with problem statement, secret sauce, TAM/SAM/SOM calculation, and milestone-based use of funds.",
    targetModel: "Claude Sonnet 5.5 / Gemini 3.8 Flash / Aragon 4",
    estimatedTokens: 2600,
    promptDirective: `You are a partner at Sequoia Capital advising a seed/Series A founder on crafting a 10/10 investor presentation.

Structure an exact 12-slide pitch deck narrative adhering to the highest venture standards:
Slide 1: Title & One-Line Mission Statement (The 'Uber for X' or structural shift thesis).
Slide 2: The Urgent Problem (Acute pain, quantification of wasted dollars/hours, why current solutions fail).
Slide 3: The Breakthrough Solution (Product snapshot, core mechanism, user delight moment).
Slide 4: Market Timing ('Why Now?': 2-3 secular technological, regulatory, or behavioral catalysts).
Slide 5: Total Addressable Market (TAM / SAM / SOM bottom-up derivation with verifiable assumptions).
Slide 6: Product Architecture & Secret Sauce (Proprietary IP, technical moat, algorithmic leverage).
Slide 7: Business Model & Pricing (Unit economics, monetization levers, expansion trajectory).
Slide 8: Traction & Velocity (Key milestones achieved, MoM growth rate, waitlist/customer pipeline).
Slide 9: Competitive Landscape (2x2 perceptual map and feature differentiation matrix showing true white space).
Slide 10: Go-To-Market Strategy (Acquisition loops, developer adoption flywheels, inbound SEO vs outbound sales).
Slide 11: Core Team & Unfair Advantages (Founder-market fit, previous exits, domain expertise).
Slide 12: The Ask & 18-Month Milestones (Capital raise target, exact use of funds breakdown, next financing goals).

For each slide, specify: (a) Header headline, (b) Key visual layout concept, (c) Exact talking point bullets, and (d) The anticipated investor pushback question and recommended answer.`,
  },
  {
    id: "FND-05",
    title: "🧪 Startup Idea & Niche Falsification Protocol",
    category: "Validation",
    brief: "Challenge core business assumptions with adversarial falsification criteria, mom-test customer discovery questions, and smoke-test conversion tests.",
    targetModel: "Claude Sonnet 5.5 / DeepSeek-R2",
    estimatedTokens: 2500,
    promptDirective: `You are an adversarial business red-teamer tasked with stress-testing a new startup hypothesis before capital is committed.

Conduct a rigorous falsification audit across 4 critical failure domains:
1. Desirability Falsification: Formulate 5 Mom-Test style customer interview questions that cannot be answered with polite validation. Identify the signal that proves customers DO NOT actually care.
2. Viability Falsification: What regulatory, legal, or platform risk (e.g. Google algorithm change, Apple App Store rejection, OpenAI feature release) could instantly destroy this business model?
3. Feasibility Falsification: What technical assumption (latency, token costs, hallucination rates, API rate limits) is most likely to break under production load?
4. Unit Economics Falsification: Under what realistic CAC and churn conditions does the company exhaust its cash runway before reaching default-alive status?

Conclude with a 7-day smoke-test experiment design (landing page, ad spend budget <$100, target conversion rate threshold) that will objectively validate or invalidate the core hypothesis before building any code.`,
  },
] as const;

export interface CompareTabOption {
  id: "benchmarks" | "global" | "feedough" | "founder";
  label: string;
  badge: string;
}

export const COMPARE_TABS: readonly CompareTabOption[] = [
  { id: "benchmarks", label: "Skill & Evaluation Benchmarks", badge: "5 Suites" },
  { id: "global", label: "Global Top 10 Truth Matrix", badge: "10 Platforms" },
  { id: "feedough", label: "SPE vs Feedough.com Moat Matrix", badge: "8 Dimensions" },
  { id: "founder", label: "Founder & Strategy Presets", badge: "5 Blueprints" },
] as const;

export const COMPARE_VIEW_STRINGS = {
  headerTitle: "Benchmark Arena · Accuracy & Token Tests",
  headerSubtitle: "Empirical head-to-head benchmarks proving accuracy gains, token savings, and retry reductions with zero small-sample hype.",
  feedoughBannerTitle: "Feedough.com vs. SPE Ω PRO — The Moat & Security Audit",
  feedoughBannerSubtitle: "Direct architectural comparison between legacy SEO text form templates and SPE's zero-cloud-cost compiler, SATSS v1 cognitive constraints, and 1-click immunization.",
  founderBannerTitle: "Founder & Strategy Prompt Presets",
  founderBannerSubtitle: "Production-grade strategic prompt architectures for business models, defensibility moats, SaaS metrics, and investor decks.",
  avgFeedoughScore: "2.3 / 10",
  avgSpeScore: "9.7 / 10",
  verdictSummary: "SPE Outperforms Feedough in 8 of 8 Evaluated Dimensions",
  copyBenchmarkCmd: "Copy Benchmark Command",
  copyPromptDirective: "Copy Prompt Directive",
  copied: "Copied!",
  launchInStudio: "Launch in Studio ⚡",
  dimension: "Dimension",
  feedoughLegacy: "Feedough.com (Legacy Web Forms)",
  spePro: "SPE Ω PRO (Antigravity Engine)",
  winner: "Winner",
  realityVsAdvantage: "Empirical Reality & Technical Moat",
  targetModelLabel: "Target Model:",
  estTokensLabel: "Estimated Tokens:",
  categoryLabel: "Category:",
  configuration: "Configuration",
  observedSuccess: "Observed Success",
  wilsonBound: "Wilson 95% Lower Bound",
  avgTokenConsumption: "Avg Token Consumption",
  verdict: "Verdict",
  baselineVerdict: "Baseline",
  qualifiedWinner: "QUALIFIED WINNER",
} as const;


