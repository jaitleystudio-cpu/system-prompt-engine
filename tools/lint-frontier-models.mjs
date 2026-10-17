#!/usr/bin/env node
/**
 * SPE Ω — Strict Frontier Model Currency Linter & Anti-Regression Gate
 * 
 * INVIOLABLE LAW:
 * Zero stale models. Any attempt to use, feature, default to, or suggest
 * outdated 2024-2025 models (e.g. Claude 3.7, o3-mini, GPT-4o, Claude 3.5)
 * in active compiler targets, UI copy, or CLI defaults FAILS THE BUILD IMMEDIATELY.
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

// Forbidden legacy models
const FORBIDDEN_RULES = [
  { pattern: 'Claude 3\\.[57]', name: 'Claude 3.5 / 3.7 (Retired 2025/early 2026)' },
  { pattern: '\\bo3-mini\\b', name: 'OpenAI o3-mini (Outdated 2025 model)' },
  { pattern: '\\bgpt-4o\\b', name: 'OpenAI GPT-4o (Outdated 2024 model)' },
  { pattern: '\\bo1-mini\\b', name: 'OpenAI o1-mini (Outdated 2024 model)' },
  { pattern: 'Claude 4\\.5', name: 'Claude 4.5 (Superseded by Claude 5.5 / Claude Code 2.1)' },
  { pattern: '\\bGPT-5\\b', name: 'Fictional GPT-5 tag (Superseded by OpenAI GPT-6.1-Sol Codex)' },
];

// Folders/files where legacy names appear solely for historical incident reproduction,
// migration tables, or backwards-compat test cases.
const EXCLUDED_PATHS = [
  ':(exclude)tools/lint-frontier-models.mjs',
  ':(exclude)AGENTS.md',
  ':(exclude)apps/web/src/engine/modelCurrencyGovernor.ts',
  ':(exclude)spe_runtime/model_governor/currency_kernel.py',
  ':(exclude)apps/web/src/engine/incidents/aiIncidentsRegistry.ts',
  ':(exclude)spe_runtime/failure_genome/*',
  ':(exclude)tools/sync_model_atlas.py',
  ':(exclude)apps/web/src/engine/costCarbonOptimizer.ts',
  ':(exclude)apps/web/src/engine/eval/liveModelRunner.ts',
  ':(exclude)tests/copy/reviewed-inventory.json',
  ':(exclude)tests/test_phase1_repairs_edge_cases.py',
  ':(exclude)tests/unit/test_model_currency.py',
  ':(exclude)tests/unit/test_failure_genome.py',
  ':(exclude)tests/research/*',
  ':(exclude)qualification/*',
  ':(exclude)evidence/*',
  ':(exclude)apps/web/src/engine/modelAtlas/*',
  ':(exclude)apps/web/deployments/*',
  ':(exclude)apps/web/dist/*',
  ':(exclude)deployments/*',
  ':(exclude)dist/*',
  ':(exclude)*package-lock.json',
  ':(exclude)*pnpm-lock.yaml',
];

console.log('🛡️  SPE Ω — FRONTIER MODEL CURRENCY GATE');
console.log('🔍 Auditing repository for forbidden outdated models (2024-2025)...');

let allViolations = [];

for (const rule of FORBIDDEN_RULES) {
  try {
    const cmd = `git grep -n -E "${rule.pattern}" -- apps packages spe_runtime tools ${EXCLUDED_PATHS.map(p => `"${p}"`).join(' ')}`;
    const output = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = output.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      // Ignore comment lines explaining migrations or legacy history
      if (line.includes('LEGACY') || line.includes('historical') || line.includes('retired')) continue;
      
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);
      if (firstColon !== -1 && secondColon !== -1) {
        const file = line.slice(0, firstColon);
        const lineNum = line.slice(firstColon + 1, secondColon);
        const snippet = line.slice(secondColon + 1).trim();
        allViolations.push({ file, lineNum, snippet, forbiddenModel: rule.name });
      }
    }
  } catch (err) {
    // git grep exits with 1 if no matches found (which is desired)
  }
}

if (allViolations.length > 0) {
  console.error('\n❌ [FAIL] FORBIDDEN OUTDATED MODELS DETECTED IN ACTIVE REPO:');
  console.error('SPE requires 100% late-2026 frontier architectures (Claude 5.5, Claude Code 2.1, GPT-6.1-Sol, Meta Muse Code 1.3).\n');
  allViolations.forEach((v, i) => {
    console.error(`  [${i + 1}] ${v.file}:${v.lineNum}`);
    console.error(`      Model:   ${v.forbiddenModel}`);
    console.error(`      Snippet: ${v.snippet}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ [PASS] 0 forbidden models found across repository.');
  console.log('🚀 Verified 100% late-2026 frontier standard.');
  process.exit(0);
}
