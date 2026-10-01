/**
 * SPE Gilden Interface & Authority Boundary Controller (Wave RT-E)
 *
 * Enforces strict separation of concerns between SPE and Gilden:
 * - Gilden = External Autonomous Worker
 * - SPE = Advisory Evidence & Review Layer
 *
 * Strict Governance Laws:
 * - SPE_REVIEW != GILDEN_AUTHORITY
 * - SPE_NEXT_TASK != DEPLOY_PERMISSION
 * - RESEARCH_RECOMMENDATION != EXECUTION_APPROVAL
 * - GILDEN_CAN_SELF_GRANT_AUTHORITY = NO
 * - Maximum autonomous repair cycles: 3
 */

import type { ReviewSubmission, ReviewedReport, ContinuationContract } from "./types";

export type GildenTerminalStatus =
  | "PASS"
  | "HOLD"
  | "FAIL"
  | "NEEDS_EVIDENCE"
  | "NEEDS_CREDENTIAL"
  | "NEEDS_APPROVAL"
  | "WAIT_FOR_HUMAN";

export interface GildenCycleState {
  taskId: string;
  cycleCount: number;
  maxCycles: number;
  terminalStatus: GildenTerminalStatus;
  canContinue: boolean;
  blockReason?: string;
}

export interface GildenReviewOutput {
  review: ReviewedReport;
  continuationContract: ContinuationContract;
  cycleState: GildenCycleState;
  governanceAttestation: {
    authority: "ADVISORY_ONLY";
    deployPermissionGranted: false;
    mergePermissionGranted: false;
    selfGrantedAuthorityAttempted: boolean;
  };
}

/**
 * Validates Gilden submission authority and manages bounded execution loops.
 */
export function processGildenReview(
  submission: ReviewSubmission,
  reviewedReport: ReviewedReport,
  continuationContract: ContinuationContract,
  currentCycle: number = 1
): GildenReviewOutput {
  const maxCycles = 3;
  let selfGrantedAuthorityAttempted = false;

  // 1. Detect illegal authority escalation attempts
  if (
    (submission.authority as string) === "FULL" ||
    (submission.authority as string) === "DEPLOY_ALLOWED" ||
    submission.agentReport.toLowerCase().includes("grant deploy authority")
  ) {
    selfGrantedAuthorityAttempted = true;
  }

  // 2. Compute terminal loop status and bounds
  let terminalStatus: GildenTerminalStatus = "HOLD";
  let canContinue = false;
  let blockReason: string | undefined = undefined;

  if (selfGrantedAuthorityAttempted) {
    terminalStatus = "NEEDS_APPROVAL";
    canContinue = false;
    blockReason = "Authority escalation attempt rejected: SPE cannot grant autonomous deployment authority.";
  } else if (currentCycle > maxCycles) {
    terminalStatus = "WAIT_FOR_HUMAN";
    canContinue = false;
    blockReason = `Maximum autonomous repair cycles (${maxCycles}) exhausted. Requires founder intervention.`;
  } else if (reviewedReport.verdict === "PASS") {
    terminalStatus = "PASS";
    canContinue = true;
  } else if (reviewedReport.verdict === "FAIL") {
    terminalStatus = "FAIL";
    // Allow bounded repair up to max cycles
    canContinue = currentCycle < maxCycles;
    if (!canContinue) {
      blockReason = `Defect unresolved after ${currentCycle} repair cycles. Halting for human review.`;
    }
  } else {
    // HOLD verdict
    if (reviewedReport.gaps.some((g) => g.missingProofType === "EXECUTION")) {
      terminalStatus = "NEEDS_EVIDENCE";
    } else {
      terminalStatus = "HOLD";
    }
    canContinue = currentCycle < maxCycles;
    if (!canContinue) {
      blockReason = `Unverified claims remain after ${currentCycle} cycles. Halting for human review.`;
    }
  }

  const cycleState: GildenCycleState = {
    taskId: submission.taskId,
    cycleCount: currentCycle,
    maxCycles,
    terminalStatus,
    canContinue,
    blockReason,
  };

  return {
    review: reviewedReport,
    continuationContract,
    cycleState,
    governanceAttestation: {
      authority: "ADVISORY_ONLY",
      deployPermissionGranted: false,
      mergePermissionGranted: false,
      selfGrantedAuthorityAttempted,
    },
  };
}
