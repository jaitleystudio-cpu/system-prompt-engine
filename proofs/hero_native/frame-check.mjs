import {chromium} from '../../../spe-audit-tools/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
for(const phase of ['before','after']) for(let run=1;run<=3;run++) {
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 const page=await c.newPage(); await page.addInitScript(()=>{window.heroPerf={shifts:[],tasks:[]};new PerformanceObserver(l=>window.heroPerf.shifts.push(...l.getEntries().filter(e=>!e.hadRecentInput).map(e=>e.value))).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>window.heroPerf.tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 await page.goto(`http://127.0.0.1:${phase==='before'?4195:4194}`,{waitUntil:'networkidle'});
 const timing=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let prev=performance.now();const start=prev;function frame(now){samples.push(now-prev);prev=now;if(now-start<2500)requestAnimationFrame(frame);else {samples.sort((a,b)=>a-b);resolve({samples:samples.length,p95FrameIntervalMs:samples[Math.floor(samples.length*.95)],maxFrameIntervalMs:samples.at(-1),CLS:window.heroPerf.shifts.reduce((a,b)=>a+b,0),longTasks:window.heroPerf.tasks});}}requestAnimationFrame(frame);}));
 results.push({phase,run,...timing});await c.close();
}
await browser.close();writeFileSync(new URL('./frame-check.json',import.meta.url),JSON.stringify({note:'Three local headless Chrome runs each. Animation-start sample, not a device or field performance guarantee.',results},null,2));console.log(results);
