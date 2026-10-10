import { useState } from "react";
import type { AppView } from "../routing";
import "./pricing.css";

interface PricingProps {
  onNavigate?: (view: AppView) => void;
}

export function Pricing({ onNavigate }: PricingProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Developer Pro");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleOpenPlan = (planName: string) => {
    setSelectedPlan(planName);
    setSubmitted(false);
    setEmail("");
    setModalOpen(true);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      localStorage.setItem("spe-user-tier", selectedPlan.toLowerCase().includes("team") ? "team" : "pro");
      localStorage.setItem("spe-user-email", email);
    } catch {
      // Storage access protected or restricted
    }
    setSubmitted(true);
    setTimeout(() => {
      setModalOpen(false);
      setSubmitted(false);
    }, 2200);
  };

  return (
    <div className="spe-pricing-page" data-copy-depth="PRODUCT">
      <header className="spe-pricing-hero">
        <p className="spe-pricing-kicker">Transparent Value</p>
        <h1>Simple, honest pricing. Pays for itself in your first week.</h1>
        <p className="spe-pricing-subtitle">
          The core prompt compiler will always be 100% free. Upgrade to Pro or Team to automate multi-step workflows, eliminate all ads, and enforce team guardrails.
        </p>
      </header>

      <section className="spe-pricing-grid" aria-label="Subscription Plans">
        {/* Tier 1: Free Community */}
        <article className="spe-pricing-card">
          <span className="spe-pricing-badge">Always Free</span>
          <h2 className="spe-pricing-card-title">Free Community</h2>
          <p className="spe-pricing-desc">
            Ideal for individual developers and creators crafting single prompts.
          </p>

          <div className="spe-pricing-price-box">
            <span className="spe-pricing-amount">$0</span>
            <span className="spe-pricing-period">/ month</span>
          </div>

          <ul className="spe-pricing-features" aria-label="Free Community Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>100% In-Browser Deterministic Prompt Compiler</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>WebAssembly offline execution with zero server logs</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Portable .spe export and plain text / JSON export</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Access to public prompt recipes and benchmark data</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Non-intrusive contextual developer ads on public discovery pages</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={() => onNavigate?.("create")}
          >
            Start Building Free
          </button>
        </article>

        {/* Tier 2: Developer Pro */}
        <article className="spe-pricing-card is-featured">
          <span className="spe-pricing-badge">Most Popular · Pays for itself in 2 days</span>
          <h2 className="spe-pricing-card-title">Developer Pro</h2>
          <p className="spe-pricing-desc">
            For professional developers who rely on Claude Code, Cursor, and ChatGPT daily.
          </p>

          <div className="spe-pricing-price-box">
            <span className="spe-pricing-amount">$9</span>
            <span className="spe-pricing-period">/ month</span>
          </div>

          <div className="spe-pricing-roi-banner">
            💡 Saves ~8 hours of debugging and $35+ in wasted API tokens every week.
          </div>

          <ul className="spe-pricing-features" aria-label="Developer Pro Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>100% Ad-Free</strong> across the entire platform</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Multi-Turn Session Memory (CWC)</strong>: Automatically continues interrupted agent tasks</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>1-Click Agent Exports</strong>: Format directly for .cursorrules, Claude Code CLAUDE.md, and Windsurf</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Advanced Scope Guardrails</strong>: Automatically detects and locks down forbidden files and API keys</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Priority community support and early access to new workflow templates</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-primary"
            onClick={() => handleOpenPlan("Developer Pro")}
          >
            Get Developer Pro
          </button>
        </article>

        {/* Tier 3: Team & CI/CD Gate */}
        <article className="spe-pricing-card">
          <span className="spe-pricing-badge">For Engineering Teams</span>
          <h2 className="spe-pricing-card-title">Team &amp; CI/CD Gate</h2>
          <p className="spe-pricing-desc">
            Stop broken AI code before it merges into production.
          </p>

          <div className="spe-pricing-price-box">
            <span className="spe-pricing-amount">$99</span>
            <span className="spe-pricing-period">/ month</span>
          </div>

          <ul className="spe-pricing-features" aria-label="Team & CI/CD Gate Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Everything in Pro for up to <strong>10 team members</strong></span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Git Pre-Commit Hook</strong>: spe check --pre-commit halts commits with broken prompt invariants</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>CI/CD Compliance Gate</strong>: Automated GitHub Actions invariant verification</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Cryptographic Audit Passports</strong>: RFC 8785 signed evidence records for team pull requests</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Shared private team prompt library</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={() => handleOpenPlan("Team & CI/CD Gate")}
          >
            Protect Your Team
          </button>
        </article>
      </section>

      {/* Transparent FAQ Section */}
      <section className="spe-pricing-faq-section" aria-labelledby="pricing-faq-title">
        <h2 id="pricing-faq-title" className="spe-pricing-faq-title">
          Frequently Answered Questions
        </h2>
        <dl className="spe-pricing-faq-grid">
          <div className="spe-pricing-faq-card">
            <dt>Why is the core compiler free?</dt>
            <dd>
              Our WebAssembly compiler runs on your device, not our servers. Since it costs us $0 in GPU compute, we pass those savings directly to you.
            </dd>
          </div>
          <div className="spe-pricing-faq-card">
            <dt>Does SPE ever see my code or secrets?</dt>
            <dd>
              Never. SPE is strictly air-gapped on your device. Zero prompt bytes leave your machine.
            </dd>
          </div>
          <div className="spe-pricing-faq-card">
            <dt>Can I cancel anytime?</dt>
            <dd>
              Yes, with one click. No questions asked.
            </dd>
          </div>
        </dl>
      </section>

      {/* Onboarding & Checkout Modal */}
      {modalOpen && (
        <div
          className="spe-pricing-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-plan-title"
        >
          <div className="spe-pricing-modal">
            <h3 id="modal-plan-title">{selectedPlan}</h3>
            {submitted ? (
              <p style={{ color: "#34d399", fontWeight: 600 }}>
                ✓ Subscription activated on this browser. Thank you for supporting independent developer tools!
              </p>
            ) : (
              <form onSubmit={handleSubscribe}>
                <p>
                  Enter your developer email to start your 14-day evaluation and unlock your ad-free workspace license key:
                </p>
                <input
                  type="email"
                  required
                  placeholder="developer@company.com"
                  className="spe-pricing-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                <div className="spe-pricing-modal-actions">
                  <button
                    type="submit"
                    className="spe-pricing-cta spe-pricing-cta-primary"
                  >
                    Continue to Checkout
                  </button>
                  <button
                    type="button"
                    className="spe-pricing-cta spe-pricing-cta-secondary"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
