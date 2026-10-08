/**
 * Types and interfaces for 3D Enhancement planning.
 */
import type { EnhancementKind, TruthLabel } from "../model/enhancementMetadata.ts";

export interface PerformanceEstimate {
  estimatedDrawCalls: number;
  estimatedTriangles: number;
  gpuPressure: "LOW" | "MEDIUM" | "HIGH";
}

export interface AccessibilityImpact {
  reducedMotionFallbackRequired: boolean;
  screenReaderEquivalentPreserved: boolean;
}

export interface EnhancementProposal {
  targetId: string;
  kind: EnhancementKind;
  currentState: string;
  proposedState: string;
  performanceImpact: PerformanceEstimate;
  accessibilityImpact: AccessibilityImpact;
  confidence: number;
  truthLabel: TruthLabel;
}

export interface TruthLabelCheck {
  kind: EnhancementKind;
  technology: string;
  claimedTruthLabel: TruthLabel;
}
