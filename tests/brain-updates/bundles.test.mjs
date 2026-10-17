import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let api;
try { api = await import('../../tools/brain-updates/bundles.mjs'); } catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
test('brain update implementation is available', () => assert.equal(typeof api?.runBrainUpdate, 'function'));
const behavior = (name, fn) => test(name, { skip: !api }, fn);
const sha = 'a'.repeat(40);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'spe-brain-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'), store = join(dir, 'state'); mkdirSync(root);
  writeFileSync(join(root, 'prompt.mjs'), 'export const instruction = "Preserve user requirements";');
  writeFileSync(join(root, 'gate.mjs'), 'process.exit(0);');
  const sources = [{ path: 'prompt.mjs', kind: 'implementation' }];
  const gates = [{ id: 'fixture', path: 'gate.mjs' }];
  const opts = { root, store, sources, gates, sourceCommit: sha, now: '2026-10-17T20:47:00Z', mode: 'update' };
  return { root, store, opts };
}
behavior('first update qualifies an immutable bundle and reports the next IST date', async t => {
  const { store, opts } = fixture(t); const r = await api.runBrainUpdate(opts);
  assert.equal(r.status, 'UPDATED'); assert.equal(r.version, '0.1.0');
  assert.equal(r.businessDateIst, '2026-10-18');
  assert.equal(r.scope, 'SOURCE_BUNDLE_REGRESSION_CHECKS');
  const current = JSON.parse(readFileSync(join(store, 'current.json')));
  assert.equal(current.manifest.fingerprint, r.fingerprint);
  assert.equal(current.manifest.version, '0.1.0');
  assert.equal(current.manifest.productionDeployed, false);
});
behavior('repeat is unchanged; content changes increment version once', async t => {
  const { root, opts } = fixture(t); await api.runBrainUpdate(opts);
  assert.equal((await api.runBrainUpdate(opts)).status, 'UNCHANGED');
  writeFileSync(join(root, 'prompt.mjs'), 'export const instruction = "Preserve all requirements";');
  assert.equal((await api.runBrainUpdate(opts)).version, '0.1.1');
  assert.equal((await api.runBrainUpdate(opts)).version, '0.1.1');
});
behavior('registry timestamps/order are not a meaningful brain change', async t => {
  const { root, opts } = fixture(t);
  const models = [{ id: 'two', name: 'Two' }, { id: 'one', name: 'One' }];
  const path = join(root, 'registry.json');
  writeFileSync(path, JSON.stringify({ models, totalModels: 2, lastUpdated: 'old' }));
  opts.sources.push({ path: 'registry.json', kind: 'registry' });
  const first = await api.runBrainUpdate(opts);
  writeFileSync(path, JSON.stringify({ models: models.reverse(), totalModels: 2, lastUpdated: 'new' }));
  const next = await api.runBrainUpdate(opts);
  assert.equal(next.fingerprint, first.fingerprint); assert.equal(next.status, 'UNCHANGED');
});
behavior('duplicate registry identifiers and malformed count are held', async t => {
  const { root, opts } = fixture(t); opts.sources.push({ path: 'registry.json', kind: 'registry' });
  writeFileSync(join(root, 'registry.json'), JSON.stringify({ models: [{id:'same'}, {id:'same'}], totalModels:2 }));
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
  writeFileSync(join(root, 'registry.json'), JSON.stringify({ models: [{id:'one'}], totalModels:2 }));
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
});
behavior('a failed gate holds the previous byte-identical pointer', async t => {
  const { root, store, opts } = fixture(t); await api.runBrainUpdate(opts);
  const before = readFileSync(join(store, 'current.json'), 'utf8');
  writeFileSync(join(root, 'prompt.mjs'), 'changed');
  writeFileSync(join(root, 'gate.mjs'), 'console.error("expected failure"); process.exit(7);');
  const r = await api.runBrainUpdate(opts);
  assert.equal(r.status, 'HELD'); assert.equal(r.gates[0].exitCode, 7);
  assert.equal(readFileSync(join(store, 'current.json'), 'utf8'), before);
});
behavior('a gate that mutates its candidate cannot qualify', async t => {
  const { root, opts } = fixture(t);
  writeFileSync(join(root, 'gate.mjs'), 'import fs from "node:fs"; fs.writeFileSync("prompt.mjs", "tampered");');
  const r = await api.runBrainUpdate(opts);
  assert.equal(r.status, 'HELD'); assert.match(r.reason, /changed|mutat/i);
});
behavior('gate mutation, even timestamp-only, is detected', async t => {
  const { root, opts } = fixture(t);
  writeFileSync(join(root, 'gate.mjs'), 'import fs from "node:fs"; fs.writeFileSync("gate.mjs", "process.exit(0)");');
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
});
behavior('timed-out gates cannot produce a release', async t => {
  const { root, opts } = fixture(t);
  writeFileSync(join(root, 'gate.mjs'), 'setInterval(() => {}, 1000);');
  opts.gates[0].timeoutMs = 100;
  const r = await api.runBrainUpdate(opts);
  assert.equal(r.status, 'HELD'); assert.equal(r.gates[0].passed, false);
});
behavior('traversal, symlink and corrupt state are rejected', async t => {
  const { root, store, opts } = fixture(t);
  const outside = join(root, '..', 'private.txt'); writeFileSync(outside, 'private');
  opts.sources = [{ path: '../private.txt', kind: 'implementation' }];
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
  symlinkSync(outside, join(root, 'linked.mjs'));
  opts.sources = [{ path: 'linked.mjs', kind: 'implementation' }];
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
  opts.sources = [{ path: 'prompt.mjs', kind: 'implementation' }];
  mkdirSync(store, { recursive:true }); writeFileSync(join(store, 'current.json'), '{bad');
  const r = await api.runBrainUpdate(opts); assert.equal(r.status, 'HELD');
  assert.equal(readFileSync(join(store, 'current.json'), 'utf8'), '{bad');
});
behavior('tampered bundle digest does not bootstrap a new trusted state', async t => {
  const { store, opts } = fixture(t); await api.runBrainUpdate(opts);
  const p = join(store, 'current.json'), state = JSON.parse(readFileSync(p));
  state.components[0].content = 'changed'; writeFileSync(p, JSON.stringify(state));
  const r = await api.runBrainUpdate(opts); assert.equal(r.status, 'HELD');
});
behavior('missing immutable bundle or live writer lock fails closed', async t => {
  const { store, opts } = fixture(t); const first = await api.runBrainUpdate(opts);
  rmSync(join(store, 'bundles', first.bundleDigest + '.json'));
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
  mkdirSync(join(store, '.lock'));
  assert.equal((await api.runBrainUpdate(opts)).status, 'HELD');
});
behavior('check mode never activates a pointer', async t => {
  const { store, opts } = fixture(t); opts.mode = 'check';
  const r = await api.runBrainUpdate(opts); assert.equal(r.status, 'CANDIDATE_QUALIFIED');
  assert.throws(() => readFileSync(join(store, 'current.json')), /ENOENT/);
});
behavior('returning to older content creates a new auditable version, not a history rewrite', async t => {
  const { root, opts } = fixture(t);
  const old = readFileSync(join(root,'prompt.mjs'),'utf8');
  const a = await api.runBrainUpdate(opts);
  writeFileSync(join(root,'prompt.mjs'),'new'); await api.runBrainUpdate(opts);
  writeFileSync(join(root,'prompt.mjs'),old); const back = await api.runBrainUpdate(opts);
  assert.equal(back.status,'UPDATED'); assert.equal(back.version,'0.1.2');
  assert.equal(back.fingerprint,a.fingerprint); assert.notEqual(back.bundleDigest,a.bundleDigest);
});
behavior('cross-gate mutation is held before another gate can restore the snapshot', async t => {
  const {root,opts}=fixture(t);
  const old=readFileSync(join(root,'prompt.mjs'),'utf8');
  writeFileSync(join(root,'gate.mjs'),'import fs from "node:fs";fs.writeFileSync("prompt.mjs","new");');
  writeFileSync(join(root,'restore.mjs'),'import fs from "node:fs";fs.writeFileSync("prompt.mjs",'+JSON.stringify(old)+');');
  opts.gates.push({id:'restore',path:'restore.mjs'});
  const r=await api.runBrainUpdate(opts);
  assert.equal(r.status,'HELD');assert.equal(r.gates.length,1);
});
behavior('surviving history receipts and remote provenance forbid silent reinitialization', async t => {
  const {store,opts}=fixture(t);await api.runBrainUpdate(opts);
  rmSync(join(store,'current.json'));rmSync(join(store,'bundles'),{recursive:true});
  assert.equal((await api.runBrainUpdate(opts)).status,'HELD');
  assert.equal((await api.runBrainUpdate(opts)).status,'HELD');
  rmSync(join(store,'last-run.json'));
  writeFileSync(join(store,'.remote.json'),JSON.stringify({head:'a'.repeat(40)}));
  assert.equal((await api.runBrainUpdate(opts)).status,'HELD');
});
behavior('an initial failed attempt remains retryable without a predecessor', async t => {
  const {root,opts}=fixture(t);writeFileSync(join(root,'gate.mjs'),'process.exit(1)');
  assert.equal((await api.runBrainUpdate(opts)).status,'HELD');
  writeFileSync(join(root,'gate.mjs'),'process.exit(0)');
  assert.equal((await api.runBrainUpdate(opts)).status,'UPDATED');
});
