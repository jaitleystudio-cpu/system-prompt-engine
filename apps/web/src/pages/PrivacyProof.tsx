export function PrivacyProof() {
  return (
    <section className="spe-privacy-page" aria-labelledby="privacy-title">
      <p className="spe-kicker">Privacy</p>
      <h1 id="privacy-title">Your thinking stays with you</h1>
      <p className="spe-privacy-lede">
        Shape prompts on this device. Choose what you keep, where your work goes,
        and which AI you use — without sending your idea to SPE to prepare it.
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
            pixel checks. No paid vision service is required for this preview.
          </p>
        </article>
        <article>
          <h2>Speech is optional</h2>
          <p>
            Dictation uses your browser&apos;s own speech tools when available.
            SPE does not store audio. You can always type instead. Device support
            varies — treat speech as best-effort until qualified on your hardware.
          </p>
        </article>
        <article>
          <h2>Website fetch is honest</h2>
          <p>
            If a site blocks the browser, SPE shows clear fallbacks (HTML upload,
            screenshot, or a short description) and never a paid proxy.
          </p>
        </article>
        <article>
          <h2>History only if you ask</h2>
          <p>
            Optional history stays in this browser. Turn it off or clear it
            anytime from My Work.
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
            <code>frame-ancestors &apos;none&apos;</code>),{" "}
            <code>X-Content-Type-Options: nosniff</code>, and{" "}
            <code>Referrer-Policy: no-referrer</code> for hosts that honor them.
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
