import assert from 'node:assert/strict';
import { loadAndEvaluate } from '../apps/web/src/engine/wasm-host.mjs';
for (const digest of [null, undefined, '', 'x'.repeat(64), '0'.repeat(64)]) {
  const result = await loadAndEvaluate({wasmBytes:new Uint8Array([0,97,115,109,1,0,0,0]),expectedSha256:digest,jsonText:'{}'});
  assert.equal(result.error.code,'WASM_INTEGRITY_MISMATCH');
  assert(!result.phases.includes('instantiating'));
}
console.log('PASS: absent, malformed and mismatched digests rejected before instantiation.');
