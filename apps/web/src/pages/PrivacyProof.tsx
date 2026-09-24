export function PrivacyProof() {
  return (
    <section className="spe-privacy-page" aria-labelledby="privacy-title">
      <p className="spe-kicker">Privacy / Proof</p>
      <h1 id="privacy-title">What stays on your device</h1>
      <div className="spe-privacy-grid">
        <article>
          <h2>Preparation is local</h2>
          <p>
            SPE shapes prompts with a WebAssembly engine that runs in your
            browser. Your idea is not sent to SPE servers to prepare a prompt.
          </p>
        </article>
        <article>
          <h2>Integrity before work</h2>
          <p>
            The engine file is checked before use. If the check fails, preparation
            stops safely — SPE does not fall back to a pretend engine.
          </p>
        </article>
        <article>
          <h2>Speech is your browser</h2>
          <p>
            Optional speech recognition uses your browser&apos;s own service. SPE
            does not store audio. You can always type instead.
          </p>
        </article>
        <article>
          <h2>Media stays local</h2>
          <p>
            Image, screenshot, and video observations are computed on this device
            with pixel sampling. No paid vision API is required.
          </p>
        </article>
        <article>
          <h2>URL honesty</h2>
          <p>
            Website fetch uses your browser&apos;s network rules. If CORS blocks a
            site, SPE shows fallbacks — HTML upload, screenshot, or description —
            and never a paid proxy.
          </p>
        </article>
        <article>
          <h2>Headers on deploy</h2>
          <p>
            Static <code>_headers</code> ship Content-Security-Policy,
            X-Content-Type-Options, and Referrer-Policy for hosts that honor them.
            Apex parking pages are not the SPE app — do not treat their headers as
            SPE proof until curl shows them on the real app origin.
          </p>
        </article>
      </div>
    </section>
  );
}
