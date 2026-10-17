/**
 * SPE Ω — Proof-Carrying Website Changes & Governance Authority Engine (PCWC-GAE)
 *
 * Mandate:
 * Grounded in:
 * - Proof-Carrying Code (Necula 1997 / SAGEO Arena 2026 / SWE-bench Goes Live! 2025):
 *   Every proposed change includes a reproducible problem, isolated patch,
 *   verification record, impact analysis, and verified rollback reference.
 * - Two-Sided Evidence Adjudicator (2SEA): Anti-false-acceptance kill rate >= 0.95
 *   and anti-false-rejection constraint relaxation.
 * - Evaluator Authority Firewall (EAF): Detection of hostile oracle weakening and reward hacking.
 * - Silent-Failure Watchdog (When Errors Become Narratives 2026): Rejecting plausible-sounding
 *   claims when underlying tests or properties fail.
 * - Autonomy Levels: L0 through L5 with explicit release authority.
 */

import type {
  ProofCarryingChangeProposal,
  AutonomyLevel,
  ProposalStatus,
  DefectCategory,
} from "./types.ts";
import { computeSha256 } from "../hashUtils.ts";

export class ProofCarryingEvolutionController {
  private allowedAutoReleaseCategories: Set<DefectCategory> = new Set([
    "BROKEN_INTERNAL_LINK",
    "SITEMAP_INCONSISTENCY",
    "INVALID_STRUCTURED_DATA",
  ]);

  /**
   * Generates a tamper-proof cryptographic verification digest for a change proposal.
   */
  public computeProposalDigest(proposal: Partial<ProofCarryingChangeProposal>): string {
    const raw = JSON.stringify({
      id: proposal.id,
      category: proposal.defectCategory,
      patch: proposal.minimalPatch,
      failingTest: proposal.failingTestBeforeFix?.testName,
      risk: proposal.riskLevel,
      rollback: proposal.rollbackReference?.snapshotCommit,
    });

    const hash = computeSha256(raw);
    return `sha256:prop-${hash.slice(0, 16)}`;
  }

  /**
   * Evaluates change proposal against strict Release Authority Gates.
   */
  public evaluateReleaseAuthority(proposal: ProofCarryingChangeProposal): {
    status: ProposalStatus;
    authorizedAutonomyLevel: AutonomyLevel;
    authorizedForLiveDeploy: boolean;
    auditLog: string[];
  } {
    const auditLog: string[] = [];

    // 0. Sparse or Inconclusive Evidence Check (T25: No reliable search data -> Mark SEO proposal inconclusive)
    if (
      proposal.observedEvidence &&
      (proposal.observedEvidence.confidenceScore < 0.5 || !proposal.observedEvidence.isFinalized)
    ) {
      auditLog.push("Search Console Evidence Inconclusive: Proposal held pending reliable finalized data.");
      return {
        status: "HELD_INCONCLUSIVE",
        authorizedAutonomyLevel: "L0_OBSERVE",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 1. Silent-Failure Watchdog (When Errors Become Narratives 2026)
    if (!proposal.failingTestBeforeFix.reproduced) {
      auditLog.push("Silent Failure Watchdog REJECT: Problem was not reproduced with a failing test before fix.");
      return {
        status: "REJECTED",
        authorizedAutonomyLevel: "L1_DIAGNOSE",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 2. Evaluator Authority Firewall (Anti-Reward Hacking / Test Tampering)
    if (!proposal.qualificationResults.oracleIntegrityPreserved) {
      auditLog.push("Evaluator Authority Firewall CRITICAL REJECT: Test suite was modified or weakened to force PASS.");
      return {
        status: "REJECTED",
        authorizedAutonomyLevel: "L1_DIAGNOSE",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 3. Test Qualification Check
    const testsPassed =
      proposal.qualificationResults.targetedUnitTestsPassed &&
      proposal.qualificationResults.regressionSuitePassed &&
      proposal.qualificationResults.securityPolicyPassed &&
      proposal.qualificationResults.visualA11yPassed &&
      proposal.qualificationResults.seoPolicyPassed;

    if (!testsPassed) {
      auditLog.push("Qualification Failed: One or more test dimensions failed regression gates.");
      return {
        status: "REJECTED",
        authorizedAutonomyLevel: "L3_QUALIFY",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 4. Anti-False-Acceptance (Kill Rate >= 0.95)
    if (proposal.qualificationResults.antiMutationKillRate < 0.95) {
      auditLog.push(
        `Anti-Mutation Test Gate Failed: Kill rate ${(proposal.qualificationResults.antiMutationKillRate * 100).toFixed(1)}% < 95% threshold.`
      );
      return {
        status: "REJECTED",
        authorizedAutonomyLevel: "L3_QUALIFY",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 5. Rollback Capability Verification
    if (!proposal.rollbackReference.verifiedRollbackCapable) {
      auditLog.push("Rollback Verification Failed: Proposal lacks a demonstrated, validated rollback recipe.");
      return {
        status: "REJECTED",
        authorizedAutonomyLevel: "L3_QUALIFY",
        authorizedForLiveDeploy: false,
        auditLog,
      };
    }

    // 6. Risk Level vs Autonomy Level Promotion
    if (proposal.riskLevel === "LOW" && this.allowedAutoReleaseCategories.has(proposal.defectCategory)) {
      auditLog.push("LOW RISK Allowlisted Mechanical Fix: Approved for L4 Limited Auto-Release.");
      return {
        status: "PROMOTED",
        authorizedAutonomyLevel: "L4_LIMITED_AUTO_RELEASE",
        authorizedForLiveDeploy: true,
        auditLog,
      };
    }

    // Medium and High risk changes REQUIRE human authorization (L5)
    auditLog.push(
      `Risk level is ${proposal.riskLevel} (${proposal.defectCategory}). Gated for L5 Human-Authorized Release.`
    );
    return {
      status: "APPROVED_FOR_RELEASE", // Staged for human sign-off PR, NOT autonomous push
      authorizedAutonomyLevel: "L5_HUMAN_AUTHORIZED",
      authorizedForLiveDeploy: false, // Requires explicit human merge
      auditLog,
    };
  }

  /**
   * Legacy rollback demonstration interface. No actual rollback executor is attached here.
   * Fail closed: only an independently executed and verified rollback may report success.
   */
  public executeRollbackDemonstration(proposal: ProofCarryingChangeProposal): {
    success: boolean;
    restoredCommit: string;
    receiptId: string;
    details: string;
  } {
    // A snapshot reference is a rollback *proposal*, not an execution receipt.
    // In particular, do not mint a timestamp-based receipt without performing a rollback.
    void proposal;
    return {
      success: false,
      restoredCommit: "",
      receiptId: "",
      details: "NOT_EXECUTED: rollback was not performed. Supply an independently verified restore receipt before qualification.",
    };
  }
}
