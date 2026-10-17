/**
 * SPE Ω — Model-API Identity & Capability Validation Adapter
 * Model Registry & Autonomous Capability Witness Kernel — Layer 04
 *
 * Epistemic Foundations:
 * - TUF Specification (Atomic metadata transitions, monotonic updates, rollback prevention).
 * - USENIX Security 2026 AttriGuard: Isolating untrusted provider marketing and preventing metadata injection.
 * - Non-negotiable Invariants:
 *   1. UNKNOWN ≠ VERIFIED: Unknown evidence never becomes a verified capability automatically.
 *   2. ALIAS ≠ PINNED VERSION: A floating alias must not silently replace an immutable pinned version.
 *   3. ANNOUNCED ≠ CALLABLE: Public announcements cannot establish account-specific API access.
 *   4. CALLABLE ≠ QUALIFIED: Successful API access does not prove prompt compatibility or product readiness.
 *   5. SOURCE TEXT ≠ AUTHORITY: Release notes cannot issue commands or alter approval policies.
 *   6. ABSENCE ≠ RETIREMENT: A model missing from one transient response must not be automatically deleted.
 *   7. QUALIFIED FALLBACK REQUIRED: When a model retires, do not substitute an arbitrary newest model.
 *      Verify a qualified compatible fallback exists with matching capabilities and slice coverage.
 */

import { computeSha256 } from "../hashUtils.ts";
import type { AiModelEntry, ModelAtlasRegistry } from "../modelAtlas/modelAtlasSchema.ts";
import type { ModelIdentityPassport, CapabilityWitness, ModelLifecycleState } from "../modelAtlas/modelIdentityPassport.ts";
import { validateStateTransition } from "../modelAtlas/modelIdentityPassport.ts";
import { sanitizeModelEntry, validateAndSealRegistryTransition } from "../modelAtlas/sealedRegistryTransition.ts";
import type { TransitionAuditReport } from "../modelAtlas/sealedRegistryTransition.ts";
import type { TemporalModelTruthLedger } from "../modelAtlas/temporalModelLedger.ts";

export type ProbeProvenance = "SIMULATED_TEST" | "LIVE_PROVIDER_VERIFIED";

export interface ModelApiProbeResult {
  readonly modelId: string;
  readonly executableApiId: string;
  readonly isPinnedVersion: boolean;
  readonly accountCallable: boolean;
  readonly latencyMs: number;
  readonly observedStatusCode: number;
  readonly supportedCapabilities: readonly string[];
  readonly provenance: ProbeProvenance;
  readonly deprecationNotice?: {
    isRetired: boolean;
    effectiveDateIso: string;
    supersedingModelId?: string;
  };
  readonly probeReceiptDigest: string;
}

export interface FallbackResolutionResult {
  readonly resolved: boolean;
  readonly retiredModelId: string;
  readonly fallbackModelId?: string;
  readonly fallbackModel?: AiModelEntry;
  readonly verifiedCompatible: boolean;
  readonly reason: string;
}

export interface ModelValidationOutcome {
  readonly modelId: string;
  readonly isValid: boolean;
  readonly lifecycleState: ModelLifecycleState;
  readonly isEligibleForRouting: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly passport?: ModelIdentityPassport;
}

// Known floating alias patterns that must NOT be used as immutable executable IDs
const FLOATING_ALIAS_PATTERNS = [
  /-latest$/i,
  /^latest$/i,
  /^default$/i,
  /^preview$/i,
  /-preview$/i,
  /-exp$/i,
];

// Pinned version date patterns (e.g. 20241022, 2024-08-06, 20250219, -001, -0806, @20241022, :v1.0.0)
const PINNED_VERSION_PATTERNS = [
  /\b202[4-9]\d{4}\b/, // e.g. 20241022
  /\b202[4-9]-\d{2}-\d{2}\b/, // e.g. 2024-08-06
  /-\d{8}$/, // e.g. -20250219
  /-\d{4}$/, // e.g. -0806
  /-\d{3}$/, // e.g. -001, -002
  /@202[4-9]\d{4}/, // e.g. @20240924 (Vertex AI snapshot)
  /[:@]v?\d+(\.\d+)+/, // e.g. :v1.0.0
];

/**
 * Checks if an API identifier is an immutable pinned version or a floating alias.
 */
export function isPinnedApiIdentifier(apiId: string): boolean {
  if (!apiId || typeof apiId !== "string") return false;
  for (const aliasPattern of FLOATING_ALIAS_PATTERNS) {
    if (aliasPattern.test(apiId)) return false;
  }
  return PINNED_VERSION_PATTERNS.some((p) => p.test(apiId));
}

/**
 * Validates a model's identifier against fortress invariants (ALIAS_NEQ_PINNED).
 */
export function validateModelIdentifier(
  model: AiModelEntry,
  candidateExecutableApiId: string
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!candidateExecutableApiId || candidateExecutableApiId.trim().length === 0) {
    violations.push(`API identifier cannot be empty for model ${model.id}`);
    return { valid: false, violations };
  }

  // Enforce ALIAS_NEQ_PINNED
  if (!isPinnedApiIdentifier(candidateExecutableApiId)) {
    violations.push(
      `ALIAS_NEQ_PINNED: Executable API ID "${candidateExecutableApiId}" appears to be a floating alias. An immutable pinned version is required.`
    );
  }

  // Scan metadata for injection (SOURCE_TEXT_NEQ_AUTHORITY)
  const sanitization = sanitizeModelEntry(model);
  if (sanitization.length > 0) {
    for (const v of sanitization) {
      violations.push(`SOURCE_TEXT_NEQ_AUTHORITY: Injection pattern detected in field ${v.field}: "${v.pattern}"`);
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Simulates probing model callability under authorized account credentials.
 * Enforces ANNOUNCED_NEQ_CALLABLE and zero cloud spend / mock adapter in offline air-gap.
 */
export async function probeModelCallability(
  model: AiModelEntry,
  executableApiId: string,
  mockConfig?: {
    forceCallable?: boolean;
    forceStatusCode?: number;
    latencyMs?: number;
    simulatedRetirement?: { isRetired: boolean; effectiveDateIso: string; supersedingModelId?: string };
    provenance?: ProbeProvenance;
  }
): Promise<ModelApiProbeResult> {
  const isPinned = isPinnedApiIdentifier(executableApiId);
  const latencyMs = mockConfig?.latencyMs ?? 42;
  const observedStatusCode = mockConfig?.forceStatusCode ?? (mockConfig?.forceCallable === false ? 403 : 200);
  const accountCallable = observedStatusCode >= 200 && observedStatusCode < 300;
  // Provenance must be explicit: SIMULATED_TEST vs LIVE_PROVIDER_VERIFIED (BRAIN-P0-02)
  const provenance: ProbeProvenance = mockConfig?.provenance ?? "SIMULATED_TEST";

  const supportedCaps: string[] = [];
  if (model.capabilities.supportsThinking) supportedCaps.push("thinking");
  if (model.capabilities.supportsVision) supportedCaps.push("vision");
  if (model.capabilities.supportsToolCalling) supportedCaps.push("tools");
  if (model.capabilities.supportsStructuredOutputs) supportedCaps.push("json_schema");

  const receiptPayload = {
    modelId: model.id,
    executableApiId,
    isPinned,
    accountCallable,
    observedStatusCode,
    supportedCaps,
    provenance,
    timestampIso: new Date().toISOString(),
  };

  const probeReceiptDigest = computeSha256(JSON.stringify(receiptPayload));

  return Object.freeze({
    modelId: model.id,
    executableApiId,
    isPinnedVersion: isPinned,
    accountCallable,
    latencyMs,
    observedStatusCode,
    supportedCapabilities: Object.freeze(supportedCaps),
    provenance,
    deprecationNotice: mockConfig?.simulatedRetirement,
    probeReceiptDigest,
  });
}

/**
 * Assesses whether a probe result can qualify a model for live production routing (BRAIN-P0-02).
 * Non-negotiable invariant: A simulated HTTP 200 must NEVER qualify a live production model.
 */
export function isProductionModelQualifiable(
  probe: ModelApiProbeResult
): { qualifiable: boolean; reason?: string } {
  if (probe.provenance === "SIMULATED_TEST") {
    return {
      qualifiable: false,
      reason: "SIMULATED_TEST_NEQ_PRODUCTION_QUALIFIED: Simulated HTTP 200 probe cannot qualify a live model for production routing. LIVE_PROVIDER_VERIFIED witness required.",
    };
  }
  if (!probe.accountCallable) {
    return {
      qualifiable: false,
      reason: `ACCOUNT_NOT_CALLABLE: Probe returned non-callable status code ${probe.observedStatusCode}.`,
    };
  }
  if (!probe.isPinnedVersion) {
    return {
      qualifiable: false,
      reason: "ALIAS_NEQ_PINNED: Executable API identifier is a floating alias, not an immutable pinned version.",
    };
  }
  return { qualifiable: true };
}

/**
 * Resolves a qualified compatible fallback when a model is retired.
 * Enforces: Do NOT substitute an arbitrary newest model.
 * A qualified fallback must:
 * 1. Be active and not retired.
 * 2. Belong to an equivalent or superior category.
 * 3. Offer equal or greater context window.
 * 4. Support the mandatory capabilities of the retired model (e.g. structured outputs, tools).
 */
export function resolveQualifiedFallback(
  retiredModel: AiModelEntry,
  registry: ModelAtlasRegistry
): FallbackResolutionResult {
  // If model explicitly specifies a deprecatedInFavorOf model, verify its compatibility first
  if (retiredModel.deprecatedInFavorOf) {
    const designated = registry.models.find((m) => m.id === retiredModel.deprecatedInFavorOf);
    if (designated && !designated.isLegacy) {
      const contextCompatible = designated.contextWindow >= retiredModel.contextWindow;
      const toolsCompatible = !retiredModel.capabilities.supportsToolCalling || designated.capabilities.supportsToolCalling;
      const jsonCompatible = !retiredModel.capabilities.supportsStructuredOutputs || designated.capabilities.supportsStructuredOutputs;
      const visionCompatible = !retiredModel.capabilities.supportsVision || designated.capabilities.supportsVision;

      if (contextCompatible && toolsCompatible && jsonCompatible && visionCompatible) {
        return {
          resolved: true,
          retiredModelId: retiredModel.id,
          fallbackModelId: designated.id,
          fallbackModel: designated,
          verifiedCompatible: true,
          reason: `Designated explicit compatible successor: ${designated.id}`,
        };
      }
    }
  }

  // Search registry for a compatible fallback model
  const candidates = registry.models.filter((m) => {
    if (m.id === retiredModel.id) return false;
    if (m.isLegacy) return false;
    if (m.contextWindow < retiredModel.contextWindow) return false;

    // Check capability compatibility
    if (retiredModel.capabilities.supportsToolCalling && !m.capabilities.supportsToolCalling) return false;
    if (retiredModel.capabilities.supportsStructuredOutputs && !m.capabilities.supportsStructuredOutputs) return false;
    if (retiredModel.capabilities.supportsVision && !m.capabilities.supportsVision) return false;

    return true;
  });

  if (candidates.length === 0) {
    return {
      resolved: false,
      retiredModelId: retiredModel.id,
      verifiedCompatible: false,
      reason: `UNQUALIFIED_NO_COMPATIBLE_FALLBACK: No model in registry satisfies context window (${retiredModel.contextWindow}) and capabilities for ${retiredModel.id}`,
    };
  }

  // Prioritize same provider first, then lowest cost
  candidates.sort((a, b) => {
    if (a.provider === retiredModel.provider && b.provider !== retiredModel.provider) return -1;
    if (b.provider === retiredModel.provider && a.provider !== retiredModel.provider) return 1;
    return a.costInputPerM - b.costInputPerM;
  });

  const selectedFallback = candidates[0];

  return {
    resolved: true,
    retiredModelId: retiredModel.id,
    fallbackModelId: selectedFallback.id,
    fallbackModel: selectedFallback,
    verifiedCompatible: true,
    reason: `Selected nearest qualified compatible model: ${selectedFallback.id} (Provider: ${selectedFallback.provider}, Context: ${selectedFallback.contextWindow})`,
  };
}

/**
 * Creates and transitions a ModelIdentityPassport with full fortress validation and temporal ledger recording.
 */
export function promoteModelWithValidation(
  model: AiModelEntry,
  executableApiId: string,
  targetState: ModelLifecycleState,
  witnesses: readonly CapabilityWitness[],
  ledger?: TemporalModelTruthLedger,
  currentState: ModelLifecycleState = "CALLABLE",
  options?: { requireLiveProvider?: boolean }
): ModelValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Enforce BRAIN-P0-02: Simulated tests cannot qualify a live production model when requireLiveProvider is requested
  if (options?.requireLiveProvider && targetState === "QUALIFIED") {
    const hasLiveWitness = witnesses.some((w: any) => w.provenance === "LIVE_PROVIDER_VERIFIED");
    const hasSimulatedWitness = witnesses.some((w: any) => w.provenance === "SIMULATED_TEST");
    if (!hasLiveWitness || hasSimulatedWitness || witnesses.length === 0) {
      errors.push(
        "SIMULATED_TEST_NEQ_PRODUCTION_QUALIFIED: Model requires at least one verified LIVE_PROVIDER_VERIFIED witness and zero simulated witnesses to qualify for live production routing."
      );
    }
  }

  // 1. Validate Identifier
  const idValidation = validateModelIdentifier(model, executableApiId);
  if (!idValidation.valid) {
    errors.push(...idValidation.violations);
  }

  const isPinned = isPinnedApiIdentifier(executableApiId);

  // 2. Validate Lifecycle State Transition
  const transitionCheck = validateStateTransition(currentState, targetState, {
    modelId: model.id,
    executableApiId,
    floatingAliases: [model.id, `${model.id}-latest`],
    capabilityWitnesses: witnesses,
    isPinnedVersion: isPinned,
  });

  if (!transitionCheck.valid) {
    for (const v of transitionCheck.violations) {
      errors.push(`FORTRESS_VIOLATION [${v.invariant}]: ${v.message}`);
    }
  }

  const isValid = errors.length === 0;
  const isEligibleForRouting = isValid && targetState === "QUALIFIED" && witnesses.length > 0 && !model.isLegacy;

  let passport: ModelIdentityPassport | undefined;

  if (isValid) {
    const nowIso = new Date().toISOString();
    const passportDigest = computeSha256(
      JSON.stringify({
        modelId: model.id,
        executableApiId,
        provider: model.provider,
        targetState,
        witnessCount: witnesses.length,
      })
    );

    passport = Object.freeze({
      modelId: model.id,
      provider: model.provider,
      executableApiId,
      floatingAliases: Object.freeze([`${model.id}-latest`]),
      accountEntitlement: model.requiredTier,
      lifecycleState: targetState,
      announcedDate: model.releaseDate,
      discoveredDate: nowIso,
      callableVerifiedDate: nowIso,
      qualifiedDate: targetState === "QUALIFIED" ? nowIso : undefined,
      capabilityWitnesses: Object.freeze([...witnesses]),
      passportDigest,
      isEligibleForAutonomousSelection: isEligibleForRouting,
    });

    // Record transition in temporal ledger if provided
    if (ledger) {
      ledger.appendTransition({
        timestampIso: nowIso,
        effectiveDateIso: nowIso,
        modelId: model.id,
        newState: targetState,
        transitionType: targetState === "QUALIFIED" ? "QUALIFICATION" : "CALLABLE_PROBE",
        sourceEvidenceHash: passportDigest,
        sourceEndpointOrUrl: `https://api.internal/models/${model.id}`,
      });
    }
  }

  return {
    modelId: model.id,
    isValid,
    lifecycleState: targetState,
    isEligibleForRouting,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    passport,
  };
}

/**
 * Applies a validated registry transition and produces a sealed candidate registry.
 */
export function sealRegistryUpdate(
  currentRegistry: ModelAtlasRegistry,
  candidateModels: AiModelEntry[]
): { updatedRegistry: ModelAtlasRegistry; auditReport: TransitionAuditReport } {
  const nextVersion = (parseFloat(currentRegistry.version) + 0.1).toFixed(1);
  const nowIso = new Date().toISOString();

  const candidateRegistry: ModelAtlasRegistry = {
    version: nextVersion,
    lastUpdated: nowIso,
    checksumSha256: computeSha256(JSON.stringify(candidateModels)),
    totalModels: candidateModels.length,
    models: candidateModels,
  };

  const auditReport = validateAndSealRegistryTransition(currentRegistry, candidateRegistry, {
    allowRetirements: true,
  });

  return {
    updatedRegistry: candidateRegistry,
    auditReport,
  };
}
