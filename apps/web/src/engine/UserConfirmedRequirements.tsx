import React, { useState, useId, useCallback } from "react";
import type { IntentAtom } from "@spe/web-runtime";
import "./user-confirmed-requirements.css";

export interface ConfirmedRequirement {
  id: string;
  type: "must_follow" | "must_not";
  text: string;
}

export interface UserConfirmedRequirementsProps {
  confirmedAtoms: IntentAtom[];
  onChangeConfirmed: (atoms: IntentAtom[]) => void;
  disabled?: boolean;
}

export type IntentLensState = {
  confirmed: IntentAtom[];
  assumed: IntentAtom[];
  unknowns: IntentAtom[];
  conflicts: IntentAtom[];
};

export const CREATE_INTENT_FIELD_IDS = new Set(["desired-output", "desired-example"]);

export function hasUserConfirmedRequirements(intent: IntentLensState): boolean {
  return intent.confirmed.some(
    (atom) =>
      atom.text.trim().length > 0 &&
      (atom.id.startsWith("req-") ||
        atom.label === "MUST FOLLOW" ||
        atom.label === "MUST NOT" ||
        atom.id === "confirmed-boundaries"),
  );
}

export function preserveCreateIntentFields(
  current: IntentLensState,
  next: IntentLensState,
): IntentLensState {
  const customConfirmed = current.confirmed.filter(
    (atom) =>
      atom.text.trim().length > 0 &&
      (atom.id.startsWith("req-") ||
        atom.label === "MUST FOLLOW" ||
        atom.label === "MUST NOT" ||
        atom.id === "confirmed-boundaries"),
  );

  const preserved = new Map(
    [...current.confirmed, ...current.assumed]
      .filter((atom) => CREATE_INTENT_FIELD_IDS.has(atom.id))
      .map((atom) => [atom.id, atom.text]),
  );
  const merge = (atoms: IntentAtom[]) =>
    atoms.map((atom) =>
      preserved.has(atom.id)
        ? { ...atom, text: preserved.get(atom.id) ?? "" }
        : atom,
    );

  const baseConfirmed = merge(next.confirmed);
  const mergedConfirmed = [...customConfirmed];
  for (const item of baseConfirmed) {
    if (!mergedConfirmed.some((c) => c.id === item.id)) {
      mergedConfirmed.push(item);
    }
  }

  return {
    ...next,
    confirmed: mergedConfirmed,
    assumed: merge(next.assumed),
  };
}

export function hasCreateIntentFields(intent: IntentLensState): boolean {
  return (
    hasUserConfirmedRequirements(intent) ||
    [...intent.confirmed, ...intent.assumed].some(
      (atom) =>
        CREATE_INTENT_FIELD_IDS.has(atom.id) && Boolean(atom.text.trim()),
    )
  );
}

/**
 * Normalizes negative phrasing to ensure unambiguous negative polarity in prompt generation.
 */
export function normalizeNegativeStatement(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("must not") ||
    lower.startsWith("must never") ||
    lower.startsWith("do not") ||
    lower.startsWith("don't") ||
    lower.startsWith("dont") ||
    lower.startsWith("never") ||
    lower.startsWith("no ") ||
    lower.startsWith("forbidden") ||
    lower.startsWith("disallowed") ||
    lower.startsWith("prohibit")
  ) {
    return trimmed;
  }
  return `Must not ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

/**
 * Normalizes positive phrasing.
 */
export function normalizePositiveStatement(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed;
}

/**
 * Converts IntentAtoms array into high-level ConfirmedRequirement objects.
 */
export function atomsToRequirements(atoms: IntentAtom[]): ConfirmedRequirement[] {
  const results: ConfirmedRequirement[] = [];
  for (const atom of atoms) {
    if (!atom.text.trim()) continue;
    const lower = atom.text.toLowerCase();
    const isNegative =
      atom.id.startsWith("req-neg-") ||
      atom.label === "MUST NOT" ||
      lower.startsWith("must not") ||
      lower.startsWith("must never") ||
      lower.startsWith("do not") ||
      lower.startsWith("never") ||
      lower.startsWith("forbidden:");

    results.push({
      id: atom.id,
      type: isNegative ? "must_not" : "must_follow",
      text: atom.text,
    });
  }
  return results;
}

/**
 * Converts ConfirmedRequirement objects back into canonical IntentAtoms.
 */
export function requirementsToAtoms(
  reqs: ConfirmedRequirement[],
  existingOtherConfirmed: IntentAtom[] = [],
): IntentAtom[] {
  // Retain non-requirement confirmed atoms (like desired-output if present)
  const others = existingOtherConfirmed.filter(
    (a) =>
      a.id !== "confirmed-boundaries" &&
      !a.id.startsWith("req-pos-") &&
      !a.id.startsWith("req-neg-") &&
      a.label !== "MUST FOLLOW" &&
      a.label !== "MUST NOT",
  );

  const mappedReqAtoms: IntentAtom[] = reqs
    .filter((r) => r.text.trim().length > 0)
    .map((r) => {
      const statement =
        r.type === "must_not"
          ? normalizeNegativeStatement(r.text)
          : normalizePositiveStatement(r.text);

      return {
        id: r.id,
        kind: "confirmed" as const,
        label: r.type === "must_not" ? "MUST NOT" : "MUST FOLLOW",
        text: statement,
      };
    });

  return [...others, ...mappedReqAtoms];
}

export const UserConfirmedRequirements: React.FC<UserConfirmedRequirementsProps> = ({
  confirmedAtoms,
  onChangeConfirmed,
  disabled = false,
}) => {
  const baseId = useId();
  const [newFollowText, setNewFollowText] = useState("");
  const [newNotText, setNewNotText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Derive current requirements
  const requirements = atomsToRequirements(confirmedAtoms);
  const mustFollowList = requirements.filter((r) => r.type === "must_follow");
  const mustNotList = requirements.filter((r) => r.type === "must_not");
  const totalCount = requirements.length;

  const handleAddMustFollow = useCallback(() => {
    const text = newFollowText.trim();
    if (!text || disabled) return;

    const newReq: ConfirmedRequirement = {
      id: `req-pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: "must_follow",
      text: normalizePositiveStatement(text),
    };

    const nextReqs = [...requirements, newReq];
    onChangeConfirmed(requirementsToAtoms(nextReqs, confirmedAtoms));
    setNewFollowText("");
  }, [newFollowText, disabled, requirements, confirmedAtoms, onChangeConfirmed]);

  const handleAddMustNot = useCallback(() => {
    const text = newNotText.trim();
    if (!text || disabled) return;

    const newReq: ConfirmedRequirement = {
      id: `req-neg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: "must_not",
      text: normalizeNegativeStatement(text),
    };

    const nextReqs = [...requirements, newReq];
    onChangeConfirmed(requirementsToAtoms(nextReqs, confirmedAtoms));
    setNewNotText("");
  }, [newNotText, disabled, requirements, confirmedAtoms, onChangeConfirmed]);

  const handleRemove = useCallback(
    (idToRemove: string) => {
      if (disabled) return;
      const nextReqs = requirements.filter((r) => r.id !== idToRemove);
      onChangeConfirmed(requirementsToAtoms(nextReqs, confirmedAtoms));
    },
    [disabled, requirements, confirmedAtoms, onChangeConfirmed],
  );

  const handleUpdate = useCallback(
    (idToUpdate: string, updatedText: string) => {
      if (disabled) return;
      const nextReqs = requirements.map((r) => {
        if (r.id !== idToUpdate) return r;
        return {
          ...r,
          text: updatedText,
        };
      });
      onChangeConfirmed(requirementsToAtoms(nextReqs, confirmedAtoms));
    },
    [disabled, requirements, confirmedAtoms, onChangeConfirmed],
  );

  return (
    <div className="spe-confirmed-requirements-wrapper">
      <details
        className="spe-confirmed-requirements-accordion"
        open={isOpen || totalCount > 0}
        onToggle={(e) => setIsOpen(e.currentTarget.open)}
      >
        <summary className="spe-requirements-summary">
          <div className="spe-req-summary-left">
            <span className="spe-req-indicator" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="spe-req-summary-title">Specific Requirements</span>
            <span className="spe-req-badge-optional">Optional</span>
            {totalCount > 0 && (
              <span className="spe-req-count-badge" aria-label={`${totalCount} active requirements`}>
                {totalCount} {totalCount === 1 ? "rule" : "rules"} active
              </span>
            )}
          </div>
          <span className="spe-req-toggle-hint">
            {totalCount === 0 ? "Add must-follow or must-not constraints" : "Edit constraints"}
            <svg
              className="spe-req-chevron"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </summary>

        <div className="spe-requirements-body">
          <p className="spe-req-caption">
            Specify explicit rules that the synthesized prompt must mathematically preserve. All constraints map directly into canonical hard contracts with zero cloud egress.
          </p>

          <div className="spe-req-columns">
            {/* COLUMN 1: MUST FOLLOW */}
            <div className="spe-req-col spe-req-col-follow">
              <div className="spe-col-header">
                <div className="spe-col-tag-follow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>MUST FOLLOW</span>
                </div>
                <span className="spe-col-desc">Preserve stated goals &amp; exact criteria</span>
              </div>

              <div className="spe-req-input-row">
                <label htmlFor={`${baseId}-follow-input`} className="sr-only">
                  Add a positive requirement the prompt must follow
                </label>
                <input
                  id={`${baseId}-follow-input`}
                  type="text"
                  className="spe-req-text-input"
                  placeholder="e.g. Include strict TypeScript types with Zod schema validation"
                  value={newFollowText}
                  onChange={(e) => setNewFollowText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddMustFollow();
                    }
                  }}
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="spe-req-btn-add spe-req-btn-follow"
                  onClick={handleAddMustFollow}
                  disabled={disabled || !newFollowText.trim()}
                  aria-label="Add must-follow requirement"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add</span>
                </button>
              </div>

              {mustFollowList.length > 0 ? (
                <ul className="spe-req-items-list" aria-label="Must follow requirements list">
                  {mustFollowList.map((item, idx) => (
                    <li key={item.id} className="spe-req-item spe-req-item-follow">
                      <span className="spe-item-bullet-follow">{idx + 1}</span>
                      <input
                        type="text"
                        className="spe-item-edit-input"
                        value={item.text}
                        onChange={(e) => handleUpdate(item.id, e.target.value)}
                        disabled={disabled}
                        aria-label={`Must follow requirement ${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="spe-req-btn-remove"
                        onClick={() => handleRemove(item.id)}
                        disabled={disabled}
                        aria-label={`Remove requirement: ${item.text}`}
                        title="Remove requirement"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="spe-req-empty-hint">No positive requirements added yet.</div>
              )}
            </div>

            {/* COLUMN 2: MUST NOT */}
            <div className="spe-req-col spe-req-col-not">
              <div className="spe-col-header">
                <div className="spe-col-tag-not">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  <span>MUST NOT</span>
                </div>
                <span className="spe-col-desc">Forbid unverified libraries, drift &amp; side effects</span>
              </div>

              <div className="spe-req-input-row">
                <label htmlFor={`${baseId}-not-input`} className="sr-only">
                  Add a negative requirement the prompt must forbid
                </label>
                <input
                  id={`${baseId}-not-input`}
                  type="text"
                  className="spe-req-text-input"
                  placeholder="e.g. Do not use external libraries or unverified npm dependencies"
                  value={newNotText}
                  onChange={(e) => setNewNotText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddMustNot();
                    }
                  }}
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="spe-req-btn-add spe-req-btn-not"
                  onClick={handleAddMustNot}
                  disabled={disabled || !newNotText.trim()}
                  aria-label="Add must-not prohibition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add</span>
                </button>
              </div>

              {mustNotList.length > 0 ? (
                <ul className="spe-req-items-list" aria-label="Must not prohibitions list">
                  {mustNotList.map((item, idx) => (
                    <li key={item.id} className="spe-req-item spe-req-item-not">
                      <span className="spe-item-bullet-not">{idx + 1}</span>
                      <input
                        type="text"
                        className="spe-item-edit-input"
                        value={item.text}
                        onChange={(e) => handleUpdate(item.id, e.target.value)}
                        disabled={disabled}
                        aria-label={`Must not prohibition ${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="spe-req-btn-remove"
                        onClick={() => handleRemove(item.id)}
                        disabled={disabled}
                        aria-label={`Remove prohibition: ${item.text}`}
                        title="Remove prohibition"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="spe-req-empty-hint">No negative prohibitions added yet.</div>
              )}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};
