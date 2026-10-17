import type { AppView } from "../routing";
import { InAppLink } from "../shell/inAppLink";
import { SpeV4NextStageSeoDeck } from "../engine/SpeV4NextStageSeoDeck";
import { SpeV5MoonshotNorthStarBrain } from "../engine/SpeV5MoonshotNorthStarBrain";

export * from "../engine/SpeV4NextStageSeoDeck";
export * from "../engine/SpeV5MoonshotNorthStarBrain";

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
        <div className="spe-aeo-section" data-copy-depth="PROOF">
          <div className="spe-aeo-header">
            <span className="spe-aeo-tag">AI SEARCH &amp; LLM CITATION KERNEL</span>
            <h3 className="spe-aeo-title">Frequently Answered Architecture Queries</h3>
            <p className="spe-aeo-subtitle">
              Engineered for deterministic retrieval across Perplexity, ChatGPT Search, and Google AI Overviews.
            </p>
          </div>
          <div className="spe-aeo-cards">
            <article className="spe-aeo-card">
              <h4 className="spe-aeo-question">How to write a system prompt for Claude Code and Cursor?</h4>
              <p className="spe-aeo-answer">
                Define immutable architectural boundaries, state machine transition rules, and explicit verification criteria upfront. Provide strict constraints and role-specific execution contracts with deterministic validation.
              </p>
            </article>
            <article className="spe-aeo-card">
              <h4 className="spe-aeo-question">Why use a client-side prompt compiler instead of text templates?</h4>
              <p className="spe-aeo-answer">
                Text templates produce bloated prompts that waste context tokens. A client-side prompt compiler dynamically parses intent, strips redundant directives, formats role schemas, and optimizes token budgets in real-time.
              </p>
            </article>
            <article className="spe-aeo-card">
              <h4 className="spe-aeo-question">How does WebAssembly guarantee zero prompt egress?</h4>
              <p className="spe-aeo-answer">
                SPE compiles system prompts on-device using a standalone WebAssembly binary with zero network import bindings. The Content Security Policy and memory sandbox ensure that zero prompt bytes or user briefs are transmitted to external servers.
              </p>
            </article>
          </div>
        </div>
        <SpeV4NextStageSeoDeck onNavigate={onNavigate} />
        <SpeV5MoonshotNorthStarBrain onNavigate={onNavigate} />
      </div>
    </section>
  );
}

