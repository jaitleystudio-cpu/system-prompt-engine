#!/usr/bin/env node
import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173/prompts", { waitUntil: "networkidle" });
  
  // Click Download Offline Catalog (Pro) button
  const offlineBtn = page.locator(".spe-vault-cat-btn", { hasText: "Download Offline Catalog" });
  await offlineBtn.click();
  await page.waitForSelector(".spe-pro-modal-box", { state: "visible" });
  await page.waitForTimeout(400);
  
  await page.screenshot({ path: "proofs/pro_upgrade_modal_verified.png" });
  await browser.close();
  console.log("Captured proofs/pro_upgrade_modal_verified.png");
}

run().catch(console.error);
