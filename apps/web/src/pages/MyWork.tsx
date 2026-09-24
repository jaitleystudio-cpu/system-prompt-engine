import type { HistoryItem } from "@spe/web-runtime";

type Props = {
  historyOptIn: boolean;
  setHistoryOptIn: (v: boolean) => void;
  history: HistoryItem[];
  onClear: () => void;
  onOpen: (item: HistoryItem) => void;
};

export function MyWork({
  historyOptIn,
  setHistoryOptIn,
  history,
  onClear,
  onOpen,
}: Props) {
  return (
    <section className="spe-mywork" aria-labelledby="mywork-title">
      <p className="spe-kicker">My Work</p>
      <h1 id="mywork-title">Ideas on this device</h1>
      <p>
        History is optional and stored only in this browser. Turn it off anytime.
        Export a <code>.spe</code> file when you want a portable copy.
      </p>
      <label className="spe-field">
        <span>
          <input
            type="checkbox"
            checked={historyOptIn}
            onChange={(e) => setHistoryOptIn(e.target.checked)}
          />{" "}
          Save a history of ideas on this device
        </span>
      </label>
      <div className="spe-actions">
        <button type="button" className="spe-ghost" disabled={!historyOptIn || !history.length} onClick={onClear}>
          Clear history
        </button>
      </div>
      <div className="spe-moon-grid">
        {history.length === 0 ? (
          <p role="status">No saved ideas yet.</p>
        ) : (
          history.map((h) => (
            <button
              key={h.id}
              type="button"
              className="spe-moon-card"
              onClick={() => onOpen(h)}
            >
              <h2>{h.user_request}</h2>
              <span>{h.category}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
