/**
 * SPE Ω — "Git for Prompts" Semantic Prompt Diff & Regression Engine
 * 
 * Provides semantic, security, logic, and efficiency diffing between prompt versions.
 * Emits actionable regression warnings and CI PR gates.
 */

import { verifySymbolicConstraints } from './logicConstraintVerifier.ts';
import { runHostileGymOmega } from './hostileGymOmega.ts';
import { evaluatePromptDataQuality } from './dataQualityFramework.ts';
import { alignPromptToKvPages } from './kvCachePageAligner.ts';

export interface SemanticDiffResult {
  intentSimilarity: number; // 0 - 100%
  intentDriftScore: number; // 0 - 100%
  
  security: {
    oldMkr: number;
    newMkr: number;
    deltaMkr: number; // e.g. -15% or +5%
    status: 'IMPROVED' | 'STABLE' | 'REGRESSED';
    newlyFailedAttacks: string[];
  };

  efficiency: {
    oldTokens: number;
    newTokens: number;
    tokenDelta: number;
    oldPages: number;
    newPages: number;
    oldFragmentation: number;
    newFragmentation: number;
  };

  logic: {
    oldSatisfiable: boolean;
    newSatisfiable: boolean;
    introducedContradictions: string[];
    isLogicRegressed: boolean;
  };

  dataQuality: {
    oldQualityScore: number;
    newQualityScore: number;
    deltaQuality: number;
    newlyFailedRules: string[];
  };

  verdict: 'MERGEABLE' | 'NEEDS_REVIEW' | 'BLOCKED_BY_REGRESSION';
  summaryMarkdown: string;
}

export function computeSemanticPromptDiff(oldPrompt: string, newPrompt: string): SemanticDiffResult {
  // 1. Intent Drift Calculation (Jaccard on normalized tokens)
  const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  const oldSet = tokenize(oldPrompt);
  const newSet = tokenize(newPrompt);
  
  let intersection = 0;
  for (const token of newSet) {
    if (oldSet.has(token)) intersection++;
  }
  const union = new Set([...oldSet, ...newSet]).size;
  const jaccard = union > 0 ? intersection / union : 1.0;
  const intentSimilarity = Math.round(jaccard * 100);
  const intentDriftScore = 100 - intentSimilarity;

  // 2. Security Regression via Hostile Gym
  const oldGym = runHostileGymOmega(oldPrompt);
  const newGym = runHostileGymOmega(newPrompt);
  const oldMkrPercent = Math.round(oldGym.mutationKillRate * 100);
  const newMkrPercent = Math.round(newGym.mutationKillRate * 100);
  const deltaMkr = newMkrPercent - oldMkrPercent;
  const securityStatus: 'IMPROVED' | 'STABLE' | 'REGRESSED' = 
    deltaMkr > 0 ? 'IMPROVED' : deltaMkr === 0 ? 'STABLE' : 'REGRESSED';

  const newlyFailedAttacks: string[] = [];
  if (deltaMkr < 0) {
    newlyFailedAttacks.push('Adversarial Boundary Weakening (MKR decreased)');
  }

  // 3. Efficiency Delta via KV-Cache Aligner
  const oldKv = alignPromptToKvPages(oldPrompt, 32);
  const newKv = alignPromptToKvPages(newPrompt, 32);
  const tokenDelta = newKv.alignedTokens - oldKv.alignedTokens;

  // 4. Logic Satisfiability
  const oldLogic = verifySymbolicConstraints(oldPrompt);
  const newLogic = verifySymbolicConstraints(newPrompt);
  const introducedContradictions: string[] = [];
  if (!newLogic.isParadoxFree && oldLogic.isParadoxFree) {
    introducedContradictions.push(...newLogic.contradictions.map(c => c.conflictReason));
  }
  const isLogicRegressed = !newLogic.isParadoxFree && oldLogic.isParadoxFree;

  // 5. Data Quality Impact
  const oldQuality = evaluatePromptDataQuality(oldPrompt);
  const newQuality = evaluatePromptDataQuality(newPrompt);
  const deltaQuality = newQuality.qualityScore - oldQuality.qualityScore;
  const newlyFailedRules: string[] = [];
  for (const exp of newQuality.expectations) {
    if (exp.status === 'FAILED') {
      const oldExp = oldQuality.expectations.find(e => e.ruleId === exp.ruleId);
      if (oldExp && oldExp.status === 'PASSED') {
        newlyFailedRules.push(`${exp.name} (${exp.dimension})`);
      }
    }
  }

  // Overall Mergeability Verdict
  let verdict: 'MERGEABLE' | 'NEEDS_REVIEW' | 'BLOCKED_BY_REGRESSION' = 'MERGEABLE';
  if (isLogicRegressed || newlyFailedRules.length > 0 || deltaMkr <= -10) {
    verdict = 'BLOCKED_BY_REGRESSION';
  } else if (deltaMkr < 0 || intentDriftScore > 40) {
    verdict = 'NEEDS_REVIEW';
  }

  // Generate Git PR Summary Markdown
  const summaryMarkdown = [
    '## 🔍 SPE Ω Semantic Prompt Diff Report',
    '',
    `**Overall PR Verdict:** \`${verdict}\`  `,
    `**Intent Similarity:** \`${intentSimilarity}%\` (Drift: \`${intentDriftScore}%\`)  `,
    '',
    '### 📊 Regression Delta Summary',
    '| Metric | Previous Version | New Version | Delta | Status |',
    '|---|---|---|---|---|',
    `| **Security (MKR)** | ${oldMkrPercent}% | ${newMkrPercent}% | ${deltaMkr >= 0 ? '+' : ''}${deltaMkr}% | ${securityStatus === 'REGRESSED' ? '🔴 REGRESSED' : securityStatus === 'IMPROVED' ? '🟢 IMPROVED' : '⚪ STABLE'} |`,
    `| **Data Quality Score** | ${oldQuality.qualityScore}% | ${newQuality.qualityScore}% | ${deltaQuality >= 0 ? '+' : ''}${deltaQuality}% | ${deltaQuality < 0 ? '🔴 DEGRADED' : '🟢 HEALTHY'} |`,
    `| **FOL Satisfiability** | ${oldLogic.isParadoxFree ? 'Sound' : 'Contradictory'} | ${newLogic.isParadoxFree ? 'Sound' : 'Contradictory'} | — | ${isLogicRegressed ? '🔴 PARADOX INTRODUCED' : '🟢 SOUND'} |`,
    `| **Tokens (Aligned)** | ${oldKv.alignedTokens} | ${newKv.alignedTokens} | ${tokenDelta >= 0 ? '+' : ''}${tokenDelta} tokens | ⚪ |`,
    `| **KV Cache Fragmentation** | ${(oldKv.fragmentationIndex * 100).toFixed(1)}% | ${(newKv.fragmentationIndex * 100).toFixed(1)}% | ${((newKv.fragmentationIndex - oldKv.fragmentationIndex) * 100).toFixed(1)}% | ${newKv.fragmentationIndex === 0 ? '🟢 OPTIMAL (0.00)' : '🟡 UNALIGNED'} |`,
    '',
    ...(newlyFailedRules.length > 0 ? [
      '### ⚠️ Newly Violated Data Quality Contracts:',
      ...newlyFailedRules.map(r => `- ❌ ${r}`),
      ''
    ] : []),
    ...(introducedContradictions.length > 0 ? [
      '### 🚨 Introduced First-Order Logic Contradictions:',
      ...introducedContradictions.map(c => `- ❌ ${c}`),
      ''
    ] : [])
  ].join('\n');

  return {
    intentSimilarity,
    intentDriftScore,
    security: {
      oldMkr: oldMkrPercent,
      newMkr: newMkrPercent,
      deltaMkr,
      status: securityStatus,
      newlyFailedAttacks
    },
    efficiency: {
      oldTokens: oldKv.originalTokens,
      newTokens: newKv.originalTokens,
      tokenDelta,
      oldPages: oldKv.pageCount,
      newPages: newKv.pageCount,
      oldFragmentation: oldKv.fragmentationIndex,
      newFragmentation: newKv.fragmentationIndex
    },
    logic: {
      oldSatisfiable: oldLogic.isParadoxFree,
      newSatisfiable: newLogic.isParadoxFree,
      introducedContradictions,
      isLogicRegressed
    },
    dataQuality: {
      oldQualityScore: oldQuality.qualityScore,
      newQualityScore: newQuality.qualityScore,
      deltaQuality,
      newlyFailedRules
    },
    verdict,
    summaryMarkdown
  };
}
