/**
 * Route aliases mapping sitemap & SEO paths to functional AppViews.
 * Located in engine/ to isolate technical routing constants from UI static copy.
 */

export const ROUTE_ALIASES: Record<string, string> = {
  "/tools/system-prompt-generator": "create",
  "/tools/screenshot-to-code": "code",
  "/tools/free-3d-website-builder": "website",
  "/tools/audio-to-text": "media",
  "/tools/video-to-text": "media",
  "/prompt-compiler": "create",
  "/ai-instruction-compiler": "create",
  "/ai-instruction-assurance": "capabilities",
  "/prompt-security": "capabilities",
  "/ai-agent-security": "capabilities",
  "/mcp-security": "capabilities",
  "/model-drift-monitoring": "lab",
  "/ai-governance-evidence": "capabilities",
  "/migrate/from-raw-prompts": "create",
  "/integrations/mcp": "capabilities",
  "/integrations/github-actions": "capabilities",
  "/integrations/openai": "capabilities",
  "/tools/uidrop-extractor": "uidrop",
  "/tools/design-system-extractor": "uidrop",
  "/extractor": "uidrop",
  "/uidrop": "uidrop",
  "/possibility": "possibility",
  "/possibility-engine": "possibility",
  "/outcome-contract": "possibility",
  "/reality-frontier": "reality-frontier",
  "/frontier": "reality-frontier",
  "/feasibility-compiler": "reality-frontier",
  "/challenge": "challenge",
  "/anti-lucky-pass": "challenge",
  "/challenge-this-result": "challenge",
  "/lucky-pass": "challenge",
  "/revocation": "revocation",
  "/slicing": "revocation",
  "/non-interference": "revocation",
  "/intent-revocation": "revocation",
  "/prompts": "prompts",
  "/arsenal": "prompts",
  "/prompt-vault": "prompts",
  "/prompt-library": "prompts",
  "/eval-studio": "eval-studio",
  "/eval": "eval-studio",
  "/redteam": "eval-studio",
  "/matrix": "eval-studio",
  "/incidents": "incidents",
  "/ai-news": "incidents",
  "/failures": "incidents",
  "/incident-wire": "incidents",
  "/ai-incident-observatory": "incidents",
  "/model-failures": "incidents",
  "/tools/chatgpt-prompt-generator": "create",
  "/tools/claude-prompt-generator": "create",
  "/tools/xml-prompt-generator": "create",
  "/tools/json-prompt-generator": "create",
  "/tools/chain-of-thought-prompt-generator": "create",
  "/tools/reasoning-prompt-generator": "create",
  "/tools/few-shot-prompt-generator": "create",
  "/tools/tree-of-thought-prompt-generator": "create",
  "/tools/ai-prompt-optimiser": "create",
  "/tools/ai-prompt-optimizer": "create",
  "/compare/spe-vs-feedough": "compare",
  "/compare/spe-vs-promptfoo": "compare",
  "/compare/spe-vs-langfuse": "compare",
  "/compare/spe-vs-braintrust": "compare",
  "/compare/spe-vs-promptlayer": "compare",
  "/compare/spe-vs-aiprm": "compare",
  "/compare/spe-vs-promptbase": "compare",
  "/compare/spe-vs-promptperfect": "compare",
  "/compare/spe-vs-agenta": "compare",
  "/compare/spe-vs-all": "compare",
  "/alternatives/promptfoo-alternative": "compare",
  "/alternatives/langfuse-alternative": "compare",
  "/alternatives/braintrust-alternative": "compare",
  "/alternatives/aiprm-alternative": "compare",
  "/alternatives/promptbase-alternative": "compare",
  "/alternatives/feedough-alternative": "compare",
  "/vs/feedough": "compare",
  "/vs/promptfoo": "compare",
  "/vs/langfuse": "compare",
  "/vs/braintrust": "compare",
  "/vs/promptlayer": "compare",
  "/vs/aiprm": "compare",
  "/vs/promptbase": "compare",
  "/vs/promptperfect": "compare",
  "/vs/agenta": "compare",
  "/vs/all": "compare",
  "/extension": "capabilities",
  "/chrome-extension": "capabilities",
};

export function isPromptSubRoute(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean.startsWith("/prompts/") && clean.length > 9;
}

export const EVAL_STUDIO_VIEW = "eval-studio";

export const EXTRA_VIEW_PATH = {
  [EVAL_STUDIO_VIEW]: "/eval-studio",
} as const;

export const EXTRA_ROUTE_META = {
  "eval-studio": {
    path: "/eval-studio",
    title: "Frontier Model Eval Studio & 1-Click Immunizer | SPE Ω",
    description:
      "Side-by-side prompt evaluation against Claude Sonnet 5.5, OpenAI GPT-6.1-Sol, Claude Code 2.1, and Local Meta Muse. Live assertions, 10 OWASP red-team attack probes, and 1-click vulnerability immunization.",
  },
} as const;

