import React, { useEffect, useRef } from "react";

export type ExecutionMode = "standard" | "deep" | "fast" | "strict";

export interface ModeOption {
  id: ExecutionMode;
  name: string;
  badge: string;
  description: string;
}

export const EXECUTION_MODES: ModeOption[] = [
  {
    id: "standard",
    name: "Standard Synthesis",
    badge: "Balanced",
    description: "Default synthesis mode label for general workflows.",
  },
  {
    id: "deep",
    name: "Deep Synthesis",
    badge: "Thorough",
    description: "Requests additional synthesis depth from the host workflow.",
  },
  {
    id: "fast",
    name: "Fast Iteration",
    badge: "Swift",
    description: "Requests a faster iteration mode from the host workflow.",
  },
  {
    id: "strict",
    name: "Deterministic Strict",
    badge: "Verifiable",
    description: "Requests stricter output-shape handling from the host workflow.",
  },
];

interface ModalModeSelectorProps {
  isOpen: boolean;
  activeMode: ExecutionMode;
  onSelectMode: (mode: ExecutionMode) => void;
  onClose: () => void;
}

export const ModalModeSelector: React.FC<ModalModeSelectorProps> = ({
  isOpen,
  activeMode,
  onSelectMode,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="spe-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="spe-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spe-modal-mode-title"
      >
        <header className="spe-modal-header">
          <h2 id="spe-modal-mode-title" className="spe-modal-title">
            Select Synthesis Mode
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="spe-modal-close-btn"
            onClick={onClose}
            aria-label="Close mode selector dialog"
          >
            ✕
          </button>
        </header>

        <div className="spe-modal-body" role="radiogroup" aria-label="Synthesis Modes">
          {EXECUTION_MODES.map((mode) => {
            const isSelected = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                className={`spe-mode-card ${isSelected ? "selected" : ""}`}
                role="radio"
                aria-checked={isSelected}
                aria-selected={isSelected}
                onClick={() => {
                  onSelectMode(mode.id);
                  onClose();
                }}
              >
                <div className="spe-mode-card-content">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h4>{mode.name}</h4>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: isSelected ? "var(--spe-shell-accent)" : "rgba(255,255,255,0.1)",
                        color: "#ffffff",
                        fontWeight: 600,
                      }}
                    >
                      {mode.badge}
                    </span>
                  </div>
                  <p>{mode.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="spe-modal-footer">
          <button
            type="button"
            className="spe-shell-action-btn"
            onClick={onClose}
            style={{ border: "1px solid var(--spe-shell-border)" }}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};
