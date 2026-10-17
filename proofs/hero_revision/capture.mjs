import {chromium} from '../../../spe-audit-tools/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('./',import.meta.url).pathname;
const round=process.argv[2]||'round1';const dir=root+round;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
for(const [name,width,height,theme,motion] of [['dark-desktop',1440,1000,'dark','no-preference'],['light-desktop',1440,1000,'light','no-preference'],['mobile',390,844,'dark','no-preference'],['tablet',768,1000,'dark','no-preference'],['reduced-motion',1440,1000,'dark','reduce']]) {
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width,height},reducedMotion:motion,recordVideo:{dir,size:{width,height}}});
 await c.addInitScript(t=>localStorage.setItem('spe-theme',t),theme);const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4194',{waitUntil:'networkidle'});
 await p.waitForTimeout(800);
 if(motion!=='reduce') {
   if(width<1101) await p.locator('.sns-engine').scrollIntoViewIfNeeded();
   await p.waitForTimeout(12000);
   await p.getByRole('button',{name:'Show prompt step',exact:true}).click();
   await p.waitForTimeout(1500);
 }
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.screenshot({path:`${dir}/${name}.png`});await p.locator('.hero-theater').screenshot({path:`${dir}/${name}-hero.png`});
 if(width<1101) { await p.locator('.sns-artifact').scrollIntoViewIfNeeded();await p.waitForTimeout(1500); }
 results.push({name,errors,title:await p.locator('#hero-title').innerText(),requests:await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize}))) });
 const video=p.video();await c.close();await video.saveAs(`${dir}/${name}.webm`);await video.delete();
}
await browser.close();writeFileSync(`${dir}/capture.json`,JSON.stringify(results,null,2));console.log(round+' captures complete');
