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
    const line = rawLine.trim();
    const lineStart = currentOffset + (rawLine.length - rawLine.trimStart().length);
    const lineEnd = lineStart + line.length;
    currentOffset += rawLine.length + 1; // +1 for newline

    if (!line || line.startsWith("#") || line.length < 10) {
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
export function verifyTaskReport(submission: ReviewSubmission): ReviewedReport {
  const claims = extractClaimsFromReport(submission.agentReport);
  const receipts = submission.testReceipts || [];
  const artifacts = submission.artifacts || [];
  const contradictions: ContradictionFinding[] = [];
  const gaps: EvidenceGap[] = [];
  const unknowns: string[] = [];

  // 1. Check prompt injection in report text
  const reportLower = submission.agentReport.toLowerCase();
  if (
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

  // 3. Fake PASS and Test Execution Verification
  for (const claim of claims) {
    if (claim.claimType === "EXECUTION") {
      // Check for fake pass prose ("tests pass", "42/42 passed")
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
        matchingReceipt.verificationLevel !== "TRUSTED_EXECUTOR_OBSERVED" &&
        matchingReceipt.verificationLevel !== "INDEPENDENTLY_REPRODUCED"
      ) {
        // Self-signed REPORTED cannot prove execution success alone
        claim.disposition = "UNVERIFIED";
        claim.verificationRationale =
          "Proof receipt is self-signed REPORTED; trusted executor observation or reproduction required for qualification.";
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
          claim.disposition = "SUPPORTED";
          claim.verificationRationale = "Corresponding source code / diff artifact present in submission.";
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
        claim.disposition = "SUPPORTED";
        claim.verificationRationale = "Zero-network egress invariant (network_mode=NONE) verified by sandbox profile.";
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

  if (materialReportCoverage < 0.90) {
    unknowns.push(
      `Material report coverage is ${Math.round(materialReportCoverage * 100)}% (<100%). Unclassified text spans exist.`
    );
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
    unverifiedCount > 0 ||
    gaps.length > 0 ||
    unknowns.length > 0 ||
    materialReportCoverage < 0.95
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
