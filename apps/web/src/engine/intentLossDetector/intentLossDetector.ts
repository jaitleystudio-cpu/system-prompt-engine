/**
 * SPE Ω — Intent Loss Detector (ILD) Engine
 * Crown Breakthrough Capability #1
 *
 * Grounded in:
 * - ST-WebAgentBench (ICLR 2026): Policy compliance vs nominal task completion
 * - Counterfactual Specification Closure (CSC)
 * - Anti-Drift Failure Shield
 */

import { RequirementExtractor } from "./requirementExtractor.ts";
import type {
  ExtractedRequirement,
  IntentLossFinding,
  IntentLossReport,
} from "./types.ts";

export class IntentLossDetector {
  private extractor = new RequirementExtractor();

  /**
   * Evaluates synthesized prompt against original user requirements.
   */
  public evaluateIntentFidelity(
    sourceRequirements: string | ExtractedRequirement[],
    synthesizedPrompt: string
  ): IntentLossReport {
    const requirements: ExtractedRequirement[] =
      typeof sourceRequirements === "string"
        ? this.extractor.extractFromText(sourceRequirements)
        : sourceRequirements;

    const lowerPrompt = synthesizedPrompt.toLowerCase();
    const findings: IntentLossFinding[] = [];

    let preservedCount = 0;
    let droppedCount = 0;
    let weakenedCount = 0;
    let contradictedCount = 0;
    let droppedNegativeConstraints = 0;

    for (const req of requirements) {
      const finding = this.evaluateSingleRequirement(req, lowerPrompt);
      findings.push(finding);

      switch (finding.state) {
        case "PRESERVED":
          preservedCount++;
          break;
        case "DROPPED":
          droppedCount++;
          if (req.isNegative) droppedNegativeConstraints++;
          break;
        case "WEAKENED":
          weakenedCount++;
          break;
        case "CONTRADICTED":
          contradictedCount++;
          if (req.isNegative) droppedNegativeConstraints++;
          break;
        case "UNCERTAIN":
          droppedCount++;
          break;
      }
    }

    const totalRequirements = requirements.length;
    let fidelityScore = 1.0;
    if (totalRequirements > 0) {
      const rawScore =
        (preservedCount * 1.0 + weakenedCount * 0.5 - droppedCount * 0.8 - contradictedCount * 1.2) /
        totalRequirements;
      fidelityScore = Math.max(0.0, Math.min(1.0, Math.round(rawScore * 100) / 100));
    }

    // Critical defects if any negative constraint dropped or contradicted, or fidelity < 0.85
    const criticalDefectsDetected = droppedNegativeConstraints > 0 || contradictedCount > 0;
    const passed = !criticalDefectsDetected && fidelityScore >= 0.80;

    // Generate restoration suggestion
    const missingItems = findings
      .filter((f) => f.state === "DROPPED" || f.state === "CONTRADICTED" || f.state === "WEAKENED")
      .map((f) => f.requirement);

    const reconstructedRules = missingItems.map((r) =>
      r.isNegative
        ? `[CRITICAL_BOUNDARY] ${r.originalText}`
        : `[MANDATORY_REQUIREMENT] ${r.originalText}`
    );

    const patchBlock =
      reconstructedRules.length > 0
        ? `\n\n<restored_intent_safeguards>\n${reconstructedRules.join("\n")}\n</restored_intent_safeguards>`
        : "";

    return {
      timestamp: new Date().toISOString(),
      sourceIntentHash: this.hashString(JSON.stringify(requirements)),
      synthesizedPromptHash: this.hashString(synthesizedPrompt),
      totalRequirements,
      preservedCount,
      droppedCount,
      weakenedCount,
      contradictedCount,
      droppedNegativeConstraints,
      fidelityScore,
      passed,
      criticalDefectsDetected,
      findings,
      restorationSuggestion: {
        recommendedAction: passed
          ? "Intent preserved with high fidelity. No remediation needed."
          : `Remediate ${missingItems.length} dropped/contradicted requirements immediately before execution.`,
        restoredPrompt: synthesizedPrompt + patchBlock,
        reconstructedRules,
      },
    };
  }

  private evaluateSingleRequirement(
    req: ExtractedRequirement,
    lowerPrompt: string
  ): IntentLossFinding {
    if (req.isNegative) {
      return this.evaluateNegativeConstraint(req, lowerPrompt);
    } else {
      return this.evaluatePositiveRequirement(req, lowerPrompt);
    }
  }

  private evaluateNegativeConstraint(
    req: ExtractedRequirement,
    lowerPrompt: string
  ): IntentLossFinding {
    // Check if the prompt explicitly articulates the prohibition
    const negMarkers = ["must not", "never", "do not", "don't", "cannot", "forbidden", "prohibited", "avoid", "no ", "without"];
    
    // Check key forbidden concepts
    const forbiddenTargetWords = req.forbiddenKeywords.filter(
      (w) => !["must", "not", "never", "don", "t", "do", "forbidden", "avoid"].includes(w)
    );

    // Is there an active prohibition clause mentioning the target words?
    let prohibitionFound = false;
    let explicitViolationFound = false;

    for (const marker of negMarkers) {
      if (lowerPrompt.includes(marker)) {
        const clauses = lowerPrompt.split(/[\n.;]/);
        for (const c of clauses) {
          if (c.includes(marker) && forbiddenTargetWords.some((w) => c.includes(w))) {
            prohibitionFound = true;
            break;
          }
        }
      }
    }

    // Check for explicit contradiction (e.g. user said "must not use eval", prompt says "use eval to execute")
    const permissiveMarkers = ["use ", "import ", "include ", "enable ", "call ", "allow "];
    for (const pMarker of permissiveMarkers) {
      const clauses = lowerPrompt.split(/[\n.;]/);
      for (const c of clauses) {
        if (c.includes(pMarker) && forbiddenTargetWords.some((w) => c.includes(w)) && !negMarkers.some((m) => c.includes(m))) {
          explicitViolationFound = true;
          break;
        }
      }
    }

    if (explicitViolationFound) {
      return {
        requirementId: req.id,
        requirement: req,
        state: "CONTRADICTED",
        severity: "CRITICAL_INTENT_LOSS",
        confidence: 0.98,
        evidenceExcerpt: `Negative constraint contradicted: prompt permits or encourages prohibited behavior [${req.originalText}].`,
        explanation: `User explicitly forbade [${req.originalText}], but the output actively specifies or authorizes it.`,
        remediationPromptPatch: `STRICT PROHIBITION: Never under any circumstances ${req.originalText.replace(/^(must not|never|do not)\s+/i, "")}.`,
      };
    }

    if (prohibitionFound) {
      return {
        requirementId: req.id,
        requirement: req,
        state: "PRESERVED",
        severity: "ZERO_LOSS",
        confidence: 0.95,
        evidenceExcerpt: `Negative constraint verified present in generated prompt.`,
        explanation: `Prohibition against [${forbiddenTargetWords.join(", ")}] is preserved.`,
        remediationPromptPatch: "",
      };
    }

    // If prohibition was not found in synthesized prompt, the negative constraint was DROPPED!
    return {
      requirementId: req.id,
      requirement: req,
      state: "DROPPED",
      severity: "HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT",
      confidence: 0.92,
      evidenceExcerpt: `Negative constraint dropped: no prohibition against [${req.originalText}] appears in the output prompt.`,
      explanation: `User explicitly required [${req.originalText}], but this safeguard was lost during prompt generation/synthesis.`,
      remediationPromptPatch: `MANDATORY BOUNDARY: Do not ${req.originalText.replace(/^(must not|never|do not)\s+/i, "")}.`,
    };
  }

  private evaluatePositiveRequirement(
    req: ExtractedRequirement,
    lowerPrompt: string
  ): IntentLossFinding {
    const targetWords = req.requiredKeywords.filter(
      (w) => w.length > 3 && !["must", "shall", "always", "require", "ensure", "should"].includes(w)
    );

    if (targetWords.length === 0) {
      return {
        requirementId: req.id,
        requirement: req,
        state: "PRESERVED",
        severity: "ZERO_LOSS",
        confidence: 0.85,
        evidenceExcerpt: "General requirement matched.",
        explanation: "Requirement matched base prompt structure.",
        remediationPromptPatch: "",
      };
    }

    const matchedWords = targetWords.filter((w) => lowerPrompt.includes(w));
    const matchRatio = matchedWords.length / targetWords.length;

    // Check for weakening (e.g. user said "must", prompt says "optionally" or "if you like")
    const weakeningMarkers = ["optional", "if preferred", "consider", "you may optionally", "not strictly required"];
    const isWeakened = weakeningMarkers.some((wm) => {
      const clauses = lowerPrompt.split(/[\n.;]/);
      return clauses.some((c) => c.includes(wm) && matchedWords.some((w) => c.includes(w)));
    });

    if (isWeakened) {
      return {
        requirementId: req.id,
        requirement: req,
        state: "WEAKENED",
        severity: "MODERATE_OPTIONAL_DEGRADATION",
        confidence: 0.88,
        evidenceExcerpt: `Requirement softened: [${req.originalText}] was demoted from mandatory to optional.`,
        explanation: `User mandated [${req.originalText}], but output treated it as an optional recommendation.`,
        remediationPromptPatch: `MANDATORY INSTRUCTION: You must strictly adhere to: ${req.originalText}.`,
      };
    }

    if (matchRatio >= 0.5) {
      return {
        requirementId: req.id,
        requirement: req,
        state: "PRESERVED",
        severity: "ZERO_LOSS",
        confidence: 0.90 + matchRatio * 0.1,
        evidenceExcerpt: `Matched concepts: ${matchedWords.join(", ")}`,
        explanation: `Requirement [${req.originalText}] preserved in prompt.`,
        remediationPromptPatch: "",
      };
    }

    return {
      requirementId: req.id,
      requirement: req,
      state: "DROPPED",
      severity: req.criticality === "CRITICAL" ? "CRITICAL_INTENT_LOSS" : "MODERATE_OPTIONAL_DEGRADATION",
      confidence: 0.86,
      evidenceExcerpt: `Missing required concepts: ${targetWords.filter((w) => !matchedWords.includes(w)).join(", ")}`,
      explanation: `Requirement [${req.originalText}] was completely dropped during prompt generation.`,
      remediationPromptPatch: `MANDATORY REQUIREMENT: ${req.originalText}.`,
    };
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16).padStart(8, "0")}`;
  }
}
