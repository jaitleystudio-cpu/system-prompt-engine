import type { AppView } from "../routing";
import { InAppLink } from "../shell/inAppLink";

/** Search-targeted semantic content BELOW the premium hero — not stuffed into the theater. */
export function SeoContent({
  onNavigate,
}: {
  onNavigate: (view: AppView) => void;
}) {
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
          SPE is a free system prompt generator. Start with a rough idea, review
          the prompt, and choose where to use it. Optional website or media
          helpers run only when you ask.
        </p>
        <ul className="spe-seo-links">
          <li>
            <InAppLink view="create" onNavigate={onNavigate}>
              Open Prompt Studio Free
            </InAppLink>
          </li>
          <li>
            <InAppLink view="code" onNavigate={onNavigate}>
              S-Code: Screenshot to Frontend Code
            </InAppLink>
          </li>
          <li>
            <InAppLink view="workflows" onNavigate={onNavigate}>
              Verified Workflows: Ready-to-Run Agent Recipes
            </InAppLink>
          </li>
          <li>
            <InAppLink view="compare" onNavigate={onNavigate}>
              Benchmark Arena: Head-to-Head Accuracy Tests
            </InAppLink>
          </li>
          <li>
            <InAppLink view="lab" onNavigate={onNavigate}>
              Browse Daily Prompt Recipes
            </InAppLink>
          </li>
          <li>
            <InAppLink view="capabilities" onNavigate={onNavigate}>
              Scope Guardrails &amp; Capabilities
            </InAppLink>
          </li>
          <li>
            <InAppLink view="privacy" onNavigate={onNavigate}>
              Privacy proof — zero prompt bytes leave this device
            </InAppLink>
          </li>
          <li>
            <InAppLink view="pricing" onNavigate={onNavigate}>
              Plans &amp; Pricing ($9/mo Pro · $99/mo Team)
            </InAppLink>
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
