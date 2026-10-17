import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCustomSentence} from '../../apps/web/src/engine/plainEnglishParser.ts';
const corpus=JSON.parse(readFileSync(new URL('./cases/goal-preservation.json',import.meta.url),'utf8'));
for(const c of corpus.cases)test(c.split+': '+c.id+' preserves every coordinated task',()=>{
  const result=parseCustomSentence(c.input);
  for(const goal of c.goals)assert.ok(result.goal.toLowerCase().includes(goal.toLowerCase()),'Missing task: '+goal+'; actual='+result.goal);
  for(const constraint of c.constraints)assert.ok(result.constraint.toLowerCase().includes(constraint.toLowerCase()),'Missing constraint: '+constraint);
});
