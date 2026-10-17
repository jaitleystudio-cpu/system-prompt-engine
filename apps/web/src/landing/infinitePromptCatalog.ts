import type { CategoryId } from "@spe/web-runtime";

export interface InfinitePromptItem {
  id: string;
  label: string;
  category: CategoryId;
  text: string;
  badge?: string;
}

export interface PromptEvolutionModifier {
  id: string;
  label: string;
  clause: string;
  domain: string;
}

/**
 * Canonical 4 starters: kept in initial slots 0-3 for seamless continuity
 * and backwards compatibility with test fixtures.
 */
export const CANONICAL_STARTER_PROMPTS: InfinitePromptItem[] = [
  {
    id: "canonical-code-review",
    label: "Review code without hallucinations",
    category: "Coding",
    text: "Review the code I provide for correctness, security and maintainability. Rank findings by severity and include the affected code and a concrete fix. Do not invent files, imports, or unverified tests.",
    badge: "Reliability",
  },
  {
    id: "canonical-fullstack-feature",
    label: "Plan a full-stack feature",
    category: "Coding",
    text: "Design a complete end-to-end implementation plan for this full-stack feature. Include database schemas, API contracts, frontend state transitions, and step-by-step verification gates.",
    badge: "Architecture",
  },
  {
    id: "canonical-exec-report",
    label: "Executive weekly progress report",
    category: "Business",
    text: "Synthesize team achievements, key metrics, active blockers, and high-priority milestones into a concise executive summary formatted for leadership review.",
    badge: "Leadership",
  },
  {
    id: "canonical-ticket-triage",
    label: "Customer ticket triage & response",
    category: "Business",
    text: "Analyze customer support inquiries, identify root causes, classify severity, and draft empathetic, accurate response drafts with concrete resolution steps.",
    badge: "Support",
  },
];

/**
 * Deep reservoir of curated, high-impact prompt blueprints.
 * Sequenced dynamically into slots upon single-pill clicks or reel rolls.
 */
export const INFINITE_PROMPT_POOL: InfinitePromptItem[] = [
  ...CANONICAL_STARTER_PROMPTS,
  {
    id: "inf-refactor-hooks",
    label: "Refactor to modern React hooks & memo",
    category: "Coding",
    text: "Refactor the legacy React component into clean functional components using modern hooks, granular useMemo/useCallback boundaries, and zero unnecessary re-renders.",
    badge: "Frontend",
  },
  {
    id: "inf-graphql-cursor",
    label: "Design GraphQL cursor pagination",
    category: "Coding",
    text: "Design a high-throughput GraphQL schema featuring Relay-compliant cursor pagination, connection edges, total count projections, and efficient backward/forward navigation.",
    badge: "API",
  },
  {
    id: "inf-sql-covering-idx",
    label: "Optimize SQL & covering indexes",
    category: "Coding",
    text: "Analyze this slow SQL query. Provide an optimized rewrite using covering indexes, CTE query plans, and partition pruning while eliminating table scans.",
    badge: "Database",
  },
  {
    id: "inf-strict-ts-audit",
    label: "Strict TypeScript zero-any audit",
    category: "Coding",
    text: "Audit this TypeScript module for strict type safety. Eliminate all implicit or explicit 'any', replace type assertions with exhaustive discriminated unions and type guards.",
    badge: "Types",
  },
  {
    id: "inf-retry-backoff",
    label: "Resilient exponential backoff & jitter",
    category: "Coding",
    text: "Implement a production-grade async retry utility featuring exponential backoff with full jitter, circuit breaking thresholds, and abort controller cancellation.",
    badge: "Resilience",
  },
  {
    id: "inf-docker-multistage",
    label: "Multi-stage minimal Docker build",
    category: "Coding",
    text: "Write a security-hardened, multi-stage Dockerfile that compiles production assets, drops root privileges, strips dev dependencies, and minimizes image footprint.",
    badge: "DevOps",
  },
  {
    id: "inf-web-worker-calc",
    label: "Offload compute to Web Worker",
    category: "Coding",
    text: "Extract heavy JSON transformation and cryptographic operations into a dedicated Web Worker with typed message passing and Comlink RPC compatibility.",
    badge: "Performance",
  },
  {
    id: "inf-race-condition-fsm",
    label: "Debug async state machine race condition",
    category: "Coding",
    text: "Identify and resolve the concurrency race condition in this state machine. Formulate deterministic state transitions with atomic CAS semantics.",
    badge: "Concurrency",
  },
  {
    id: "inf-webgl-particle",
    label: "Performant WebGL 3D particle field",
    category: "Website / 3D",
    text: "Implement a 60fps WebGL custom particle simulation shader with GPU instancing, mouse-repulsion physics, and adaptive device-pixel-ratio scaling.",
    badge: "WebGL",
  },
  {
    id: "inf-idempotency-keys",
    label: "Payment webhook idempotency engine",
    category: "Coding",
    text: "Build an idempotent Stripe webhook processing pipeline with Redis distributed locks, deduplication windows, and ACID transaction safety.",
    badge: "Fintech",
  },
  {
    id: "inf-event-driven-kafka",
    label: "Architect Kafka event streaming topology",
    category: "Coding",
    text: "Architect an event-driven microservices topology using Apache Kafka. Define topic partitioning, dead-letter queue strategies, and exactly-once processing semantics.",
    badge: "Architecture",
  },
  {
    id: "inf-multi-region-dr",
    label: "Multi-region disaster recovery runbook",
    category: "Business",
    text: "Formulate a multi-region active-passive failover protocol for cloud infrastructure, detailing RPO/RTO targets, DNS failover automation, and state synchronization.",
    badge: "Cloud",
  },
  {
    id: "inf-cqrs-event-sourcing",
    label: "CQRS & Event Sourcing state transitions",
    category: "Coding",
    text: "Design a CQRS and Event Sourcing domain model. Define aggregate roots, event stores, projection snapshots, and read-model synchronization handlers.",
    badge: "Domain",
  },
  {
    id: "inf-zero-downtime-migration",
    label: "Zero-downtime database migration",
    category: "Structured Data",
    text: "Draft an expand-and-contract zero-downtime database schema migration strategy. Include dual-writing steps, backfill scripts, and zero-data-loss rollback plans.",
    badge: "Migrations",
  },
  {
    id: "inf-circuit-breaker",
    label: "Circuit breaker for upstream microservices",
    category: "Coding",
    text: "Implement a resilient circuit breaker pattern wrapper with closed, open, and half-open states, failure rate counters, and fallback caches.",
    badge: "Fault Tolerance",
  },
  {
    id: "inf-token-bucket-limiter",
    label: "Distributed token bucket rate limiter",
    category: "Coding",
    text: "Implement a high-scale API rate limiter using the token bucket algorithm backed by atomic Redis Lua scripts with IP and API-key tier granularity.",
    badge: "Traffic",
  },
  {
    id: "inf-opentelemetry-taxonomy",
    label: "OpenTelemetry tracing & metrics taxonomy",
    category: "Coding",
    text: "Define a unified semantic observability schema for OpenTelemetry traces, spans, attributes, and structured error logs across distributed services.",
    badge: "Telemetry",
  },
  {
    id: "inf-cache-invalidation",
    label: "Distributed cache invalidation protocol",
    category: "Coding",
    text: "Formulate a two-tier cache strategy (in-memory L1 + Redis L2) with pub/sub invalidation, stamped locks against cache stampedes, and TTL jitter.",
    badge: "Caching",
  },
  {
    id: "inf-cinematic-sci-fi",
    label: "Cinematic prompt for sci-fi architecture",
    category: "Creative",
    text: "Draft a high-fidelity visual prompt describing a futuristic solarpunk metropolis at dusk, specifying camera focal length, volumetric lighting, and octagonal geometry.",
    badge: "Creative",
  },
  {
    id: "inf-typography-design-system",
    label: "Fluid typography & design token scale",
    category: "Website / 3D",
    text: "Construct a mathematical fluid typography and spacing scale using CSS clamp functions, semantic color tokens, and WCAG AAA contrast guarantees.",
    badge: "Design",
  },
  {
    id: "inf-glassmorphic-tokens",
    label: "Glassmorphic dark-mode component tokens",
    category: "Website / 3D",
    text: "Design a sleek glassmorphic UI component library specification with backdrop-filter blurs, subtle specular border gradients, and accessible elevated surfaces.",
    badge: "Styling",
  },
  {
    id: "inf-onboarding-choreography",
    label: "Micro-interaction onboarding choreography",
    category: "Website / 3D",
    text: "Choreograph a 4-step progressive onboarding sequence using subtle spring physics, haptic feedback cues, and accessible keyboard focus navigation.",
    badge: "UX",
  },
  {
    id: "inf-responsive-dashboard",
    label: "High-density trading dashboard grid",
    category: "Website / 3D",
    text: "Build a responsive CSS subgrid layout for a financial analytics dashboard supporting 4K multi-monitors down to compact mobile viewports without horizontal scroll.",
    badge: "Layout",
  },
  {
    id: "inf-interactive-dataviz",
    label: "Interactive SVG & canvas data visualization",
    category: "Analysis",
    text: "Design an interactive time-series chart component using SVG and Canvas with zoom/pan brushes, tooltip crosshairs, and smooth cubic bezier transitions.",
    badge: "Dataviz",
  },
  {
    id: "inf-competitive-moat",
    label: "Competitive moat & defensibility analysis",
    category: "Business",
    text: "Analyze our software platform against top market incumbents across switching costs, network effects, economies of scale, and proprietary data moats.",
    badge: "Strategy",
  },
  {
    id: "inf-soc2-compliance",
    label: "SOC2 Type II security readiness checklist",
    category: "Business",
    text: "Draft an engineering readiness roadmap for SOC2 Type II compliance covering access control, CI/CD change management, secret rotation, and incident drills.",
    badge: "Security",
  },
  {
    id: "inf-plg-funnel",
    label: "Product-led growth viral loop model",
    category: "Business",
    text: "Design a self-serve PLG adoption funnel mapping free user activation, natural collaboration touchpoints, in-app upgrade triggers, and retention loops.",
    badge: "Growth",
  },
  {
    id: "inf-unit-economics",
    label: "B2B SaaS unit economics & LTV/CAC model",
    category: "Business",
    text: "Construct a financial model evaluating CAC payback periods, net revenue retention (NRR), gross margin per customer tier, and cohort churn curves.",
    badge: "Finance",
  },
  {
    id: "inf-incident-postmortem",
    label: "Blameless engineering post-mortem template",
    category: "Business",
    text: "Formulate a blameless post-mortem framework focusing on root causes (5 Whys), detection latency, blast radius containment, and actionable remediation items.",
    badge: "Operations",
  },
  {
    id: "inf-quarterly-okrs",
    label: "Quarterly engineering OKR alignment matrix",
    category: "Business",
    text: "Define measurable engineering Objectives and Key Results (OKRs) balancing platform reliability, feature velocity, developer experience, and tech debt reduction.",
    badge: "OKRs",
  },
  {
    id: "inf-saas-pricing-tiers",
    label: "Usage-based SaaS pricing tier architecture",
    category: "Business",
    text: "Design a hybrid subscription and usage-based pricing model with fair entitlement thresholds, overage safety caps, and grandfathering migration paths.",
    badge: "Pricing",
  },
  {
    id: "inf-json-schema-extract",
    label: "Extract validated JSON schema from text",
    category: "Structured Data",
    text: "Extract entities, monetary amounts, and jurisdiction dates from unstructured agreements into a strict, validated JSON schema with zero null hallucinations.",
    badge: "Extraction",
  },
  {
    id: "inf-academic-synthesis",
    label: "Synthesize literature with DOI citations",
    category: "Research",
    text: "Synthesize findings across these research abstracts into a coherent comparative analysis. Include verifiable DOI references and explicitly flag conflicting findings.",
    badge: "Academic",
  },
  {
    id: "inf-eval-suite-prompt",
    label: "LLM prompt regression evaluation suite",
    category: "Research",
    text: "Design a rigorous test battery for prompt regression testing. Include assertion checks, semantic similarity metrics, token economy gates, and adversarial edge cases.",
    badge: "Eval",
  },
  {
    id: "inf-fewshot-cot",
    label: "Few-shot Chain-of-Thought meta-prompt",
    category: "AI Assistant",
    text: "Craft a few-shot Chain-of-Thought system prompt for multi-step algorithmic reasoning, including scratchpad formatting, intermediate verifications, and final answer delimiting.",
    badge: "Prompting",
  },
  {
    id: "inf-mmr-reranking",
    label: "RAG vector retrieval with MMR reranking",
    category: "Research",
    text: "Implement a hybrid lexical and dense vector search pipeline combining BM25, cosine embeddings, and Maximal Marginal Relevance (MMR) for diversity.",
    badge: "RAG",
  },
  {
    id: "inf-multi-agent-debate",
    label: "Multi-agent consensus debate protocol",
    category: "AI Assistant",
    text: "Orchestrate a tri-agent deliberation workflow where Proposer, Critic, and Arbiter agents iteratively debate trade-offs to reach an optimal technical decision.",
    badge: "Agents",
  },
  {
    id: "inf-prompt-bias-audit",
    label: "Audit prompt instructions for safety & bias",
    category: "AI Assistant",
    text: "Audit this system prompt for hidden prompt injection vulnerabilities, unintended demographic skew, and jailbreak escape routes, providing fortified constraints.",
    badge: "Safety",
  },
  {
    id: "inf-cobol-migration",
    label: "Translate legacy COBOL to modern specs",
    category: "Structured Data",
    text: "Reverse-engineer the arithmetic calculations and validation branches in this legacy COBOL routine into an unambiguous modern algorithmic specification with test vectors.",
    badge: "Legacy",
  },
  {
    id: "inf-self-healing-ci",
    label: "Self-healing CI/CD pipeline with canaries",
    category: "Coding",
    text: "Design an automated deployment pipeline with automated canary analysis, automatic rollbacks on error-rate spikes, and incident webhooks.",
    badge: "Automation",
  },
  {
    id: "inf-technical-onboarding",
    label: "Interactive engineer onboarding roadmap",
    category: "Education",
    text: "Create a hands-on, week-by-week technical onboarding curriculum that guides a new engineer through architecture deep-dives, local sandbox setup, and first PR shipping.",
    badge: "Onboarding",
  },
  {
    id: "inf-multilingual-localization",
    label: "i18n locale localization with pluralization",
    category: "Multilingual",
    text: "Build an internationalization key structure supporting ICU message syntax, variable interpolation, and gender/plural inflection rules across English, Spanish, and Japanese.",
    badge: "i18n",
  },
  {
    id: "inf-edge-worker-cache",
    label: "Cloudflare Edge Worker caching proxy",
    category: "Coding",
    text: "Write a high-performance Cloudflare Edge Worker script that inspects incoming requests, manages stale-while-revalidate headers, and verifies JWT tokens at the edge.",
    badge: "Edge",
  },
  {
    id: "inf-accessibility-audit",
    label: "WCAG 2.2 AA accessibility remediation",
    category: "Website / 3D",
    text: "Review this complex web application screen for WCAG 2.2 AA compliance, identifying keyboard focus traps, missing ARIA live regions, and contrast violations.",
    badge: "A11y",
  },
];

/**
 * Contextual Evolution Modifiers:
 * Stackable, production-ready constraints that append cleanly onto the brief
 * without erasing the user's base intent.
 */
export const PROMPT_EVOLUTION_MODIFIERS: PromptEvolutionModifier[] = [
  {
    id: "evo-zero-trust",
    label: "+ Zero-Trust Auth & RBAC",
    domain: "Security",
    clause:
      "Constraint: Implement zero-trust authentication, granular role-based access control (RBAC), and strict session revocation guarantees.",
  },
  {
    id: "evo-playwright-e2e",
    label: "+ Playwright E2E Tests",
    domain: "Quality",
    clause:
      "Requirement: Include automated Playwright end-to-end test suites covering primary, edge, and error recovery user flows with zero flaky timeouts.",
  },
  {
    id: "evo-postgres-ddl",
    label: "+ PostgreSQL DDL Schema",
    domain: "Database",
    clause:
      "Requirement: Provide strict PostgreSQL DDL schemas including constraints, foreign keys, covering indexes, and rollback migration scripts.",
  },
  {
    id: "evo-strict-katex",
    label: "+ Strict KaTeX Guardrails",
    domain: "Formatting",
    clause:
      "Formatting: Format all mathematical formulas using valid KaTeX syntax and adhere strictly to GitHub-flavored markdown standards.",
  },
  {
    id: "evo-anti-hallucination",
    label: "+ Anti-Hallucination Citations",
    domain: "Accuracy",
    clause:
      "Verification: Cite verified official documentation for all external APIs and libraries. Reject invented functions or unreleased features.",
  },
  {
    id: "evo-core-web-vitals",
    label: "+ Core Web Vitals & Perf",
    domain: "Speed",
    clause:
      "Performance: Optimize strictly for sub-second LCP, zero CLS, and low INP latency using memoized render paths and asset preloading.",
  },
  {
    id: "evo-soc2-audit",
    label: "+ SOC2 Enterprise Audit",
    domain: "Compliance",
    clause:
      "Compliance: Integrate tamper-evident audit logging, least-privilege credential scopes, and encryption at rest and in transit.",
  },
  {
    id: "evo-edge-runtime",
    label: "+ Edge Runtime Fallbacks",
    domain: "Runtime",
    clause:
      "Architecture: Ensure execution compatibility across Cloudflare/Vercel Edge runtimes with zero node-specific native dependencies.",
  },
];
