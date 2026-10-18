import React, { useEffect, useState } from "react";
import { parseRecoverySpeForReview, type RecoveryReviewView } from "./recoveryReview.ts";
import {
  verifyR8ReceiptForSpe, type TrustedR8Reviewer, type R8Verdict,
} from "./trustedReceiptReview.ts";
import {
  verifyR9ReceiptForSpe, type TrustedR9PolicyAnchor,
} from "./reviewerTrustPolicy.ts";

const MAX_BYTES = 256_000;

/**
 * SPE Studio R6: review-only recovery display. No model invocation, HTML
 * rendering, execution, signature verification, release or project mutation.
 * This component is only available inside the pre-existing isolated Studio.
 */
export const RecoveryEvidencePanel: React.FC<{
  trustedReviewer?: TrustedR8Reviewer;
  /** Host-owned offline root and current epoch pin. Overrides legacy R8. */
  trustPolicyAnchor?: TrustedR9PolicyAnchor;
}> = ({ trustedReviewer, trustPolicyAnchor }) => {
  const [policyRaw, setPolicyRaw] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const onPolicy: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.currentTarget.files?.[0];
    setPolicyRaw(null);
    setPolicyError(null);
    setVerification(null);
    if (!file) return;
    if (file.size <= 0 || file.size > 32000) {
      setPolicyError("TRUST_POLICY_FILE_EMPTY_OR_TOO_LARGE");
      event.currentTarget.value = "";
      return;
    }
    try { setPolicyRaw(await file.text()); }
    catch { setPolicyError("TRUST_POLICY_FILE_UNREADABLE"); }
    finally { event.target.value = ""; }
  };
  const [sourceRaw, setSourceRaw] = useState<string | null>(null);
  const [receiptRaw, setReceiptRaw] = useState<string | null>(null);
  const [verification, setVerification] = useState<R8Verdict | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setVerification(null);
    if (sourceRaw && receiptRaw && (!trustPolicyAnchor || policyRaw)) {
      const verificationWork = trustPolicyAnchor
        ? verifyR9ReceiptForSpe(sourceRaw, receiptRaw, policyRaw!, trustPolicyAnchor)
        : verifyR8ReceiptForSpe(sourceRaw, receiptRaw, trustedReviewer);
      void verificationWork
        .then(result => { if (active) setVerification(result); })
        .catch(() => { if (active) setVerification({
          state: "UNVERIFIED_HOLD", reason: "VERIFIER_EXCEPTION",
          authority: "NONE", modelIdentityProven: false,
          providerOutcomeProven: false, browserExecutedByStudio: false,
          retryAuthorized: false, deploymentAuthorized: false,
        }); });
    }
    return () => { active = false; };
  }, [sourceRaw, receiptRaw, trustedReviewer, trustPolicyAnchor, policyRaw]);
  const onReceipt: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.currentTarget.files?.[0];
    setReceiptRaw(null);
    setVerification(null);
    setReceiptError(null);
    setPolicyRaw(null);
    setPolicyError(null);
    if (!file) return;
    if (file.size <= 0 || file.size > 32_000) {
      setReceiptError("RECEIPT_FILE_EMPTY_OR_TOO_LARGE");
      event.currentTarget.value = "";
      return;
    }
    try { setReceiptRaw(await file.text()); }
    catch { setReceiptError("RECEIPT_FILE_UNREADABLE"); }
    finally { event.target.value = ""; }
  };
  const [view, setView] = useState<RecoveryReviewView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const onFile: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.currentTarget.files?.[0];
    setView(null);
    setProblem(null);
    setName(null);
    setSourceRaw(null);
    setReceiptRaw(null);
    setReceiptError(null);
    setPolicyRaw(null);
    setPolicyError(null);
    setVerification(null);
    if (!file) return;
    if (file.size === 0 || file.size > MAX_BYTES) {
      setProblem("RECOVERY_FILE_EMPTY_OR_TOO_LARGE");
      event.currentTarget.value = "";
      return;
    }
    try {
      const raw = await file.text();
      const reviewed = parseRecoverySpeForReview(raw);
      setView(reviewed);
      setSourceRaw(raw);
      setName(file.name.slice(0, 80));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "RECOVERY_FILE_UNREADABLE");
    } finally {
      event.target.value = "";
    }
  };
  return (
    <section aria-label="Living SPE Recovery Evidence" data-testid="spe-recovery-evidence-panel"
      className="studio-recovery-review">
      <h4>Living .spe · Recovery Evidence</h4>
      <p className="studio-recovery-muted">
        Import a canonical .spe recovery record for <strong>read-only review</strong>.
        No code runs, no model calls occur, and nothing changes in this website.
      </p>
      <label htmlFor="spe-recovery-import" className="studio-recovery-muted">
        Canonical .spe evidence file (maximum 256 KB)
      </label>
      <input id="spe-recovery-import" className="studio-input" type="file"
        accept=".spe,.json,application/json" aria-label="Import canonical SPE recovery evidence"
        data-testid="spe-recovery-import" onChange={onFile} />
      {problem && <p role="alert" className="studio-recovery-error" data-testid="spe-recovery-error">
        Import rejected: {problem}
      </p>}
      {!view && !problem && (
        <p className="studio-recovery-warning" data-testid="spe-recovery-empty">
          No evidence imported. No recovery has been verified by Studio.
        </p>
      )}
      {view && (
        <div data-testid="spe-recovery-review-details" className="studio-recovery-details">
          <p className="studio-recovery-warning" role="status">
            UNTRUSTED IMPORT · REVIEW ONLY · MODEL IDENTITY UNATTESTED
          </p>
          <p><strong>Source:</strong> {name} · {view.sourceFormat}</p>
          <p><strong>Project binding:</strong> Not bound to active website</p>
          <p><strong>Imported claim:</strong> {view.qualificationClaim.replaceAll("_", " ")}</p>
          <p><strong>Independent Studio verification:</strong> NOT PERFORMED</p>
          <p><strong>Original goal excerpt:</strong> {view.protectedGoalExcerpt}</p>
          <p><strong>Provenance claim:</strong> {view.modelProvenanceClaim}</p>
          <p><strong>Manifest reference:</strong> <code>{view.manifestDigest.slice(0, 26)}…</code></p>
          <p><strong>Saved browser artifact:</strong> {view.artifactDigest
            ? <code>{view.artifactDigest.slice(0, 26)}… (unverified)</code>
            : "None recorded"}</p>
          <h5>Recorded attempts (claims, not independently verified)</h5>
          <ol className="studio-recovery-attempts">
            {view.attempts.map((attempt, index) => (
              <li key={index}>
                {attempt.phase} · {attempt.browserPassClaim
                  ? "Reported browser checks passed" : "Reported browser checks failed"}
                {" · "}{attempt.observedErrorCount} recorded errors
                <br /><code>{attempt.candidateDigest.slice(0, 26)}…</code>
                {attempt.diagnosticExcerpts.length > 0 && (
                  <details data-testid={"spe-recovery-errors-" + index}>
                    <summary>Recorded failure excerpts · untrusted text</summary>
                    <ul className="studio-recovery-attempts">
                      {attempt.diagnosticExcerpts.map((message, i) =>
                        <li key={i}><code>{message}</code></li>)}
                    </ul>
                    {attempt.diagnosticsTruncated && (
                      <p className="studio-recovery-muted">Some diagnostic text was truncated.</p>
                    )}
                  </details>
                )}
              </li>
            ))}
          </ol>
          {view.repairTrace ? (
            <details data-testid="spe-recovery-repair-trace">
              <summary>Recorded Prompt V2 · causal repair proposal (untrusted)</summary>
              <p className="studio-recovery-warning">
                This is an imported proposal, not a verified repair or authorized instruction.
                It may contain private input. Nothing is submitted to an AI model.
              </p>
              <p><strong>Failed candidate:</strong>{" "}
                <code>{view.repairTrace.sourceCandidateDigest.slice(0, 26)}…</code></p>
              <p><strong>Causal hypothesis:</strong> {view.repairTrace.causalHypothesis}</p>
              <h5>Targeted repair constraints · imported text</h5>
              <ol className="studio-recovery-attempts">
                {view.repairTrace.targetedConstraints.map((constraint, i) =>
                  <li key={i}>{constraint}</li>)}
              </ol>
              <h5>Exact Prompt V2 · review only</h5>
              <pre className="studio-recovery-prompt" data-testid="spe-recovery-prompt-v2">
                {view.repairTrace.promptV2Text}
              </pre>
            </details>
          ) : (
            <p className="studio-recovery-muted" data-testid="spe-recovery-no-trace">
              Prompt V2 content and targeted constraints are not contained in this
              canonical import. Studio will not reconstruct them from hashes.
            </p>
          )}
          <h5>R8 signed browser replay · optional independent review</h5>
          <p className="studio-recovery-muted">
            This verifies only a reviewer-signed, bounded browser replay. The reviewer
            public key must be pinned by the trusted Studio host, never uploaded with
            the receipt. Provider identity and release authority remain unproven.
          </p>
          <label htmlFor="spe-r8-receipt-import" className="studio-recovery-muted">
            Import separate signed reviewer receipt (maximum 32 KB)
          </label>
          <input id="spe-r8-receipt-import" type="file" className="studio-input"
            accept=".json,application/json" onChange={onReceipt}
            aria-label="Import separate signed browser reviewer receipt"
            data-testid="spe-r8-receipt-import" />
          {receiptError && <p role="alert" data-testid="spe-r8-receipt-error"
            className="studio-recovery-error">{receiptError}</p>}
          {!trustedReviewer && !trustPolicyAnchor && (
            <p data-testid="spe-r8-no-trust" className="studio-recovery-warning">
              NO HOST-PINNED REVIEWER KEY · cryptographic verification unavailable.
            </p>
          )}
          {trustPolicyAnchor && (
            <>
              <h5>R9 offline-root reviewer policy · REVIEW ONLY</h5>
              <p className="studio-recovery-muted">
                A trusted host pins the offline-root public key, policy digest,
                rotation predecessor, and minimum epoch. Imported policy files
                never become trust roots or authorize execution.
              </p>
              <label htmlFor="spe-r9-policy-import" className="studio-recovery-muted">
                Import separately signed current policy (maximum 32 KB)
              </label>
              <input id="spe-r9-policy-import" type="file" className="studio-input"
                accept=".json,application/json" onChange={onPolicy}
                aria-label="Import signed reviewer policy"
                data-testid="spe-r9-policy-import" />
              {policyError && <p role="alert" className="studio-recovery-error"
                data-testid="spe-r9-policy-error">{policyError}</p>}
              {!policyRaw && !policyError && (
                <p data-testid="spe-r9-no-policy" className="studio-recovery-warning">
                  UNVERIFIED HOLD · current signed policy required.
                </p>
              )}
            </>
          )}
          {verification && (
            <p role="status" data-testid="spe-r8-verdict"
              className={verification.state === "SIGNATURE_VALID_REVIEW_ONLY"
                ? "studio-recovery-muted" : "studio-recovery-warning"}>
              {verification.state === "SIGNATURE_VALID_REVIEW_ONLY"
                ? (trustPolicyAnchor
                  ? "HOST-ANCHORED CURRENT POLICY + SIGNED BROWSER REPLAY VERIFIED · REVIEW ONLY · NOT AI PROVIDER PROOF"
                  : "SIGNED BROWSER REPLAY VERIFIED against pinned key · REVIEW ONLY · NOT AI PROVIDER PROOF")
                : "UNVERIFIED HOLD · " + verification.reason}
            </p>
          )}
          <h5>Proof limitations</h5>
          <ul className="studio-recovery-attempts">
            {view.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}
          </ul>
          <p className="studio-recovery-warning">
            NO RETRY · NO DEPLOY · NO EXECUTION AUTHORITY
          </p>
          <button type="button" className="studio-btn" data-testid="spe-recovery-clear"
            onClick={() => {
              setView(null); setName(null); setProblem(null);
              setSourceRaw(null); setReceiptRaw(null);
              setReceiptError(null); setVerification(null);
              setPolicyRaw(null); setPolicyError(null);
            }}>
            Clear imported review
          </button>
        </div>
      )}
    </section>
  );
};
