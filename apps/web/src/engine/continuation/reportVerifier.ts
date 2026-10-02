/**
 * SPE Task Report Verifier (Wave RT-A)
 *
 * Implements strict report verification, claim extraction, proof binding,
 * fake pass detection, and material span coverage tracking.
 *
 * Enforces Epistemic Invariants:
 * - CLAIMED != VERIFIED
 * - SOURCE_PRESENT != EXECUTION_PROVEN
 * - EXIT_0 != ASSERTIONS_OBSERVED
 * - UNKNOWN != PASS
 * - MATERIAL_REPORT_COVERAGE = 100% required for PASS
 */

import { computeSha256 } from "../hashUtils";
import type {
  ReviewSubmission,
  ReviewedReport,
  ClaimRecord,
  ClaimType,
  ReviewVerdict,
  ContradictionFinding,
  EvidenceGap,
} from "./types";
import {
  authorizedFieldIsNonAuthority,
  containsBidiOverride,
  extractClaimedTestCount,
  looksLikeInjection,
  normalizeUntrustedText,
  qualifyReceipt,
  reportHasContradiction,
  reportHasPassProse,
} from "./oracleGuards";
import { getScholarlyFabricTruthStatus } from "./researchFabric";

/**
 * Extracts material claims from raw report prose.
 */
export function extractClaimsFromReport(reportText: string): ClaimRecord[] {
  const claims: ClaimRecord[] = [];
  if (!reportText || !reportText.trim()) return claims;

  const lines = reportText.split("\n");
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = normalizeUntrustedText(rawLine).trim();
    const lineStart = currentOffset + (rawLine.length - rawLine.trimStart().length);
    const lineEnd = lineStart + line.length;
    currentOffset += rawLine.length + 1; // +1 for newline

    if (!line || line.startsWith("#") || /^[\s|:\-]+$/.test(line)) {
      continue;
    }
    const materialShort = /(\bpass\b|\bfail\b|\bexit\b|\d+\s*\/\s*\d+|[0-9a-f]{7,})/i.test(line);
    if (line.length < 10 && !materialShort) {
      continue;
    }

    // Classify claim type based on domain linguistics
    let claimType: ClaimType = "IMPLEMENTATION";
    const lower = line.toLowerCase();

    if (
      lower.includes("test") ||
      lower.includes("pass") ||
      lower.includes("fail") ||
      lower.includes("assert") ||
      lower.includes("exit code")
    ) {
      claimType = "EXECUTION";
    } else if (
      lower.includes("latency") ||
      lower.includes("throughput") ||
      lower.includes("benchmark") ||
      lower.includes("memory usage") ||
      lower.includes("speedup")
    ) {
      claimType = "PERFORMANCE";
    } else if (
      lower.includes("security") ||
      lower.includes("vulnerability") ||
      lower.includes("leak") ||
      lower.includes("egress") ||
      lower.includes("zero network") ||
      lower.includes("isolation") ||
      lower.includes("sanitiz")
    ) {
      claimType = "SECURITY";
    } else if (
      lower.includes("spec") ||
      lower.includes("rfc") ||
      lower.includes("standard") ||
      lower.includes("protocol") ||
      lower.includes("ordering") ||
      lower.includes("clock") ||
      lower.includes("algorithm")
    ) {
      claimType = "SPECIFICATION";
    }

    claims.push({
      claimId: `CLM-${claims.length + 1}-${computeSha256(line).slice(0, 8)}`,
      claimText: line,
      claimType,
      claimSpan: {
        start: lineStart,
        end: lineEnd,
        rawText: line,
      },
      disposition: "UNVERIFIED", // Initial disposition before proof binding
      verificationRationale: "Unverified claim extracted from agent report text.",
    });
  }

  return claims;
}

/**
 * Computes material report coverage.
 * Verifies what percentage of substantive report text has been accounted for by claims.
 */
export function calculateMaterialReportCoverage(
  reportText: string,
  claims: ClaimRecord[]
): number {
  if (!reportText || !reportText.trim()) return 1.0;

  // Filter substantive characters (ignoring whitespace and markdown header markers)
  const substantiveChars = reportText.replace(/[\s#*`_-]/g, "");
  if (substantiveChars.length === 0) return 1.0;

  let accountedChars = 0;
  for (const claim of claims) {
    const cleanClaim = claim.claimText.replace(/[\s#*`_-]/g, "");
    accountedChars += cleanClaim.length;
  }

  const ratio = Math.min(1.0, accountedChars / substantiveChars.length);
  return Number(ratio.toFixed(3));
}

/**
 * Validates and binds proof receipts against claims.
 */

const LIVE_TRUTH_CLAIM_RE =
  /FULL_SCHOLARLY_INDEX\s*=\s*YES|LIVE_RETRACTION_VERIFICATION\s*=\s*YES|LIVE_INDEX\s*=\s*PASS|LIVE_RETRACTION\s*=\s*PASS|full\s+scholarly\s+index|live\s+retraction\s+verification|live\s+scholarly\s+index/i;

function isCallerAssertedLiveTruth(text: string): boolean {
  return LIVE_TRUTH_CLAIM_RE.test(text);
}

function callerMintedUntrusted(submission: ReviewSubmission): string[] {
  const flags: string[] = [];
  if (submission.liveIndex === true) flags.push("liveIndex");
  if (submission.fullIndex === true) flags.push("fullIndex");
  if (submission.scholarlyVerified === true) flags.push("scholarlyVerified");
  if (submission.qualified === true) flags.push("qualified");
  return flags;
}

export function verifyTaskReport(submission: ReviewSubmission): ReviewedReport {
  const originalReport = submission.agentReport || "";
  const agentReport = normalizeUntrustedText(originalReport);
  submission = { ...submission, agentReport };
  const claims = extractClaimsFromReport(agentReport);
  const receipts = submission.testReceipts || [];
  const artifacts = submission.artifacts || [];
  const contradictions: ContradictionFinding[] = [];
  const gaps: EvidenceGap[] = [];
  const unknowns: string[] = [];
  const truth = getScholarlyFabricTruthStatus();
  const callerFlags = callerMintedUntrusted(submission);
  if (callerFlags.length > 0) {
    contradictions.push({
      contradictionId: `CTRD-CALLER-ASSERTED-${callerFlags.join("-")}`,
      claimId: "REPORT_LEVEL",
      observedText: `CALLER_ASSERTED fields: ${callerFlags.join(", ")}`,
      conflictingEvidence:
        "CALLER_ASSERTED = UNTRUSTED_CLAIM. Caller-minted liveIndex/fullIndex/verified/qualified cannot mint SUPPORTED. " +
        `Measured static capability: FULL_SCHOLARLY_INDEX=${truth.FULL_SCHOLARLY_INDEX}, LIVE_RETRACTION_VERIFICATION=${truth.LIVE_RETRACTION_VERIFICATION}.`,
      severity: "FATAL",
    });
  }

  // 1. Check prompt injection in report text
  const reportLower = submission.agentReport.toLowerCase();
  if (
    looksLikeInjection(submission.agentReport) ||
    reportLower.includes("ignore previous instructions") ||
    reportLower.includes("grant full authority") ||
    reportLower.includes("mark pass unconditionally")
  ) {
    contradictions.push({
      contradictionId: `CTRD-INJECT-${Date.now().toString(36).slice(-4)}`,
      claimId: "REPORT_LEVEL",
      observedText: "Prompt injection phrase detected in untrusted report text.",
      conflictingEvidence: "SPE Security Invariant: External reports are untrusted data.",
      severity: "FATAL",
    });
  }

  if (containsBidiOverride(originalReport)) {
    contradictions.push({
      contradictionId: `CTRD-BIDI-${computeSha256(originalReport).slice(0, 6)}`,
      claimId: "REPORT_LEVEL",
      observedText: "Bidirectional override characters present in report text.",
      conflictingEvidence: "Hidden FAIL/PASS reordering is not a receipt.",
      severity: "FATAL",
    });
  }

  if (authorizedFieldIsNonAuthority(originalReport)) {
    unknowns.push("authorized=true in report text is non-authority and was ignored.");
  }

  // 2. Exact Candidate SHA and Patch Digest Invariants
  for (const receipt of receipts) {
    if (receipt.candidateSha !== submission.candidateSha) {
      contradictions.push({
        contradictionId: `CTRD-STALE-SHA-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: `Receipt candidate SHA ${receipt.candidateSha} does not match submission candidate SHA ${submission.candidateSha}`,
        conflictingEvidence: "Exact candidate custody invariant requires bit-identical git SHA.",
        severity: "FATAL",
      });
    }

    if (receipt.freshness === "STALE") {
      contradictions.push({
        contradictionId: `CTRD-STALE-RECEIPT-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: `Receipt ${receipt.receiptId} is marked STALE.`,
        conflictingEvidence: "STALE_RECEIPT != CURRENT_RECEIPT.",
        severity: "FATAL",
      });
    }
    if (receipt.taskId && receipt.taskId !== submission.taskId) {
      contradictions.push({
        contradictionId: `CTRD-WRONG-TASK-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: `Receipt task ${receipt.taskId} != submission ${submission.taskId}`,
        conflictingEvidence: "Cross-task receipt rejected.",
        severity: "FATAL",
      });
    }
    if (receipt.repo && submission.repo && receipt.repo !== submission.repo) {
      contradictions.push({
        contradictionId: `CTRD-WRONG-REPO-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: `Receipt repo ${receipt.repo} != submission repo ${submission.repo}`,
        conflictingEvidence: "Cross-repo receipt rejected.",
        severity: "FATAL",
      });
    }
    if (receipt.proofClass === "ENFORCEMENT_VERIFIED") {
      contradictions.push({
        contradictionId: `CTRD-FAKE-PROOF-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: "Caller minted proofClass=ENFORCEMENT_VERIFIED.",
        conflictingEvidence: "Quality/WASM verification cannot be minted by the caller.",
        severity: "FATAL",
      });
    }
    if (submission.patchDigest && receipt.patchDigest !== submission.patchDigest) {
      contradictions.push({
        contradictionId: `CTRD-DIRTY-PATCH-${receipt.receiptId}`,
        claimId: "RECEIPT_LEVEL",
        observedText: `Receipt patch digest ${receipt.patchDigest || "NONE"} does not match submission dirty patch digest ${submission.patchDigest}`,
        conflictingEvidence: "Dirty worktree candidate requires matching uncommitted patch digest.",
        severity: "FATAL",
      });
    }
  }

  if (submission.worktreeDirty && !submission.patchDigest) {
    contradictions.push({
      contradictionId: "CTRD-DIRTY-NO-PATCH",
      claimId: "RECEIPT_LEVEL",
      observedText: "Dirty worktree candidate without patch digest.",
      conflictingEvidence: "DIRTY_WITHOUT_PATCH_DIGEST.",
      severity: "FATAL",
    });
  }

  const claimedCount = extractClaimedTestCount(agentReport);
  // 3. Fake PASS and Test Execution Verification
  for (const claim of claims) {
    if (isCallerAssertedLiveTruth(claim.claimText)) {
      // Prose or flag claiming live/full index without bound live evidence.
      // Static capability is NO — never SUPPORTED from prose.
      if (
        truth.FULL_SCHOLARLY_INDEX !== "YES" ||
        truth.LIVE_RETRACTION_VERIFICATION !== "YES"
      ) {
        claim.disposition = "CONTRADICTED";
        claim.verificationRationale =
          "UNTRUSTED_CLAIM: FULL_SCHOLARLY_INDEX/LIVE_RETRACTION asserted without bound live evidence. " +
          `Static capability remains FULL_SCHOLARLY_INDEX=${truth.FULL_SCHOLARLY_INDEX}, ` +
          `LIVE_RETRACTION_VERIFICATION=${truth.LIVE_RETRACTION_VERIFICATION}. CALLER_ASSERTED != EVIDENCE.`;
        contradictions.push({
          contradictionId: `CTRD-LIVE-TRUTH-${claim.claimId}`,
          claimId: claim.claimId,
          observedText: claim.claimText,
          conflictingEvidence:
            "LIVE_INDEX/LIVE_RETRACTION/FULL_SCHOLARLY_INDEX=YES without bound evidence is CONTRADICTED. RT_B_LIVE_INDEX=HOLD, RT_B_LIVE_RETRACTION=HOLD.",
          severity: "FATAL",
        });
        continue;
      }
    }
    if (claim.claimType === "EXECUTION") {
      const matchingReceipt = receipts.find(
        (r) => r.candidateSha === submission.candidateSha && r.exitCode === 0
      );

      if (!matchingReceipt) {
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale =
          "Agent claimed test success in prose, but zero verifiable ProofReceipt was supplied.";
        gaps.push({
          gapId: `GAP-NO-RECEIPT-${claim.claimId}`,
          claimId: claim.claimId,
          description: `Execution claim "${claim.claimText.slice(0, 50)}..." lacks bound ProofReceipt.`,
          missingProofType: "EXECUTION",
        });
      } else if (matchingReceipt.totalSelectedTests === 0) {
        // Fake pass: exit 0 but 0 tests ran
        claim.disposition = "CONTRADICTED";
        claim.verificationRationale =
          "Process exited with code 0, but totalSelectedTests was 0 (zero test assertions observed).";
        contradictions.push({
          contradictionId: `CTRD-ZERO-TESTS-${claim.claimId}`,
          claimId: claim.claimId,
          observedText: claim.claimText,
          conflictingEvidence: "Receipt shows exit code 0 with 0 tests selected.",
          severity: "FATAL",
        });
      } else if (matchingReceipt.skippedTests === matchingReceipt.totalSelectedTests) {
        // Fake pass: all tests skipped
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale =
          `All ${matchingReceipt.totalSelectedTests} selected tests were skipped. No active assertions ran.`;
        gaps.push({
          gapId: `GAP-ALL-SKIPPED-${claim.claimId}`,
          claimId: claim.claimId,
          description: "All selected tests were skipped; execution remains unverified.",
          missingProofType: "EXECUTION",
        });
      } else if (
        claimedCount !== null &&
        claimedCount !== matchingReceipt.totalSelectedTests
      ) {
        claim.disposition = "CONTRADICTED";
        claim.verificationRationale = `Claimed test count ${claimedCount} does not match receipt selection ${matchingReceipt.totalSelectedTests}.`;
        contradictions.push({
          contradictionId: `CTRD-COUNT-${claim.claimId}`,
          claimId: claim.claimId,
          observedText: claim.claimText,
          conflictingEvidence: "Inflated or mismatched test count.",
          severity: "FATAL",
        });
      } else if (!qualifyReceipt(matchingReceipt, submission).independent) {
        // Self-signed REPORTED cannot prove execution success alone
        claim.disposition = "UNVERIFIED";
        const q = matchingReceipt ? qualifyReceipt(matchingReceipt, submission) : { reasons: ["NO_RECEIPT"] };
        claim.verificationRationale =
          `Receipt is not independent proof (${q.reasons.join(",") || "UNQUALIFIED"}). REPORTED != INDEPENDENT.`;
        unknowns.push(
          `Execution claim "${claim.claimText.slice(0, 50)}" is unverified until independent reproduction.`
        );
      } else {
        // Legitimate verified execution receipt!
        claim.disposition = "SUPPORTED";
        claim.boundReceiptId = matchingReceipt.receiptId;
        claim.verificationRationale = `Verified by ${matchingReceipt.producerIdentity} (${matchingReceipt.verificationLevel}): ${matchingReceipt.totalSelectedTests - matchingReceipt.skippedTests} assertions passed with exit code 0.`;
      }
    } else if (claim.claimType === "IMPLEMENTATION") {
      const claimLower = claim.claimText.toLowerCase();
      if (
        claimLower.includes("unknown") ||
        claimLower.includes("pending") ||
        claimLower.includes("unverified") ||
        claimLower.includes("untested")
      ) {
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale = "Claim explicitly notes pending, untested, or unknown implementation state.";
        unknowns.push(claim.claimText);
      } else {
        // Implementation claim verification against matching artifacts
        const hasArtifact = artifacts.some(
          (art) =>
            claimLower.includes(art.path.toLowerCase()) ||
            art.path.toLowerCase().includes(claimLower.slice(0, 20))
        );

        if (hasArtifact) {
          // SOURCE_PRESENT != EXECUTION_PROVEN. Artifact presence stays UNVERIFIED.
          claim.disposition = "UNVERIFIED";
          claim.verificationRationale =
            "Source artifact is present but SOURCE_PRESENT != EXECUTION_PROVEN. Not a verified execution claim.";
          unknowns.push(`Implementation claim has source present only: ${claim.claimText.slice(0, 60)}`);
        } else {
          claim.disposition = "UNVERIFIED";
          claim.verificationRationale = "Source implementation claimed, but no matching artifact path provided.";
          gaps.push({
            gapId: `GAP-SOURCE-${claim.claimId}`,
            claimId: claim.claimId,
            description: `Implementation claim "${claim.claimText.slice(0, 50)}" has no matching source artifact.`,
            missingProofType: "EXECUTION",
          });
        }
      }
    } else if (claim.claimType === "SECURITY") {
      // Security claim verification
      if (claim.claimText.toLowerCase().includes("zero egress") || claim.claimText.toLowerCase().includes("no network")) {
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale =
          "Security prose is not a receipt. Zero-egress text stays UNVERIFIED until an independent executor receipt exists.";
        gaps.push({
          gapId: `GAP-SEC-${claim.claimId}`,
          claimId: claim.claimId,
          description: "Security claim lacks independent receipt.",
          missingProofType: "SAFETY",
        });
      } else {
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale = "Security claim requires dedicated red-team audit receipt.";
        unknowns.push(`Security assertion "${claim.claimText.slice(0, 50)}" requires dynamic verification.`);
      }
    } else {
      // Performance / Specification defaults
      claim.disposition = "UNVERIFIED";
      claim.verificationRationale = "Specialized benchmark or formal verification receipt pending.";
      unknowns.push(`Claim "${claim.claimText.slice(0, 50)}" remains an unverified hypothesis.`);
    }
  }

  // 4. Calculate Material Report Coverage
  const materialReportCoverage = calculateMaterialReportCoverage(
    submission.agentReport,
    claims
  );

  if (materialReportCoverage < 1) {
    unknowns.push(
      `Material report coverage is ${Math.round(materialReportCoverage * 100)}% (<100%). Unclassified text spans exist.`
    );
  }
  if (reportHasPassProse(agentReport) && reportHasContradiction(agentReport)) {
    contradictions.push({
      contradictionId: "CTRD-LATER-CONTRADICTION",
      claimId: "REPORT_LEVEL",
      observedText: "Report contains both pass prose and a later failure/zero-test statement.",
      conflictingEvidence: "Executable/later contradiction outranks earlier PASS prose.",
      severity: "FATAL",
    });
  }

  // 5. Determine Overall Verdict
  const supportedCount = claims.filter((c) => c.disposition === "SUPPORTED").length;
  const unverifiedCount = claims.filter((c) => c.disposition === "UNVERIFIED").length;
  const contradictedCount = claims.filter((c) => c.disposition === "CONTRADICTED").length;
  const hasFatalContradiction = contradictions.some((c) => c.severity === "FATAL");

  let verdict: ReviewVerdict = "PASS";

  if (hasFatalContradiction || contradictedCount > 0) {
    verdict = "FAIL";
  } else if (
    claims.length === 0 ||
    unverifiedCount > 0 ||
    gaps.length > 0 ||
    unknowns.length > 0 ||
    materialReportCoverage < 1 ||
    (reportHasPassProse(agentReport) && !receipts.some((r) => qualifyReceipt(r, submission).independent))
  ) {
    verdict = "HOLD";
  }

  // 6. Format Markdown Review Report
  const claimRows = claims.map(
    (c) =>
      `| ${c.disposition === "SUPPORTED" ? "✓" : c.disposition === "CONTRADICTED" ? "!" : "?"} ${c.disposition} | ${c.claimType} | ${c.claimText.slice(0, 60)} | ${c.verificationRationale.slice(0, 80)} |`
  );

  const formattedReportText = `## SPE Verified Task Review Report
Verdict: **${verdict}** | Material Coverage: **${Math.round(materialReportCoverage * 100)}%**
Candidate SHA: \`${submission.candidateSha}\`

### Material Claims Audit
| Disposition | Type | Claim Text | Verification Basis |
|-------------|------|------------|-------------------|
${claimRows.join("\n")}

### Summary Statistics
- Total Claims Extracted: ${claims.length}
- Verified & Supported: ${supportedCount}
- Unverified Claims: ${unverifiedCount}
- Contradicted Claims: ${contradictedCount}
- Identified Gaps: ${gaps.length}
- Open Unknowns: ${unknowns.length}

${contradictions.length > 0 ? `### Contradictions Detected:\n${contradictions.map((c) => `- [!] ${c.observedText}: ${c.conflictingEvidence}`).join("\n")}\n` : ""}
${gaps.length > 0 ? `### Evidence Gaps:\n${gaps.map((g) => `- [?] ${g.description}`).join("\n")}\n` : ""}
${unknowns.length > 0 ? `### Remaining Unknowns:\n${unknowns.map((u) => `- [?] ${u}`).join("\n")}` : ""}`;

  return {
    taskId: submission.taskId,
    candidateSha: submission.candidateSha,
    verdict,
    materialReportCoverage,
    totalClaimsCount: claims.length,
    supportedClaimsCount: supportedCount,
    unverifiedClaimsCount: unverifiedCount,
    contradictedClaimsCount: contradictedCount,
    claims,
    proofReceipts: receipts,
    contradictions,
    gaps,
    unknowns,
    formattedReportText,
  };
}
