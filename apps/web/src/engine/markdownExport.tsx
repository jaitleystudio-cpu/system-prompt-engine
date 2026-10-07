import React, { useState } from "react";
import { synthesizeSystemPrompt } from "./promptSynthesizer.mjs";
import type { DepthTier } from "./promptSynthesizer";

export interface MarkdownConstructOptions {
  title?: string;
  category?: string;
  depthTier?: DepthTier;
  includeFrontmatter?: boolean;
  sha256?: string | null;
}

/**
 * Constructs a production-grade system prompt in pure Markdown format.
 * Incorporates role, bounded objective, cognitive scaffolding, execution details,
 * evidence boundaries, and verification batteries.
 */
export function constructMarkdownSystemPrompt(
  irOrPrompt: string,
  options: MarkdownConstructOptions = {}
): string {
  const {
    title = "SPE Calibrated System Prompt",
    category,
    depthTier = "normal",
    includeFrontmatter = false,
    sha256 = null,
  } = options;

  // Synthesize Markdown structure via universal synthesizer
  const mdBody = synthesizeSystemPrompt(irOrPrompt, {
    target: "chatgpt", // Standard GFM Markdown spec
    category,
    depthTier,
  });

  if (!includeFrontmatter) {
    return mdBody;
  }

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    'generator: "System Prompt Engine (SPE v1.2)"',
    'format: "Markdown (CommonMark / GitHub Flavored Markdown)"',
    `depth_tier: ${JSON.stringify(depthTier)}`,
    `character_count: ${mdBody.length}`,
    `created_at_utc: ${JSON.stringify(new Date().toISOString())}`,
    sha256 ? `integrity_sha256: ${JSON.stringify(sha256)}` : null,
    "---",
    "",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return frontmatter + mdBody;
}

/**
 * Initiates browser download of a Markdown (.md) file.
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const safeFilename = filename.endsWith(".md") ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: "text/markdown; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface MarkdownExportButtonProps {
  promptText: string;
  rawIrPrompt?: string | null;
  category?: string;
  depthTier?: DepthTier;
  sha256?: string | null;
  className?: string;
  disabled?: boolean;
  includeFrontmatter?: boolean;
  onExported?: () => void;
}

export const MarkdownExportButton: React.FC<MarkdownExportButtonProps> = ({
  promptText,
  rawIrPrompt,
  category,
  depthTier = "normal",
  sha256,
  className = "spe-ghost",
  disabled = false,
  includeFrontmatter = false,
  onExported,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (disabled || !promptText) return;
    setDownloading(true);
    try {
      const source = rawIrPrompt || promptText;
      const mdContent = constructMarkdownSystemPrompt(source, {
        category,
        depthTier,
        includeFrontmatter,
        sha256,
      });
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadMarkdownFile(`spe-system-prompt-${timestamp}.md`, mdContent);
      if (onExported) onExported();
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || downloading}
      onClick={handleDownload}
      title="Download calibrated system prompt in Markdown (.md) format"
      aria-label="Download Markdown system prompt"
    >
      {downloading ? "..." : ".md"}
    </button>
  );
};
