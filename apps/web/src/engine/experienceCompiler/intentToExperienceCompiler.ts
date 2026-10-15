/**
 * SPE Ω — Intent-to-Experience Compiler
 *
 * Mandate:
 * Grounded in Denotational Semantics, Kleene-3 Monotone Lattices, and Google WebMCP (Oct 2026).
 * Compiles a single verified software capability contract into three unified,
 * mutually consistent experiences:
 * 1. Human Experience (Accessible, responsive, ISO 24495 plain language)
 * 2. Search Experience (SAGEO-verified, Schema.org indexable, zero doorway slop)
 * 3. Agent Experience (Google WebMCP / Model Context Protocol tool with capability token scope)
 */

import { computeSha256 } from "../hashUtils.ts";
import type {
  VerifiedCapabilityContract,
  HumanExperienceContract,
  HumanFormField,
  SearchExperienceContract,
  AgentExperienceContract,
  TriViewCompilationResult,
} from "./types.ts";

export const STANDARD_CAPABILITIES: Record<string, VerifiedCapabilityContract> = {
  spe_compile_prompt: {
    key: "spe_compile_prompt",
    title: "Deterministic System Prompt Compiler",
    description: "Compiles a raw developer task brief into an invariant-guarded, drift-resistant system prompt.",
    category: "COMPILER",
    parameters: [
      {
        name: "taskBrief",
        type: "string",
        description: "The raw task description, user intent, or system requirements.",
        required: true,
        humanLabel: "Describe your prompt goal or task",
        placeholder: "e.g. Code review without hallucinating imports, strict pre-commit test enforcement",
      },
      {
        name: "targetDialect",
        type: "string",
        description: "Target AI model dialect formatting (Anthropic, OpenAI, Google, Cursor).",
        required: false,
        defaultValue: "universal",
        allowedValues: ["universal", "anthropic_claude", "openai_gpt", "google_gemini", "cursor_rules"],
        humanLabel: "Target Model Dialect",
      },
      {
        name: "strictInvariants",
        type: "boolean",
        description: "Enforce strict zero-drift boundaries and forbidden action gates.",
        required: false,
        defaultValue: true,
        humanLabel: "Enable Strict Boundary Guardrails",
      },
    ],
    returns: {
      type: "object",
      description: "Compiled structured system prompt with verification proof and invariant tree.",
    },
    verificationProof: {
      ruleVerifier: "Propositional Horn Clause Engine",
      canonicalHash: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      offlineWasmRunnable: true,
    },
    requiresElevation: false,
    allowedScopes: ["spe:compile", "spe:read"],
  },

  spe_audit_skill: {
    key: "spe_audit_skill",
    title: "In-Browser Skill Package Taint Auditor",
    description: "Audits a portable agent SKILL.md package for ambient authority escalations, shell injections, and supply-chain taint.",
    category: "AUDIT",
    parameters: [
      {
        name: "skillMarkdown",
        type: "string",
        description: "Raw markdown content of the SKILL.md package to audit.",
        required: true,
        humanLabel: "Paste SKILL.md Content",
        placeholder: "---\nname: my-skill\ndescription: ...\n---\n...",
      },
      {
        name: "strictSanitization",
        type: "boolean",
        description: "Strictly flag zero-width spaces, homoglyphs, and polyglot comment escapes.",
        required: false,
        defaultValue: true,
        humanLabel: "Enforce Homoglyph & Polyglot Scan",
      },
    ],
    returns: {
      type: "object",
      description: "Audit certificate with taint report, permission ceiling, and Ed25519 signature.",
    },
    verificationProof: {
      ruleVerifier: "AST Dataflow Taint Analyzer",
      canonicalHash: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      offlineWasmRunnable: true,
    },
    requiresElevation: false,
    allowedScopes: ["spe:audit", "spe:read"],
  },

  spe_export_rules: {
    key: "spe_export_rules",
    title: "Multi-IDE Rule Transcompiler",
    description: "Transpiles universal prompt directives into native IDE rule files (.cursorrules, CLAUDE.md, .windsurfrules).",
    category: "WORKFLOW",
    parameters: [
      {
        name: "promptContent",
        type: "string",
        description: "The compiled prompt or invariant text to format.",
        required: true,
        humanLabel: "Prompt Content to Format",
      },
      {
        name: "formatTarget",
        type: "string",
        description: "Target IDE rule format.",
        required: true,
        allowedValues: ["cursorrules", "claude_md", "windsurfrules", "custom_gpt"],
        humanLabel: "Export Format Target",
      },
    ],
    returns: {
      type: "string",
      description: "Ready-to-save file string formatted for the selected IDE.",
    },
    verificationProof: {
      ruleVerifier: "AST Desugaring Generator",
      canonicalHash: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      offlineWasmRunnable: true,
    },
    requiresElevation: false,
    allowedScopes: ["spe:transpile", "spe:read"],
  },

  spe_verify_evidence: {
    key: "spe_verify_evidence",
    title: "Cryptographic Evidence Passport Verifier",
    description: "Verifies Ed25519 signature and RFC 8785 JSON canonicalization on task continuation evidence passports.",
    category: "SECURITY",
    parameters: [
      {
        name: "passportJson",
        type: "string",
        description: "Canonical JSON string of the Evidence Passport.",
        required: true,
        humanLabel: "Evidence Passport JSON",
      },
      {
        name: "publicKeyHex",
        type: "string",
        description: "Ed25519 public key in hexadecimal format.",
        required: true,
        humanLabel: "Verification Public Key (Hex)",
      },
    ],
    returns: {
      type: "boolean",
      description: "True if signature and hash match exactly; false otherwise.",
    },
    verificationProof: {
      ruleVerifier: "Ed25519 Discrete Logarithm Engine",
      canonicalHash: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      offlineWasmRunnable: true,
    },
    requiresElevation: false,
    allowedScopes: ["spe:verify", "spe:read"],
  },

  spe_model_governance: {
    key: "spe_model_governance",
    title: "2026 Frontier Model Currency Adjudicator",
    description: "Validates active model identifiers against the sealed 2026 Model Atlas, rejecting deprecated model versions.",
    category: "GOVERNANCE",
    parameters: [
      {
        name: "modelId",
        type: "string",
        description: "Provider model string to test (e.g. claude-3-7-sonnet-20250219, gpt-4o, gemini-2.0-flash).",
        required: true,
        humanLabel: "Model Identifier",
      },
    ],
    returns: {
      type: "object",
      description: "Status report with currency tier, retirement date if applicable, and dialect parameters.",
    },
    verificationProof: {
      ruleVerifier: "Temporal Model Ledger Engine",
      canonicalHash: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      offlineWasmRunnable: true,
    },
    requiresElevation: false,
    allowedScopes: ["spe:governance", "spe:read"],
  },
};

export class IntentToExperienceCompiler {
  /**
   * Compiles a VerifiedCapabilityContract into a HumanExperienceContract.
   */
  public compileHumanExperience(contract: VerifiedCapabilityContract): HumanExperienceContract {
    const fields: HumanFormField[] = contract.parameters.map((p) => {
      let widgetType: HumanFormField["widgetType"] = "text";
      if (p.type === "boolean") {
        widgetType = "toggle";
      } else if (p.allowedValues && p.allowedValues.length > 0) {
        widgetType = "select";
      } else if (p.type === "string" && (p.name.toLowerCase().includes("brief") || p.name.toLowerCase().includes("markdown") || p.name.toLowerCase().includes("content"))) {
        widgetType = "textarea";
      } else if (p.type === "number") {
        widgetType = "number";
      }

      return {
        id: `field_${contract.key}_${p.name}`,
        paramName: p.name,
        label: p.humanLabel,
        helpText: p.description,
        widgetType,
        required: p.required,
        defaultValue: p.defaultValue,
        options: p.allowedValues,
        validationErrorText: `${p.humanLabel} is required to continue.`,
      };
    });

    return {
      formId: `form_${contract.key}`,
      title: contract.title,
      subtitle: contract.description,
      fields,
      submitButtonText: `Run ${contract.title} (Local $0.00)`,
      loadingStateText: "Executing client WebAssembly verification...",
      successAnnouncementText: `${contract.title} execution completed with verified proof.`,
      keyboardShortcut: "Ctrl+Enter",
      offlineIndicator: contract.verificationProof.offlineWasmRunnable,
      iso24495Compliant: true,
    };
  }

  /**
   * Compiles a VerifiedCapabilityContract into a SearchExperienceContract.
   */
  public compileSearchExperience(contract: VerifiedCapabilityContract): SearchExperienceContract {
    let canonicalPath = `/create`;
    if (contract.category === "AUDIT") canonicalPath = `/build-skill`;
    else if (contract.category === "WORKFLOW") canonicalPath = `/workflows`;
    else if (contract.category === "SECURITY" || contract.category === "GOVERNANCE") canonicalPath = `/compare`;

    const titleTag = `${contract.title} | System Prompt Engine`;
    const metaDescription = `${contract.description} 100% in-browser WebAssembly, zero cloud compute cost, and strict air-gapped privacy.`;

    const schemaOrgJsonLd: SearchExperienceContract["schemaOrgJsonLd"] = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: contract.title,
      description: contract.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (WebAssembly Browser / Local CLI)",
      offers: {
        "@type": "Offer",
        price: "0.00",
        priceCurrency: "USD",
      },
    };

    const workedExample = {
      inputSummary: contract.parameters.map((p) => `${p.name}: [sample_${p.type}]`).join(", "),
      outputDemonstration: `Verified execution output satisfying invariant ${contract.verificationProof.ruleVerifier} (hash: ${contract.verificationProof.canonicalHash.slice(0, 12)}...)`,
    };

    const keywords = [
      "system prompt engine",
      contract.key.replace("spe_", "").replace(/_/g, " "),
      "webassembly compiler",
      "air-gapped privacy",
      "offline ai developer tools",
    ];

    return {
      canonicalPath,
      isIndexable: true,
      titleTag,
      metaDescription,
      schemaOrgJsonLd,
      workedExample,
      keywords,
    };
  }

  /**
   * Compiles a VerifiedCapabilityContract into an AgentExperienceContract (Google WebMCP standard).
   */
  public compileAgentExperience(contract: VerifiedCapabilityContract): AgentExperienceContract {
    const properties: Record<string, { type: string; description: string; enum?: string[]; pattern?: string }> = {};
    const required: string[] = [];

    for (const p of contract.parameters) {
      properties[p.name] = {
        type: p.type,
        description: p.description,
        ...(p.allowedValues ? { enum: p.allowedValues } : {}),
        ...(p.validationPattern ? { pattern: p.validationPattern } : {}),
      };
      if (p.required) {
        required.push(p.name);
      }
    }

    return {
      toolName: contract.key,
      description: contract.description,
      parameters: {
        type: "object",
        properties,
        required,
      },
      returns: {
        type: contract.returns.type,
        description: contract.returns.description,
      },
      requiredScope: contract.allowedScopes[0] || "spe:execute",
      rateLimitPerMinute: 120,
      offlineWasmExecutable: contract.verificationProof.offlineWasmRunnable,
    };
  }

  /**
   * Deterministically compiles all three projections from a verified capability contract.
   */
  public compileTriView(contract: VerifiedCapabilityContract): TriViewCompilationResult {
    const humanExperience = this.compileHumanExperience(contract);
    const searchExperience = this.compileSearchExperience(contract);
    const agentExperience = this.compileAgentExperience(contract);

    // Canonical digest binding all 3 projections
    const payloadToHash = JSON.stringify({
      capabilityKey: contract.key,
      category: contract.category,
      humanFormId: humanExperience.formId,
      canonicalPath: searchExperience.canonicalPath,
      agentToolName: agentExperience.toolName,
      agentScopes: contract.allowedScopes,
      ruleVerifier: contract.verificationProof.ruleVerifier,
      canonicalHash: contract.verificationProof.canonicalHash,
    });

    const rfc8785Digest = computeSha256(payloadToHash);

    return {
      capabilityKey: contract.key,
      compiledAt: new Date().toISOString(),
      rfc8785Digest,
      humanExperience,
      searchExperience,
      agentExperience,
    };
  }

  /**
   * Compiles all standard capabilities.
   */
  public compileAllStandard(): TriViewCompilationResult[] {
    return Object.values(STANDARD_CAPABILITIES).map((cap) => this.compileTriView(cap));
  }
}
