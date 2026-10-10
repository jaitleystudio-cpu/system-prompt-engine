// SPE Outcome Intent Classifier & Specification Lift Engine
// Implements frontier discovery triggering for ChatGPT, Claude, and Gemini companions.
// Evaluates positive complex outcomes vs negative trivial queries (OpenAI Plugin Discovery Standard).

export type OutcomeCapabilityId =
  | "PRODUCT_APP_SPECIFICATION"
  | "INTERACTIVE_3D_WEB_SPECIFICATION"
  | "SCIENTIFIC_RESEARCH_PROTOCOL"
  | "MARKETING_CAMPAIGN_BRIEF"
  | "TUTORING_INSTRUCTION_FRAMEWORK"
  | "AGENT_SPECIFICATION_PLAN"
  | "WRITING_QUALITY_AUDIT"
  | "BUSINESS_PLANNING_SPECIFICATION"
  | "WORKFLOW_AUTOMATION_SAFEGUARDS";

export interface OutcomeCapabilityDefinition {
  id: OutcomeCapabilityId;
  name: string;
  category: "Engineering" | "Design" | "Science" | "Marketing" | "Education" | "AI Systems" | "Writing" | "Business" | "Automation";
  icon: string;
  userFacingLabel: string;
  description: string;
  sampleTrigger: string;
  keywords: string[];
  patterns: RegExp[];
  specificationTemplate: (input: string, modelTarget?: string) => string;
}

export interface IntentClassificationResult {
  decision: "SPECIFICATION_LIFT_AVAILABLE" | "PASS_THROUGH";
  triggered: boolean;
  confidence: number; // 0.0 to 1.0
  reason: string;
  capabilityId?: OutcomeCapabilityId;
  capabilityName?: string;
  badgeLabel?: string;
  liftedSpecificationPrompt?: string;
  suggestedAction?: string;
  matchedKeywords?: string[];
}

export const OUTCOME_CAPABILITIES: Record<OutcomeCapabilityId, OutcomeCapabilityDefinition> = {
  PRODUCT_APP_SPECIFICATION: {
    id: "PRODUCT_APP_SPECIFICATION",
    name: "Product specification and implementation prompt",
    category: "Engineering",
    icon: "🛍️",
    userFacingLabel: "Product Spec & Code Blueprint",
    description: "Transforms casual app requests into production-ready software architectures, schemas, API contracts, and TDD plans.",
    sampleTrigger: "Build me a shopping app",
    keywords: [
      "shopping app", "e-commerce", "ecommerce", "store app", "mobile app", "build me an app",
      "create an app", "saas app", "marketplace app", "food delivery app", "banking app",
      "ride sharing", "web application", "build an application", "fullstack app", "crud app"
    ],
    patterns: [
      /\b(build|create|develop|code|make)\s+(me\s+)?(a|an)?\s*([a-z0-9_\-\s]+)?\b(app|application|store|platform|marketplace)\b/i,
      /\bshopping\s+(app|site|platform|cart)\b/i,
      /\be-?commerce\s+(app|website|store|platform)\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Principal Product Architect and Senior Systems Engineer.
Target Model Environment: ${model}

The user has requested: "${input}".
Elevate this brief concept into an exhaustive, production-grade Product Specification and Implementation Blueprint ready for autonomous execution.

Required Specification Sections:
1. Executive Product Vision & Core User Value Proposition
   - Primary user personas and problem-to-solution narrative.
   - Core user journeys (acquisition, activation, retention).

2. Domain Data Models & Schemas
   - Strict TypeScript/SQL relational schemas for core entities (Users, Products/Items, Carts, Orders, Payments, Inventory).
   - Invariant constraints (idempotency tokens, atomic stock decrement, currency precision).

3. Complete API Contracts & Endpoint Specifications
   - REST/GraphQL endpoints with exact request bodies, response payloads, HTTP status codes, and error models.

4. UI/UX Architecture & Responsive Viewports
   - Component hierarchy and state management flow.
   - Mobile-first layout considerations and loading/empty/error states.

5. Critical Edge Cases & Resilience Safeguards
   - Payment failures, race conditions on checkout, network drops, inventory contention, and fraud prevention.

6. Phased Test-Driven Development (TDD) Implementation Plan
   - Phase 1: Core domain logic and unit tests (Red-Green-Refactor).
   - Phase 2: API routes and database transactions.
   - Phase 3: Frontend state integration and end-to-end checkout flow.

Tone: Authoritative, pragmatic, human-engineered code architecture with zero generic AI fluff.`
  },

  INTERACTIVE_3D_WEB_SPECIFICATION: {
    id: "INTERACTIVE_3D_WEB_SPECIFICATION",
    name: "Interactive website specification",
    category: "Design",
    icon: "🌐",
    userFacingLabel: "Interactive 3D Website Specification",
    description: "Transforms website design ideas into Three.js/WebGL scene graphs, shader architectures, 60fps performance budgets, and accessible DOM fallbacks.",
    sampleTrigger: "Design a cinematic 3D website",
    keywords: [
      "cinematic 3d website", "3d website", "three.js", "threejs", "webgl", "canvas 3d",
      "interactive website", "immersive website", "3d portfolio", "shader", "r3f", "react three fiber"
    ],
    patterns: [
      /\b(design|build|create)\s+(me\s+)?(a|an)?\s*([a-z0-9_\-\s]+)?\b(3d|cinematic|interactive|immersive)\s+(website|web\s*site|portfolio|landing\s*page)\b/i,
      /\b(three\.?js|webgl|react-three-fiber|r3f)\s+(website|experience|app)\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as an award-winning Creative Technologist and WebGL/Three.js Systems Architect.
Target Model Environment: ${model}

The user has requested: "${input}".
Elevate this vision into a comprehensive Interactive Website & 3D WebGL Specification.

Required Specification Sections:
1. Creative Concept & Visual Art Direction
   - Aesthetic theme, lighting moods, color palettes, and typographic harmony.
   - Spatial metaphor and camera staging.

2. 3D Scene Graph & Rendering Architecture
   - Geometry definitions, custom GLSL shaders, lighting setup (directional, ambient, shadow maps), and post-processing passes (bloom, depth-of-field).
   - React Three Fiber / Three.js component tree.

3. 60 FPS Performance & Memory Budget
   - Draw-call caps, texture compression (KTX2/Basis), geometry instancing, and Level-of-Detail (LOD) policies.
   - Mobile device GPU throttling and fallback rendering modes.

4. Micro-Interactions & Animation Choreography
   - Scroll-linked camera timelines (GSAP / Lenis), cursor proximity physics, hover states, and dynamic lighting responses.

5. Accessibility & Progressive Enhancement
   - Screen-reader accessible DOM overlay (WCAG 2.2 AA).
   - Reduced-motion user preference handling (\`prefers-reduced-motion\`).

6. Production Implementation Blueprint
   - File structure, starter canvas initialization code, asset loading pipeline, and step-by-step development sequence.`
  },

  SCIENTIFIC_RESEARCH_PROTOCOL: {
    id: "SCIENTIFIC_RESEARCH_PROTOCOL",
    name: "Research protocol and evidence plan",
    category: "Science",
    icon: "🔬",
    userFacingLabel: "Scientific Research Protocol & Evidence Plan",
    description: "Elevates hypotheses into formal null hypothesis protocols, empirical variable controls, statistical power calculations, and reproducibility checklists.",
    sampleTrigger: "Research this scientific hypothesis",
    keywords: [
      "scientific hypothesis", "research protocol", "empirical study", "experiment plan",
      "causal analysis", "null hypothesis", "power analysis", "clinical protocol",
      "research this hypothesis", "scientific paper research", "evidence plan"
    ],
    patterns: [
      /\b(research|investigate|study|validate|test)\s+(this|a|an)?\s*([a-z0-9_\-\s]+)?\b(scientific\s+hypothesis|hypothesis|research\s+protocol|experiment)\b/i,
      /\bscientific\s+(hypothesis|methodology|protocol)\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Principal Scientific Research Fellow and Empirical Methodologist.
Target Model Environment: ${model}

The user has proposed: "${input}".
Transform this inquiry into an exhaustive, peer-review-grade Scientific Research Protocol and Evidence Plan.

Required Specification Sections:
1. Formal Hypothesis Formulation
   - Explicit primary research question.
   - Null hypothesis ($H_0$) and alternative hypothesis ($H_1$) in formal notation.
   - Theoretical grounding and prior literature baseline.

2. Experimental Methodology & Variable Controls
   - Independent variables, dependent metrics, and confounding control variables.
   - Randomization, blinding, and counter-balancing procedures.

3. Statistical Power & Sample Sizing
   - Required statistical power ($1 - \\beta \\ge 0.80$), significance threshold ($\\alpha = 0.05$ or corrected for multiple comparisons).
   - Effect size estimation and mathematical sample size derivation.

4. Data Collection, Preprocessing & Integrity Invariants
   - Instrumentation calibration, measurement error handling, and outlier exclusion rules.
   - Data privacy, provenance tracking, and tamper-evident logging.

5. Statistical Analysis & Falsification Plan
   - Primary test selection (parametric vs non-parametric, ANOVA, regression, survival analysis).
   - Pre-registration plan to eliminate p-hacking and HARKing.

6. Reproducibility & Open Science Roadmap
   - Artifact replication checklist, data dictionary template, and execution timeline.`
  },

  MARKETING_CAMPAIGN_BRIEF: {
    id: "MARKETING_CAMPAIGN_BRIEF",
    name: "Campaign brief and structured creative instructions",
    category: "Marketing",
    icon: "🚀",
    userFacingLabel: "Marketing Campaign Brief & Creative Instructions",
    description: "Transforms high-level campaign concepts into structured creative briefs, multi-stage funnel copy, audience psychographics, and KPI models.",
    sampleTrigger: "Create a marketing campaign",
    keywords: [
      "marketing campaign", "campaign brief", "gtm campaign", "product launch campaign",
      "advertising campaign", "ad campaign", "growth marketing", "content campaign",
      "lead generation campaign", "email marketing campaign"
    ],
    patterns: [
      /\b(create|launch|design|plan|build)\s+(me\s+)?(a|an)?\s*([a-z0-9_\-\s]+)?\b(marketing\s+campaign|ad\s+campaign|campaign\s+brief|gtm\s+campaign)\b/i,
      /\bmarketing\s+campaign\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Chief Marketing Officer and Direct-Response Creative Director.
Target Model Environment: ${model}

The user has requested: "${input}".
Elevate this objective into a comprehensive Marketing Campaign Brief and Structured Creative Blueprint.

Required Specification Sections:
1. Strategic Campaign Foundation
   - Core commercial objective, primary conversion event, and target return on ad spend (ROAS).
   - In-depth customer psychographics, pain triggers, objections, and buying motivations.

2. Value Proposition & Messaging Matrix
   - Core hook angles: 1. Counter-intuitive industry revelation. 2. Direct pain relief. 3. Transformational outcome.
   - Unique mechanism / product moat articulation.

3. Multi-Channel Funnel Architecture
   - Top-of-Funnel (ToFu): Scroll-stopping social hooks, short-form video scripts, and search ads.
   - Middle-of-Funnel (MoFu): Educational lead magnet, case studies, and comparison breakdowns.
   - Bottom-of-Funnel (BoFu): High-converting landing page structure, urgency triggers, and risk-reversal guarantee.

4. Structured Creative Copy Deliverables
   - 3 High-converting ad copy variations (Hook, Body, CTA).
   - 4-Part high-converting email nurture sequence outline.

5. Unit Economics & KPI Tracking Framework
   - Target Customer Acquisition Cost (CAC), Lifetime Value (LTV), and conversion rate benchmarks.
   - Attribution model, tracking pixel parameters, and UTM tagging structure.

6. 30-Day Phased Execution & A/B Testing Matrix.`
  },

  TUTORING_INSTRUCTION_FRAMEWORK: {
    id: "TUTORING_INSTRUCTION_FRAMEWORK",
    name: "Personalized tutoring instruction framework",
    category: "Education",
    icon: "📐",
    userFacingLabel: "Personalized Tutoring Instruction Framework",
    description: "Elevates learning requests into Socratic diagnostic plans, first-principles scaffolding, worked proofs, and spaced-repetition retention drills.",
    sampleTrigger: "Help me learn mathematics",
    keywords: [
      "learn mathematics", "learn math", "teach me calculus", "study mathematics",
      "learn physics", "master linear algebra", "learn machine learning math",
      "tutoring framework", "study curriculum", "personalized tutoring"
    ],
    patterns: [
      /\b(help\s+me\s+learn|teach\s+me|learn|master|study)\s+([a-z0-9_\-\s]+)?\b(mathematics|math|calculus|algebra|physics|statistics)\b/i,
      /\bpersonalized\s+tutoring\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a World-Class Socratic Master Tutor and Cognitive Pedagogist.
Target Model Environment: ${model}

The user has requested: "${input}".
Transform this learning ambition into an actionable, Personalized Tutoring Instruction Framework and Scaffolding Guide.

Required Specification Sections:
1. Baseline Diagnostic & Prerequisites Map
   - Essential mathematical prerequisites required before proceeding.
   - Diagnostic question to assess current depth of understanding.

2. First-Principles Conceptual Scaffolding
   - The core geometric, physical, or intuitive insight underlying the subject.
   - Bridge from intuitive metaphor to formal mathematical rigor.

3. Socratic Dialogue Protocol for the AI Assistant
   - Explicit instructions for the AI: Never just give the final formula. Ask leading probing questions. Prompt the student to test edge cases.

4. Curated Worked Proofs & Step-by-Step Problem Progression
   - Level 1: Intuition-building fundamental problem with full visual explanation.
   - Level 2: Intermediate application problem testing boundary conditions.
   - Level 3: Challenging synthesis problem connecting multiple mathematical ideas.

5. Common Misconceptions & Diagnostic Traps
   - The 3 most pervasive student misunderstandings in this topic and how to systematically dispel them.

6. 4-Week Spaced Repetition Mastery Schedule
   - Weekly practice cadence, self-quizzing prompts, and flashcard concept prompts.`
  },

  AGENT_SPECIFICATION_PLAN: {
    id: "AGENT_SPECIFICATION_PLAN",
    name: "Agent specification, constraints, and evaluation plan",
    category: "AI Systems",
    icon: "🤖",
    userFacingLabel: "AI Agent Specification & Safeguards Plan",
    description: "Transforms agent concepts into formal role definitions, MCP tool contracts, capability firewalls, state memory models, and evaluation suites.",
    sampleTrigger: "Create an AI agent",
    keywords: [
      "create an ai agent", "build an ai agent", "create an agent", "build an agent",
      "autonomous agent", "multi-agent system", "ai assistant agent", "coding agent",
      "mcp agent", "tool calling agent", "agent workflow"
    ],
    patterns: [
      /\b(create|build|design|develop|architect)\s+(me\s+)?(a|an)?\s*([a-z0-9_\-\s]+)?\b(ai\s+agent|agent|autonomous\s+agent|multi-agent)\b/i,
      /\bagent\s+specification\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Principal Autonomous AI Agent Architect and Security Systems Engineer.
Target Model Environment: ${model}

The user has requested: "${input}".
Transform this into a formal, robust AI Agent Specification, Constraint Matrix, and Evaluation Plan.

Required Specification Sections:
1. Agent Identity, Scope & Operational Boundaries
   - Precise role definition, primary objective, and allowed vs forbidden actions.
   - Deterministic authority model (read-only queries vs irreversible external effects).

2. Tool Registry & Model Context Protocol (MCP) Schemas
   - Explicit JSON-Schema definitions for each callable tool.
   - Strict input parameter validation, parameter typing, and response schemas.

3. Hard Invariants & Capability Firewall
   - Budget/token caps per run, execution time limits, and rate limits.
   - Safeguards against prompt injection, malicious external data, and tool hijacking.
   - Human-in-the-loop requirement triggers for high-impact actions.

4. Memory Architecture & State Transitions
   - Ephemeral working scratchpad vs persistent long-term storage.
   - Rollback and checkpointing protocol when a tool execution fails.

5. Multi-Turn Task Evaluation Suite
   - 5 Concrete test scenarios: 2 happy paths, 2 adversarial/malicious prompt injection attempts, 1 network/tool outage failure.
   - Quantitative grading rubric (Tool selection accuracy, argument validity, constraint retention).

6. Complete System Prompt & Execution Harness Blueprint.`
  },

  WRITING_QUALITY_AUDIT: {
    id: "WRITING_QUALITY_AUDIT",
    name: "Writing requirements and quality audit",
    category: "Writing",
    icon: "✍️",
    userFacingLabel: "Writing Requirements & Quality Audit",
    description: "Elevates document rewrite requests into structural flow audits, tone calibrations, argumentation checks, and line-by-line human rewrites.",
    sampleTrigger: "Improve this document",
    keywords: [
      "improve this document", "improve my writing", "rewrite this document", "edit this article",
      "polish this whitepaper", "audit this document", "writing requirements", "humanize this text",
      "elevate this essay", "critique my writing"
    ],
    patterns: [
      /\b(improve|rewrite|edit|polish|audit|critique|elevate)\s+(this|my)?\s*([a-z0-9_\-\s]+)?\b(document|article|essay|whitepaper|draft|text|memo|post)\b/i,
      /\bwriting\s+(audit|requirements|standards)\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as an Award-Winning Senior Editorial Director and Literary Stylist.
Target Model Environment: ${model}

The user has requested: "${input}".
Transform this into a structured Writing Requirements and Quality Audit Protocol.

Required Specification Sections:
1. Editorial Directive & Voice Calibration
   - Tone target: Authoritative, compelling, natural human cadence.
   - Complete ban on generic AI tropes and clichés (e.g., "delve", "testament", "tapestry", "in today's fast-paced world", "crucial role", "beacon of hope").
   - Musical sentence variety (interspersing punchy 4-word sentences with rich compound clauses).

2. Structural & Rhetorical Audit
   - Narrative pacing and logical progression analysis.
   - Thesis clarity and argument strength verification.
   - Elimination of passive voice and redundant qualifiers.

3. Paragraph-by-Paragraph Diagnostic Matrix
   - Column 1: Original text excerpt.
   - Column 2: Diagnostic flaw (fluff, vagueness, weak verb, robotic cliché).
   - Column 3: High-impact revision with concrete specifics and active verbs.

4. Factual Precision & Evidence Grounding Check
   - Verification of claims, statistics, and citations.
   - Highlighting ambiguous generalizations and replacing them with verifiable examples.

5. Complete Polished Final Draft
   - Delivering the fully rewritten piece meeting all stylistic invariants.

6. Executive Summary & Lasting Stylistic Recommendations.`
  },

  BUSINESS_PLANNING_SPECIFICATION: {
    id: "BUSINESS_PLANNING_SPECIFICATION",
    name: "Structured business-planning specification",
    category: "Business",
    icon: "📊",
    userFacingLabel: "Structured Business-Planning Specification",
    description: "Transforms business ideas into investor-grade lean canvases, unit economics breakdowns, CAC/LTV payback models, and 90-day execution roadmaps.",
    sampleTrigger: "Turn this business idea into a plan",
    keywords: [
      "turn this business idea into a plan", "business plan", "startup idea into a plan",
      "business planning", "lean canvas", "monetization plan", "unit economics",
      "go to market plan", "pitch deck strategy", "startup business plan"
    ],
    patterns: [
      /\b(turn|make|transform|build)\s+([a-z0-9_\-\s]+)?\b(business\s+idea|idea|startup\s+concept)\s+into\s+(a\s+)?(plan|strategy|roadmap)\b/i,
      /\b(create|write|develop)\s+(a\s+)?(business\s+plan|startup\s+business\s+plan)\b/i,
      /\bbusiness-?planning\s+specification\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Top-Tier Silicon Valley Startup Partner and Commercial Strategist.
Target Model Environment: ${model}

The user has requested: "${input}".
Transform this into a structured, investor-grade Business Planning Specification.

Required Specification Sections:
1. Executive Summary & Problem-Solution Fit
   - The acute, bleeding-neck problem being solved.
   - The unique product mechanism and why alternative solutions fail.
   - Customer profile with highest willingness-to-pay.

2. Market Sizing & Competitive Moat Matrix
   - Realistic bottom-up TAM, SAM, and SOM calculation.
   - Defensibility analysis: Network effects, proprietary data flywheels, switching costs, brand moats.

3. Business Model & Unit Economics Architecture
   - Pricing tiers (Free, Pro, Team, Enterprise) and expansion loops.
   - Unit economics formula: Target Customer Acquisition Cost (CAC), Lifetime Value (LTV), Payback Period (< 12 months), and Gross Margin targets (> 80%).

4. Zero-Dollar & Scalable Go-To-Market (GTM) Engine
   - Organic acquisition loops (SEO, viral tooling, word-of-mouth product wedges).
   - High-velocity sales and distribution channel prioritization.

5. 18-Month Financial & Runway Model
   - Key cost drivers (Compute/API tokens, headcount, infrastructure).
   - Milestones required to achieve cash-flow breakeven or Series A readiness.

6. 90-Day Execution Roadmap & Critical Derisking Experiments
   - Week 1-4: Problem validation and smoke-test landing page.
   - Week 5-8: Minimum Viable Product (MVP) launch with first 10 paying customers.
   - Week 9-12: Core retention and conversion optimization.`
  },

  WORKFLOW_AUTOMATION_SAFEGUARDS: {
    id: "WORKFLOW_AUTOMATION_SAFEGUARDS",
    name: "Automation requirements and safeguards",
    category: "Automation",
    icon: "⚡",
    userFacingLabel: "Workflow Automation & Safeguards Spec",
    description: "Transforms workflow automation requests into event-driven topologies, idempotency guarantees, dead-letter recovery queues, and human approval gates.",
    sampleTrigger: "Make this workflow automatic",
    keywords: [
      "make this workflow automatic", "automate this workflow", "automate workflow",
      "workflow automation", "automate my process", "webhook automation",
      "n8n workflow", "zapier workflow", "automated pipeline", "process automation"
    ],
    patterns: [
      /\b(make|build|create)\s+([a-z0-9_\-\s]+)?\bworkflow\s+(automatic|automated)\b/i,
      /\b(automate|streamline)\s+([a-z0-9_\-\s]+)?\b(workflow|process|pipeline|onboarding)\b/i,
      /\bworkflow\s+automation\b/i
    ],
    specificationTemplate: (input, model = "Claude 6.0 / OpenAI 6") => `Act as a Principal Automation Architect and Site Reliability Engineer.
Target Model Environment: ${model}

The user has requested: "${input}".
Elevate this into a production-grade Workflow Automation Requirements and Safeguards Specification.

Required Specification Sections:
1. Workflow Topology & Event Trigger Architecture
   - Primary trigger mechanisms (Webhook, Cron schedule, Database change data capture, Message queue).
   - Ingest payload validation and schema normalization contracts.

2. Step-by-Step Execution Graph
   - Linear and conditional branching logic across all integrated services.
   - State transfer contracts between pipeline steps.

3. Idempotency & Concurrency Safeguards
   - Unique idempotency key generation per event to prevent duplicate executions.
   - Distributed locking mechanisms and race condition prevention.

4. Fault Tolerance, Retries & Dead-Letter Handling
   - Exponential backoff retry policies for flaky third-party APIs.
   - Dead-letter queue (DLQ) storage for permanent failures with automated alerting.
   - Transaction rollback mechanisms to prevent partial state corruption.

5. Human-in-the-Loop Approval Safeguards
   - Specific risk thresholds requiring explicit human confirmation before proceeding (e.g. monetary transactions, mass emails, database deletions).

6. Observability, Metrics & Verification Test Battery
   - Synthetic end-to-end test cases covering happy path, timeout errors, and corrupted payloads.
   - Latency, throughput, and error-rate monitoring dashboards.`
  }
};

// Negative Archetypes: Queries that MUST return PASS_THROUGH (Zero tool invocation / No latency penalty)
const NEGATIVE_TRIVIA_PATTERNS = [
  /^(what|who|where|when|which|why)\s+(is|was|are|were|did)\s+/i,
  /^how\s+(many|much|old|tall|far|long)\s+/i,
  /^is\s+(there|it|he|she|that)\s+/i,
  /capital\s+of\s+/i,
  /who\s+wrote\s+/i,
  /when\s+did\s+/i,
  /tell\s+me\s+a\s+joke/i,
  /what\s+time\s+is\s+it/i,
  /weather\s+in\s+/i
];

const NEGATIVE_MATH_PATTERNS = [
  /^[\d\s\+\-\*\/\^\(\)\.\,\%]+$/, // Pure arithmetic expression like "2 + 2", "15 * 80"
  /\b(calculate|compute|solve|what is)\s+[\d\s\+\-\*\/\^\(\)\.\,\%]+/i,
  /^what\s+is\s+\d+\s*[\+\-\*\/x]\s*\d+/i,
  /^sqrt\s*\(?\d+\)?/i
];

const NEGATIVE_GREETING_PATTERNS = [
  /^(hi|hello|hey|hola|greetings|good morning|good evening|good afternoon|howdy|sup)[\s\.,!]*$/i,
  /^how\s+are\s+you(\s+doing)?[\s\.,!\?]*$/i,
  /^what's\s+up[\s\.,!\?]*$/i,
  /^(thanks|thank\s+you|ok|okay|cool|got\s+it|bye|goodbye)[\s\.,!]*$/i
];

const NEGATIVE_SYNTAX_LOOKUP_PATTERNS = [
  /^how\s+to\s+(spell|pronounce)\s+/i,
  /^define\s+[a-z0-9_\-]+\s*(in\s+one\s+sentence)?$/i,
  /^synonym\s+(for|of)\s+/i,
  /^meaning\s+of\s+[a-z0-9_\-]+$/i,
  /^translate\s+['"][^'"]+['"]\s+to\s+[a-z]+/i,
  /^how\s+do\s+you\s+say\s+['"][^'"]+['"]\s+in\s+[a-z]+/i,
  /^git\s+(commit|push|pull|status|checkout|branch|log)\b/i,
  /^reverse\s+a\s+string\s+in\s+[a-z]+/i
];

/**
 * Deterministic Outcome Intent Classifier.
 * Evaluates whether a prompt warrants a high-value SPE specification lift,
 * or should be passed through to preserve chat speed and avoid tool noise.
 */
export function classifyOutcomeIntent(rawInput: string): IntentClassificationResult {
  const text = (rawInput || "").trim();

  // 1. Minimum Length Check
  if (text.length < 8) {
    return {
      decision: "PASS_THROUGH",
      triggered: false,
      confidence: 1.0,
      reason: "INPUT_TOO_SHORT_FOR_COMPLEX_SPECIFICATION"
    };
  }

  // 2. Evaluate Negative Triggers (Must Pass Through)
  for (const pat of NEGATIVE_GREETING_PATTERNS) {
    if (pat.test(text)) {
      return {
        decision: "PASS_THROUGH",
        triggered: false,
        confidence: 0.99,
        reason: "CASUAL_SOCIAL_GREETING"
      };
    }
  }

  for (const pat of NEGATIVE_MATH_PATTERNS) {
    if (pat.test(text)) {
      return {
        decision: "PASS_THROUGH",
        triggered: false,
        confidence: 0.99,
        reason: "DIRECT_ARITHMETIC_CALCULATION"
      };
    }
  }

  for (const pat of NEGATIVE_SYNTAX_LOOKUP_PATTERNS) {
    if (pat.test(text)) {
      return {
        decision: "PASS_THROUGH",
        triggered: false,
        confidence: 0.95,
        reason: "TRIVIAL_SYNTAX_OR_DICTIONARY_LOOKUP"
      };
    }
  }

  for (const pat of NEGATIVE_TRIVIA_PATTERNS) {
    // Only pass through if not explicitly asking for a complex specification/plan
    const hasComplexIntent = /(specification|protocol|curriculum|architecture|blueprint|framework|campaign|plan)/i.test(text);
    if (!hasComplexIntent && pat.test(text)) {
      return {
        decision: "PASS_THROUGH",
        triggered: false,
        confidence: 0.94,
        reason: "FACTUAL_TRIVIA_OR_DIRECT_ANSWER"
      };
    }
  }

  // 3. Evaluate Positive Outcome Capabilities
  const lower = text.toLowerCase();
  let bestMatch: OutcomeCapabilityDefinition | null = null;
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const cap of Object.values(OUTCOME_CAPABILITIES)) {
    let score = 0;
    const currentMatches: string[] = [];

    // Exact pattern matching (High weight: +50)
    for (const pat of cap.patterns) {
      if (pat.test(text)) {
        score += 50;
        break;
      }
    }

    // Keyword matching (+15 per keyword)
    for (const kw of cap.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 15;
        currentMatches.push(kw);
      }
    }

    // Exact sample trigger match (+100)
    if (lower === cap.sampleTrigger.toLowerCase()) {
      score += 100;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = cap;
      matchedKeywords = currentMatches;
    }
  }

  // Decision Threshold: Score >= 30 triggers a specification lift
  if (bestMatch && bestScore >= 30) {
    const confidence = Math.min(1.0, 0.70 + (bestScore / 100) * 0.30);
    const liftedPrompt = bestMatch.specificationTemplate(text);

    return {
      decision: "SPECIFICATION_LIFT_AVAILABLE",
      triggered: true,
      confidence: parseFloat(confidence.toFixed(2)),
      reason: `COMPLEX_OUTCOME_BENEFITS_FROM_SPECIFICATION [${bestMatch.id}]`,
      capabilityId: bestMatch.id,
      capabilityName: bestMatch.name,
      badgeLabel: `⚡ SPE Lift: ${bestMatch.userFacingLabel}`,
      liftedSpecificationPrompt: liftedPrompt,
      suggestedAction: `Enhance into verified ${bestMatch.userFacingLabel}`,
      matchedKeywords
    };
  }

  // Fallback for general unclassified requests: Pass through to avoid unwanted tool noise
  return {
    decision: "PASS_THROUGH",
    triggered: false,
    confidence: 0.85,
    reason: "NO_COMPLEX_SPECIFICATION_THRESHOLD_MET"
  };
}

/**
 * Compiles a lifted specification prompt for a known capability and user input.
 */
export function compileSpecificationLiftPrompt(
  capabilityId: OutcomeCapabilityId,
  userInput: string,
  targetModel: string = "Claude 6.0 / OpenAI 6"
): string {
  const cap = OUTCOME_CAPABILITIES[capabilityId];
  if (!cap) {
    return userInput;
  }
  return cap.specificationTemplate(userInput, targetModel);
}
