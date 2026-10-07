#!/usr/bin/env node
/**
 * SPE Ω — Zero-Dependency Developer CLI (npx spe)
 * 
 * Standalone, air-gapped developer CLI for AI Instruction Assurance:
 * - compile : PagedAttention KV-cache alignment & multi-model transcompilation
 * - verify  : First-Order Logic satisfiability, data contracts, and invariant coverage
 * - redteam : 1,024 combinatorial hostile attacks across 16 threat families
 * - test    : AST prompt mutation testing (PMS)
 * - diff    : "Git for Prompts" semantic regression and security diff
 * - seal    : Cryptographic RFC 8785 JSON proof receipt generation
 * - owasp   : Automated OWASP Top 10 for LLM compliance report generator
 * - codegen : Production SDK code generation (TypeScript / Python)
 */

import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

// 1. Self-bootstrap --experimental-strip-types if needed in Node.js
if (!process.execArgv.includes('--experimental-strip-types')) {
  const currentFile = fileURLToPath(import.meta.url);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', currentFile, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
  process.exit(result.status ?? 0);
}

// 2. Resolve Engine Modules
const scriptDir = dirname(fileURLToPath(import.meta.url));
// Support being run from repo root or inside apps/web
let engineDir = resolve(scriptDir, '../apps/web/src/engine');
if (!existsSync(resolve(engineDir, 'kvCachePageAligner.ts'))) {
  engineDir = resolve(scriptDir, '../src/engine');
}
if (!existsSync(resolve(engineDir, 'kvCachePageAligner.ts'))) {
  engineDir = resolve(scriptDir, 'src/engine');
}

// Dynamic Imports
const { alignPromptToKvPages } = await import(`${engineDir}/kvCachePageAligner.ts`);
const { transcompilePrompt } = await import(`${engineDir}/modelTranscompiler.ts`);
const { verifySymbolicConstraints } = await import(`${engineDir}/logicConstraintVerifier.ts`);
const { evaluatePromptDataQuality } = await import(`${engineDir}/dataQualityFramework.ts`);
const { runHostileGymOmega } = await import(`${engineDir}/hostileGymOmega.ts`);
const { evaluatePromptMutationSuite } = await import(`${engineDir}/promptMutationTesting.ts`);
const { auditOwaspCompliance } = await import(`${engineDir}/owaspComplianceEngine.ts`);
const { generateProductionSdkCode } = await import(`${engineDir}/sdkCodeGenerator.ts`);
const { computeSemanticPromptDiff } = await import(`${engineDir}/semanticPromptDiff.ts`);
const { evaluateCounterfactualTwin } = await import(`${engineDir}/counterfactualTwin.ts`);
const { generateProofReceipt, canonicalizeJson } = await import(`${engineDir}/proofReceipt.ts`);

// ANSI Color Helpers
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const gray = (s) => `\x1b[90m${s}\x1b[0m`;

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
${bold(cyan('SPE Ω — AI Instruction Assurance Compiler CLI (v1.4.1)'))}
${gray('Zero-Egress, Air-Gapped, Cryptographically Verifiable Prompt Assurance')}

${bold('USAGE:')}
  ${cyan('spe')} <command> [options]

${bold('COMMANDS:')}
  ${green('compile')} <file>       Compile & align prompt with KV-cache padding & dialect lowering
  ${green('verify')}  <file>       Verify First-Order Logic satisfiability & Great Expectations data contracts
  ${green('redteam')} <file>       Run Combinatorial Hostile Gym Ω (1,024 attacks)
  ${green('test')}    <file>       Run Prompt Mutation Testing (PMS)
  ${green('diff')}    <f1> <f2>    Semantic "Git for Prompts" regression & security diff
  ${green('seal')}    <file>       Generate cryptographic RFC 8785 JSON proof receipt
  ${green('owasp')}   <file>       Generate official OWASP Top 10 for LLM compliance audit
  ${green('codegen')} <file>       Generate production TypeScript (Vercel AI SDK) or Python SDK code

${bold('OPTIONS:')}
  --target <dialect>     Model dialect: claude-xml, openai-markdown, gemini-agent, cursor-rules, open-weights
  --align-kv <16|32>     KV-cache PagedAttention page boundary (default: 32)
  --out <file>           Output file path
  --strict               Fail with exit code 1 on any warning or contract violation
  --help, -h             Show this help menu
  --version, -v          Show SPE version

${bold('EXAMPLES:')}
  ${gray('$')} spe compile system.md --target claude-xml --align-kv 32 --out prompt.xml
  ${gray('$')} spe verify system.md --strict
  ${gray('$')} spe redteam system.md --attacks 1024
  ${gray('$')} spe diff system_v1.md system_v2.md
  ${gray('$')} spe owasp system.md --out OWASP_COMPLIANCE.md
  ${gray('$')} spe codegen system.md --target typescript-vercel --out prompt.ts
`);
}

function parseFlags(rawArgs) {
  const flags = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        flags[key] = rawArgs[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

if (!command || command === '--help' || command === '-h' || command === 'help') {
  printHelp();
  process.exit(0);
}

if (command === '--version' || command === '-v' || command === 'version') {
  console.log('spe v1.4.1 (SPE-OMEGA-CORE-CANONICAL)');
  process.exit(0);
}

const fileTarget = args[1];
const flags = parseFlags(args.slice(1));

try {
  switch (command) {
    case 'compile': {
      if (!fileTarget) {
        console.error(red('Error: Missing target prompt file. Usage: spe compile <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      const pageSize = flags['align-kv'] === '16' ? 16 : 32;
      const targetDialect = flags.target || 'claude-xml';

      console.log(cyan(`⚡ Compiling '${fileTarget}' [Target: ${targetDialect}, KV-Page: ${pageSize}]...`));
      
      const aligned = alignPromptToKvPages(rawPrompt, pageSize);
      const transcompiled = transcompilePrompt(aligned.alignedPromptText, targetDialect);

      console.log(green(`✓ Compilation successful!`));
      console.log(`  Original Tokens:   ${aligned.originalTokens}`);
      console.log(`  Aligned Tokens:    ${aligned.alignedTokens} (${aligned.pageCount} pages)`);
      console.log(`  Fragmentation:     ${(aligned.fragmentationIndex * 100).toFixed(1)}%`);
      console.log(`  TTFT Reduction:    ~${aligned.estimatedTtftSavingsPercent}% (${aligned.estimatedTtftSavingsMs}ms)`);

      if (flags.out) {
        writeFileSync(flags.out, transcompiled.compiledPrompt, 'utf8');
        console.log(green(`✓ Written compiled output to: ${flags.out}`));
      } else {
        console.log('\n--- COMPILED OUTPUT PREVIEW ---');
        console.log(transcompiled.compiledPrompt.slice(0, 500) + (transcompiled.compiledPrompt.length > 500 ? '\n... [truncated]' : ''));
      }
      break;
    }

    case 'verify': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe verify <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      console.log(cyan(`🔍 Verifying '${fileTarget}' against formal contracts & logic...`));

      const logic = verifySymbolicConstraints(rawPrompt);
      const dq = evaluatePromptDataQuality(rawPrompt, { isParadoxFree: logic.isParadoxFree });

      console.log(`\n${bold('FIRST-ORDER LOGIC STATUS:')} ${logic.isParadoxFree ? green('PROVABLY_SATISFIABLE') : red('CONTRADICTORY_DEADLOCK')}`);
      console.log(`  Propositions Extracted: ${logic.propositions.length}`);
      console.log(`  Satisfiability Ratio:   ${(logic.satisfiabilityRatio * 100).toFixed(1)}%`);
      
      if (!logic.isParadoxFree) {
        console.log(red('  Contradictions Caught:'));
        for (const c of logic.contradictions) {
          console.log(`    - ❌ ${c.conflictReason}`);
        }
      }

      console.log(`\n${bold('GREAT EXPECTATIONS DATA QUALITY:')} ${dq.qualityScore === 100 ? green('DATA_CONTRACT_HONORED (100%)') : yellow(`${dq.qualityScore}%`)}`);
      for (const exp of dq.expectations) {
        const icon = exp.status === 'PASSED' ? green('✓') : exp.status === 'WARNING' ? yellow('△') : red('✗');
        console.log(`  ${icon} [${exp.dimension}] ${exp.name}`);
      }

      const passed = logic.isParadoxFree && (flags.strict ? dq.qualityScore === 100 : dq.qualityScore >= 80);
      if (!passed) {
        console.error(red('\n❌ SPE Verification FAILED contract assertions.'));
        process.exit(1);
      }
      console.log(green('\n🎉 ALL FORMAL CONTRACTS VERIFIED SUCCESSFULLY!'));
      break;
    }

    case 'redteam': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe redteam <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      console.log(cyan(`⚔️ Running Hostile Gym Ω (1,024 attacks) against '${fileTarget}'...`));

      const gym = runHostileGymOmega(rawPrompt);
      const killRate = Math.round(gym.mutationKillRate * 100);

      console.log(`\n${bold('HOSTILE GYM RESULTS:')}`);
      console.log(`  Attacks Evaluated:   ${gym.totalAttacksEvaluated}`);
      console.log(`  Attacks Neutralized: ${gym.totalKilledCount}`);
      console.log(`  Mutation Kill Rate:  ${killRate >= 90 ? green(`${killRate}%`) : red(`${killRate}%`)}`);
      console.log(`  Metamorphic Passes:  ${gym.metamorphicPassCount}/${gym.metamorphicTotalCount}`);

      console.log(`\n${bold('ATTACK FAMILY BREAKDOWN:')}`);
      for (const fam of gym.familyBreakdown) {
        const pct = Math.round(fam.killRate * 100);
        const icon = pct === 100 ? green('✓') : pct >= 50 ? yellow('△') : red('✗');
        console.log(`  ${icon} ${fam.familyId} (${fam.familyName}): ${fam.killedCount}/${fam.totalVariants} (${pct}%)`);
      }

      if (killRate < 80) {
        console.error(red('\n❌ Security posture below threshold (< 80%).'));
        process.exit(1);
      }
      console.log(green('\n🛡️ PROMPT HARDENED AGAINST COMBINATORIAL HOSTILE ATTACKS!'));
      break;
    }

    case 'test': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe test <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      console.log(cyan(`🧬 Running Prompt Mutation Testing (PMS) on '${fileTarget}'...`));

      const pms = evaluatePromptMutationSuite(rawPrompt);
      console.log(`\n${bold('PROMPT MUTATION SCORECARD:')}`);
      console.log(`  Total Mutants Generated: ${pms.totalMutantsGenerated}`);
      console.log(`  Mutants Killed:          ${pms.killedMutants}`);
      console.log(`  Surviving Mutants:       ${pms.survivingMutants}`);
      console.log(`  Prompt Mutation Score:   ${pms.promptMutationScore >= 95 ? green(`${pms.promptMutationScore}%`) : yellow(`${pms.promptMutationScore}%`)}`);

      if (pms.promptMutationScore < 85) {
        console.error(red('\n❌ Prompt Mutation Score below qualification rigor (< 85%).'));
        process.exit(1);
      }
      console.log(green('\n🎉 TEST SUITE HIGH RIGOR CERTIFIED!'));
      break;
    }

    case 'diff': {
      const fileOld = args[1];
      const fileNew = args[2];
      if (!fileOld || !fileNew) {
        console.error(red('Error: Missing diff target files. Usage: spe diff <old.md> <new.md>'));
        process.exit(1);
      }
      const promptOld = readFileSync(fileOld, 'utf8');
      const promptNew = readFileSync(fileNew, 'utf8');

      console.log(cyan(`📊 Computing Semantic Prompt Diff: '${fileOld}' ➔ '${fileNew}'...`));
      const diff = computeSemanticPromptDiff(promptOld, promptNew);

      console.log('\n' + diff.summaryMarkdown);
      if (diff.verdict === 'BLOCKED_BY_REGRESSION') {
        console.error(red('\n🚨 PR MERGE BLOCKED: Critical security, logic, or data contract regression detected!'));
        process.exit(1);
      }
      console.log(green('\n✅ PR IS SAFE TO MERGE!'));
      break;
    }

    case 'seal': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe seal <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      console.log(cyan(`🔏 Sealing cryptographic RFC 8785 proof receipt for '${fileTarget}'...`));

      const twin = evaluateCounterfactualTwin(rawPrompt, rawPrompt);
      const gym = runHostileGymOmega(rawPrompt);
      const receipt = generateProofReceipt(rawPrompt, rawPrompt, twin, gym);

      const jsonStr = JSON.stringify(receipt, null, 2);
      const outPath = flags.out || 'proof-receipt.json';
      writeFileSync(outPath, jsonStr, 'utf8');

      console.log(green(`✓ Proof receipt sealed with JCS SHA-256:`));
      console.log(`  Digest:  ${bold(receipt.receiptDigest)}`);
      console.log(`  Saved:   ${outPath}`);
      break;
    }

    case 'owasp': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe owasp <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      console.log(cyan(`📋 Running OWASP GenAI Top 10 Compliance Audit for '${fileTarget}'...`));

      const report = auditOwaspCompliance(rawPrompt);
      const outPath = flags.out || 'OWASP_LLM_COMPLIANCE_REPORT.md';
      writeFileSync(outPath, report.markdownReport, 'utf8');

      console.log(`\n${bold('OWASP COMPLIANCE SUMMARY:')}`);
      console.log(`  Overall Status:   ${report.overallStatus === 'FULLY_COMPLIANT' ? green('FULLY_COMPLIANT') : yellow(report.overallStatus)}`);
      console.log(`  Compliance Score: ${report.complianceScore}%`);
      console.log(`  Report Generated: ${outPath}`);
      console.log(green('\n✓ Audit report successfully written!'));
      break;
    }

    case 'codegen': {
      if (!fileTarget) {
        console.error(red('Error: Missing prompt file. Usage: spe codegen <file>'));
        process.exit(1);
      }
      const rawPrompt = readFileSync(fileTarget, 'utf8');
      const targetLang = flags.target || 'typescript-vercel';
      const promptName = flags.name || 'SecureSystemPrompt';

      console.log(cyan(`🛠️ Compiling prompt to SDK Code: [Target: ${targetLang}]...`));

      const codeResult = generateProductionSdkCode(rawPrompt, {
        promptName,
        target: targetLang,
        pageSize: 32,
      });

      const outPath = flags.out || codeResult.filename;
      writeFileSync(outPath, codeResult.code, 'utf8');

      console.log(green(`✓ SDK code generated successfully:`));
      console.log(`  Target:       ${codeResult.target}`);
      console.log(`  File:         ${outPath}`);
      console.log(`  Dependencies: ${codeResult.dependencies.join(', ')}`);
      break;
    }

    default:
      console.error(red(`Error: Unknown command '${command}'. Run 'spe --help' for usage.`));
      process.exit(1);
  }
} catch (err) {
  console.error(red(`\nFatal SPE CLI Error: ${err.message}`));
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
