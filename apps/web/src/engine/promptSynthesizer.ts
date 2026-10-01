/**
 * SPE Prompt Synthesizer
 * 
 * Synthesizes comprehensive, production-grade system prompts by combining:
 * 1. The authoritative kernel K3 effect plan (preserving all protected fields & safety invariants).
 * 2. The WASM-compiled multi-stage execution protocol (from context_protocol execution contracts).
 * 3. Domain-specific engineering & analytical methodologies.
 * 4. Operational boundaries and zero-network telemetry security invariants.
 * 5. Concrete deliverable schemas and output specifications.
 * 6. Conformance verification and acceptance checklists.
 * 
 * Invariant: Every section must start with `## <Heading>\n<Body>` and have no bare `\n\n` within chunks
 * so that the Rust WASM `parse_sections` parser evaluates every obligation to SATISFIED.
 */

export interface PromptSynthesisInput {
  k3CompiledPrompt: string;
  category: string;
  domainId: string;
  goal: string;
  desiredOutput?: string | null;
  desiredExample?: string | null;
  protocolRendered?: string | null;
  depth?: string;
}

export interface DomainMethodology {
  title: string;
  steps: string[];
  invariants: string[];
  outputStandards: string[];
  checklist: string[];
}

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
    ],
    outputStandards: [
      "Structure findings into systematic literature matrices, methodology audits, and evidentiary gap analyses.",
      "Include detailed comparative tables with quantitative benchmark figures and confidence bounds.",
    ],
    checklist: [
      "- [ ] All substantive claims backed by verifiable primary source citations",
      "- [ ] Competing hypotheses and counter-evidence explicitly addressed",
      "- [ ] Clear distinction between consensus findings and frontier uncertainties",
    ],
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
      "Include executive summaries and actionable takeaways where appropriate.",
    ],
    checklist: [
      "- [ ] Tone and terminology aligned with the target audience",
      "- [ ] Every core requirement addressed without filler or generic advice",
      "- [ ] Logical coherence verified across all transitional paragraphs",
    ],
  },
  business_strategy: {
    title: "Strategic Business Architecture Methodology",
    steps: [
      "1. Market & Ecosystem Mapping: Map value chains, unit economics, regulatory landscape, and competitive moats.",
      "2. Constraint-Based Prioritization: Sequence strategic initiatives by return on investment, time-to-value, and capital constraints.",
      "3. Risk & Sensitivity Modeling: Stress-test assumptions against demand shifts, execution delays, and cost volatility.",
      "4. Operational Governance: Define measurable KPIs, ownership structures, and milestone gates.",
    ],
    invariants: [
      "- Realistic assumptions: Base financial and operational projections strictly on provided constraints and market fundamentals.",
      "- Trade-off transparency: Explicitly document what will NOT be done to maintain operational focus.",
    ],
    outputStandards: [
      "Deliver actionable roadmaps, phased financial projections, and decision matrix scorecards.",
    ],
    checklist: [
      "- [ ] Operational plan feasible within stated budget and timeline constraints",
      "- [ ] Clear ownership, dependencies, and exit criteria established for each initiative",
      "- [ ] Downside risk mitigations documented",
    ],
  },
  data_statistics: {
    title: "Quantitative Analysis & Data Methodology",
    steps: [
      "1. Data Integrity Audit: Inspect missing values, outliers, sampling bias, and distribution properties.",
      "2. Statistical Modeling: Select appropriate parametric or non-parametric tests suited to the data scale and assumptions.",
      "3. Sensitivity Analysis: Test stability across alternative parameterizations and bootstrap resamples.",
      "4. Causal Distinction: Rigorously distinguish observational correlation from causal mechanisms.",
    ],
    invariants: [
      "- Zero hallucinated metrics: Report only numbers derived mathematically from verified data inputs.",
      "- Full methodology disclosure: Document formulas, degrees of freedom, p-values, and confidence intervals.",
    ],
    outputStandards: [
      "Provide reproducible calculation summaries, distribution statistics, and data dictionary definitions.",
    ],
    checklist: [
      "- [ ] Calculations, units, and denominators cross-checked against source data",
      "- [ ] Limitations, assumptions, and potential confounders explicitly labeled",
    ],
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
  },
};

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
    protocolRendered,
  } = input;

  const meth = DOMAIN_METHODOLOGIES[domainId] || DOMAIN_METHODOLOGIES["coding"];
  const sections: string[] = [];

  // 1. Authoritative K3 Kernel Effect Plan (MUST be the primary prefix)
  // Ensure the K3 prompt chunks are cleanly separated
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
    `Core Mission Target: ${goal}`,
    ...meth.steps,
  ];
  sections.push(createSection(meth.title, domainSteps));

  // 4. Operational Boundaries & Security Invariants
  sections.push(
    createSection("Operational Boundaries & Security Invariants", meth.invariants),
  );

  // 5. Output Depth and Structural Standards
  const standards = [...meth.outputStandards];
  if (desiredOutput && desiredOutput.trim()) {
    standards.unshift(
      `Mandatory Deliverable Contract: "${desiredOutput.trim()}"`,
    );
  }
  sections.push(
    createSection("Output Depth and Structural Standards", standards),
  );

  // 6. Conformance Verification & Acceptance Checklist
  sections.push(
    createSection(
      "Verification and Acceptance Checklist",
      meth.checklist,
    ),
  );

  // Join all sections with double newline. Every section starts with `## ` and has no bare `\n\n`
  return sections
    .flatMap((s) => s.split("\n\n"))
    .map((c) => c.trim())
    .filter(Boolean)
    .join("\n\n");
}
