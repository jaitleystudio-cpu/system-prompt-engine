import { pathForView } from "../routing";

/** Honest capability landing for search + answer engines — ranking claims stay unproven. */
export function Capabilities() {
  return (
    <section
      className="spe-capabilities-page spe-privacy-page"
      aria-labelledby="capabilities-title"
    >
      <p className="spe-kicker">Capabilities</p>
      <h1 id="capabilities-title">What SPE can do on this device</h1>
      <p className="spe-privacy-lede spe-capabilities-lede">
        SPE is a free system prompt generator that prepares prompts in your
        browser. These capabilities describe what the research preview actually
        ships — not unproven ranking claims.
      </p>

      <ol className="spe-capabilities-atlas" aria-label="Capability atlas">
        <li id="local-first" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            01
          </span>
          <div className="spe-atlas-body">
            <h2>Local-first preparation</h2>
            <p className="spe-atlas-outcome">
              Your brief is shaped in the browser on this device.
            </p>
            <p className="spe-atlas-detail">
              SPE does not need a cloud AI account to prepare a prompt you can
              review and reuse. Optional helpers (website fetch, speech) only
              run when you ask.
            </p>
          </div>
        </li>
        <li id="protected-intent" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            02
          </span>
          <div className="spe-atlas-body">
            <h2>ProtectedIntent</h2>
            <p className="spe-atlas-outcome">
              Explicit constraints and desired output stay bound to the brief.
            </p>
            <p className="spe-atlas-detail">
              Downstream profile selection, dry-runs, and{" "}
              <code>.spe</code> import are designed not to silently widen what
              you locked in.
            </p>
          </div>
        </li>
        <li id="execution-contract" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            03
          </span>
          <div className="spe-atlas-body">
            <h2>Execution Contract</h2>
            <p className="spe-atlas-outcome">
              After compile, SPE can show the contract SPE actually produced.
            </p>
            <p className="spe-atlas-detail">
              Goal, protocol depth, hard constraints, planned stages, and
              authority state. A local dry-run checks those facts without
              executing side effects.
            </p>
          </div>
        </li>
        <li id="provider-profiles" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            04
          </span>
          <div className="spe-atlas-body">
            <h2>Provider profiles</h2>
            <p className="spe-atlas-outcome">
              Versioned profiles describe local, deterministic, or optional
              external routes.
            </p>
            <p className="spe-atlas-detail">
              Selection is observational routing only — it does not grant
              authority, enable network, or release credentials. Default policy
              is local-first and closed.
            </p>
          </div>
        </li>
        <li id="portable-spe" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            05
          </span>
          <div className="spe-atlas-body">
            <h2>
              Portable <code>.spe</code> files
            </h2>
            <p className="spe-atlas-outcome">
              Export a portable artifact with integrity metadata so you can
              reopen intent, structure, and the finished prompt later.
            </p>
            <p className="spe-atlas-detail">
              Import cannot escalate capabilities beyond what the local registry
              allows.
            </p>
          </div>
        </li>
        <li id="context-protocol" className="spe-atlas-entry">
          <span className="spe-atlas-mark" aria-hidden="true">
            06
          </span>
          <div className="spe-atlas-body">
            <h2>Context Protocol (preview)</h2>
            <p className="spe-atlas-outcome">
              Optional public-source depth controls can enrich a brief when you
              choose them.
            </p>
            <p className="spe-atlas-detail">
              Failures stay visible; SPE does not pretend a blocked fetch
              succeeded.
            </p>
          </div>
        </li>
      </ol>

      <section
        className="spe-capabilities-faq"
        aria-labelledby="capabilities-faq-title"
        id="faq"
      >
        <h2 id="capabilities-faq-title">Plain answers</h2>
        <dl className="spe-faq-list">
          <div>
            <dt>What is SPE?</dt>
            <dd>
              SPE (System Prompt Engine) is a free, browser-based system prompt
              generator. You start with a rough idea; SPE helps you shape
              meaning, structure, and a prompt you can take to any model you
              choose.
            </dd>
          </div>
          <div>
            <dt>Does SPE send my idea to an AI provider to prepare it?</dt>
            <dd>
              No. Prompt preparation runs locally in your browser. You decide
              whether to copy, download, or take the finished prompt elsewhere.
            </dd>
          </div>
          <div>
            <dt>What is an Execution Contract in SPE?</dt>
            <dd>
              It is the structured contract SPE compiles with your brief — goal,
              constraints, planned stages, and authority state. A local dry-run
              can check it without executing side effects.
            </dd>
          </div>
          <div>
            <dt>Do provider profiles grant SPE permission to call external AI?</dt>
            <dd>
              No. Selecting a provider profile is not an authority grant.
              External routes stay off unless you explicitly allow them; the
              default is local-first.
            </dd>
          </div>
          <div>
            <dt>Does SPE claim a worldwide ranking as the top prompt tool?</dt>
            <dd>
              No. That ranking claim is not proven. SPE is a research preview
              with honest local preparation, contracts, and portability — not
              an independently replicated top ranking.
            </dd>
          </div>
        </dl>
      </section>

      <details className="spe-privacy-proof" data-copy-depth="PROOF">
        <summary>Technical notes (for reviewers)</summary>
        <ul>
          <li>
            Engine path: UI → Web Worker → <code>spe_wasm.wasm</code> → spe-core-rs.
            Integrity failure stops preparation; no pretend engine fallback.
          </li>
          <li>
            Provider profile selection is observational only and distinct from
            AuthorityGrant. Network and credentials are never auto-enabled.
          </li>
          <li>
            FAQPage JSON-LD on this route mirrors the plain answers above for
            answer engines. WORLD ranking claims remain unproven.
          </li>
        </ul>
      </details>

      <ul className="spe-seo-links spe-capabilities-links">
        <li>
          <a href={pathForView("create")}>Open the free prompt builder</a>
        </li>
        <li>
          <a href={pathForView("privacy")}>Privacy proof — what stays local</a>
        </li>
        <li>
          <a href={pathForView("code")}>Screenshot-to-code prompts</a>
        </li>
        <li>
          <a href={pathForView("lab")}>Daily Lab specimens</a>
        </li>
      </ul>
    </section>
  );
}
