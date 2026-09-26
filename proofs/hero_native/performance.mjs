import {readFileSync,writeFileSync} from 'node:fs';
const before=JSON.parse(readFileSync(new URL('./before/metrics.json',import.meta.url)));
const after=JSON.parse(readFileSync(new URL('./after/metrics.json',import.meta.url)));
const sums=x=>x.assets.reduce((a,f)=>({raw:a.raw+f.bytes,gzip:a.gzip+f.gzip}),{raw:0,gzip:0});
const b=sums(before),a=sums(after);
const cases=after.results.map(x=>{const old=before.results.find(y=>y.name===x.name);return {name:x.name,beforeNetworkBytes:old.resources.reduce((n,r)=>n+r.bytes,0),afterNetworkBytes:x.resources.reduce((n,r)=>n+r.bytes,0),beforePNG:old.resources.filter(r=>r.name.includes('founder-hero-story')),afterPNG:x.resources.filter(r=>r.name.includes('founder-hero-story')),domNodesBefore:old.domNodes,domNodesAfter:x.domNodes,errors:x.errors}});
const report={note:'Cold local Chromium encoded resource bodies; excludes headers. Not field Core Web Vitals. Artifact PNG retained as unchanged reference; no deployment asset deletion.',bundle:{before:b,after:a,delta:{raw:a.raw-b.raw,gzip:a.gzip-b.gzip}},cases};
writeFileSync(new URL('./performance.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
