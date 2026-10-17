import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let api;
try { api = await import('../../tools/brain-updates/github-state.mjs'); } catch(e) { if(e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
test('GitHub state transport is available', () => assert.equal(typeof api?.GitHubBrainState, 'function'));
const behavior = (name, fn) => test(name, {skip: !api}, fn);
function temp(t) { const p=mkdtempSync(join(tmpdir(),'spe-remote-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p; }
const response=(status,body)=>new Response(JSON.stringify(body),{status});
behavior('missing branch initializes only after repository access succeeds', async t => {
  const calls=[];
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'fixture-token',allowInitialize:true,request:async(url,opts)=>{
    calls.push({url,opts});return url.endsWith('/repos/owner/repo') ? response(200,{}) : response(404,{});
  }});
  const p=temp(t); assert.equal(await client.load(p), null);
  assert.equal(JSON.parse(readFileSync(join(p,'.remote.json'))).head, null);
  assert.equal(calls.length,2); assert.equal(calls[1].opts.redirect,'error');
});
behavior('a missing state branch does not silently reset version history without explicit initialization', async t => {
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'fixture-token',request:async url=>url.endsWith('/repos/owner/repo')?response(200,{}):response(404,{})});
  await assert.rejects(()=>client.load(temp(t)),/initializ|missing/i);
});
behavior('authentication/network errors never become an empty trusted baseline', async t => {
  let count=0;
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'fixture-token',request:async()=>{count++;return response(401,{message:'sensitive fixture-token'});}});
  await assert.rejects(()=>client.load(temp(t)), e=>!e.message.includes('fixture-token') && /401/.test(e.message));
  assert.equal(count,1);
});
behavior('an existing branch without valid state fails closed', async t => {
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'fixture-token',request:async url=>{
    if(url.endsWith('/repos/owner/repo'))return response(200,{});
    if(url.includes('/git/ref/'))return response(200,{object:{sha:'a'.repeat(40)}});
    if(url.includes('/git/commits/'))return response(200,{tree:{sha:'b'.repeat(40)}});
    return response(404,{});
  }});
  await assert.rejects(()=>client.load(temp(t)), /404/);
});
behavior('unsafe repository names and missing tokens are rejected', () => {
  assert.throws(()=>new api.GitHubBrainState({repository:'../repo',token:'x'}));
  assert.throws(()=>new api.GitHubBrainState({repository:'owner/repo',token:''}));
});
behavior('write races are non-forced; conflict is reported, never retried as success', async () => {
  const calls=[];
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'x',request:async(url,opts)=>{calls.push({url,opts});return response(422,{});}});
  await assert.rejects(()=>client.advanceRef('a'.repeat(40),'b'.repeat(40)), /422/);
  assert.equal(calls.length,1);
  assert.equal(JSON.parse(calls[0].opts.body).force,false);
  assert.equal(calls[0].opts.method,'PATCH');
});
behavior('qualify, publish, restore and repeat preserves the exact bundle and version', async t => {
  const {runBrainUpdate}=await import('../../tools/brain-updates/bundles.mjs');
  const root=temp(t);writeFileSync(join(root,'prompt.mjs'),'instruction');writeFileSync(join(root,'gate.mjs'),'process.exit(0)');
  let head=null; const blobs=new Map(), commits=new Map(), trees=new Map(); let counter=1;
  const identity=()=>String(counter++).padStart(40,'0');
  const request=async(url,opts)=>{
    const path=new URL(url).pathname.replace('/repos/owner/repo','');const data=opts.body?JSON.parse(opts.body):{};
    if(path==='')return response(200,{});
    if(path.startsWith('/git/ref/'))return head?response(200,{object:{sha:head}}):response(404,{});
    if(path==='/git/blobs'){const sha=identity();blobs.set(sha,data.content);return response(201,{sha});}
    if(path==='/git/trees'){const sha=identity();trees.set(sha,data.tree);return response(201,{sha});}
    if(path==='/git/commits'){const sha=identity();commits.set(sha,data);return response(201,{sha});}
    if(path.startsWith('/git/commits/'))return response(200,{tree:{sha:commits.get(head).tree}});
    if(path.startsWith('/contents/')){
      const entry=trees.get(commits.get(head).tree).find(x=>x.path==='state.json');
      return response(200,{encoding:'base64',content:Buffer.from(blobs.get(entry.sha)).toString('base64')});
    }
    if(path==='/git/refs' || path.startsWith('/git/refs/')){
      if(head)assert.equal(data.force,false);
      assert.deepEqual(commits.get(data.sha).parents,head?[head]:[]);
      head=data.sha;return response(200,{});
    }
    throw new Error('Unexpected fixture request '+path);
  };
  const client=new api.GitHubBrainState({repository:'owner/repo',token:'fixture',allowInitialize:true,request});
  const state=join(root,'state');await client.load(state);
  const opts={root,store:state,sources:[{path:'prompt.mjs',kind:'implementation'}],gates:[{id:'real',path:'gate.mjs'}],sourceCommit:'a'.repeat(40),mode:'update'};
  assert.equal((await runBrainUpdate(opts)).status,'UPDATED');
  const published=await client.publish(state);assert.equal(published.status,'STATE_BRANCH_PUBLISHED');
  assert.equal(published.productionDeployed,false);
  const restored=join(root,'restored');mkdirSync(restored);
  const bundle=await client.load(restored);assert.equal(bundle.manifest.version,'0.1.0');
  assert.equal(readFileSync(join(state,'current.json'),'utf8'),readFileSync(join(restored,'current.json'),'utf8'));
  assert.equal((await runBrainUpdate({...opts,store:restored})).status,'UNCHANGED');
  await client.publish(restored); // A new execution receipt, without a content/version bump.
});
