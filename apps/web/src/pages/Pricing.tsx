import { useState } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import {
  verifySignedEntitlementToken,
  resolveBrowserVerifiedEntitlement,
  persistBrowserVerifiedEntitlement,
  clearBrowserVerifiedEntitlement,
  createPublicBetaWaitlistReservation,
  startBrowserFreeTrial,
  resolveBrowserTrialEntitlement,
  clearBrowserTrialEntitlement,
  type AuthoritativeReceiptRecord,
  type EntitlementTokenPayload,
  type PublicBetaReservationRecord,
  type SignedReceiptStatusAttestation,
  type TrialEntitlementRecord,
} from "../engine/entitlementVerifier";
import "./pricing.css";

export interface StripeCheckoutLinks {
  proIntroUrl: string;
  lifetimeUrl: string;
  companyIntroUrl: string;
}

export const DEFAULT_STRIPE_LINKS: StripeCheckoutLinks = {
  proIntroUrl:
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_STRIPE_PRO_INTRO_URL) ||
    "https://checkout.systempromptengine.com/pro_intro",
  lifetimeUrl:
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_STRIPE_LIFETIME_URL) ||
    "https://checkout.systempromptengine.com/lifetime",
  companyIntroUrl:
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_STRIPE_COMPANY_INTRO_URL) ||
    "https://checkout.systempromptengine.com/company_intro",
};


interface PricingProps {
  onNavigate?: (view: AppView) => void;
  issuerPublicKeyHex?: string;
  authoritativeReceiptVerifier?: (
    paymentReceiptId: string,
    payload: EntitlementTokenPayload,
  ) => AuthoritativeReceiptRecord | null;
  signedReceiptAttestation?: SignedReceiptStatusAttestation | string;
  checkoutLinks?: StripeCheckoutLinks;
}

export function Pricing({
  onNavigate,
  issuerPublicKeyHex,
  authoritativeReceiptVerifier,
  signedReceiptAttestation,
  checkoutLinks,
}: PricingProps) {
  const links = checkoutLinks ?? DEFAULT_STRIPE_LINKS;

  const getCheckoutUrlForPlan = (plan: string): string => {
    if (plan.includes("Lifetime")) return links.lifetimeUrl;
    if (plan.includes("Company") || plan.includes("CI/CD") || plan.includes("Team") || plan.includes("Agency")) {
      return links.companyIntroUrl;
    }
    return links.proIntroUrl;
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Developer Pro");
  const [email, setEmail] = useState("");
  const [signedTokenInput, setSignedTokenInput] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [waitlistReservation, setWaitlistReservation] = useState<PublicBetaReservationRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [activeTrial, setActiveTrial] = useState<TrialEntitlementRecord | null>(() => {
    return resolveBrowserTrialEntitlement();
  });

  const [currentTier, setCurrentTier] = useState<string | null>(() => {
    const check = resolveBrowserVerifiedEntitlement({
      issuerPublicKeyHex,
      authoritativeReceiptVerifier,
      signedReceiptAttestation,
    });
    return check.verified ? check.tier : null;
  });

  const [currentLicense, setCurrentLicense] = useState<string | null>(() => {
    try {
      const storedToken = localStorage.getItem("spe-license-key");
      if (!storedToken) {
        const trial = resolveBrowserTrialEntitlement();
        return trial && trial.status === "ACTIVE_TRIAL" ? trial.trialId : null;
      }
      const check = resolveBrowserVerifiedEntitlement({
        token: storedToken,
        issuerPublicKeyHex,
        authoritativeReceiptVerifier,
        signedReceiptAttestation,
      });
      return check.verified ? storedToken : null;
    } catch {
      return null;
    }
  });

  const handleOpenPlan = (planName: string) => {
    setSelectedPlan(planName);
    setSubmitted(false);
    setEmail("");
    setSignedTokenInput("");
    setVerificationError(null);
    setGeneratedKey(null);
    setWaitlistReservation(null);
    setModalOpen(true);
  };

  const handleStartTrial = (tier: "pro" | "team" = "pro") => {
    const trialEmail = email.trim() || "developer@workspace.local";
    const trialRecord = startBrowserFreeTrial(tier, trialEmail, 7);
    setActiveTrial(trialRecord);
    setCurrentTier(tier);
    setCurrentLicense(trialRecord.trialId);
    setSelectedPlan(trialRecord.planName);
    setGeneratedKey(trialRecord.trialId);
    setWaitlistReservation(null);
    setSubmitted(true);
    setModalOpen(true);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setVerificationError(null);

    if (signedTokenInput.trim()) {
      const verification = resolveBrowserVerifiedEntitlement({
        token: signedTokenInput.trim(),
        expectedEmail: email.trim(),
        issuerPublicKeyHex,
        authoritativeReceiptVerifier,
        signedReceiptAttestation,
      });
      if (!verification.verified || !verification.tier) {
        const directCheck = verifySignedEntitlementToken(signedTokenInput.trim(), {
          expectedEmail: email.trim(),
           authoritativeReceiptVerifier,
          signedReceiptAttestation,
        });
        setVerificationError(
          verification.rejectionReason ||
            directCheck.rejectionReason ||
            "Invalid or unverified server entitlement token.",
        );
        return;
      }
      try {
        clearBrowserTrialEntitlement();
        persistBrowserVerifiedEntitlement(
          email.trim(),
          signedTokenInput.trim(),
          verification,
          signedReceiptAttestation,
        );
        setActiveTrial(null);
        setCurrentTier(verification.tier);
        setCurrentLicense(signedTokenInput.trim());
      } catch {
        // Storage access protected or restricted
      }
      setGeneratedKey(signedTokenInput.trim());
      setWaitlistReservation(null);
      setSubmitted(true);
      return;
    }

    const reservation = createPublicBetaWaitlistReservation(selectedPlan, email);
    try {
      localStorage.setItem("spe-beta-reservation", JSON.stringify(reservation));
    } catch {
      // Storage access protected or restricted
    }
    setWaitlistReservation(reservation);
    setGeneratedKey(reservation.reservationId);
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
      clearBrowserVerifiedEntitlement();
      clearBrowserTrialEntitlement();
      setCurrentTier(null);
      setCurrentLicense(null);
      setActiveTrial(null);
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
          <span><strong>Checkout Mode:</strong> {links.proIntroUrl.includes("test_") ? "Preview (sandbox / test links active)" : "Live Production"}</span>
          <span>·</span>
          <span><strong>Gates Pending Full Production:</strong> G6-H (Blinded Human Study) &amp; REC-2E (External Multi-Provider Holdout)</span>
        </div>
      </header>

      {/* Active Subscription or Free Trial Banner */}
      {(currentTier || activeTrial) && (
        <section
          className="spe-active-subscription-banner"
          style={{
            maxWidth: "760px",
            margin: "0 auto 2.5rem auto",
            backgroundColor: activeTrial ? "#0f231e" : "#0d1b33",
            border: activeTrial ? "1px solid #10b981" : "1px solid #38bdf8",
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: activeTrial ? "0 0 24px rgba(16, 185, 129, 0.18)" : "0 0 24px rgba(56, 189, 248, 0.15)",
          }}
          aria-label="Active License Status"
        >
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                fontWeight: 700,
                color: activeTrial ? "#34d399" : "#38bdf8",
                letterSpacing: "0.05em",
              }}
            >
              {activeTrial ? "7-Day Free Trial Active" : "Active Signed Entitlement"}
            </span>
            <h2 style={{ margin: "0.25rem 0", color: "#f8fafc", fontSize: "1.2rem", fontWeight: 700 }}>
              {activeTrial
                ? `${activeTrial.planName} (${Math.max(0, Math.ceil((activeTrial.expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000)))} Days Remaining)`
                : currentTier === "team"
                ? "Company & CI/CD Gate ($9 first month · renews at $99/mo)"
                : "Developer Pro ($1 first month · renews at $9/mo)"}
            </h2>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
              {activeTrial ? (
                <>
                  Trial Reference: <code style={{ color: "#34d399" }}>{activeTrial.trialId}</code> · 100% Full Access to 30,000+ Character Output, 101 Skills &amp; Transcompilers Active.
                </>
              ) : (
                <>
                  Verified Token: <code style={{ color: "#38bdf8" }}>{currentLicense ? `${currentLicense.slice(0, 36)}...` : "Verified"}</code> · 100% Ad-Free Sanctuary Active (Deactivating removes local token; recurring billing is managed via server checkout)
                </>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {activeTrial && (
              <a
                href={links.lifetimeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="spe-pricing-cta spe-pricing-cta-primary"
                style={{
                  textDecoration: "none",
                  padding: "8px 16px",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Upgrade to Lifetime ($69) →
              </a>
            )}
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-secondary"
              onClick={handleDeactivate}
            >
              {activeTrial ? "End Free Trial" : "Deactivate Local Token"}
            </button>
          </div>
        </section>
      )}

      {/* 7-Day Free Trial Callout Banner for All Users */}
      {!currentTier && !activeTrial && (
        <section
          className="spe-trial-callout-banner"
          style={{
            maxWidth: "760px",
            margin: "0 auto 2.5rem auto",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "14px",
            padding: "1.25rem 1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.25rem",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
          }}
          aria-label="Universal 7-Day Free Trial"
        >
          <div style={{ flex: "1 1 340px" }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "999px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34d399",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.4rem",
              }}
            >
              7-Day Full Access Free Trial · Available for Everyone
            </span>
            <h2 style={{ margin: "0.2rem 0 0.4rem 0", color: "#f8fafc", fontSize: "1.25rem", fontWeight: 700 }}>
              Test-Drive Developer Pro or Team Free for 7 Days
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              Zero payment upfront. Zero credit card required. Experience 30,000+ character prompt output, 11+ dialect transcompilers, and 101 skill packs instantly with 1-click browser activation for 7 days.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-primary"
              style={{ background: "#10b981", borderColor: "#10b981", color: "#ffffff", padding: "10px 18px" }}
              onClick={() => handleStartTrial("pro")}
            >
              Start 7-Day Free Trial (Zero Card Required) →
            </button>
          </div>
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
              <span><strong>100,000+ Character (1 Lakh+) Context Input</strong> (up to 30,000-char prompt output in Free; 100,000 in Pro)</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Universal Free Tier Access</strong>: Up to 30,000 characters free to all users, AI models, and autonomous bots</span>
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

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-primary"
              onClick={() => handleOpenPlan("Developer Pro ($1 First Month · then $9/mo)")}
            >
              {currentTier === "pro" ? "Plan Active ✓" : "Start $1 First-Month Intro →"}
            </button>
            {!currentTier && (
              <button
                type="button"
                className="spe-pricing-cta spe-pricing-cta-secondary"
                style={{ borderColor: "rgba(16, 185, 129, 0.5)", color: "#34d399", fontSize: "0.82rem" }}
                onClick={() => handleStartTrial("pro")}
              >
                Or Start 7-Day Free Trial (No Card) →
              </button>
            )}
          </div>
        </article>

        {/* Tier 3: Lifetime Founder Pass ($69 One-Time) */}
        <article className="spe-pricing-card">
          <span className="spe-pricing-badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
            Founder Special · One-Time
          </span>
          <h2 className="spe-pricing-card-title">Lifetime Pass</h2>
          <p className="spe-pricing-desc">
            Pay once, keep Developer Pro capabilities forever. No recurring subscriptions, perpetual local offline license.
          </p>

          <div className="spe-pricing-price-box">
            <span className="spe-pricing-amount">$69</span>
            <span className="spe-pricing-period">/ one-time payment</span>
          </div>

          <div className="spe-pricing-roi-banner">
            ⭐ Lifetime local license: zero recurring fees, perpetual offline validity.
          </div>

          <ul className="spe-pricing-features" aria-label="Lifetime Pass Features">
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>All Developer Pro Features Forever</strong> without ongoing monthly bills</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>100% Ad-Free Studio</strong> permanently unlocked</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Lifetime Offline Entitlement Key</strong> signed with Ed25519</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span><strong>Full Skill &amp; Template Library</strong> including future 2026/2027 packs</span>
            </li>
            <li className="spe-pricing-feature-item">
              <span className="spe-pricing-feature-icon" aria-hidden="true">✓</span>
              <span>Direct access to new experimental model transcompilers</span>
            </li>
          </ul>

          <button
            type="button"
            className="spe-pricing-cta spe-pricing-cta-secondary"
            onClick={() => handleOpenPlan("Lifetime Founder Pass ($69 One-Time)")}
          >
            {currentTier === "pro" ? "Plan Active ✓" : "Get Lifetime Pass ($69) →"}
          </button>
        </article>

        {/* Tier 4: Company / Team & CI/CD Gate ($9 first month intro, renews at $99/mo) */}
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

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              className="spe-pricing-cta spe-pricing-cta-secondary"
              onClick={() => handleOpenPlan("Company & CI/CD Gate ($9 First Month · then $99/mo)")}
            >
              {currentTier === "team" ? "Plan Active ✓" : "Start $9 First-Month Team Intro →"}
            </button>
            {!currentTier && (
              <button
                type="button"
                className="spe-pricing-cta spe-pricing-cta-secondary"
                style={{ borderColor: "rgba(16, 185, 129, 0.5)", color: "#34d399", fontSize: "0.82rem" }}
                onClick={() => handleStartTrial("team")}
              >
                Or Start 7-Day Team Trial (No Card) →
              </button>
            )}
          </div>
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
          <div className="spe-pricing-modal" style={{ maxWidth: "520px" }}>
            <h3 id="modal-plan-title">{selectedPlan}</h3>
            {submitted ? (
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#34d399", fontWeight: 700, marginBottom: "0.75rem" }}>
                  {activeTrial
                    ? "✓ 7-Day Free Trial Activated Successfully!"
                    : waitlistReservation
                    ? "✓ Public Beta Checkout Reservation Recorded"
                    : "✓ Signed Server Entitlement Token Verified & Activated!"}
                </p>
                <div style={{ backgroundColor: "#020617", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.25rem" }}>
                    {activeTrial
                      ? "Active 7-Day Trial Token:"
                      : waitlistReservation
                      ? "Waitlist Reference ID:"
                      : "Verified Entitlement Token:"}
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <code style={{ color: activeTrial ? "#34d399" : "#38bdf8", fontWeight: 700, fontSize: "0.85rem", wordBreak: "break-all" }}>
                      {generatedKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      style={{
                        minHeight: "36px",
                        padding: "6px 14px",
                        backgroundColor: "#1e293b",
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                        borderRadius: "9999px",
                        color: "#f8fafc",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {copiedKey ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                  {activeTrial ? (
                    <>
                      Your 7-day free trial for <strong>{activeTrial.planName}</strong> is now active in this browser. All Developer Pro capabilities, 30,000+ character output capacity, and 101 skill packs are unlocked with zero payment or credit card required.
                    </>
                  ) : waitlistReservation ? (
                    <>
                      Your Public Beta reservation for <strong>{waitlistReservation.requestedPlan}</strong> is saved. Paid tier entitlements (<code>pro</code> / <code>team</code>) are never self-minted in the browser and activate only after server payment confirmation and signed token verification (<code>spe_entitlement.v1...</code>).
                    </>
                  ) : (
                    <>
                      Your cryptographic server entitlement token has been verified. Your browser workspace is now <strong>100% Ad-Free</strong> with paid tier features unlocked.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="spe-pricing-cta spe-pricing-cta-primary"
                  onClick={() => setModalOpen(false)}
                >
                  Return to Workspace →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "1rem", padding: "0.85rem", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.35)" }}>
                  <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.84rem", color: "#34d399", fontWeight: 700 }}>
                    7-Day Instant Free Trial (Zero Card Required)
                  </p>
                  <p style={{ margin: "0 0 0.6rem 0", fontSize: "0.76rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                    Start test-driving full 30,000+ character capacity and all Pro capabilities in your browser right now for 7 days.
                  </p>
                  <button
                    type="button"
                    className="spe-pricing-cta spe-pricing-cta-primary"
                    style={{
                      background: "#10b981",
                      borderColor: "#10b981",
                      color: "#ffffff",
                      width: "100%",
                      minHeight: "40px",
                    }}
                    onClick={() => handleStartTrial(selectedPlan.includes("Company") ? "team" : "pro")}
                  >
                    Activate 7-Day Free Trial Instantly →
                  </button>
                </div>

                <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "rgba(15, 23, 42, 0.65)", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                  <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.84rem", color: "#f8fafc", fontWeight: 600 }}>
                    Instant Checkout via Stripe:
                  </p>
                  <a
                    href={getCheckoutUrlForPlan(selectedPlan)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="spe-pricing-cta spe-pricing-cta-primary"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      textDecoration: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      minHeight: "44px",
                    }}
                  >
                    Proceed to Secure Stripe Checkout →
                  </a>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.72rem", color: "#64748b", textAlign: "center" }}>
                    Secured by Stripe · Automatic Ed25519 cryptographic token issued after purchase
                  </p>
                </div>

                <form onSubmit={handleSubscribe}>
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.6rem" }}>
                    Already paid? Paste your signed entitlement token, or enter your email to reserve the introductory rate:
                  </p>
                  <input
                    type="email"
                    required
                    placeholder="developer@company.com"
                    className="spe-pricing-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Optional: spe_entitlement.v1.<payload>.<signature>"
                    className="spe-pricing-input"
                    style={{ marginTop: "0.65rem", fontFamily: "monospace", fontSize: "0.8rem" }}
                    value={signedTokenInput}
                    onChange={(e) => setSignedTokenInput(e.target.value)}
                  />
                  {verificationError && (
                    <p style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "0.5rem", marginBottom: 0 }}>
                      {verificationError}
                    </p>
                  )}
                  <div className="spe-pricing-modal-actions" style={{ marginTop: "1rem" }}>
                    <button
                      type="submit"
                      className="spe-pricing-cta spe-pricing-cta-primary"
                    >
                      {signedTokenInput.trim() ? "Verify Signed Token →" : "Reserve Public Beta Rate →"}
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
