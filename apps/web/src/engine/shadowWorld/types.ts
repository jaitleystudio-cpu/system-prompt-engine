/**
 * SPE Ω — Shadow World & Future Failure Radar Types
 *
 * Mandate:
 * Grounded in:
 * - AgentA/B: Evaluating Web Experiences via Synthetic User Simulation (NeurIPS 2025).
 * - Multi-Turn Fault Injection & Edge-Case Stress Testing (arXiv:2610.05981).
 *
 * Simulates user journeys in a private digital twin before real humans or agents
 * are exposed to website modifications.
 */

export interface DeviceProfile {
  viewportWidth: number;
  viewportHeight: number;
  networkType: "4G" | "3G" | "OFFLINE";
  cpuThrottlingRate: number; // 1x, 2x, 4x
  prefersReducedMotion: boolean;
  screenReaderEnabled: boolean;
  minTapTargetPx: number;
}

export interface SyntheticPersona {
  id: string;
  name: string;
  archetype: "FIRST_TIME_CREATOR" | "STAFF_ENGINEER" | "LOW_END_MOBILE" | "ACCESSIBILITY_FIRST" | "AUTONOMOUS_WEBMCP_AGENT";
  description: string;
  deviceProfile: DeviceProfile;
  satisfactionThreshold: number; // 0.0 to 1.0
  goals: string[];
}

export interface PersonaSimulationResult {
  personaId: string;
  archetype: SyntheticPersona["archetype"];
  taskCompleted: boolean;
  satisfactionScore: number; // 0.0 to 1.0
  frictionPoints: string[];
  detectedRegressions: string[];
  executionLatencyMs: number;
}

export interface ShadowWorldMatrixResult {
  timestamp: string;
  overallReadinessScore: number; // 0.0 to 1.0
  qualifiedForLive: boolean;
  personaResults: PersonaSimulationResult[];
  blockers: string[];
  summary: string;
}

export interface StressScenario {
  id: string;
  title: string;
  description: string;
  faultType: "NETWORK_DROP" | "FONT_ZOOM_200" | "CPU_SATURATION" | "REDUCED_MOTION" | "AIR_GAP_PROBE";
}

export interface ScenarioTestOutcome {
  scenarioId: string;
  faultType: StressScenario["faultType"];
  resilient: boolean;
  recoveryLatencyMs: number;
  observation: string;
}

export interface FutureFailureScanResult {
  timestamp: string;
  totalScenarios: number;
  resilientCount: number;
  vulnerabilityCount: number;
  passRate: number; // 0.0 to 1.0
  outcomes: ScenarioTestOutcome[];
  status: "RESILIENT" | "VULNERABILITIES_DETECTED";
}
