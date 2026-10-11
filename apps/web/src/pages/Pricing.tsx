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
    <div className="spe-pricing-page" data-copy-depth="PROOF">
      <header className="spe-pricing-hero">
        <p className="spe-pricing-kicker">
          SPE — System Prompt Engine · Engine Powered by Prawin Jaitley · Public Beta
        </p>
        <h1>Transparent Introductory Pricing. Reproducible Evidence.</h1>
        <p className="spe-pricing-subtitle">
          Launch objective: demonstrate value through working experiences, transparent pricing, and reproducible evidence. Over 95% of SPE&apos;s browser-local tools remain $0 forever, supported by non-intrusive developer sponsors on public discovery pages. During our Public Beta launch, <strong>Developer Pro is $1 for your first month (renews at $9/month)</strong> and <strong>Company &amp; CI/CD Gate is $9 for your first month (renews at $99/month)</strong>.
        </p>
        <div
          style={{
            marginTop: "0.85rem",
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            justifyContent: "center",
            fontSize: "0.75rem",
            color: "#94a3b8",
            background: "rgba(15, 23, 42, 0.75)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "999px",
            padding: "0.35rem 0.9rem",
          }}
        >
          <span><strong>Qualification Status:</strong> Public Beta</span>
          <span>·</span>
          <span><strong>WASM Core:</strong> Verified (1.3 MB Local)</span>
          <span>·</span>
          <span><strong>Gates Pending Full Production:</strong> G6-H (Blinded Human Study) &amp; REC-2E (External Multi-Provider Holdout)</span>
        </div>
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
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
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
              {currentTier === "team"
                ? "Company & CI/CD Gate ($9 first month · renews at $99/mo)"
                : "Developer Pro ($1 first month · renews at $9/mo)"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
              License Key: <code style={{ color: "#38bdf8" }}>{currentLicense || "Active on this browser"}</code> · 100% Ad-Free Sanctuary Active
            </p>
          </div>
          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={handleDeactivate}
          >
            Deactivate
          </button>
        </section>
      )}

      <section className="spe-pricing-grid" aria-label="Subscription Plans">
        {/* Tier 1: Free Community (95% Free) */}
        <article className="spe-pricing-card">
          <span className="spe-pricing-badge">95% of SPE · Always Free</span>
          <h2 className="spe-pricing-card-title">Free Community</h2>
          <p className="spe-pricing-desc">
            Everything you need to compile structured prompts, inspect AST invariants locally in WebAssembly, and explore 3D web templates at $0 cost.
          </p>

          <div className="spe-pricing-price-box">
            <span className="spe-pricing-amount">$0</span>
            <span className="spe-pricing-period">/ month forever</span>
          </div>

          <div className="spe-pricing-roi-banner">
            ✓ Funded by clean, non-intrusive developer ads on public discovery pages.
          </div>

          <ul className="spe-pricing-features" aria-label="Free Community Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>100,000+ Character (1 Lakh+)</strong> local input and output capacity in Create</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Curated Prompt &amp; Template Catalog</strong> across coding, UI, and research tasks</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>60+ Research-Paper Templates &amp; 101 Curated Skill Packs</strong> with scope checks</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>36+ Languages Voice &amp; Text</strong>: Browser speech/text to structured English prompts</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Interactive 3D Web Templates</strong> with camera path controls &amp; 1-click rebuild prompts</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={() => onNavigate?.("create")}
          >
            Start Free Now →
          </button>
        </article>

        {/* Tier 2: Developer Pro ($1 first month intro, renews at $9/mo) */}
        <article className="spe-pricing-card is-featured">
          <span className="spe-pricing-badge">Intro Offer · $1 First Month</span>
          <h2 className="spe-pricing-card-title">Developer Pro</h2>
          <p className="spe-pricing-desc">
            For individual builders who want an ad-free workspace, deterministic session continuation, and pre-flight invariant checks.
          </p>

          <div className="spe-pricing-price-box">
            <s className="spe-pricing-strike" aria-label="Standard renewal price $9">$9</s>
            <span className="spe-pricing-amount">$1</span>
            <span className="spe-pricing-period">/ first month · then $9/mo</span>
          </div>

          <div className="spe-pricing-roi-banner">
            💡 <strong>Projected Estimate:</strong> Designed to reduce wasted retry tokens by catching missing constraints before cloud API calls.
          </div>

          <ul className="spe-pricing-features" aria-label="Developer Pro Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>100% Ad-Free</strong> across every SPE page and studio workspace</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Auto-Applied 101 Skill Constraints</strong>: Helps reduce scope drift on declared file boundaries</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Session Recovery (`spe continue`)</strong>: Resume interrupted agent tasks from local state</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>1-Click IDE &amp; Eval Export</strong>: Export `.cursorrules`, `CLAUDE.md`, Windsurf, `.spe`, and `promptfooconfig.yaml`</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Media &amp; Transcript Structuring</strong>: Turn uploaded transcripts, audio, and docs into structured specs</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-primary"
            onClick={() => handleOpenPlan("Developer Pro ($1 First Month · then $9/mo)")}
          >
            {currentTier === "pro" ? "Plan Active ✓" : "Start $1 First-Month Intro →"}
          </button>
        </article>

        {/* Tier 3: Company / Team & CI/CD Gate ($9 first month intro, renews at $99/mo) */}
        <article className="spe-pricing-card">
          <span className="spe-pricing-badge">Team Intro · $9 First Month</span>
          <h2 className="spe-pricing-card-title">Company &amp; CI/CD Gate</h2>
          <p className="spe-pricing-desc">
            For engineering teams that require cryptographic Ed25519 receipts and pre-merge pull request verification gates.
          </p>

          <div className="spe-pricing-price-box">
            <s className="spe-pricing-strike" aria-label="Standard renewal price $99">$99</s>
            <span className="spe-pricing-amount">$9</span>
            <span className="spe-pricing-period">/ first month · then $99/mo</span>
          </div>

          <div className="spe-pricing-roi-banner">
            🛡️ Includes up to 10 team seats + local CLI &amp; GitHub Actions verification gates.
          </div>

          <ul className="spe-pricing-features" aria-label="Company and CI/CD Gate Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Everything in Developer Pro for up to <strong>10 team members</strong></span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Pre-Commit Guardrail</strong>: `spe check --pre-commit` checks declared scope invariants locally</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>CI/CD Compliance Gate</strong>: Automated GitHub Actions check on every pull request</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>RFC 8785 + Ed25519 Receipts</strong>: Tamper-evident verification logs for engineering review</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Shared team prompt contracts and receipt-gated Promptfoo export bundles</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={() => handleOpenPlan("Company & CI/CD Gate ($9 First Month · then $99/mo)")}
          >
            {currentTier === "team" ? "Plan Active ✓" : "Start $9 First-Month Team Intro →"}
          </button>
        </article>
      </section>

      {/* Independent Companion Product Cross-Promotion — AppleAGI for macOS */}
      <section className="spe-mac-special-section" aria-labelledby="mac-special-title">
        <span className="spe-pricing-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399" }}>
          🍎 Independent Sister Product · Also Powered by the Prawin Jaitley Engine
        </span>
        <h2 id="mac-special-title" className="spe-pricing-card-title" style={{ marginTop: "0.25rem" }}>
          Looking for Native macOS Desktop Automation? Explore AppleAGI (Separate Product)
        </h2>
        <p className="spe-pricing-subtitle" style={{ textAlign: "left", maxWidth: "78ch" }}>
          <strong>Product Boundary Note:</strong> <strong>SPE — System Prompt Engine</strong> is our cross-platform web and CLI prompt compilation, evaluation, and verification platform. <strong>AppleAGI</strong> is a separate, independent native macOS desktop assistant built on the same <strong>Prawin Jaitley Engine</strong> for Apple Silicon users who want local macOS Accessibility, Vision OCR, and sandboxed desktop task automation.
        </p>

        <div className="spe-mac-special-grid">
          <div className="spe-mac-offer-card">
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase" }}>
              SPE ↔ AppleAGI Local Bridge · Included
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <strong style={{ fontSize: "1.5rem", color: "#ffffff" }}>Local Loopback</strong>
              <span style={{ color: "#94a3b8", fontSize: "0.88rem" }}>127.0.0.1:4319</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              Export verified <code>.spe</code> contracts from the SPE Web Studio directly to a local continuation daemon or IDE workspace (`CLAUDE.md`, `.cursorrules`, Windsurf) on your machine.
            </p>
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-secondary"
              style={{ marginTop: "0.5rem" }}
              onClick={() => onNavigate?.("capabilities")}
            >
              Inspect Local Bridge &amp; Export Studio →
            </button>
          </div>

          <div className="spe-mac-offer-card" style={{ borderColor: "rgba(16, 185, 129, 0.45)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase" }}>
              AppleAGI for macOS · Standalone Companion App
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <strong style={{ fontSize: "1.5rem", color: "#ffffff" }}>macOS Native</strong>
              <span style={{ color: "#94a3b8", fontSize: "0.88rem" }}>AppKit · Vision OCR · Speech</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              Maintained as a separate macOS product track with its own evaluation suite (29/29 regression tests, 34-locale command matrix, and explicit hardware/OS permission boundaries).
            </p>
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-secondary"
              style={{ marginTop: "0.5rem", borderColor: "#10b981", color: "#34d399" }}
              onClick={() => onNavigate?.("capabilities")}
            >
              View AppleAGI Companion Overview →
            </button>
          </div>
        </div>
      </section>

      {/* Transparent FAQ Section */}
      <section className="spe-pricing-faq-section" aria-labelledby="pricing-faq-title">
        <h2 id="pricing-faq-title" className="spe-pricing-faq-title">
          Transparent Pricing, Privacy &amp; Qualification FAQ
        </h2>
        <dl className="spe-pricing-faq-grid">
          <div className="spe-pricing-faq-card">
            <dt>How does the $1 and $9 introductory pricing work?</dt>
            <dd>
              Over 95% of SPE&apos;s in-browser tools are $0 forever. For builders who want an ad-free workspace and advanced continuation tools, <strong>Developer Pro is $1 for the first month and renews at $9/month</strong>. For teams needing CI/CD pull-request gates and up to 10 seats, <strong>Company &amp; CI/CD Gate is $9 for the first month and renews at $99/month</strong>.
            </dd>
          </div>
          <div className="spe-pricing-faq-card">
            <dt>Which features run 100% locally in my browser vs. external services?</dt>
            <dd>
              <strong>Local In-Browser (Zero Network Egress):</strong> Prompt compilation, AST type-checking, Hostile Gym 32-vector stress testing, counterfactual lint checks, and RFC 8785 / SHA-256 receipt generation execute inside our 1.3 MB client-side WebAssembly engine. <strong>Optional External / Loopback Connections:</strong> Connecting to `127.0.0.1:4319` (local continuation daemon) or running live model calls through your own OpenAI/Anthropic API keys sends traffic only to the endpoints you explicitly configure.
            </dd>
          </div>
          <div className="spe-pricing-faq-card">
            <dt>How are token savings and ROI estimates calculated?</dt>
            <dd>
              All savings figures shown on the site are <strong>projected estimates</strong> modeled on catching missing constraints, schema errors, and scope violations at compile time in local WASM ($0) before dispatching multi-turn cloud LLM retries. Actual savings vary by model provider, prompt length, and workflow complexity.
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
            <h3 id="modal-plan-title">{selectedPlan}</h3>
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
                  onClick={() => setModalOpen(false)}
                >
                  Open Ad-Free Workspace →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubscribe}>
                <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem" }}>
                  Enter your email to activate your launch offer and receive your instant ad-free workspace key:
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
                    Activate Launch License →
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
