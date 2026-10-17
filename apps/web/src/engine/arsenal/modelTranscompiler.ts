/**
 * Model Transcompiler for SPE Universal Prompt Arsenal & Model Atlas
 * Translates canonical prompt assets into verified model-specific formats
 * with support for frontier reasoning instructions, capability-aware dialects,
 * and commercial monetization gating (viral watermark for free tier, clean for Pro).
 */

import type { ArsenalPromptAsset, ArsenalTargetPlatform } from "./arsenalSchema";
import { getModelById } from "../modelAtlas/modelAtlasService.ts";

export interface TranscompilerOptions {
  specificModelId?: string;
  tier?: string | null;
  isWatermarkSuppressed?: boolean;
  aspectRatio?: string;
  aperture?: string;
  iso?: string;
  wireframe?: boolean;
  shaderType?: string;
  cameraMotion?: string;
}

export function transcompilePromptForPlatform(
  asset: ArsenalPromptAsset,
  targetPlatform: ArsenalTargetPlatform,
  variableValues: Record<string, string> = {},
  options: TranscompilerOptions = {}
): string {
  // 1. Resolve specific model if provided
  const model = options.specificModelId ? getModelById(options.specificModelId) : undefined;
  const isPaidTier = options.tier === "pro" || options.tier === "team" || options.tier === "enterprise";

  // 2. Substitute variables into canonical or platform override
  let baseTemplate = asset.canonicalPrompt;
  const adapter = asset.modelAdapters?.[targetPlatform];

  if (adapter?.templateOverride) {
    baseTemplate = adapter.templateOverride;
  }

  let hydrated = baseTemplate;
  for (const v of asset.variables) {
    const val = variableValues[v.name]?.trim() || v.default || v.placeholder;
    hydrated = hydrated.replace(new RegExp(`\\{${v.name}\\}`, "g"), val);
  }

  // 3. Format specifically for target platform & model conventions
  let compiledOutput = "";

  switch (targetPlatform) {
    case "claude": {
      const modelLabel = model ? model.name : "Claude Sonnet 5.5 / Claude Code 2.1";
      const thinkingBlock = model?.capabilities.supportsThinking
        ? `\n<antml:reasoning_effort>max</antml:reasoning_effort>\n<thinking_guidance>\nYou have extended thinking enabled. Deeply analyze state transitions, architectural trade-offs, and boundary conditions. Formulate a rigorous internal execution graph, self-correct any fragile assumptions, and ensure zero unverified claims before synthesizing the production response.\n</thinking_guidance>\n`
        : "";

      compiledOutput = `<!-- SYSTEM PROMPT: ${asset.title} (${modelLabel}) -->
<purpose>
${asset.tagline}
</purpose>
${thinkingBlock}
<operational_constraints>
- Match ecosystem idiom, naming conventions, and comment density without adding obvious commentary.
- Report outcomes faithfully: If tests fail or constraints are violated, diagnose root causes rather than modifying tests.
${asset.constraints.map((c) => `- ${c}`).join("\n")}
</operational_constraints>

<instructions>
${hydrated}
</instructions>

<verification_criteria>
${asset.verificationCriteria.map((v) => `- ${v}`).join("\n")}
</verification_criteria>`;
      break;
    }

    case "chatgpt": {
      const modelLabel = model ? model.name : "OpenAI GPT-6.1-Sol Codex / Astra";
      const reasoningBlock = model?.capabilities.supportsThinking
        ? `\n## Reasoning Directive (o-Series / Deep Reasoning)\n- Reason carefully through all state mutations, security boundaries, and edge invariants.\n- Bias towards action: Complete the full reviewable deliverable autonomously without stalling for obvious steps.\n- Absolute Zero Slop: Eliminate phrases like "delve", "foster", "leverage", "it's worth noting", "Question? Answer.", "Bottom Line:". State intended actions directly without contrastive framing.\n`
        : "";

      compiledOutput = `# System Role: ${asset.title} (${modelLabel})

## Objective
${asset.tagline}
${reasoningBlock}
## Core Instructions
${hydrated}

## Negative Constraints (Non-Negotiable)
- Zero placeholder code (// TODO, pass) permitted in deliverables.
- Never modify tests to pass failing code; fix the root-cause implementation.
${asset.constraints.map((c) => `- ${c}`).join("\n")}

## Required Deliverable & Acceptance Verification
${asset.verificationCriteria.map((v) => `- [ ] ${v}`).join("\n")}`;
      break;
    }

    case "gemini": {
      const modelLabel = model ? model.name : "Gemini 2.0 Flash / Pro";
      const thinkingBlock = model?.capabilities.supportsThinking
        ? `// REASONING TRACE: Expose and verify causal steps prior to final synthesis.\n`
        : "";

      compiledOutput = `// [GEMINI SYSTEM DIRECTIVE: ${asset.title} (${modelLabel})]
// Scope: ${asset.domain} -> ${asset.subdomain}
${thinkingBlock}
### Task Directive:
${hydrated}

### Safety & Structural Invariants:
* INVARIANT: Zero hallucinated functions or untyped API returns.
${asset.constraints.map((c) => `* INVARIANT: ${c}`).join("\n")}

### Grounding & Acceptance:
${asset.verificationCriteria.map((v) => `* VERIFY: ${v}`).join("\n")}`;
      break;
    }

    case "grok": {
      const modelLabel = model ? model.name : "Grok 3 (Colossus DeepSearch)";
      const reasoningBlock = model?.capabilities.supportsThinking
        ? `REASONING: Execute rigorous factual cross-examination before responding. Falsify ungrounded assumptions.\n`
        : "";

      compiledOutput = `[GROK DIRECTIVE: ${modelLabel}]
TASK: ${asset.title}
OBJECTIVE: ${asset.tagline}
${reasoningBlock}
INSTRUCTIONS:
${hydrated}

CONSTRAINTS (ZERO FLUFF, STRICT FACTUALITY):
- Truth-maximizing execution: Discard speculative fluff and corporate marketing jargon.
${asset.constraints.map((c) => `! ${c}`).join("\n")}

VERIFICATION:
${asset.verificationCriteria.map((v) => `! PASS: ${v}`).join("\n")}`;
      break;
    }

    case "cursor": {
      let renderingNote = "";
      if (options.wireframe !== undefined || options.shaderType) {
        const mode = options.wireframe ? "Wireframe mesh" : "Solid surface";
        const shader = options.shaderType ? `with ${options.shaderType} shader` : "";
        renderingNote = `\n## Real-Time Graphics Rendering Config\n- Rendering Mode: ${mode} ${shader}\n`;
      }

      compiledOutput = `---
description: ${asset.title} - ${asset.subdomain} operational rules
globs: *
alwaysApply: true
---
<!-- Cursor Rules (.cursor/rules/spe-rules.mdc) & AGENTS.md Standard -->
# System Role: ${asset.title}
You are an expert ${asset.subdomain} engineer.

## Operational Standards (Cursor Engine & AGENTS.md)
- Match project idioms and conventions; avoid adding speculative architecture or needless commentary.
- NEVER create unnecessary files; prefer precision edits to existing files.
- Report outcomes faithfully: If tests fail or constraints are violated, diagnose root causes rather than modifying tests.
- Reference code cleanly using startLine:endLine:filepath format.
${renderingNote}
## Instructions
${hydrated}

## Critical Invariants
- MUST NOT: Introduce unverified third-party dependencies or hallucinated APIs.
${asset.constraints.map((c) => `- MUST NOT: ${c}`).join("\n")}

## Verification Criteria
${asset.verificationCriteria.map((v) => `- PASS: ${v}`).join("\n")}`;
      break;
    }

    case "midjourney": {
      let params = "--v 6.1 --stylize 250 --style raw";
      const ar = options.aspectRatio || adapter?.customParameters?.aspectRatio;
      if (ar) {
        params += ` --ar ${ar}`;
      }
      let cameraDetails = "";
      if (options.aperture || options.iso) {
        const optics = [
          options.aperture ? `aperture ${options.aperture}` : "",
          options.iso ? `ISO ${options.iso}` : "",
        ].filter(Boolean).join(", ");
        if (optics) cameraDetails = `, shot on 35mm prime lens, ${optics}`;
      }
      compiledOutput = `${hydrated.replace(/\n+/g, ", ").trim()}${cameraDetails} ${params}`;
      break;
    }

    case "flux": {
      let extra = "";
      if (options.aspectRatio) {
        extra += `, aspect ratio ${options.aspectRatio}`;
      }
      if (options.aperture || options.iso) {
        const optics = [
          options.aperture ? `f/${options.aperture.replace(/^f\/?/i, "")}` : "",
          options.iso ? `ISO ${options.iso}` : "",
        ].filter(Boolean).join(" ");
        if (optics) extra += `, camera optics: ${optics}`;
      }
      compiledOutput = `Photo prompt: ${hydrated.trim()}${extra} --quality ultra-sharp, photorealistic, 8k resolution, raw color capture`;
      break;
    }

    case "runway": {
      const motion = options.cameraMotion || "Smooth cinematic tracking motion, stable horizon.";
      const arNotice = options.aspectRatio ? `\nFRAME RATIO: ${options.aspectRatio}` : "";
      compiledOutput = `[Runway Gen-3 Alpha Video Motion Directive]
SCENE & ACTION: ${hydrated}${arNotice}
CAMERA MOVEMENT: ${motion}
TEMPORAL DYNAMICS: Physically realistic acceleration, coherent geometry over time.`;
      break;
    }

    case "suno": {
      compiledOutput = `[Style of Music: ${asset.subdomain}, high fidelity]
[Structure: Intro, Verse, Chorus, Bridge, Outro]

${hydrated}`;
      break;
    }

    case "local": {
      const modelName = model ? model.name : "DeepSeek-R1 / Qwen 2.5 Coder (Local Ollama)";
      compiledOutput = `<|im_start|>system
[LOCAL OPEN-WEIGHT COGNITIVE DIRECTIVE // OLLAMA & VLLM RUNTIME]
Target Model: ${modelName}
Protocol: ChatML Standard | Runtime: Local Offline Engine

### System Operational Constraints:
- Zero placeholder code permitted in implementation outputs.
- Never modify tests or assertions when code fails; fix the underlying root cause.
${asset.constraints.map((c) => `- ${c}`).join("\n")}
<|im_end|>
<|im_start|>user
${hydrated}

Verification Checklist:
${asset.verificationCriteria.map((v) => `- [ ] ${v}`).join("\n")}
<|im_end|>
<|im_start|>assistant
<think>
Deep invariant analysis: verifying boundary conditions, error propagation, and memory allocations prior to code synthesis.
</think>`;
      break;
    }

    default:
      compiledOutput = hydrated;
      break;
  }

  // 4. Commercial Monetization: Free users receive viral referral & sponsor watermark footer
  if (!isPaidTier && !options.isWatermarkSuppressed) {
    const watermarkFooter = `\n\n/* 
 * -------------------------------------------------------------
 * Generated via SPE Universal Prompt Engine (https://spe.dev)
 * Target Dialect: ${model ? model.name : targetPlatform} | License: Community Free
 * Upgrade to SPE Pro for 30,000-char context & clean unwatermarked exports:
 * https://spe.dev/pricing
 * -------------------------------------------------------------
 */`;
    return compiledOutput + watermarkFooter;
  }

  return compiledOutput;
}
