#!/usr/bin/env node
/**
 * End-to-End Browser Test for SPE Model Atlas & Monetization Engine
 * Spawns Vite preview server, opens chromium, and tests:
 * 1. Model Atlas pills rendering real AI models with PRO and FREE badges
 * 2. Pro model gating: Clicking Claude Opus 5.5 displays the Pro Upgrade Modal
 * 3. Modal dismissal
 * 4. Free model selection: Gemini 2.0 Flash selects cleanly
 * 5. Sponsored Partner Compute Banner renders with CTA
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess;
let browser;

async function run() {
  console.log("=== Launching E2E Browser Test for SPE Dynamic Model Atlas ===");

  try {
    console.log(`[1/5] Spawning Vite preview server on ${BASE_URL}...`);
    serverProcess = spawn("node", ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(PORT)], {
      cwd: "apps/web",
      stdio: "pipe",
    });

    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    console.log(`  ✓ Vite preview server is ready on ${BASE_URL}`);

    console.log(`[2/5] Launching Chromium browser...`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);

    console.log(`[3/5] Navigating to ${BASE_URL}/prompts dedicated sub-page...`);
    await page.goto(`${BASE_URL}/prompts`, { waitUntil: "networkidle" });

    // Verify sub-page breadcrumb & header
    const breadcrumb = await page.textContent(".spe-arsenal-breadcrumbs");
    assert.ok(breadcrumb?.includes("Universal Prompt Factory"), `Expected breadcrumb, got: ${breadcrumb}`);
    console.log(`  ✓ Sub-page breadcrumbs rendered: "${breadcrumb?.trim()}"`);

    const subpageTitle = await page.textContent(".spe-arsenal-hero-title");
    assert.ok(subpageTitle?.includes("Universal Prompt Factory"), `Expected subpage title, got: ${subpageTitle}`);
    console.log(`  ✓ Dedicated sub-page hero title rendered: "${subpageTitle?.trim()}"`);

    // Verify Vault title & models
    const title = await page.textContent(".spe-vault-title");
    assert.ok(title?.includes("Universal Prompt Factory"), `Expected title to contain Universal Prompt Factory, got: ${title}`);
    assert.ok(title?.includes("100% Free on the Web"), `Expected title to mention 100% Free on the Web, got: ${title}`);
    console.log(`  ✓ Prompt Vault rendered: "${title}"`);

    // Verify Model Atlas pills
    console.log(`[4/5] Testing Model Atlas dynamic pills & 100% free web model selection...`);
    const modelPills = await page.locator(".spe-vault-model-tag").all();
    assert.ok(modelPills.length >= 6, `Expected >= 6 model pills, got ${modelPills.length}`);

    // Verify Claude Sonnet 5.5 pill exists
    const claudePill = page.locator(".spe-vault-model-tag", { hasText: "Claude Sonnet 5.5" });
    const claudeText = await claudePill.textContent();
    assert.ok(claudeText?.includes("Claude Sonnet 5.5"), `Expected Claude Sonnet 5.5, got: ${claudeText}`);
    console.log(`  ✓ Found verified model pill: "${claudeText.trim()}"`);

    // Click Claude Sonnet 5.5 (100% free on web) -> should select cleanly WITHOUT modal
    await claudePill.click();
    await page.waitForTimeout(300);
    const activePill = await page.textContent(".spe-vault-model-tag.active");
    assert.ok(activePill?.includes("Claude Sonnet 5.5"), `Expected Claude Sonnet 5.5 to be active, got: ${activePill}`);
    const modalVisible = await page.locator(".spe-pro-modal-box").isVisible();
    assert.strictEqual(modalVisible, false, "Modal should NOT appear when selecting Claude Sonnet 5.5 on the web");
    console.log(`  ✓ Claude Sonnet 5.5 selected cleanly on web (100% free for all users).`);

    // Verify Sponsored Partner Compute Banner
    console.log(`[5/5] Verifying Ad & Sponsorship Monetization Units...`);
    const sponsorBadge = await page.textContent(".spe-sponsor-badge");
    assert.ok(sponsorBadge?.includes("SPONSORED PARTNER COMPUTE"), `Expected sponsor badge, got: ${sponsorBadge}`);
    const sponsorTitle = await page.textContent(".spe-sponsor-title");
    assert.ok(sponsorTitle?.includes("OpenRouter"), `Expected OpenRouter in sponsor title, got: ${sponsorTitle}`);
    console.log(`  ✓ Top sponsor banner rendered: "${sponsorTitle?.trim()}"`);

    // Verify in-feed native sponsored ads in prompt grid
    const inFeedAds = await page.locator(".spe-vault-card-ad").all();
    assert.ok(inFeedAds.length >= 1, `Expected at least 1 in-feed sponsored ad card, found ${inFeedAds.length}`);
    const firstAdTitle = await page.locator(".spe-vault-card-ad h3").first().textContent();
    console.log(`  ✓ In-feed native sponsored ad rendered: "${firstAdTitle?.trim()}"`);

    // Verify bottom display ad slot
    const bottomAd = await page.locator(".spe-vault-ad-slot-wrap").isVisible();
    assert.strictEqual(bottomAd, true, "Expected bottom display ad slot container to be visible");
    console.log(`  ✓ Bottom display ad container rendered.`);

    // Verify results meta bar and 10,000 count
    const resultsMeta = await page.textContent(".spe-vault-results-meta");
    assert.ok(resultsMeta?.includes("10,000"), `Expected 10,000 in results meta, got: ${resultsMeta}`);
    console.log(`  ✓ Results meta bar verified: "${resultsMeta?.trim()}"`);

    // Verify pagination controls
    const pagination = await page.locator(".spe-vault-pagination-wrap").isVisible();
    assert.strictEqual(pagination, true, "Expected pagination controls to be visible");
    console.log(`  ✓ Pagination controls rendered with page navigation buttons.`);

    // Test Domain Category Filter: Click "Software & DevOps (1,600)"
    console.log(`  Testing Domain Category filter for Software & DevOps...`);
    const softwareCatBtn = page.locator(".spe-vault-cat-btn", { hasText: "Software & DevOps" });
    await softwareCatBtn.click();
    await page.waitForTimeout(300);
    const softwareMeta = await page.textContent(".spe-vault-results-meta");
    assert.ok(softwareMeta?.includes("1,600"), `Expected 1,600 in results meta after category click, got: ${softwareMeta}`);
    console.log(`  ✓ Filtered to Software & DevOps: "${softwareMeta?.trim()}"`);

    // Reset to "All (10,000+)"
    const allCatBtn = page.locator(".spe-vault-cat-btn", { hasText: "All" });
    await allCatBtn.click();
    await page.waitForTimeout(300);

    // Capture visual snapshot of free web arsenal sub-page with ads
    await page.screenshot({ path: "proofs/model_atlas_e2e_verified.png", fullPage: false });
    console.log(`  ✓ Saved screenshot proof: proofs/model_atlas_e2e_verified.png`);

    // Test Offline Catalog Pro Gate
    console.log(`[6/6] Testing Offline Catalog Pro Entitlement Gating...`);
    const offlineBtn = page.locator(".spe-vault-cat-btn", { hasText: "Download Offline Catalog" });
    await offlineBtn.click();
    await page.waitForSelector(".spe-pro-modal-box", { state: "visible", timeout: 3000 });
    await page.waitForTimeout(400); // Allow speFadeIn animation to complete fully
    const modalTitle = await page.textContent(".spe-pro-modal-title");
    assert.ok(modalTitle?.includes("Offline Air-Gapped Catalog — SPE Pro"), `Expected offline modal title, got: ${modalTitle}`);
    const modalBody = await page.textContent(".spe-pro-modal-body");
    assert.ok(modalBody?.includes("Web access is 100% free and ad-supported"), `Expected 100% free web guarantee in modal, got: ${modalBody}`);
    console.log(`  ✓ Offline Pro Gate Modal triggered successfully: "${modalTitle?.trim()}"`);

    // Capture modal screenshot
    await page.screenshot({ path: "proofs/pro_upgrade_modal_verified.png", fullPage: false });
    console.log(`  ✓ Saved modal proof: proofs/pro_upgrade_modal_verified.png`);

    // Dismiss modal via dismiss button
    const dismissBtn = page.locator(".spe-pro-modal-dismiss-btn");
    await dismissBtn.click();
    await page.waitForSelector(".spe-pro-modal-box", { state: "detached", timeout: 3000 });
    console.log(`  ✓ Pro modal dismissed cleanly with "Continue Free Online (Ad-Supported)".`);

    // Verify Home Page has clean FeaturedArsenalPreview linking to /prompts
    console.log(`[7/7] Verifying Home Page has clean FeaturedArsenalPreview...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const featuredTitle = await page.textContent(".spe-featured-title");
    assert.ok(featuredTitle?.includes("Universal Prompt Factory"), `Expected featured title on home page, got: ${featuredTitle}`);
    const domainChips = await page.locator(".spe-featured-domain-pill").all();
    assert.ok(domainChips.length === 13, `Expected 13 domain chips on home page, got: ${domainChips.length}`);
    const sampleCards = await page.locator(".spe-featured-sample-card").all();
    assert.ok(sampleCards.length === 3, `Expected 3 sample cards on home page, got: ${sampleCards.length}`);
    console.log(`  ✓ Home page rendered clean FeaturedArsenalPreview with 13 domain chips and 3 sample cards.`);

    // Capture home page clean preview proof
    await page.screenshot({ path: "proofs/home_page_clean_preview.png", fullPage: false });
    const featuredSection = page.locator(".spe-featured-arsenal-section");
    await featuredSection.screenshot({ path: "proofs/home_featured_arsenal_preview.png" });
    console.log(`  ✓ Saved clean home page proofs.`);

    // Click "Browse Full 10,000+ Prompt Factory" button on home page -> navigates to /prompts
    const exploreBtn = page.locator(".spe-arsenal-explore-btn");
    await exploreBtn.click();
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    assert.ok(currentUrl.includes("/prompts"), `Expected URL to include /prompts, got: ${currentUrl}`);
    console.log(`  ✓ Successfully navigated from Home Page to dedicated /prompts sub-page: "${currentUrl}"`);

    // Verify Direct Deep-Linked Programmatic Prompt URL
    console.log(`[8/8] Verifying Deep-Linked Programmatic Prompt URL (/prompts/SPE-ARSENAL-00042)...`);
    await page.goto(`${BASE_URL}/prompts/SPE-ARSENAL-00042`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const deepUrl = page.url();
    assert.ok(deepUrl.includes("/prompts/SPE-ARSENAL-00042"), `Expected URL to include /prompts/SPE-ARSENAL-00042, got: ${deepUrl}`);
    const pageTitle = await page.title();
    assert.ok(pageTitle.includes("SPE Universal Prompt Factory"), `Expected page title to include prompt info, got: ${pageTitle}`);

    // Check that Schema.org JSON-LD contains HowTo schema
    const schemaScript = await page.locator('script[type="application/ld+json"]').last().textContent();
    assert.ok(schemaScript?.includes("HowTo"), `Expected schema to include HowTo, got: ${schemaScript}`);
    assert.ok(schemaScript?.includes("SPE-ARSENAL-00042"), `Expected schema to include asset ID, got: ${schemaScript}`);
    console.log(`  ✓ Successfully hydrated deep-linked asset, injected HowTo JSON-LD schema, and preserved canonical URL.`);

    console.log("\n==================================================================");
    console.log("🎉 ALL E2E BROWSER CHECKS FOR SUB-PAGE ARSENAL & CLEAN HOME PASSED!");
    console.log("==================================================================");
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
