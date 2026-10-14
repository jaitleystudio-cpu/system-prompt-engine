import { useMemo, useState } from "react";
import {
  INTAKE_PROVIDERS,
  INTAKE_TYPES,
  buildPrivateIntakeExport,
  reviewLocalIntake,
  type LocalIntakeDraft,
} from "./incidentIntake";

/**
 * Private user-report export only. Never send to server, auto-save,
 * search the web, run a model, or claim incident/repair verification.
 */
export function PrivateFailureIntake() {
  const [draft, setDraft] = useState<LocalIntakeDraft>({
    provider: INTAKE_PROVIDERS[0],
    modelRevision: "",
    failureType: INTAKE_TYPES[0],
    expectedSummary: "",
    observedSummary: "",
    reviewedForPrivateDetails: false,
  });
  const [message, setMessage] = useState("");
  const review = useMemo(() => reviewLocalIntake(draft), [draft]);

  function revise(next: Partial<LocalIntakeDraft>) {
    setDraft((existing) => ({
      ...existing,
      ...next,
      // Each edit invalidates the earlier privacy review.
      reviewedForPrivateDetails: next.reviewedForPrivateDetails ?? false,
    }));
    setMessage("");
  }

  function downloadPrivateReport() {
    if (!review.private_export_eligible) {
      setMessage("Review the entries and confirm your privacy check before exporting.");
      return;
    }
    try {
      const envelope = buildPrivateIntakeExport(draft);
      const bytes = JSON.stringify(envelope, null, 2) + "\n";
      const file = new Blob([bytes], { type: "application/json;charset=utf-8" });
      const href = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = href;
      link.download = "spe-private-ai-failure-report.json";
      link.style.display = "none";
      document.body.append(link);
      try {
        link.click();
        setMessage("A private report file was prepared for your browser's download handling. SPE did not upload it.");
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    } catch {
      setMessage("Private export could not be prepared. Nothing was sent to SPE.");
    }
  }

  return (
    <section className="spe-intake" aria-labelledby="spe-failure-intake-title" data-intake-scope="LOCAL_ONLY_UNVERIFIED">
      <div className="spe-intake-heading">
        <div>
          <p className="spe-incident-eyebrow">PRIVATE FAILURE INTAKE / ON YOUR DEVICE</p>
          <h2 id="spe-failure-intake-title">Turn an AI failure into a reviewable report.</h2>
          <p>
            Describe what happened without uploading your prompt or AI response.
            SPE prepares a preliminary JSON report only when you choose to export it.
            The report is not independently verified and never becomes a public case automatically.
          </p>
        </div>
        <span className="spe-intake-local-tag">Local-only draft</span>
      </div>

      <div className="spe-intake-fields">
        <div className="spe-intake-field">
          <label htmlFor="spe-failure-provider">AI provider</label>
          <select
            id="spe-failure-provider"
            value={draft.provider}
            onChange={(event) => revise({ provider: event.currentTarget.value as LocalIntakeDraft["provider"] })}
          >
            {INTAKE_PROVIDERS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <div className="spe-intake-field">
          <label htmlFor="spe-failure-version">Model revision, if known</label>
          <input
            id="spe-failure-version"
            type="text"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. the exact version shown by the provider"
            value={draft.modelRevision}
            onChange={(event) => revise({ modelRevision: event.currentTarget.value })}
          />
        </div>

        <div className="spe-intake-field spe-intake-field-wide">
          <label htmlFor="spe-failure-type">What went wrong?</label>
          <select
            id="spe-failure-type"
            value={draft.failureType}
            onChange={(event) => revise({ failureType: event.currentTarget.value as LocalIntakeDraft["failureType"] })}
          >
            {INTAKE_TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <div className="spe-intake-field spe-intake-field-wide">
          <label htmlFor="spe-failure-expected">Expected behavior — short summary</label>
          <textarea
            id="spe-failure-expected"
            rows={3}
            maxLength={500}
            placeholder="What should the AI have done? Do not paste private prompts, keys or personal details."
            value={draft.expectedSummary}
            onChange={(event) => revise({ expectedSummary: event.currentTarget.value })}
          />
        </div>

        <div className="spe-intake-field spe-intake-field-wide">
          <label htmlFor="spe-failure-observed">Observed behavior — short summary</label>
          <textarea
            id="spe-failure-observed"
            rows={3}
            maxLength={500}
            placeholder="Describe the outcome, not the full conversation or private answer."
            value={draft.observedSummary}
            onChange={(event) => revise({ observedSummary: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="spe-intake-review" data-copy-depth="PROOF">
        <label className="spe-intake-acknowledgement" htmlFor="spe-failure-privacy">
          <input
            id="spe-failure-privacy"
            type="checkbox"
            checked={draft.reviewedForPrivateDetails}
            onChange={(event) => revise({ reviewedForPrivateDetails: event.currentTarget.checked })}
          />
          <span>
            I personally reviewed these summaries for private information and secrets.
            I understand the automated screen cannot guarantee redaction.
          </span>
        </label>
        <div className="spe-intake-review-bottom">
          <div className="spe-intake-diagnostic" aria-live="polite">
            {review.reasons.includes("SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER") ? (
              <strong>Possible sensitive data detected. Remove it before exporting.</strong>
            ) : review.reasons.includes("CONTROL_CHARACTER_PRESENT") ? (
              <strong>Remove invisible control characters before exporting.</strong>
            ) : review.reasons.includes("MODEL_REVISION_UNPINNED") ? (
              <span>Model revision not pinned. The report will explicitly mark it unknown.</span>
            ) : review.private_export_eligible ? (
              <span>Eligible for private export. No external incident proof is implied.</span>
            ) : (
              <span>Complete both summaries and confirm your privacy review.</span>
            )}
          </div>
          <button
            type="button"
            className="spe-intake-export-button"
            disabled={!review.private_export_eligible}
            onClick={downloadPrivateReport}
          >
            Export private report <span aria-hidden="true">↓</span>
          </button>
        </div>
        {message && <p role="status" className="spe-intake-message">{message}</p>}
      </div>
      <p className="spe-intake-boundary">
        User-reported only · No AI API calls · No automatic upload · No local history storage · No verified repair.
        Your browser or device may separately manage downloaded files.
      </p>
    </section>
  );
}
