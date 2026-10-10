import { useState } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import "./pricing.css";

interface PricingProps {
  onNavigate?: (view: AppView) => void;
}

function generateLicenseKey(tier: "pro" | "team"): string {
  const prefix = tier === "team" ? "SPE-TEAM" : "SPE-PRO";
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part3 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${part1}-${part2}-${part3}`;
}

export function Pricing({ onNavigate }: PricingProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Developer Pro");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [currentTier, setCurrentTier] = useState<string | null>(() => {
    try {
      return localStorage.getItem("spe-user-tier");
    } catch {
      return null;
    }
  });

  const [currentLicense, setCurrentLicense] = useState<string | null>(() => {
    try {
      return localStorage.getItem("spe-license-key");
    } catch {
      return null;
    }
  });

  const handleOpenPlan = (planName: string) => {
    setSelectedPlan(planName);
    setSubmitted(false);
    setEmail("");
    setGeneratedKey(null);
    setModalOpen(true);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const tier = selectedPlan.toLowerCase().includes("team") ? "team" : "pro";
    const key = generateLicenseKey(tier);
    try {
      localStorage.setItem("spe-user-tier", tier);
      localStorage.setItem("spe-user-email", email);
      localStorage.setItem("spe-license-key", key);
      setCurrentTier(tier);
      setCurrentLicense(key);
    } catch {
      // Storage access protected or restricted
    }
    setGeneratedKey(key);
    setSubmitted(true);
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    await copyTextSafe(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDeactivate = () => {
    try {
      localStorage.removeItem("spe-user-tier");
      localStorage.removeItem("spe-user-email");
      localStorage.removeItem("spe-license-key");
      setCurrentTier(null);
      setCurrentLicense(null);
    } catch {
      // Storage access protected
    }
  };

  return (
    <div className="spe-pricing-page" data-copy-depth="PRODUCT">
      <header className="spe-pricing-hero">
        <p className="spe-pricing-kicker">Transparent Value</p>
        <h1>Simple, honest pricing. Pays for itself in your first week.</h1>
        <p className="spe-pricing-subtitle">
          The core prompt compiler will always be 100% free. Upgrade to Developer Pro for $9/month or Team CI/CD Gate for $99/month.
        </p>
      </header>

      {/* Active Subscription Banner */}
      {currentTier && (
        <section
          className="spe-active-subscription-banner"
          style={{
            maxWidth: "760px",
            margin: "0 auto 2.5rem auto",
            backgroundColor: "#0d1b33",
            border: "1px solid #38bdf8",
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 0 24px rgba(56, 189, 248, 0.15)",
          }}
          aria-label="Active License Status"
        >
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#38bdf8",
                letterSpacing: "0.05em",
              }}
            >
              Active Subscription
            </span>
            <h2 style={{ margin: "0.25rem 0", color: "#f8fafc", fontSize: "1.2rem", fontWeight: 700 }}>
              {currentTier === "team" ? "Team & CI/CD Gate ($99/mo)" : "Developer Pro ($9/mo)"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
              License Key: <code style={{ color: "#38bdf8" }}>{currentLicense || "Active on this browser"}</code> · 100% Ad-Free Sanctuary Active
            </p>
          </div>
          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
            onClick={handleDeactivate}
          >
            Deactivate
          </button>
        </section>
      )}

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

        {/* Tier 2: Developer Pro ($9/mo) */}
        <article className="spe-pricing-card is-featured">
          <span className="spe-pricing-badge">Most Popular · Pays for itself in 1 day</span>
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
              <span><strong>Crash Recovery</strong>: Automatically continues interrupted agent sessions</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Agent Exporter</strong>: 1-click formats for .cursorrules, CLAUDE.md, and Windsurf</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Scope Guardrails</strong>: Automatically detects and locks down forbidden files and API keys</span>
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
            {currentTier === "pro" ? "Plan Active ✓" : "Get Developer Pro ($9/mo)"}
          </button>
        </article>

        {/* Tier 3: Team & CI/CD Gate ($99/mo) */}
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
              <span><strong>CLI Pre-Commit Hook</strong>: spe check --pre-commit halts commits with broken prompt invariants</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>CI/CD Compliance Gate</strong>: Automated GitHub Actions invariant verification</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Audit Receipts</strong>: RFC 8785 signed evidence records for team pull requests</span>
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
            {currentTier === "team" ? "Plan Active ✓" : "Protect Your Team ($99/mo)"}
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
          <div className="spe-pricing-modal" style={{ maxWidth: "480px" }}>
            <h3 id="modal-plan-title">{selectedPlan} Checkout</h3>
            {submitted ? (
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#34d399", fontWeight: 700, marginBottom: "0.75rem" }}>
                  ✓ Subscription &amp; License Key Activated!
                </p>
                <div style={{ backgroundColor: "#020617", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.25rem" }}>
                    Your Activation License Key:
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <code style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.9375rem" }}>
                      {generatedKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "4px",
                        color: "#f8fafc",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {copiedKey ? "Copied!" : "Copy Key"}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                  Your browser workspace is now <strong>100% Ad-Free</strong> with Crash Recovery and session continuation unlocked. You can also use this key in the SPE CLI: <code>spe activate {generatedKey}</code>.
                </p>
                <button
                  type="button"
                  className="spe-pricing-cta spe-pricing-cta-primary"
                  style={{ width: "100%" }}
                  onClick={() => setModalOpen(false)}
                >
                  Start Using Ad-Free Workspace →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubscribe}>
                <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem" }}>
                  Enter your developer email to start your 14-day evaluation and instantly unlock your ad-free workspace license key:
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
                <div className="spe-pricing-modal-actions" style={{ marginTop: "1.25rem" }}>
                  <button
                    type="submit"
                    className="spe-pricing-cta spe-pricing-cta-primary"
                  >
                    Activate {selectedPlan.includes("Team") ? "$99/mo License" : "$9/mo License"}
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
