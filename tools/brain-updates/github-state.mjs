#!/usr/bin/env node
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, canonical, validateBundle } from './bundles.mjs';

export const STATE_BRANCH = 'spe-brain-state';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export class GitHubBrainState {
  constructor({repository, token, request = fetch, allowInitialize = false}) {
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(repository ?? '') || !token) throw new Error('Repository and token are required');
    this.repository = repository; this.token = token; this.request = request; this.allowInitialize = allowInitialize;
  }
  async api(path, {method = 'GET', body, missing = false} = {}) {
    const response = await this.request('https://api.github.com/repos/' + this.repository + path, {
      method, redirect:'error', signal:AbortSignal.timeout(30_000),
      headers:{Authorization:'Bearer ' + this.token, Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    });
    if (missing && response.status === 404) return null;
    // Do not log remote bodies or request headers: they may contain credential material.
    if (!response.ok) throw new Error('GitHub state request failed: HTTP ' + response.status);
    const text = await response.text(); if (Buffer.byteLength(text) > 8_000_000) throw new Error('GitHub state response exceeds byte limit');
    return JSON.parse(text);
  }
  async head() {
    const ref = await this.api('/git/ref/heads/' + STATE_BRANCH, {missing:true});
    if (ref === null) return null;
    if (!sha(ref.object?.sha)) throw new Error('Invalid state branch identity');
    return ref.object.sha;
  }
  async load(store) {
    await this.api(''); // A missing/inaccessible repository is not an empty state branch.
    const head = await this.head(); let tree = null, bundle = null;
    if (!head && !this.allowInitialize) throw new Error('State branch missing: explicit one-time initialization required; refusing history reset');
    if (head) {
      const commit = await this.api('/git/commits/' + head);
      if (!sha(commit.tree?.sha)) throw new Error('Invalid state tree'); tree = commit.tree.sha;
      // Resolve both files from the exact commit tree, then use the Git Blobs API.
      // Contents JSON cannot return normal base64 content for files above 1 MB.
      const snapshot = await this.api('/git/trees/' + tree + '?recursive=1');
      if (snapshot.truncated !== false || !Array.isArray(snapshot.tree)) throw new Error('Incomplete state tree');
      const readBundle = async path => {
        const entries = snapshot.tree.filter(entry => entry.path === path);
        if (entries.length !== 1 || entries[0].type !== 'blob' || !sha(entries[0].sha)) throw new Error('Missing immutable/state blob: ' + path);
        const file = await this.api('/git/blobs/' + entries[0].sha);
        if (file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Unsupported remote state encoding');
        const bytes = Buffer.from(file.content, 'base64');
        if (bytes.length > 4_500_000) throw new Error('State exceeds byte limit');
        return validateBundle(JSON.parse(bytes.toString('utf8')));
      };
      bundle = await readBundle('state.json');
      const immutable = await readBundle('bundles/' + bundle.bundleDigest + '.json');
      if (canonical(bundle) !== canonical(immutable)) throw new Error('Remote immutable bundle mismatch');
      atomicJson(join(store,'bundles',bundle.bundleDigest + '.json'),bundle);
      atomicJson(join(store,'current.json'),bundle);
    }
    mkdirSync(store,{recursive:true});
    atomicJson(join(store,'.remote.json'),{repository:this.repository,branch:STATE_BRANCH,head,tree});
    return bundle;
  }
  async advanceRef(oldHead, newHead) {
    if (!sha(newHead) || (oldHead !== null && !sha(oldHead))) throw new Error('Invalid state commit');
    return oldHead
      ? this.api('/git/refs/heads/' + STATE_BRANCH,{method:'PATCH',body:{sha:newHead,force:false}})
      : this.api('/git/refs',{method:'POST',body:{ref:'refs/heads/' + STATE_BRANCH,sha:newHead}});
  }
  async publish(store) {
    const remote = JSON.parse(readFileSync(join(store,'.remote.json'),'utf8'));
    if (remote.repository !== this.repository || remote.branch !== STATE_BRANCH || (remote.head !== null && !sha(remote.head))) throw new Error('State provenance mismatch');
    if (await this.head() !== remote.head) throw new Error('State changed concurrently; retry from latest state');
    const bundle = validateBundle(JSON.parse(readFileSync(join(store,'current.json'),'utf8')));
    const immutable = validateBundle(JSON.parse(readFileSync(join(store,'bundles',bundle.bundleDigest + '.json'),'utf8')));
    const report = JSON.parse(readFileSync(join(store,'last-run.json'),'utf8'));
    if (canonical(bundle) !== canonical(immutable) || !['UPDATED','UNCHANGED'].includes(report.status) || report.bundleDigest !== bundle.bundleDigest) throw new Error('Unqualified or mismatched state cannot be published');
    const files = [['state.json',bundle], ['last-run.json',report], ['bundles/' + bundle.bundleDigest + '.json',bundle]];
    const treeEntries = [];
    for (const [path, value] of files) {
      const blob = await this.api('/git/blobs',{method:'POST',body:{content:JSON.stringify(value,null,2)+'\n',encoding:'utf-8'}});
      if (!sha(blob.sha)) throw new Error('Invalid uploaded blob identity');
      treeEntries.push({path,mode:'100644',type:'blob',sha:blob.sha});
    }
    const tree = await this.api('/git/trees',{method:'POST',body:{...(remote.tree ? {base_tree:remote.tree}:{}),tree:treeEntries}});
    if (!sha(tree.sha)) throw new Error('Invalid uploaded tree identity');
    const commit = await this.api('/git/commits',{method:'POST',body:{
      message:'chore(brain): ' + report.status.toLowerCase() + ' source bundle ' + bundle.manifest.version,
      tree:tree.sha,parents:remote.head ? [remote.head]:[],
    }});
    if (!sha(commit.sha)) throw new Error('Invalid uploaded commit identity');
    await this.advanceRef(remote.head,commit.sha);
    return {status:'STATE_BRANCH_PUBLISHED',branch:STATE_BRANCH,commit:commit.sha,version:bundle.manifest.version,productionDeployed:false};
  }
}

export async function main(args=process.argv.slice(2)) {
  const [operation, store, ...extra] = args;
  if (!['load','publish'].includes(operation) || !store || extra.length) throw new Error('Usage: github-state.mjs load|publish STATE_DIRECTORY');
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('State writes/loads are restricted to the main workflow');
  const client=new GitHubBrainState({repository:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN,
    allowInitialize:process.env.SPE_BRAIN_INITIALIZE === '1'});
  const result=operation==='load' ? await client.load(resolve(store)) : await client.publish(resolve(store));
  console.log(JSON.stringify(operation==='load' ? {status:result?'RESTORED':'INITIAL_STATE',version:result?.manifest.version??null}:result));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {await main();} catch(e){console.error('Brain distribution held: '+e.message);process.exitCode=1;}
}
