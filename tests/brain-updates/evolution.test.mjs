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
  const input={report:{status:'CANDIDATE_QUALIFIED',baselineCommit:'base',candidateDigest:'bytes'},baseline:{sourceCommit:'base',closed:false},head:'repair',parent:'base',candidateDigest:'bytes'};
  assert.doesNotThrow(()=>api.validateAcceptance(input));
  assert.throws(()=>api.validateAcceptance({...input,parent:'other'}));
  assert.throws(()=>api.validateAcceptance({...input,candidateDigest:'changed'}));
  assert.throws(()=>api.validateAcceptance({...input,report:{...input.report,status:'HELD'}}));
});
