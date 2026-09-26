#!/usr/bin/env node
/** Browser behavior checks for the hero. Run against the local production preview. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const base=process.env.HERO_URL || 'http://127.0.0.1:4194';
const results=[];
const check=(name,condition,detail='')=>{results.push({name,pass:!!condition,detail});console.log(`${condition?'PASS':'FAIL'} ${name} ${detail}`);};
try {
 for(const theme of ['dark','light','system']) for(const os of theme==='system'?['dark','light']:['dark']) {
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},colorScheme:os,reducedMotion:'reduce'});
  await context.addInitScript(t=>localStorage.setItem('spe-theme',t),theme);
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  check(`theme ${theme}/${os}`,await page.locator('html').getAttribute('data-theme')===(theme==='system'?os:theme));
  check(`all five stages ${theme}/${os}`,await page.locator('.sns-sequence > section').count()===5);
  check(`six real fragments ${theme}/${os}`,await page.locator('.sns-fragment').count()===6);
  check(`no production PNG or canvas ${theme}/${os}`,await page.locator('.hero-stage img,.hero-stage canvas').count()===0);
  check(`PNG not requested ${theme}/${os}`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(r=>r.name.includes('founder-hero-story'))));
  check(`reduced motion static ${theme}/${os}`,await page.locator('.spe-native-story').evaluate(e=>e.getAnimations({subtree:true}).length===0));
  check(`complete readable prompt ${theme}/${os}`,await page.locator('.sns-prompt-lines p').evaluateAll(es=>es.length===4&&es.every(e=>getComputedStyle(e).opacity==='1')));
  check(`semantic equivalent ${theme}/${os}`,(await page.locator('.spe-native-story').innerText()).includes('MESSY HUMAN THOUGHT → MEANING → SPE → STRUCTURE → PERFECT PROMPT'));
  if(process.env.AXE_PATH) {await page.route('**/hero-test-axe.js',route=>route.fulfill({contentType:'application/javascript',body:readFileSync(process.env.AXE_PATH,'utf8')}));await page.addScriptTag({url:base+'/hero-test-axe.js'}); const a=await page.evaluate(async()=>window.axe.run(document.querySelector('.hero-theater'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));check(`axe hero ${theme}/${os}`,a.violations.length===0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));}
  if(theme==='system') {await page.emulateMedia({colorScheme:os==='dark'?'light':'dark'});await page.waitForTimeout(100);check(`system live switch ${os}`,await page.locator('html').getAttribute('data-theme')!==(os));}
  check(`no runtime errors ${theme}/${os}`,errors.length===0,errors.join('; '));await context.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Pause story',exact:true}).focus();await page.keyboard.press('Enter');
 check('keyboard pause',await page.locator('.spe-native-story').getAttribute('data-paused')==='true');
 const times=()=>page.locator('.spe-native-story').evaluate(e=>e.getAnimations({subtree:true}).map(a=>a.currentTime));
 await page.waitForTimeout(100); // Allow the browser to apply the paused animation state.
 const t1=await times();await page.waitForTimeout(300);check('pause freezes timeline',JSON.stringify(t1)===JSON.stringify(await times()));
 await page.getByRole('button',{name:'Resume story',exact:true}).click();await page.waitForTimeout(250);check('resume advances timeline',JSON.stringify(t1)!==JSON.stringify(await times()));
 await page.emulateMedia({reducedMotion:'reduce'});check('live reduced motion change',await page.locator('.spe-native-story').evaluate(e=>e.getAnimations({subtree:true}).length===0));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(10500);check('finite story settles',await page.getByRole('button',{name:'Replay story',exact:true}).isVisible());
 await page.getByRole('button',{name:'Replay story',exact:true}).click();check('replay restarts',await page.getByRole('button',{name:'Pause story',exact:true}).isVisible());
 await page.locator('footer').last().scrollIntoViewIfNeeded();await page.waitForTimeout(100);check('offscreen animation paused',await page.locator('.spe-native-story').getAttribute('data-paused')==='true');
 for(const width of [320,390,700,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:900});await page.locator('#top').scrollIntoViewIfNeeded();
  const g=await page.evaluate(()=>{const f=document.querySelector('.spe-native-story').getBoundingClientRect(); const stages=[...document.querySelectorAll('.sns-sequence > section')].map(e=>e.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth,visible:f.width>200&&f.height>300,vertical:stages.every((r,i)=>i===0||r.top>=stages[i-1].bottom-1)};});
  check(`responsive ${width}`,!g.overflow&&g.visible&&(width>700||g.vertical),JSON.stringify(g));
 }
 await page.setViewportSize({width:640,height:900});await page.evaluate(()=>document.documentElement.style.zoom='2');check('200% zoom no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.close();
} finally {await browser.close();writeFileSync(new URL('../../../proofs/hero_native/tests.json',import.meta.url),JSON.stringify(results,null,2));}
assert.ok(results.every(r=>r.pass),'Hero checks failed');
console.log(`${results.length} hero checks passed`);
