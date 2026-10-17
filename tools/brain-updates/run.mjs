#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBrainUpdate } from './bundles.mjs';
import { SOURCES, GATES } from './policy.mjs';

export function parseArguments(args) {
  const options = { mode: 'check' }; let modeSeen = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') options.help = true;
    else if (arg === '--update' || arg === '--check') {
      if (modeSeen) throw new Error('Choose one mode');
      modeSeen = true; options.mode = arg === '--update' ? 'update' : 'check';
    } else if (arg === '--state') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--state requires a directory');
      options.store = resolve(args[++i]);
    } else throw new Error('Unknown argument: ' + arg);
  }
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    console.log('SPE nightly source-bundle updater\nUsage: node tools/brain-updates/run.mjs [--check | --update] [--state DIR]\nCheck is the default. No provider calls, training or production deployment.');
    return 0;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding:'utf8', timeout:10_000});
  if (revision.status !== 0) throw new Error('Cannot determine exact source commit');
  const paths = [...SOURCES, ...GATES].map(s => s.path);
  const dirty = spawnSync('git', ['status', '--porcelain', '--', ...paths], {cwd:root, encoding:'utf8', timeout:10_000});
  if (dirty.status !== 0 || dirty.stdout.trim()) throw new Error('Brain sources/gates are not committed and clean');
  const report = await runBrainUpdate({ root, store: options.store ?? resolve(root, '.spe/brain-updates'),
    sources: SOURCES, gates: GATES, sourceCommit: revision.stdout.trim(), mode: options.mode });
  console.log(JSON.stringify(report, null, 2));
  return report.status === 'HELD' ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error('Brain update held: ' + error.message); process.exitCode = 1; }
}
