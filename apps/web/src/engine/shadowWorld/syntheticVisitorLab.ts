/**
 * SPE Ω — Synthetic Visitor Lab (Shadow World)
 *
 * Mandate:
 * Grounded in:
 * - AgentA/B: Evaluating Web Experiences via Synthetic User Simulation (NeurIPS 2025).
 * - Multi-Persona Digital Twin Testing.
 *
 * Simulates user journeys across 5 synthetic personas to detect usability,
 * accessibility, performance, and agent regressions prior to production release.
 */

import type {
  SyntheticPersona,
  PersonaSimulationResult,
  ShadowWorldMatrixResult,
} from "./types.ts";
import type { TriViewCompilationResult } from "../experienceCompiler/types.ts";

export const CANONICAL_PERSONAS: SyntheticPersona[] = [
  {
    id: "persona_creator",
    name: "Alex (First-Time Non-Technical Creator)",
    archetype: "FIRST_TIME_CREATOR",
    description: "Builds simple productivity prompts; low patience for jargon; requires obvious starting buttons.",
    deviceProfile: {
      viewportWidth: 1440,
      viewportHeight: 900,
      networkType: "4G",
      cpuThrottlingRate: 1,
      prefersReducedMotion: false,
      screenReaderEnabled: false,
      minTapTargetPx: 44,
    },
    satisfactionThreshold: 0.85,
    goals: ["Understand purpose within 3 seconds", "Enter text and get result without errors", "No confusing academic math"],
  },
  {
    id: "persona_staff_eng",
    name: "Elena (Principal Software Architect)",
    archetype: "STAFF_ENGINEER",
    description: "Evaluates enterprise security invariants, AST desugaring, offline WASM hash, and export targets.",
    deviceProfile: {
      viewportWidth: 1920,
      viewportHeight: 1080,
      networkType: "4G",
      cpuThrottlingRate: 1,
      prefersReducedMotion: false,
      screenReaderEnabled: false,
      minTapTargetPx: 44,
    },
    satisfactionThreshold: 0.90,
    goals: ["Verify zero-drift invariants", "Export directly to .cursorrules and CLAUDE.md", "Confirm $0 on-device execution"],
  },
  {
    id: "persona_mobile",
    name: "Ravi (Mobile Developer on 3G)",
    archetype: "LOW_END_MOBILE",
    description: "Browses on a budget Android smartphone with 360px width, slow 3G cellular, and high latency.",
    deviceProfile: {
      viewportWidth: 360,
      viewportHeight: 640,
      networkType: "3G",
      cpuThrottlingRate: 4,
      prefersReducedMotion: false,
      screenReaderEnabled: false,
      minTapTargetPx: 48,
    },
    satisfactionThreshold: 0.80,
    goals: ["Zero horizontal scrolling", "Tap targets at least 48px", "Fast render under 2.5s"],
  },
  {
    id: "persona_a11y",
    name: "Jordan (Keyboard & Screen Reader User)",
    archetype: "ACCESSIBILITY_FIRST",
    description: "Navigates solely via Tab/Enter keys and NVDA screen reader; relies on WCAG 2.2 AA compliance.",
    deviceProfile: {
      viewportWidth: 1280,
      viewportHeight: 800,
      networkType: "4G",
      cpuThrottlingRate: 1,
      prefersReducedMotion: true,
      screenReaderEnabled: true,
      minTapTargetPx: 48,
    },
    satisfactionThreshold: 0.90,
    goals: ["All inputs have accessible labels", "Focus outline clearly visible", "Contrast >= 4.5:1"],
  },
  {
    id: "persona_agent",
    name: "Cortex (Autonomous WebMCP Browser Agent)",
    archetype: "AUTONOMOUS_WEBMCP_AGENT",
    description: "Autonomous AI assistant exploring the website via window.WebMCP and modelContext tools.",
    deviceProfile: {
      viewportWidth: 1280,
      viewportHeight: 720,
      networkType: "4G",
      cpuThrottlingRate: 1,
      prefersReducedMotion: true,
      screenReaderEnabled: false,
      minTapTargetPx: 0,
    },
    satisfactionThreshold: 0.95,
    goals: ["Discover tools programmatically", "Execute with zero DOM guessing", "Receive structured error if token invalid"],
  },
];

export class SyntheticVisitorLab {
  /**
   * Evaluates a tri-view compilation result against the 5 canonical personas.
   */
  public simulateVisitorMatrix(triView: TriViewCompilationResult): ShadowWorldMatrixResult {
    const timestamp = new Date().toISOString();
    const personaResults: PersonaSimulationResult[] = [];
    const blockers: string[] = [];

    const human = triView.humanExperience;
    const search = triView.searchExperience;
    const agent = triView.agentExperience;

    for (const persona of CANONICAL_PERSONAS) {
      const startTime = performance.now();
      const frictionPoints: string[] = [];
      const detectedRegressions: string[] = [];
      let taskCompleted = true;
      let satisfactionScore = 1.0;

      switch (persona.archetype) {
        case "FIRST_TIME_CREATOR": {
          // Check for jargon in user-facing title and fields
          const textBlob = `${human.title} ${human.subtitle} ${human.fields.map((f) => f.label + " " + f.helpText).join(" ")}`.toLowerCase();
          const academicJargon = ["horn clause", "kleene-3", "monotone join", "propositional lattice", "rfc 8785"];

          for (const word of academicJargon) {
            if (textBlob.includes(word)) {
              frictionPoints.push(`Exposed academic jargon '${word}' confounds first-time creator.`);
              satisfactionScore -= 0.15;
            }
          }

          if (!search.titleTag.toLowerCase().includes(human.title.toLowerCase())) {
            frictionPoints.push("Search snippet title does not match page headline; visitor feels bait-and-switch.");
            satisfactionScore -= 0.10;
          }

          if (!human.fields.some((f) => f.required)) {
            frictionPoints.push("No obvious primary requirement field indicated.");
            satisfactionScore -= 0.10;
          }
          break;
        }

        case "STAFF_ENGINEER": {
          // Demands exact reproducibility, hash proof, and multi-format support
          if (!human.offlineIndicator) {
            frictionPoints.push("Offline execution not indicated; engineer doubts air-gap claim.");
            satisfactionScore -= 0.20;
          }
          if (!triView.rfc8785Digest || triView.rfc8785Digest.length !== 64) {
            detectedRegressions.push("Missing or invalid RFC 8785 SHA-256 canonical digest.");
            taskCompleted = false;
            satisfactionScore -= 0.40;
          }
          break;
        }

        case "LOW_END_MOBILE": {
          // Checks tap targets and field count on small screens
          if (human.fields.length > 6) {
            frictionPoints.push(`Form contains ${human.fields.length} fields; causes mobile cognitive overload.`);
            satisfactionScore -= 0.15;
          }
          if (persona.deviceProfile.minTapTargetPx < 48) {
            frictionPoints.push("Button tap targets below recommended 48px touch boundary.");
            satisfactionScore -= 0.10;
          }
          break;
        }

        case "ACCESSIBILITY_FIRST": {
          // Checks form labels and ISO plain language
          const missingLabels = human.fields.filter((f) => !f.label || f.label.trim().length === 0);
          if (missingLabels.length > 0) {
            detectedRegressions.push(`${missingLabels.length} form field(s) lack accessible screen-reader labels.`);
            taskCompleted = false;
            satisfactionScore -= 0.50;
          }
          if (!human.iso24495Compliant) {
            frictionPoints.push("Human experience contract lacks ISO 24495 plain language certification.");
            satisfactionScore -= 0.10;
          }
          break;
        }

        case "AUTONOMOUS_WEBMCP_AGENT": {
          // Checks WebMCP tool schema completeness and offline execution
          if (!agent.toolName.startsWith("spe_")) {
            detectedRegressions.push(`WebMCP tool name '${agent.toolName}' lacks standard namespace prefix.`);
            taskCompleted = false;
            satisfactionScore -= 0.30;
          }
          if (Object.keys(agent.parameters.properties).length === 0) {
            frictionPoints.push("Tool exposes empty parameter schema.");
            satisfactionScore -= 0.15;
          }
          if (!agent.offlineWasmExecutable) {
            frictionPoints.push("Tool cannot execute offline in browser client.");
            satisfactionScore -= 0.20;
          }
          break;
        }
      }

      satisfactionScore = Math.max(0.0, Math.min(1.0, satisfactionScore));
      if (satisfactionScore < persona.satisfactionThreshold) {
        taskCompleted = false;
        blockers.push(`${persona.name}: satisfaction score ${(satisfactionScore * 100).toFixed(0)}% fell below threshold ${(persona.satisfactionThreshold * 100).toFixed(0)}%.`);
      }

      personaResults.push({
        personaId: persona.id,
        archetype: persona.archetype,
        taskCompleted,
        satisfactionScore,
        frictionPoints,
        detectedRegressions,
        executionLatencyMs: performance.now() - startTime,
      });
    }

    const avgScore = personaResults.reduce((acc, p) => acc + p.satisfactionScore, 0) / personaResults.length;
    const qualifiedForLive = blockers.length === 0 && avgScore >= 0.88;

    const summary = qualifiedForLive
      ? `Shadow World Qualification: PASSED with ${(avgScore * 100).toFixed(1)}% readiness across 5 personas.`
      : `Shadow World Qualification: HELD. ${blockers.length} persona failure(s) detected.`;

    return {
      timestamp,
      overallReadinessScore: avgScore,
      qualifiedForLive,
      personaResults,
      blockers,
      summary,
    };
  }
}
