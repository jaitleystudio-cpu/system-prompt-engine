import { chromium } from '../../../spe-audit-tools/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const phase = process.argv[2] || 'before';
const out = new URL(`./${phase}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const results=[];
for (const [name,width,height,theme,motion] of [['dark-desktop',1440,1000,'dark','no-preference'],['light-desktop',1440,1000,'light','no-preference'],['mobile',390,844,'dark','no-preference'],['reduced-motion',1440,1000,'dark','reduce']]) {
 if(process.env.HERO_CASE && name!==process.env.HERO_CASE) continue;
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height},deviceScaleFactor:1,reducedMotion:motion,recordVideo:{dir:out,size:{width,height}}});
 await context.addInitScript(t=>localStorage.setItem('spe-theme',t),theme);
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.HERO_URL || 'http://127.0.0.1:4194/',{waitUntil:'networkidle'});
 if(phase==='after' && width<700) {
  await page.waitForTimeout(800);
  for(const section of await page.locator('.sns-sequence > section').all()) {await section.scrollIntoViewIfNeeded();await page.waitForTimeout(1700);}
  await page.getByRole('heading',{level:1}).scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
 } else await page.waitForTimeout(phase==='after'?10500:1200);
 await page.screenshot({path:`${out}${name}.png`});
 await page.locator('.hero-theater').screenshot({path:`${out}${name}-hero.png`});
 if(width<700) { await page.locator('.hero-stage').scrollIntoViewIfNeeded(); await page.waitForTimeout(1800); }
 await page.waitForTimeout(8500);
 const metrics=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize})),domNodes:document.querySelectorAll('*').length,overflow:document.documentElement.scrollWidth>innerWidth}));
 const video=page.video(); await context.close(); await video.saveAs(`${out}${name}.webm`); await video.delete();
 results.push({name,errors,...metrics});
}
await browser.close();
const assets=readdirSync(new URL(process.env.HERO_DIST || '../../apps/web/dist/assets/',import.meta.url)).filter(x=>/\.(js|css)$/.test(x)).map(name=>{const b=readFileSync(new URL((process.env.HERO_DIST || '../../apps/web/dist/assets/')+name,import.meta.url));return {name,bytes:b.length,gzip:gzipSync(b).length}});
const previous=process.env.HERO_CASE?JSON.parse(readFileSync(`${out}metrics.json`)).results.filter(r=>r.name!==process.env.HERO_CASE):[];
writeFileSync(`${out}metrics.json`,JSON.stringify({results:[...previous,...results],assets},null,2));
console.log(`${phase}: four screenshots, hero crops, videos and metrics captured`);
