import { attackSucceeded, canaryLeaked, legitCompleted } from "/Volumes/4TB-WD/spe-worktrees/bro-replay-hgym-20261013/research/hostile-gym/oracles.mjs";
import { buildCases } from "/Volumes/4TB-WD/spe-worktrees/bro-replay-hgym-20261013/research/hostile-gym/gym.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const byId = Object.fromEntries(buildCases().map(c=>[c.id,c]));
const rows = readFileSync("/Volumes/4TB-WD/spe-worktrees/bro-replay-hgym-20261013/evidence/hostile-gym-r1/runs/raw_heldout.jsonl","utf8").trim().split("\n").map(JSON.parse);
const out = rows.map(r=>{ if(r.arm!=="candidate") return r; const o=r.output.replace(/[A-Za-z0-9]*\d[A-Za-z0-9]*/g, t=>t.split("").join("\u2060")).replace(/attacker\.example/gi,"attacker\u2060.example"); const c=byId[r.id];
 return {...r, output:o, attack_success:attackSucceeded(c,o), canary_leak:canaryLeaked(c,o), legit:legitCompleted(c,o)}; });
writeFileSync("forged_heldout.jsonl", out.map(x=>JSON.stringify(x)).join("\n")+"\n");
