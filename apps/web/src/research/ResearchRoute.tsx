import { useState } from "react";
import type { FormEvent } from "react";
import { RESEARCH_MOUNT } from "../shell/mountStatus";
import storedReceipt from "./storedReceiptView.json";

type Phase = "IDLE" | "HELD_NO_CONSENT" | "STORED_RECEIPT";

const PROVIDERS = ["OPENALEX", "CROSSREF", "PUBMED"] as const;
type ProviderId = (typeof PROVIDERS)[number];

/**
 * /research shell. Consent defaults off. This component does not fetch,
 * does not call a provider, and does not reimplement the scholarly client.
 * The table is the already stored receipt for one DOI.
 */
export function ResearchRoute() {
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("OPENALEX");
  const [phase, setPhase] = useState<Phase>("IDLE");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) {
      setPhase("HELD_NO_CONSENT");
      return;
    }
    setPhase("STORED_RECEIPT");
  }

  return (
    <section className="spe-privacy-page" aria-labelledby="research-title" data-research-route="/research">
      <p className="spe-kicker">Research</p>
      <h1 id="research-title">Research</h1>
      <p className="spe-privacy-lede">
        Enter a question to view a stored receipt. This page never performs a new search, even with consent. This page does not send the
        question, a private document, code, audio, or an image. PubMed and PMC are one NCBI family.
        Live index and live retraction stay HOLD.
      </p>
      <form onSubmit={onSubmit} data-research-consent-default="false">
        <div className="spe-privacy-grid">
          <label htmlFor="research-question">
            Question
            <textarea
              id="research-question"
              name="question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setPhase("IDLE");
              }}
              rows={4}
              autoComplete="off"
            />
          </label>
          <label htmlFor="research-provider">
            Provider
            <select
              id="research-provider"
              name="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as ProviderId)}
            >
              {PROVIDERS.map((id) => (
                <option key={id} value={id}>
                  {id === "PUBMED" ? "PubMed (NCBI, includes PMC)" : id}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="research-consent">
            <input
              id="research-consent"
              name="research-consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setPhase("IDLE");
              }}
            />
            I choose to view the stored research receipt. This does not authorize or perform a new search.
          </label>
        </div>
        <button type="submit">Continue</button>
      </form>
      <p role="status" data-research-phase={phase} data-research-product={RESEARCH_MOUNT.RESEARCH_PRODUCT}>
        {phase === "HELD_NO_CONSENT"
          ? "Consent is off. The question was not sent."
          : phase === "STORED_RECEIPT"
            ? "Stored receipt only. No new provider request. LIVE_INDEX HOLD. LIVE_RETRACTION HOLD."
            : "Nothing has been sent."}
      </p>
      {phase === "STORED_RECEIPT" ? (
        <div data-stored-receipt="true">
          <p>
            Selected provider {provider} is not a new request. Receipt status {storedReceipt.status}.{" "}
            {storedReceipt.egress_classification}. DOI {storedReceipt.canonical_doi}. May promote: no.
          </p>
          <table>
            <caption>Stored receipt for {storedReceipt.canonical_doi}</caption>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Query</th>
                <th>Identifier</th>
                <th>Timestamp</th>
                <th>URL / API</th>
                <th>Response digest</th>
                <th>Verification status</th>
              </tr>
            </thead>
            <tbody>
              {storedReceipt.provenance.map((row, index) => (
                <tr key={`${row.provider}-${index}`}>
                  <td>{row.provider}</td>
                  <td>{row.query}</td>
                  <td>{row.identifier}</td>
                  <td>{row.timestamp}</td>
                  <td>{row.url}</td>
                  <td>{row.response_digest}</td>
                  <td>{row.verification_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
