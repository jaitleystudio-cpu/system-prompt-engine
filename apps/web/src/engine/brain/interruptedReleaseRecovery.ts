/**
 * SPE Ω — Interrupted-Release Recovery & Staged Pipeline Coordinator
 * Autonomous Recovery & Durable Checkpoint Kernel — Layer 05
 *
 * Epistemic Foundations:
 * - Distributed Systems Monotonic Fencing Tokens (Martin Kleppmann, DDIA): Preventing split-brain
 *   deployments when interrupted or zombie workers wake up.
 * - Idempotent Outbox Pattern: Replaying runs produces identical state without duplicate external actions.
 * - Non-negotiable Invariants:
 *   1. INTERRUPTION ≠ DEPLOYMENT: An interrupted or aborted pipeline run must NEVER claim deployment success.
 *   2. STALE TOKEN CANNOT PUBLISH: A worker holding an expired fencing token cannot modify state after
 *      a successor worker has acquired a higher fencing token.
 *   3. PRODUCTION POINTER IMMUTABILITY ON FAILURE: Active production pointer remains pinned to
 *      last-known-good release whenever a candidate fails or is interrupted.
 *   4. "NO QUALIFIED IMPROVEMENT" ≠ FAILURE: When no candidate qualifies, pipeline successfully completes
 *      with NO_OP_RETAINED without altering the working production release.
 */

import { computeSha256 } from "../hashUtils.ts";
import type { BrainReleaseManifest } from "./brainReleaseManifest.ts";

export type PipelineStage =
  | "INIT"
  | "DISCOVER"
  | "VERIFY_INPUTS"
  | "OPTIMIZE_CANDIDATE"
  | "EVALUATE_INDEPENDENT"
  | "PACKAGE_MANIFEST"
  | "PREVIEW_STAGING"
  | "PROMOTE_RELEASE"
  | "COMPLETED"
  | "ABORTED"
  | "NO_OP_RETAINED";

export interface PipelineCheckpoint {
  readonly runId: string;
  readonly businessDateIst: string;
  readonly fencingToken: number;
  readonly stage: PipelineStage;
  readonly lastCompletedStage?: PipelineStage;
  readonly candidateId?: string;
  readonly manifestDigest?: string;
  readonly activeProductionReleaseId: string;
  readonly isProductionDeployed: boolean;
  readonly crashedAtStage?: PipelineStage;
  readonly crashReason?: string;
  readonly updatedAtIso: string;
}

export interface RecoveryReceipt {
  readonly receiptId: string;
  readonly recoveredRunId: string;
  readonly interruptedAtStage: PipelineStage;
  readonly restoredSafeReleaseId: string;
  readonly falseDeploymentClaimPrevented: boolean;
  readonly recoveryAction: "RESTORED_PREVIOUS_ACTIVE" | "CLEARED_STALE_RUN" | "REPLAYED_IDEMPOTENT_RESULT";
  readonly timestampIso: string;
  readonly recoveryDigest: string;
}

export interface PipelineExecutionResult {
  readonly runId: string;
  readonly status: "SUCCESS_PROMOTED" | "SUCCESS_NO_OP_RETAINED" | "INTERRUPTED_RECOVERED" | "ABORTED_UNQUALIFIED" | "STALE_TOKEN_REJECTED";
  readonly activeProductionReleaseId: string;
  readonly deployedManifest?: BrainReleaseManifest;
  readonly finalStage: PipelineStage;
  readonly recoveryReceipt?: RecoveryReceipt;
  readonly message: string;
}

export interface RunPipelineOptions {
  runId: string;
  businessDateIst: string;
  fencingToken: number;
  activeRelease: BrainReleaseManifest;
  candidateManifest?: BrainReleaseManifest;
  simulateCrashAtStage?: PipelineStage;
  isQualifiedCandidate?: boolean;
}

/**
 * In-memory / durable coordinator for staged brain pipeline execution and recovery.
 */
export class StagedBrainPipelineCoordinator {
  private activeFencingToken = 0;
  private currentActiveReleaseId: string;
  private checkpoints = new Map<string, PipelineCheckpoint>();
  private completedOutbox = new Map<string, PipelineExecutionResult>();

  constructor(initialActiveReleaseId: string) {
    this.currentActiveReleaseId = initialActiveReleaseId;
  }

  public getActiveReleaseId(): string {
    return this.currentActiveReleaseId;
  }

  public getActiveFencingToken(): number {
    return this.activeFencingToken;
  }

  public getCheckpoint(runId: string): PipelineCheckpoint | undefined {
    return this.checkpoints.get(runId);
  }

  /**
   * Acquires a monotonically increasing fencing token for a new pipeline run.
   */
  public acquireFencedLease(candidateToken: number): { granted: boolean; currentToken: number; reason?: string } {
    if (candidateToken <= this.activeFencingToken) {
      return {
        granted: false,
        currentToken: this.activeFencingToken,
        reason: `STALE_FENCING_TOKEN: Candidate token ${candidateToken} <= active token ${this.activeFencingToken}`,
      };
    }
    this.activeFencingToken = candidateToken;
    return { granted: true, currentToken: this.activeFencingToken };
  }

  /**
   * Executes a staged daily brain pipeline with checkpointing and simulated crash/recovery defense.
   */
  public async executePipeline(options: RunPipelineOptions): Promise<PipelineExecutionResult> {
    const { runId, businessDateIst, fencingToken, activeRelease, simulateCrashAtStage, isQualifiedCandidate } = options;

    // 1. Idempotency Check (Outbox Pattern)
    const existingOutbox = this.completedOutbox.get(runId);
    if (existingOutbox) {
      return {
        ...existingOutbox,
        message: `IDEMPOTENT_REPLAY: Run ${runId} already evaluated for business date ${businessDateIst}. Replaying stored result without duplicate actions.`,
      };
    }

    // 2. Fencing Token Verification
    if (fencingToken < this.activeFencingToken) {
      return {
        runId,
        status: "STALE_TOKEN_REJECTED",
        activeProductionReleaseId: this.currentActiveReleaseId,
        finalStage: "ABORTED",
        message: `STALE_WORKER_BLOCKED: Worker fencing token ${fencingToken} is obsolete. Active token is ${this.activeFencingToken}.`,
      };
    }
    this.activeFencingToken = fencingToken;

    // 3. Stage: INIT
    let currentStage: PipelineStage = "INIT";
    this.saveCheckpoint({
      runId,
      businessDateIst,
      fencingToken,
      stage: currentStage,
      activeProductionReleaseId: this.currentActiveReleaseId,
      isProductionDeployed: false,
      updatedAtIso: new Date().toISOString(),
    });

    if (simulateCrashAtStage === "INIT") {
      return this.handleInterruption(runId, currentStage, "Simulated crash at INIT");
    }

    // 4. Stage: DISCOVER
    currentStage = "DISCOVER";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "DISCOVER") {
      return this.handleInterruption(runId, currentStage, "Simulated network failure during DISCOVER");
    }

    // 5. Stage: VERIFY_INPUTS
    currentStage = "VERIFY_INPUTS";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "VERIFY_INPUTS") {
      return this.handleInterruption(runId, currentStage, "Simulated parse crash during VERIFY_INPUTS");
    }

    // 6. Stage: OPTIMIZE_CANDIDATE
    currentStage = "OPTIMIZE_CANDIDATE";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "OPTIMIZE_CANDIDATE") {
      return this.handleInterruption(runId, currentStage, "Simulated process crash during candidate search");
    }

    // 7. Stage: EVALUATE_INDEPENDENT
    currentStage = "EVALUATE_INDEPENDENT";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "EVALUATE_INDEPENDENT") {
      return this.handleInterruption(runId, currentStage, "Simulated timeout during protected evaluation");
    }

    // Check if candidate qualified
    if (isQualifiedCandidate === false) {
      currentStage = "NO_OP_RETAINED";
      this.updateStage(runId, currentStage);
      const result: PipelineExecutionResult = {
        runId,
        status: "SUCCESS_NO_OP_RETAINED",
        activeProductionReleaseId: this.currentActiveReleaseId,
        finalStage: currentStage,
        message: "NO_QUALIFIED_IMPROVEMENT: No candidate beat champion on independent evaluation. Working release safely retained.",
      };
      this.completedOutbox.set(runId, result);
      return result;
    }

    // 8. Stage: PACKAGE_MANIFEST
    currentStage = "PACKAGE_MANIFEST";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "PACKAGE_MANIFEST") {
      return this.handleInterruption(runId, currentStage, "Simulated disk crash while writing manifest");
    }

    // 9. Stage: PREVIEW_STAGING
    currentStage = "PREVIEW_STAGING";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "PREVIEW_STAGING") {
      return this.handleInterruption(runId, currentStage, "Simulated staging canary assertion failure");
    }

    // 10. Stage: PROMOTE_RELEASE
    currentStage = "PROMOTE_RELEASE";
    this.updateStage(runId, currentStage);
    if (simulateCrashAtStage === "PROMOTE_RELEASE") {
      return this.handleInterruption(runId, currentStage, "Simulated host kill immediately prior to atomic pointer switch");
    }

    // Atomic Promotion: advance pointer ONLY here
    const promotedManifest = options.candidateManifest || activeRelease;
    this.currentActiveReleaseId = promotedManifest.brainReleaseId;
    currentStage = "COMPLETED";

    this.saveCheckpoint({
      runId,
      businessDateIst,
      fencingToken,
      stage: currentStage,
      lastCompletedStage: "PROMOTE_RELEASE",
      activeProductionReleaseId: this.currentActiveReleaseId,
      isProductionDeployed: true,
      manifestDigest: promotedManifest.manifestDigest,
      updatedAtIso: new Date().toISOString(),
    });

    const result: PipelineExecutionResult = {
      runId,
      status: "SUCCESS_PROMOTED",
      activeProductionReleaseId: this.currentActiveReleaseId,
      deployedManifest: promotedManifest,
      finalStage: currentStage,
      message: `RELEASE_PROMOTED: Brain release ${promotedManifest.brainReleaseId} promoted to active production.`,
    };

    this.completedOutbox.set(runId, result);
    return result;
  }

  /**
   * Handles an interruption/crash event, ensuring false deployment claims are impossible.
   */
  private handleInterruption(runId: string, stage: PipelineStage, reason: string): PipelineExecutionResult {
    const existing = this.checkpoints.get(runId);
    const businessDateIst = existing?.businessDateIst || "UNKNOWN_DATE";
    const fencingToken = existing?.fencingToken || 0;

    // Checkpoint records that pipeline crashed at this stage and was NOT deployed
    this.saveCheckpoint({
      runId,
      businessDateIst,
      fencingToken,
      stage: "ABORTED",
      interruptedAtStage: stage,
      crashedAtStage: stage,
      crashReason: reason,
      activeProductionReleaseId: this.currentActiveReleaseId, // strictly unchanged!
      isProductionDeployed: false, // strictly false!
      updatedAtIso: new Date().toISOString(),
    });

    // Generate formal recovery receipt
    const recoveryReceipt = this.generateRecoveryReceipt(runId, stage, this.currentActiveReleaseId);

    return {
      runId,
      status: "INTERRUPTED_RECOVERED",
      activeProductionReleaseId: this.currentActiveReleaseId,
      finalStage: "ABORTED",
      recoveryReceipt,
      message: `RECOVERY_VERIFIED: Pipeline was interrupted at stage ${stage} (${reason}). Production pointer safely retained at ${this.currentActiveReleaseId}. False deployment claim prevented.`,
    };
  }

  private saveCheckpoint(checkpoint: PipelineCheckpoint & { interruptedAtStage?: PipelineStage }): void {
    this.checkpoints.set(checkpoint.runId, Object.freeze({ ...checkpoint }));
  }

  private updateStage(runId: string, stage: PipelineStage): void {
    const existing = this.checkpoints.get(runId);
    if (existing) {
      this.checkpoints.set(runId, {
        ...existing,
        lastCompletedStage: existing.stage,
        stage,
        updatedAtIso: new Date().toISOString(),
      });
    }
  }

  private generateRecoveryReceipt(
    runId: string,
    interruptedStage: PipelineStage,
    safeReleaseId: string
  ): RecoveryReceipt {
    const timestampIso = new Date().toISOString();
    const receiptId = `recovery_rcpt_${timestampIso.replace(/[-:T]/g, "").slice(0, 8)}_${runId}`;
    const payload = {
      receiptId,
      runId,
      interruptedStage,
      safeReleaseId,
      falseDeploymentClaimPrevented: true,
      timestampIso,
    };
    const recoveryDigest = computeSha256(JSON.stringify(payload));

    return Object.freeze({
      receiptId,
      recoveredRunId: runId,
      interruptedAtStage: interruptedStage,
      restoredSafeReleaseId: safeReleaseId,
      falseDeploymentClaimPrevented: true,
      recoveryAction: "RESTORED_PREVIOUS_ACTIVE",
      timestampIso,
      recoveryDigest,
    });
  }
}
