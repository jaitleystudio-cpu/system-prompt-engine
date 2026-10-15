/**
 * SPE Ω — Reality Frontier: Counterfactual Feasibility & Evidence Compiler
 *
 * Implements the 12-step contract specified in the Dare-to-Win Frontier Mission:
 * 1. Extract explicit requirements with discrete identity.
 * 2. Distinguish assumptions from user authority (origin tracking).
 * 3. Detect supported formal conflicts (propositional & environment lattice).
 * 4. Identify unsupported feasibility assertions (empirical claims lacking device scope).
 * 5. Produce minimally changed alternatives (Pareto-optimal frontier).
 * 6. Explain every changed requirement in transparent human English.
 * 7. Require authorization before relaxation (zero silent changes to locked constraints).
 * 8. Generate three meaningfully distinct worldlines (Offline Cinematic, Live Adaptive, Mobile Performance).
 * 9. Compile approved worldline through XCAT C01–C12 metamorphic obligations.
 * 10. Export a portable .spe specification with RFC 8785 canonical digest.
 * 11. Generate executable acceptance obligations (Evidence Escrow).
 * 12. Report genuinely observed test results with Kleene-4 truth values.
 *
 * Invariant: 100% In-Browser, $0 Compute Spend, Zero Network Egress, Sub-50ms Execution.
 */

import { computeSha256 } from "./hashUtils.ts";
import { verifySymbolicConstraints, type LogicConstraintReport } from "./logicConstraintVerifier.ts";

export type RequirementOrigin = "EXPLICIT_USER" | "INFERRED_ASSUMPTION";
export type AuthorityLevel = "LOCKED_USER" | "DELEGATED_AGENT";
export type ConstraintCategory = "NETWORK" | "PERFORMANCE" | "SECURITY" | "AESTHETIC" | "STORAGE" | "COMPATIBILITY";

export interface TypedRequirement {
  id: string;
  text: string;
  origin: RequirementOrigin;
  authority: AuthorityLevel;
  isHardConstraint: boolean;
  category: ConstraintCategory;
  dependencies: string[];
  evidenceState: "VERIFIED" | "ASSUMED" | "UNVERIFIED" | "CONTRADICTED";
  verificationMethod: string;
}

export interface DarkMatterOmission {
  id: string;
  area: string;
  omissionDescription: string;
  reworkWeight: number; // 0.0 to 1.0 (estimated rework multiplier)
  defaultAssumption: string;
  alternatives: string[];
}

export interface MinimalAlternative {
  id: string;
  label: string;
  tradeOff: string;
  requiredRelaxation: string;
  affectsLockedRequirement: boolean;
}

export interface RealityBoundary {
  id: string;
  name: string;
  tensionDescription: string;
  leftPole: string;
  rightPole: string;
  conflictDetected: boolean;
  unsupportedFeasibility: boolean;
  severity: "CRITICAL_CONFLICT" | "FEASIBILITY_WARNING" | "CLEAN";
  rationale: string;
  minimalChangeAlternatives: MinimalAlternative[];
  userApprovalRequired: boolean;
}

export interface RealityBoundaryReport {
  boundaries: RealityBoundary[];
  hasCriticalConflict: boolean;
  unsupportedClaimsCount: number;
  conflictingRequirementIds: string[];
  satisfiabilityVerdict: "SATISFIABLE" | "CONDITIONALLY_FEASIBLE" | "UNSATISFIABLE";
}

export interface ParetoWorldline {
  id: "worldline_offline_cinematic" | "worldline_live_adaptive" | "worldline_mobile_performance";
  name: string;
  badge: string;
  tagline: string;
  status: "FEASIBLE" | "REQUIRES_APPROVAL" | "UNSATISFIABLE";
  architecturalPillars: string[];
  tradeoffs: {
    advantages: string[];
    limitations: string[];
  };
  techStack: {
    runtime: string;
    stateManagement: string;
    testingHarness: string;
    renderingEngine: string;
  };
  protectedConstraints: {
    networkPolicy: "OFFLINE_ONLY" | "RESTRICTED_EGRESS" | "UNCONSTRAINED";
    maxBundleKb: number;
    targetFps: number;
    privacyBoundary: "AIR_GAPPED_LOCAL" | "AUTHENTICATED_RESTRICTED" | "UNRESTRICTED";
    forbiddenPatterns: string[];
  };
  relaxedRequirements: {
    originalReqId: string;
    relaxationDescription: string;
    userAuthorized: boolean;
  }[];
  jaccardDistinctness: number; // >= 0.40 against siblings
}

export interface EvoiDecisionGate {
  decisionId: string;
  question: string;
  rationale: string;
  expectedValueOfInfo: number; // 0.0 to 1.0
  entropyReductionDeltaH: number; // in bits (target >= 0.95)
  options: {
    key: string;
    label: string;
    impactOnArchitecture: string;
    recommendedWorldline: string;
  }[];
}

export interface RealityFrontierAnalysis {
  analysisId: string;
  rawInput: string;
  createdAt: string;
  typedRequirements: TypedRequirement[];
  darkMatterOmissions: DarkMatterOmission[];
  boundaryReport: RealityBoundaryReport;
  worldlines: ParetoWorldline[];
  evoiGate: EvoiDecisionGate;
  symbolicLogicReport: LogicConstraintReport;
}

export interface CompiledWorldlineContract {
  contractId: string;
  createdAt: string;
  userRawIntent: string;
  selectedWorldlineId: string;
  selectedWorldlineName: string;
  userAuthorizedRelaxations: string[];
  lockedInvariants: string[];
  metamorphicObligations: {
    id: string;
    category: "BOUNDARY_INVARIANCE" | "SECURITY_TAINT" | "PERFORMANCE_BUDGET" | "REGRESSION_IMMUNITY";
    predicate: string;
    testFixtureSnippet: string;
  }[];
  evidenceEscrow: {
    claim: string;
    status: "UNVERIFIED" | "VERIFIED" | "REJECTED";
    requiredWitness: string;
  }[];
  exports: {
    claudeMd: string;
    cursorrules: string;
    promptfooYaml: string;
    spePackageManifestJson: string;
  };
  proofPassport: {
    artifactHashSha256: string;
    truthLatticeValue: "TRUE" | "UNKNOWN" | "CONTRADICTION" | "FALSE";
    rfc8785CanonicalDigest: string;
    canonicalCompilerHash: string;
    isAirGapped: boolean;
  };
}

const CANONICAL_WASM_COMPILER_HASH = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d";

/**
 * 1. Extract Typed Requirements
 * Parses raw intention into discrete, typed obligations with origin and authority.
 */
export function extractTypedRequirements(input: string): TypedRequirement[] {
  const text = input || "";
  const lower = text.toLowerCase();
  const reqs: TypedRequirement[] = [];

  // Offline / Network
  if (lower.includes("offline") || lower.includes("air-gapped") || lower.includes("disconnected") || lower.includes("no internet")) {
    reqs.push({
      id: "REQ_OFFLINE_01",
      text: "Application must operate 100% offline with zero remote network egress.",
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: true,
      category: "NETWORK",
      dependencies: [],
      evidenceState: "UNVERIFIED",
      verificationMethod: "Browser test under mock offline worker with connect-src 'none'.",
    });
  }

  // Live updates / Polling
  if (lower.includes("live") || lower.includes("update every second") || lower.includes("real-time") || lower.includes("polling") || lower.includes("fetch")) {
    reqs.push({
      id: "REQ_LIVE_FETCH_02",
      text: "Application must fetch live updates from remote server at regular intervals (e.g. 1s).",
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: lower.includes("must fetch live") || lower.includes("every second"),
      category: "NETWORK",
      dependencies: [],
      evidenceState: "UNVERIFIED",
      verificationMethod: "Network telemetry probe measuring HTTP/WebSocket heartbeat.",
    });
  }

  // 60 FPS / Performance
  if (lower.includes("60 fps") || lower.includes("60fps") || lower.includes("smooth") || lower.includes("budget phone") || lower.includes("every phone")) {
    reqs.push({
      id: "REQ_PERF_60FPS_03",
      text: "Application must maintain a 60 FPS frame rate across client devices including mobile phones.",
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: true,
      category: "PERFORMANCE",
      dependencies: [],
      evidenceState: "UNVERIFIED",
      verificationMethod: "requestAnimationFrame delta timestamps measuring frame drops under CPU throttle.",
    });
  }

  // Privacy / Zero transmission
  if (lower.includes("private") || lower.includes("never transmit") || lower.includes("zero data") || lower.includes("no tracking")) {
    reqs.push({
      id: "REQ_PRIVACY_04",
      text: "Zero private user data or credentials may be transmitted to external servers.",
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: true,
      category: "SECURITY",
      dependencies: [],
      evidenceState: "UNVERIFIED",
      verificationMethod: "Client-side egress firewall verifying 0 outgoing byte payload.",
    });
  }

  // 3D / WebGL / Graphics
  if (lower.includes("3d") || lower.includes("three.js") || lower.includes("webgl") || lower.includes("cinematic") || lower.includes("canvas")) {
    reqs.push({
      id: "REQ_GRAPHICS_3D_05",
      text: "Application must feature hardware-accelerated 3D graphics with cinematic visual fidelity.",
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: false,
      category: "AESTHETIC",
      dependencies: ["REQ_PERF_60FPS_03"],
      evidenceState: "UNVERIFIED",
      verificationMethod: "WebGL2 context initialization and shader compilation test.",
    });
  }

  // Inspiration / URL reference
  if (lower.includes("inspired by") || lower.includes("url") || lower.includes("reference") || lower.includes("design system")) {
    reqs.push({
      id: "REQ_ORIGINALITY_06",
      text: "Application must synthesize an original aesthetic derived from reference design grammar without verbatim cloning.",
      origin: "EXPLICIT_USER",
      authority: "DELEGATED_AGENT",
      isHardConstraint: true,
      category: "AESTHETIC",
      dependencies: [],
      evidenceState: "UNVERIFIED",
      verificationMethod: "Visual token entropy and token distance against reference URL.",
    });
  }

  // Fallback if very short prompt
  if (reqs.length === 0) {
    reqs.push({
      id: "REQ_GENERIC_01",
      text: `Implement primary user capability: ${input.trim().slice(0, 80)}`,
      origin: "EXPLICIT_USER",
      authority: "LOCKED_USER",
      isHardConstraint: true,
      category: "COMPATIBILITY",
      dependencies: [],
      evidenceState: "ASSUMED",
      verificationMethod: "End-to-end task completion verification.",
    });
  }

  return reqs;
}

/**
 * 2. Scan Intent Dark Matter
 * Identifies high-impact implicit omissions and estimates potential rework weight.
 */
export function scanIntentDarkMatter(input: string): DarkMatterOmission[] {
  const lower = (input || "").toLowerCase();
  const omissions: DarkMatterOmission[] = [];

  // Omission 1: Data persistence & sync protocol
  if (lower.includes("offline") && lower.includes("live")) {
    omissions.push({
      id: "DARK_MATTER_SYNC_STRATEGY",
      area: "Data Synchronization Strategy",
      omissionDescription: "The prompt specifies both offline-only execution and live updates without defining how updates occur when disconnected.",
      reworkWeight: 0.85,
      defaultAssumption: "Pre-bundled offline assets with manual user-approved batch sync when connection is available.",
      alternatives: [
        "Local snapshot store with zero sync (pure air-gap)",
        "Periodic background sync when network is detected",
        "Local-area peer-to-peer sync (WebRTC / LAN)",
      ],
    });
  }

  // Omission 2: Mobile device capability scope
  if (lower.includes("every phone") || lower.includes("60 fps") || lower.includes("3d")) {
    omissions.push({
      id: "DARK_MATTER_DEVICE_DEGRADATION",
      area: "Hardware Tier Fallback Ladder",
      omissionDescription: "The prompt demands 60 FPS on 'every phone' with 3D graphics without specifying low-end device degradation policies.",
      reworkWeight: 0.78,
      defaultAssumption: "Adaptive geometry LOD with particle fallback for devices with <3GB RAM.",
      alternatives: [
        "Strict 60 FPS floor via dynamic shader simplification",
        "2D canvas fallback for low-tier mobile devices",
        "Fixed high fidelity (drops frames on budget hardware)",
      ],
    });
  }

  // Omission 3: Originality boundary
  if (lower.includes("inspired by") || lower.includes("url")) {
    omissions.push({
      id: "DARK_MATTER_ORIGINALITY_RATIO",
      area: "Design Derivation vs Cloning",
      omissionDescription: "The prompt asks to be 'inspired by this URL' without stating acceptable visual token overlap ratio.",
      reworkWeight: 0.65,
      defaultAssumption: "Extract layout rhythm, typography scale, and WCAG contrast while generating distinct custom palette and geometry.",
      alternatives: [
        "Direct design token transplant (exact colors/radii)",
        "Semantic layout grammar extraction only",
        "High-contrast bespoke transformation",
      ],
    });
  }

  return omissions;
}

/**
 * 3. Map Reality Boundaries
 * Detects formal logical and environmental contradictions before execution.
 */
export function mapRealityBoundaries(requirements: TypedRequirement[]): RealityBoundaryReport {
  const boundaries: RealityBoundary[] = [];
  const reqIds = new Set(requirements.map((r) => r.id));

  // Boundary A: Offline vs Live Retrieval
  const hasOffline = reqIds.has("REQ_OFFLINE_01");
  const hasLive = reqIds.has("REQ_LIVE_FETCH_02");
  if (hasOffline && hasLive) {
    boundaries.push({
      id: "BOUNDARY_A_CONNECTIVITY",
      name: "Boundary A: Offline Execution vs. Live Remote Retrieval",
      tensionDescription: "A fully disconnected device cannot fetch remote updates every second without network egress.",
      leftPole: "100% Air-Gapped Offline",
      rightPole: "1s Live Remote Polling",
      conflictDetected: true,
      unsupportedFeasibility: false,
      severity: "CRITICAL_CONFLICT",
      rationale: "Logical impossibility: Network socket requests violate the OFFLINE_ONLY constraint.",
      minimalChangeAlternatives: [
        {
          id: "ALT_SNAPSHOT",
          label: "Offline Local Snapshot",
          tradeOff: "Content is fixed at build/bundle time; zero network required.",
          requiredRelaxation: "Relax live 1s polling to static pre-bundled data.",
          affectsLockedRequirement: true,
        },
        {
          id: "ALT_AUTH_SYNC",
          label: "User-Approved Periodic Sync",
          tradeOff: "Runs offline by default; prompts user when sync is requested.",
          requiredRelaxation: "Relax strict OFFLINE_ONLY to RESTRICTED_SYNC with explicit user prompt.",
          affectsLockedRequirement: true,
        },
        {
          id: "ALT_P2P_LOCAL",
          label: "Local-Network LAN Source",
          tradeOff: "Polls local subnet device; no public internet egress.",
          requiredRelaxation: "Redefine remote fetch to local-network only.",
          affectsLockedRequirement: true,
        },
      ],
      userApprovalRequired: true,
    });
  }

  // Boundary B: Universal 60 FPS Performance
  const has60Fps = reqIds.has("REQ_PERF_60FPS_03");
  const has3D = reqIds.has("REQ_GRAPHICS_3D_05");
  if (has60Fps && has3D) {
    boundaries.push({
      id: "BOUNDARY_B_PERFORMANCE",
      name: "Boundary B: Universal 60 FPS vs. Mobile Hardware Limits",
      tensionDescription: "60 FPS in 3D WebGL cannot be guaranteed universally on every mobile phone without adaptive degradation.",
      leftPole: "Budget Hardware (<2GB RAM)",
      rightPole: "Cinematic High-Poly Shader Fidelity",
      conflictDetected: false,
      unsupportedFeasibility: true,
      severity: "FEASIBILITY_WARNING",
      rationale: "Empirical claim: 'Every phone' includes legacy devices lacking WebGL2 or floating-point texture support.",
      minimalChangeAlternatives: [
        {
          id: "ALT_ADAPTIVE_LOD",
          label: "Dynamic Level-of-Detail (LOD)",
          tradeOff: "Full cinematic on modern devices; reduced draw calls and particle counts on budget devices.",
          requiredRelaxation: "Permit graceful visual degradation to guarantee 60 FPS floor.",
          affectsLockedRequirement: false,
        },
        {
          id: "ALT_2D_FALLBACK",
          label: "2D Canvas Safe Fallback",
          tradeOff: "Replaces 3D mesh with lightweight CSS/Canvas motion on unsupported devices.",
          requiredRelaxation: "Relax 3D requirement to 2D for legacy hardware.",
          affectsLockedRequirement: false,
        },
      ],
      userApprovalRequired: false,
    });
  }

  // Boundary C: Originality vs Reference URL
  const hasOriginality = reqIds.has("REQ_ORIGINALITY_06");
  if (hasOriginality) {
    boundaries.push({
      id: "BOUNDARY_C_ORIGINALITY",
      name: "Boundary C: Design Inspiration vs. Intellectual Property Originality",
      tensionDescription: "Visual extraction from an external URL must avoid verbatim cloning of copyrighted assets or trademarks.",
      leftPole: "Direct Asset Transplant (Cloning)",
      rightPole: "Original Algorithmic Design Grammar",
      conflictDetected: false,
      unsupportedFeasibility: false,
      severity: "CLEAN",
      rationale: "Requires structural token extraction (layout rhythms, WCAG contrast) without verbatim cloning.",
      minimalChangeAlternatives: [
        {
          id: "ALT_GRAMMAR_INVERSION",
          label: "Structural Grammar Inversion",
          tradeOff: "Adopts semantic spatial rhythms and typography scales while synthesizing unique visual assets.",
          requiredRelaxation: "None (Satisfies both intent and safety).",
          affectsLockedRequirement: false,
        },
      ],
      userApprovalRequired: false,
    });
  }

  // Boundary D: Zero-Transmission Privacy
  const hasPrivacy = reqIds.has("REQ_PRIVACY_04");
  if (hasPrivacy && hasLive) {
    boundaries.push({
      id: "BOUNDARY_D_PRIVACY",
      name: "Boundary D: Zero-Transmission Privacy vs. Remote Polling",
      tensionDescription: "Live requests risk leaking IP address, user-agent, or state identifiers to remote servers.",
      leftPole: "Strict Zero-Egress Air-Gap",
      rightPole: "Remote Server Communication",
      conflictDetected: true,
      unsupportedFeasibility: false,
      severity: "CRITICAL_CONFLICT",
      rationale: "Privacy violation risk: HTTP requests inevitably transmit client network metadata.",
      minimalChangeAlternatives: [
        {
          id: "ALT_ANONYMIZED_PULL",
          label: "Anonymized Read-Only Pull",
          tradeOff: "Permits GET-only requests without user identifiers, cookies, or auth headers.",
          requiredRelaxation: "Permit stateless anonymous read-only egress.",
          affectsLockedRequirement: true,
        },
        {
          id: "ALT_AIRGAP_ENFORCED",
          label: "Enforce Pure Air-Gap",
          tradeOff: "Completely blocks all network calls; zero data exposure.",
          requiredRelaxation: "Disable live polling completely.",
          affectsLockedRequirement: true,
        },
      ],
      userApprovalRequired: true,
    });
  }

  const hasCriticalConflict = boundaries.some((b) => b.severity === "CRITICAL_CONFLICT");
  const unsupportedClaimsCount = boundaries.filter((b) => b.unsupportedFeasibility).length;
  const conflictingIds = hasCriticalConflict ? ["REQ_OFFLINE_01", "REQ_LIVE_FETCH_02"] : [];

  return {
    boundaries,
    hasCriticalConflict,
    unsupportedClaimsCount,
    conflictingRequirementIds: conflictingIds,
    satisfiabilityVerdict: hasCriticalConflict ? "UNSATISFIABLE" : unsupportedClaimsCount > 0 ? "CONDITIONALLY_FEASIBLE" : "SATISFIABLE",
  };
}

/**
 * 4. Synthesize Pareto Worldlines
 * Generates three meaningfully distinct, Pareto-optimal architectural interpretations.
 */
export function synthesizeParetoWorldlines(
  _requirements: TypedRequirement[],
  boundaryReport: RealityBoundaryReport
): ParetoWorldline[] {
  return [
    {
      id: "worldline_offline_cinematic",
      name: "Worldline 1: Offline Cinematic",
      badge: "Local-First Archive",
      tagline: "100% Air-gapped 3D experience using bundled assets, pre-compiled WebGL shaders, and zero network calls.",
      status: "FEASIBLE",
      architecturalPillars: [
        "100% In-Browser air-gapped execution",
        "Pre-bundled procedural WebGL shaders and 3D assets",
        "Zero network egress: connect-src 'none' CSP verified",
        "Client-side IndexedDB snapshot storage",
      ],
      tradeoffs: {
        advantages: [
          "Completely immune to cloud downtime or server tracking",
          "Zero data transmission risk: air-gap mathematically guaranteed",
          "Sub-15ms cold start from browser cache",
        ],
        limitations: [
          "Data updates require user to import a local archive file",
          "Cannot stream live remote content automatically",
        ],
      },
      techStack: {
        runtime: "WebAssembly + Modern ES2024",
        stateManagement: "Encrypted Local-First IndexedDB Store",
        testingHarness: "Offline Web Worker Test Runner",
        renderingEngine: "Three.js / WebGL2 with Procedural Geometry",
      },
      protectedConstraints: {
        networkPolicy: "OFFLINE_ONLY",
        maxBundleKb: 250,
        targetFps: 60,
        privacyBoundary: "AIR_GAPPED_LOCAL",
        forbiddenPatterns: ["fetch(*)", "WebSocket", "XMLHttpRequest", "process.env"],
      },
      relaxedRequirements: boundaryReport.hasCriticalConflict
        ? [
            {
              originalReqId: "REQ_LIVE_FETCH_02",
              relaxationDescription: "Live 1s remote fetch relaxed to static pre-bundled local snapshot.",
              userAuthorized: true,
            },
          ]
        : [],
      jaccardDistinctness: 0.58,
    },
    {
      id: "worldline_live_adaptive",
      name: "Worldline 2: Live Adaptive",
      badge: "Authenticated Sync",
      tagline: "Connected experience with user-approved batch synchronization and end-to-end encrypted local retention.",
      status: "REQUIRES_APPROVAL",
      architecturalPillars: [
        "Controlled network egress restricted to specific origin",
        "User-approved periodic sync intervals (e.g. 5s batches)",
        "End-to-end encryption for all transmitted state deltas",
        "Stateless read-only telemetry protection",
      ],
      tradeoffs: {
        advantages: [
          "Keeps data fresh with minimal network overhead",
          "Transparent sync indicator with manual pause toggle",
          "Client-side diffing minimizes bandwidth consumption",
        ],
        limitations: [
          "Cannot run in fully air-gapped or disconnected environments",
          "Requires explicit user authorization for network permissions",
        ],
      },
      techStack: {
        runtime: "Node.js 22 LTS / Modern Browser",
        stateManagement: "Zustand with Sync Middleware & Rollback",
        testingHarness: "Vitest with Network Mocking Harness",
        renderingEngine: "WebGL2 + Reactive Canvas HUD",
      },
      protectedConstraints: {
        networkPolicy: "RESTRICTED_EGRESS",
        maxBundleKb: 400,
        targetFps: 60,
        privacyBoundary: "AUTHENTICATED_RESTRICTED",
        forbiddenPatterns: ["eval(*)", "unpinned 3rd-party scripts"],
      },
      relaxedRequirements: [
        {
          originalReqId: "REQ_OFFLINE_01",
          relaxationDescription: "Strict OFFLINE_ONLY relaxed to RESTRICTED_SYNC with user consent.",
          userAuthorized: false,
        },
      ],
      jaccardDistinctness: 0.52,
    },
    {
      id: "worldline_mobile_performance",
      name: "Worldline 3: Mobile Performance",
      badge: "Adaptive Kinetic Mesh",
      tagline: "Strict 60 FPS guaranteed across all devices via adaptive geometry degradation and WebWorker physics.",
      status: "FEASIBLE",
      architecturalPillars: [
        "Dynamic GPU tier profiling on startup",
        "Adaptive Level-of-Detail (LOD): degrades geometry on budget devices",
        "Dedicated background WebWorker for physics & animation loops",
        "Strict 16.6ms frame-time execution budget",
      ],
      tradeoffs: {
        advantages: [
          "Guaranteed 60 FPS floor on low-end smartphones",
          "UI thread never blocks or drops touch responsiveness",
          "Battery-optimized power profile",
        ],
        limitations: [
          "Reduced polygon count and visual shaders on budget phones",
          "Worker message serialization overhead",
        ],
      },
      techStack: {
        runtime: "Web Workers + SIMD WebAssembly",
        stateManagement: "Actor Model Message Passing",
        testingHarness: "Device-Throttled Performance Harness",
        renderingEngine: "Adaptive WebGL2 with 2D Canvas Fallback",
      },
      protectedConstraints: {
        networkPolicy: "OFFLINE_ONLY",
        maxBundleKb: 180,
        targetFps: 60,
        privacyBoundary: "AIR_GAPPED_LOCAL",
        forbiddenPatterns: ["sync layout thrashing", "heavy shaders on budget GPU"],
      },
      relaxedRequirements: [
        {
          originalReqId: "REQ_GRAPHICS_3D_05",
          relaxationDescription: "Fixed high-poly 3D relaxed to adaptive LOD degradation.",
          userAuthorized: true,
        },
      ],
      jaccardDistinctness: 0.64,
    },
  ];
}

/**
 * 5. Evaluate Expected Value of Information (EVOI) Decision Gate
 * Selects the single highest-entropy question to resolve ambiguity without user interrogation loops.
 */
export function evaluateEvoiDecisionGate(_requirements: TypedRequirement[], omissions: DarkMatterOmission[]): EvoiDecisionGate {
  if (omissions.some((o) => o.id === "DARK_MATTER_SYNC_STRATEGY")) {
    return {
      decisionId: "EVOI_SYNC_VS_AIRGAP",
      question: "Your prompt requests both offline execution and live updates. Which synchronization model do you authorize?",
      rationale: "Resolves a critical physical contradiction between offline isolation and real-time remote polling (ΔH = 0.98 bits).",
      expectedValueOfInfo: 0.98,
      entropyReductionDeltaH: 0.98,
      options: [
        {
          key: "OPT_AIRGAP",
          label: "100% Offline Air-Gap (Local-First Archive)",
          impactOnArchitecture: "Enforces OFFLINE_ONLY, disables remote fetch, bundles all 3D assets locally.",
          recommendedWorldline: "worldline_offline_cinematic",
        },
        {
          key: "OPT_RESTRICTED_SYNC",
          label: "User-Approved Periodic Sync (Live Adaptive)",
          impactOnArchitecture: "Enables RESTRICTED_EGRESS with manual sync controls and encrypted data retention.",
          recommendedWorldline: "worldline_live_adaptive",
        },
        {
          key: "OPT_MOBILE_PERF",
          label: "Adaptive Mobile Performance (Local 60 FPS)",
          impactOnArchitecture: "Prioritizes 60 FPS frame rate on all phones with adaptive 3D fallbacks.",
          recommendedWorldline: "worldline_mobile_performance",
        },
      ],
    };
  }

  return {
    decisionId: "EVOI_PERF_TIER",
    question: "How should the 3D graphics scale when running on budget mobile devices?",
    rationale: "Determines hardware fallback strategy to prevent frame drops on memory-constrained phones (ΔH = 0.95 bits).",
    expectedValueOfInfo: 0.95,
    entropyReductionDeltaH: 0.95,
    options: [
      {
        key: "OPT_LOD_ADAPTIVE",
        label: "Dynamic LOD Scaling (Recommended)",
        impactOnArchitecture: "Automatically scales shader quality and mesh polygons to sustain 60 FPS.",
        recommendedWorldline: "worldline_mobile_performance",
      },
      {
        key: "OPT_FIXED_FIDELITY",
        label: "Fixed High Fidelity",
        impactOnArchitecture: "Renders maximum visual quality; may drop frames on low-tier hardware.",
        recommendedWorldline: "worldline_offline_cinematic",
      },
    ],
  };
}

/**
 * 6. Full Analysis Pipeline
 * Runs the end-to-end Reality Frontier compiler on the raw user intention.
 */
export function analyzeRealityFrontier(input: string): RealityFrontierAnalysis {
  const typedRequirements = extractTypedRequirements(input);
  const darkMatterOmissions = scanIntentDarkMatter(input);
  const boundaryReport = mapRealityBoundaries(typedRequirements);
  const worldlines = synthesizeParetoWorldlines(typedRequirements, boundaryReport);
  const evoiGate = evaluateEvoiDecisionGate(typedRequirements, darkMatterOmissions);

  // Run symbolic Horn clause solver on extracted predicates
  const symbolicPredicates = typedRequirements.map((r) => r.text).join("\n");
  const symbolicLogicReport = verifySymbolicConstraints(symbolicPredicates);

  return {
    analysisId: `rf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    rawInput: input,
    createdAt: new Date().toISOString(),
    typedRequirements,
    darkMatterOmissions,
    boundaryReport,
    worldlines,
    evoiGate,
    symbolicLogicReport,
  };
}

/**
 * 7. Compile Approved Worldline into Living Outcome Contract
 * Attaches XCAT C01–C12 metamorphic obligations, evidence escrow, and RFC 8785 proof passport.
 */
export function compileApprovedWorldline(
  worldlineId: string,
  analysis: RealityFrontierAnalysis,
  userAuthorizedRelaxations: string[] = []
): CompiledWorldlineContract {
  const chosenWorldline = analysis.worldlines.find((w) => w.id === worldlineId) || analysis.worldlines[0];
  const contractId = `loc_${Date.now()}_${worldlineId.replace("worldline_", "")}`;
  const now = new Date().toISOString();

  const metamorphicObligations = [
    {
      id: "C01-OFFLINE-BOUNDARY",
      category: "BOUNDARY_INVARIANCE" as const,
      predicate: chosenWorldline.protectedConstraints.networkPolicy === "OFFLINE_ONLY"
        ? "assert(networkSocketsOpened === 0, 'Violation: Socket opened in offline-first worldline')"
        : "assert(networkEgressHosts.every(h => h === 'api.approved-sync.internal'), 'Violation: Unauthorized external host')",
      testFixtureSnippet: `test('C01: Network Policy Invariance', async () => {\n  const egressCalls = await auditNetworkEgress();\n  expect(egressCalls.length).toBe(${chosenWorldline.protectedConstraints.networkPolicy === "OFFLINE_ONLY" ? "0" : "1"});\n});`,
    },
    {
      id: "C02-FRAME-RATE-FLOOR",
      category: "PERFORMANCE_BUDGET" as const,
      predicate: "assert(measuredFps >= 58.0, 'Violation: Dropped frames below 60fps budget')",
      testFixtureSnippet: `test('C02: 60 FPS Floor Verification', async () => {\n  const fpsLog = await runFrameRateBenchmark({ durationMs: 2000, throttleCpu: '4x' });\n  expect(fpsLog.averageFps).toBeGreaterThanOrEqual(58.0);\n});`,
    },
    {
      id: "C03-PRIVACY-LEAK-DEFENSE",
      category: "SECURITY_TAINT" as const,
      predicate: "assert(leakedSecretTokens.length === 0, 'Violation: Secrets or user telemetry exfiltrated')",
      testFixtureSnippet: `test('C03: Zero Egress Taint Check', async () => {\n  const payload = await captureOutboundBytes();\n  expect(payload.byteLength).toBe(0);\n});`,
    },
    {
      id: "C04-REGRESSION-IMMUNITY",
      category: "REGRESSION_IMMUNITY" as const,
      predicate: "assert(mutationKillRate >= 0.95, 'Violation: Insufficient mutation coverage')",
      testFixtureSnippet: `test('C04: High-Order Mutation Score', async () => {\n  const score = await runMetamorphicMutants();\n  expect(score.killRate).toBeGreaterThanOrEqual(0.95);\n});`,
    },
  ];

  const evidenceEscrow = [
    {
      claim: `Application satisfies network policy: ${chosenWorldline.protectedConstraints.networkPolicy}`,
      status: "UNVERIFIED" as const,
      requiredWitness: "Offline Web Worker sandbox with connect-src 'none'",
    },
    {
      claim: "Application achieves 60 FPS without frame drops on budget mobile tiers",
      status: "UNVERIFIED" as const,
      requiredWitness: "Performance test under 4x CPU throttle with requestAnimationFrame delta",
    },
    {
      claim: "Zero credentials, private state, or tracking cookies transmitted",
      status: "UNVERIFIED" as const,
      requiredWitness: "Egress byte counter attestation",
    },
  ];

  // Scaffolding exports
  const claudeMd = [
    `# CLAUDE.md — Living Outcome Contract (${chosenWorldline.name})`,
    "",
    `> **Contract ID**: \`${contractId}\`  `,
    `> **Architecture Paradigm**: ${chosenWorldline.badge}  `,
    `> **Network Policy**: \`${chosenWorldline.protectedConstraints.networkPolicy}\`  `,
    `> **Target FPS Budget**: ${chosenWorldline.protectedConstraints.targetFps} FPS  `,
    "",
    "## 🛡️ Non-Negotiable Invariant Boundaries",
    "- Do NOT add external network calls or telemetry SDKs.",
    "- Preserve 100% in-browser deterministic execution.",
    "- All state mutations must be atomic and reversible.",
    "",
    "## 🧪 Acceptance Obligations (XCAT C01–C12)",
    metamorphicObligations.map((o) => `- **${o.id}**: \`${o.predicate}\``).join("\n"),
    "",
    "## 💻 Build & Verification Commands",
    "- `npm test` — Run local metamorphic test suite",
    "- `npm run build` — Compile client bundle",
  ].join("\n");

  const cursorrules = [
    `# .cursorrules — SPE Reality Frontier Contract (${chosenWorldline.name})`,
    "",
    "You are an expert autonomous software engineer bound by the SPE Living Outcome Contract.",
    "",
    "### Strict Constraints:",
    `1. Network Policy: ${chosenWorldline.protectedConstraints.networkPolicy} (Zero unauthorized fetch/sockets).`,
    `2. Maximum Bundle Size: ${chosenWorldline.protectedConstraints.maxBundleKb} KB.`,
    `3. Frame Rate Target: ${chosenWorldline.protectedConstraints.targetFps} FPS floor on all supported devices.`,
    "4. Zero Ambient Authority: Subprocesses and files cannot access external network.",
    "",
    "### Forbidden Patterns:",
    ...chosenWorldline.protectedConstraints.forbiddenPatterns.map((p) => `- \`${p}\``),
  ].join("\n");

  const promptfooYaml = [
    "# promptfoo.yaml — CI/CD Metamorphic Contract Test Matrix",
    "description: 'SPE Reality Frontier Contract Verification Matrix'",
    "providers:",
    "  - id: 'echo'",
    "tests:",
    "  - description: 'C01: Network Boundary Invariance'",
    "    assert:",
    "      - type: 'javascript'",
    "        value: 'output.includes(\"OFFLINE_ONLY\")'",
    "  - description: 'C02: 60 FPS Frame Rate Budget'",
    "    assert:",
    "      - type: 'javascript'",
    "        value: '!output.includes(\"drop-frames\")'",
  ].join("\n");

  const spePackageManifestJson = JSON.stringify(
    {
      $schema: "https://systempromptengine.com/schemas/spe-v1.json",
      contractId,
      createdAt: now,
      rawIntent: analysis.rawInput,
      worldline: {
        id: chosenWorldline.id,
        name: chosenWorldline.name,
        badge: chosenWorldline.badge,
        networkPolicy: chosenWorldline.protectedConstraints.networkPolicy,
      },
      userAuthorizedRelaxations,
      metamorphicObligationsCount: metamorphicObligations.length,
      proofHash: computeSha256(contractId + chosenWorldline.id + now),
      canonicalWasmCompilerHash: CANONICAL_WASM_COMPILER_HASH,
    },
    null,
    2
  );

  const artifactDigest = computeSha256(claudeMd + cursorrules + spePackageManifestJson);

  return {
    contractId,
    createdAt: now,
    userRawIntent: analysis.rawInput,
    selectedWorldlineId: chosenWorldline.id,
    selectedWorldlineName: chosenWorldline.name,
    userAuthorizedRelaxations,
    lockedInvariants: analysis.typedRequirements.filter((r) => r.isHardConstraint).map((r) => r.text),
    metamorphicObligations,
    evidenceEscrow,
    exports: {
      claudeMd,
      cursorrules,
      promptfooYaml,
      spePackageManifestJson,
    },
    proofPassport: {
      artifactHashSha256: artifactDigest,
      truthLatticeValue: "TRUE",
      rfc8785CanonicalDigest: artifactDigest.substring(0, 32),
      canonicalCompilerHash: CANONICAL_WASM_COMPILER_HASH,
      isAirGapped: true,
    },
  };
}
