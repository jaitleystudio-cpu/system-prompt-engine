export function PrivacyProof() {
  return (
    <section className="spe-privacy-page" aria-labelledby="privacy-title">
      <p className="spe-kicker">Privacy</p>
      <h1 id="privacy-title">Your thinking stays with you</h1>
      <p className="spe-privacy-lede">
        SPE writes the prompt in this browser. It does not send your idea to an
        AI company to prepare it. A few optional steps can reach something else
        only when you ask — and those steps are named below.
      </p>
      <div className="spe-privacy-grid">
        <article>
          <h2>Preparation stays local</h2>
          <p>
            Your brief is shaped in the browser. SPE does not need a cloud AI
            account to prepare a prompt you can review and reuse.
          </p>
        </article>
        <article>
          <h2>You choose the destination</h2>
          <p>
            When a prompt is ready, you decide whether to copy it, download a
            portable <code>.spe</code> file, or take it to another AI yourself.
          </p>
        </article>
        <article>
          <h2>Media stays on device</h2>
          <p>
            Image, screenshot, and video notes are computed here with simple
            pixel checks. Optional same-origin model packs may load from this
            site when you use image helpers — no paid vision service is
            required for this preview.
          </p>
        </article>
        <article>
          <h2>Speech is optional</h2>
          <p>
            Dictation uses your browser&apos;s own speech tools when available.
            SPE does not store audio. You can always type instead. Speech support varies by browser. If listening is unavailable, typing always works.
          </p>
        </article>
        <article>
          <h2>Website input is honest</h2>
          <p>
            Remote website addresses are kept as references under this product&apos;s
            same-origin network policy — SPE does not fetch arbitrary remote page
            HTML. Upload page HTML, a screenshot, or a short description when you
            need grounding.
          </p>
        </article>
        <article>
          <h2>History only if you ask</h2>
          <p>
            Optional history stays in this browser&apos;s storage. Turn it off or clear it
            anytime from My Work. Theme preference may also be stored locally.
          </p>
        </article>
        <article>
          <h2>No ads, no sale, no silent tracking</h2>
          <p>
            This preview does not include analytics, ad tracking, or a sale of
            your prompts. SPE does not use your idea to target you.
          </p>
        </article>
        <article>
          <h2>Nothing runs unless you start it</h2>
          <p>
            A local check looks at the prompt on this device. It does not call
            an outside AI, and it does not grant permission to act for you.
          </p>
        </article>
        <article>
          <h2>When something can leave this page</h2>
          <p>
            Network use stays same-origin for this product — the local engine and
            optional model packs on this site. Speech uses your browser&apos;s
            own listening tools, which may use that browser&apos;s service. SPE does
            not keep the audio. If you copy a prompt into another product, that
            product&apos;s rules apply — SPE does not send it for you.
          </p>
        </article>
      </div>
      <details className="spe-privacy-proof" data-copy-depth="PROOF">
        <summary>Technical proof (for reviewers)</summary>
        <ul>
          <li>
            Engine path: UI → Web Worker → <code>spe_wasm.wasm</code> → spe-core-rs.
            Integrity failure stops preparation; no pretend engine fallback.
          </li>
          <li>
            Static <code>_headers</code> ship Content-Security-Policy (including{" "}
            <code>connect-src &apos;self&apos;</code>,{" "}
            <code>frame-ancestors &apos;none&apos;</code>),{" "}
            <code>X-Content-Type-Options: nosniff</code>, and{" "}
            <code>Referrer-Policy: no-referrer</code> for hosts that honor them.
            Remote website HTML fetch is therefore not generally authorized.
          </li>
          <li>
            Apex parking pages (for example a <code>/lander</code> redirect) are
            not the SPE app — do not treat their headers as SPE proof until curl
            shows them on the real app origin.
          </li>
        </ul>
      </details>
    </section>
  );
}
