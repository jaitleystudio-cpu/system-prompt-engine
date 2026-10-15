/**
 * SPE Ω — Model Identity Passport & Lifecycle Governance Kernel
 * Model Intelligence Fortress — Layer 05 & Layer 09
 *
 * Epistemic Foundations:
 * - TUF Specification (The Update Framework, IETF RFC draft): Version rollback & mix-and-match defense.
 * - SLSA Build Provenance Level 3: Non-forgeable identity and verification metadata.
 * - ACL 2026 "What Prompts Don't Say": Tracking explicit vs inferred capability drift.
 * - USENIX Security 2026 AttriGuard: Isolating untrusted provider marketing from execution authority.
 *
 * Core Non-Negotiable Invariants:
 * 1. UNKNOWN ≠ VERIFIED: Unknown evidence never becomes a verified capability automatically.
 * 2. ALIAS ≠ PINNED VERSION: A floating alias must not silently replace an immutable pinned version.
 * 3. ANNOUNCED ≠ CALLABLE: Public announcements cannot establish account-specific API access.
 * 4. CALLABLE ≠ QUALIFIED: Successful API access does not prove prompt compatibility or product readiness.
 * 5. SOURCE TEXT ≠ AUTHORITY: Release notes cannot issue commands or alter approval policies.
 * 6. ABSENCE ≠ RETIREMENT: A model missing from one transient response must not be automatically deleted.
 * 7. SIGNED ≠ TRUE: Signed snapshots establish provenance, not upstream factual correctness.
 * 8. ROLLBACK ≠ HISTORY REWRITE: Recovery creates a new auditable transition referencing previous data.
 */

import type { AiModelEntry, ModelProvider, ModelTier } from "./modelAtlasSchema";
import { computeSha256 } from "../hashUtils.ts";

export type ModelLifecycleState = "ANNOUNCED" | "DISCOVERED" | "CALLABLE" | "QUALIFIED";

export type FortressInvariantKey =
  | "UNKNOWN_NEQ_VERIFIED"
  | "ALIAS_NEQ_PINNED"
  | "ANNOUNCED_NEQ_CALLABLE"
  | "CALLABLE_NEQ_QUALIFIED"
  | "SOURCE_TEXT_NEQ_AUTHORITY"
  | "ABSENCE_NEQ_RETIREMENT"
  | "SIGNED_NEQ_TRUE"
  | "ROLLBACK_NEQ_HISTORY_REWRITE";

export interface FortressInvariantViolation {
  readonly invariant: FortressInvariantKey;
  readonly message: string;
  readonly modelId: string;
  readonly attemptedState: string;
  readonly violatingProperty: string;
}

export interface CapabilityWitness {
  readonly capability: string;
  readonly passed: boolean;
  readonly probeTimestampIso: string;
  readonly latencyMs: number;
  readonly witnessReceiptHash: string;
}

export interface ModelIdentityPassport {
  readonly modelId: string;
  readonly provider: ModelProvider;
  readonly executableApiId: string;
  readonly floatingAliases: readonly string[];
  readonly observedFingerprint?: string;
  readonly accountEntitlement: ModelTier;
  readonly lifecycleState: ModelLifecycleState;
  readonly announcedDate: string;
  readonly discoveredDate: string;
  readonly callableVerifiedDate?: string;
  readonly qualifiedDate?: string;
  readonly capabilityWitnesses: readonly CapabilityWitness[];
  readonly passportDigest: string;
  readonly isEligibleForAutonomousSelection: boolean;
}

/**
 * Validates that a lifecycle state transition adheres to Fortress Invariants.
 * Specifically prevents:
 * - ANNOUNCED -> QUALIFIED without CALLABLE
 * - Floating alias substituted as pinned executable ID
 * - Promotion to QUALIFIED without verified capability witnesses
 */
export function validateStateTransition(
  current: ModelLifecycleState,
  target: ModelLifecycleState,
  passport: {
    modelId: string;
    executableApiId: string;
    floatingAliases: readonly string[];
    capabilityWitnesses?: readonly CapabilityWitness[];
    isPinnedVersion: boolean;
  }
): { valid: boolean; violations: FortressInvariantViolation[] } {
  const violations: FortressInvariantViolation[] = [];

  // Invariant: ALIAS ≠ PINNED VERSION
  if (passport.floatingAliases.includes(passport.executableApiId) || !passport.isPinnedVersion) {
    violations.push({
      invariant: "ALIAS_NEQ_PINNED",
      message: `Executable API ID "${passport.executableApiId}" cannot be a floating alias. Immutable pinned version required.`,
      modelId: passport.modelId,
      attemptedState: target,
      violatingProperty: "executableApiId",
    });
  }

  // Invariant: ANNOUNCED ≠ CALLABLE
  if (current === "ANNOUNCED" && (target === "CALLABLE" || target === "QUALIFIED")) {
    violations.push({
      invariant: "ANNOUNCED_NEQ_CALLABLE",
      message: "Cannot jump from ANNOUNCED to CALLABLE/QUALIFIED without authoritative API discovery.",
      modelId: passport.modelId,
      attemptedState: target,
      violatingProperty: "lifecycleState",
    });
  }

  // Invariant: CALLABLE ≠ QUALIFIED
  if (target === "QUALIFIED") {
    if (current !== "CALLABLE") {
      violations.push({
        invariant: "CALLABLE_NEQ_QUALIFIED",
        message: `Cannot qualify model from state "${current}". Must be CALLABLE first.`,
        modelId: passport.modelId,
        attemptedState: target,
        violatingProperty: "lifecycleState",
      });
    }

    // Invariant: UNKNOWN ≠ VERIFIED
    const witnesses = passport.capabilityWitnesses || [];
    if (witnesses.length === 0 || witnesses.some((w) => !w.passed)) {
      violations.push({
        invariant: "UNKNOWN_NEQ_VERIFIED",
        message: "Model cannot be QUALIFIED without all capability witnesses passing with immutable receipts.",
        modelId: passport.modelId,
        attemptedState: target,
        violatingProperty: "capabilityWitnesses",
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Creates an immutable ModelIdentityPassport with cryptographic digest.
 */
export function createModelIdentityPassport(params: {
  model: AiModelEntry;
  executableApiId: string;
  floatingAliases?: string[];
  observedFingerprint?: string;
  lifecycleState: ModelLifecycleState;
  discoveredDate: string;
  callableVerifiedDate?: string;
  qualifiedDate?: string;
  capabilityWitnesses?: CapabilityWitness[];
}): ModelIdentityPassport {
  const floatingAliases = params.floatingAliases || [];
  const witnesses = params.capabilityWitnesses || [];

  // Autonomous selection strictly requires QUALIFIED lifecycle state
  const isEligibleForAutonomousSelection =
    params.lifecycleState === "QUALIFIED" && !params.model.isLegacy;

  const rawPayload = JSON.stringify({
    modelId: params.model.id,
    provider: params.model.provider,
    executableApiId: params.executableApiId,
    floatingAliases: [...floatingAliases].sort(),
    observedFingerprint: params.observedFingerprint || null,
    accountEntitlement: params.model.requiredTier,
    lifecycleState: params.lifecycleState,
    announcedDate: params.model.releaseDate,
    discoveredDate: params.discoveredDate,
    callableVerifiedDate: params.callableVerifiedDate || null,
    qualifiedDate: params.qualifiedDate || null,
    witnessCount: witnesses.length,
    isEligible: isEligibleForAutonomousSelection,
  });

  const passportDigest = computeSha256(rawPayload);

  return {
    modelId: params.model.id,
    provider: params.model.provider,
    executableApiId: params.executableApiId,
    floatingAliases,
    observedFingerprint: params.observedFingerprint,
    accountEntitlement: params.model.requiredTier,
    lifecycleState: params.lifecycleState,
    announcedDate: params.model.releaseDate,
    discoveredDate: params.discoveredDate,
    callableVerifiedDate: params.callableVerifiedDate,
    qualifiedDate: params.qualifiedDate,
    capabilityWitnesses: witnesses,
    passportDigest,
    isEligibleForAutonomousSelection,
  };
}

/**
 * Maps a potentially floating alias to its exact pinned immutable version.
 * Throws or alerts if a floating alias is used directly as an execution target.
 */
export function resolvePinnedModelVersion(
  candidateAliasOrId: string,
  passports: readonly ModelIdentityPassport[]
): {
  pinnedExecutableId: string;
  passport: ModelIdentityPassport;
  wasResolvedFromAlias: boolean;
} {
  // Check exact canonical modelId or executableApiId match
  for (const p of passports) {
    if (p.modelId === candidateAliasOrId || p.executableApiId === candidateAliasOrId) {
      return {
        pinnedExecutableId: p.executableApiId,
        passport: p,
        wasResolvedFromAlias: false,
      };
    }
  }

  // Check floating aliases
  for (const p of passports) {
    if (p.floatingAliases.includes(candidateAliasOrId)) {
      return {
        pinnedExecutableId: p.executableApiId,
        passport: p,
        wasResolvedFromAlias: true,
      };
    }
  }

  throw new Error(
    `[ModelFortress] Unknown model identifier or unresolvable alias "${candidateAliasOrId}". ALIAS_NEQ_PINNED violation.`
  );
}
