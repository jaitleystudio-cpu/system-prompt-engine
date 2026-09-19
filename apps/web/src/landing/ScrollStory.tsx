import {
  TARGETS,
  type CategoryId,
  type IntentAtom,
  type SpeArtifactV1,
  type TargetId,
} from "@spe/web-runtime";
import type { CSSProperties } from "react";

type Props = {
  onOpenWorkspace: () => void;
  demoRequest: string;
  demoPrompt: string | null;
  category: CategoryId;
  target: TargetId;
  intent: {
    confirmed: IntentAtom[];
    assumed: IntentAtom[];
    unknowns: IntentAtom[];
    conflicts: IntentAtom[];
  };
  techniques: string[];
  artifact: SpeArtifactV1 | null;
  privacy: {
    sensitivity: string | null;
    trust: string | null;
    authority: string | null;
  };
  online: boolean;
};

const MISSION_STAGE = [
  ["Text → Prompt", "CURRENT"],
  ["Image → Prompt", "PLANNED"],
  ["Screenshot → Code", "PLANNED"],
  ["Website → X-Ray", "PLANNED"],
  ["Audio → Prompt", "PLANNED"],
  ["Video → Prompt", "PLANNED"],
] as const;

export function ScrollStory({
  onOpenWorkspace,
  demoRequest,
  demoPrompt,
  category,
  target,
  intent,
  techniques,
  artifact,
  privacy,
  online,
}: Props) {
  const targetLabel = TARGETS.find((item) => item.id === target)?.label ?? "Any AI";
  const semanticRows = [
    {
      id: "goal",
      label: "GOAL",
      value: intent.confirmed.find((item) => item.label === "Goal")?.text || "Not supplied",
      behavior: "LOCK",
      status: intent.confirmed.length ? "confirmed" : "unavailable",
    },
    {
      id: "context",
      label: "CONTEXT",
      value: "No explicit context field supplied",
      behavior: "GROUND",
      status: "unavailable",
    },
    {
      id: "constraint",
      label: "CONSTRAINT",
      value: intent.conflicts[0]?.text || "No explicit conflict supplied",
      behavior: "REPEL",
      status: intent.conflicts.length ? "conflict" : "unavailable",
    },
    {
      id: "unknown",
      label: "UNKNOWN",
      value: intent.unknowns[0]?.text || "No unresolved question supplied",
      behavior: "REMAIN OPEN",
      status: intent.unknowns.length ? "unknown" : "unavailable",
    },
    {
      id: "preference",
      label: "PREFERENCE",
      value: intent.assumed[0]?.text || "No preference supplied",
      behavior: "BEND",
      status: intent.assumed.length ? "assumed" : "unavailable",
    },
    {
      id: "output",
      label: "OUTPUT",
      value: `${category} route · ${targetLabel}`,
      behavior: "SHAPE",
      status: "route",
    },
  ] as const;

  return (
    <div className="forge-story">
      <section className="forge-act story-extract" id="act-extract" aria-labelledby="extract-title">
        <div className="forge-story-grid">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT II</span><span>EXTRACT</span></p>
            <h2 id="extract-title">One thought. Six roles. Nothing silently filled in.</h2>
            <p>
              The workpiece separates into named semantic filaments. Values come
              only from the current request, selected route, and editable Intent Lens.
            </p>
          </header>
          <div className="semantic-specimen" role="list" aria-label="Current semantic specimen">
            <p className="semantic-raw"><span>RAW THOUGHT</span>{demoRequest || "Not supplied"}</p>
            {semanticRows.map((row, index) => (
              <article
                key={row.id}
                className={`semantic-rail semantic-${row.id}`}
                data-status={row.status}
                role="listitem"
                style={{ "--rail-order": index } as CSSProperties}
              >
                <header><strong>{row.label}</strong><span>{row.behavior}</span></header>
                <p>{row.value}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="forge-act story-behavior" id="act-behavior" aria-labelledby="behavior-title">
        <div className="forge-story-grid reverse">
          <div className="behavior-field" aria-hidden="true">
            <div className="behavior-stop"><span>CONSTRAINT</span></div>
            <div className="behavior-lock"><span>GOAL</span></div>
            <div className="behavior-gap"><span>UNKNOWN</span></div>
            <div className="behavior-bend"><span>PREFERENCE</span></div>
          </div>
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT III</span><span>RESOLVE</span></p>
            <h2 id="behavior-title">Different meaning receives different physics.</h2>
            <p>
              Goals lock the datum. Constraints stop incompatible movement.
              Unknowns stay visibly unresolved. Preferences guide without becoming obligations.
            </p>
            <ul className="forge-legend">
              <li><i className="shape-lock" />Solid edge · locked</li>
              <li><i className="shape-stop" />Double edge · stop</li>
              <li><i className="shape-open" />Dashed span · unresolved</li>
              <li><i className="shape-bend" />Angled seam · preference</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="forge-act story-structure" id="act-structure" aria-labelledby="structure-title">
        <div className="forge-story-grid">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT IV</span><span>STRUCTURE</span></p>
            <h2 id="structure-title">Index meaning into a load-bearing scaffold.</h2>
            <p>
              Smoked-titanium gates align roles without flattening their differences.
              Open questions stay open while confirmed input keeps its provenance.
            </p>
          </header>
          <div className="structure-gates" aria-hidden="true">
            <i /><i /><i />
            {semanticRows.map((row) => <b key={row.id} data-kind={row.id} />)}
          </div>
        </div>
      </section>

      <section className="forge-act story-strategy" id="act-strategy" aria-labelledby="strategy-title">
        <div className="strategy-frame">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT V</span><span>STRATEGIZE</span></p>
            <h2 id="strategy-title">Strategy connects only after meaning is explicit.</h2>
            <p>The warm datum sequences the scaffold; it does not replace the user's intent.</p>
          </header>
          <ol className="strategy-spine">
            {(techniques.length ? techniques : [
              "Await a valid compile result",
            ]).map((technique, index) => (
              <li key={technique}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{technique}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="forge-act story-artifact" id="act-artifact" aria-labelledby="artifact-story-title">
        <div className="artifact-stage">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT VI</span><span>RENDER</span></p>
            <h2 id="artifact-story-title">The Prompt Artifact closes around real structure.</h2>
          </header>
          <article className="artifact-sheet" aria-label="Prompt Artifact preview">
            <header>
              <div><span>Prompt Artifact</span><strong>{targetLabel}</strong></div>
              <span>{demoPrompt ? "Rendered from current compile" : "Unavailable"}</span>
            </header>
            <pre>{demoPrompt || "Compile a raw thought to render the current Prompt Artifact."}</pre>
            <footer>
              <span>Goal</span><span>Constraints</span><span>Preferences</span><span>Unknowns</span>
            </footer>
          </article>
        </div>
      </section>

      <section className="forge-act story-routing" id="act-routing" aria-labelledby="routing-title">
        <div className="forge-story-grid reverse">
          <div className="routing-loom" role="list" aria-label="Available target renderers">
            <div className="routing-source">Protected intent</div>
            {TARGETS.map((item, index) => (
              <div
                key={item.id}
                className="routing-target"
                data-active={item.id === target}
                role="listitem"
                style={{ "--route-order": index } as CSSProperties}
              >
                {item.label}
              </div>
            ))}
          </div>
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT VII</span><span>ROUTE</span></p>
            <h2 id="routing-title">Intent stays. Rendering routes to the selected AI.</h2>
            <p>
              Target adapters change presentation language only. The current selection is
              {" "}<strong>{targetLabel}</strong>.
            </p>
          </header>
        </div>
      </section>

      <section className="forge-act story-portable" id="act-portable" aria-labelledby="portable-title">
        <div className="forge-story-grid">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT VIII</span><span>CARRY</span></p>
            <h2 id="portable-title">The instruction becomes a portable semantic folio.</h2>
            <p>
              The `.spe` artifact keeps intent, requirements, strategy, prompt, and lineage
              as distinct inspectable layers.
            </p>
            <button type="button" className="forge-secondary" onClick={onOpenWorkspace}>
              {artifact ? "Inspect current .spe" : "Open workbench"}
            </button>
          </header>
          <div className="spe-folio" data-ready={Boolean(artifact)} aria-label={artifact ? "Current .spe artifact available" : "No .spe artifact rendered"}>
            {["Lineage", "Prompt", "Strategy", "Requirements", "Intent"].map((layer, index) => (
              <div key={layer} style={{ "--folio-layer": index } as CSSProperties}>
                <span>{layer}</span>
                {index === 4 && <strong>.spe</strong>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="forge-act story-daily" id="act-daily" aria-labelledby="daily-title">
        <div className="daily-stage">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT IX</span><span>EXPAND / DAILY LAB</span></p>
            <h2 id="daily-title">A stage for future inputs—clearly labeled, never implied.</h2>
            <p>Text compilation is current. Other input routes remain planned.</p>
          </header>
          <div className="moonshot-constellation" role="list">
            {MISSION_STAGE.map(([label, status], index) => (
              <div key={label} role="listitem" data-status={status} style={{ "--mission-order": index } as CSSProperties}>
                <span>{status}</span><strong>{label}</strong>
              </div>
            ))}
          </div>
          <div className="daily-bench">
            <span>DAILY LAB / PLANNED</span>
            <p>No feed or release cadence is claimed.</p>
          </div>
        </div>
      </section>

      <section className="forge-act story-privacy" id="act-privacy" aria-labelledby="privacy-title">
        <div className="privacy-inversion">
          <header className="forge-story-copy">
            <p className="forge-stage-label"><span>ACT X</span><span>RETURN</span></p>
            <h2 id="privacy-title">The forge collapses back to this device.</h2>
            <p>
              Runtime labels below are shown only when available. Local history remains opt-in.
            </p>
          </header>
          <dl className="privacy-ledger">
            <div><dt>Compile path</dt><dd>UI → Worker → WASM</dd></div>
            <div><dt>Network mode</dt><dd>NONE during evaluate</dd></div>
            <div><dt>Shell</dt><dd>{online ? "Online" : "Offline"}</dd></div>
            <div><dt>Sensitivity</dt><dd>{privacy.sensitivity ?? "Unavailable"}</dd></div>
            <div><dt>Trust</dt><dd>{privacy.trust ?? "Unavailable"}</dd></div>
            <div><dt>Authority</dt><dd>{privacy.authority ?? "Unavailable"}</dd></div>
          </dl>
          <button type="button" className="forge-primary" onClick={onOpenWorkspace}>
            Enter the workbench
          </button>
        </div>
      </section>
    </div>
  );
}
