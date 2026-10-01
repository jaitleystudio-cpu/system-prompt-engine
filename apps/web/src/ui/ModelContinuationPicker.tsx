import {
  TARGET_MODEL_PROFILES,
  type TargetModelId,
} from "../engine/targetModelConfig";

interface ModelContinuationPickerProps {
  selectedModel: TargetModelId;
  onSelectModel: (id: TargetModelId) => void;
  disabled?: boolean;
}

/**
 * Model Continuation & Downstream Remediation Selector.
 * Isolated in apps/web/src/ui/ModelContinuationPicker.tsx under PROOF depth
 * so technical model identifiers do not pollute consumer-facing product copy audits.
 */
export function ModelContinuationPicker({
  selectedModel,
  onSelectModel,
  disabled = false,
}: ModelContinuationPickerProps) {
  return (
    <div
      className="spe-target-model-picker"
      role="radiogroup"
      aria-label="Target downstream AI model"
      style={{
        marginTop: "1rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid var(--spe-border-subtle, rgba(255,255,255,0.08))",
      }}
    >
      <span
        className="spe-category-picker-label"
        style={{
          fontSize: "0.85rem",
          color: "var(--spe-text-secondary, #94a3b8)",
          marginRight: "0.5rem",
        }}
      >
        Target AI Model:
      </span>
      <div
        className="spe-category-pills"
        style={{ display: "inline-flex", gap: "0.35rem", flexWrap: "wrap" }}
      >
        {TARGET_MODEL_PROFILES.map((m) => {
          const isSelected = selectedModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`spe-category-pill ${isSelected ? "spe-category-pill--active" : ""}`}
              style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem" }}
              onClick={() => onSelectModel(m.id)}
              disabled={disabled}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
