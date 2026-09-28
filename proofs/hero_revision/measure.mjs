import {chromium} from '../../../spe-audit-tools/node_modules/playwright/index.mjs';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const dir=new URL('./',import.meta.url).pathname;
const before=JSON.parse(readFileSync(dir+'../hero_native/after/metrics.json'));
const original=JSON.parse(readFileSync(dir+'../hero_native/before/metrics.json'));
const assets=readdirSync('apps/web/dist/assets').filter(x=>/\.(css|js)$/.test(x)).map(name=>{const b=readFileSync('apps/web/dist/assets/'+name);return{name,bytes:b.length,gzip:gzipSync(b).length}});
const sum=a=>a.reduce((n,f)=>n+f.gzip,0);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const runs=[];
for(let run=0;run<3;run++){
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 const p=await c.newPage();await p.addInitScript(()=>{window.heroPerf={shifts:[],tasks:[]};new PerformanceObserver(l=>window.heroPerf.shifts.push(...l.getEntries().filter(e=>!e.hadRecentInput).map(e=>e.value))).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>window.heroPerf.tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 await p.goto('http://127.0.0.1:4194',{waitUntil:'networkidle'});
 const result=await p.evaluate(()=>new Promise(resolve=>{const samples=[];let prev=performance.now();const start=prev;function frame(now){samples.push(now-prev);prev=now;if(now-start<3000)requestAnimationFrame(frame);else{samples.sort((a,b)=>a-b);resolve({p95FrameIntervalMs:samples[Math.floor(samples.length*.95)],maxFrameIntervalMs:samples.at(-1),CLS:window.heroPerf.shifts.reduce((a,b)=>a+b,0),longTasks:window.heroPerf.tasks,heroNodes:document.querySelector('.hero-theater').querySelectorAll('*').length,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize}))});}}requestAnimationFrame(frame);}));runs.push(result);await c.close();
}
const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},reducedMotion:'reduce',timezoneId:'UTC'});const p=await c.newPage();await p.clock.install({time:new Date('2026-09-27T12:00:00Z')});await p.goto('http://127.0.0.1:4194',{waitUntil:'domcontentloaded'});await p.waitForTimeout(300);await p.locator('.hero-copy').screenshot({path:dir+'daily-day1.png'});await p.clock.setSystemTime(new Date('2026-09-28T12:00:00Z'));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(100);await p.locator('.hero-copy').screenshot({path:dir+'daily-day2.png'});await c.close();await browser.close();
writeFileSync(dir+'performance.json',JSON.stringify({note:'Local Chromium samples, not field Core Web Vitals or a low-end device guarantee. Whole-app bundles include unchanged non-hero code.',bundleGzip:{originalPR:sum(original.assets),rejected:sum(before.assets),current:sum(assets),deltaFromRejected:sum(assets)-sum(before.assets),deltaFromPR:sum(assets)-sum(original.assets)},assets,runs},null,2));console.log('performance and daily-title evidence saved');
