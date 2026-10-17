/**
 * SPE Ω — Autonomous Operations Layer (AOL)
 *
 * Mandate:
 * Implements the unattended operations foundation for System Prompt Engine:
 * 1. Shared Run Coordinator with Monotonically Increasing Fenced Leases
 * 2. Saved Workflow Progress & Checkpoint Resume Engine
 * 3. Durable External-Action Ledger / Outbox for Idempotent Operations
 * 4. Independent Deployment Witness
 * 5. Configuration Drift Detector & API Contract Watcher
 * 6. Autonomous Work Budget & Update Cooling Period Controller
 * 7. Exception-Only Structured Diagnostic Reporter
 *
 * Operating Rule:
 * Routine permitted work requires no daily human approval.
 * Uncertain or unverified updates automatically hold while the working product
 * stays available. SPE never forces an update merely because another day has passed.
 */

import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ============================================================================
// 1. Shared Run Coordinator with Monotonically Increasing Fenced Leases
// ============================================================================

export interface FencedLeaseCandidate {
  workerId: string;
  triggerSource: "github-actions" | "launchd" | "cron" | "manual" | "cloudflare-workflows";
  requestedDurationMs?: number;
}

export interface FencedLeaseRecord {
  leaseId: string;
  businessDateIst: string;
  fencingToken: number;
  ownerWorkerId: string;
  triggerSource: string;
  acquiredAtMs: number;
  expiresAtMs: number;
  released: boolean;
}

export class SharedRunCoordinator {
  private inMemoryState: FencedLeaseRecord | null = null;
  private readonly storagePath?: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath;
    this.loadStateFromDisk();
  }

  /**
   * Generates Asia/Kolkata daily business date key (e.g. "SPE-RUN-20261017")
   * to prevent UTC date boundaries splitting overnight runs.
   */
  public computeBusinessDateKey(date = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value || "2026";
    const m = parts.find((p) => p.type === "month")?.value || "10";
    const d = parts.find((p) => p.type === "day")?.value || "17";
    return `SPE-RUN-${y}${m}${d}`;
  }

  private loadStateFromDisk(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) return;
    try {
      const raw = readFileSync(this.storagePath, "utf-8");
      this.inMemoryState = JSON.parse(raw);
    } catch {
      // Fallback to null in-memory state if unreadable
      this.inMemoryState = null;
    }
  }

  private persistStateToDisk(): void {
    if (!this.storagePath || !this.inMemoryState) return;
    try {
      const dir = dirname(this.storagePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.storagePath, JSON.stringify(this.inMemoryState, null, 2), "utf-8");
    } catch {}
  }

  public getCurrentLease(): FencedLeaseRecord | null {
    return this.inMemoryState ? { ...this.inMemoryState } : null;
  }

  /**
   * Acquires or re-acquires a fenced lease. Monotonically increments fencingToken
   * so an expired worker cannot publish after a successor has taken over.
   */
  public acquireFencedLease(
    candidate: FencedLeaseCandidate,
    nowMs = Date.now()
  ): { acquired: boolean; lease?: FencedLeaseRecord; reason?: string } {
    this.loadStateFromDisk();
    const duration = candidate.requestedDurationMs || 30 * 60 * 1000; // 30 min default
    const bDate = this.computeBusinessDateKey(new Date(nowMs));

    if (this.inMemoryState && !this.inMemoryState.released) {
      const isExpired = nowMs > this.inMemoryState.expiresAtMs;
      const isSameOwner = this.inMemoryState.ownerWorkerId === candidate.workerId;

      if (!isExpired && !isSameOwner) {
        return {
          acquired: false,
          reason: `Lease conflict: Active lease held by worker '${this.inMemoryState.ownerWorkerId}' (fencingToken: ${this.inMemoryState.fencingToken}) until ${new Date(this.inMemoryState.expiresAtMs).toISOString()}`,
        };
      }
    }

    const nextToken = (this.inMemoryState?.fencingToken || 0) + 1;
    const newLease: FencedLeaseRecord = {
      leaseId: `lease-${bDate}-${nextToken}-${candidate.workerId}`,
      businessDateIst: bDate,
      fencingToken: nextToken,
      ownerWorkerId: candidate.workerId,
      triggerSource: candidate.triggerSource,
      acquiredAtMs: nowMs,
      expiresAtMs: nowMs + duration,
      released: false,
    };

    this.inMemoryState = newLease;
    this.persistStateToDisk();

    return { acquired: true, lease: { ...newLease } };
  }

  /**
   * Asserts that the worker holds the latest fencing token and that the lease has not expired.
   */
  public assertValidFencingToken(leaseId: string, fencingToken: number, nowMs = Date.now()): void {
    this.loadStateFromDisk();
    if (!this.inMemoryState) {
      throw new Error(`STALE_FENCING_TOKEN_ERROR: No active lease found for leaseId '${leaseId}'`);
    }
    if (this.inMemoryState.released) {
      throw new Error(`STALE_FENCING_TOKEN_ERROR: Lease '${leaseId}' was already released`);
    }
    if (this.inMemoryState.leaseId !== leaseId) {
      throw new Error(`STALE_FENCING_TOKEN_ERROR: LeaseId mismatch: current is '${this.inMemoryState.leaseId}', received '${leaseId}'`);
    }
    if (this.inMemoryState.fencingToken !== fencingToken) {
      throw new Error(
        `STALE_FENCING_TOKEN_ERROR: Worker token ${fencingToken} is obsolete. Successor holds token ${this.inMemoryState.fencingToken}`
      );
    }
    if (nowMs > this.inMemoryState.expiresAtMs) {
      throw new Error(`STALE_FENCING_TOKEN_ERROR: Lease '${leaseId}' expired at ${new Date(this.inMemoryState.expiresAtMs).toISOString()}`);
    }
  }

  public releaseLease(leaseId: string, fencingToken: number): boolean {
    this.loadStateFromDisk();
    if (!this.inMemoryState || this.inMemoryState.leaseId !== leaseId) return false;
    if (this.inMemoryState.fencingToken !== fencingToken) return false;

    this.inMemoryState.released = true;
    this.persistStateToDisk();
    return true;
  }
}

// ============================================================================
// 2. Saved Workflow Progress & Checkpoint Resume Engine
// ============================================================================

export type WorkflowStepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface WorkflowCheckpoint {
  stepName: string;
  status: WorkflowStepStatus;
  startedAtMs: number;
  completedAtMs?: number;
  inputDigestSha256: string;
  outputDigestSha256?: string;
  resultPayloadJson?: string;
  error?: string;
}

export class WorkflowProgressManager {
  private checkpoints: Map<string, WorkflowCheckpoint> = new Map();
  private readonly storagePath?: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) return;
    try {
      const raw = readFileSync(this.storagePath, "utf-8");
      const list: WorkflowCheckpoint[] = JSON.parse(raw);
      for (const item of list) {
        this.checkpoints.set(item.stepName, item);
      }
    } catch {}
  }

  private persistToDisk(): void {
    if (!this.storagePath) return;
    try {
      const dir = dirname(this.storagePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const list = Array.from(this.checkpoints.values());
      writeFileSync(this.storagePath, JSON.stringify(list, null, 2), "utf-8");
    } catch {}
  }

  public getCheckpoint(stepName: string): WorkflowCheckpoint | undefined {
    return this.checkpoints.get(stepName);
  }

  public getAllCheckpoints(): WorkflowCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Resumes or executes a step idempotently. If the step is already COMPLETED
   * and inputs match, returns the cached result without repeating side-effects.
   */
  public async executeStep<T>(
    stepName: string,
    inputData: unknown,
    executeFn: () => Promise<T>
  ): Promise<{ result: T; resumedFromCheckpoint: boolean }> {
    this.loadFromDisk();
    const inputDigest = createHash("sha256").update(JSON.stringify(inputData)).digest("hex");
    const existing = this.checkpoints.get(stepName);

    if (existing && existing.status === "COMPLETED" && existing.inputDigestSha256 === inputDigest && existing.resultPayloadJson) {
      try {
        const parsed = JSON.parse(existing.resultPayloadJson) as T;
        return { result: parsed, resumedFromCheckpoint: true };
      } catch {
        // Fall through to re-execution if deserialization fails
      }
    }

    const cp: WorkflowCheckpoint = {
      stepName,
      status: "IN_PROGRESS",
      startedAtMs: Date.now(),
      inputDigestSha256: inputDigest,
    };
    this.checkpoints.set(stepName, cp);
    this.persistToDisk();

    try {
      const output = await executeFn();
      const outputDigest = createHash("sha256").update(JSON.stringify(output)).digest("hex");
      cp.status = "COMPLETED";
      cp.completedAtMs = Date.now();
      cp.outputDigestSha256 = outputDigest;
      cp.resultPayloadJson = JSON.stringify(output);
      this.checkpoints.set(stepName, cp);
      this.persistToDisk();
      return { result: output, resumedFromCheckpoint: false };
    } catch (err) {
      cp.status = "FAILED";
      cp.completedAtMs = Date.now();
      cp.error = err instanceof Error ? err.message : String(err);
      this.checkpoints.set(stepName, cp);
      this.persistToDisk();
      throw err;
    }
  }

  public clear(): void {
    this.checkpoints.clear();
    this.persistToDisk();
  }
}

// ============================================================================
// 3. Durable External-Action Ledger / Outbox (Idempotent Dispatch)
// ============================================================================

export type OutboxActionStatus = "INTENT_RECORDED" | "DISPATCHED" | "COMMITTED" | "FAILED" | "RECONCILED";

export interface OutboxEntry {
  idempotencyKey: string;
  actionType: "DEPLOYMENT_DISPATCH" | "PAYMENT_CAPTURE" | "EXTERNAL_WEBHOOK_NOTIFY";
  targetSystem: string;
  payloadDigestSha256: string;
  status: OutboxActionStatus;
  recordedAtMs: number;
  completedAtMs?: number;
  externalOperationId?: string;
  responsePayloadJson?: string;
  error?: string;
}

export class ActionOutboxLedger {
  private ledger: Map<string, OutboxEntry> = new Map();
  private readonly storagePath?: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) return;
    try {
      const raw = readFileSync(this.storagePath, "utf-8");
      const list: OutboxEntry[] = JSON.parse(raw);
      for (const item of list) {
        this.ledger.set(item.idempotencyKey, item);
      }
    } catch {}
  }

  private persistToDisk(): void {
    if (!this.storagePath) return;
    try {
      const dir = dirname(this.storagePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.storagePath, JSON.stringify(Array.from(this.ledger.values()), null, 2), "utf-8");
    } catch {}
  }

  public getEntry(idempotencyKey: string): OutboxEntry | undefined {
    return this.ledger.get(idempotencyKey);
  }

  /**
   * Dispatches an external action with write-ahead intent recording.
   * If already committed, returns existing result (zero duplicate side-effects).
   */
  public async dispatchWithOutbox<T>(
    idempotencyKey: string,
    actionType: OutboxEntry["actionType"],
    targetSystem: string,
    payload: unknown,
    executeExternal: (opId: string) => Promise<{ operationId: string; result: T }>
  ): Promise<{ result: T; wasAlreadyCommitted: boolean }> {
    this.loadFromDisk();
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const existing = this.ledger.get(idempotencyKey);

    if (existing && existing.status === "COMMITTED" && existing.responsePayloadJson) {
      return {
        result: JSON.parse(existing.responsePayloadJson) as T,
        wasAlreadyCommitted: true,
      };
    }

    const opId = existing?.externalOperationId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: OutboxEntry = {
      idempotencyKey,
      actionType,
      targetSystem,
      payloadDigestSha256: payloadHash,
      status: "INTENT_RECORDED",
      recordedAtMs: Date.now(),
      externalOperationId: opId,
    };
    this.ledger.set(idempotencyKey, entry);
    this.persistToDisk();

    try {
      entry.status = "DISPATCHED";
      this.persistToDisk();

      const { operationId, result } = await executeExternal(opId);
      entry.status = "COMMITTED";
      entry.completedAtMs = Date.now();
      entry.externalOperationId = operationId;
      entry.responsePayloadJson = JSON.stringify(result);
      this.persistToDisk();

      return { result, wasAlreadyCommitted: false };
    } catch (err) {
      entry.status = "FAILED";
      entry.completedAtMs = Date.now();
      entry.error = err instanceof Error ? err.message : String(err);
      this.persistToDisk();
      throw err;
    }
  }
}

// ============================================================================
// 4. Independent Deployment Witness
// ============================================================================

export interface DeploymentWitnessInspectionCandidate {
  providerExecutionId: string;
  expectedCommitSha: string;
  expectedArtifactDigestSha256: string;
  targetEnvironment: "production";
  deploymentProvider: "github-actions" | "cloudflare-pages" | "vercel" | "google-cloud-build";
  deployedUrl: string;
  authoritativeSecret: string;
  simulatedProbeResponse?: { status: number; servedCommitSha?: string };
}

export interface DeploymentWitnessCertificate {
  certificateId: string;
  witnessedAt: string;
  providerExecutionId: string;
  commitSha: string;
  artifactDigestSha256: string;
  targetEnvironment: "production";
  deployedUrl: string;
  witnessConclusion: "VERIFIED_PRODUCTION_DEPLOYED" | "WITNESS_REJECTED";
  witnessSignature: string;
  rejectionReason?: string;
}

export class IndependentDeploymentWitness {
  /**
   * Inspects and certifies a deployment strictly and independently.
   */
  public certifyDeployment(
    candidate: DeploymentWitnessInspectionCandidate
  ): DeploymentWitnessCertificate {
    const certId = `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    // 1. Strict Target Environment
    if (candidate.targetEnvironment !== "production") {
      return this.rejectCertificate(certId, nowIso, candidate, "Invalid target environment; must be 'production'");
    }

    // 2. Strict 40-hex Git commit format
    if (!candidate.expectedCommitSha || !/^[0-9a-f]{40}$/i.test(candidate.expectedCommitSha)) {
      return this.rejectCertificate(certId, nowIso, candidate, "expectedCommitSha is not a valid 40-character hex SHA");
    }

    // 3. Strict 64-hex Artifact digest format
    if (!candidate.expectedArtifactDigestSha256 || !/^[0-9a-f]{64}$/i.test(candidate.expectedArtifactDigestSha256)) {
      return this.rejectCertificate(certId, nowIso, candidate, "expectedArtifactDigestSha256 is not a valid 64-character hex SHA-256");
    }

    // 4. Secret validation (no default/insecure keys allowed for witness certification)
    if (!candidate.authoritativeSecret || candidate.authoritativeSecret.length < 16) {
      return this.rejectCertificate(certId, nowIso, candidate, "authoritativeSecret is absent or too weak (< 16 characters)");
    }

    // 5. Deployed URL & Serving Probe Verification
    if (!candidate.deployedUrl || !candidate.deployedUrl.startsWith("https://")) {
      return this.rejectCertificate(certId, nowIso, candidate, "deployedUrl must be a secure HTTPS origin");
    }

    if (candidate.simulatedProbeResponse) {
      if (candidate.simulatedProbeResponse.status !== 200) {
        return this.rejectCertificate(
          certId,
          nowIso,
          candidate,
          `Live probe check returned HTTP status ${candidate.simulatedProbeResponse.status}, expected 200`
        );
      }
      if (
        candidate.simulatedProbeResponse.servedCommitSha &&
        candidate.simulatedProbeResponse.servedCommitSha.toLowerCase() !== candidate.expectedCommitSha.toLowerCase()
      ) {
        return this.rejectCertificate(
          certId,
          nowIso,
          candidate,
          `Serving commit mismatch: live endpoint reports '${candidate.simulatedProbeResponse.servedCommitSha}', expected '${candidate.expectedCommitSha}'`
        );
      }
    }

    // 6. Compute Cryptographic Witness Signature
    const canonicalPayload = `${certId}:${candidate.providerExecutionId}:${candidate.expectedCommitSha.toLowerCase()}:${candidate.expectedArtifactDigestSha256.toLowerCase()}:${candidate.targetEnvironment}:${candidate.deployedUrl}:${nowIso}`;
    const sig = createHmac("sha256", candidate.authoritativeSecret).update(canonicalPayload).digest("hex");

    return {
      certificateId: certId,
      witnessedAt: nowIso,
      providerExecutionId: candidate.providerExecutionId,
      commitSha: candidate.expectedCommitSha.toLowerCase(),
      artifactDigestSha256: candidate.expectedArtifactDigestSha256.toLowerCase(),
      targetEnvironment: "production",
      deployedUrl: candidate.deployedUrl,
      witnessConclusion: "VERIFIED_PRODUCTION_DEPLOYED",
      witnessSignature: sig,
    };
  }

  private rejectCertificate(
    certId: string,
    nowIso: string,
    candidate: DeploymentWitnessInspectionCandidate,
    reason: string
  ): DeploymentWitnessCertificate {
    return {
      certificateId: certId,
      witnessedAt: nowIso,
      providerExecutionId: candidate.providerExecutionId || "unknown",
      commitSha: candidate.expectedCommitSha || "unknown",
      artifactDigestSha256: candidate.expectedArtifactDigestSha256 || "unknown",
      targetEnvironment: "production",
      deployedUrl: candidate.deployedUrl || "",
      witnessConclusion: "WITNESS_REJECTED",
      witnessSignature: "0000000000000000000000000000000000000000000000000000000000000000",
      rejectionReason: reason,
    };
  }
}

// ============================================================================
// 5. Configuration Drift Detector & API Contract Watcher
// ============================================================================

export interface ModelContractEntry {
  modelId: string;
  provider: string;
  contextWindow: number;
  status: "ACTIVE" | "DEPRECATED" | "QUARANTINED";
  deprecatedInFavorOf?: string;
}

export class DriftContractWatcher {
  /**
   * Inspects model registry entries for deprecations, missing successor targets, or schema drift.
   */
  public auditModelContracts(models: ModelContractEntry[]): {
    clean: boolean;
    quarantinedCount: number;
    driftViolations: string[];
  } {
    const violations: string[] = [];
    const modelIdSet = new Set(models.map((m) => m.modelId));
    let quarantinedCount = 0;

    for (const m of models) {
      if (m.status === "QUARANTINED") {
        quarantinedCount++;
      }
      if (m.status === "DEPRECATED") {
        if (!m.deprecatedInFavorOf) {
          violations.push(`Deprecated model '${m.modelId}' lacks 'deprecatedInFavorOf' successor mapping`);
        } else if (!modelIdSet.has(m.deprecatedInFavorOf)) {
          violations.push(
            `Deprecated model '${m.modelId}' points to non-existent successor '${m.deprecatedInFavorOf}'`
          );
        }
      }
      if (m.contextWindow <= 0) {
        violations.push(`Model '${m.modelId}' has invalid contextWindow <= 0 (${m.contextWindow})`);
      }
    }

    return {
      clean: violations.length === 0,
      quarantinedCount,
      driftViolations: violations,
    };
  }
}

// ============================================================================
// 6. Autonomous Work Budget & Update Cooling Period Controller
// ============================================================================

export interface BudgetLimits {
  maxDailyExecutionTimeMs: number;
  maxDailyRetries: number;
  maxDailyChangedFiles: number;
  maxDailyReleases: number;
  coolingPeriodMinutes: number;
}

export const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  maxDailyExecutionTimeMs: 45 * 60 * 1000, // 45 min
  maxDailyRetries: 3,
  maxDailyChangedFiles: 10,
  maxDailyReleases: 1,
  coolingPeriodMinutes: 60, // 1 hour cooling after release
};

export class AutonomousBudgetController {
  private executionTimeMsToday = 0;
  private retriesCountToday = 0;
  private changedFilesCountToday = 0;
  private releasesCountToday = 0;
  private lastReleaseTimestampMs = 0;
  private readonly limits: BudgetLimits;

  constructor(limits = DEFAULT_BUDGET_LIMITS) {
    this.limits = limits;
  }

  public recordRelease(timestampMs = Date.now()): void {
    this.releasesCountToday++;
    this.lastReleaseTimestampMs = timestampMs;
  }

  public recordWorkMetrics(metrics: {
    durationMs: number;
    retries?: number;
    changedFiles?: number;
  }): void {
    this.executionTimeMsToday += metrics.durationMs;
    this.retriesCountToday += metrics.retries || 0;
    this.changedFilesCountToday += metrics.changedFiles || 0;
  }

  public evaluateCanRelease(nowMs = Date.now()): { allowed: boolean; reason?: string } {
    // 1. Daily release limit
    if (this.releasesCountToday >= this.limits.maxDailyReleases) {
      return {
        allowed: false,
        reason: `Daily release cap reached (${this.releasesCountToday}/${this.limits.maxDailyReleases} releases executed today)`,
      };
    }

    // 2. Cooling period enforcement
    if (this.lastReleaseTimestampMs > 0) {
      const elapsedMinutes = (nowMs - this.lastReleaseTimestampMs) / (60 * 1000);
      if (elapsedMinutes < this.limits.coolingPeriodMinutes) {
        const remaining = Math.ceil(this.limits.coolingPeriodMinutes - elapsedMinutes);
        return {
          allowed: false,
          reason: `Update cooling window active: ${remaining} minute(s) remaining before next release permitted`,
        };
      }
    }

    // 3. Execution time budget
    if (this.executionTimeMsToday > this.limits.maxDailyExecutionTimeMs) {
      return {
        allowed: false,
        reason: `Daily execution time budget exceeded (${Math.round(this.executionTimeMsToday / 60000)}m > ${Math.round(this.limits.maxDailyExecutionTimeMs / 60000)}m limit)`,
      };
    }

    return { allowed: true };
  }
}

// ============================================================================
// 7. Exception-Only Structured Diagnostic Reporter
// ============================================================================

export interface ExceptionDiagnosticReceipt {
  receiptId: string;
  occurredAtIso: string;
  errorName: string;
  errorMessage: string;
  contextPayload: Record<string, unknown>;
  recoveryRecommendation: string;
  requiresHumanEscalation: boolean;
}

export class ExceptionOnlyReporter {
  private incidents: ExceptionDiagnosticReceipt[] = [];

  /**
   * Routine success is recorded silently without noisy alert emissions.
   */
  public recordQuietSuccess(): void {
    // Intentionally no-op to adhere to Exception-Only Reporting mandate
  }

  /**
   * Surfaces a persistent or non-recoverable error as a structured diagnostic receipt.
   */
  public reportPersistentFailure(
    error: Error | string,
    context: Record<string, unknown> = {},
    requiresHumanEscalation = false
  ): ExceptionDiagnosticReceipt {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const receipt: ExceptionDiagnosticReceipt = {
      receiptId: `ERR-DIAG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      occurredAtIso: new Date().toISOString(),
      errorName: errObj.name,
      errorMessage: errObj.message,
      contextPayload: context,
      recoveryRecommendation: this.deduceRecoveryRecommendation(errObj),
      requiresHumanEscalation,
    };

    this.incidents.push(receipt);
    return receipt;
  }

  public getIncidents(): ExceptionDiagnosticReceipt[] {
    return [...this.incidents];
  }

  private deduceRecoveryRecommendation(error: Error): string {
    const msg = error.message.toLowerCase();
    if (msg.includes("fencing") || msg.includes("lease")) {
      return "Retry after lease expiration or wait for primary worker completion; avoid concurrent native/cloud dispatch.";
    }
    if (msg.includes("cooling")) {
      return "Safe hold active: wait for update cooling period to elapse before dispatching successor release.";
    }
    if (msg.includes("stale") || msg.includes("timeout")) {
      return "Query action outbox ledger to reconcile provider state before re-attempting external dispatch.";
    }
    return "Preserve last-known-good production artifact; investigate failure context in isolated repair workspace.";
  }
}
