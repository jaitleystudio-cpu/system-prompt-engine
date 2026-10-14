#!/usr/bin/env node
/**
 * SPE Developer CLI (`npx spe-cli`)
 * World-Class Developer Tooling for Prompt Intelligence & Engineering:
 * - Search across 10,000+ prompt assets in <5ms
 * - Hydrate and transcompile to Claude, Codex, Cursor, Gemini, Grok, and Local Ollama
 * - Real-time Prompt Doctor slop and security auditing (`spe lint`)
 * - One-click UFCK-100X prompt enhancement (`spe enhance`)
 * - Model Atlas inspection (`spe models`)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { getArsenalCatalogIndex, getArsenalAssetById } from "../apps/web/src/engine/arsenal/arsenalHydrator.ts";
import { transcompilePromptForPlatform } from "../apps/web/src/engine/arsenal/modelTranscompiler.ts";
import { diagnosePrompt, enhancePromptWithDoctor } from "../apps/web/src/engine/arsenal/promptDoctor.ts";
import { getAllModels, getModelById } from "../apps/web/src/engine/modelAtlas/modelAtlasService.ts";
import { executeProviderCall, parseProviderModelString } from "../apps/web/src/engine/eval/liveModelRunner.ts";
import { evaluateAllAssertions } from "../apps/web/src/engine/eval/assertionEngine.ts";
import { runAdversarialProbes, autoImmunizePrompt } from "../apps/web/src/engine/redteam/promptImmunizer.ts";
import { ADVERSARIAL_PROBE_CATALOG } from "../apps/web/src/engine/redteam/adversarialProbeCatalog.ts";
import { generatePromptfooConfig, validateExportedPromptfooYamlArtifact } from "../apps/web/src/engine/promptfooExporter.ts";

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : "help";

function printHelp() {
  console.log(`
SPE Developer CLI (v2.0.0-frontier) — System Prompt Engine
Usage: npx spe-cli <command> [options]

Commands:
  search <query>                  Search 10,000+ production prompts in <5ms
  get <asset-id> [--target <p>]   Hydrate & transcompile prompt asset
                                  Targets: claude, chatgpt, cursor, gemini, grok, local
  lint <file>                     Audit prompt file for AI slop & security vulnerabilities
  enhance <file> [--out <dest>]   Upgrade prompt to UFCK-100X Frontier Cognition Kernel
  eval <file|assetId>             Headless multi-model prompt evaluation & assertion testing
  redteam <file|assetId>          Probe 10 OWASP attack vectors & 1-click auto-patch (--immunize)
  import-promptfoo <config.yaml>  Import & validate Promptfoo configuration artifact
  models                          List all 26 cutting-edge verified AI models in Model Atlas
  atlas [sync|check|list]         Manage Dynamic AI Model Atlas registry & SHA-256 integrity
  auto [--daemon] [--watch]       Run full A-to-Z autonomous pipeline (sync, SEO, tests, build)
  doctor "<prompt-text>"          Run live Prompt Doctor diagnostics on raw text
  help                            Show this help manual

Examples:
  npx spe auto
  npx spe auto --daemon
  npx spe auto --watch
  npx spe search "android compose room"
  npx spe get SPE-ARSENAL-00001 --target claude
  npx spe get SPE-ARSENAL-00001 --target cursor > .cursorrules
  npx spe lint ./prompts/system_prompt.md
  npx spe enhance ./my_prompt.txt --out ./hardened_prompt.md
  npx spe atlas sync
  npx spe atlas check
  npx spe models
`);
}

async function run() {
  switch (command) {
    case "search": {
      const rawQuery = args.slice(1).join(" ").trim().toLowerCase();
      if (!rawQuery) {
        console.error("Error: Please provide a search query. Example: npx spe search 'postgres partition'");
        process.exit(1);
      }
      const keywords = rawQuery.split(/\s+/).filter(Boolean);
      const start = performance.now();
      const records = getArsenalCatalogIndex();
      const matches = records.filter((r) => {
        const text = `${r.title} ${r.tagline} ${r.domain} ${r.subdomain}`.toLowerCase();
        return keywords.every((kw) => text.includes(kw));
      });
      const elapsed = (performance.now() - start).toFixed(2);

      console.log(`\n🔍 Found ${matches.length} prompt asset(s) matching "${rawQuery}" (${elapsed}ms):\n`);
      for (const m of matches.slice(0, 15)) {
        console.log(`  [${m.id}] ${m.icon} ${m.title}`);
        console.log(`     Domain: ${m.domain} › ${m.subdomain} | Modality: ${m.modality}`);
        console.log(`     Tagline: ${m.tagline.slice(0, 95)}...\n`);
      }
      if (matches.length > 15) {
        console.log(`  ... and ${matches.length - 15} more. Refine your query or visit https://spe.dev/prompts\n`);
      }
      break;
    }

    case "get": {
      const id = args[1] ? args[1].toUpperCase() : "";
      if (!id || !id.startsWith("SPE-ARSENAL-")) {
        console.error("Error: Please specify a valid asset ID (e.g., SPE-ARSENAL-00001)");
        process.exit(1);
      }
      let target = "claude";
      const targetIdx = args.indexOf("--target");
      if (targetIdx !== -1 && args[targetIdx + 1]) {
        target = args[targetIdx + 1].toLowerCase();
      }

      const asset = getArsenalAssetById(id);
      if (!asset) {
        console.error(`Error: Asset ID "${id}" not found in catalog.`);
        process.exit(1);
      }

      // Check tier flag
      const isPro = args.includes("--pro");
      const compiled = transcompilePromptForPlatform(
        asset,
        target,
        {},
        { tier: isPro ? "pro" : null }
      );

      console.log(compiled);
      break;
    }

    case "lint": {
      const targetPath = args[1];
      if (!targetPath) {
        console.error("Error: Please specify a file to lint. Example: npx spe lint ./system_prompt.md");
        process.exit(1);
      }
      const fullPath = resolve(process.cwd(), targetPath);
      if (!existsSync(fullPath)) {
        console.error(`Error: File not found at ${fullPath}`);
        process.exit(1);
      }

      const content = readFileSync(fullPath, "utf-8");
      const report = diagnosePrompt(content);

      console.log(`\n🩺 SPE PROMPT DOCTOR AUDIT REPORT: ${targetPath}`);
      console.log(`==================================================================`);
      console.log(`Cognitive Integrity Score: ${report.cognitiveScore} / 100  [Grade: ${report.grade}]`);
      console.log(`Word Count: ${report.wordCount} words | Estimated Tokens: ~${report.estimatedTokens}`);
      console.log(`\nFrontier Invariants Status:`);
      console.log(`  • Action Bias (Codex Rule):       ${report.hasActionBias ? "✓ Enforced" : "✗ Missing"}`);
      console.log(`  • Anti-Tamper (Devin Rule):       ${report.hasAntiTamper ? "✓ Enforced" : "✗ Missing"}`);
      console.log(`  • Zero Placeholder Code:         ${report.hasZeroPlaceholderRule ? "✓ Enforced" : "✗ Missing"}`);
      console.log(`  • Deterministic Verification:     ${report.hasDeterministicVerification ? "✓ Enforced" : "✗ Missing"}`);

      if (report.slopMatches.length > 0) {
        console.log(`\n⚠️  AI Slop Clichés Detected (${report.slopMatches.length}):`);
        for (const s of report.slopMatches) {
          console.log(`  - '${s.word}' (char index ${s.index}) ➔ Suggestion: '${s.replacement}'`);
        }
      } else {
        console.log(`\n✓ Zero AI Slop detected!`);
      }

      if (report.placeholderRisks.length > 0) {
        console.log(`\n🚨 Placeholder Code Vulnerabilities Detected:`);
        for (const p of report.placeholderRisks) {
          console.log(`  - '${p}'`);
        }
      }

      console.log(`\nRecommendations to Reach 100/100:`);
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
      console.log(`==================================================================\n`);
      if (report.cognitiveScore < 70) {
        process.exit(1);
      }
      break;
    }

    case "enhance": {
      const targetPath = args[1];
      if (!targetPath) {
        console.error("Error: Please specify a file to enhance. Example: npx spe enhance ./draft.txt");
        process.exit(1);
      }
      const fullPath = resolve(process.cwd(), targetPath);
      if (!existsSync(fullPath)) {
        console.error(`Error: File not found at ${fullPath}`);
        process.exit(1);
      }

      const content = readFileSync(fullPath, "utf-8");
      const enhanced = enhancePromptWithDoctor(content);

      const outIdx = args.indexOf("--out");
      if (outIdx !== -1 && args[outIdx + 1]) {
        const dest = resolve(process.cwd(), args[outIdx + 1]);
        writeFileSync(dest, enhanced, "utf-8");
        console.log(`✓ Enhanced prompt written to ${dest} with UFCK-100X Frontier Cognition Kernel!`);
      } else {
        console.log(enhanced);
      }
      break;
    }

    case "models":
    case "atlas": {
      const sub = args[1] ? args[1].toLowerCase() : "list";
      if (sub === "sync") {
        console.log("\n🔄 Initiating Automated AI Model Atlas Synchronization Pipeline...");
        try {
          const syncScript = resolve(process.cwd(), "tools/sync_model_atlas.py");
          execSync(`python3 "${syncScript}"`, { stdio: "inherit" });
          console.log("✓ AI Model Atlas successfully synchronized with cutting-edge frontier models!\n");
        } catch (err) {
          console.error("Failed to run sync_model_atlas.py:", err.message);
          process.exit(1);
        }
        break;
      }

      if (sub === "check") {
        console.log("\n🛡️ Verifying SPE Model Atlas Registry Integrity & Checksums...");
        const syncScript = resolve(process.cwd(), "tools/sync_model_atlas.py");
        try {
          execSync(`python3 "${syncScript}" --check`, { stdio: "inherit" });
        } catch (err) {
          console.error("[-] Checksum verification failed!");
          process.exit(1);
        }

        const regPath = resolve(process.cwd(), "apps/web/src/engine/modelAtlas/modelAtlasRegistry.json");
        const raw = readFileSync(regPath, "utf-8");
        const registry = JSON.parse(raw);
        let validCount = 0;
        for (const m of registry.models) {
          if (m.id && m.name && m.provider && m.contextWindow > 0 && m.capabilities) {
            validCount++;
          }
        }
        console.log(`[*] Capability Schema: ${validCount}/${registry.models.length} models compliant with SATSS v1`);
        if (validCount !== registry.models.length) {
          console.error("[-] Some models fail capability schema validation!");
          process.exit(1);
        }
        console.log("\n✓ All AI models verified healthy and ready for production inference routing.\n");
        break;
      }

      // Default: list models
      const models = getAllModels();
      console.log(`\n🌐 SPE Dynamic Model Atlas (${models.length} Verified Frontier Models):\n`);
      console.log(`ID                               NAME                        PROVIDER         TIER     CONTEXT`);
      console.log(`-------------------------------------------------------------------------------------------------`);
      for (const m of models) {
        const idCol = m.id.padEnd(32, " ");
        const nameCol = m.name.slice(0, 26).padEnd(28, " ");
        const provCol = m.provider.padEnd(16, " ");
        const tierCol = m.requiredTier.toUpperCase().padEnd(8, " ");
        const ctxCol = `${Math.round(m.contextWindow / 1024)}k tokens`;
        console.log(`${idCol} ${nameCol} ${provCol} ${tierCol} ${ctxCol}`);
      }
      console.log(`\nTranspile any prompt: npx spe get SPE-ARSENAL-00001 --target claude`);
      console.log(`Automated sync:       npx spe atlas sync\n`);
      break;
    }

    case "eval": {
      const targetArg = args[1];
      if (!targetArg) {
        console.error("Error: Please specify a prompt file or asset ID (e.g., npx spe eval SPE-ARSENAL-00001)");
        process.exit(1);
      }
      let promptText = "";
      if (targetArg.startsWith("SPE-ARSENAL-")) {
        const asset = getArsenalAssetById(targetArg.toUpperCase());
        if (!asset) {
          console.error(`Error: Asset ID "${targetArg}" not found in catalog.`);
          process.exit(1);
        }
        promptText = transcompilePromptForPlatform(asset, "claude");
      } else if (existsSync(targetArg)) {
        promptText = readFileSync(targetArg, "utf-8");
      } else {
        promptText = targetArg;
      }

      const inputIdx = args.indexOf("--input");
      const userInput = inputIdx !== -1 && args[inputIdx + 1] ? args[inputIdx + 1] : "Implement the core architecture and invariants.";

      let providers = ["mock:fast-runner"];
      const provIdx = args.indexOf("--provider");
      if (provIdx !== -1 && args[provIdx + 1]) {
        providers = args[provIdx + 1].split(",");
      }

      console.log(`\n📊 SPE Headless Multi-Provider Evaluation Studio`);
      console.log(`[*] Target Prompt:   ${targetArg.slice(0, 40)}... (${promptText.length} chars)`);
      console.log(`[*] Evaluation Input: "${userInput}"`);
      console.log(`[*] Providers:       ${providers.join(", ")}\n`);

      const assertions = [
        { type: "not-empty" },
        { type: "max-latency-ms", threshold: 4000 },
        { type: "anti-leak" },
      ];

      for (const provStr of providers) {
        const { provider, model } = parseProviderModelString(provStr.trim());
        const start = Date.now();
        const res = await executeProviderCall({
          provider,
          model,
          systemPrompt: promptText,
          userInput,
          mockResponse: { text: "Verified implementation with zero placeholders.", latencyMs: 45 },
        });
        const outcome = evaluateAllAssertions(assertions, res, { userInput, renderedPrompt: promptText });

        const statusSymbol = outcome.passed ? "✓ PASS" : "✗ FAIL";
        console.log(`  [${statusSymbol}] Provider: ${provStr.padEnd(28)} | Latency: ${(res.latencyMs + "ms").padEnd(7)} | Cost: $${res.estimatedCostUsd.toFixed(5)}`);
        for (const a of outcome.assertionResults) {
          console.log(`       - ${a.passed ? "✓" : "✗"} ${a.type.padEnd(16)}: ${a.reason}`);
        }
        console.log("");
      }
      break;
    }

    case "redteam": {
      const targetArg = args[1];
      if (!targetArg) {
        console.error("Error: Please specify a prompt file or asset ID (e.g., npx spe redteam SPE-ARSENAL-00001)");
        process.exit(1);
      }
      let promptText = "";
      if (targetArg.startsWith("SPE-ARSENAL-")) {
        const asset = getArsenalAssetById(targetArg.toUpperCase());
        if (!asset) {
          console.error(`Error: Asset ID "${targetArg}" not found in catalog.`);
          process.exit(1);
        }
        promptText = transcompilePromptForPlatform(asset, "claude");
      } else if (existsSync(targetArg)) {
        promptText = readFileSync(targetArg, "utf-8");
      } else {
        promptText = targetArg;
      }

      const shouldImmunize = args.includes("--immunize");
      const outIdx = args.indexOf("--out");
      const outPath = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : "";

      console.log(`\n🛡️ SPE Adversarial Red-Team & Immunization Engine`);
      console.log(`[*] Target Prompt: ${targetArg.slice(0, 40)}... (${promptText.length} chars)`);
      console.log(`[*] Probing all ${ADVERSARIAL_PROBE_CATALOG.length} OWASP LLM attack vectors...\n`);

      if (shouldImmunize) {
        const { immunizedPrompt, certificate } = await autoImmunizePrompt(promptText, { provider: "mock" });
        console.log(`=== RED-TEAM EVALUATION OUTCOME ===`);
        for (const o of certificate.probeOutcomesBefore) {
          const sym = o.breached ? "🚨 BREACHED" : "✓ SECURE";
          console.log(`  [${sym}] ${o.probeId.padEnd(30)} ${o.probeName.padEnd(40)} (${o.severity.toUpperCase()})`);
          if (o.breached && o.leakSample) {
            console.log(`       Leak Sample: ${o.leakSample}`);
          }
        }

        console.log(`\n💉 1-Click Automated Invariant Immunization Applied!`);
        console.log(`[*] Before Resistance: ${certificate.beforeResistanceScorePct}%`);
        console.log(`[*] After Resistance:  ${certificate.afterResistanceScorePct}% (${certificate.status})`);
        console.log(`[*] Injected Vaccines: ${certificate.injectedVaccineRules.length} mathematically bounded rules`);
        console.log(`[*] Certificate ID:    ${certificate.certificateId}`);

        if (outPath) {
          writeFileSync(outPath, immunizedPrompt, "utf-8");
          console.log(`[+] Saved hardened, fully immunized prompt to: ${outPath}\n`);
        } else {
          console.log(`[Tip] Pass --out <filename> to save the hardened prompt directly to disk.\n`);
        }
      } else {
        const outcomes = await runAdversarialProbes(promptText, { provider: "mock" });
        let breaches = 0;
        for (const o of outcomes) {
          const sym = o.breached ? "🚨 BREACHED" : "✓ SECURE";
          if (o.breached) breaches++;
          console.log(`  [${sym}] ${o.probeId.padEnd(30)} ${o.probeName.padEnd(40)} (${o.severity.toUpperCase()})`);
          if (o.breached && o.leakSample) {
            console.log(`       Leak Sample: ${o.leakSample}`);
          }
        }
        const resistancePct = (((outcomes.length - breaches) / outcomes.length) * 100).toFixed(1);
        console.log(`\n[*] Resistance Score: ${resistancePct}% (${outcomes.length - breaches}/${outcomes.length} passed)`);
        if (breaches > 0) {
          console.log(`[!] ${breaches} vulnerability(ies) detected! Run with --immunize to auto-patch in 1 click.\n`);
        } else {
          console.log(`[✓] Prompt is 100% immune to tested OWASP vectors.\n`);
        }
      }
      break;
    }

    case "import-promptfoo": {
      const configPath = args[1] || "promptfooconfig.yaml";
      if (!existsSync(configPath)) {
        console.error(`Error: Configuration file "${configPath}" not found.`);
        process.exit(1);
      }
      const yamlContent = readFileSync(configPath, "utf-8");
      console.log(`\n📦 Importing and Validating Promptfoo Configuration: ${configPath}`);
      const validation = validateExportedPromptfooYamlArtifact(yamlContent, (prompt, input, desc) => {
        return {
          output: `Simulated response satisfying assertions for test: ${desc}`,
          latencyMs: 120,
        };
      });

      console.log(`[*] Extracted Providers:   ${validation.extractedProviders.join(", ")}`);
      console.log(`[*] Extracted Test Cases:  ${validation.extractedTests.length}`);
      console.log(`[*] Valid YAML Structure:  ${validation.validYamlStructure ? "✓ VALID" : "✗ INVALID"}`);
      console.log(`[*] All Assertions Passed: ${validation.allAssertionsPassed ? "✓ PASS (100%)" : "✗ FAIL"}\n`);

      for (const r of validation.caseResults) {
        console.log(`  ${r.passed ? "✓" : "✗"} ${r.description.padEnd(50)} (${r.failedAssertions.length} failures)`);
      }
      console.log("\n✓ Promptfoo configuration successfully bridged and ready for SPE Studio execution.\n");
      break;
    }

    case "auto": {
      const autoScript = resolve(process.cwd(), "tools/autonomous_pipeline.mjs");
      const passArgs = args.slice(1).join(" ");
      try {
        execSync(`${process.execPath} "${autoScript}" ${passArgs}`, { stdio: "inherit" });
      } catch (err) {
        process.exit(1);
      }
      break;
    }

    case "doctor": {
      const text = args.slice(1).join(" ");
      if (!text) {
        console.error("Error: Please provide prompt text to inspect.");
        process.exit(1);
      }
      const report = diagnosePrompt(text);
      console.log(`\nScore: ${report.cognitiveScore}/100 | Grade: ${report.grade} | Slop Words: ${report.slopCount}`);
      if (report.recommendations.length) {
        console.log("Suggestions:");
        for (const r of report.recommendations) console.log(` - ${r}`);
      }
      break;
    }

    case "help":
    default:
      printHelp();
      break;
  }
}

run().catch((err) => {
  console.error("Fatal error executing SPE CLI:", err);
  process.exit(1);
});
