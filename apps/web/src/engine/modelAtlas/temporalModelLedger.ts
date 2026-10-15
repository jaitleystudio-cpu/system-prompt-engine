/**
 * SPE Ω — Temporal Model Truth Ledger
 * Model Intelligence Fortress — Layer 04 (Temporal Claim Ledger)
 *
 * Epistemic Foundations:
 * - TUF (The Update Framework): Monotonic timestamp and snapshot protections preventing freeze/rollback attacks.
 * - Bitcoin / Git Directed Acyclic Graphs: Cryptographic hash-chained append-only log.
 * - Non-negotiable Invariant: ROLLBACK ≠ HISTORY REWRITE.
 *   Rollback MUST create a new auditable transition referencing previous verified data.
 *   Never truncate or mutate historical records.
 */

import { computeSha256 } from "../hashUtils.ts";
import type { ModelLifecycleState } from "./modelIdentityPassport.ts";

export interface TemporalLedgerEntry {
  readonly entryIndex: number;
  readonly timestampIso: string;
  readonly effectiveDateIso: string;
  readonly modelId: string;
  readonly previousState: ModelLifecycleState | "UNREGISTERED";
  readonly newState: ModelLifecycleState;
  readonly transitionType: "DISCOVERY" | "CALLABLE_PROBE" | "QUALIFICATION" | "DEPRECATION" | "ROLLBACK_SAFEGUARD";
  readonly sourceEvidenceHash: string;
  readonly sourceEndpointOrUrl: string;
  readonly supersedingModelId?: string;
  readonly referencedPriorEntryHash?: string;
  readonly previousEntryHash: string;
  readonly entryHash: string;
}

export interface TemporalLedgerSnapshot {
  readonly genesisHash: string;
  readonly headHash: string;
  readonly totalEntries: number;
  readonly lastUpdatedIso: string;
  readonly entries: readonly TemporalLedgerEntry[];
}

export const GENESIS_LEDGER_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Computes canonical hash for a ledger entry.
 */
function computeEntryHash(
  index: number,
  timestampIso: string,
  effectiveDateIso: string,
  modelId: string,
  previousState: string,
  newState: string,
  transitionType: string,
  sourceEvidenceHash: string,
  sourceEndpointOrUrl: string,
  previousEntryHash: string,
  supersedingModelId?: string,
  referencedPriorEntryHash?: string
): string {
  const payload = JSON.stringify({
    index,
    timestampIso,
    effectiveDateIso,
    modelId,
    previousState,
    newState,
    transitionType,
    sourceEvidenceHash,
    sourceEndpointOrUrl,
    supersedingModelId: supersedingModelId || null,
    referencedPriorEntryHash: referencedPriorEntryHash || null,
    previousEntryHash,
  });
  return computeSha256(payload);
}

/**
 * In-Memory & Serialized Temporal Model Truth Ledger
 */
export class TemporalModelTruthLedger {
  private entries: TemporalLedgerEntry[] = [];

  constructor(initialEntries: readonly TemporalLedgerEntry[] = []) {
    if (initialEntries.length > 0) {
      this.entries = [...initialEntries];
      const valid = this.verifyLedgerIntegrity();
      if (!valid.isValid) {
        throw new Error(`[TemporalModelLedger] Corrupted initial ledger: ${valid.reason}`);
      }
    }
  }

  public getHeadHash(): string {
    if (this.entries.length === 0) return GENESIS_LEDGER_HASH;
    return this.entries[this.entries.length - 1].entryHash;
  }

  public getEntries(): readonly TemporalLedgerEntry[] {
    return Object.freeze([...this.entries]);
  }

  public getLatestEntryForModel(modelId: string): TemporalLedgerEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].modelId === modelId) {
        return this.entries[i];
      }
    }
    return undefined;
  }

  /**
   * Appends an auditable transition to the ledger.
   */
  public appendTransition(params: {
    timestampIso: string;
    effectiveDateIso: string;
    modelId: string;
    newState: ModelLifecycleState;
    transitionType: "DISCOVERY" | "CALLABLE_PROBE" | "QUALIFICATION" | "DEPRECATION" | "ROLLBACK_SAFEGUARD";
    sourceEvidenceHash: string;
    sourceEndpointOrUrl: string;
    supersedingModelId?: string;
    referencedPriorEntryHash?: string;
  }): TemporalLedgerEntry {
    const previousEntry = this.getLatestEntryForModel(params.modelId);
    const previousState = previousEntry ? previousEntry.newState : "UNREGISTERED";
    const previousEntryHash = this.getHeadHash();
    const index = this.entries.length;

    const entryHash = computeEntryHash(
      index,
      params.timestampIso,
      params.effectiveDateIso,
      params.modelId,
      previousState,
      params.newState,
      params.transitionType,
      params.sourceEvidenceHash,
      params.sourceEndpointOrUrl,
      previousEntryHash,
      params.supersedingModelId,
      params.referencedPriorEntryHash
    );

    const newEntry: TemporalLedgerEntry = {
      entryIndex: index,
      timestampIso: params.timestampIso,
      effectiveDateIso: params.effectiveDateIso,
      modelId: params.modelId,
      previousState,
      newState: params.newState,
      transitionType: params.transitionType,
      sourceEvidenceHash: params.sourceEvidenceHash,
      sourceEndpointOrUrl: params.sourceEndpointOrUrl,
      supersedingModelId: params.supersedingModelId,
      referencedPriorEntryHash: params.referencedPriorEntryHash,
      previousEntryHash,
      entryHash,
    };

    this.entries.push(newEntry);
    return newEntry;
  }

  /**
   * Executes a safe rollback adhering to: ROLLBACK ≠ HISTORY REWRITE.
   * Creates a new forward transition restoring the target prior state without truncating history.
   */
  public appendRollback(params: {
    timestampIso: string;
    modelId: string;
    targetPriorEntryHash: string;
    rationale: string;
    sourceEvidenceHash: string;
  }): TemporalLedgerEntry {
    const priorEntry = this.entries.find((e) => e.entryHash === params.targetPriorEntryHash);
    if (!priorEntry) {
      throw new Error(`[TemporalModelLedger] Cannot rollback to nonexistent entry hash: ${params.targetPriorEntryHash}`);
    }

    if (priorEntry.modelId !== params.modelId) {
      throw new Error(`[TemporalModelLedger] Mismatched model ID in rollback target.`);
    }

    return this.appendTransition({
      timestampIso: params.timestampIso,
      effectiveDateIso: priorEntry.effectiveDateIso,
      modelId: params.modelId,
      newState: priorEntry.newState,
      transitionType: "ROLLBACK_SAFEGUARD",
      sourceEvidenceHash: params.sourceEvidenceHash,
      sourceEndpointOrUrl: `spe://rollback?target=${params.targetPriorEntryHash}&reason=${encodeURIComponent(params.rationale)}`,
      referencedPriorEntryHash: params.targetPriorEntryHash,
    });
  }

  /**
   * Verifies cryptographic hash chain integrity of the ledger.
   */
  public verifyLedgerIntegrity(): { isValid: boolean; reason?: string; evaluatedCount: number } {
    let expectedPreviousHash = GENESIS_LEDGER_HASH;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      if (entry.entryIndex !== i) {
        return {
          isValid: false,
          reason: `Entry index mismatch at row ${i}: found ${entry.entryIndex}`,
          evaluatedCount: i,
        };
      }

      if (entry.previousEntryHash !== expectedPreviousHash) {
        return {
          isValid: false,
          reason: `Broken hash chain at row ${i}: expected previous ${expectedPreviousHash}, got ${entry.previousEntryHash}`,
          evaluatedCount: i,
        };
      }

      const recomputedHash = computeEntryHash(
        entry.entryIndex,
        entry.timestampIso,
        entry.effectiveDateIso,
        entry.modelId,
        entry.previousState,
        entry.newState,
        entry.transitionType,
        entry.sourceEvidenceHash,
        entry.sourceEndpointOrUrl,
        entry.previousEntryHash,
        entry.supersedingModelId,
        entry.referencedPriorEntryHash
      );

      if (recomputedHash !== entry.entryHash) {
        return {
          isValid: false,
          reason: `Tampered entry hash at row ${i}: expected ${recomputedHash}, recorded ${entry.entryHash}`,
          evaluatedCount: i,
        };
      }

      expectedPreviousHash = entry.entryHash;
    }

    return {
      isValid: true,
      evaluatedCount: this.entries.length,
    };
  }

  /**
   * Exports an immutable snapshot of the ledger.
   */
  public toSnapshot(): TemporalLedgerSnapshot {
    return {
      genesisHash: GENESIS_LEDGER_HASH,
      headHash: this.getHeadHash(),
      totalEntries: this.entries.length,
      lastUpdatedIso: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestampIso : new Date().toISOString(),
      entries: this.getEntries(),
    };
  }
}
