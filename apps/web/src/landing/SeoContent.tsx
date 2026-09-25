import { pathForView } from "../routing";

/** Search-targeted semantic content BELOW the premium hero — not stuffed into the theater. */
export function SeoContent() {
  return (
    <section
      className="spe-seo-content"
      aria-labelledby="seo-heading"
      id="about-spe"
    >
      <div className="spe-seo-inner">
        <p className="eyebrow">A FREE PROMPT ENGINEERING TOOL</p>
        <h2 id="seo-heading">
          System prompt generator for ideas that need structure
        </h2>
        <p>
          SPE is a free system prompt generator and AI prompt builder that runs
          in your browser. Start with a rough idea; SPE helps you shape{" "}
          <strong>meaning</strong>, arrange <strong>structure</strong>, and take
          a clear <strong>prompt</strong> you can use with any model.
        </p>
        <p>
          Unlike cloud-only prompt apps, your brief is prepared on this device.
          Optional website or media helpers only run when you ask — never as a
          silent background service.
        </p>
        <ul className="spe-seo-links">
          <li>
            <a href={pathForView("create")}>
              Open the free prompt builder (Create)
            </a>
          </li>
          <li>
            <a href={pathForView("code")}>
              Screenshot-to-code prompt engineering tool
            </a>
          </li>
          <li>
            <a href={pathForView("lab")}>Browse Daily Lab prompt ideas</a>
          </li>
          <li>
            <a href={pathForView("privacy")}>
              Privacy proof — what stays on this device
            </a>
          </li>
          <li>
            <a href={pathForView("my-work")}>My Work — prompts saved on device</a>
          </li>
        </ul>
        <p className="spe-seo-phrases">
          Natural uses: system prompt generator · AI prompt generator · prompt
          engineering tool · free prompt builder · local prompt compiler.
        </p>
      </div>
    </section>
  );
}
