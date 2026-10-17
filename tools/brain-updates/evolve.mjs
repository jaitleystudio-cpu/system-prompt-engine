#!/usr/bin/env node
// Codex proposes source repairs; this process measures real parser execution and gates acceptance.
// No LLM, expected answer or required-concept list is passed to the parser.
import {readFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {atomicJson,canonical,digest} from './bundles.mjs';
import {SOURCES,GATES} from './policy.mjs';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const TARGET='apps/web/src/engine/plainEnglishParser.ts';
export const CORPUS='tests/brain-updates/cases/goal-preservation.json';
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const hash=path=>digest(readFileSync(join(ROOT,path)));
export function scoreCases(cases,execute){
  if(!Array.isArray(cases)||cases.length===0||cases.length>500)throw new Error('Missing or excessive cases');
  const seen=new Set();
  const results=cases.map(c=>{
    if(!c||typeof c.id!=='string'||seen.has(c.id)||!['train','validation','audit'].includes(c.split)||
      typeof c.input!=='string'||c.input.length>10000||!Array.isArray(c.goals)||!c.goals.length||
      !Array.isArray(c.constraints)||!c.constraints.length)throw new Error('Invalid case identity or split');
    seen.add(c.id);
    if((c.goalExcludes!==undefined&&!Array.isArray(c.goalExcludes))||(c.outputIncludes!==undefined&&!Array.isArray(c.outputIncludes)))throw new Error('Invalid optional case labels');
    for(const concept of [...c.goals,...c.constraints,...(c.goalExcludes??[]),...(c.outputIncludes??[])])if(typeof concept!=='string'||!concept.trim()||!c.input.toLowerCase().includes(concept.toLowerCase()))throw new Error('Expected concept absent from source request');
    const output=execute(c.input);
    if(typeof output?.goal!=='string'||typeof output.constraint!=='string')throw new Error('Executor did not return real parser fields');
    const goal=output.goal.toLowerCase(),constraint=output.constraint.toLowerCase();
    const missingGoals=c.goals.filter(x=>!goal.includes(x.toLowerCase()));
    const missingConstraints=c.constraints.filter(x=>!constraint.includes(x.toLowerCase()));
    const constraintLeaks=[...c.constraints,...(c.goalExcludes??[])].filter(x=>goal.includes(x.toLowerCase()));
    const goalLeaks=c.goals.filter(x=>constraint.includes(x.toLowerCase()));
    const missingOutput=(c.outputIncludes??[]).filter(x=>typeof output.output!=='string'||!output.output.toLowerCase().includes(x.toLowerCase()));
    const wellFormed=output.goal.isWellFormed()&&output.constraint.isWellFormed();
    return {id:c.id,split:c.split,passed:!missingGoals.length&&!missingConstraints.length&&!constraintLeaks.length&&!goalLeaks.length&&!missingOutput.length&&wellFormed,
      missingGoals,missingConstraints,constraintLeaks,goalLeaks,missingOutput,wellFormed,outputDigest:digest(canonical(output))};
  });
  return {scope:'FINITE_PUBLIC_PARSER_CORPUS',total:results.length,passed:results.filter(c=>c.passed).length,cases:results};
}
export function compareScores(before,after){
  const old=new Map(before.cases.map(c=>[c.id,c]));
  if(old.size!==before.cases.length||after.cases.length!==old.size||new Set(after.cases.map(c=>c.id)).size!==old.size||after.cases.some(c=>!old.has(c.id)))throw new Error('Case identity changed');
  const regressions=after.cases.filter(c=>old.get(c.id).passed&&!c.passed).map(c=>c.id);
  const gains=after.cases.filter(c=>!old.get(c.id).passed&&c.passed);
  const splitGains=Object.fromEntries(['train','validation','audit'].map(split=>[split,gains.filter(c=>c.split===split).length]));
  return {accepted:regressions.length===0&&Object.values(splitGains).every(n=>n>0),regressions,splitGains};
}
export function validateAcceptance({report,baseline,head,parent,parentCount,paths,candidateDigest}){
  if(baseline.closed||report.status!=='CANDIDATE_QUALIFIED'||report.baselineCommit!==baseline.sourceCommit||
    parent!==baseline.sourceCommit||parentCount!==1||!Array.isArray(paths)||paths.length!==1||paths[0]!==TARGET||head===baseline.sourceCommit||report.candidateDigest!==candidateDigest)
    throw new Error('Acceptance provenance mismatch');
}
export function assertEmergencyStop(root=ROOT,environment=process.env){
  if(environment.SPE_EMERGENCY_STOP==='1'||existsSync(join(root,'.spe_emergency_stop')))throw new Error('Emergency stop active');
}
export function executeParserRequests(target,requests,timeoutMs=15000){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw new Error('Invalid execution timeout');
  const result=spawnSync(process.execPath,[join(ROOT,'tools/brain-updates/evaluate-worker.mjs'),target],{
    cwd:ROOT,input:JSON.stringify(requests),encoding:'utf8',timeout:timeoutMs,killSignal:'SIGKILL',maxBuffer:2000000,
    env:{PATH:process.env.PATH??'',TMPDIR:process.env.TMPDIR??'/tmp',LANG:'en_US.UTF-8'}});
  if(result.error?.code==='ETIMEDOUT')throw new Error('Candidate execution timed out');
  if(result.error||result.signal||result.status!==0)throw new Error('Candidate worker failed: '+(result.error?.code??result.signal??result.status));
  const outputs=JSON.parse(result.stdout);
  if(!Array.isArray(outputs)||outputs.length!==requests.length)throw new Error('Invalid candidate outputs');
  return outputs;
}
function verifyOwner(store,baseline){
  const owner=JSON.parse(readFileSync(join(store,'experiment.lock/owner.json'),'utf8'));
  if(!baseline.ownerId||owner.ownerId!==baseline.ownerId||owner.sourceCommit!==baseline.sourceCommit)throw new Error('Experiment lock ownership mismatch');
}
function frozenInputs(){return Object.fromEntries([...new Set([...SOURCES,...GATES,{path:CORPUS},{path:'tools/brain-updates/evolve.mjs'}].map(s=>s.path))].filter(p=>p!==TARGET).map(path=>[path,hash(path)]));}
function runGates(gates){const integrity=()=>digest(canonical({frozen:frozenInputs(),target:hash(TARGET)}));const expected=integrity();return gates.map(g=>{
  const r=spawnSync(process.execPath,[join(ROOT,g.path)],{cwd:ROOT,timeout:120000,killSignal:'SIGKILL',maxBuffer:2000000,encoding:'utf8',
    env:{PATH:process.env.PATH??'',TMPDIR:process.env.TMPDIR??'/tmp',LANG:'en_US.UTF-8'}});
  if(integrity()!==expected)throw new Error('Inputs changed during a regression gate');
  return {id:g.id,passed:r.status===0&&!r.error&&!r.signal,exitCode:r.status,signal:r.signal,error:r.error?.code??null,
    stdoutDigest:digest(r.stdout??''),stderrDigest:digest(r.stderr??'')};
});}
export async function main(args=process.argv.slice(2)){
  const [stage,...extra]=args;
  if(!['begin','qualify','close','status','abort'].includes(stage)||extra.length)throw new Error('Usage: evolve.mjs begin|qualify|close|status|abort');
  if(!['status','abort'].includes(stage))assertEmergencyStop();
  const store=join(ROOT,'.spe/brain-evolution');mkdirSync(store,{recursive:true});
  const baselinePath=join(store,'baseline.json'),reportPath=join(store,'last-run.json'),lock=join(store,'experiment.lock');
  if(stage==='status'){console.log(existsSync(reportPath)?readFileSync(reportPath,'utf8'):'No measured run yet');return;}
  if(stage==='abort'){if(existsSync(baselinePath)){const baseline=JSON.parse(readFileSync(baselinePath));if(!baseline.closed)verifyOwner(store,baseline);}atomicJson(reportPath,{status:'NO_QUALIFIED_IMPROVEMENT',sourceCommit:git('rev-parse','HEAD'),productionDeployed:false});atomicJson(baselinePath,{closed:true});rmSync(lock,{recursive:true,force:true});return;}
  const evaluate=async()=>{
    const corpus=JSON.parse(readFileSync(join(ROOT,CORPUS),'utf8'));
    const outputs=executeParserRequests(join(ROOT,TARGET),corpus.cases.map(c=>c.input));let i=0;
    return scoreCases(corpus.cases,()=>outputs[i++]);
  };
  if(stage==='close'){
    const baseline=JSON.parse(readFileSync(baselinePath)),report=JSON.parse(readFileSync(reportPath));
    verifyOwner(store,baseline);
    const head=git('rev-parse','HEAD');
    validateAcceptance({baseline,report,head,parent:git('rev-parse','HEAD^'),parentCount:git('rev-list','--parents','-n','1','HEAD').split(/\s+/).length-1,
      paths:git('diff','--name-only',baseline.sourceCommit,head,'--').split('\n').filter(Boolean),candidateDigest:hash(TARGET)});
    if(git('status','--porcelain')||canonical(baseline.frozen)!==canonical(frozenInputs()))throw new Error('Acceptance requires unchanged evaluator and clean source');
    const accepted={...report,status:'ACCEPTED_ON_FEATURE_BRANCH',acceptedCommit:head,productionDeployed:false};
    atomicJson(join(store,'history',head+'.json'),accepted);atomicJson(reportPath,accepted);atomicJson(baselinePath,{...baseline,closed:true});rmSync(lock,{recursive:true,force:true});
    console.log(JSON.stringify({status:accepted.status,acceptedCommit:head,productionDeployed:false}));return;
  }
  if(stage==='begin'){
    if(git('status','--porcelain'))throw new Error('Begin requires a clean isolated worktree; commit the corpus/evaluator before proposing a repair');
    if(existsSync(baselinePath)&&!JSON.parse(readFileSync(baselinePath)).closed)throw new Error('An experiment is already open; inspect it before aborting');
    const ownerId=randomUUID(),sourceCommit=git('rev-parse','HEAD');
    mkdirSync(lock); // Held across separate agent turns/stages; stale locks require inspection.
    atomicJson(join(lock,'owner.json'),{ownerId,sourceCommit});
    const frozen=frozenInputs(),score=await evaluate();
    const gates=runGates(GATES.filter(g=>['instruction-contracts','plain-english-showcase','assertion-engine'].includes(g.id)));
    if(gates.some(g=>!g.passed)||canonical(frozen)!==canonical(frozenInputs()))throw new Error('Baseline regressions or evaluator mutation');
    const baseline={schema:'spe.real-parser-evolution.v1',ownerId,sourceCommit,targetDigest:hash(TARGET),frozen,score,gates,closed:false,observedAt:new Date().toISOString()};
    atomicJson(baselinePath,baseline);console.log(JSON.stringify({status:'BASELINE_MEASURED',sourceCommit:baseline.sourceCommit,score}));return;
  }
  if(!existsSync(baselinePath))throw new Error('No baseline: run begin first');
  const baseline=JSON.parse(readFileSync(baselinePath));
  verifyOwner(store,baseline);
  if(baseline.closed||git('rev-parse','HEAD')!==baseline.sourceCommit)throw new Error('Baseline closed or HEAD changed');
  if(canonical(baseline.frozen)!==canonical(frozenInputs()))throw new Error('Frozen evaluator or non-target source changed');
  const paths=git('diff','--name-only','HEAD','--').split('\n').filter(Boolean);
  if(paths.length!==1||paths[0]!==TARGET||git('ls-files','--others','--exclude-standard'))throw new Error('Only the approved parser target may change during an experiment');
  git('diff','--check');
  const candidateDigest=hash(TARGET),score=await evaluate(),comparison=compareScores(baseline.score,score);
  const gates=comparison.accepted?runGates(GATES):[];
  const accepted=comparison.accepted&&gates.every(g=>g.passed)&&candidateDigest===hash(TARGET)&&canonical(baseline.frozen)===canonical(frozenInputs());
  const report={schema:'spe.real-parser-evolution.v1',status:accepted?'CANDIDATE_QUALIFIED':'HELD',baselineCommit:baseline.sourceCommit,
    baseline:baseline.score,candidate:score,comparison,gates,candidateDigest,observedAt:new Date().toISOString(),
    modelTrainingPerformed:false,productionDeployed:false,scope:'FINITE_PUBLIC_PARSER_CORPUS'};
  atomicJson(reportPath,report);console.log(JSON.stringify(report));if(!accepted)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await main();}catch(e){atomicJson(join(ROOT,'.spe/brain-evolution/last-attempt.json'),{status:'HELD',reason:e.message,observedAt:new Date().toISOString(),productionDeployed:false});console.error('Brain experiment held: '+e.message);process.exitCode=1;}
}
