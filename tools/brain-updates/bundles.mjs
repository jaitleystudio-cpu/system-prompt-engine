import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, lstatSync, readFileSync, realpathSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';

export const SCOPE = 'SOURCE_BUNDLE_REGRESSION_CHECKS';
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => createHash('sha256').update(value).digest('hex');

function inside(root, path) {
  if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).some(p => p === '..' || p === '.' || !p)) throw new Error('Invalid source path');
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Source path escapes root');
  let current = root;
  for (const part of rel.split(/[\\/]/)) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink source rejected: ' + path);
  }
  if (!lstatSync(full).isFile() || lstatSync(full).size > 1_000_000) throw new Error('Source is not a bounded regular file: ' + path);
  return full;
}

function registryContent(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.models) || data.models.length === 0 || data.totalModels !== data.models.length) throw new Error('Registry model count mismatch');
  const ids = new Set();
  for (const model of data.models) {
    if (!model || typeof model.id !== 'string' || !model.id.trim() || ids.has(model.id)) throw new Error('Invalid or duplicate model ID');
    ids.add(model.id);
  }
  // Generation timestamps and self-declared digests are observation metadata, not intelligence changes.
  const { lastUpdated, checksumSha256, canonicalJcsHash, ...stable } = data;
  void lastUpdated; void checksumSha256; void canonicalJcsHash;
  stable.models = [...data.models].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return canonical(stable);
}

export function captureSources(root, sources, gates) {
  if (!Array.isArray(sources) || sources.length === 0 || sources.length > 50 || !Array.isArray(gates) || gates.length === 0 || gates.length > 20) throw new Error('Missing or excessive sources/gates');
  const records = [...sources, ...gates.map(g => ({ path: g.path, kind: 'evaluation' }))];
  const seen = new Set(), observations = [], components = [];
  for (const spec of records) {
    if (seen.has(spec.path)) throw new Error('Duplicate source path: ' + spec.path);
    seen.add(spec.path);
    const bytes = readFileSync(inside(root, spec.path));
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const content = spec.kind === 'registry' ? registryContent(raw) : raw;
    observations.push({ path: spec.path, sha256: digest(bytes) });
    components.push({ path: spec.path, kind: spec.kind, content, sha256: digest(content) });
  }
  components.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  observations.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (Buffer.byteLength(canonical(components)) > 4_000_000) throw new Error('Brain bundle exceeds byte budget');
  return { components, observations, fingerprint: digest(canonical({ schema: 1, components })) };
}

export function validateBundle(bundle) {
  if (!bundle || bundle.schema !== 'spe.brain-bundle.v1' || !Array.isArray(bundle.components)) throw new Error('Unsupported brain state');
  const { manifest, components } = bundle;
  if (!manifest || manifest.scope !== SCOPE || manifest.productionDeployed !== false || !/^0\.1\.(0|[1-9]\d*)$/.test(manifest.version) || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)) throw new Error('Invalid brain manifest');
  const patch = Number(manifest.version.split('.')[2]);
  if (!Number.isSafeInteger(patch)) throw new Error('Unsafe version');
  if (components.length === 0 || components.some(c => typeof c.content !== 'string' || digest(c.content) !== c.sha256)) throw new Error('Brain component digest mismatch');
  if (digest(canonical({ schema: 1, components })) !== manifest.fingerprint) throw new Error('Brain fingerprint mismatch');
  if (digest(canonical({ schema: bundle.schema, manifest, components })) !== bundle.bundleDigest) throw new Error('Brain bundle digest mismatch');
  return bundle;
}

export function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = path + '.' + randomUUID() + '.tmp';
  let fd;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, path);
    const dirFd = openSync(dirname(path), 'r');
    try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true });
  }
}

function readCurrent(store) {
  const path = join(store, 'current.json');
  if (!existsSync(path)) {
    // An existing history must never silently become a fresh version after pointer loss.
    if (existsSync(join(store, 'bundles'))) throw new Error('Missing pointer in existing brain history');
    return null;
  }
  const current = validateBundle(JSON.parse(readFileSync(path, 'utf8')));
  const immutable = validateBundle(JSON.parse(readFileSync(join(store, 'bundles', current.bundleDigest + '.json'), 'utf8')));
  if (canonical(current) !== canonical(immutable)) throw new Error('Pointer does not match immutable brain bundle');
  return current;
}

function executeGate(root, gate) {
  const path = inside(root, gate.path);
  const timeout = gate.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300_000) throw new Error('Invalid gate timeout');
  const started = Date.now();
  // No shell and no inherited provider/payment credentials. Gate paths are fixed by the runner policy.
  const r = spawnSync(process.execPath, [path], {
    cwd: root, timeout, killSignal: 'SIGKILL', maxBuffer: 2_000_000,
    encoding: 'utf8', env: { PATH: process.env.PATH ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', LANG: 'en_US.UTF-8' },
  });
  return { id: gate.id, path: gate.path, passed: !r.error && r.status === 0 && !r.signal,
    exitCode: r.status, signal: r.signal, error: r.error?.code ?? null,
    durationMs: Date.now() - started, stdoutDigest: digest(r.stdout ?? ''), stderrDigest: digest(r.stderr ?? '') };
}

export async function runBrainUpdate(options) {
  const { sources, gates, sourceCommit, mode = 'check' } = options;
  const store = resolve(options.store), root = realpathSync(options.root);
  const lock = join(store, '.lock'); let locked = false;
  const report = { schema: 'spe.brain-run.v1', scope: SCOPE, runId: randomUUID(),
    observedAt: options.now ?? new Date().toISOString(), status: 'HELD', sourceCommit,
    productionDeployed: false, modelTrainingPerformed: false, gates: [] };
  try {
    if (!['check', 'update'].includes(mode) || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Invalid mode or exact source commit');
    const date = new Date(report.observedAt); if (!Number.isFinite(date.getTime())) throw new Error('Invalid observation date');
    report.businessDateIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    mkdirSync(store, { recursive: true }); mkdirSync(lock); locked = true;
    const previous = readCurrent(store);
    const before = captureSources(root, sources, gates);
    report.fingerprint = before.fingerprint; report.observedSourceDigests = before.observations;
    for (const gate of gates) report.gates.push(executeGate(root, gate));
    const after = captureSources(root, sources, gates);
    if (canonical(before.observations) !== canonical(after.observations)) throw new Error('Inputs or evaluation gates changed during qualification');
    if (report.gates.some(g => !g.passed)) throw new Error('Regression gate failed or timed out');
    if (previous?.manifest.fingerprint === before.fingerprint) {
      report.status = 'UNCHANGED'; report.version = previous.manifest.version; report.bundleDigest = previous.bundleDigest;
    } else {
      const patch = previous ? Number(previous.manifest.version.split('.')[2]) + 1 : 0;
      if (!Number.isSafeInteger(patch)) throw new Error('Version exhausted');
      report.version = '0.1.' + patch;
      const manifest = { scope: SCOPE, version: report.version, fingerprint: before.fingerprint,
        sourceCommit, qualifiedAt: report.observedAt, previousFingerprint: previous?.manifest.fingerprint ?? null,
        productionDeployed: false, providerAvailabilityVerified: false, intelligenceGainMeasured: false,
        gateEvidence: report.gates };
      const bundle = { schema: 'spe.brain-bundle.v1', manifest, components: before.components };
      bundle.bundleDigest = digest(canonical(bundle)); validateBundle(bundle); report.bundleDigest = bundle.bundleDigest;
      if (mode === 'update') {
        const target = join(store, 'bundles', bundle.bundleDigest + '.json');
        // An orphan from a crash before pointer replacement is safe to reuse only if it is valid.
        if (existsSync(target)) {
          const orphan = validateBundle(JSON.parse(readFileSync(target, 'utf8')));
          if (orphan.manifest.fingerprint !== before.fingerprint || orphan.manifest.version !== report.version || canonical(orphan.components) !== canonical(before.components)) throw new Error('Conflicting immutable bundle');
          atomicJson(join(store, 'current.json'), orphan);
        } else {
          atomicJson(target, bundle); atomicJson(join(store, 'current.json'), bundle);
        }
        report.status = 'UPDATED';
      } else report.status = 'CANDIDATE_QUALIFIED';
    }
  } catch (e) { report.status = 'HELD'; report.reason = e.message; }
  finally {
    if (locked) {
      try { if (mode === 'update') atomicJson(join(store, 'last-run.json'), report); }
      finally { rmSync(lock, { recursive: true, force: true }); }
    }
  }
  return report;
}
