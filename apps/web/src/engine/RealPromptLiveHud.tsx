import { useMemo, useState, useEffect } from "react";
import { parseCustomSentence, type ParsedSentenceResult } from "./plainEnglishParser";
import "./real-prompt-live-hud.css";

export interface RealPromptLiveHudProps {
  value: string;
  busy: boolean;
  onBuild: () => void;
  category?: string;
}

export function RealPromptLiveHud({ value, busy, onBuild }: RealPromptLiveHudProps) {
  const [copiedSlot, setCopiedSlot] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const parsed: ParsedSentenceResult = useMemo(
    () => parseCustomSentence(value),
    [value]
  );

  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 240);
    return () => clearTimeout(timer);
  }, [value]);

  const hasContent = value.trim().length > 0;

  const copySlotText = (label: string, text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedSlot(label);
    setTimeout(() => setCopiedSlot(null), 1600);
  };

  if (!hasContent) {
    return (
      <div className="spe-friendly-canvas spe-friendly-canvas--idle" role="region" aria-label="Prompt builder guide">
        <div className="spe-friendly-topbar">
          <div className="spe-friendly-badge">
            <span className="spe-friendly-dot" />
            <span>HOW IT WORKS</span>
          </div>
          <span className="spe-friendly-privacy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            100% on your device · Private
          </span>
        </div>

        <div className="spe-friendly-header">
          <h3 className="spe-friendly-title">
            The 4 parts of a great prompt.
          </h3>
          <p className="spe-friendly-subtitle">
            Type your idea on the left. SPE automatically arranges your thoughts into four clear instructions:
          </p>
        </div>

        <div className="spe-friendly-list">
          {/* Slot 1: ROLE */}
          <div className="spe-friendly-card card--role is-idle">
            <div className="spe-friendly-card-top">
              <div className="spe-friendly-slot-tag role">
                <span className="spe-friendly-icon role">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="spe-friendly-label">01 · Role</span>
              </div>
              <span className="spe-friendly-hint">Who the AI is</span>
            </div>
            <p className="spe-friendly-body placeholder">
              Sets the right role, voice, and expertise for your task.
            </p>
          </div>

          {/* Slot 2: GOAL */}
          <div className="spe-friendly-card card--goal is-idle">
            <div className="spe-friendly-card-top">
              <div className="spe-friendly-slot-tag goal">
                <span className="spe-friendly-icon goal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </span>
                <span className="spe-friendly-label">02 · Goal</span>
              </div>
              <span className="spe-friendly-hint">What you want done</span>
            </div>
            <p className="spe-friendly-body placeholder">
              Locks in your main objective so the AI stays completely focused.
            </p>
          </div>

          {/* Slot 3: RULES */}
          <div className="spe-friendly-card card--rules is-idle">
            <div className="spe-friendly-card-top">
              <div className="spe-friendly-slot-tag rules">
                <span className="spe-friendly-icon rules">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <span className="spe-friendly-label">03 · Rules</span>
              </div>
              <span className="spe-friendly-hint">What to follow</span>
            </div>
            <p className="spe-friendly-body placeholder">
              Sets boundaries so the AI avoids guessing or making things up.
            </p>
          </div>

          {/* Slot 4: OUTPUT */}
          <div className="spe-friendly-card card--output is-idle">
            <div className="spe-friendly-card-top">
              <div className="spe-friendly-slot-tag output">
                <span className="spe-friendly-icon output">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </span>
                <span className="spe-friendly-label">04 · Output</span>
              </div>
              <span className="spe-friendly-hint">How to answer</span>
            </div>
            <p className="spe-friendly-body placeholder">
              Defines the exact structure, format, or steps you need back.
            </p>
          </div>
        </div>

        <div className="spe-friendly-footer idle">
          <span>Type your idea or click an example on the left to begin</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`spe-friendly-canvas spe-friendly-canvas--live ${isUpdating ? "is-updating" : ""}`} role="region" aria-label="Live prompt structure">
      {/* Top clean status bar */}
      <div className="spe-friendly-topbar">
        <div className="spe-friendly-badge live">
          <span className="spe-friendly-live-dot" />
          <span>LIVE PREVIEW</span>
        </div>

        <span className="spe-friendly-privacy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          100% on your device · Private
        </span>
      </div>

      {/* Warm, friendly headline */}
      <div className="spe-friendly-header">
        <h3 className="spe-friendly-title">
          Say it plainly. See it take shape.
        </h3>
        <p className="spe-friendly-subtitle">
          Structured in real time into four simple parts any AI follows without drift.
        </p>
      </div>

      {/* 4 Clean, Beautiful, Vertical Cards */}
      <div className="spe-friendly-list">
        {/* Slot 1: ROLE */}
        <div className="spe-friendly-card card--role is-active">
          <div className="spe-friendly-card-top">
            <div className="spe-friendly-slot-tag role">
              <span className="spe-friendly-icon role">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="spe-friendly-label">01 · Role</span>
              <span className="spe-friendly-sublabel">Who the AI is</span>
            </div>
            <button
              type="button"
              className="spe-friendly-copy-btn"
              title="Copy Role"
              onClick={() => copySlotText("Role", parsed.role)}
            >
              {copiedSlot === "Role" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="spe-friendly-body">{parsed.role}</p>
        </div>

        {/* Slot 2: GOAL */}
        <div className="spe-friendly-card card--goal is-active">
          <div className="spe-friendly-card-top">
            <div className="spe-friendly-slot-tag goal">
              <span className="spe-friendly-icon goal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </span>
              <span className="spe-friendly-label">02 · Goal</span>
              <span className="spe-friendly-sublabel">What you want done</span>
            </div>
            <button
              type="button"
              className="spe-friendly-copy-btn"
              title="Copy Goal"
              onClick={() => copySlotText("Goal", parsed.goal)}
            >
              {copiedSlot === "Goal" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="spe-friendly-body">
            {parsed.goal || "The main objective your AI will accomplish."}
          </p>
        </div>

        {/* Slot 3: RULES */}
        <div className="spe-friendly-card card--rules is-active">
          <div className="spe-friendly-card-top">
            <div className="spe-friendly-slot-tag rules">
              <span className="spe-friendly-icon rules">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              <span className="spe-friendly-label">03 · Rules</span>
              <span className="spe-friendly-sublabel">What to follow</span>
            </div>
            <button
              type="button"
              className="spe-friendly-copy-btn"
              title="Copy Rules"
              onClick={() => copySlotText("Rules", parsed.constraint)}
            >
              {copiedSlot === "Rules" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="spe-friendly-body">
            {parsed.constraint || "Follow provided instructions only. Never invent facts or details."}
          </p>
        </div>

        {/* Slot 4: OUTPUT */}
        <div className="spe-friendly-card card--output is-active">
          <div className="spe-friendly-card-top">
            <div className="spe-friendly-slot-tag output">
              <span className="spe-friendly-icon output">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </span>
              <span className="spe-friendly-label">04 · Output</span>
              <span className="spe-friendly-sublabel">How to answer</span>
            </div>
            <button
              type="button"
              className="spe-friendly-copy-btn"
              title="Copy Output"
              onClick={() => copySlotText("Output", parsed.output)}
            >
              {copiedSlot === "Output" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="spe-friendly-body">
            {parsed.output || "Clear, step-by-step response with concrete, verified details."}
          </p>
        </div>
      </div>

      {/* Clean, Inviting CTA Footer */}
      <div className="spe-friendly-footer">
        <button
          type="button"
          className="spe-friendly-cta"
          disabled={busy}
          onClick={onBuild}
          aria-busy={busy}
        >
          <span>{busy ? "Building prompt…" : "Build Full Prompt"}</span>
          <span className="spe-friendly-cta-arrow">↗</span>
        </button>

        <span className="spe-friendly-shortcut">
          or press <kbd>⌘</kbd> + <kbd>Enter</kbd>
        </span>
      </div>
    </div>
  );
}
