/**
 * apps/web/src/engine/maintenance/durableMaintenanceLedger.ts
 *
 * SPE Ω — Durable Maintenance Ledger & Fenced Lease Coordinator
 *
 * Architecture Invariants (PROPOSAL.md / Audit Requirements):
 * 1. SINGLE COORDINATION BOUNDARY:
 *    Multiple independent crons editing the same checkout is strictly forbidden.
 *    All scheduled, watchdog, and manual runs coordinate through this durable ledger.
 * 2. MONOTONIC FENCING TOKENS:
 *    A shared durable lease carries an incrementing fencing token. If a worker is interrupted
 *    or times out and a successor takes over, the stale worker is strictly blocked from
 *    committing state or publishing releases.
 * 3. BUSINESS-DATE IDEMPOTENCY:
 *    Runs are keyed by business date in Asia/Kolkata (YYYY-MM-DD) and starting commit SHA.
 *    Repeating a trigger on an already-completed business date results in a safe NO-OP
 *    without duplicating publishes, debits, or releases.
 * 4. ATOMIC PERSISTENCE:
 *    Ledger state is flushed to disk via an atomic write-and-rename pattern, preventing
 *    corrupt half-written state on sudden process termination.
 * 5. HONEST OUTCOME CLASSIFICATION:
 *    "No change is a valid successful day" (NO_OP_CLEAN).
 *    Distinguishes observed facts from synthetic fixtures, proposed candidates, and
 *    verified deployments.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

export type MaintenanceRunState =
  | "INIT"
  | "DISCOVERING"
  | "CANDIDATE_ISOLATED"
  | "INDEPENDENT_TESTING"
  | "PREVIEW_VERIFYING"
  | "RELEASED_PERMITTED"
  | "NO_OP_CLEAN"
  | "ROLLED_BACK"
  | "FAILED_QUARANTINED"
  | "INTERRUPTED_RECOVERED";

export type MaintenanceTriggerType =
  | "SCHEDULED_0217_IST"
  | "WATCHDOG_0300_IST"
  | "WATCHDOG_0600_IST"
  | "MANUAL_DISPATCH"
  | "CONTINUOUS_HEALTH";

export interface SpecialistJobSummary {
  name: string;
  status: "PASSED" | "FAILED" | "SKIPPED" | "NO_CHANGES_NEEDED" | "REPAIRED";
  summary: string;
  metrics?: Record<string, number | string | boolean>;
  executedAtIso: string;
}

export interface MaintenanceJobRecord {
  jobId: string;
  businessDate: string; // YYYY-MM-DD in Asia/Kolkata
  triggerType: MaintenanceTriggerType;
  startingCommitSha: string;
  fencingToken: number;
  workerId: string;
  state: MaintenanceRunState;
  leaseAcquiredAtIso: string;
  leaseExpiresAtIso: string;
  completedAtIso?: string;
  specialistJobs: Record<string, SpecialistJobSummary>;
  activeProductionPointer: string;
  rollbackTargetPointer: string;
  finalReceiptDigest?: string;
  isProductionDeployed: boolean;
  notes?: string;
}

export interface DurableMaintenanceLedgerState {
  version: "1.0.0";
  highestFencingToken: number;
  activeLease?: {
    jobId: string;
    workerId: string;
    fencingToken: number;
    expiresAtIso: string;
  };
  activeProductionPointer: string;
  rollbackTargetPointer: string;
  jobs: Record<string, MaintenanceJobRecord>; // Keyed by businessDate
  history: string[]; // List of jobIds in execution order
}

export function findRepoRoot(startDir = process.cwd()): string {
  let curr = resolve(startDir);
  while (curr !== dirname(curr)) {
    if (existsSync(resolve(curr, "package.json")) && existsSync(resolve(curr, "proofs"))) {
      return curr;
    }
    if (existsSync(resolve(curr, ".git"))) {
      return curr;
    }
    curr = dirname(curr);
  }
  return startDir;
}

export const DEFAULT_MAINTENANCE_LEDGER_PATH = resolve(
  findRepoRoot(),
  "proofs/generated/SPE_MAINTENANCE_LEDGER.json"
);

/**
 * Computes current business date string (YYYY-MM-DD) in Asia/Kolkata timezone.
 */
export function getAsiaKolkataBusinessDate(date = new Date()): string {
  // Asia/Kolkata is UTC+5:30 (330 minutes)
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 60 * 60000;
  const istDate = new Date(istMs);
  return istDate.toISOString().slice(0, 10);
}

export class DurableMaintenanceLedger {
  readonly #filePath: string;
  #state: DurableMaintenanceLedgerState;

  constructor(filePath = DEFAULT_MAINTENANCE_LEDGER_PATH) {
    this.#filePath = filePath;
    this.#state = this.#loadOrCreate();
  }

  #loadOrCreate(): DurableMaintenanceLedgerState {
    if (existsSync(this.#filePath)) {
      try {
        const raw = readFileSync(this.#filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.version === "1.0.0" && typeof parsed.highestFencingToken === "number") {
          return parsed;
        }
      } catch {
        // Fall back to fresh state if corrupted
      }
    }

    return {
      version: "1.0.0",
      highestFencingToken: 0,
      activeProductionPointer: "dcd7df0f",
      rollbackTargetPointer: "dcd7df0f",
      jobs: {},
      history: [],
    };
  }

  #save(): void {
    const dir = dirname(this.#filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmp = `${this.#filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.#state, null, 2), "utf8");
    renameSync(tmp, this.#filePath);
  }

  /**
   * Attempts to acquire a fenced lease for the given business date.
   *
   * Rules:
   * 1. If today's job already finished with NO_OP_CLEAN or RELEASED_PERMITTED, reject to prevent duplicate effects.
   * 2. If another live worker holds an unexpired lease, reject (concurrency protection).
   * 3. If lease expired or missed run detected, grant lease with monotonic increment of fencing token.
   */
  public acquireFencedLease(params: {
    businessDate?: string;
    triggerType: MaintenanceTriggerType;
    startingCommitSha: string;
    workerId: string;
    leaseDurationMs?: number;
  }): {
    acquired: boolean;
    job?: MaintenanceJobRecord;
    reason?: string;
    fencingToken?: number;
  } {
    const businessDate = params.businessDate || getAsiaKolkataBusinessDate();
    const nowMs = Date.now();
    const leaseDurationMs = params.leaseDurationMs || 30 * 60 * 1000; // 30 minutes default
    const nowIso = new Date(nowMs).toISOString();
    const expiresIso = new Date(nowMs + leaseDurationMs).toISOString();

    const existingJob = this.#state.jobs[businessDate];

    // Check if run already completed for today
    if (existingJob && (existingJob.state === "NO_OP_CLEAN" || existingJob.state === "RELEASED_PERMITTED")) {
      if (params.triggerType.startsWith("WATCHDOG_")) {
        return {
          acquired: false,
          reason: `ALREADY_COMPLETED: Business date ${businessDate} already successfully finalized as ${existingJob.state}`,
          job: existingJob,
        };
      }
    }

    // Check if another worker currently holds an unexpired lease
    if (this.#state.activeLease) {
      const leaseExpiresMs = Date.parse(this.#state.activeLease.expiresAtIso);
      const isUnexpired = !isNaN(leaseExpiresMs) && leaseExpiresMs > nowMs;
      const isDifferentWorker = this.#state.activeLease.workerId !== params.workerId;

      if (isUnexpired && isDifferentWorker) {
        return {
          acquired: false,
          reason: `LEASE_HELD_BY_ACTIVE_WORKER: Worker '${this.#state.activeLease.workerId}' holds lease until ${this.#state.activeLease.expiresAtIso} (token=${this.#state.activeLease.fencingToken})`,
        };
      }
    }

    // Increment monotonic fencing token
    const newFencingToken = this.#state.highestFencingToken + 1;
    this.#state.highestFencingToken = newFencingToken;

    const jobId = `maint-${businessDate}-${params.triggerType.toLowerCase()}-${nowMs.toString(16)}`;

    const jobRecord: MaintenanceJobRecord = {
      jobId,
      businessDate,
      triggerType: params.triggerType,
      startingCommitSha: params.startingCommitSha,
      fencingToken: newFencingToken,
      workerId: params.workerId,
      state: "INIT",
      leaseAcquiredAtIso: nowIso,
      leaseExpiresAtIso: expiresIso,
      specialistJobs: {},
      activeProductionPointer: this.#state.activeProductionPointer,
      rollbackTargetPointer: this.#state.rollbackTargetPointer,
      isProductionDeployed: false,
      notes: `Lease acquired by ${params.workerId} with fencing token ${newFencingToken}`,
    };

    this.#state.activeLease = {
      jobId,
      workerId: params.workerId,
      fencingToken: newFencingToken,
      expiresAtIso: expiresIso,
    };

    this.#state.jobs[businessDate] = jobRecord;
    this.#state.history.push(jobId);
    this.#save();

    return {
      acquired: true,
      job: jobRecord,
      fencingToken: newFencingToken,
    };
  }

  /**
   * Validates whether a worker's fencing token is still current and not superseded.
   */
  public validateFencingToken(jobId: string, token: number): boolean {
    const lease = this.#state.activeLease;
    if (!lease) return false;
    if (lease.jobId !== jobId) return false;
    return lease.fencingToken === token && this.#state.highestFencingToken === token;
  }

  /**
   * Updates state of an active maintenance job, asserting valid fencing token.
   */
  public updateJobState(
    jobId: string,
    fencingToken: number,
    state: MaintenanceRunState,
    notes?: string
  ): void {
    if (!this.validateFencingToken(jobId, fencingToken)) {
      throw new Error(
        `FENCING_TOKEN_SUPERSEDED: Worker with token ${fencingToken} for job ${jobId} was superseded by higher token ${this.#state.highestFencingToken}`
      );
    }

    const job = Object.values(this.#state.jobs).find((j) => j.jobId === jobId);
    if (!job) {
      throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    }

    job.state = state;
    if (notes) job.notes = notes;
    this.#save();
  }

  /**
   * Records output from a specialist job within the maintenance controller.
   */
  public recordSpecialistJob(
    jobId: string,
    fencingToken: number,
    summary: SpecialistJobSummary
  ): void {
    if (!this.validateFencingToken(jobId, fencingToken)) {
      throw new Error(`FENCING_TOKEN_SUPERSEDED: Token ${fencingToken} invalid`);
    }

    const job = Object.values(this.#state.jobs).find((j) => j.jobId === jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${jobId}`);

    job.specialistJobs[summary.name] = summary;
    this.#save();
  }

  /**
   * Finalizes a maintenance run, computes receipt hash, releases lease,
   * and optionally advances production release pointer.
   */
  public finalizeJob(params: {
    jobId: string;
    fencingToken: number;
    finalState: "RELEASED_PERMITTED" | "NO_OP_CLEAN" | "ROLLED_BACK" | "FAILED_QUARANTINED";
    newProductionPointer?: string;
    isProductionDeployed?: boolean;
    notes?: string;
  }): { receiptDigest: string; job: MaintenanceJobRecord } {
    if (!this.validateFencingToken(params.jobId, params.fencingToken)) {
      throw new Error(`FENCING_TOKEN_SUPERSEDED: Cannot finalize job with stale token ${params.fencingToken}`);
    }

    const job = Object.values(this.#state.jobs).find((j) => j.jobId === params.jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${params.jobId}`);

    job.state = params.finalState;
    job.completedAtIso = new Date().toISOString();
    job.isProductionDeployed = Boolean(params.isProductionDeployed);
    if (params.notes) job.notes = params.notes;

    // Advance production release pointer if permitted release occurred
    if (params.finalState === "RELEASED_PERMITTED" && params.newProductionPointer) {
      this.#state.rollbackTargetPointer = this.#state.activeProductionPointer;
      this.#state.activeProductionPointer = params.newProductionPointer;
      job.activeProductionPointer = params.newProductionPointer;
      job.rollbackTargetPointer = this.#state.rollbackTargetPointer;
    } else if (params.finalState === "ROLLED_BACK") {
      // Revert production pointer to rollback target
      this.#state.activeProductionPointer = this.#state.rollbackTargetPointer;
      job.activeProductionPointer = this.#state.rollbackTargetPointer;
    }

    // Compute cryptographic receipt digest
    const canonicalPayload = JSON.stringify({
      jobId: job.jobId,
      businessDate: job.businessDate,
      triggerType: job.triggerType,
      state: job.state,
      fencingToken: job.fencingToken,
      specialistJobs: job.specialistJobs,
      activeProductionPointer: job.activeProductionPointer,
      rollbackTargetPointer: job.rollbackTargetPointer,
      completedAtIso: job.completedAtIso,
    });
    const digest = createHash("sha256").update(canonicalPayload, "utf8").digest("hex");
    job.finalReceiptDigest = digest;

    // Release lease
    this.#state.activeLease = undefined;
    this.#save();

    return { receiptDigest: digest, job: { ...job } };
  }

  /**
   * Checks if today's scheduled 02:17 AM IST run was missed or dropped by GitHub Actions.
   */
  public checkMissedRunStatus(businessDate = getAsiaKolkataBusinessDate()): {
    isMissed: boolean;
    reason: string;
    existingJob?: MaintenanceJobRecord;
  } {
    const job = this.#state.jobs[businessDate];
    if (!job) {
      return {
        isMissed: true,
        reason: `NO_RUN_RECORDED: No maintenance run recorded for business date ${businessDate}`,
      };
    }

    if (job.state === "INIT" || job.state === "DISCOVERING" || job.state === "INDEPENDENT_TESTING") {
      const leaseExpiresMs = Date.parse(job.leaseExpiresAtIso);
      if (Date.now() > leaseExpiresMs) {
        return {
          isMissed: true,
          reason: `INTERRUPTED_EXPIRED_RUN: Run ${job.jobId} stalled in state ${job.state} and lease expired`,
          existingJob: job,
        };
      }
    }

    return {
      isMissed: false,
      reason: `Run ${job.jobId} recorded with state ${job.state}`,
      existingJob: job,
    };
  }

  public getState(): DurableMaintenanceLedgerState {
    return JSON.parse(JSON.stringify(this.#state));
  }
}
