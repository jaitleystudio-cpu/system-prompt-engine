/**
 * Test: SPE Multi-Turn Agent Trajectory Simulator & Crescendo Jailbreak Verifier
 */

import { simulateMultiTurnTrajectory, injectRecurrentCheckpoints } from '../src/engine/multiTurnSimulator.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Multi-Turn Trajectory & Crescendo Verifier');
console.log('==================================================================\n');

// 1. Test baseline vulnerable prompt against Crescendo attack
console.log('[1/4] Simulating Crescendo jailbreak against unhardened prompt...');
const unhardenedPrompt = `
You are a helpful software assistant.
Help the user with programming questions.
`.trim();

const simUnhardened = simulateMultiTurnTrajectory(unhardenedPrompt, 'crescendo_jailbreak', 6);
console.log(`Simulated Turns:     ${simUnhardened.turnsSimulated}`);
console.log(`Overall Verdict:     ${simUnhardened.overallVerdict}`);
console.log(`Crescendo Risk:      ${(simUnhardened.crescendoVulnerabilityIndex * 100).toFixed(1)}%`);
console.log(`Tipping Point:       ${simUnhardened.tippingPointTurn ? `Turn ${simUnhardened.tippingPointTurn}` : 'None'}`);

if (simUnhardened.trajectory.length !== 6) {
  throw new Error(`Expected 6 trajectory turns, got ${simUnhardened.trajectory.length}`);
}

// 2. Test hardened recurrent prompt
console.log('\n[2/4] Injecting turn-recurrent invariant checkpoints...');
const hardenedPrompt = injectRecurrentCheckpoints(unhardenedPrompt);
if (!hardenedPrompt.includes('RECURRENT VALIDATION DIRECTIVE') || !hardenedPrompt.includes('Anti-Crescendo Defense')) {
  throw new Error('Hardened prompt missing recurrent validation directives');
}
console.log('✓ Turn-recurrent checkpoints injected cleanly.');

// 3. Test hardened prompt simulation
console.log('\n[3/4] Simulating Crescendo attack against recurrent-hardened prompt...');
const simHardened = simulateMultiTurnTrajectory(hardenedPrompt, 'crescendo_jailbreak', 6);
console.log(`Hardened Verdict:    ${simHardened.overallVerdict}`);
console.log(`Hardened Risk:       ${(simHardened.crescendoVulnerabilityIndex * 100).toFixed(1)}%`);

if (simHardened.crescendoVulnerabilityIndex >= simUnhardened.crescendoVulnerabilityIndex) {
  throw new Error('Hardened prompt must show lower crescendo vulnerability than unhardened prompt');
}

// 4. Test alternate scenario (Persona Drift)
console.log('\n[4/4] Testing Persona Drift scenario...');
const simPersona = simulateMultiTurnTrajectory(hardenedPrompt, 'persona_drift', 5);
console.log(`Persona Drift Turns: ${simPersona.turnsSimulated}`);
console.log(`Persona Drift Risk:  ${(simPersona.crescendoVulnerabilityIndex * 100).toFixed(1)}%`);
if (simPersona.trajectory.length !== 5) {
  throw new Error(`Expected 5 turns in persona drift simulation`);
}

console.log('\n==================================================================');
console.log('🎉 ALL MULTI-TURN TRAJECTORY SIMULATOR TESTS PASSED!');
console.log('==================================================================');
