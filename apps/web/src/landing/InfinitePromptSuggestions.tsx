import { useState, useRef, useCallback, useEffect } from "react";
import type { CategoryId } from "@spe/web-runtime";
import {
  CANONICAL_STARTER_PROMPTS,
  INFINITE_PROMPT_POOL,
  PROMPT_EVOLUTION_MODIFIERS,
  type InfinitePromptItem,
  type PromptEvolutionModifier,
} from "./infinitePromptCatalog";
import "./infinite-prompt-suggestions.css";

export interface InfinitePromptSuggestionsProps {
  currentBrief: string;
  onSelectPrompt: (text: string, category: CategoryId) => void;
  onAppendModifier: (clause: string) => void;
}

export function InfinitePromptSuggestions({
  currentBrief,
  onSelectPrompt,
  onAppendModifier,
}: InfinitePromptSuggestionsProps) {
  // Slots holding the 4 active suggestions
  const [slots, setSlots] = useState<InfinitePromptItem[]>(() => [
    ...CANONICAL_STARTER_PROMPTS,
  ]);

  // Set of IDs already presented to prevent immediate repetitions
  const usedIdsRef = useRef<Set<string>>(
    new Set(CANONICAL_STARTER_PROMPTS.map((p) => p.id))
  );

  // Animation states
  const [flippingSlotIndex, setFlippingSlotIndex] = useState<number | null>(null);
  const [isRollingAll, setIsRollingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [appliedModifierIds, setAppliedModifierIds] = useState<Set<string>>(new Set());

  // Reset applied modifiers if brief is cleared
  useEffect(() => {
    if (!currentBrief.trim()) {
      setAppliedModifierIds(new Set());
    }
  }, [currentBrief]);

  // Helper to get an unrepeated prompt item from pool
  const pickNextPrompt = useCallback((currentlyVisibleIds: Set<string>): InfinitePromptItem => {
    let available = INFINITE_PROMPT_POOL.filter(
      (p) => !usedIdsRef.current.has(p.id) && !currentlyVisibleIds.has(p.id)
    );

    // If reservoir is completely cycled, reset history while preserving visible items
    if (available.length === 0) {
      usedIdsRef.current = new Set(currentlyVisibleIds);
      available = INFINITE_PROMPT_POOL.filter(
        (p) => !currentlyVisibleIds.has(p.id)
      );
    }

    // Pick first candidate from the pool
    const selected = available[0] ?? INFINITE_PROMPT_POOL[0];
    usedIdsRef.current.add(selected.id);
    return selected;
  }, []);

  // Handle single slot click: populate brief & swap slot with 3D flip
  const handleSlotClick = useCallback(
    (item: InfinitePromptItem, slotIndex: number) => {
      // 1. Immediately apply prompt to input brief
      onSelectPrompt(item.text, item.category);

      // 2. Trigger 3D flip animation specifically on this slot
      setFlippingSlotIndex(slotIndex);

      // 3. Swap the card halfway through the flip when card is rotated 90 degrees
      const visibleIds = new Set(slots.map((s) => s.id));
      const nextPrompt = pickNextPrompt(visibleIds);

      const swapTimer = setTimeout(() => {
        setSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = nextPrompt;
          return next;
        });
      }, 190);

      const endFlipTimer = setTimeout(() => {
        setFlippingSlotIndex(null);
        setToastMessage(`⚡ Next ready: ${nextPrompt.label.slice(0, 24)}…`);
      }, 390);

      const toastTimer = setTimeout(() => {
        setToastMessage(null);
      }, 2000);

      return () => {
        clearTimeout(swapTimer);
        clearTimeout(endFlipTimer);
        clearTimeout(toastTimer);
      };
    },
    [onSelectPrompt, pickNextPrompt, slots]
  );

  // Handle Roll Infinity Reel: refresh all 4 slots with staggered 3D flips
  const handleRollInfinity = useCallback(() => {
    if (isRollingAll) return;
    setIsRollingAll(true);

    const visibleIds = new Set(slots.map((s) => s.id));
    const newItems: InfinitePromptItem[] = [];

    for (let i = 0; i < 4; i++) {
      const nextPrompt = pickNextPrompt(new Set([...visibleIds, ...newItems.map((n) => n.id)]));
      newItems.push(nextPrompt);
    }

    const swapTimer = setTimeout(() => {
      setSlots(newItems);
    }, 210);

    const finishTimer = setTimeout(() => {
      setIsRollingAll(false);
      setToastMessage("🎲 4 fresh prompt blueprints loaded");
    }, 650);

    const toastTimer = setTimeout(() => {
      setToastMessage(null);
    }, 2200);

    return () => {
      clearTimeout(swapTimer);
      clearTimeout(finishTimer);
      clearTimeout(toastTimer);
    };
  }, [isRollingAll, pickNextPrompt, slots]);

  // Handle modifier click: cleanly append clause to current brief
  const handleModifierClick = useCallback(
    (mod: PromptEvolutionModifier) => {
      onAppendModifier(mod.clause);
      setAppliedModifierIds((prev) => new Set([...prev, mod.id]));
      setToastMessage(`Added constraint: ${mod.label}`);

      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 1800);
      return () => clearTimeout(timer);
    },
    [onAppendModifier]
  );

  const hasBriefText = currentBrief.trim().length > 0;

  return (
    <div className="spe-infinite-fountain" aria-label="Infinite prompt blueprints and evolution">
      {/* Header Bar */}
      <div className="spe-fountain-header">
        <div className="spe-fountain-meta">
          <span className="spe-fountain-badge" title="Dynamic prompt fountain with infinite cycling">
            <span className="spe-fountain-icon" aria-hidden="true">✦</span>
            Infinite Prompts
          </span>
          <span className="spe-fountain-counter" aria-live="polite">
            Click any pill to swap with next blueprint
          </span>
          {toastMessage && (
            <span className="spe-fountain-toast" role="status" aria-live="polite">
              {toastMessage}
            </span>
          )}
        </div>

        <button
          type="button"
          className="spe-fountain-roll-btn"
          onClick={handleRollInfinity}
          disabled={isRollingAll}
          aria-label="Roll four fresh prompt suggestions"
          title="Roll 4 fresh prompts from the infinite pool"
        >
          <span className="spe-roll-icon" aria-hidden="true">🎲</span>
          <span>Roll Infinity</span>
        </button>
      </div>

      {/* 4 Interactive Suggestion Slots */}
      <div className="spe-fountain-slots" role="group" aria-label="Suggested starter prompts">
        {slots.map((slot, index) => {
          const isFlipping = flippingSlotIndex === index;
          const isRolling = isRollingAll;

          return (
            <button
              type="button"
              key={`${slot.id}-${index}`}
              className={`spe-fountain-slot${isFlipping ? " is-flipping" : ""}${
                isRolling ? " is-rolling" : ""
              }`}
              style={
                isRolling ? ({ "--slot-idx": index } as React.CSSProperties) : undefined
              }
              onClick={() => handleSlotClick(slot, index)}
              aria-label={`Use template: ${slot.label} (Category: ${slot.category})`}
              data-slot-index={index}
              data-prompt-id={slot.id}
            >
              <div className="spe-slot-body">
                <div className="spe-slot-top-row">
                  <span className="spe-slot-category">{slot.category}</span>
                  {slot.badge && <span className="spe-slot-badge">{slot.badge}</span>}
                </div>
                <div className="spe-slot-label">{slot.label}</div>
              </div>
              <span className="spe-slot-arrow" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>

      {/* Contextual Evolution Modifiers shelf: available when brief has content or user wants to level up */}
      {(hasBriefText || appliedModifierIds.size > 0) && (
        <div className="spe-fountain-evolution" aria-label="Contextual prompt modifiers">
          <div className="spe-evolution-header">
            <span className="spe-evolution-title">
              <span aria-hidden="true">⚡</span> Evolve Brief with Constraints
            </span>
            <span className="spe-evolution-hint">
              Stackable architectural and quality guardrails
            </span>
          </div>

          <div className="spe-evolution-chips" role="group" aria-label="Prompt evolution modifiers">
            {PROMPT_EVOLUTION_MODIFIERS.map((mod) => {
              const isApplied = appliedModifierIds.has(mod.id);
              return (
                <button
                  type="button"
                  key={mod.id}
                  className={`spe-evolution-chip${isApplied ? " is-applied" : ""}`}
                  onClick={() => handleModifierClick(mod)}
                  aria-pressed={isApplied}
                  title={`Append ${mod.label} constraint to brief`}
                >
                  <span>{mod.label}</span>
                  {isApplied && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
