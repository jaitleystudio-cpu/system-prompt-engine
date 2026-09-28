import type { HistoryItem } from "@spe/web-runtime";

type Props = {
  historyOptIn: boolean;
  setHistoryOptIn: (v: boolean) => void;
  history: HistoryItem[];
  onClear: () => void;
  onOpen: (item: HistoryItem) => void;
  onStartCreate?: () => void;
};

export function MyWork({
  historyOptIn,
  setHistoryOptIn,
  history,
  onClear,
  onOpen,
  onStartCreate,
}: Props) {
  return (
    <section className="spe-mywork" aria-labelledby="mywork-title">
      <p className="spe-kicker">My Work</p>
      <h1 id="mywork-title">Ideas on this device</h1>
      <p>
        My saved work stays on this device unless I choose to export a file.
        Saving is off until you turn it on. You can turn it off or clear it
        anytime.
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
          <div className="spe-empty-work" role="status">
            <p className="spe-empty-kicker">Quiet shelf</p>
            <h2>Nothing saved here yet</h2>
            <p>
              Nothing is stored until you turn saving on. When you do, those
              notes stay in this browser. Export a .spe file only if you want a
              copy you can move.
            </p>
            <ol className="spe-empty-steps">
              <li>Start with an idea in Create</li>
              <li>Save when you want a return path</li>
              <li>Export a .spe file if you want a portable copy</li>
            </ol>
            <p className="spe-empty-leave">
              Prefer not to keep history? Leave saving off — SPE still works. Your thinking stays yours.
            </p>
            {onStartCreate && (
              <button type="button" className="spe-build" data-ready="true" onClick={onStartCreate}>
                Start with an idea <span>↗</span>
              </button>
            )}
          </div>
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
