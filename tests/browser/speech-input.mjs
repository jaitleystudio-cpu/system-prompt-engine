// Run with SPE_PLAYWRIGHT_MODULE pointing to an installed Playwright entry.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.SPE_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, channel: "chrome"});
try {
  const page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.speechTest = this; }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    };
  });
  await page.goto(process.env.SPE_TEST_URL || 'http://127.0.0.1:4180/#prompt-studio');
  await page.getByRole('button',{name:'Open workspace'}).click();
  await page.getByText('Speak your idea', {exact:true}).click();
  const start = page.getByRole('button',{name:'Start microphone',exact:true});
  assert(await start.isDisabled());
  await page.getByLabel('Allow browser speech recognition for this session').check();
  await page.locator('.spe-ws-side > label textarea').fill('Keep my original goal.');
  await start.click();
  await page.evaluate(() => window.speechTest.onresult({results:[{isFinal:true,0:{transcript:'Build a portfolio for my photography.'}}]}));
  assert(await page.getByRole('button',{name:'Add transcript to idea',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Stop microphone',exact:true}).click();
  await page.getByRole('button',{name:'Add transcript to idea',exact:true}).click();
  assert.equal(await page.locator('.spe-ws-side > label textarea').inputValue(),'Keep my original goal.\n\nBuild a portfolio for my photography.');
  await start.click();
  await page.evaluate(() => { window.speechTest.onerror({error:'not-allowed'}); window.speechTest.onend(); });
  assert.match(await page.getByRole('alert').last().innerText(), /denied/);
  assert.equal(await page.locator('.spe-ws-side > label textarea').inputValue(),'Keep my original goal.\n\nBuild a portfolio for my photography.');
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => { window.SpeechRecognition=undefined; window.webkitSpeechRecognition=undefined; });
  await unsupported.goto(process.env.SPE_TEST_URL || 'http://127.0.0.1:4180/#prompt-studio');
  await unsupported.getByRole('button',{name:'Open workspace'}).click();
  await unsupported.getByText('Speak your idea',{exact:true}).click();
  assert(await unsupported.getByText('Speech recognition is unavailable in this browser.',{exact:false}).isVisible());
  console.log('PASS: consent, dictation review, preserves existing idea, denied access, unsupported browser. Mock recognition; no live microphone claim.');
} finally { await browser.close(); }
