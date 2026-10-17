// SPE Ω — Plugin & Skill Safety Auditor
// Audits tool, plugin, and skill names for security risk, token load, and attention conflict.
// Prunes redundancies to minimize AI context bloat and prevent multi-tool confusion drift.

export type ToolRiskLevel = "SAFE" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ToolAuditItem {
  name: string;
  category: "Search" | "FileSystem" | "Execution" | "Network" | "Financial" | "Database" | "Code" | "Communication" | "General";
  riskLevel: ToolRiskLevel;
  verdict: "APPROVED" | "RESTRICTED" | "REQUIRES_APPROVAL" | "REDUNDANT";
  reason: string;
  estimatedTokens: number;
}

export interface PluginAuditResult {
  overallSafetyScore: number; // 0 to 100
  totalAudited: number;
  approvedCount: number;
  restrictedCount: number;
  redundantCount: number;
  tokensSaved: number;
  auditedTools: ToolAuditItem[];
  synthesizedToolPolicy: string;
  recommendations: string[];
}

const KNOWN_TOOL_PROFILES: Record<string, { category: ToolAuditItem["category"]; risk: ToolRiskLevel; description: string }> = {
  bash: { category: "Execution", risk: "CRITICAL", description: "Arbitrary shell command execution" },
  terminal: { category: "Execution", risk: "CRITICAL", description: "Terminal process spawning" },
  sh: { category: "Execution", risk: "CRITICAL", description: "Shell script runner" },
  exec: { category: "Execution", risk: "CRITICAL", description: "Arbitrary code execution" },
  file_write: { category: "FileSystem", risk: "MODERATE", description: "Local disk file creation/overwrite" },
  write_file: { category: "FileSystem", risk: "MODERATE", description: "Disk write operations" },
  delete_file: { category: "FileSystem", risk: "HIGH", description: "Disk file removal" },
  file_read: { category: "FileSystem", risk: "SAFE", description: "Local disk file read-only inspect" },
  read_file: { category: "FileSystem", risk: "SAFE", description: "Read-only file access" },
  web_search: { category: "Search", risk: "SAFE", description: "Public web search queries" },
  google_search: { category: "Search", risk: "SAFE", description: "Search engine API" },
  bing_search: { category: "Search", risk: "SAFE", description: "Search engine API" },
  browser: { category: "Network", risk: "MODERATE", description: "Headless browser automation" },
  http_request: { category: "Network", risk: "HIGH", description: "Outbound arbitrary HTTP/REST requests" },
  stripe: { category: "Financial", risk: "CRITICAL", description: "Payment processing and balance mutation" },
  database_write: { category: "Database", risk: "HIGH", description: "Relational database write/update" },
  database_read: { category: "Database", risk: "SAFE", description: "Read-only SQL query execution" },
  git_commit: { category: "Code", risk: "MODERATE", description: "Version control state commit" },
  git_push: { category: "Code", risk: "HIGH", description: "Remote repository state publication" }
};

/**
 * Audits a comma-separated or array of plugin/tool names.
 */
export function auditPluginsAndSkills(inputTools: string[] | string): PluginAuditResult {
  const toolList = Array.isArray(inputTools)
    ? inputTools.map((t) => t.trim()).filter(Boolean)
    : (inputTools || "")
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);

  if (toolList.length === 0) {
    return {
      overallSafetyScore: 100,
      totalAudited: 0,
      approvedCount: 0,
      restrictedCount: 0,
      redundantCount: 0,
      tokensSaved: 0,
      auditedTools: [],
      synthesizedToolPolicy: "No external tools or plugins declared; operates in purely hermetic reasoning mode.",
      recommendations: ["Declare specific tools if your task requires external data access."]
    };
  }

  const auditedTools: ToolAuditItem[] = [];
  const seenCategories = new Map<string, string>(); // category -> first tool name
  let tokensSaved = 0;
  let penaltyPoints = 0;
  const recommendations: string[] = [];

  for (const rawName of toolList) {
    const key = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const profile = KNOWN_TOOL_PROFILES[key] || {
      category: "General",
      risk: rawName.toLowerCase().includes("delete") || rawName.toLowerCase().includes("pay") ? "HIGH" : "SAFE",
      description: "Custom user-declared tool"
    };

    let verdict: ToolAuditItem["verdict"] = "APPROVED";
    let reason = "Tool matches verified operational constraints.";
    const estimatedTokens = 450; // Average schema overhead in system prompt

    // Redundancy check (e.g. multiple search tools)
    if (profile.category === "Search") {
      if (seenCategories.has("Search")) {
        verdict = "REDUNDANT";
        reason = `Redundant search tool; overlaps with "${seenCategories.get("Search")}". Pruned to save attention tokens.`;
        tokensSaved += estimatedTokens;
      } else {
        seenCategories.set("Search", rawName);
      }
    }

    // High risk checks
    if (profile.risk === "CRITICAL") {
      verdict = "REQUIRES_APPROVAL";
      reason = "High-privilege tool: requires explicit human confirmation before invocation.";
      penaltyPoints += 25;
      recommendations.push(`Enforce human-in-the-loop approval gate before executing "${rawName}".`);
    } else if (profile.risk === "HIGH") {
      verdict = "RESTRICTED";
      reason = "State-mutating capability: must be bound by strict parameter schemas.";
      penaltyPoints += 15;
    }

    auditedTools.push({
      name: rawName,
      category: profile.category,
      riskLevel: profile.risk,
      verdict,
      reason,
      estimatedTokens
    });
  }

  const approvedCount = auditedTools.filter((t) => t.verdict === "APPROVED").length;
  const restrictedCount = auditedTools.filter((t) => t.verdict === "RESTRICTED" || t.verdict === "REQUIRES_APPROVAL").length;
  const redundantCount = auditedTools.filter((t) => t.verdict === "REDUNDANT").length;

  const safetyScore = Math.max(20, 100 - penaltyPoints);

  if (redundantCount > 0) {
    recommendations.push(`Pruned ${redundantCount} redundant tool schema(s), saving ~${tokensSaved} tokens and reducing model confusion.`);
  }

  // Synthesize lean policy block
  const activeTools = auditedTools.filter((t) => t.verdict !== "REDUNDANT");
  const synthesizedToolPolicy = `
/* ========================================================================== */
/* SPE AUDITED TOOL & PLUGIN CALLING POLICY                                    */
/* Active Tools: ${activeTools.map((t) => t.name).join(", ")}                 */
/* ========================================================================== */
1. AUTHORIZED TOOL REGISTRY:
${activeTools.map((t) => `   - \`${t.name}\`: [Risk: ${t.riskLevel}] -> ${t.reason}`).join("\n")}

2. INVOCATION RULES:
   - Call tools ONLY when direct deterministic computation or verification is required.
   - For tools marked REQUIRES_APPROVAL: Emit a proposal plan and pause for user confirmation before executing.
   - NEVER invent or simulate tool responses. Handle API errors with explicit fallback reasoning.`;

  return {
    overallSafetyScore: safetyScore,
    totalAudited: auditedTools.length,
    approvedCount,
    restrictedCount,
    redundantCount,
    tokensSaved,
    auditedTools,
    synthesizedToolPolicy,
    recommendations
  };
}
