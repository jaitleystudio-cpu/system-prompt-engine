// Committed allowlist. No user-supplied command, plugin or downloaded script is executed.
export const SOURCES = [
  { path: 'apps/web/src/engine/modelAtlas/modelAtlasRegistry.json', kind: 'registry' },
  ...[
    'apps/web/src/engine/plainEnglishParser.ts',
    'apps/web/src/App.tsx',
    'apps/web/src/engine/PlainEnglishShowcase.tsx',
    'apps/web/src/engine/plain-english-showcase.css',
    'apps/web/src/engine/promptSynthesizer.ts',
    'apps/web/src/engine/multilingualDualPrompt.ts',
    'apps/web/src/engine/proofReceipt.ts',
    'apps/web/src/engine/hashUtils.ts',
    'apps/web/src/engine/entitlementVerifier.ts',
    'apps/web/src/engine/ed25519Verifier.ts',
    'apps/web/src/engine/eval/assertionEngine.ts',
    'apps/web/src/engine/promptSynthesizer.mjs',
    'apps/web/src/engine/markdownExportCore.ts',
    'apps/web/src/engine/modelTranscompiler.ts',
    'packages/spe-plugin/src/tools.ts',
    'tools/brain-updates/bundles.mjs',
    'tools/brain-updates/policy.mjs',
    'tools/brain-updates/run.mjs',
    'tools/brain-updates/github-state.mjs',
  ].map(path => ({ path, kind: 'implementation' })),
];
export const GATES = [
  { id: 'brain-bundle-recovery', path: 'tests/brain-updates/bundles.test.mjs' },
  { id: 'brain-policy-inputs', path: 'tests/brain-updates/policy.test.mjs' },
  { id: 'brain-cli', path: 'tests/brain-updates/runner.test.mjs' },
  { id: 'brain-distribution', path: 'tests/brain-updates/github-state.test.mjs' },
  { id: 'instruction-contracts', path: 'tests/brain-updates/contract.test.mjs' },
  { id: 'plain-english-showcase', path: 'apps/web/scripts/test-plain-english-showcase.mjs' },
  { id: 'assertion-engine', path: 'apps/web/scripts/test-assertion-engine.mjs' },
];
