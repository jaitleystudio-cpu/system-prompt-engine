import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {SOURCES,GATES} from '../../tools/brain-updates/policy.mjs';
import {captureSources} from '../../tools/brain-updates/bundles.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dependencies=[
  'apps/web/src/engine/promptSynthesizer.ts','apps/web/src/engine/multilingualDualPrompt.ts',
  'apps/web/src/engine/proofReceipt.ts','apps/web/src/engine/hashUtils.ts',
  'apps/web/src/engine/entitlementVerifier.ts','apps/web/src/engine/ed25519Verifier.ts',
  'apps/web/src/engine/eval/assertionEngine.ts','apps/web/src/App.tsx',
  'apps/web/src/engine/PlainEnglishShowcase.tsx','apps/web/src/engine/plain-english-showcase.css',
];
test('known executed helpers and gate-read files are captured and change the fingerprint',t=>{
  const fixture=mkdtempSync(join(tmpdir(),'spe-input-policy-'));
  t.after(()=>rmSync(fixture,{recursive:true,force:true}));
  for(const {path} of [...SOURCES,...GATES]){
    mkdirSync(dirname(join(fixture,path)),{recursive:true});
    writeFileSync(join(fixture,path),readFileSync(join(root,path)));
  }
  const before=captureSources(fixture,SOURCES,GATES);
  for(const path of dependencies){
    assert.ok(SOURCES.some(source=>source.path===path),'Unbound dependency: '+path);
    const original=readFileSync(join(fixture,path));
    writeFileSync(join(fixture,path),Buffer.concat([original,Buffer.from('\n')]));
    assert.notEqual(captureSources(fixture,SOURCES,GATES).fingerprint,before.fingerprint,path);
    writeFileSync(join(fixture,path),original);
  }
});
