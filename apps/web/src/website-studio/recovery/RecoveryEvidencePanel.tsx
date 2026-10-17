import React, { useState } from "react";
import { parseRecoverySpeForReview, type RecoveryReviewView } from "./recoveryReview.ts";

const MAX_BYTES = 256_000;

/**
 * SPE Studio R6: review-only recovery display. No model invocation, HTML
 * rendering, execution, signature verification, release or project mutation.
 * This component is only available inside the pre-existing isolated Studio.
 */
export const RecoveryEvidencePanel: React.FC = () => {
  const [view, setView] = useState<RecoveryReviewView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const onFile: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.currentTarget.files?.[0];
    setView(null);
    setProblem(null);
    setName(null);
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
              </li>
            ))}
          </ol>
          <p className="studio-recovery-muted">
            Prompt V2 content and targeted constraints are not contained in this
            canonical import. Studio will not reconstruct them from hashes.
          </p>
          <h5>Proof limitations</h5>
          <ul className="studio-recovery-attempts">
            {view.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}
          </ul>
          <p className="studio-recovery-warning">
            NO RETRY · NO DEPLOY · NO EXECUTION AUTHORITY
          </p>
          <button type="button" className="studio-btn" data-testid="spe-recovery-clear"
            onClick={() => { setView(null); setName(null); setProblem(null); }}>
            Clear imported review
          </button>
        </div>
      )}
    </section>
  );
};
