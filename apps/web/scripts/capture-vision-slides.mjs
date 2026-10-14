import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwrightPkg from '../node_modules/playwright/index.js';

const { chromium } = playwrightPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const htmlPath = path.resolve(__dirname, '../public/spe-ambient-vision-slides.html');
const artifactDir = '/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375';

const slides = [
  { id: '#slide-1', file: 'slide_1_copy_paste_prison.png' },
  { id: '#slide-2', file: 'slide_2_cursor_familiars.png' },
  { id: '#slide-3', file: 'slide_3_research_theater.png' },
  { id: '#slide-4', file: 'slide_4_voice_conductor.png' },
  { id: '#slide-5', file: 'slide_5_dual_language_protocol.png' },
  { id: '#slide-6', file: 'slide_6_master_roadmap.png' },
];

async function captureSlides() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  for (const slide of slides) {
    const locator = page.locator(slide.id);
    const outPath = path.join(artifactDir, slide.file);
    await locator.screenshot({ path: outPath });
    console.log(`Captured ${outPath}`);
  }

  await browser.close();
}

captureSlides().catch((err) => {
  console.error(err);
  process.exit(1);
});
