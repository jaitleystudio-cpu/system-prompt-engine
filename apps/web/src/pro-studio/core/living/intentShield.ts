// Wires SPE's existing Intent Loss Detector (src/engine/intentLossDetector) into the Living loop as a second,
// independent prompt check next to the exact-text firewall. A CRITICAL finding (a negative constraint dropped
// or contradicted) blocks the attempt before the model is called. Heuristic: it reads keywords, so it is a
// guard, not proof; the deterministic checks on real outputs remain the only source of VERIFIED.
import { IntentLossDetector } from "../../../engine/intentLossDetector/intentLossDetector.ts";
import type { Requirement } from "./types.ts";

export function intentShield(reqs: Requirement[], prompt: string): { fidelity: number; critical: boolean; droppedNegative: number; dropped: string[] } {
  const text = reqs.map((q) => q.text).join("\n");
  if (!text.trim()) return { fidelity: 1, critical: false, droppedNegative: 0, dropped: [] };
  const r = new IntentLossDetector().evaluateIntentFidelity(text, prompt);
  return {
    fidelity: r.fidelityScore, critical: r.criticalDefectsDetected, droppedNegative: r.droppedNegativeConstraints,
    dropped: r.findings.filter((f) => f.state === "DROPPED" || f.state === "CONTRADICTED").map((f) => `${f.state}: ${f.requirement.originalText}`.slice(0, 200)).slice(0, 20),
  };
}
