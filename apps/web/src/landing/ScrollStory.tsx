import { CATEGORIES, TARGETS } from "@spe/web-runtime";

type Props = {
  onOpenWorkspace: () => void;
  demoRequest: string;
  demoPrompt: string | null;
};

export function ScrollStory({ onOpenWorkspace, demoRequest, demoPrompt }: Props) {
  return (
    <div className="spe-story">
      <section className="spe-section" id="problem" aria-labelledby="problem-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">The problem</p>
          <h2 id="problem-title">AI receives a sentence. SPE sees a system.</h2>
          <div className="spe-split">
            <article className="spe-glass-card">
              <h3>You</h3>
              <p className="spe-quote">“make a website for my restaurant”</p>
              <p className="spe-muted">Underspecified. Easy to misread.</p>
            </article>
            <article className="spe-glass-card emphasis">
              <h3>SPE sees</h3>
              <ul className="spe-chip-row" aria-label="Semantic decomposition">
                {["goal", "audience", "requirements", "unknowns", "constraints", "success"].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="spe-section" id="intent" aria-labelledby="intent-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">Intent engine</p>
          <h2 id="intent-title">Meaning, protected in space.</h2>
          <div className="spe-nodes" role="list">
            {[
              ["GOAL", "confirmed"],
              ["MUST", "confirmed"],
              ["MUST NOT", "conflict"],
              ["UNKNOWN", "unknown"],
              ["CONFLICT", "conflict"],
              ["PREFERENCE", "assumed"],
            ].map(([label, kind]) => (
              <div key={label} className="spe-node" data-kind={kind} role="listitem">
                <span className="spe-node-icon" aria-hidden="true" />
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          <p className="spe-muted center">SPE protects meaning — it does not invent obligations.</p>
        </div>
      </section>

      <section className="spe-section" id="strategy" aria-labelledby="strategy-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">Strategy engine</p>
          <h2 id="strategy-title">Not longer. Sufficient.</h2>
          <div className="spe-chip-row large">
            {["Context", "Structure", "Examples", "Verification", "Output Contract"].map((t) => (
              <span key={t} className="spe-pill">{t}</span>
            ))}
          </div>
          <p className="spe-lead">SPE does not make prompts longer. SPE makes them sufficient.</p>
        </div>
      </section>

      <section className="spe-section reveal" id="reveal" aria-labelledby="reveal-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">The reveal</p>
          <h2 id="reveal-title">One line becomes an instruction.</h2>
          <div className="spe-compare">
            <div>
              <p className="spe-label">You said</p>
              <p className="spe-quote">{demoRequest || "write leave email"}</p>
            </div>
            <div className="spe-compare-arrow" aria-hidden="true">→</div>
            <div>
              <p className="spe-label">SPE built</p>
              <ul>
                <li>role</li>
                <li>goal</li>
                <li>context</li>
                <li>constraints</li>
                <li>missing information</li>
                <li>output contract</li>
              </ul>
            </div>
          </div>
          {demoPrompt && (
            <pre className="spe-prompt-preview">{demoPrompt.slice(0, 520)}{demoPrompt.length > 520 ? "…" : ""}</pre>
          )}
          <div className="spe-actions">
            <button type="button" className="spe-build" onClick={onOpenWorkspace}>
              Open in workspace
            </button>
          </div>
        </div>
      </section>

      <section className="spe-section" id="any-ai" aria-labelledby="any-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">Any AI</p>
          <h2 id="any-title">Intent stays. Rendering changes.</h2>
          <div className="spe-constellation" role="list">
            <div className="spe-constellation-core" role="listitem">Any AI</div>
            {TARGETS.filter((t) => t.id !== "any").map((t) => (
              <div key={t.id} className="spe-constellation-node" role="listitem">
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="spe-section" id="artifact-story" aria-labelledby="spefile-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">.spe</p>
          <h2 id="spefile-title">Your prompt becomes a portable semantic project.</h2>
          <div className="spe-artifact-visual" aria-hidden="true">
            {["intent", "requirements", "strategy", "prompt", "lineage"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="spe-section" id="moonshot" aria-labelledby="moon-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">Moonshot</p>
          <h2 id="moon-title">Beyond text.</h2>
          <div className="spe-moon-grid">
            {[
              ["Text → Prompt", "LIVE"],
              ["Image → Prompt", "COMING"],
              ["Screenshot → Code", "PLANNED"],
              ["Website → X-Ray", "PLANNED"],
              ["Audio → Prompt", "PLANNED"],
              ["Video → Prompt", "PLANNED"],
              ["3D Website Lab", "PLANNED"],
            ].map(([title, status]) => (
              <article key={title} className="spe-moon-card" data-status={status}>
                <h3>{title}</h3>
                <span>{status}</span>
              </article>
            ))}
          </div>
          <p className="spe-muted">Categories ready for routing: {CATEGORIES.slice(0, 6).join(" · ")}…</p>
        </div>
      </section>

      <section className="spe-section" id="daily" aria-labelledby="daily-title">
        <div className="spe-section-inner">
          <p className="spe-kicker">Daily Lab</p>
          <h2 id="daily-title">Something new to build every day.</h2>
          <div className="spe-daily-stage">
            <p>Daily drops arrive here — cinematic specimens, not ads.</p>
            <span className="spe-pill">PLANNED</span>
          </div>
        </div>
      </section>

      <section className="spe-section" id="privacy" aria-labelledby="privacy-title">
        <div className="spe-section-inner narrow">
          <p className="spe-kicker">Privacy</p>
          <h2 id="privacy-title">Everything collapses back to your device.</h2>
          <ul className="spe-privacy-list">
            <li><strong>Core compile</strong> LOCAL</li>
            <li><strong>Mandatory account</strong> NO</li>
            <li><strong>Mandatory provider</strong> NO</li>
            <li><strong>Prompt analytics</strong> NO</li>
          </ul>
        </div>
      </section>

      <section className="spe-section final-cta" id="final-cta" aria-labelledby="final-title">
        <div className="spe-section-inner">
          <h2 id="final-title">What do you want to build?</h2>
          <button type="button" className="spe-build" onClick={() => {
            document.getElementById("spe-one-line")?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}>
            Return to command
          </button>
        </div>
      </section>
    </div>
  );
}
