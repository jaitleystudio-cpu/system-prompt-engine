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
          <div className="spe-empty-work" role="status">
            <p className="spe-empty-kicker">Quiet shelf</p>
            <h2>Nothing saved here yet</h2>
            <p>
              <strong>What:</strong> optional notes of ideas you choose to keep.
              <br />
              <strong>Why:</strong> so you can reopen them later — still only on this device.
              <br />
              <strong>How:</strong> turn on saving above, then build a prompt in Create.
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
