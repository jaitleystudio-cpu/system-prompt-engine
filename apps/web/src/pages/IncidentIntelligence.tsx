import type { AppView } from "../routing";
import { InAppLink } from "../shell/inAppLink";
import { PrivateFailureIntake } from "./PrivateFailureIntake";
import "./incident-intelligence.css";

/**
 * R20 — public-facing explanation of SPE's still-unreleased incident product.
 *
 * Deliberately NO provider fetch, no synthetic case, no live/first/verified
 * assertion, no user tracking and NO indexable incident route. This page
 * must not accept unauthenticated incident data, a URL query or localStorage
 * as an incident evidence source. Owner-signed reviewed cases need a
 * separately qualified publishing and retraction owner before inclusion.
 */
const EVIDENCE_STAGES = [
  {
    code: "01",
    title: "A provider reported an incident",
    criterion: "Keep the official URL, observed revision, and claimed timestamp. A report is not an independently reproduced model failure.",
    status: "Source observation only",
  },
  {
    code: "02",
    title: "The evidence can be examined",
    criterion: "Pin the source revision, provenance and reproducible test. Separate original facts from interpretation and unknowns.",
    status: "Independent review required",
  },
  {
    code: "03",
    title: "The behavior can be reproduced",
    criterion: "Use the same pinned model revision, configuration, and held-out task set. Simulated or supplied outputs cannot certify a real model run.",
    status: "Real-model proof required",
  },
  {
    code: "04",
    title: "A proposed repair survives testing",
    criterion: "Compare a baseline against a repaired prompt with the same oracle, negative controls, regression veto and independent adjudication.",
    status: "External validation required",
  },
  {
    code: "05",
    title: "A human authorizes publication",
    criterion: "Require separate source/editorial and release review, preserve corrections and withdrawals, and never silently invent an answer.",
    status: "Not authorized",
  },
] as const;

const OFFICIAL_SOURCE_LINKS = [
  {
    name: "OpenAI service status",
    url: "https://status.openai.com/",
    scope: "Provider service notices. Not proof of any specific model or prompt failure.",
  },
  {
    name: "Claude service status",
    url: "https://status.claude.com/",
    scope: "Provider service notices. Not an independently established causal diagnosis.",
  },
] as const;

export function IncidentIntelligence({
  onNavigate,
}: {
  onNavigate: (view: AppView) => void;
}) {
  return (
    <section
      aria-labelledby="spe-incident-title"
      className="spe-incident-page"
      data-publication-state="NOT_QUALIFIED"
      data-source-connection="NOT_ACTIVATED"
    >
      <div className="spe-incident-inner">
        <header className="spe-incident-hero">
          <div className="spe-incident-hero-content">
            <p className="spe-incident-kicker">
              <span className="spe-incident-kicker-mark" aria-hidden="true" />
              SPE / AI FAILURE INTELLIGENCE
            </p>
            <h1 id="spe-incident-title">
              When AI fails,
              <span> evidence comes first.</span>
            </h1>
            <p className="spe-incident-lede">
              A failed AI answer deserves more than a dramatic headline.
              SPE is building a review path from an official report to
              a reproducible failure, a tested repair, and a transparent correction history.
            </p>
            <div className="spe-incident-actions">
              <InAppLink className="spe-incident-primary-link" view="create" onNavigate={onNavigate}>
                Build a structured prompt <span aria-hidden="true">↗</span>
              </InAppLink>
              <a className="spe-incident-secondary-link" href="#spe-incident-method">
                See how evidence is checked <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <aside className="spe-incident-status" aria-labelledby="spe-incident-status-title">
            <div className="spe-incident-status-label">
              <span className="spe-incident-led" aria-hidden="true" />
              RELEASE CUSTODY
            </div>
            <h2 id="spe-incident-status-title">Investigation surface</h2>
            <p className="spe-incident-status-value">Not yet live</p>
            <p>
              The source-adapter and reviewer code is under draft qualification.
              No continuously running incident feed, real-model reproduction,
              or authorized public case library is established here.
            </p>
            <div className="spe-incident-status-line">
              <span>Source-monitoring deployment</span>
              <strong>Not activated</strong>
            </div>
            <div className="spe-incident-status-line">
              <span>Verified repair library</span>
              <strong>Not released</strong>
            </div>
            <div className="spe-incident-status-line">
              <span>Independent human adjudication</span>
              <strong>Pending</strong>
            </div>
          </aside>
        </header>

        <section className="spe-incident-empty" aria-labelledby="spe-incident-empty-title">
          <div>
            <p className="spe-incident-eyebrow">CASE LIBRARY / RELEASE GATE</p>
            <h2 id="spe-incident-empty-title">No qualified incident brief is available yet.</h2>
            <p>
              We will not fill this space with fabricated model failures, simulated
              benchmark victories, or unreviewed third-party allegations.
              Only independently authorized, source-attributed cases belong here.
            </p>
          </div>
          <div className="spe-incident-empty-emblem" aria-hidden="true">
            <span>?</span>
          </div>
        </section>

        <PrivateFailureIntake />

        <section className="spe-incident-method" id="spe-incident-method" aria-labelledby="spe-incident-method-title">
          <div className="spe-incident-section-head">
            <div>
              <p className="spe-incident-eyebrow">PROOF, NOT PROMISE</p>
              <h2 id="spe-incident-method-title">Five separate claims. Five separate gates.</h2>
            </div>
            <p>
              A source status, a reproduced model behavior, and a verified repair are
              different kinds of evidence. One does not automatically establish the next.
            </p>
          </div>
          <ol className="spe-incident-timeline">
            {EVIDENCE_STAGES.map((stage) => (
              <li key={stage.code} className="spe-incident-timeline-item">
                <div className="spe-incident-stage-index" aria-hidden="true">{stage.code}</div>
                <div className="spe-incident-stage-body">
                  <h3>{stage.title}</h3>
                  <p>{stage.criterion}</p>
                  <span className="spe-incident-stage-tag">{stage.status}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="spe-incident-sources" aria-labelledby="spe-incident-sources-title">
          <div>
            <p className="spe-incident-eyebrow">WHERE THE ORIGINAL REPORT LIVES</p>
            <h2 id="spe-incident-sources-title">Go directly to an official status source.</h2>
            <p>
              These are links to provider-operated status websites, not a feed of
              incidents verified or actively tracked by SPE. Their content can change independently.
            </p>
          </div>
          <div className="spe-incident-source-grid">
            {OFFICIAL_SOURCE_LINKS.map((source) => (
              <a
                className="spe-incident-source-link"
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                <strong>{source.name}<span aria-hidden="true">↗</span></strong>
                <span>{source.scope}</span>
              </a>
            ))}
          </div>
        </section>

        <footer className="spe-incident-disclaimer">
          <p>
            <strong>Evidence boundary.</strong> No live AI news feed, headline-first
            ranking, customer incident data collection, independently verified
            model diagnosis, repair effectiveness or public release authority
            is represented on this page. The prompt builder remains a separate local-first tool.
          </p>
          <InAppLink className="spe-incident-trust-link" view="privacy" onNavigate={onNavigate}>
            Review SPE privacy and proof principles <span aria-hidden="true">↗</span>
          </InAppLink>
        </footer>
      </div>
    </section>
  );
}
