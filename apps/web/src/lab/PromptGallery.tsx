import { PROMPT_GALLERY, type GalleryCard } from "./gallery/promptGallery";

type Props = {
  onOpenInSpe: (card: GalleryCard) => void;
};

export function PromptGallery({ onOpenInSpe }: Props) {
  return (
    <details className="spe-prompt-gallery">
      <summary>Prompt Gallery ({PROMPT_GALLERY.length} ordinary prompt cards)</summary>
      <p className="spe-muted">
        These are starting ideas for Create — separate from the Daily 3D Lab stage
        experiences above.
      </p>
      <ul>
        {PROMPT_GALLERY.map((s) => (
          <li key={s.id}>
            <strong>{s.title}</strong> — {s.blurb}{" "}
            <button
              type="button"
              className="spe-linkish"
              onClick={() => onOpenInSpe(s)}
            >
              Open in SPE
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
