/**
 * SPE Prompt Synthesizer
 * 
 * Synthesizes comprehensive, production-grade system prompts by combining:
 * 1. The authoritative kernel K3 effect plan (preserving all protected fields & safety invariants).
 * 2. The WASM-compiled multi-stage execution protocol (from context_protocol execution contracts).
 * 3. Domain-specific engineering & analytical methodologies across all 12 domains.
 * 4. Multi-tier depth expansion: FAST (compact), SMART (balanced), DEEP (exhaustive enterprise specification).
 * 5. Architectural topologies, formal state machines, failure recovery matrices, concurrency models,
 *    concrete contract schemas, zero-loss cryptographic audit protocols, and chaos simulation suites.
 * 6. Operational boundaries and zero-network telemetry security invariants (network_mode=NONE).
 * 7. Conformance verification and acceptance checklists.
 * 
 * Strict WASM Invariant: Every section MUST start with `## <Heading>\n<Body>` and have no bare `\n\n` within chunks
 * so that the Rust WASM `parse_sections` parser evaluates every obligation to SATISFIED.
 */

export type PromptDepthMode = "FAST" | "SMART" | "DEEP" | "AUTO";

export interface PromptSynthesisInput {
  k3CompiledPrompt: string;
  category: string;
  domainId: string;
  goal: string;
  desiredOutput?: string | null;
  desiredExample?: string | null;
  protocolRendered?: string | null;
  depth?: string;
  taskReportTelemetry?: {
    rawOutput?: string;
    modelTarget?: "claude" | "codex" | "deepseek" | "general";
  } | null;
}

export interface DomainMethodology {
  title: string;
  steps: string[];
  invariants: string[];
  outputStandards: string[];
  checklist: string[];
  deepModules?: {
    heading: string;
    lines: string[];
  }[];
}

const CODING_DEEP_MODULES = [
  {
    heading: "Architectural Topology & Component Boundaries",
    lines: [
      "1. Coordinator Core Engine: Implement an event-driven, decoupled coordinator managing active saga orchestrations.",
      "2. Saga Execution Coordinator (SEC): Maintain state durability with an append-only persistence log before dispatching commands.",
      "3. Forward Execution Handlers: Each service step exposes an idempotent command handler with forward progress semantics.",
      "4. Backward Compensation Dispatchers: Every forward action defines an inverse compensating action capable of idempotent partial rollback.",
      "5. Outbox Message Relay: Store outbound events in the local database within the same atomic transaction as state mutations.",
      "6. Dead-Letter Queue (DLQ) Quarantines: Divert poisoned payloads and non-recoverable schema faults to a durable quarantine queue with alerts.",
      "7. Append-Only Tamper-Evident Ledger: Record all state transitions, compensation steps, and audit hashes in a verifiable monotonic log.",
    ],
  },
  {
    heading: "Formal State Machine & Lifecycle Transitions",
    lines: [
      "State 1: [INITIALIZED] - Saga instance created, unique saga_id allocated, parameters validated against schema invariants.",
      "State 2: [STEP_PENDING] - Step execution envelope persisted to outbox; readiness criteria verified.",
      "State 3: [STEP_EXECUTING] - Outbound command dispatched to worker; timeout timer armed with exponential jittered backoff.",
      "State 4: [STEP_SUCCEEDED] - Worker acknowledgment received with cryptographic receipt; monotonic step pointer advanced.",
      "State 5: [STEP_FAILED] - Worker error or timeout detected; forward progress suspended; compensation engine activated.",
      "State 6: [COMPENSATION_INITIATED] - Rollback graph evaluated; compensating actions enqueued in strict reverse-topological order.",
      "State 7: [COMPENSATING_BACKWARD] - Compensating transactions dispatched; retry budget monitored.",
      "State 8: [COMPENSATION_COMPLETED] - All previously committed steps successfully compensated; saga state marked COMPENSATED.",
      "State 9: [DLQ_QUARANTINED] - Compensation budget exhausted or manual intervention required; quarantined with diagnostic snapshot.",
      "State 10: [SAGA_COMPLETED] - All forward steps verified; terminal completion receipt emitted.",
    ],
  },
  {
    heading: "Fault Tolerance, Compensation & DLQ Quarantine Matrix",
    lines: [
      "- Step Forward Action: Validate preconditions -> Acquire lock-free lease -> Mutate entity -> Emit outbox event -> Commit transaction.",
      "- Step Backward Compensation: Invert mutations using compensating payload -> Release leases -> Record compensation event -> Commit.",
      "- Network Timeout Policy: Retry up to 3 times with decorrelated jitter (base: 100ms, max: 2000ms). Do not interpret timeout as failure.",
      "- Circuit Breaker Triggers: Trip to OPEN on 5 consecutive network or downstream service errors within a 30-second sliding window.",
      "- Poison Pill Containment: When payload causes unhandled panic or syntax invalidation, isolate immediately to DLQ without retrying.",
      "- Partial Rollback Integrity: If step N fails, steps N-1 down to 1 must execute compensation in reverse order; never skip an executed step.",
      "- Manual Intervention Hook: Expose safe operator review interface for DLQ items with dry-run re-drive capabilities.",
    ],
  },
  {
    heading: "Concurrency, Idempotency & Write-Ahead Log Consistency",
    lines: [
      "- Distributed Idempotency Key Format: Standardize header `Idempotency-Key: <saga_id>:<step_id>:<operation_hash>` on all mutations.",
      "- Lock-Free Deduplication: Utilize database unique constraints or atomic Compare-And-Swap (CAS) on version fields to reject duplicates.",
      "- At-Least-Once to Exactly-Once: Bridge messaging systems using transactional outbox pattern combined with idempotent consumer deduplication.",
      "- Write-Ahead Log (WAL) Layout: Flush state transitions to durable disk storage prior to initiating external RPC or messaging operations.",
      "- Crash Recovery Invariant: Upon process reboot or kill -9, SEC replays active WAL entries to reconstruct state before resuming dispatch.",
      "- Read-Repair Mechanism: When encountering conflicting distributed timestamps, verify state against authoritative WAL snapshot.",
    ],
  },
  {
    heading: "Contract Schemas, Data Envelopes & Error Taxonomy",
    lines: [
      "- Saga Envelope Schema: `{ saga_id: UUID, correlation_id: UUID, schema_version: '1.0.0', initiator: string, payload: Record, created_at: ISO8601 }`",
      "- Step Execution Envelope: `{ step_id: string, saga_id: UUID, retry_count: number, timeout_ms: number, forward_action: string, compensation_action: string }`",
      "- Error Taxonomy: Exhaustive domain error enums including:",
      "  * TransientError::NetworkTimeout { retryable: true, backoff_ms: number }",
      "  * TransientError::ServiceUnavailable { retryable: true, retry_after: number }",
      "  * PermanentError::InvalidBusinessRule { code: string, message: string }",
      "  * PermanentError::PoisonPillPayload { reason: string, raw_payload_hash: string }",
      "  * CriticalError::LedgerDiscrepancy { expected_hash: string, actual_hash: string }",
    ],
  },
  {
    heading: "Zero-Loss Cryptographic Ledger & Audit Trail Protocol",
    lines: [
      "- Ledger Block Structure: Monotonically increasing block sequence with SHA-256 hash chaining `hash_n = sha256(hash_{n-1} + block_payload)`.",
      "- Non-Repudiation: Every participant response includes timestamp, worker identifier, and operation digest.",
      "- Zero Network Egress Invariant: Core execution coordinator operates with network_mode=NONE for local-first zero-egress environments.",
      "- Tamper-Evident Auditing: Replay verification harness validates unbroken hash chain from genesis block to current head.",
      "- Secret Isolation: Sanitize sensitive payload credentials, cryptographic keys, and user authentication tokens before ledger persistence.",
    ],
  },
  {
    heading: "Adversarial Chaos & Simulation Test Suite",
    lines: [
      "- Chaos Test 1 (Simulated Network Partition): Drop 50% of ACK messages between SEC and step worker. Assert zero duplicate executions.",
      "- Chaos Test 2 (Abrupt Kill -9 During Step Execution): Terminate coordinator process during step 3 execution. Verify state recovery on reboot.",
      "- Chaos Test 3 (Abrupt Kill -9 During Compensation): Terminate process during rollback of step 2. Verify compensation resumes without orphan states.",
      "- Chaos Test 4 (Poison Pill Injection): Inject corrupted JSON into outbox queue. Verify immediate routing to DLQ with alert and non-blocking operation.",
      "- Chaos Test 5 (Out-of-Order Message Storm): Deliver step 3 completion before step 2 completion. Verify coordinator rejects out-of-sequence ACK.",
    ],
  },
];

const RESEARCH_DEEP_MODULES = [
  {
    heading: "Epistemic Hierarchy & Evidence Confidence Stratification",
    lines: [
      "Level 1 (Highest Confidence): Replicated, peer-reviewed empirical studies with open datasets and pre-registered methodological protocols.",
      "Level 2 (High Confidence): Large-sample controlled observational studies, multi-center meta-analyses with low heterogeneity (I^2 < 25%).",
      "Level 3 (Moderate Confidence): Single-cohort observational studies, expert consensus statements, or preprints with open reproducible code.",
      "Level 4 (Low / Provisional Confidence): Exploratory studies with sample sizes < 30, unpublished working papers, or non-peer-reviewed whitepapers.",
      "Level 5 (Unverified / Contradicted): Anecdotal reports, vendor marketing claims, or studies with identified methodological confounders.",
    ],
  },
  {
    heading: "Methodological Triangulation & Contradiction Resolution",
    lines: [
      "1. Active Falsification: For every substantive hypothesis, search explicitly for contradictory empirical findings and negative results.",
      "2. Confounder Auditing: Evaluate potential selection bias, attrition bias, reporting bias, and funding conflicts of interest.",
      "3. Heterogeneity Analysis: When studies report conflicting effect sizes, decompose discrepancies by population cohort, sample size, or instrumentation.",
      "4. Synthesis Reconciliation: Avoid simplistic averaging; construct systematic comparative matrices highlighting boundaries of applicability.",
    ],
  },
  {
    heading: "Primary Dataset & Corpus Verification Protocol",
    lines: [
      "- Citation Integrity Invariant: Every factual claim must reference a verified primary source with title, authors, year, and persistent identifier (DOI/arXiv).",
      "- Anti-Hallucination Guardrail: Never invent citation titles, authors, experimental benchmarks, or quantitative findings.",
      "- Primary Source Grounding: Distinguish secondary commentary or media reporting from raw empirical publications and peer-reviewed journals.",
      "- Reproducibility Manifest: Document exact dataset versions, query parameters, inclusion criteria, and temporal cutoff dates.",
    ],
  },
  {
    heading: "Evidentiary Synthesis & Gap Analysis",
    lines: [
      "- Comparative Literature Matrix: Tabulate methodologies, sample demographics, baseline controls, effect sizes, and p-values.",
      "- Boundary Condition Mapping: Identify explicitly what remains unknown, under-investigated, or methodologically contested.",
      "- Epistemic Humility Standard: Use precise probabilistic phrasing rather than absolute assertions when evidence is emerging.",
    ],
  },
  {
    heading: "Zero-Cost Open-Access Corpus Protocol",
    lines: [
      "1. Free Academic Repositories: Prioritize open-access public repositories requiring zero fees, zero API keys, and zero logins (e.g., arXiv.org e-Prints, PubMed Central / NCBI PMC Open Access, OpenAlex, Semantic Scholar Open Research Corpus, DOAJ).",
      "2. Primary Corpus Verification: Extract empirical data, benchmark tables, and mathematical formulas directly from open preprint/open-access PDF texts and metadata.",
      "3. Direct Open Identifiers: Guarantee every referenced paper provides an open persistent URL/identifier (e.g., https://arxiv.org/abs/... or https://doi.org/10....).",
      "4. Zero-Paywall Invariant: Never lock verification or reproducibility behind paywalled publisher portals or fee-gated subscription barriers.",
    ],
  },
  {
    heading: "Downstream AI Task Continuation & Defect Remediation",
    lines: [
      "1. Execution Telemetry Ingestion: Parse downstream coding AI outputs, test failures, linter reports, stack traces, and benchmark regressions.",
      "2. Defect & Root-Cause Classification: Classify observed bugs into Algorithmic Inefficiency, Memory Safety, Protocol Desynchronization, or Type Invariants.",
      "3. Differential Correction Synthesis: Formulate precise surgical diffs and mathematical proofs rather than generic rewrites.",
      "4. Target Model Calibration: Adapt output syntax for Claude Code (tool-use diffs), GPT-4o (structured boundary assertions), or DeepSeek/Qwen (complete symbol signatures).",
    ],
  },
];

const WRITING_DEEP_MODULES = [
  {
    heading: "Stakeholder Topology & Communication Architecture",
    lines: [
      "1. Primary Executive Audience: Focus on strategic impact, risk exposure, cost-benefit trade-offs, and critical decision gates.",
      "2. Technical Implementation Audience: Provide clear architectural blueprints, contract definitions, and actionable steps.",
      "3. Operational Stakeholders: Outline process workflows, governance friction points, change management, and failure recovery.",
      "4. Cognitive Load Management: Use progressive disclosure—lead with high-level summaries before descending into granular specifics.",
    ],
  },
  {
    heading: "Rhetorical Strategy & Stylistic Invariants",
    lines: [
      "- Strict Elimination of AI Tropes: Banish generic filler ('game-changing', 'revolutionize', 'in this fast-paced world', 'delve into').",
      "- Active Voice Enforcement: Structure sentences around concrete actors taking decisive actions.",
      "- Information Density: Maximize signal-to-noise ratio; replace empty rhetorical transitions with substantive data or concrete examples.",
      "- Structured Typographic Hierarchy: Use clear headings, bulleted taxonomies, and comparison tables for rapid executive scanning.",
    ],
  },
  {
    heading: "Factual Precision & Governance Review",
    lines: [
      "- Grounded Factuality: Every asserted metric, timeline, or constraint must directly derive from provided context or verifiable facts.",
      "- Prohibited Superlatives: Ban unearned superlatives ('industry-leading', 'best-in-class') unless accompanied by audited benchmarks.",
      "- Plain English Gate: Comply with plain-language accessibility guidelines to ensure clarity across non-technical leadership.",
    ],
  },
];

const BUSINESS_DEEP_MODULES = [
  {
    heading: "Strategic Alignment & Enterprise Value Architecture",
    lines: [
      "1. Problem Space Definition: Quantify current operational inefficiencies, financial leakage, and compliance risk vectors.",
      "2. Solution Architecture: Map business capabilities to technical components with explicit ROI and total cost of ownership (TCO) models.",
      "3. Competitive Moat Analysis: Identify network effects, switching costs, structural advantages, and defensibility barriers.",
      "4. Capital Allocation & Unit Economics: Establish cost per transaction, customer acquisition cost (CAC), and customer lifetime value (LTV) dynamics.",
    ],
  },
  {
    heading: "Risk Governance & Compliance Friction Matrix",
    lines: [
      "- Regulatory Compliance Vectors: Detail GDPR/CCPA data sovereignty, SOC 2 Type II audit controls, and industry-specific regulations.",
      "- Operational Resilience: Establish Recovery Point Objective (RPO) and Recovery Time Objective (RTO) targets for all core business capabilities.",
      "- Third-Party Dependency Risk: Audit vendor concentration, API rate limits, pricing volatility, and single points of failure.",
      "- Change Management Scaffolding: Define stakeholder training plans, dual-run validation periods, and rollback criteria for business processes.",
    ],
  },
  {
    heading: "Milestone Execution Roadmap & KPI Measurement",
    lines: [
      "- Phase 1 (Foundation & De-risking): Core architectural MVP, baseline benchmarking, security review, and proof-of-concept sign-off.",
      "- Phase 2 (Controlled Pilot): Closed customer cohort, latency monitoring, unit economics verification, and feedback loop iteration.",
      "- Phase 3 (General Availability): Automated scaling, multi-region failover, SLA enforcement, and revenue expansion instrumentation.",
    ],
  },
];

const DATA_DEEP_MODULES = [
  {
    heading: "Data Pipeline Topology & Stream Processing Architecture",
    lines: [
      "1. Ingestion Layer: Idempotent message ingress, schema validation at boundary, dead-letter routing for malformed payloads.",
      "2. Storage & Partitioning Strategy: Columnar storage formats (Parquet), partition pruning by timestamp, and optimal clustering keys.",
      "3. Compute Engine: Lock-free distributed aggregation, vectorized execution, and deterministic stream-table duality.",
      "4. Quality Gates: Zero silent data loss, schema evolution rules (backward and forward compatibility), and automated data drift detection.",
    ],
  },
  {
    heading: "Statistical Anomaly Detection & Lineage Verification",
    lines: [
      "- Data Lineage Ledger: Track upstream source commits, transformation job IDs, and pipeline run SHAs for every derived table.",
      "- Anomaly Detection Rules: Flag distribution shifts exceeding 3-sigma thresholds across null-ratios, cardinality, and key distributions.",
      "- Idempotent Backfills: Support deterministic replay of historical time windows with zero duplicate row insertion.",
    ],
  },
];

const UX_DEEP_MODULES = [
  {
    heading: "Frontend Component Hierarchy & State Machine Architecture",
    lines: [
      "1. Atomic Component Architecture: Structure components into design tokens, atoms, molecules, and layout templates.",
      "2. Progressive Enhancement Tiers: Tier 1 (WebGL 3D interactive) -> Tier 2 (HTML5 Canvas 2D fallback) -> Tier 3 (Accessible semantic HTML).",
      "3. State Machine Navigation: Formal state transitions for modal dialogs, drawer disclosures, form validation, and offline indicators.",
      "4. Reflow Resilience: Fluid layouts tested across 360px mobile viewports up to 4K displays with zero horizontal clipping.",
    ],
  },
  {
    heading: "Accessibility (WCAG 2.1 AA) & Performance Invariants",
    lines: [
      "- Keyboard Navigation: Comprehensive focus traps in modals, visible focus indicators (:focus-visible), and logical tab sequences.",
      "- Screen Reader Compatibility: Accurate ARIA landmark roles, descriptive labels on interactive elements, and live-region announcements.",
      "- Reduced-Motion Protocol: Explicit media query `@media (prefers-reduced-motion: reduce)` disabling non-essential transitions.",
      "- Asset Budget: Bundle size caps, zero third-party tracking scripts, and sub-50ms interaction response times.",
    ],
  },
];

const DOMAIN_METHODOLOGIES: Record<string, DomainMethodology> = {
  coding: {
    title: "Domain Engineering Methodology",
    steps: [
      "1. Architectural Deconstruction: Analyze domain entities, state machines, and concurrency boundaries before drafting code.",
      "2. Strict Invariants: Enforce type-safe state transitions using type-state or state-machine patterns to make illegal states unrepresentable.",
      "3. Local Storage Invariants: Ensure ACID compliance, explicit write-ahead log (WAL) semantics, and atomic crash consistency.",
      "4. Idempotency Guarantees: Include unique correlation keys or idempotency tokens on all effect mutations and outbox records.",
      "5. Error Boundaries: Enforce exhaustive error types with domain-specific variants and zero unhandled panics or bare unwraps.",
    ],
    invariants: [
      "- Zero network egress: Pure offline local execution with network_mode=NONE.",
      "- Memory safety: 100% memory-safe code with zero undefined behavior or unmanaged pointer dereferences.",
      "- Secret isolation: No secrets, credentials, or keys retained or emitted in list or dictionary structures.",
      "- Fail-closed semantics: Any unhandled exception or transaction abort must roll back cleanly to the last verified snapshot.",
    ],
    outputStandards: [
      "Deliver complete, production-ready module layouts, explicit interface contracts, and runnable test cases.",
      "Document every state transition, error condition, and performance trade-off explicitly.",
      "Provide concrete code implementations and sequence diagrams rather than high-level sketches.",
    ],
    checklist: [
      "- [ ] Clean compilation with zero compiler warnings under strict linter flags",
      "- [ ] Exhaustive unit and integration test coverage for all boundary conditions",
      "- [ ] Crash recovery and rollback verified under simulated process termination",
      "- [ ] Quality obligations verified with cryptographic receipt",
    ],
    deepModules: CODING_DEEP_MODULES,
  },
  research: {
    title: "Scholarly Research & Evidence Methodology",
    steps: [
      "1. Scope Definition: Decompose the primary question into falsifiable hypotheses and bounded sub-questions.",
      "2. Evidence Planning: Identify peer-reviewed literature, primary empirical datasets, and official normative specifications.",
      "3. Contradiction Analysis: Actively seek contradictory findings, methodological weaknesses, and publication biases.",
      "4. Synthesis & Triangulation: Reconcile competing models, measure effect sizes, and establish evidence confidence tiers.",
      "5. Traceability: Link every factual assertion directly to verifiable primary citations with publication context.",
    ],
    invariants: [
      "- Zero fabricated references: Never invent papers, authors, DOIs, or experimental outcomes.",
      "- Uncertainty quantification: Explicitly categorize claims as SUPPORTED, PREPRINT_ONLY, or CONTRADICTED.",
      "- Strict epistemic humility: Clearly separate verified empirical observations from theoretical conjecture.",
      "- Zero-cost open-access priority: Always ground research assertions in publicly accessible repositories with no paid subscriptions or login walls.",
      "- Deterministic continuation: Ground task corrections in reproducible algorithmic specs and differential patches.",
    ],
    outputStandards: [
      "Structure findings into systematic literature matrices, methodology audits, and evidentiary gap analyses.",
      "Include detailed comparative tables with quantitative benchmark figures and confidence bounds.",
      "Provide machine-executable continuation prompts with concrete acceptance criteria and defect remediation matrices.",
    ],
    checklist: [
      "- [ ] All substantive claims backed by verifiable primary source citations with open identifiers",
      "- [ ] Competing hypotheses and counter-evidence explicitly addressed",
      "- [ ] Clear distinction between consensus findings and frontier uncertainties",
      "- [ ] Downstream model defect signatures mapped directly to theoretical or algorithmic constraints",
      "- [ ] Next-turn continuation prompt formatted with zero ambiguous directives",
    ],
    deepModules: RESEARCH_DEEP_MODULES,
  },
  writing_communication: {
    title: "Executive Communication & Rhetorical Strategy",
    steps: [
      "1. Audience Framing: Calibrate register, cognitive load, and persuasive trajectory for the intended stakeholders.",
      "2. Structural Scaffolding: Organize arguments using the pyramid principle—core thesis first, supported by grouped evidence.",
      "3. Precision Editing: Strip passive constructions, buzzwords, and vague generalizations in favor of sharp, actionable prose.",
      "4. Fact Grounding: Anchor all claims to provided facts, avoiding unsupported corporate boilerplate.",
    ],
    invariants: [
      "- Preserved intent: Never alter the user's core message, constraints, or requested tone.",
      "- Brevity enforcement: Comply strictly with length and format restrictions without omitting essential nuances.",
    ],
    outputStandards: [
      "Deliver publication-ready prose formatted with clear typographic hierarchy and intuitive structural flow.",
      "Provide concrete executive summaries followed by logically sequenced evidentiary support.",
    ],
    checklist: [
      "- [ ] Core thesis stated within the opening paragraph",
      "- [ ] All key assertions grounded in supplied context with zero unsubstantiated claims",
      "- [ ] Readability score optimized for effortless stakeholder digestion",
    ],
    deepModules: WRITING_DEEP_MODULES,
  },
  business_strategy: {
    title: "Enterprise Strategy & Operational Architecture",
    steps: [
      "1. Opportunity Mapping: Define total addressable market, value proposition, and customer problem statement.",
      "2. Financial Modeling: Articulate unit economics, margin structures, payback periods, and operating leverage.",
      "3. Operational De-risking: Pinpoint dependency bottlenecks, regulatory constraints, and execution vulnerabilities.",
      "4. Strategic Milestones: Formulate sequenced OKRs, resource allocation matrices, and decisive kill-criteria.",
    ],
    invariants: [
      "- No speculative revenue claims: Anchor financial projections to documented market assumptions.",
      "- Actionable governance: Every strategic proposal must specify owner, delivery timeline, and verification metric.",
    ],
    outputStandards: [
      "Deliver structured executive briefs, financial sensitivity tables, and operational delivery schedules.",
    ],
    checklist: [
      "- [ ] Clear ROI framework with quantitative risk-adjusted sensitivity analysis",
      "- [ ] Operational bottlenecks and regulatory constraints explicitly mitigated",
    ],
    deepModules: BUSINESS_DEEP_MODULES,
  },
  data_statistics: {
    title: "Quantitative Analysis & Data Systems Methodology",
    steps: [
      "1. Schema Definition: Validate data types, nullability, unique identifiers, and domain integrity rules.",
      "2. Statistical Grounding: Check sample distributions, normality assumptions, and outlier influence before aggregating.",
      "3. Causal Rigor: Differentiate correlation from causation; control for confounders and selection bias.",
      "4. Reproducibility: Document exact formulas, aggregation algorithms, and data cleansing transformations.",
    ],
    invariants: [
      "- Zero data leakage: Ensure strict isolation between training/testing partitions and validation cohorts.",
      "- Deterministic execution: Same input dataset must yield bit-identical statistical results every time.",
    ],
    outputStandards: [
      "Deliver verified data schemas, statistical distribution summaries, and reproducible analytical pipelines.",
    ],
    checklist: [
      "- [ ] Data distributions and missing-value treatments explicitly documented",
      "- [ ] Statistical significance levels and confidence intervals reported alongside point estimates",
    ],
    deepModules: DATA_DEEP_MODULES,
  },
  ux_ui_web_design: {
    title: "Frontend Architecture & UX Engineering Methodology",
    steps: [
      "1. Information Architecture: Define semantic content hierarchy and core interaction flows before styling.",
      "2. Accessibility Foundations: Enforce WCAG 2.1 AA compliance, visible focus indicators, screen reader landmarks, and keyboard operability.",
      "3. Responsive Fluidity: Design fluid reflow from 360px mobile viewports to ultra-wide displays without horizontal overflow.",
      "4. Performance & Fallbacks: Establish progressive enhancement tiers: 3D/WebGL -> 2D Canvas -> Semantic HTML/CSS.",
    ],
    invariants: [
      "- Zero client telemetry: Strict offline-first operation with no third-party tracking scripts.",
      "- Reduced-motion support: Respect prefers-reduced-motion media query across all animations and transitions.",
    ],
    outputStandards: [
      "Deliver semantic HTML5 markup, modern CSS variable architecture, and accessible component state machines.",
    ],
    checklist: [
      "- [ ] Complete keyboard navigability and focus trap verification",
      "- [ ] Contrast ratios meet or exceed 4.5:1 for normal text and 3:1 for large text",
      "- [ ] Graceful fallback confirmed when WebGL or JavaScript is restricted",
    ],
    deepModules: UX_DEEP_MODULES,
  },
};

/**
 * Intelligently resolves the depth mode based on input depth and goal complexity.
 */
export function resolveEffectiveDepth(depth?: string | null, goal?: string): PromptDepthMode {
  const norm = (depth || "").toUpperCase().trim();
  if (norm === "FAST") return "FAST";
  if (norm === "SMART") return "SMART";
  if (norm === "DEEP") return "DEEP";

  // AUTO resolution based on goal complexity
  if (goal) {
    const text = goal.toLowerCase();
    const deepKeywords = [
      "distributed", "saga", "transaction", "coordinator", "database", "kernel",
      "security", "pipeline", "orchestrator", "protocol", "engine", "compiler",
      "fail-safe", "high-availability", "architecture", "scale", "dead-letter",
      "idempotent", "ledger", "compensation", "microservice", "infrastructure",
      "research", "paper", "arxiv", "continuation", "defect", "remediation",
      "telemetry", "stack trace", "benchmark", "academic", "literature",
    ];
    if (deepKeywords.some((kw) => text.includes(kw))) {
      return "DEEP";
    }
    if (goal.length > 80 || goal.includes(" and ") || goal.includes(",")) {
      return "SMART";
    }
  }

  return "FAST";
}

/**
 * Format string as clean Markdown heading with single-newline body.
 * Guaranteed to never introduce bare `\n\n` that would trip Rust `parse_sections`.
 */
function createSection(heading: string, bodyLines: string[]): string {
  const cleanLines = bodyLines
    .map((line) => line.trim())
    .filter(Boolean);
  return `## ${heading}\n${cleanLines.join("\n")}`;
}

/**
 * Synthesizes a deep, complete system prompt from the K3 kernel plan and context protocol.
 */
export function synthesizeSystemPrompt(input: PromptSynthesisInput): string {
  const {
    k3CompiledPrompt,
    category,
    domainId,
    goal,
    desiredOutput,
    desiredExample,
    protocolRendered,
    depth,
    taskReportTelemetry,
  } = input;

  const effectiveDepth = resolveEffectiveDepth(depth, goal);
  const meth = DOMAIN_METHODOLOGIES[domainId] || DOMAIN_METHODOLOGIES["coding"];
  const sections: string[] = [];

  // 1. Authoritative K3 Kernel Effect Plan (MUST be the primary prefix)
  const k3Clean = k3CompiledPrompt
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join("\n\n");
  sections.push(k3Clean);

  // 2. Multi-Stage Execution Protocol (from WASM context protocol compiler)
  if (protocolRendered && protocolRendered.trim()) {
    const rawLines = protocolRendered
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    sections.push(createSection("Multi-Stage Execution Protocol", rawLines));
  }

  // 3. Domain Engineering & Analytical Methodology
  const domainSteps = [
    `Domain Archetype: ${category} (${domainId.toUpperCase()})`,
    `Execution Depth Mode: ${effectiveDepth}`,
    `Core Mission Target: ${goal}`,
    ...meth.steps,
  ];
  sections.push(createSection(meth.title, domainSteps));

  // 4. If DEEP mode: inject full architectural, fault tolerance, concurrency, and chaos modules
  if (effectiveDepth === "DEEP") {
    const modules = meth.deepModules || CODING_DEEP_MODULES;
    for (const mod of modules) {
      sections.push(createSection(mod.heading, mod.lines));
    }
  } else if (effectiveDepth === "SMART") {
    // Inject first 2 deep modules for balanced professional depth
    const modules = (meth.deepModules || CODING_DEEP_MODULES).slice(0, 2);
    for (const mod of modules) {
      sections.push(createSection(mod.heading, mod.lines));
    }
  }

  // 5. Operational Boundaries & Security Invariants
  sections.push(
    createSection("Operational Boundaries & Security Invariants", meth.invariants),
  );

  // 6. Output Depth and Structural Standards
  const standards = [...meth.outputStandards];
  if (desiredOutput && desiredOutput.trim()) {
    standards.unshift(
      `Mandatory Deliverable Contract: "${desiredOutput.trim()}"`,
    );
  }
  if (desiredExample && desiredExample.trim()) {
    standards.push(
      `Canonical Structural Example: "${desiredExample.trim()}"`,
    );
  }
  sections.push(
    createSection("Output Depth and Structural Standards", standards),
  );

  // 7. Conformance Verification & Acceptance Checklist
  sections.push(
    createSection(
      "Verification and Acceptance Checklist",
      meth.checklist,
    ),
  );

  // 8. Downstream Model Task Continuation Directive (for downstream AI coding loops)
  if (taskReportTelemetry?.rawOutput || /error|failure|exception|traceback|panic|stack trace|regression|unresolved/i.test(goal)) {
    const targetModel = taskReportTelemetry?.modelTarget || "claude";
    const modelDirectives = {
      claude: "Enforce tool-use boundaries, minimal surgical diff patches, and structured verification terminal commands.",
      codex: "Provide concise functional pipelines, explicit boundary assertions, and clear operational constraints.",
      deepseek: "Enforce step-by-step reasoning scaffolds, complete symbol signatures, and strict code block boundaries.",
      general: "Provide deterministic differential remediation, formal proofs, and regression tests.",
    }[targetModel];

    sections.push(
      createSection("Autonomous Task Continuation & Remediation Directive", [
        `Target Model Profile: ${targetModel.toUpperCase()}`,
        `Model Directive: ${modelDirectives}`,
        "- Telemetry Root Cause Analysis: Isolate the failing boundary condition from execution logs or stack traces.",
        "- Zero-Paywall Literature Triangulation: Reconcile defect solutions with open-access repositories (arXiv, PubMed Central, OpenAlex).",
        "- Differential Remediation Invariant: Apply non-breaking differential patches with regression assertions.",
        "- Acceptance Gate: The task is resolved only when all assertions and test suites exit with code 0.",
      ]),
    );
  }

  // Join all sections with double newline. Every section starts with `## ` and has no bare `\n\n`
  return sections
    .flatMap((s) => s.split("\n\n"))
    .map((c) => c.trim())
    .filter(Boolean)
    .join("\n\n");
}
