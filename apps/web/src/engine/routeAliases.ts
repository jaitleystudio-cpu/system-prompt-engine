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
  "/compare/spe-vs-promptfoo": "compare",
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
  "/integrations/anthropic": "capabilities",
  "/prompts": "prompts",
  "/arsenal": "prompts",
  "/prompt-vault": "prompts",
  "/prompt-library": "prompts",
  "/eval-studio": "eval-studio",
  "/eval": "eval-studio",
  "/redteam": "eval-studio",
  "/matrix": "eval-studio",
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
      "Side-by-side prompt evaluation against Claude 3.7, GPT-4o, Grok 3, and Local Ollama. Live assertions, 10 OWASP red-team attack probes, and 1-click vulnerability immunization.",
  },
} as const;

