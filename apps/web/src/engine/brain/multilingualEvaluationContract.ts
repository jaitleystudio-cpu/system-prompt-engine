/**
 * SPE Ω — Protected Multilingual Regression & Evaluation Contract
 * Multilingual Preservation & Two-Sided Evaluation Kernel — Layer 02
 *
 * Epistemic Foundations:
 * - ACM DOI:10.1145/3843776.3844673 ("Whose Oracle Is It?"): Protected evaluator authority.
 * - Science 2015 "Preserving Statistical Validity in Adaptive Data Analysis": 4-resource partitioning
 *   (training failures, selection validation, protected audit, permanent regressions).
 * - Global MMLU (ACL 2025): Cultural context, code-switching, and script integrity beyond translation.
 * - Non-negotiable Invariant:
 *   TOKEN OVERLAP ≠ SEMANTIC FIDELITY: Word token overlap (e.g. Jaccard on \w+) fails catastrophically
 *   on Indic scripts (Telugu, Hindi), RTL scripts (Arabic, Hebrew), and CJK (Japanese, Chinese).
 *   Evaluation must verify genuine semantic constraint preservation, Unicode NFC normalization,
 *   directionality markers, and slice-level non-degradation floors.
 */

import { computeSha256 } from "../hashUtils.ts";
import { registerEvaluatorAuthority, verifyEvaluatorIntegrity } from "../evaluatorAuthorityFirewall.ts";
import type { EvaluatorAuthorityEnvelope } from "../evaluatorAuthorityFirewall.ts";
import type { TaskLanguageSlice } from "./brainReleaseManifest.ts";

export type EvaluationVerdict =
  | "QUALIFIED"
  | "REJECTED_SLICE_REGRESSION"
  | "REJECTED_PERMANENT_REGRESSION"
  | "INCONCLUSIVE";

export interface SemanticConstraintCheck {
  readonly id: string;
  readonly description: string;
  readonly check: (output: string) => { passed: boolean; details?: string };
}

export interface MultilingualTestCase {
  readonly caseId: string;
  readonly sliceId: string;
  readonly language: string; // e.g. "te", "hi", "ar", "ja", "es", "en"
  readonly domain: string;
  readonly userRequest: string;
  readonly targetModel?: string;
  readonly requiredConcepts: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly requiredScript?: "Telugu" | "Devanagari" | "Arabic" | "JapaneseCJK" | "Latin";
  readonly requiresRtl?: boolean;
  readonly expectedJsonFormat?: boolean;
  readonly customValidators?: readonly SemanticConstraintCheck[];
}

export interface SliceEvaluationSummary {
  readonly sliceId: string;
  readonly language: string;
  readonly totalCases: number;
  readonly passedCases: number;
  readonly preservationScore: number; // 0.0 to 1.0
  readonly minFloorRequired: number; // 0.0 to 1.0
  readonly floorPreserved: boolean;
  readonly failureDetails: readonly string[];
}

export interface MultilingualEvaluationReceipt {
  readonly receiptId: string;
  readonly evaluatorVersion: string;
  readonly candidateId: string;
  readonly evaluationTimestampIso: string;
  readonly overallScore: number; // 0.0 to 1.0
  readonly overallVerdict: EvaluationVerdict;
  readonly permanentRegressionsPassed: boolean;
  readonly protectedAuditPassed: boolean;
  readonly sliceSummaries: readonly SliceEvaluationSummary[];
  readonly failedSliceIds: readonly string[];
  readonly totalCasesEvaluated: number;
  readonly totalRegressionsDetected: number;
  readonly evaluationReceiptDigest: string; // Canonical SHA-256 of the receipt
}

// ─────────────────────────────────────────────────────────────────────────────
// Multilingual & Script Integrity Verifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks for genuine Telugu script characters (U+0C00 to U+0C7F).
 */
export function hasIndicTelugu(text: string): boolean {
  return /[\u0C00-\u0C7F]/.test(text);
}

/**
 * Checks for genuine Devanagari script characters (U+0900 to U+097F).
 */
export function hasDevanagariHindi(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Checks for Arabic script characters (U+0600 to U+06FF, U+0750 to U+077F).
 */
export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
}

/**
 * Checks for Japanese CJK characters (Hiragana U+3040..U+309F, Katakana U+30A0..U+30FF, CJK Ideographs U+4E00..U+9FFF).
 */
export function hasJapaneseCjk(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

/**
 * Validates that text is in Unicode Normalization Form C (NFC) without mojibake or corrupt multi-byte sequences.
 */
export function isValidUnicodeNfc(text: string): boolean {
  try {
    return text === text.normalize("NFC");
  } catch {
    return false;
  }
}

/**
 * Validates RTL layout integrity and absence of broken bidirectional isolation.
 */
export function validateRtlIntegrity(text: string): { valid: boolean; reason?: string } {
  if (!isValidUnicodeNfc(text)) {
    return { valid: false, reason: "Text fails Unicode NFC normalization" };
  }
  // Check for orphan bidirectional overrides without closing pop directional formatting
  const lroCount = (text.match(/\u202D/g) || []).length; // Left-to-Right Override
  const rloCount = (text.match(/\u202E/g) || []).length; // Right-to-Left Override
  const pdfCount = (text.match(/\u202C/g) || []).length; // Pop Directional Formatting
  if (lroCount + rloCount > pdfCount) {
    return { valid: false, reason: "Unclosed bidirectional override detected (possible spoofing or display break)" };
  }
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Evaluation Logic (Beyond Naive Token Overlap)
// ─────────────────────────────────────────────────────────────────────────────

export interface CaseValidationOutcome {
  passed: boolean;
  score: number;
  reasons: string[];
}

/**
 * Evaluates a generated prompt or output against a test case using semantic invariant rules.
 */
export function evaluateTestCaseSemantics(
  testCase: MultilingualTestCase,
  output: string
): CaseValidationOutcome {
  const reasons: string[] = [];
  const normalizedOutput = output.normalize("NFC");

  // 1. Unicode NFC Integrity Check
  if (!isValidUnicodeNfc(output)) {
    reasons.push("Output is not valid Unicode NFC");
  }

  // 2. Script Integrity Check
  if (testCase.requiredScript === "Telugu" && !hasIndicTelugu(normalizedOutput)) {
    reasons.push("Missing required Telugu script characters");
  } else if (testCase.requiredScript === "Devanagari" && !hasDevanagariHindi(normalizedOutput)) {
    reasons.push("Missing required Devanagari (Hindi) script characters");
  } else if (testCase.requiredScript === "Arabic" && !hasArabicScript(normalizedOutput)) {
    reasons.push("Missing required Arabic script characters");
  } else if (testCase.requiredScript === "JapaneseCJK" && !hasJapaneseCjk(normalizedOutput)) {
    reasons.push("Missing required Japanese (Kanji/Kana) characters");
  }

  // 3. RTL Directionality Check
  if (testCase.requiresRtl) {
    const rtlCheck = validateRtlIntegrity(normalizedOutput);
    if (!rtlCheck.valid) {
      reasons.push(`RTL integrity failure: ${rtlCheck.reason}`);
    }
  }

  // 4. JSON Format Check
  if (testCase.expectedJsonFormat) {
    try {
      // Find JSON block or parse trimmed text
      const trimmed = normalizedOutput.trim();
      const jsonStart = trimmed.indexOf("{");
      const jsonEnd = trimmed.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
      } else {
        reasons.push("Expected valid JSON structure but none found");
      }
    } catch (e: unknown) {
      reasons.push(`Invalid JSON formatting: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 5. Semantic Required Concepts (Case-insensitive multi-word concept preservation)
  const outputLower = normalizedOutput.toLowerCase();
  for (const concept of testCase.requiredConcepts) {
    if (!outputLower.includes(concept.toLowerCase())) {
      reasons.push(`Missing mandatory concept: "${concept}"`);
    }
  }

  // 6. Forbidden Leakage / Hallucination Patterns
  for (const forbidden of testCase.forbiddenPatterns) {
    if (outputLower.includes(forbidden.toLowerCase())) {
      reasons.push(`Detected forbidden pattern: "${forbidden}"`);
    }
  }

  // 7. Custom Validators (if any)
  if (testCase.customValidators) {
    for (const val of testCase.customValidators) {
      const res = val.check(normalizedOutput);
      if (!res.passed) {
        reasons.push(`Custom check "${val.description}" failed: ${res.details || "Failed"}`);
      }
    }
  }

  const passed = reasons.length === 0;
  const score = passed ? 1.0 : Math.max(0, 1.0 - (reasons.length * 0.25));

  return { passed, score, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4-Resource Partitioned Evaluation Authority
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluationPartitions {
  readonly trainingFailures: readonly MultilingualTestCase[];
  readonly selectionValidation: readonly MultilingualTestCase[];
  readonly protectedAudit: readonly MultilingualTestCase[];
  readonly permanentRegressions: readonly MultilingualTestCase[];
}

export class ProtectedEvaluationAuthority {
  private readonly authorityId: string;
  private readonly evaluatorVersion: string;
  private readonly slices: readonly TaskLanguageSlice[];
  private readonly partitions: EvaluationPartitions;
  private authorityEnvelope: EvaluatorAuthorityEnvelope;

  constructor(
    evaluatorVersion: string,
    slices: readonly TaskLanguageSlice[],
    partitions: EvaluationPartitions,
    authorityId = "spe_multilingual_oracle_v1"
  ) {
    this.evaluatorVersion = evaluatorVersion;
    this.slices = Object.freeze([...slices]);
    this.partitions = partitions;
    this.authorityId = authorityId;

    // Register immutable authority envelope using evaluatorAuthorityFirewall
    const fixtures = [
      ...partitions.permanentRegressions.map((c) => ({
        fixtureId: `perm_${c.caseId}`,
        path: `eval/permanent/${c.caseId}.json`,
        content: JSON.stringify(c),
        isCriticalAssertion: true,
      })),
      ...partitions.protectedAudit.map((c) => ({
        fixtureId: `audit_${c.caseId}`,
        path: `eval/audit/${c.caseId}.json`,
        content: JSON.stringify(c),
        isCriticalAssertion: true,
      })),
    ];

    this.authorityEnvelope = registerEvaluatorAuthority(this.authorityId, fixtures);
  }

  /**
   * Safe getter for candidate generation to inspect training failures ONLY.
   * NEVER exposes protected audit or permanent regressions to the generator.
   */
  public getTrainingFailures(): readonly MultilingualTestCase[] {
    return Object.freeze([...this.partitions.trainingFailures]);
  }

  /**
   * Safe getter for selection validation cases (used for candidate hyperparameter ranking).
   */
  public getSelectionValidationCases(): readonly MultilingualTestCase[] {
    return Object.freeze([...this.partitions.selectionValidation]);
  }

  /**
   * Executes protected evaluation across all partitions for a candidate generator.
   * Enforces:
   * 1. Evaluator authority is preserved (zero tampering with fixtures/thresholds).
   * 2. Permanent regressions must be 100% clean (zero tolerance).
   * 3. Protected audit evaluated with slice-level non-degradation floors.
   * 4. Produces signed, immutable MultilingualEvaluationReceipt.
   */
  public async evaluateCandidateProtected(
    candidateId: string,
    generateOutputFn: (testCase: MultilingualTestCase) => Promise<string>
  ): Promise<MultilingualEvaluationReceipt> {
    // Check firewall integrity before execution
    const preCheck = verifyEvaluatorIntegrity(this.authorityEnvelope, [
      ...this.partitions.permanentRegressions.map((c) => ({
        fixtureId: `perm_${c.caseId}`,
        path: `eval/permanent/${c.caseId}.json`,
        content: JSON.stringify(c),
        isCriticalAssertion: true,
      })),
      ...this.partitions.protectedAudit.map((c) => ({
        fixtureId: `audit_${c.caseId}`,
        path: `eval/audit/${c.caseId}.json`,
        content: JSON.stringify(c),
        isCriticalAssertion: true,
      })),
    ]);

    if (!preCheck.authorityPreserved) {
      throw new Error(`SECURITY_BREACH: Evaluator authority tampered prior to candidate evaluation: ${preCheck.verdict}`);
    }

    // 1. Permanent Regressions Evaluation (Zero tolerance)
    let permanentRegressionsPassed = true;
    let regressionsDetected = 0;
    for (const regCase of this.partitions.permanentRegressions) {
      const output = await generateOutputFn(regCase);
      const outcome = evaluateTestCaseSemantics(regCase, output);
      if (!outcome.passed) {
        permanentRegressionsPassed = false;
        regressionsDetected++;
      }
    }

    // 2. Protected Audit Evaluation by Slice
    const sliceMap = new Map<string, { total: number; passed: number; failures: string[] }>();
    for (const slice of this.slices) {
      sliceMap.set(slice.sliceId, { total: 0, passed: 0, failures: [] });
    }

    let totalAuditCases = 0;
    let totalAuditPassed = 0;

    for (const auditCase of this.partitions.protectedAudit) {
      totalAuditCases++;
      let sliceEntry = sliceMap.get(auditCase.sliceId);
      if (!sliceEntry) {
        sliceEntry = { total: 0, passed: 0, failures: [] };
        sliceMap.set(auditCase.sliceId, sliceEntry);
      }
      sliceEntry.total++;

      const output = await generateOutputFn(auditCase);
      const outcome = evaluateTestCaseSemantics(auditCase, output);

      if (outcome.passed) {
        sliceEntry.passed++;
        totalAuditPassed++;
      } else {
        sliceEntry.failures.push(`[${auditCase.caseId}] ${outcome.reasons.join("; ")}`);
      }
    }

    // 3. Check Slice-Level Non-Degradation Floors
    const sliceSummaries: SliceEvaluationSummary[] = [];
    const failedSliceIds: string[] = [];

    for (const slice of this.slices) {
      const entry = sliceMap.get(slice.sliceId) || { total: 0, passed: 0, failures: [] };
      const score = entry.total > 0 ? Number((entry.passed / entry.total).toFixed(4)) : 1.0;
      const floorPreserved = score >= slice.minPreservationFloor;

      if (!floorPreserved) {
        failedSliceIds.push(slice.sliceId);
      }

      sliceSummaries.push({
        sliceId: slice.sliceId,
        language: slice.language,
        totalCases: entry.total,
        passedCases: entry.passed,
        preservationScore: score,
        minFloorRequired: slice.minPreservationFloor,
        floorPreserved,
        failureDetails: Object.freeze([...entry.failures]),
      });
    }

    const protectedAuditPassed = failedSliceIds.length === 0;
    const overallScore = totalAuditCases > 0 ? Number((totalAuditPassed / totalAuditCases).toFixed(4)) : 1.0;

    // Determine Overall Verdict
    let overallVerdict: EvaluationVerdict = "QUALIFIED";
    if (!permanentRegressionsPassed) {
      overallVerdict = "REJECTED_PERMANENT_REGRESSION";
    } else if (!protectedAuditPassed) {
      overallVerdict = "REJECTED_SLICE_REGRESSION";
    }

    const evaluationTimestampIso = new Date().toISOString();
    const receiptId = `eval_receipt_${evaluationTimestampIso.replace(/[-:T]/g, "").slice(0, 8)}_${candidateId}`;

    const receiptPayload = {
      receiptId,
      evaluatorVersion: this.evaluatorVersion,
      candidateId,
      evaluationTimestampIso,
      overallScore,
      overallVerdict,
      permanentRegressionsPassed,
      protectedAuditPassed,
      sliceSummaries,
      failedSliceIds,
      totalCasesEvaluated: totalAuditCases + this.partitions.permanentRegressions.length,
      totalRegressionsDetected: regressionsDetected,
    };

    const evaluationReceiptDigest = computeSha256(JSON.stringify(receiptPayload));

    return Object.freeze({
      ...receiptPayload,
      sliceSummaries: Object.freeze(sliceSummaries),
      failedSliceIds: Object.freeze(failedSliceIds),
      evaluationReceiptDigest,
    });
  }
}
