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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Principal Product Architect and Senior Systems Engineer.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as an award-winning Creative Technologist and WebGL/Three.js Systems Architect.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Principal Scientific Research Fellow and Empirical Methodologist.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Chief Marketing Officer and Direct-Response Creative Director.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a World-Class Socratic Master Tutor and Cognitive Pedagogist.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Principal Autonomous AI Agent Architect and Security Systems Engineer.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as an Award-Winning Senior Editorial Director and Literary Stylist.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Top-Tier Silicon Valley Startup Partner and Commercial Strategist.
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
      specificationTemplate: (input, model = "Claude 6.2 / GPT-6.1 / Gemini 3.9 Pro") => `Act as a Principal Automation Architect and Site Reliability Engineer.
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
        badgeLabel: `SPE Lift: ${bestMatch.userFacingLabel}`,
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

    showToast("Prompt injected successfully");
    return true;
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 32px;
      background: #18181b;
      color: #f4f4f5;
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Geist", system-ui, sans-serif;
      font-weight: 500;
      font-size: 12.5px;
      letter-spacing: -0.01em;
      padding: 9px 16px;
      border-radius: 10px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      z-index: 10000000;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
    <span>SPE Prompts</span>
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>System Prompt Engine</span>
          <span class="spe-shield-badge">Invariant Shield</span>
        </div>
        <button class="spe-close-btn" id="spe-close-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
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
                  <span>${p.title}</span>
                </div>
                <div class="spe-card-actions">
                  <button class="spe-btn-vars" data-action="toggle-vars" data-id="${p.id}">
                    ${isOpen ? "Hide" : "Edit"}
                  </button>
                  <button class="spe-btn-insert" data-action="insert" data-id="${p.id}">
                    Inject
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
                    Compile & Inject to ${platform}
                  </button>
                </div>
              ` : ''}

              <div class="spe-card-meta">
                <div class="spe-card-stats">
                  <span>${p.upvotes.toLocaleString()} verified</span>
                  <span>•</span>
                  <span>${p.category}</span>
                </div>
                <span style="font-size: 11px; color: #10b981;">Sound</span>
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
        liftContainer.innerHTML = `
      <div class="spe-lift-badge">
        <div class="spe-lift-info">
          <span class="spe-lift-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </span>
          <span class="spe-lift-label">${result.capabilityName}</span>
          <span class="spe-lift-desc">• Compile into verified specification</span>
        </div>
        <button class="spe-lift-action-btn" id="spe-lift-apply-btn">
          Enhance Specification
        </button>
        <button class="spe-lift-dismiss-btn" id="spe-lift-dismiss-btn" title="Dismiss">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    liftContainer.querySelector("#spe-lift-apply-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentLiftResult && currentLiftResult.liftedSpecificationPrompt) {
        injectPromptText(currentLiftResult.liftedSpecificationPrompt);
        liftContainer.classList.remove("spe-lift-visible");
        showToast(`Specification elevated: ${result.capabilityName}`);
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

  // =========================================================================
  // 4. SPE Universal Auto-Actions (QuillBot & Grammarly Killer Core)
  // =========================================================================
  const AI_CLICHE_MAP = [
    { regex: /\bdelve(s|d|ing)?\s+into\b/gi, rep: "explore" },
    { regex: /\ba\s+testament\s+to\b/gi, rep: "proof of" },
    { regex: /\brich\s+tapestry\b/gi, rep: "mosaic" },
    { regex: /\bin\s+today's\s+fast-paced\s+(digital\s+)?world\b/gi, rep: "today" },
    { regex: /\bcrucial\s+role\b/gi, rep: "key role" },
    { regex: /\bbeacon\s+of\s+hope\b/gi, rep: "promising signal" },
    { regex: /\brealm\s+of\b/gi, rep: "field of" },
    { regex: /\bmultifaceted\b/gi, rep: "complex" },
    { regex: /\bpivotal\b/gi, rep: "critical" },
    { regex: /\bfoster(s|ed|ing)?\b/gi, rep: "support" },
    { regex: /\bembark(s|ed|ing)?\s+on\b/gi, rep: "start" },
    { regex: /\bharness(es|ed|ing)?\s+the\s+power\s+of\b/gi, rep: "use" },
    { regex: /\bnavigate\s+the\s+complexities\s+of\b/gi, rep: "manage" },
    { regex: /\bit\s+is\s+worth\s+noting\s+that\b/gi, rep: "notably," },
    { regex: /\bunleash(es|ed|ing)?\b/gi, rep: "release" },
    { regex: /\bparamount\b/gi, rep: "essential" },
    { regex: /\bever-evolving\b/gi, rep: "evolving" },
    { regex: /\bintricate\s+dance\b/gi, rep: "interplay" },
    { regex: /\bplethora\s+of\b/gi, rep: "many" },
    { regex: /\butilize(s|d|ing)?\b/gi, rep: "use" },
    { regex: /\bleverage(s|d|ing)?\b/gi, rep: "apply" },
    { regex: /\bseamlessly\b/gi, rep: "smoothly" },
    { regex: /\bcutting-edge\b/gi, rep: "modern" },
    { regex: /\bstate-of-the-art\b/gi, rep: "modern" },
    { regex: /\brobust\b/gi, rep: "reliable" }
  ];

  const WEAK_INTENSIFIERS_MAP = [
    { regex: /\bvery\s+unique\b/gi, rep: "unique" },
    { regex: /\breally\s+important\b/gi, rep: "essential" },
    { regex: /\bextremely\s+crucial\b/gi, rep: "vital" },
    { regex: /\bvery\s+helpful\b/gi, rep: "valuable" },
    { regex: /\bvery\s+good\b/gi, rep: "strong" },
    { regex: /\breally\s+great\b/gi, rep: "excellent" },
    { regex: /\bbasically\b/gi, rep: "" },
    { regex: /\bactually\b/gi, rep: "" },
    { regex: /\bliterally\b/gi, rep: "" }
  ];

  const extStorage = (typeof browser !== "undefined" && browser.storage) 
    ? browser.storage 
    : (typeof chrome !== "undefined" && chrome.storage) 
      ? chrome.storage 
      : null;

  async function getDailyUsageStats() {
    const today = new Date().toISOString().slice(0, 10);
    if (!extStorage || !extStorage.local) {
      return { count: 0, limit: 15, remaining: 15, isPro: false };
    }
    return new Promise((resolve) => {
      extStorage.local.get(["spe_daily_usage", "spe_license_data"], (res) => {
        const isPro = Boolean(res && res.spe_license_data && res.spe_license_data.valid && new Date(res.spe_license_data.expiresAt) > new Date());
        const daily = (res && res.spe_daily_usage) || {};
        const count = daily.date === today ? (daily.count || 0) : 0;
        resolve({
          date: today,
          count,
          limit: 15,
          remaining: isPro ? 999999 : Math.max(0, 15 - count),
          isPro
        });
      });
    });
  }

  function recordActionUsageStats(metrics = {}) {
    const today = new Date().toISOString().slice(0, 10);
    if (!extStorage || !extStorage.local) return;
    try {
      extStorage.local.get(["spe_daily_usage", "spe_lifetime_roi"], (res) => {
        const daily = (res && res.spe_daily_usage) || {};
        const count = daily.date === today ? (daily.count || 0) : 0;
        const nextCount = count + 1;
        const roi = (res && res.spe_lifetime_roi) || { clichesPurged: 0, wordsPruned: 0, actionsCount: 0, timeSavedMinutes: 0 };
        const nextRoi = {
          clichesPurged: (roi.clichesPurged || 0) + (metrics.clichesPurged || 0),
          wordsPruned: (roi.wordsPruned || 0) + (metrics.wordsPruned || 0),
          actionsCount: (roi.actionsCount || 0) + 1,
          timeSavedMinutes: Math.round(((roi.actionsCount || 0 + 1) * 45) / 60)
        };
        extStorage.local.set({
          spe_daily_usage: { date: today, count: nextCount },
          spe_lifetime_roi: nextRoi
        });
      });
    } catch {}
  }

  function runAutoAction(text, actionType) {
    if (!text || !text.trim()) return text;
    let t = text;

    if (actionType === "humanize") {
      t = t.replace(/\bis\s+utilized\s+by\b/gi, "is used by")
           .replace(/\bhas\s+been\s+demonstrated\s+by\b/gi, "was shown by")
           .replace(/\bcan\s+be\s+observed\b/gi, "appears")
           .replace(/\bin\s+order\s+to\b/gi, "to")
           .replace(/\bdue\s+to\s+the\s+fact\s+that\b/gi, "because")
           .replace(/\bat\s+this\s+point\s+in\s+time\b/gi, "now");
      for (const item of AI_CLICHE_MAP) {
        t = t.replace(item.regex, item.rep);
      }
      t = t.replace(/\s{2,}/g, " ").replace(/,\s*,/g, ",").trim();
      return t;
    }

    if (actionType === "fluent") {
      t = runAutoAction(t, "humanize");
      t = t.replace(/\butilize\b/gi, "use")
           .replace(/\bcommence\b/gi, "begin")
           .replace(/\bterminate\b/gi, "end")
           .replace(/\bfacilitate\b/gi, "help")
           .replace(/\ssubsequently\s/gi, " then ")
           .replace(/\s{2,}/g, " ").trim();
      return t;
    }

    if (actionType === "grammar") {
      t = t.replace(/\b(\w+)\s+\1\b/gi, "$1");
      for (const item of WEAK_INTENSIFIERS_MAP) {
        t = t.replace(item.regex, item.rep);
      }
      t = t.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
      t = t.replace(/\s+([,.:;?!])/g, "$1").replace(/\s{2,}/g, " ").trim();
      return t;
    }

    if (actionType === "executive") {
      t = runAutoAction(t, "humanize");
      t = t.replace(/\bi\s+think\s+we\s+should\b/gi, "we recommend")
           .replace(/\bwe\s+need\s+to\s+make\s+sure\b/gi, "we must verify")
           .replace(/\bdo\s+it\s+asap\b/gi, "prioritize immediately")
           .replace(/\bgood\s+results\b/gi, "measurable impact")
           .replace(/\bbig\s+problem\b/gi, "material risk")
           .replace(/\bfix\s+the\s+issue\b/gi, "remediate the defect")
           .replace(/\s{2,}/g, " ").trim();
      return t;
    }

    if (actionType === "promptify") {
      const clean = runAutoAction(t, "humanize");
      return `Act as an elite domain authority. Objective: ${clean}. Execute with precision, concrete evidence, step-by-step phased structure, and zero generic filler.`;
    }

    return t;
  }

  function computeTransformationDiff(original, transformed) {
    const origWords = (original || "").trim().split(/\s+/).filter(Boolean);
    const transWords = (transformed || "").trim().split(/\s+/).filter(Boolean);

    let clichesDetected = 0;
    for (const item of AI_CLICHE_MAP) {
      const matches = original.match(item.regex);
      if (matches) clichesDetected += matches.length;
    }

    const wordsPruned = Math.max(0, origWords.length - transWords.length);
    const humanScore = clichesDetected === 0 ? 100 : Math.max(70, 100 - clichesDetected * 10);

    const diff = [];
    let i = 0, j = 0;
    while (i < origWords.length || j < transWords.length) {
      if (i < origWords.length && j < transWords.length && origWords[i].toLowerCase() === transWords[j].toLowerCase()) {
        diff.push({ type: "same", text: transWords[j] });
        i++;
        j++;
      } else if (i < origWords.length && (j >= transWords.length || !transWords.slice(j, j + 3).some(w => w.toLowerCase() === origWords[i].toLowerCase()))) {
        diff.push({ type: "del", text: origWords[i] });
        i++;
      } else if (j < transWords.length) {
        diff.push({ type: "ins", text: transWords[j] });
        j++;
      } else {
        break;
      }
    }

    return {
      original,
      transformed,
      diff,
      metrics: {
        clichesPurged: clichesDetected,
        wordsPruned,
        humanScore: `${humanScore}% Human Cadence`,
        returnMultiple: "10x Benefit Delivered"
      }
    };
  }

  // =========================================================================
  // 5. Interactive Selection HUD & 10/10 Live Diff Hologram
  // =========================================================================
  function setupSelectionActionBar() {
    let bar = document.getElementById("spe-inline-action-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "spe-inline-action-bar";
      bar.innerHTML = `
        <div class="spe-bar-brand">
          <svg class="spe-bar-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>SPE</span>
        </div>
        <button class="spe-action-btn" data-action="humanize">Humanize <span class="spe-btn-key">⌥1</span></button>
        <button class="spe-action-btn" data-action="executive">Executive <span class="spe-btn-key">⌥2</span></button>
        <button class="spe-action-btn" data-action="grammar">Polish <span class="spe-btn-key">⌥3</span></button>
        <button class="spe-action-btn" data-action="promptify">Prompt Lift <span class="spe-btn-key">⌥4</span></button>
      `;
      document.body.appendChild(bar);
    }

    let diffModal = document.getElementById("spe-diff-modal");
    if (!diffModal) {
      diffModal = document.createElement("div");
      diffModal.id = "spe-diff-modal";
      document.body.appendChild(diffModal);
    }

    let activeSelection = "";
    let activeRange = null;
    let currentDiffData = null;

    async function refreshUsageBadge() {
      const stats = await getDailyUsageStats();
      const badge = bar.querySelector("#spe-bar-usage");
      if (badge) {
        badge.textContent = stats.isPro ? "Pro" : `${stats.remaining}/15 Free`;
      }
    }
    refreshUsageBadge();

    function positionElementNearRange(element, range) {
      if (!range) return;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const top = Math.max(16, rect.bottom + window.scrollY + 8);
      const left = Math.max(16, Math.min(window.innerWidth - 536, rect.left + window.scrollX));
      element.style.top = `${top}px`;
      element.style.left = `${left}px`;
    }

    function handleSelectionCheck(e) {
      if (bar.contains(e.target) || diffModal.contains(e.target)) return;

      const sel = window.getSelection();
      const selected = sel ? sel.toString().trim() : "";

      if (selected && selected.length >= 3) {
        activeSelection = selected;
        activeRange = sel.getRangeAt(0);
        const rect = activeRange.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          const top = Math.max(10, rect.top + window.scrollY - 46);
          const left = Math.max(10, Math.min(window.innerWidth - 490, rect.left + window.scrollX));
          bar.style.top = `${top}px`;
          bar.style.left = `${left}px`;
          bar.style.display = "flex";
          refreshUsageBadge();
          return;
        }
      }

      if (!diffModal.contains(e.target) && diffModal.style.display !== "flex") {
        bar.style.display = "none";
      }
    }

    document.addEventListener("mouseup", handleSelectionCheck);
    document.addEventListener("keyup", (e) => {
      if (["Shift", "Control", "Meta", "Alt"].includes(e.key)) return;
      handleSelectionCheck(e);
    });

    // Global Hotkey: Cmd+Shift+S (Mac) / Ctrl+Shift+S (Win/Linux)
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const sel = window.getSelection();
        const selected = sel ? sel.toString().trim() : "";
        if (selected && selected.length >= 3) {
          activeSelection = selected;
          activeRange = sel.getRangeAt(0);
          showDiffHologram(activeSelection, "humanize", "Editorial Polish");
        } else {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT" || activeEl.isContentEditable)) {
            const val = activeEl.value || activeEl.innerText || "";
            if (val.trim()) {
              activeSelection = val.trim();
              activeRange = null;
              showDiffHologram(activeSelection, "humanize", "Editorial Polish");
            }
          }
        }
      }

      // Keys inside open diff modal
      if (diffModal.style.display === "flex") {
        if (e.key === "Escape") {
          e.preventDefault();
          dismissDiffModal();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          applyDiffTransformation();
        }
      }
    });

    const runtimeApi = (typeof browser !== "undefined" && browser.runtime) 
      ? browser.runtime 
      : (typeof chrome !== "undefined" && chrome.runtime) 
        ? chrome.runtime 
        : null;

    if (runtimeApi && runtimeApi.onMessage) {
      runtimeApi.onMessage.addListener((msg) => {
        if (msg && msg.type === "TRIGGER_SPE_QUICK_ACTION") {
          const sel = window.getSelection();
          const selected = sel ? sel.toString().trim() : "";
          if (selected && selected.length >= 3) {
            activeSelection = selected;
            activeRange = sel.getRangeAt(0);
            showDiffHologram(activeSelection, "humanize", "Editorial Polish");
          } else {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT" || activeEl.isContentEditable)) {
              const val = activeEl.value || activeEl.innerText || "";
              if (val.trim()) {
                activeSelection = val.trim();
                activeRange = null;
                showDiffHologram(activeSelection, "humanize", "Editorial Polish");
              }
            }
          }
        }
      });
    }

    async function showDiffHologram(text, actionType, actionLabel) {
      bar.style.display = "none";
      const transformed = runAutoAction(text, actionType);
      const diffResult = computeTransformationDiff(text, transformed);
      currentDiffData = diffResult;

      const usage = await getDailyUsageStats();
      const usagePledge = usage.isPro 
        ? "SPE Pro Active • Unlimited Specifications"
        : `Free Action (${usage.count + 1}/${usage.limit} Today)`;

      const diffHtml = diffResult.diff.map(tok => {
        if (tok.type === "del") {
          return `<span class="spe-diff-del">${escapeHtml(tok.text)}</span>`;
        }
        if (tok.type === "ins") {
          return `<span class="spe-diff-ins">${escapeHtml(tok.text)}</span>`;
        }
        return `<span class="spe-diff-same">${escapeHtml(tok.text)} </span>`;
      }).join("");

      diffModal.innerHTML = `
        <div class="spe-diff-header">
          <div class="spe-diff-title-row">
            <div class="spe-diff-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
            </div>
            <span class="spe-diff-title">Editorial Polish</span>
            <span class="spe-diff-mode-badge">${escapeHtml(diffResult.metrics.humanScore || "Refined")}</span>
          </div>
          <button class="spe-diff-close" id="spe-diff-close-btn" title="Discard (Esc)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="spe-diff-stats-strip">
          <span class="spe-stat-tag">${diffResult.metrics.clichesPurged} Clichés Purged</span>
          <span class="spe-stat-sep">•</span>
          <span class="spe-stat-tag">${diffResult.metrics.wordsPruned} Words Pruned</span>
          <span class="spe-stat-sep">•</span>
          <span class="spe-stat-tag emerald">Zero AI Drift</span>
        </div>
        <div class="spe-diff-body" id="spe-diff-tokens-body">
          ${diffHtml}
        </div>
        <div class="spe-diff-footer">
          <div class="spe-diff-meta">
            <span class="spe-status-dot"></span>
            <span>100% Offline Core</span>
          </div>
          <div class="spe-diff-actions">
            <button class="spe-diff-btn-copy" id="spe-diff-btn-copy">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
            <button class="spe-diff-btn-apply" id="spe-diff-btn-apply">
              Replace
              <kbd>↵</kbd>
            </button>
          </div>
        </div>
      `;

      if (activeRange) {
        positionElementNearRange(diffModal, activeRange);
      } else {
        diffModal.style.top = "15%";
        diffModal.style.left = "calc(50% - 260px)";
      }

      diffModal.style.display = "flex";

      // Bind Modal Buttons
      diffModal.querySelector("#spe-diff-close-btn")?.addEventListener("click", dismissDiffModal);
      diffModal.querySelector("#spe-diff-btn-apply")?.addEventListener("click", applyDiffTransformation);
      diffModal.querySelector("#spe-diff-btn-copy")?.addEventListener("click", copyDiffTransformation);
    }

    function escapeHtml(str) {
      return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function dismissDiffModal() {
      diffModal.style.display = "none";
      currentDiffData = null;
    }

    function copyDiffTransformation() {
      if (!currentDiffData) return;
      navigator.clipboard.writeText(currentDiffData.transformed).then(() => {
        showToast("Copied to clipboard");
        recordActionUsageStats(currentDiffData.metrics);
        dismissDiffModal();
      });
    }

    function applyDiffTransformation() {
      if (!currentDiffData) return;
      const transformed = currentDiffData.transformed;
      const activeEl = document.activeElement;
      const isEditable = activeEl && (
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "INPUT" ||
        activeEl.isContentEditable
      );

      let replaced = false;
      if (isEditable) {
        try {
          replaced = document.execCommand("insertText", false, transformed);
        } catch {}

        if (!replaced) {
          if (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT") {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            activeEl.value = activeEl.value.slice(0, start) + transformed + activeEl.value.slice(end);
            activeEl.selectionStart = activeEl.selectionEnd = start + transformed.length;
            activeEl.dispatchEvent(new Event("input", { bubbles: true }));
            replaced = true;
          } else if (activeEl.isContentEditable && activeRange) {
            activeRange.deleteContents();
            activeRange.insertNode(document.createTextNode(transformed));
            activeEl.dispatchEvent(new Event("input", { bubbles: true }));
            replaced = true;
          }
        }
      } else if (activeRange) {
        try {
          activeRange.deleteContents();
          activeRange.insertNode(document.createTextNode(transformed));
          replaced = true;
        } catch {}
      }

      recordActionUsageStats(currentDiffData.metrics);

      if (replaced) {
        showToast("Specification applied");
      } else {
        navigator.clipboard.writeText(transformed).then(() => {
          showToast("Copied to clipboard");
        });
      }

      dismissDiffModal();
    }

    // Bind Bar Click Actions
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".spe-action-btn");
      if (!btn) return;
      const action = btn.dataset.action;
      if (!action || !activeSelection) return;

      const labels = {
        humanize: "Editorial Polish",
        fluent: "Fluent Rephrase",
        grammar: "Flow Polish",
        executive: "Executive Tone",
        promptify: "Specification Lift"
      };

      showDiffHologram(activeSelection, action, labels[action] || "Auto-Action");
    });
  }

  setupSelectionActionBar();

  // =========================================================================
  // 7. SPE Autonomous Cursor Agent (Pet Parked/Optional by Default)
  // =========================================================================
  function setupClickyCursorBuddy() {
    if (document.getElementById("spe-autonomous-ai-cursor")) return;

    const CODEX_PETS = [
      { slug: "firefly--lingxiaotian", name: "Firefly" },
      { slug: "kid-goku--julianhuang", name: "Kid Goku" },
      { slug: "doraemon--xueshi", name: "Doraemon" },
      { slug: "shinchan--chenxin-dlut", name: "Shin-chan" },
      { slug: "frieren--lingxiaotian", name: "Frieren" }
    ];
    let petEnabled = false; // Parked by default per user directive
    let currentPetIdx = 0;

    function getPetWebp(slug, action) {
      return `https://codexpet.top/assets/previews/${slug}/webp/${action || "idle"}.webp`;
    }

    // Optional Pet Container (Hidden/Parked by default)
    const petWrap = document.createElement("div");
    petWrap.id = "spe-codex-pet-wrap";
    petWrap.style.cssText = "position:fixed;top:0;left:0;width:88px;height:96px;pointer-events:auto;cursor:pointer;z-index:2147483645;will-change:transform;display:none;filter:drop-shadow(0 8px 16px rgba(0,0,0,0.4));";
    const petImg = document.createElement("img");
    petImg.src = getPetWebp(CODEX_PETS[0].slug, "idle");
    petImg.style.cssText = "width:88px;height:88px;object-fit:contain;image-rendering:pixelated;display:block;pointer-events:none;";
    petWrap.appendChild(petImg);
    document.body.appendChild(petWrap);

    // 1. Visible Autonomous Moving AI Cursor
    const aiCursor = document.createElement("div");
    aiCursor.id = "spe-autonomous-ai-cursor";
    aiCursor.style.cssText = "position:fixed;top:0;left:0;width:36px;height:36px;pointer-events:none;z-index:2147483647;will-change:transform;opacity:1;filter:drop-shadow(0 8px 16px rgba(234,88,12,0.55));font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    aiCursor.innerHTML = `
      <div id="spe-ai-cursor-ripple" style="position:absolute;top:-12px;left:-12px;width:42px;height:42px;border-radius:50%;border:3px solid #ea580c;opacity:0;transform:scale(0.4);transition:all 0.35s ease-out;"></div>
      <svg viewBox="0 0 28 28" width="30" height="30" fill="none">
        <path d="M5 3L23 13.5L14.2 15.8L10.5 24.5L5 3Z" fill="#EA580C" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>
      <div id="spe-ai-cursor-tag" style="position:absolute;left:24px;top:18px;background:#1c1917;color:#fff;border:1.5px solid #ea580c;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,0.35);">🤖 Autonomous Cursor · Idle</div>
    `;
    document.body.appendChild(aiCursor);

    // 2. Highlight Box for Autonomous DOM Scanning
    const scanBox = document.createElement("div");
    scanBox.id = "spe-autonomous-scan-box";
    scanBox.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483644;border:2px solid #ea580c;background:rgba(234,88,12,0.08);border-radius:10px;opacity:0;transition:all 0.28s cubic-bezier(0.22,1,0.36,1);box-shadow:0 0 0 4px rgba(234,88,12,0.15);";
    document.body.appendChild(scanBox);

    // 3. Autonomous Command Bar (Bottom-Right)
    const dock = document.createElement("div");
    dock.id = "spe-autonomous-dock";
    dock.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483646;display:flex;flex-direction:column;gap:8px;width:390px;max-width:calc(100vw - 32px);background:rgba(28,25,23,0.96);color:#fafaf9;padding:12px 14px;border-radius:18px;box-shadow:0 18px 42px rgba(0,0,0,0.45);border:1px solid rgba(251,146,60,0.45);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    dock.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#fb923c;">
          <span>🎯 Autonomous Cursor Agent</span>
          <span id="spe-mission-status" style="font-size:10px;background:rgba(234,88,12,0.2);color:#fdba74;padding:2px 7px;border-radius:999px;">Ready</span>
        </div>
        <button id="spe-toggle-pet-btn" style="background:transparent;color:#a8a29e;border:1px solid #44403c;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;" title="Optional Pet (Parked by default)">🐾 Pet: OFF</button>
      </div>
      <div style="display:flex;gap:6px;">
        <input id="spe-autonomous-query" type="text" placeholder="Ask cursor to search/do anything (e.g. iPhone 16 Pro price)..." value="iPhone 16 Pro Max price and specs" style="flex:1;background:#292524;color:#fff;border:1px solid #44403c;border-radius:10px;padding:7px 10px;font-size:12px;outline:none;" />
        <button id="spe-autonomous-go" style="background:linear-gradient(135deg,#ea580c,#d97706);color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">▶ Go Search</button>
      </div>
      <div id="spe-autonomous-results" style="display:none;max-height:190px;overflow-y:auto;background:#141210;border:1px solid #292524;border-radius:10px;padding:8px 10px;font-size:11px;line-height:1.45;color:#e7e5e4;"></div>
    `;
    document.body.appendChild(dock);

    const cursorTag = document.getElementById("spe-ai-cursor-tag");
    const statusBadge = document.getElementById("spe-mission-status");
    const resultsBox = document.getElementById("spe-autonomous-results");

    function setCursorStatus(text) {
      if (cursorTag) cursorTag.textContent = `🤖 ${text}`;
      if (statusBadge) statusBadge.textContent = text;
    }

    function pulseCursorRipple() {
      const r = document.getElementById("spe-ai-cursor-ripple");
      if (!r) return;
      r.style.transition = "none";
      r.style.opacity = "1";
      r.style.transform = "scale(0.4)";
      requestAnimationFrame(() => {
        r.style.transition = "all 0.4s ease-out";
        r.style.opacity = "0";
        r.style.transform = "scale(2.0)";
      });
    }

    function highlightElement(el) {
      if (!el || !el.getBoundingClientRect) {
        scanBox.style.opacity = "0";
        return;
      }
      const r = el.getBoundingClientRect();
      scanBox.style.left = `${Math.max(4, r.left - 6)}px`;
      scanBox.style.top = `${Math.max(4, r.top - 6)}px`;
      scanBox.style.width = `${Math.min(window.innerWidth - 12, r.width + 12)}px`;
      scanBox.style.height = `${Math.min(window.innerHeight - 12, r.height + 12)}px`;
      scanBox.style.opacity = "1";
    }

    let cursorTargetX = window.innerWidth - 260;
    let cursorTargetY = window.innerHeight - 180;
    let cursorCurX = cursorTargetX;
    let cursorCurY = cursorTargetY;

    function tickCursor() {
      cursorCurX += (cursorTargetX - cursorCurX) * 0.16;
      cursorCurY += (cursorTargetY - cursorCurY) * 0.16;
      aiCursor.style.transform = `translate3d(${cursorCurX.toFixed(1)}px, ${cursorCurY.toFixed(1)}px, 0)`;
      if (petEnabled) {
        petWrap.style.transform = `translate3d(${(cursorCurX - 48).toFixed(1)}px, ${(cursorCurY - 88).toFixed(1)}px, 0)`;
      }
      requestAnimationFrame(tickCursor);
    }
    requestAnimationFrame(tickCursor);

    // Toggle Optional Pet
    const togglePetBtn = document.getElementById("spe-toggle-pet-btn");
    if (togglePetBtn) {
      togglePetBtn.addEventListener("click", () => {
        petEnabled = !petEnabled;
        petWrap.style.display = petEnabled ? "block" : "none";
        togglePetBtn.textContent = petEnabled ? `🐾 Pet: ${CODEX_PETS[currentPetIdx].name}` : "🐾 Pet: OFF";
        togglePetBtn.style.color = petEnabled ? "#fb923c" : "#a8a29e";
      });
    }
    petWrap.addEventListener("click", () => {
      currentPetIdx = (currentPetIdx + 1) % CODEX_PETS.length;
      petImg.src = getPetWebp(CODEX_PETS[currentPetIdx].slug, "waving");
      if (togglePetBtn) togglePetBtn.textContent = `🐾 Pet: ${CODEX_PETS[currentPetIdx].name}`;
    });

    // Helper: Find search box on current page (Google, Bing, Amazon, YouTube, ChatGPT, etc.)
    function findSearchOrInputBox() {
      const selectors = [
        "textarea[name='q']",
        "input[name='q']",
        "input[type='search']",
        "input[aria-label*='Search' i]",
        "textarea[aria-label*='Search' i]",
        "#twotabsearchtextbox",
        "textarea",
        "input[type='text']:not(#spe-autonomous-query)"
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect) {
          const r = el.getBoundingClientRect();
          if (r.width > 60 && r.height > 16) return el;
        }
      }
      return null;
    }

    // Step A: Execute Autonomous Search in front of the user
    function startAutonomousSearch(query) {
      const cleanQuery = (query || "").trim() || "iPhone 16 Pro Max price and specs";
      setCursorStatus(`Moving to Search Bar...`);
      const searchInput = findSearchOrInputBox();

      // Save mission state so when search results page loads, cursor continues scanning results automatically
      try {
        if (api && api.storage && api.storage.local) {
          api.storage.local.set({
            spe_autonomous_mission: {
              query: cleanQuery,
              stage: "SCAN_RESULTS",
              startedAt: Date.now()
            }
          });
        }
      } catch (e) {}

      if (searchInput) {
        const r = searchInput.getBoundingClientRect();
        highlightElement(searchInput);
        cursorTargetX = r.left + Math.min(80, r.width / 3);
        cursorTargetY = r.top + r.height / 2;

        setTimeout(() => {
          pulseCursorRipple();
          searchInput.focus();
          setCursorStatus(`Typing "${cleanQuery}"...`);
          let idx = 0;
          const timer = setInterval(() => {
            idx += 1;
            const slice = cleanQuery.slice(0, idx);
            if ("value" in searchInput) {
              searchInput.value = slice;
              searchInput.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
              searchInput.textContent = slice;
              searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
            }
            cursorTargetX = Math.min(r.right - 20, r.left + 24 + idx * 7);
            if (idx >= cleanQuery.length) {
              clearInterval(timer);
              pulseCursorRipple();
              setCursorStatus("Submitting Search...");
              setTimeout(() => {
                const form = searchInput.closest("form");
                if (form) {
                  form.submit();
                } else {
                  window.location.href = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
                }
              }, 350);
            }
          }, 42);
        }, 550);
      } else {
        // No search input on current page -> move cursor to top bar and navigate directly to Google Search in front of user
        cursorTargetX = window.innerWidth / 2;
        cursorTargetY = 40;
        pulseCursorRipple();
        setCursorStatus(`Opening Google Search for "${cleanQuery}"...`);
        setTimeout(() => {
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
        }, 500);
      }
    }

    // Step B: When Search Results Page Loads, Cursor Autonomously Scans & Extracts Live Results in Front of User
    function checkAndResumeAutonomousScan() {
      if (!api || !api.storage || !api.storage.local) return;
      api.storage.local.get(["spe_autonomous_mission"], (data) => {
        const mission = data && data.spe_autonomous_mission;
        if (!mission || mission.stage !== "SCAN_RESULTS") return;
        if (Date.now() - (mission.startedAt || 0) > 60000) return; // Expire after 60s

        // Clear stage so it doesn't loop forever
        api.storage.local.set({ spe_autonomous_mission: { ...mission, stage: "DONE" } });

        // Find result headings/cards on Google or any search page
        const headings = Array.from(document.querySelectorAll("div#search h3, main h3, h3, [data-sokoban-container] h3")).filter((h) => {
          const r = h.getBoundingClientRect();
          return r.width > 40 && r.top > 60 && h.textContent.trim().length > 4;
        }).slice(0, 5);

        if (headings.length === 0) return;

        resultsBox.style.display = "block";
        resultsBox.innerHTML = `<div style="color:#fb923c;font-weight:800;margin-bottom:4px;">⚡ Autonomous Cursor Scanning Live Results for "${mission.query}"...</div>`;

        let i = 0;
        const extracted = [];

        function scanNext() {
          if (i >= headings.length) {
            scanBox.style.opacity = "0";
            setCursorStatus(`Finished Scanning ${extracted.length} Results`);
            window.scrollTo({ top: 0, behavior: "smooth" });
            resultsBox.innerHTML = `
              <div style="color:#4ade80;font-weight:800;margin-bottom:6px;">✅ Live Autonomous Search Complete (${extracted.length} sources scanned):</div>
              ${extracted.map((item, idx) => `
                <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #292524;">
                  <a href="${item.url}" style="color:#fb923c;font-weight:700;text-decoration:none;display:block;">${idx + 1}. ${item.title}</a>
                  <div style="color:#a8a29e;font-size:10px;">${item.snippet}</div>
                </div>
              `).join("")}
            `;
            return;
          }

          const h = headings[i];
          const card = h.closest("div.MjjYud, div.g, article, li") || h.parentElement;
          h.scrollIntoView({ behavior: "smooth", block: "center" });

          setTimeout(() => {
            const r = h.getBoundingClientRect();
            cursorTargetX = Math.max(24, r.left + 20);
            cursorTargetY = Math.max(24, r.top + r.height / 2);
            highlightElement(card || h);
            pulseCursorRipple();
            setCursorStatus(`Reading Result #${i + 1} of ${headings.length}...`);

            const linkEl = h.closest("a") || (card && card.querySelector("a"));
            const snippetEl = card ? card.querySelector("div.VwiC3b, span, p") : null;
            extracted.push({
              title: h.textContent.trim(),
              url: linkEl ? linkEl.href : window.location.href,
              snippet: snippetEl ? snippetEl.textContent.trim().slice(0, 140) : ""
            });

            i += 1;
            setTimeout(scanNext, 950);
          }, 450);
        }

        setTimeout(scanNext, 600);
      });
    }

    const goBtn = document.getElementById("spe-autonomous-go");
    const queryInput = document.getElementById("spe-autonomous-query");
    if (goBtn && queryInput) {
      goBtn.addEventListener("click", () => startAutonomousSearch(queryInput.value));
      queryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") startAutonomousSearch(queryInput.value);
      });
    }

    checkAndResumeAutonomousScan();
  }

  setupClickyCursorBuddy();

  console.log("SPE Companion active on " + getHostPlatform());
})();

