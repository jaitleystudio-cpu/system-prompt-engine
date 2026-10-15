/**
 * SPE Ω — Sealed Registry Transition & Source Poisoning Firewall
 * Model Intelligence Fortress — Layer 01, 03, 10 & 11
 *
 * Epistemic Foundations:
 * - TUF (The Update Framework): Atomic registry publication, rollback resistance, monotonic versioning.
 * - USENIX Security 2026 AttriGuard: Defeating indirect prompt injection in provider descriptions and metadata.
 * - Non-negotiable Invariants:
 *   - SOURCE TEXT ≠ AUTHORITY: Release notes and provider descriptions cannot issue commands or alter approval policies.
 *   - ABSENCE ≠ RETIREMENT: A model temporarily absent from an API response must not be silently deleted.
 *   - SIGNED ≠ TRUE: Signatures authenticate the publisher, not the factual accuracy of upstream claims.
 */

import type { AiModelEntry, ModelAtlasRegistry } from "./modelAtlasSchema.ts";
import { computeSha256 } from "../hashUtils.ts";

export interface SanitizationViolation {
  readonly modelId: string;
  readonly field: string;
  readonly pattern: string;
  readonly excerpt: string;
}

export interface TransitionAuditReport {
  readonly isValid: boolean;
  readonly previousVersion: string;
  readonly candidateVersion: string;
  readonly totalModels: number;
  readonly frontierModelsCount: number;
  readonly newlyAddedModelIds: readonly string[];
  readonly retiredModelIds: readonly string[];
  readonly unconfirmedAbsenceModelIds: readonly string[];
  readonly sanitizationViolations: readonly SanitizationViolation[];
  readonly integrityHash: string;
  readonly rejectionReason?: string;
}

// Hostile patterns disallowed in provider descriptions or metadata (USENIX 2026 AttriGuard)
const DISALLOWED_METADATA_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /system\s+instruction\s*:/i,
  /<script[\s>]/i,
  /javascript\s*:/i,
  /\b(exec|eval|system|subprocess|child_process)\s*\(/i,
  /\bcurl\s+.*\b(bash|sh)\b/i,
  /[\u200B-\u200D\u202E\uFEFF]/, // Zero-width spaces and bidirectional override attacks
];

/**
 * Scans a candidate model entry for potential prompt injection or source poisoning.
 * Enforces: SOURCE TEXT ≠ AUTHORITY.
 */
export function sanitizeModelEntry(model: AiModelEntry): SanitizationViolation[] {
  const violations: SanitizationViolation[] = [];
  const fieldsToScan: Array<{ field: string; value: string }> = [
    { field: "description", value: model.description || "" },
    { field: "name", value: model.name || "" },
    { field: "id", value: model.id || "" },
    { field: "dialectTemplateKey", value: model.dialectTemplateKey || "" },
  ];

  for (const { field, value } of fieldsToScan) {
    for (const pattern of DISALLOWED_METADATA_PATTERNS) {
      if (pattern.test(value)) {
        violations.push({
          modelId: model.id,
          field,
          pattern: pattern.toString(),
          excerpt: value.slice(0, 80),
        });
      }
    }
  }

  return violations;
}

/**
 * Validates and seals an atomic transition from an existing registry to a candidate registry.
 */
export function validateAndSealRegistryTransition(
  currentRegistry: ModelAtlasRegistry,
  candidateRegistry: ModelAtlasRegistry,
  options: { allowRetirements?: boolean } = {}
): TransitionAuditReport {
  // 1. Version Monotonicity Check (TUF Replay & Rollback Defense)
  const currentVer = parseFloat(currentRegistry.version) || 1.0;
  const candidateVer = parseFloat(candidateRegistry.version) || 1.0;

  if (candidateVer <= currentVer && candidateRegistry.version !== currentRegistry.version) {
    return {
      isValid: false,
      previousVersion: currentRegistry.version,
      candidateVersion: candidateRegistry.version,
      totalModels: candidateRegistry.models.length,
      frontierModelsCount: 0,
      newlyAddedModelIds: [],
      retiredModelIds: [],
      unconfirmedAbsenceModelIds: [],
      sanitizationViolations: [],
      integrityHash: "",
      rejectionReason: `Version rollback detected. Current version ${currentRegistry.version} >= candidate ${candidateRegistry.version}.`,
    };
  }

  // 2. Source Poisoning Sanitization across all candidate models
  const allViolations: SanitizationViolation[] = [];
  for (const model of candidateRegistry.models) {
    const violations = sanitizeModelEntry(model);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    return {
      isValid: false,
      previousVersion: currentRegistry.version,
      candidateVersion: candidateRegistry.version,
      totalModels: candidateRegistry.models.length,
      frontierModelsCount: 0,
      newlyAddedModelIds: [],
      retiredModelIds: [],
      unconfirmedAbsenceModelIds: [],
      sanitizationViolations: allViolations,
      integrityHash: "",
      rejectionReason: `Source poisoning / injection attempt detected in ${allViolations.length} field(s). Violates SOURCE TEXT ≠ AUTHORITY.`,
    };
  }

  // 3. Diff tracking: New models vs Absences
  const currentIds = new Set(currentRegistry.models.map((m) => m.id));
  const candidateIds = new Set(candidateRegistry.models.map((m) => m.id));

  const newlyAddedModelIds = candidateRegistry.models
    .filter((m) => !currentIds.has(m.id))
    .map((m) => m.id);

  const missingFromCandidate = currentRegistry.models.filter(
    (m) => !candidateIds.has(m.id) && !m.isLegacy
  );

  // Invariant: ABSENCE ≠ RETIREMENT
  // A previously qualified model that is missing from candidate without explicit retirement flag is flagged.
  const unconfirmedAbsences = missingFromCandidate.map((m) => m.id);
  if (unconfirmedAbsences.length > 0 && !options.allowRetirements) {
    return {
      isValid: false,
      previousVersion: currentRegistry.version,
      candidateVersion: candidateRegistry.version,
      totalModels: candidateRegistry.models.length,
      frontierModelsCount: candidateRegistry.models.filter((m) => !m.isLegacy).length,
      newlyAddedModelIds,
      retiredModelIds: [],
      unconfirmedAbsenceModelIds: unconfirmedAbsences,
      sanitizationViolations: [],
      integrityHash: "",
      rejectionReason: `Models unexpectedly missing without formal supersession: [${unconfirmedAbsences.join(", ")}]. Violates ABSENCE ≠ RETIREMENT.`,
    };
  }

  // 4. Compute sealed integrity hash over canonical models list
  const activeFrontier = candidateRegistry.models.filter(
    (m) => !m.isLegacy && m.generation === "2026-frontier"
  );

  const sortedForHash = [...candidateRegistry.models].sort((a, b) => a.id.localeCompare(b.id));
  const canonicalString = JSON.stringify(sortedForHash);
  const integrityHash = computeSha256(canonicalString);

  return {
    isValid: true,
    previousVersion: currentRegistry.version,
    candidateVersion: candidateRegistry.version,
    totalModels: candidateRegistry.models.length,
    frontierModelsCount: activeFrontier.length,
    newlyAddedModelIds,
    retiredModelIds: candidateRegistry.models.filter((m) => m.isLegacy).map((m) => m.id),
    unconfirmedAbsenceModelIds: [],
    sanitizationViolations: [],
    integrityHash,
  };
}
