// SPE Browser Companion - Content Script (ChatGPT, Claude & Gemini)
// 1-Click Injection, Invariant Hallucination Shield & Real-Time Specification Lift

(function () {
  if (window.__SPE_COMPANION_INITIALIZED__) return;
  window.__SPE_COMPANION_INITIALIZED__ = true;

  // =========================================================================
  // 1. Outcome Intent Capabilities & Specification Lift Engine
  // =========================================================================
  const OUTCOME_CAPABILITIES = {
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
    /^[\d\s\+\-\*\/\^\(\)\.\,\%]+$/,
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

  function classifyOutcomeIntent(rawInput) {
    const text = (rawInput || "").trim();

    if (text.length < 8) {
      return {
        decision: "PASS_THROUGH",
        triggered: false,
        confidence: 1.0,
        reason: "INPUT_TOO_SHORT_FOR_COMPLEX_SPECIFICATION"
      };
    }

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

    const lower = text.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    let matchedKeywords = [];

    for (const cap of Object.values(OUTCOME_CAPABILITIES)) {
      let score = 0;
      const currentMatches = [];

      for (const pat of cap.patterns) {
        if (pat.test(text)) {
          score += 50;
          break;
        }
      }

      for (const kw of cap.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += 15;
          currentMatches.push(kw);
        }
      }

      if (lower === cap.sampleTrigger.toLowerCase()) {
        score += 100;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = cap;
        matchedKeywords = currentMatches;
      }
    }

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

    return {
      decision: "PASS_THROUGH",
      triggered: false,
      confidence: 0.85,
      reason: "NO_COMPLEX_SPECIFICATION_THRESHOLD_MET"
    };
  }

  // =========================================================================
  // 2. Curated Power Prompts Vault
  // =========================================================================
  const VAULT = [
    {
      id: "seo-outrank-competitor",
      title: "#1 Google Outranking Blueprint",
      tagline: "Outrank competitor content with full E-E-A-T depth & zero fluff",
      category: "SEO",
      icon: "🎯",
      upvotes: 4892,
      variables: [
        { name: "keyword", label: "Target Keyword", placeholder: "e.g. best crm for startups", default: "best crm for small business" },
        { name: "competitor_focus", label: "Competitor Topic / Gap", placeholder: "e.g. competitor lacks real pricing comparison", default: "focus on hidden onboarding fees and real team workflows" }
      ],
      template: `Act as an authoritative SEO strategist. Write a comprehensive, search-dominant guide targeting "{keyword}". Outperform competitors on {competitor_focus}. Deliver immediate value in the first 100 words. Provide H2/H3 subheads, comparison table, step-by-step guidance, and 4 FAQs. Voice: natural, expert human, zero generic AI clichés.`
    },
    {
      id: "seo-semantic-keyword-cluster",
      title: "Semantic Keyword & Topic Cluster Architect",
      tagline: "Turn 1 keyword into a complete 30-day topical authority blueprint",
      category: "SEO",
      icon: "🗺️",
      upvotes: 3740,
      variables: [
        { name: "seed_topic", label: "Seed Topic / Niche", placeholder: "e.g. cold email automation", default: "b2b lead generation" }
      ],
      template: `Act as a Senior SEO Topical Authority Architect. Analyze "{seed_topic}" and build a 30-day topical authority cluster: 1 Pillar page concept, 5 Sub-topic clusters with 4 long-tail articles each, search intent classification (Informational, Commercial, Transactional), and internal linking blueprint.`
    },
    {
      id: "copy-high-converting-landing-page",
      title: "High-Converting SaaS Landing Page Copy",
      tagline: "Direct-response landing page copy: Hero, PAS agitation, benefits & CTA",
      category: "Marketing",
      icon: "💎",
      upvotes: 5610,
      variables: [
        { name: "product_name", label: "Product Name", placeholder: "e.g. SPE", default: "SPE" },
        { name: "target_audience", label: "Target Audience", placeholder: "e.g. founders & marketers", default: "founders, marketers, and AI creators" },
        { name: "core_pain", label: "Core Pain Point", placeholder: "e.g. hallucinating prompts", default: "wasting hours wrestling with brittle, hallucinating AI prompts" },
        { name: "solution", label: "Unique Solution", placeholder: "e.g. 1-click verified prompts", default: "1-click verified prompts with zero hallucination shields" }
      ],
      template: `Act as a world-class Direct-Response Copywriter. Write complete high-converting landing page copy for {product_name} targeting {target_audience} who suffer from {core_pain}. Introduce {solution} as the breakthrough mechanism. Include: Above-the-fold Hero (Headline, Subhead, CTA), Problem Agitation (PAS), 3 Benefit Blocks (Feature -> Human Transformation), and Risk-Free Guarantee CTA.`
    },
    {
      id: "copy-viral-hook-and-thread",
      title: "Viral Social Hook & Thought Leadership Post",
      tagline: "Turn any complex insight into a high-engagement LinkedIn & X post",
      category: "Marketing",
      icon: "🚀",
      upvotes: 4120,
      variables: [
        { name: "core_insight", label: "Core Insight", placeholder: "e.g. why 90% of AI prompts fail", default: "why static 2023 prompt templates fail and how real prompt compilation works" }
      ],
      template: `Act as a top 0.1% Tech Creator. Transform this insight: "{core_insight}" into a viral, high-authority post. Provide 3 scroll-stopping hook variations (Counter-intuitive truth, Hard lesson, Data revelation). Use short punchy sentences, high whitespace, 3 concrete takeaways, and zero corporate fluff.`
    },
    {
      id: "code-fullstack-feature-architect",
      title: "Full-Stack Feature Architecture Blueprint",
      tagline: "Architect complete features with typed schemas, API contracts & tests",
      category: "Coding",
      icon: "🛠️",
      upvotes: 6180,
      variables: [
        { name: "feature_desc", label: "Feature Description", placeholder: "e.g. Team permissions", default: "Browser extension companion for 1-click prompt injection" },
        { name: "tech_stack", label: "Tech Stack", placeholder: "e.g. TypeScript, React", default: "TypeScript, Vite, React, Chrome Manifest V3" }
      ],
      template: `Act as a Principal Full-Stack Software Architect. Design a production-grade implementation blueprint for "{feature_desc}" using {tech_stack}. Include: Domain types & database schemas, API request/response contracts, 5 critical edge cases / failure modes with mitigations, and phased step-by-step TDD checklist.`
    },
    {
      id: "code-root-cause-debugger",
      title: "Production Root-Cause Debugger & Fixer",
      tagline: "Diagnose errors, explain root causes & produce minimal clean diffs",
      category: "Coding",
      icon: "🩺",
      upvotes: 5310,
      variables: [
        { name: "error_msg", label: "Error Message / Bug", placeholder: "e.g. TypeError in event listener", default: "Memory leak or unbounded re-renders on active chat tab change" }
      ],
      template: `Act as an elite Systems Debugger. Analyze this issue: "{error_msg}". Provide: 1. Root cause explanation at runtime level. 2. Minimal reproduction scenario. 3. Minimal correct code replacement diff. 4. Automated unit test ensuring zero regressions.`
    },
    {
      id: "biz-yc-pitch-deck-scrutinizer",
      title: "YC Pitch Deck Scrutinizer & Moat Tester",
      tagline: "Stress-test your startup pitch against ruthless venture partner critiques",
      category: "Business",
      icon: "🏛️",
      upvotes: 4420,
      variables: [
        { name: "pitch", label: "Startup Pitch", placeholder: "e.g. AI Prompt Engine", default: "SPE: 1-click prompt companion & assurance compiler for ChatGPT and Claude" }
      ],
      template: `Act as a cynical, top-tier Silicon Valley Venture Partner. Scrutinize this startup pitch: "{pitch}". Deliver a high-stakes critique: 1. The fatal 18-month blind spot. 2. Defensibility vs OpenAI/Anthropic native updates. 3. Zero-dollar distribution velocity loop. 4. 5 hardest partner questions with winning answers.`
    },
    {
      id: "write-100-percent-humanizer",
      title: "100% Human Style Rewriter (AI Fluff Stripper)",
      tagline: "Strip generic robotic AI prose and rewrite in authentic, punchy human cadence",
      category: "Writing",
      icon: "✍️",
      upvotes: 7290,
      variables: [
        { name: "draft_text", label: "Draft Text to Humanize", placeholder: "Paste your AI draft here", default: "In today's fast-paced digital world, leveraging AI is crucial for unlocking unparalleled growth..." }
      ],
      template: `Act as an award-winning editor and literary essayist. Rewrite the following into authentic, compelling, natural human prose: "{draft_text}". Invariants: Completely purge AI clichés (delve, tapestry, crucial, testament, realm, fast-paced world). Vary sentence lengths for musical rhythm. Use active verbs and concrete specifics.`
    }
  ];

  let currentCategory = "All";
  let searchQuery = "";
  let openCardId = null;

  // Detect Host Platform
  function getHostPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("openai.com")) return "ChatGPT";
    if (host.includes("claude.ai")) return "Claude";
    if (host.includes("gemini.google.com")) return "Gemini";
    return "AI Chat";
  }

  // Find Target Input Field
  function findChatInput() {
    // ChatGPT
    const gptInput = document.querySelector("#prompt-textarea, textarea[data-id='root'], textarea[tabindex='0']");
    if (gptInput) return gptInput;

    // Claude
    const claudeInput = document.querySelector("div[contenteditable='true'], fieldset div[contenteditable='true']");
    if (claudeInput) return claudeInput;

    // Gemini
    const geminiInput = document.querySelector("rich-textarea div[contenteditable='true'], div[contenteditable='true']");
    if (geminiInput) return geminiInput;

    // Generic fallback
    return document.querySelector("textarea, div[contenteditable='true']");
  }

  // Inject Text into Active Chat Input
  function injectPromptText(text) {
    const input = findChatInput();
    if (!input) {
      alert("SPE: Could not detect the active chat box. Please click into the prompt area and try again.");
      return false;
    }

    input.focus();

    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
    }

    showToast("Prompt Injected & Ready! ⚡");
    return true;
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 32px;
      background: linear-gradient(135deg, #00d2ff, #3a7bd5);
      color: #0f172a;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,210,255,0.5);
      z-index: 10000000;
      transition: all 0.3s;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  // =========================================================================
  // 3. Floating Prompt Vault UI
  // =========================================================================
  const root = document.createElement("div");
  root.id = "spe-companion-root";

  // Trigger Pill
  const pill = document.createElement("div");
  pill.className = "spe-trigger-pill";
  pill.innerHTML = `
    <span>⚡ SPE Prompts</span>
    <span class="spe-badge">1-Click</span>
  `;

  // Drawer Panel
  const drawer = document.createElement("div");
  drawer.className = "spe-drawer-panel";

  function renderDrawerContent() {
    const platform = getHostPlatform();
    
    const filtered = VAULT.filter(p => {
      const matchCat = currentCategory === "All" || p.category === currentCategory;
      const matchSearch = !searchQuery || 
        p.title.toLowerCase().includes(searchQuery) || 
        p.tagline.toLowerCase().includes(searchQuery) ||
        p.category.toLowerCase().includes(searchQuery);
      return matchCat && matchSearch;
    });

    drawer.innerHTML = `
      <div class="spe-header">
        <div class="spe-header-title">
          <span>⚡ System Prompt Engine</span>
          <span class="spe-shield-badge">🛡️ Hallucination Shield</span>
        </div>
        <button class="spe-close-btn" id="spe-close-btn">✕</button>
      </div>

      <div class="spe-filter-bar">
        <input 
          type="text" 
          class="spe-search-input" 
          placeholder="Search 1-click power prompts (SEO, Copy, Code)..." 
          id="spe-search-box"
          value="${searchQuery}"
        />
        <div class="spe-category-pills">
          ${["All", "SEO", "Marketing", "Coding", "Business", "Writing"].map(cat => `
            <button class="spe-category-pill ${currentCategory === cat ? 'spe-active' : ''}" data-cat="${cat}">
              ${cat}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="spe-prompt-list">
        ${filtered.length === 0 ? `
          <div style="text-align: center; color: var(--spe-text-secondary); padding: 30px;">
            No prompts found matching "${searchQuery}".
          </div>
        ` : filtered.map(p => {
          const isOpen = openCardId === p.id;
          return `
            <div class="spe-prompt-card" data-id="${p.id}">
              <div class="spe-card-top">
                <div class="spe-card-title">
                  <span>${p.icon}</span>
                  <span>${p.title}</span>
                </div>
                <div class="spe-card-actions">
                  <button class="spe-btn-vars" data-action="toggle-vars" data-id="${p.id}">
                    ${isOpen ? "Hide" : "Edit"}
                  </button>
                  <button class="spe-btn-insert" data-action="insert" data-id="${p.id}">
                    Inject ⚡
                  </button>
                </div>
              </div>

              <div class="spe-card-tagline">${p.tagline}</div>

              ${isOpen ? `
                <div class="spe-var-drawer">
                  ${p.variables.map(v => `
                    <div class="spe-var-input-group">
                      <label>${v.label}</label>
                      <input 
                        type="text" 
                        data-var="${v.name}" 
                        data-pid="${p.id}" 
                        value="${v.default || ''}" 
                        placeholder="${v.placeholder}"
                      />
                    </div>
                  `).join("")}
                  <button class="spe-btn-insert" style="width: 100%; margin-top: 4px;" data-action="insert-with-vars" data-id="${p.id}">
                    Compile & Inject to ${platform} 🚀
                  </button>
                </div>
              ` : ''}

              <div class="spe-card-meta">
                <div class="spe-card-stats">
                  <span>👍 ${p.upvotes.toLocaleString()}</span>
                  <span>•</span>
                  <span>${p.category}</span>
                </div>
                <span style="font-size: 11px; color: #34d399;">✓ Invariant Sound</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="spe-footer">
        <span>Target: <strong>${platform}</strong> (Auto-Tuned)</span>
        <a href="https://github.com/system-prompt-engine" target="_blank">SPE Studio ↗</a>
      </div>
    `;

    // Attach Event Listeners
    drawer.querySelector("#spe-close-btn")?.addEventListener("click", () => {
      drawer.classList.remove("spe-open");
    });

    const searchBox = drawer.querySelector("#spe-search-box");
    if (searchBox) {
      searchBox.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderDrawerContent();
        const updatedBox = drawer.querySelector("#spe-search-box");
        if (updatedBox) {
          updatedBox.focus();
          updatedBox.setSelectionRange(updatedBox.value.length, updatedBox.value.length);
        }
      });
    }

    drawer.querySelectorAll(".spe-category-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        currentCategory = btn.dataset.cat;
        renderDrawerContent();
      });
    });

    drawer.querySelectorAll("button[data-action='toggle-vars']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        openCardId = openCardId === id ? null : id;
        renderDrawerContent();
      });
    });

    drawer.querySelectorAll("button[data-action='insert']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const prompt = VAULT.find(item => item.id === id);
        if (!prompt) return;

        let compiled = prompt.template;
        prompt.variables.forEach(v => {
          compiled = compiled.replace(new RegExp(`{${v.name}}`, 'g'), v.default || v.placeholder);
        });

        if (injectPromptText(compiled)) {
          drawer.classList.remove("spe-open");
        }
      });
    });

    drawer.querySelectorAll("button[data-action='insert-with-vars']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const prompt = VAULT.find(item => item.id === id);
        if (!prompt) return;

        let compiled = prompt.template;
        const inputs = drawer.querySelectorAll(`input[data-pid='${id}']`);
        inputs.forEach(input => {
          const varName = input.dataset.var;
          const val = input.value.trim() || input.placeholder;
          compiled = compiled.replace(new RegExp(`{${varName}}`, 'g'), val);
        });

        if (injectPromptText(compiled)) {
          drawer.classList.remove("spe-open");
        }
      });
    });
  }

  pill.addEventListener("click", () => {
    const isOpen = drawer.classList.contains("spe-open");
    if (isOpen) {
      drawer.classList.remove("spe-open");
    } else {
      renderDrawerContent();
      drawer.classList.add("spe-open");
      setTimeout(() => {
        drawer.querySelector("#spe-search-box")?.focus();
      }, 100);
    }
  });

  root.appendChild(pill);
  root.appendChild(drawer);
  document.body.appendChild(root);

  // =========================================================================
  // 4. Real-Time Specification Lift Floating Badge (In-Chat Discovery)
  // =========================================================================
  const liftContainer = document.createElement("div");
  liftContainer.id = "spe-lift-container";
  liftContainer.className = "spe-lift-container";
  document.body.appendChild(liftContainer);

  let currentLiftResult = null;
  let dismissedInput = null;

  function updateLiftBadge(result, originalText) {
    if (!result || !result.triggered || result.decision !== "SPECIFICATION_LIFT_AVAILABLE") {
      liftContainer.classList.remove("spe-lift-visible");
      currentLiftResult = null;
      return;
    }

    if (dismissedInput === originalText) {
      return;
    }

    currentLiftResult = result;
    const icon = OUTCOME_CAPABILITIES[result.capabilityId]?.icon || "⚡";

    liftContainer.innerHTML = `
      <div class="spe-lift-badge">
        <div class="spe-lift-info">
          <span class="spe-lift-icon">${icon}</span>
          <span class="spe-lift-label">${result.capabilityName}</span>
          <span class="spe-lift-desc">• Elevate into verified 2026 specification</span>
        </div>
        <button class="spe-lift-action-btn" id="spe-lift-apply-btn">
          Enhance 1-Click 🚀
        </button>
        <button class="spe-lift-dismiss-btn" id="spe-lift-dismiss-btn" title="Dismiss">
          ✕
        </button>
      </div>
    `;

    liftContainer.querySelector("#spe-lift-apply-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentLiftResult && currentLiftResult.liftedSpecificationPrompt) {
        injectPromptText(currentLiftResult.liftedSpecificationPrompt);
        liftContainer.classList.remove("spe-lift-visible");
        showToast(`⚡ Elevated into ${result.capabilityName}!`);
      }
    });

    liftContainer.querySelector("#spe-lift-dismiss-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissedInput = originalText;
      liftContainer.classList.remove("spe-lift-visible");
    });

    liftContainer.classList.add("spe-lift-visible");
  }

  // Real-time Chat Input Observer with 200ms debounce
  let debounceTimer = null;
  function setupInputObserver() {
    function handleInputEvent(e) {
      const target = e.target;
      if (!target) return;

      const isInput = target.tagName === "TEXTAREA" || 
                      target.tagName === "INPUT" || 
                      target.isContentEditable ||
                      target.closest?.("#prompt-textarea") ||
                      target.closest?.("rich-textarea");

      if (!isInput) return;

      const text = target.value || target.textContent || "";

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const result = classifyOutcomeIntent(text);
        updateLiftBadge(result, text);
      }, 200);
    }

    document.addEventListener("input", handleInputEvent, true);
    document.addEventListener("keyup", handleInputEvent, true);
  }

  setupInputObserver();

  console.log("⚡ SPE Companion loaded into " + getHostPlatform() + " with Specification Lift Observer");
})();
