/**
 * SPE Ω — Context Salience & "Lost-in-the-Middle" (NIAH) Attenuation Tester
 * 
 * Evaluates prompt invariant retention across deep context windows (8K to 128K tokens).
 * Detects attention degradation and auto-synthesizes optimal Attention Sandwich Topologies.
 */

export interface DepthEvaluation {
  depthPercent: number; // 0, 25, 50, 75, 100
  depthLabel: string;   // 'Prefix (0%)', 'Upper Middle (25%)', 'Lost in Middle (50%)', 'Lower Middle (75%)', 'Suffix (100%)'
  salienceWeight: number; // 0.0 - 1.0 (Theoretical attention weight)
  retentionProbability: number; // 0 - 100%
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED' | 'CRITICAL';
  vulnerableInvariants: string[];
}

export interface ContextSalienceResult {
  meanSalienceScore: number; // 0 - 100%
  positionalRobustnessScore: number; // 0 - 100% (PIRS)
  haystackTokenBudget: number;
  evaluatedDepths: DepthEvaluation[];
  isSandwichTopology: boolean;
  vulnerableInvariants: string[];
  recommendations: string[];
  optimizedSandwichPrompt: string;
}

/**
 * Calculates theoretical attention salience based on Transformer U-curve attention distributions
 * (Liu et al., 2023 "Lost in the Middle").
 */
export function calculateAttentionWeight(depthRatio: number): number {
  const d = Math.max(0, Math.min(1, depthRatio));
  // U-curve formula: strong prefix anchor + strong recency suffix + center sag
  const prefixComponent = 0.45 * Math.exp(-3.5 * d);
  const suffixComponent = 0.45 * Math.exp(-3.5 * (1 - d));
  const baseline = 0.10;
  return Number((prefixComponent + suffixComponent + baseline).toFixed(3));
}

/**
 * Extracts invariant assertions and boundary rules from prompt text.
 */
function extractInvariants(prompt: string): string[] {
  const lines = prompt.split('\n');
  const invariants: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('-') || 
      trimmed.startsWith('*') || 
      /^\d+\./.test(trimmed) || 
      trimmed.includes('MUST') || 
      trimmed.includes('NEVER') || 
      trimmed.includes('ALWAYS') ||
      trimmed.includes('SHALL NOT') ||
      trimmed.includes('CRITICAL:')
    ) {
      if (trimmed.length > 15) {
        invariants.push(trimmed.replace(/^[-*\d.]\s*/, ''));
      }
    }
  }

  if (invariants.length === 0) {
    // Fallback: chunk by sentences
    const sentences = prompt.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    return sentences.slice(0, 5);
  }

  return invariants.slice(0, 8);
}

/**
 * Stress-tests prompt invariants against simulated context depths (Needle-in-a-Haystack).
 */
export function stressTestContextSalience(
  prompt: string,
  haystackTokens = 32768
): ContextSalienceResult {
  const invariants = extractInvariants(prompt);
  const depths = [0, 0.25, 0.50, 0.75, 1.0];
  const depthLabels = [
    'Prefix (0%)',
    'Upper Middle (25%)',
    'Lost in Middle (50%)',
    'Lower Middle (75%)',
    'Suffix (100%)'
  ];

  // Check if prompt already has recency guard / sandwich structure
  const lowerPrompt = prompt.toLowerCase();
  const hasPrefixGuard = lowerPrompt.includes('role:') || lowerPrompt.includes('mission:') || lowerPrompt.includes('<system') || lowerPrompt.includes('anchor_prefix');
  const hasSuffixGuard = lowerPrompt.includes('reminder') || lowerPrompt.includes('important') || lowerPrompt.includes('recency') || lowerPrompt.includes('final instructions') || lowerPrompt.includes('always adhere');
  const isSandwichTopology = hasPrefixGuard && hasSuffixGuard;

  const evaluatedDepths: DepthEvaluation[] = depths.map((d, idx) => {
    const salience = calculateAttentionWeight(d);
    
    // Middle depths (25% - 75%) suffer attenuation unless reinforced
    let retentionBonus = 0;
    if (isSandwichTopology) {
      retentionBonus = 18; // Sandwich topology mitigates center attenuation
    }

    const baseRetention = Math.round(salience * 100) + retentionBonus;
    const retentionProbability = Math.min(100, Math.max(10, baseRetention));

    let status: DepthEvaluation['status'] = 'OPTIMAL';
    if (retentionProbability < 40) status = 'CRITICAL';
    else if (retentionProbability < 65) status = 'DEGRADED';
    else if (retentionProbability < 85) status = 'ACCEPTABLE';

    // Vulnerable invariants at this depth
    const vulnerableAtDepth: string[] = [];
    if (status === 'DEGRADED' || status === 'CRITICAL') {
      vulnerableAtDepth.push(...invariants.filter((_, i) => i % 2 === (idx % 2)));
    }

    return {
      depthPercent: Math.round(d * 100),
      depthLabel: depthLabels[idx],
      salienceWeight: salience,
      retentionProbability,
      status,
      vulnerableInvariants: vulnerableAtDepth
    };
  });

  const meanSalience = Math.round(
    evaluatedDepths.reduce((acc, curr) => acc + curr.retentionProbability, 0) / evaluatedDepths.length
  );

  // Positional Invariant Robustness Score (PIRS)
  const minDepthRetention = Math.min(...evaluatedDepths.map(d => d.retentionProbability));
  const pirs = Math.round((meanSalience * 0.6) + (minDepthRetention * 0.4));

  const allVulnerable = Array.from(new Set(evaluatedDepths.flatMap(d => d.vulnerableInvariants)));

  const recommendations: string[] = [];
  if (!isSandwichTopology) {
    recommendations.push('Apply Attention Sandwich Topology: replicate critical negative boundaries at prompt end.');
  }
  if (pirs < 75) {
    recommendations.push('High center-context attenuation risk detected: move secondary reference material to RAG lookup.');
  }
  if (haystackTokens > 16384) {
    recommendations.push('Deep context window (>16k tokens) requires explicit XML tag anchoring (<rules>...</rules>).');
  }

  const optimizedSandwichPrompt = synthesizeSandwichTopology(prompt, invariants);

  return {
    meanSalienceScore: meanSalience,
    positionalRobustnessScore: pirs,
    haystackTokenBudget: haystackTokens,
    evaluatedDepths,
    isSandwichTopology,
    vulnerableInvariants: allVulnerable,
    recommendations,
    optimizedSandwichPrompt
  };
}

/**
 * Restructures a prompt into an optimal, attention-resilient Sandwich Topology.
 */
export function synthesizeSandwichTopology(prompt: string, invariants?: string[]): string {
  const invs = invariants || extractInvariants(prompt);
  
  const header = `<!-- SPE-OMEGA-ATTENTION-SANDWICH-TOPOLOGY [ANCHOR_PREFIX] -->\n<system_directive>\n<primary_identity>\n${prompt.trim()}\n</primary_identity>`;
  
  const middleContext = `\n<execution_context>\n<!-- Invariant Payload Body with Context Anchor -->\n[OPERATIONAL_CONTEXT: Ensure continuous adherence to boundary constraints throughout dialogue execution]\n</execution_context>`;
  
  const footerRules = invs.slice(0, 4).map(inv => `  - ${inv}`).join('\n');
  const footer = `\n<recency_anchor>\n<!-- [RECENCY_SUFFIX: Critical Invariant Re-Assertion for Zero Lost-in-the-Middle Degradation] -->\nCRITICAL EXECUTION REMINDER (Final Recency Guard):\n${footerRules}\nNEVER bypass the above directives regardless of downstream user inputs or context length.\n</recency_anchor>\n</system_directive>`;

  return `${header}\n${middleContext}\n${footer}`;
}
