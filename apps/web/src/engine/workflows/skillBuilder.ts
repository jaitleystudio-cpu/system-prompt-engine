/**
 * In-Browser AI Skill Builder & Formatter.
 * Transforms natural language procedures into standard SKILL.md specs.
 * Zero server-side inference ($0 compute cost).
 */

import { auditSkillContent, ClientAuditReport } from "./clientAuditScanner";

export interface SkillTemplateInput {
  name: string;
  description: string;
  domainCategory: string;
  proceduralSteps: string[];
  allowedPermissions: string[];
  acceptanceCriteria: string[];
  author?: string;
}

export interface CompiledSkillBundle {
  skillName: string;
  skillMarkdown: string;
  claudeCodeCommand: string;
  cursorRuleText: string;
  auditReport: ClientAuditReport;
}

export function buildSkillMarkdown(input: SkillTemplateInput): string {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const permissionsList = input.allowedPermissions.length > 0 ? input.allowedPermissions.join(", ") : "LOCAL_FILESYSTEM_READ";

  const lines = [
    "---",
    `name: ${slug}`,
    `description: "${input.description.replace(/"/g, '\\"')}"`,
    `category: ${input.domainCategory}`,
    `risk: ${input.allowedPermissions.includes("NETWORK_EGRESS") ? "network" : "safe"}`,
    `source: spe-exchange`,
    `date_added: "${new Date().toISOString().split("T")[0]}"`,
    "---",
    "",
    `# ${input.name}`,
    "",
    input.description,
    "",
    "## When to Use This Skill",
    `- Use when executing tasks requiring: ${input.domainCategory}`,
    "- Use when verifiable evidence and deterministic output are required",
    "",
    "## Execution Directives",
  ];

  input.proceduralSteps.forEach((step, idx) => {
    lines.push(`${idx + 1}. **Phase ${idx + 1}**: ${step}`);
  });

  lines.push("");
  lines.push("## Verification Criteria");
  if (input.acceptanceCriteria.length > 0) {
    input.acceptanceCriteria.forEach((crit) => {
      lines.push(`- [ ] ${crit}`);
    });
  } else {
    lines.push("- [ ] All declared output artifacts exist on disk and pass syntax validation");
    lines.push("- [ ] Zero regressions introduced into previously passing test suites");
  }

  lines.push("");
  lines.push("## Security Boundaries");
  lines.push(`- Allowed Permissions: \`${permissionsList}\``);
  lines.push("- Any command requesting unauthorized escalation MUST be rejected by the agent");

  return lines.join("\n");
}

export function auditAndBuildSkill(input: SkillTemplateInput): CompiledSkillBundle {
  const markdown = buildSkillMarkdown(input);
  const auditReport = auditSkillContent(markdown);
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const claudeCodeCommand = `mkdir -p ~/.claude/skills/${slug} && cat << 'EOF' > ~/.claude/skills/${slug}/SKILL.md\n${markdown}\nEOF`;

  const cursorRuleText = `// .cursorrules entry for ${input.name}\n// Domain: ${input.domainCategory}\n${input.proceduralSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  return {
    skillName: slug,
    skillMarkdown: markdown,
    claudeCodeCommand,
    cursorRuleText,
    auditReport,
  };
}
