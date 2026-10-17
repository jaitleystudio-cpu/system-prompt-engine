import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let api;
try { api = await import('../../tools/brain-updates/run.mjs'); } catch(e) { if(e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
test('nightly runner is available', () => assert.equal(typeof api?.parseArguments, 'function'));
test('CLI defaults to check, rejects unknown options and does not accept arbitrary commands', {skip: !api}, () => {
  assert.equal(api.parseArguments([]).mode, 'check');
  assert.equal(api.parseArguments(['--update']).mode, 'update');
  assert.throws(() => api.parseArguments(['--command', 'anything']), /Unknown/);
  assert.throws(() => api.parseArguments(['--state']), /state/);
  assert.throws(() => api.parseArguments(['--update','--check']), /mode/);
});
test('help performs no update and documents scope', {skip: !api}, () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../tools/brain-updates/run.mjs', import.meta.url)), '--help'], {encoding:'utf8'});
  assert.equal(result.status, 0); assert.match(result.stdout, /source.bundle/i);
  assert.match(result.stdout, /--update/);
});
