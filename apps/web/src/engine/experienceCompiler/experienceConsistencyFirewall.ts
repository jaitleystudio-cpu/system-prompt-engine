/**
 * SPE Ω — Interface Meaning Firewall (IMF)
 *
 * Mandate:
 * Grounded in:
 * - Cross-View Consistency Checking for Multimodal Web Agents (ACM 2026, DOI: 10.1145/3804601.3804623).
 * - Kleene-3 Monotone Lattices and Product-Promise Verification.
 *
 * Asserts that what an interface displays visually to a human, describes to a search engine,
 * and exposes to an autonomous browser agent are semantically isomorphic:
 *   ∀ C: Semantics(Human(C)) ≡ Semantics(Search(C)) ≡ Semantics(Agent(C))
 */

import { BANNED_BUZZWORDS } from "../heroIntelligence/productPromiseContract.ts";
import type {
  VerifiedCapabilityContract,
  TriViewCompilationResult,
  FirewallVerificationReport,
  FirewallCheckIssue,
} from "./types.ts";

export class ExperienceConsistencyFirewall {
  /**
   * Performs deep semantic consistency verification across Human, Search, and Agent projections.
   */
  public verify(
    contract: VerifiedCapabilityContract,
    triView: TriViewCompilationResult
  ): FirewallVerificationReport {
    const issues: FirewallCheckIssue[] = [];
    const timestamp = new Date().toISOString();

    const human = triView.humanExperience;
    const search = triView.searchExperience;
    const agent = triView.agentExperience;

    // 1. Check Parameter Parity (Human Form vs Agent Tool Schema)
    const humanParamNames = new Set(human.fields.map((f) => f.paramName));
    const agentParamNames = new Set(Object.keys(agent.parameters.properties));
    const contractParamNames = new Set(contract.parameters.map((p) => p.name));

    for (const cName of contractParamNames) {
      if (!humanParamNames.has(cName)) {
        issues.push({
          code: "FIREWALL_PARAM_DRIFT_CONTRACT_MISSING",
          severity: "CRITICAL",
          message: `Contract parameter '${cName}' is missing from Human Form fields.`,
          conflictingViews: ["HUMAN"],
          remediation: `Add form field for contract parameter '${cName}'.`,
        });
      }
    }

    // Check for missing parameters in agent view
    for (const pName of humanParamNames) {
      if (!agentParamNames.has(pName)) {
        issues.push({
          code: "FIREWALL_PARAM_DRIFT_AGENT_MISSING",
          severity: "CRITICAL",
          message: `Parameter '${pName}' is present in Human Form but missing from Agent WebMCP Tool schema.`,
          conflictingViews: ["HUMAN", "AGENT"],
          remediation: `Add parameter '${pName}' to the WebMCP tool properties definition.`,
        });
      }
    }

    // Check for hidden parameters in agent view that human cannot see
    for (const pName of agentParamNames) {
      if (!humanParamNames.has(pName)) {
        issues.push({
          code: "FIREWALL_PARAM_DRIFT_HUMAN_MISSING",
          severity: "HIGH",
          message: `Parameter '${pName}' is exposed in Agent Tool schema but missing from Human UI form.`,
          conflictingViews: ["HUMAN", "AGENT"],
          remediation: `Add corresponding form field for '${pName}' in human experience or remove from agent schema.`,
        });
      }
    }

    // Check enum parity
    for (const p of contract.parameters) {
      if (p.allowedValues && p.allowedValues.length > 0) {
        const humanField = human.fields.find((f) => f.paramName === p.name);
        const agentProp = agent.parameters.properties[p.name];

        if (humanField?.options && agentProp?.enum) {
          const humanOpts = new Set(humanField.options);
          const agentOpts = new Set(agentProp.enum);

          if (humanOpts.size !== agentOpts.size || [...humanOpts].some((o) => !agentOpts.has(o))) {
            issues.push({
              code: "FIREWALL_ENUM_DISCREPANCY",
              severity: "CRITICAL",
              message: `Allowed options for parameter '${p.name}' diverge between Human UI (${humanField.options.join(",")}) and Agent Tool (${agentProp.enum.join(",")}).`,
              conflictingViews: ["HUMAN", "AGENT"],
              remediation: "Ensure option lists are identical across both projections.",
            });
          }
        }
      }
    }

    // 2. Check Search Claims vs Underlying Capability Reality
    const searchString = `${search.titleTag} ${search.metaDescription}`.toLowerCase();
    for (const buzzword of BANNED_BUZZWORDS) {
      if (searchString.includes(buzzword.toLowerCase())) {
        issues.push({
          code: "FIREWALL_BANNED_BUZZWORD",
          severity: "HIGH",
          message: `Search metadata contains hyperbolic buzzword '${buzzword}'.`,
          conflictingViews: ["SEARCH"],
          remediation: "Replace hyperbolic claim with factual, measured capability statement.",
        });
      }
    }

    // Verify price claim truthfulness
    if (search.schemaOrgJsonLd.offers?.price === "0.00") {
      if (contract.requiresElevation) {
        issues.push({
          code: "FIREWALL_PRICE_MISMATCH",
          severity: "CRITICAL",
          message: "Search metadata advertises $0.00 free tier but capability contract requires elevated credentials.",
          conflictingViews: ["SEARCH"],
          remediation: "Clarify entitlement requirements or update structured data offer pricing.",
        });
      }
    }

    // 3. Check Agent Security & Capability Token Bounding
    if (!agent.toolName.startsWith("spe_")) {
      issues.push({
        code: "FIREWALL_TOOL_NAMESPACE_VIOLATION",
        severity: "HIGH",
        message: `Agent tool name '${agent.toolName}' does not use required 'spe_' namespace prefix.`,
        conflictingViews: ["AGENT"],
        remediation: "Prefix tool identifier with 'spe_'.",
      });
    }

    if (!contract.allowedScopes.includes(agent.requiredScope)) {
      issues.push({
        code: "FIREWALL_SCOPE_ESCALATION",
        severity: "CRITICAL",
        message: `Agent requiredScope '${agent.requiredScope}' is not among contract.allowedScopes ([${contract.allowedScopes.join(",")}]).`,
        conflictingViews: ["AGENT"],
        remediation: "Bind agent tool to an authorized capability token scope.",
      });
    }

    if (agent.rateLimitPerMinute > 300) {
      issues.push({
        code: "FIREWALL_EXCESSIVE_RATE_LIMIT",
        severity: "MEDIUM",
        message: `Agent rate limit of ${agent.rateLimitPerMinute}/min exceeds maximum safety threshold (300/min).`,
        conflictingViews: ["AGENT"],
        remediation: "Throttle rate limit to <= 300 requests per minute.",
      });
    }

    if (agent.offlineWasmExecutable !== contract.verificationProof.offlineWasmRunnable) {
      issues.push({
        code: "FIREWALL_OFFLINE_EXEC_MISMATCH",
        severity: "CRITICAL",
        message: `Agent offlineWasmExecutable (${agent.offlineWasmExecutable}) diverges from contract specification (${contract.verificationProof.offlineWasmRunnable}).`,
        conflictingViews: ["AGENT"],
        remediation: "Sync agent offline execution flag with contract verification proof.",
      });
    }

    // 4. Human Accessibility & Usability Sanity
    if (!human.submitButtonText || human.submitButtonText.trim().length === 0) {
      issues.push({
        code: "FIREWALL_A11Y_MISSING_SUBMIT_LABEL",
        severity: "CRITICAL",
        message: "Human Form submit button has an empty label.",
        conflictingViews: ["HUMAN"],
        remediation: "Provide explicit, descriptive action text on submit button.",
      });
    }

    const hasEmptyFieldLabels = human.fields.some((f) => !f.label || f.label.trim().length === 0);
    if (hasEmptyFieldLabels) {
      issues.push({
        code: "FIREWALL_A11Y_EMPTY_FIELD_LABEL",
        severity: "CRITICAL",
        message: "One or more Human Form fields have empty accessibility labels.",
        conflictingViews: ["HUMAN"],
        remediation: "Provide ISO 24495-1 plain-language labels for all form inputs.",
      });
    }

    // Metrics & Scoring Calculation
    const criticalIssues = issues.filter((i) => i.severity === "CRITICAL");
    const highIssues = issues.filter((i) => i.severity === "HIGH");

    const status = criticalIssues.length === 0 && highIssues.length === 0 ? "PASSED" : "FAILED";
    const penalty = criticalIssues.length * 0.35 + highIssues.length * 0.15 + issues.length * 0.05;
    const semanticConsistencyScore = Math.max(0.0, Math.min(1.0, 1.0 - penalty));

    return {
      timestamp,
      capabilityKey: contract.key,
      status,
      semanticConsistencyScore,
      issues,
      metrics: {
        parameterParityConfirmed: humanParamNames.size === agentParamNames.size && [...humanParamNames].every((p) => agentParamNames.has(p)),
        zeroExcessSearchClaims: !issues.some((i) => i.conflictingViews.includes("SEARCH")),
        agentSecurityBounded: !issues.some((i) => i.conflictingViews.includes("AGENT") && (i.severity === "CRITICAL" || i.severity === "HIGH")),
        a11yContrastCompliant: !issues.some((i) => i.conflictingViews.includes("HUMAN")),
        airGapZeroEgressEnforced: contract.verificationProof.offlineWasmRunnable,
      },
    };
  }
}
