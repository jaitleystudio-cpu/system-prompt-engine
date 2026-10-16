import { useMemo } from "react";
import { parseCustomSentence, type ParsedSentenceResult } from "./plainEnglishParser";
import "./real-prompt-live-hud.css";

export interface RealPromptLiveHudProps {
  value: string;
  busy: boolean;
  onBuild: () => void;
  category?: string;
}

export function RealPromptLiveHud({ value, busy, onBuild }: RealPromptLiveHudProps) {
  const parsed: ParsedSentenceResult = useMemo(
    () => parseCustomSentence(value),
    [value]
  );

  const hasContent = value.trim().length > 0;

  if (!hasContent) {
    return (
      <div className="spe-preview-container empty" role="region" aria-label="Prompt structure blueprint">
        <div className="spe-preview-header">
          <span className="spe-preview-badge">HOW IT WORKS</span>
          <h3 className="spe-preview-title">
            Turn plain English into a structured prompt.
          </h3>
          <p className="spe-preview-intro">
            As you type on the left, SPE automatically organizes your words into 4 essential building blocks:
          </p>
        </div>

        <div className="spe-preview-cards">
          <div className="spe-preview-card role">
            <div className="spe-preview-card-head">
              <span className="spe-preview-pill role">01 · ROLE</span>
              <span className="spe-preview-hint">Who the AI becomes</span>
            </div>
            <p className="spe-preview-card-text placeholder">
              Defines domain expertise and tone for your task.
            </p>
          </div>

          <div className="spe-preview-card goal">
            <div className="spe-preview-card-head">
              <span className="spe-preview-pill goal">02 · GOAL</span>
              <span className="spe-preview-hint">What it must accomplish</span>
            </div>
            <p className="spe-preview-card-text placeholder">
              The primary objective that guides the AI's answer.
            </p>
          </div>

          <div className="spe-preview-card constraint">
            <div className="spe-preview-card-head">
              <span className="spe-preview-pill constraint">03 · CONSTRAINTS</span>
              <span className="spe-preview-hint">What to avoid</span>
            </div>
            <p className="spe-preview-card-text placeholder">
              Must-follow negative guardrails to stop hallucinations.
            </p>
          </div>

          <div className="spe-preview-card output">
            <div className="spe-preview-card-head">
              <span className="spe-preview-pill output">04 · OUTPUT FORMAT</span>
              <span className="spe-preview-hint">How to deliver</span>
            </div>
            <p className="spe-preview-card-text placeholder">
              The exact deliverable format, schema, or style you need.
            </p>
          </div>
        </div>

        <div className="spe-preview-footer empty">
          <span>Type an idea or click an example on the left to start.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="spe-preview-container active" role="region" aria-label="Live prompt structure">
      <div className="spe-preview-header">
        <div className="spe-preview-header-top">
          <span className="spe-preview-badge live">
            <span className="spe-live-indicator-dot" />
            LIVE STRUCTURE PREVIEW
          </span>
          <span className="spe-preview-private-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Processed privately on device
          </span>
        </div>
        <h3 className="spe-preview-title">
          Here is how your idea is being structured:
        </h3>
      </div>

      <div className="spe-preview-cards">
        {/* Slot 1: ROLE */}
        <div className="spe-preview-card role">
          <div className="spe-preview-card-head">
            <span className="spe-preview-pill role">01 · ROLE</span>
            <span className="spe-preview-hint">Who the AI becomes</span>
          </div>
          <p className="spe-preview-card-text">
            {parsed.role}
          </p>
        </div>

        {/* Slot 2: GOAL */}
        <div className="spe-preview-card goal">
          <div className="spe-preview-card-head">
            <span className="spe-preview-pill goal">02 · GOAL</span>
            <span className="spe-preview-hint">What it must accomplish</span>
          </div>
          <p className="spe-preview-card-text">
            {parsed.goal || "Extracting primary objective from your brief…"}
          </p>
        </div>

        {/* Slot 3: CONSTRAINT */}
        <div className="spe-preview-card constraint">
          <div className="spe-preview-card-head">
            <span className="spe-preview-pill constraint">03 · CONSTRAINTS</span>
            <span className="spe-preview-hint">What to avoid</span>
          </div>
          <p className="spe-preview-card-text">
            {parsed.constraint || "No unstated assumptions. Stay grounded in provided facts."}
          </p>
        </div>

        {/* Slot 4: OUTPUT */}
        <div className="spe-preview-card output">
          <div className="spe-preview-card-head">
            <span className="spe-preview-pill output">04 · OUTPUT FORMAT</span>
            <span className="spe-preview-hint">How to deliver</span>
          </div>
          <p className="spe-preview-card-text">
            {parsed.output || "Clear, structured response with verified, concrete steps."}
          </p>
        </div>
      </div>

      <div className="spe-preview-footer active">
        <button
          type="button"
          className="spe-build spe-preview-build-btn"
          disabled={busy}
          onClick={onBuild}
          aria-busy={busy}
        >
          {busy ? "Compiling verified prompt…" : "Generate Full System Prompt"}
          <span aria-hidden="true"> ↗</span>
        </button>
        <span className="spe-preview-shortcut-hint">
          or press <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      </div>
    </div>
  );
}
