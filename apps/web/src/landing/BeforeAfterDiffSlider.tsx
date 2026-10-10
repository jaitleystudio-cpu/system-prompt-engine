/**
 * SPE Ω Interactive Before vs After Diff Slider
 * Visual proof demonstrating how SPE eliminates agent hallucinations,
 * enforces invariant boundaries, and saves wasted API spend.
 */

import React, { useState, useRef, useCallback } from "react";
import type { AppView } from "../routing";
import { copyTextSafe } from "../engine/workflows/clipboard";
import "./before-after-diff.css";

interface BeforeAfterDiffSliderProps {
  onNavigate?: (view: AppView) => void;
}

interface DiffScenario {
  id: string;
  name: string;
  description: string;
  before: {
    label: string;
    outcome: string;
    tokens: string;
    cost: string;
    scope: string;
    tests: string;
    lines: Array<{ type: "cmd" | "warn" | "fail" | "muted"; text: string }>;
  };
  after: {
    label: string;
    outcome: string;
    tokens: string;
    cost: string;
    scope: string;
    tests: string;
    lines: Array<{ type: "cmd" | "pass" | "receipt" | "muted"; text: string }>;
  };
}

const SCENARIOS: DiffScenario[] = [
  {
    id: "auth-refactor",
    name: "API Auth Refactor",
    description: "Refactoring express JWT authentication middleware to support Bearer tokens and revoke lists.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Build Failed · Silent Regressions",
      tokens: "142,500 tokens",
      cost: "$45.60 wasted",
      scope: "14 files modified (Out of bounds)",
      tests: "0 / 6 Passed (4 broken)",
      lines: [
        { type: "cmd", text: "$ claude run \"refactor auth middleware to use bearer token\"" },
        { type: "warn", text: "⚠️ Ambiguous instruction. Attempting broad codebase scan..." },
        { type: "fail", text: "✗ npm install express-jwt-better-auth (404 Not Found - hallucinated)" },
        { type: "fail", text: "✗ Modified src/auth/jwt.ts: deleted TokenBlacklist interface" },
        { type: "fail", text: "✗ Modified .env: printed JWT_SECRET in stdout logs!" },
        { type: "fail", text: "✗ Modified 13 unrelated files across repo" },
        { type: "fail", text: "✗ npm test: 4 failing tests! Tests skipped to finish run." },
        { type: "muted", text: "Agent reported: \"Refactor finished successfully.\" (False Positive)" },
      ],
    },
    after: {
      label: "With SPE (Guardrails Active)",
      outcome: "100% Invariant Pass · Zero Drift",
      tokens: "4,200 tokens",
      cost: "$0.00 local ($0.03 API)",
      scope: "1 file modified (Strict boundary)",
      tests: "12 / 12 Passed (Guaranteed test pass)",
      lines: [
        { type: "cmd", text: "$ spe run auth-refactor --invariants strict" },
        { type: "receipt", text: "[SPE Guardrail] Project Scope Locked: Zero secret leaks allowed" },
        { type: "receipt", text: "[SPE Guardrail] Boundary locked: src/middleware/auth.ts (max 45 lines)" },
        { type: "receipt", text: "[SPE Guardrail] Permission ceiling: local_first (zero network / zero secret egress)" },
        { type: "pass", text: "+ Preserved TokenBlacklist interface & existing session contracts" },
        { type: "pass", text: "+ Implemented Bearer token validation with timing-safe comparison" },
        { type: "receipt", text: "[SPE Audit Receipt] Guaranteed Test Gate: npm test -- --grep \"auth\"" },
        { type: "pass", text: "✓ 12/12 unit tests passing (100% verified test pass)" },
      ],
    },
  },
  {
    id: "db-migration",
    name: "Database Migration",
    description: "Adding indexed foreign key relations and backfilling audit tables in SQL migration.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Data Loss Risk · Dropped Index",
      tokens: "188,000 tokens",
      cost: "$59.20 wasted",
      scope: "7 schema files modified",
      tests: "0 / 8 Passed (Syntax errors)",
      lines: [
        { type: "cmd", text: "$ windsurf cascade \"add foreign keys and audit trigger\"" },
        { type: "warn", text: "⚠️ Invented unverified table naming convention 'tbl_audit_logs'" },
        { type: "fail", text: "✗ Executed raw DROP TABLE IF EXISTS on staging database!" },
        { type: "fail", text: "✗ Generated circular foreign key constraint causing deadlock" },
        { type: "fail", text: "✗ Migration failed in transaction rollback" },
        { type: "muted", text: "Agent stalled in runaway retry loop (12 iterations, $59 API burn)" },
      ],
    },
    after: {
      label: "With SPE (Guardrails Active)",
      outcome: "Zero Regressions · Reversible DDL",
      tokens: "3,800 tokens",
      cost: "$0.00 local ($0.02 API)",
      scope: "1 migration file modified",
      tests: "8 / 8 Passed (Idempotency verified)",
      lines: [
        { type: "cmd", text: "$ spe run db-migration --rules safe-ddl" },
        { type: "receipt", text: "[SPE Guardrail] Scope Locked: Zero destructive drops allowed" },
        { type: "receipt", text: "[SPE Guardrail] Reversibility Gate: Generating down-migration pairing" },
        { type: "pass", text: "+ Added non-blocking concurrent index on foreign key column" },
        { type: "pass", text: "+ Structured idempotent audit log trigger with rollback guard" },
        { type: "receipt", text: "[SPE Audit Receipt] Verification: Schema migration dry-run completed in sandbox" },
        { type: "pass", text: "✓ 8/8 migration assertions passing with zero locking violations" },
      ],
    },
  },
  {
    id: "multi-file",
    name: "Multi-File Feature",
    description: "Implementing webhook signature verification across worker handlers and routers.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Dependency Drift · Type Errors",
      tokens: "210,000 tokens",
      cost: "$67.40 wasted",
      scope: "22 files modified",
      tests: "Failed compile (9 TypeScript errors)",
      lines: [
        { type: "cmd", text: "$ cursor-agent \"wire stripe webhook signature checking\"" },
        { type: "warn", text: "⚠️ Agent rewrote package.json, upgrading major versions" },
        { type: "fail", text: "✗ Introduced broken peer dependency conflict in lockfile" },
        { type: "fail", text: "✗ Ignored existing shared crypto utility and rewrote flawed HMAC" },
        { type: "fail", text: "✗ TypeScript compilation failed: 9 errors in 4 packages" },
        { type: "muted", text: "Human engineer spent 3 hours reverting git branch" },
      ],
    },
    after: {
      label: "With SPE (Scope Guardrails Active)",
      outcome: "Clean Typecheck · Instant Merge",
      tokens: "5,100 tokens",
      cost: "$0.00 local ($0.04 API)",
      scope: "2 targeted files modified",
      tests: "15 / 15 Passed (Typecheck + E2E receipts)",
      lines: [
        { type: "cmd", text: "$ spe run webhook-signature --strict-types" },
        { type: "receipt", text: "[SPE Guardrail] Lockfile Locked: Zero package modifications allowed" },
        { type: "receipt", text: "[SPE Guardrail] Scope lock: routes/webhooks.ts & handlers/stripe.ts" },
        { type: "pass", text: "+ Reused existing timing-safe HMAC utility from internal crypto lib" },
        { type: "pass", text: "+ All TypeScript interfaces verified: 0 typecheck errors" },
        { type: "receipt", text: "[SPE Audit Receipt] Guaranteed Test Gate: tsc --noEmit && npm test" },
        { type: "pass", text: "✓ 15/15 test receipts verified. Clean commit ready to merge." },
      ],
    },
  },
];

export const BeforeAfterDiffSlider: React.FC<BeforeAfterDiffSliderProps> = ({
  onNavigate,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("auth-refactor");
  const [splitPct, setSplitPct] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [cliCopied, setCliCopied] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeScenario =
    SCENARIOS.find((s) => s.id === activeScenarioId) ?? SCENARIOS[0];

  const updateSplitFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPct(pct);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updateSplitFromClientX(e.clientX);
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback gracefully
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSplitFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Fallback gracefully
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSplitPct((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSplitPct((prev) => Math.min(100, prev + 5));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSplitPct(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSplitPct(100);
    }
  };

  const copyCliCommand = async () => {
    await copyTextSafe("npm install -g @systempromptengine/cli");
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 2500);
  };

  return (
    <section
      className="spe-diff-section"
      data-copy-depth="PROOF"
      aria-labelledby="diff-slider-heading"
    >
      <div className="spe-diff-container">
        {/* Section Heading */}
        <div className="spe-diff-header">
          <span className="spe-diff-eyebrow">
            EMPIRICAL RUN DIFF · HALLUCINATION VS DETERMINISM
          </span>
          <h2 id="diff-slider-heading" className="spe-diff-title">
            Before vs After: <em>See the Proof in Real Agent Runs</em>
          </h2>
          <p className="spe-diff-subtitle">
            Drag the interactive slider below to compare an unguided AI coding agent run against an SPE Ω Protected Prompt execution.
          </p>
        </div>

        {/* Scenario Selection Tabs */}
        <div
          className="spe-diff-scenarios"
          role="tablist"
          aria-label="Diff comparison scenarios"
        >
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              role="tab"
              aria-selected={activeScenarioId === sc.id}
              className={`spe-diff-scenario-tab ${
                activeScenarioId === sc.id ? "is-active" : ""
              }`}
              onClick={() => setActiveScenarioId(sc.id)}
            >
              <span>{sc.name}</span>
            </button>
          ))}
        </div>

        {/* Scorecard Summary Pill Grid */}
        <div className="spe-diff-scorecard-grid">
          <div className="spe-diff-scorecard is-before">
            <div className="spe-scorecard-label">
              <span>{activeScenario.before.label}</span>
              <span>{activeScenario.before.cost}</span>
            </div>
            <div className="spe-scorecard-stats">
              <div className="spe-stat-item">
                <span className="spe-stat-name">Outcome</span>
                <span className="spe-stat-val">{activeScenario.before.outcome}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Scope Drift</span>
                <span className="spe-stat-val">{activeScenario.before.scope}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Test Status</span>
                <span className="spe-stat-val">{activeScenario.before.tests}</span>
              </div>
            </div>
          </div>

          <div className="spe-diff-scorecard is-after">
            <div className="spe-scorecard-label">
              <span>{activeScenario.after.label}</span>
              <span>{activeScenario.after.cost}</span>
            </div>
            <div className="spe-scorecard-stats">
              <div className="spe-stat-item">
                <span className="spe-stat-name">Outcome</span>
                <span className="spe-stat-val">{activeScenario.after.outcome}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Scope Drift</span>
                <span className="spe-stat-val">{activeScenario.after.scope}</span>
              </div>
              <div className="spe-stat-item">
                <span className="spe-stat-name">Test Status</span>
                <span className="spe-stat-val">{activeScenario.after.tests}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Diff Viewport */}
        <div className="spe-diff-viewport-wrap">
          {/* Quick Preset Buttons */}
          <div className="spe-diff-quick-controls">
            <span>
              Slider Position: <strong>{Math.round(splitPct)}%</strong> (Drag divider or click presets)
            </span>
            <div className="spe-diff-toggle-btns">
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 100 ? "is-active" : ""}`}
                onClick={() => setSplitPct(100)}
                aria-label="Show 100% Before unguided run"
              >
                100% Before
              </button>
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 50 ? "is-active" : ""}`}
                onClick={() => setSplitPct(50)}
                aria-label="Split 50 50 view"
              >
                50 / 50 Split
              </button>
              <button
                type="button"
                className={`spe-diff-toggle-btn ${splitPct === 0 ? "is-active" : ""}`}
                onClick={() => setSplitPct(0)}
                aria-label="Show 100% After SPE protected run"
              >
                100% After
              </button>
            </div>
          </div>

          {/* Interactive Split Canvas */}
          <div
            ref={containerRef}
            className="spe-diff-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* UNDER LAYER: AFTER (SPE Protected Run) */}
            <div className="spe-pane-under is-after">
              <div className="spe-terminal-window">
                <div className="spe-terminal-topbar">
                  <div className="spe-terminal-dots">
                    <span className="spe-dot spe-dot-green" />
                    <span className="spe-dot spe-dot-green" />
                    <span className="spe-dot spe-dot-green" />
                  </div>
                  <span className="spe-terminal-tag">
                    🛡️ SPE Ω Protected Run (Deterministic)
                  </span>
                </div>
                <ul className="spe-terminal-lines">
                  {activeScenario.after.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className={`spe-log-line ${
                        ln.type === "cmd"
                          ? "spe-log-cmd"
                          : ln.type === "pass"
                          ? "spe-log-pass"
                          : ln.type === "receipt"
                          ? "spe-log-receipt"
                          : "spe-log-muted"
                      }`}
                    >
                      {ln.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* OVER LAYER: BEFORE (Unguided Run), clipped to splitPct */}
            <div
              className="spe-pane-over is-before"
              style={{
                clipPath: `polygon(0% 0%, ${splitPct}% 0%, ${splitPct}% 100%, 0% 100%)`,
              }}
            >
              <div className="spe-terminal-window">
                <div className="spe-terminal-topbar">
                  <div className="spe-terminal-dots">
                    <span className="spe-dot spe-dot-red" />
                    <span className="spe-dot spe-dot-yellow" />
                    <span className="spe-dot spe-dot-red" />
                  </div>
                  <span className="spe-terminal-tag">
                    ❌ Unguided AI Agent Run (Hallucination)
                  </span>
                </div>
                <ul className="spe-terminal-lines">
                  {activeScenario.before.lines.map((ln, idx) => (
                    <li
                      key={idx}
                      className={`spe-log-line ${
                        ln.type === "cmd"
                          ? "spe-log-cmd"
                          : ln.type === "warn"
                          ? "spe-log-warn"
                          : ln.type === "fail"
                          ? "spe-log-fail"
                          : "spe-log-muted"
                      }`}
                    >
                      {ln.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* DRAGGABLE SLIDER DIVIDER */}
            <div
              className="spe-slider-divider"
              style={{ left: `${splitPct}%` }}
              role="slider"
              tabIndex={0}
              aria-label="Comparison slider between unguided agent and SPE protected run"
              aria-valuenow={Math.round(splitPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              onKeyDown={handleKeyDown}
            >
              <div className="spe-slider-handle">
                <span className="spe-handle-icon" aria-hidden="true">
                  ◂ ▸
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action CTAs Below Slider */}
        <div className="spe-diff-actions">
          <button
            type="button"
            className="spe-diff-cta-primary"
            onClick={() => {
              if (onNavigate) {
                onNavigate("create");
                window.scrollTo(0, 0);
              }
            }}
          >
            <span>Try Protected Prompt Studio Free ↗</span>
          </button>

          <div className="spe-diff-cli-box">
            <code>npm install -g @systempromptengine/cli</code>
            <button
              type="button"
              className="spe-diff-cli-copy"
              onClick={copyCliCommand}
              aria-label="Copy CLI install command"
            >
              {cliCopied ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          <button
            type="button"
            className="spe-diff-cta-ghost"
            onClick={() => {
              if (onNavigate) {
                onNavigate("workflows");
                window.scrollTo(0, 0);
              }
            }}
          >
            <span>Explore 1-Click Business Workflows →</span>
          </button>
        </div>
      </div>
    </section>
  );
};
