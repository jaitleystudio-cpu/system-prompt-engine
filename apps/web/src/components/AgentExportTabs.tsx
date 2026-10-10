import React, { useState, useMemo } from "react";
import { copyTextSafe } from "../engine/workflows/clipboard";
import { generatePromptfooConfig } from "../engine/promptfooExporter";

export type AgentFormatId =
  | "standard"
  | "claude"
  | "cursor"
  | "chatgpt"
  | "windsurf"
  | "promptfoo";

export interface AgentFormatMeta {
  id: AgentFormatId;
  label: string;
  filename: string;
  badge: string;
}

export const AGENT_FORMATS: AgentFormatMeta[] = [
  { id: "standard", label: "Universal System", filename: "system-prompt.md", badge: "Universal" },
  { id: "claude", label: "CLAUDE.md", filename: "CLAUDE.md", badge: "Claude Code" },
  { id: "cursor", label: ".cursorrules", filename: ".cursorrules", badge: "Cursor IDE" },
  { id: "chatgpt", label: "ChatGPT / Custom GPT", filename: "custom-gpt-instructions.txt", badge: "OpenAI" },
  { id: "windsurf", label: ".windsurfrules", filename: ".windsurfrules", badge: "Windsurf" },
  { id: "promptfoo", label: "promptfoo.yaml", filename: "promptfooconfig.yaml", badge: "CI/CD Eval" },
];

export function formatForAgent(
  rawPrompt: string,
  format: AgentFormatId,
  category = "General"
): { content: string; filename: string } {
  switch (format) {
    case "claude": {
      const content = `# CLAUDE.md — Agent System Directives\n> Compiled by System Prompt Engine (SPE Ω) · Deterministic Invariant Standard\n\n## Role & Core Guidelines\n${rawPrompt}\n\n## Non-Negotiable Operational Guardrails\n- Scope Invariant: Do not modify files outside explicitly declared boundaries.\n- Verification Receipt: Run project test suite and verify zero regressions before reporting task completion.\n- Zero Hallucination: Do not invent nonexistent packages, CLI flags, or mock endpoints.\n`;
      return { content, filename: "CLAUDE.md" };
    }
    case "cursor": {
      const content = `# .cursorrules — Project AI Directives & Guardrails\n# Compiled by System Prompt Engine (SPE Ω)\n\nYou are an expert developer operating under strict zero-drift invariants.\n\n${rawPrompt}\n\n## Project Invariants:\n1. Never introduce unverified dependencies.\n2. Ensure all types pass TypeScript/strict typechecking.\n3. Always verify changes with unit tests before declaring completion.\n`;
      return { content, filename: ".cursorrules" };
    }
    case "windsurf": {
      const content = `# .windsurfrules — Cascade Agent Directives\n# Compiled by System Prompt Engine (SPE Ω)\n\n${rawPrompt}\n`;
      return { content, filename: ".windsurfrules" };
    }
    case "chatgpt": {
      return { content: rawPrompt, filename: "custom-gpt-instructions.txt" };
    }
    case "promptfoo": {
      const bundle = generatePromptfooConfig(rawPrompt, { projectName: `spe-${category.toLowerCase()}-eval` });
      return { content: bundle.yamlConfig, filename: "promptfooconfig.yaml" };
    }
    case "standard":
    default: {
      return { content: rawPrompt, filename: "system-prompt.md" };
    }
  }
}

interface AgentExportTabsProps {
  promptText: string;
  category?: string;
  activeFormat: AgentFormatId;
  onFormatChange: (format: AgentFormatId) => void;
  onCopyNotice?: (msg: string) => void;
}

export const AgentExportTabs: React.FC<AgentExportTabsProps> = ({
  promptText,
  category = "General",
  activeFormat,
  onFormatChange,
  onCopyNotice,
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  const formatted = useMemo(() => {
    return formatForAgent(promptText, activeFormat, category);
  }, [promptText, activeFormat, category]);

  const handleCopy = async () => {
    const ok = await copyTextSafe(formatted.content);
    if (ok) {
      setCopied(activeFormat);
      if (onCopyNotice) {
        onCopyNotice(`Copied ${formatted.filename}!`);
      }
      setTimeout(() => setCopied(null), 2200);
    }
  };

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([formatted.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = formatted.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="spe-agent-export-tabs" style={{ margin: "1rem 0" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#64748b",
            fontWeight: 700,
            marginRight: "0.25rem",
          }}
        >
          Format For:
        </span>
        {AGENT_FORMATS.map((fmt) => {
          const isActive = activeFormat === fmt.id;
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => onFormatChange(fmt.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.35rem 0.65rem",
                borderRadius: "6px",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#38bdf8" : "#94a3b8",
                backgroundColor: isActive ? "#0f233d" : "#090d16",
                border: isActive ? "1px solid #38bdf8" : "1px solid #1e293b",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span>{fmt.label}</span>
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "0.1rem 0.35rem",
                  borderRadius: "4px",
                  backgroundColor: isActive ? "#0284c7" : "#1e293b",
                  color: "#ffffff",
                }}
              >
                {fmt.badge}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "0.4rem 0.85rem",
            backgroundColor: copied === activeFormat ? "#059669" : "#2563eb",
            color: "#ffffff",
            borderRadius: "6px",
            border: "none",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {copied === activeFormat ? `✓ Copied ${formatted.filename}!` : `Copy for ${formatted.filename}`}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            padding: "0.4rem 0.85rem",
            backgroundColor: "#1e293b",
            color: "#e2e8f0",
            borderRadius: "6px",
            border: "1px solid #334155",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Download {formatted.filename}
        </button>
      </div>
    </div>
  );
};
