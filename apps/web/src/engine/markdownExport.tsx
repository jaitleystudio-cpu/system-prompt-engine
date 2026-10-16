import React, { useState } from "react";
import {
  constructMarkdownSystemPrompt,
  downloadMarkdownFile,
  type MarkdownConstructOptions,
} from "./markdownExportCore";
export {
  constructMarkdownSystemPrompt,
  downloadMarkdownFile,
  type MarkdownConstructOptions,
};
import type { DepthTier } from "./promptSynthesizer";
import { resolveBrowserVerifiedEntitlement } from "./entitlementVerifier";
import type { AgencyBranding } from "@spe/web-runtime";


export interface MarkdownExportButtonProps {
  promptText: string;
  rawIrPrompt?: string | null;
  category?: string;
  depthTier?: DepthTier;
  sha256?: string | null;
  className?: string;
  disabled?: boolean;
  includeFrontmatter?: boolean;
  agencyBranding?: AgencyBranding | null;
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
  agencyBranding,
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
        agencyBranding,
        entitlement: resolveBrowserVerifiedEntitlement(),
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
