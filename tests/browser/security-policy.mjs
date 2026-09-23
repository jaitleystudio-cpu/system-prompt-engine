import assert from 'node:assert/strict';
const { chromium } = await import(process.env.SPE_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
 const page = await browser.newPage();
 await page.addInitScript(() => { window.policyViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.policyViolations.push(e.violatedDirective)); });
 await page.goto(process.env.SPE_TEST_URL || 'http://127.0.0.1:4181/');
 assert(await page.locator('meta[http-equiv="Content-Security-Policy"]').count());
 await page.getByRole('button',{name:'Open workspace'}).click();
 await page.locator('.spe-ws-side > label textarea').fill('Write a detailed launch plan for my photography portfolio.');
 await page.getByRole('button',{name:'Shape my prompt',exact:true}).click();
 await page.waitForFunction(()=>document.body.innerText.includes('## Objective'));
 assert.deepEqual(await page.evaluate(()=>window.policyViolations),[]);
 console.log('PASS: browser WASM compilation works under CSP without policy violations.');
} finally {await browser.close();}
