import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let api;try{api=await import('../../tools/brain-updates/evolve.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('real evolution evaluator is available',()=>assert.equal(typeof api?.scoreCases,'function'));
const corpus=JSON.parse(readFileSync(new URL('./cases/goal-preservation.json',import.meta.url),'utf8'));
test('executor receives only the request, never expected concepts', {skip:!api},()=>{
  const result=api.scoreCases(corpus.cases, input=>{assert.equal(typeof input,'string');return {goal:input,constraint:input};});
  assert.equal(result.passed,0,'An echo of the whole input must not masquerade as extraction');
});
test('a mean gain cannot hide an individual regression', {skip:!api},()=>{
  assert.equal(api.compareScores({cases:[{id:'a',passed:true},{id:'b',passed:false}]},{cases:[{id:'a',passed:false},{id:'b',passed:true}]}).accepted,false);
});
test('an unchanged score never qualifies as an improvement', {skip:!api},()=>{
  const score={cases:[{id:'a',passed:true}]};assert.equal(api.compareScores(score,score).accepted,false);
});
test('tampered corpus labels not present in the request are rejected', {skip:!api},()=>{
  const cases=structuredClone(corpus.cases);cases[0].goals.push('secret expected answer');
  assert.throws(()=>api.scoreCases(cases,()=>({goal:'',constraint:''})),/source|request|concept/i);
});
test('acceptance requires a qualified report, matching candidate bytes and one exact repair commit',{skip:!api},()=>{
  assert.equal(typeof api.validateAcceptance,'function');
  const input={report:{status:'CANDIDATE_QUALIFIED',baselineCommit:'base',candidateDigest:'bytes'},baseline:{sourceCommit:'base',closed:false},head:'repair',parent:'base',parentCount:1,paths:[api.TARGET],candidateDigest:'bytes'};
  assert.doesNotThrow(()=>api.validateAcceptance(input));
  assert.throws(()=>api.validateAcceptance({...input,parent:'other'}));
  assert.throws(()=>api.validateAcceptance({...input,parentCount:2}));
  assert.throws(()=>api.validateAcceptance({...input,paths:[api.TARGET,'unrelated-production-config.txt']}));
  assert.throws(()=>api.validateAcceptance({...input,candidateDigest:'changed'}));
  assert.throws(()=>api.validateAcceptance({...input,report:{...input.report,status:'HELD'}}));
});

test('a correct goal with whole-request constraint echo cannot qualify',{skip:!api},()=>{
  const c=corpus.cases[0];const r=api.scoreCases([c],input=>({goal:c.goals.join(' and '),constraint:input}));
  assert.equal(r.passed,0);
});
test('candidate import and execution are bounded independently of regression gates',{skip:!api},async t=>{
  assert.equal(typeof api.executeParserRequests,'function');
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'spe-worker-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [name,code]of [['import','while(true){}'],['call','export function parseCustomSentence(){while(true){}}']]){
    const target=path.join(root,name+'.mjs');fs.writeFileSync(target,code);
    assert.throws(()=>api.executeParserRequests(target,['request'],100),/timed out|timeout/i);
  }
});
test('emergency sentinel and environment stop block the evolution path',{skip:!api},async t=>{
  assert.equal(typeof api.assertEmergencyStop,'function');
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'spe-stop-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  assert.throws(()=>api.assertEmergencyStop(root,{SPE_EMERGENCY_STOP:'1'}),/stop/i);
  fs.writeFileSync(path.join(root,'.spe_emergency_stop'),'');
  assert.throws(()=>api.assertEmergencyStop(root,{}),/stop/i);
});
