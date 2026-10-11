import playwrightPkg from '../node_modules/playwright/index.js';
const { chromium } = playwrightPkg;
import fs from 'node:fs';
import path from 'node:path';

(async () => {
  const browser = await chromium.launch();
  const artifactDir = '/Users/prawinpalisetty/.gemini/antigravity/brain/df0e1f2e-b3c0-4b07-9f11-5f02c2e19375';
  const extensionDir = '/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/packages/spe-extension';

  const popupHtmlContent = fs.readFileSync(path.join(extensionDir, 'popup.html'), 'utf8');
  const popupJsContent = fs.readFileSync(path.join(extensionDir, 'popup.js'), 'utf8');
  const contentCss = fs.readFileSync(path.join(extensionDir, 'content.css'), 'utf8');

  // =========================================================================
  // 1. Popup Studio with Live Diff
  // =========================================================================
  {
    const page = await browser.newPage({ viewport: { width: 440, height: 600 }, deviceScaleFactor: 2 });
    let pageHtml = popupHtmlContent.replace('<script src="popup.js"></script>', `<script>${popupJsContent}</script>`);
    pageHtml = pageHtml.replace(
      '<head>',
      `<head><script>
        window.chrome = {
          storage: {
            local: {
              get: (k, cb) => cb({
                spe_daily_usage: {
                  date: new Date().toISOString().slice(0, 10),
                  count: 1,
                  limit: 15,
                  isPro: false,
                  clichesPurgedTotal: 4,
                  wordsPrunedTotal: 6,
                  estimatedValueDeliveredCents: 42
                }
              }),
              set: (d, cb) => cb && cb()
            }
          },
          runtime: {
            sendMessage: (m, cb) => cb && cb({ success: true })
          }
        };
      </script>`
    );
    await page.setContent(pageHtml);
    await page.waitForTimeout(300);

    const btnSample = await page.$('#spe-btn-sample');
    if (btnSample) await btnSample.click();
    await page.waitForTimeout(100);

    const btnHumanize = await page.$('#spe-action-humanize');
    if (btnHumanize) await btnHumanize.click();
    await page.waitForTimeout(200);

    const shotPath = path.join(artifactDir, 'preview_spe_popup_sandbox_diff.png');
    await page.screenshot({ path: shotPath });
    console.log('Saved preview 1 (Popup Studio):', shotPath);
    await page.close();
  }

  // =========================================================================
  // 2. Popup Frontier Vault
  // =========================================================================
  {
    const page = await browser.newPage({ viewport: { width: 440, height: 600 }, deviceScaleFactor: 2 });
    let pageHtml = popupHtmlContent.replace('<script src="popup.js"></script>', `<script>${popupJsContent}</script>`);
    pageHtml = pageHtml.replace(
      '<head>',
      `<head><script>
        window.chrome = {
          storage: {
            local: {
              get: (k, cb) => cb({
                spe_daily_usage: {
                  date: new Date().toISOString().slice(0, 10),
                  count: 0,
                  limit: 15,
                  isPro: false,
                  clichesPurgedTotal: 0,
                  wordsPrunedTotal: 0,
                  estimatedValueDeliveredCents: 0
                }
              }),
              set: (d, cb) => cb && cb()
            }
          },
          runtime: {
            sendMessage: (m, cb) => cb && cb({ success: true })
          }
        };
      </script>`
    );
    await page.setContent(pageHtml);
    await page.waitForTimeout(300);

    const tabVault = await page.$('#spe-tab-vault');
    if (tabVault) await tabVault.click();
    await page.waitForTimeout(200);

    const shotPath = path.join(artifactDir, 'preview_spe_popup_vault.png');
    await page.screenshot({ path: shotPath });
    console.log('Saved preview 2 (Popup Vault):', shotPath);
    await page.close();
  }

  // =========================================================================
  // 3. In-Chat Lift Companion (ChatGPT / Claude Dark Mode)
  // =========================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
    const chatHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      background: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Geist", system-ui, sans-serif;
      color: #ececec;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    .top-nav {
      height: 52px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      font-size: 13.5px;
      font-weight: 600;
    }
    .model-badge {
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11.5px;
      color: #a1a1aa;
    }
    .chat-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-bottom: 110px;
    }
    .center-greeting {
      font-size: 30px;
      font-weight: 600;
      letter-spacing: -0.03em;
      margin-bottom: 32px;
      color: #fff;
    }
    .composer-container {
      position: fixed;
      bottom: 40px;
      width: 760px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .composer-box {
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    }
    .composer-text {
      font-size: 15px;
      color: #fff;
    }
    .composer-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-enhance {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.28);
      color: #34d399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-send {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #ffffff;
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
    }
    ${contentCss}
  </style>
</head>
<body>
  <div class="top-nav">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 700;">ChatGPT</span>
      <span class="model-badge">GPT-6.1 / Claude 6.2 Sonnet Ready</span>
    </div>
    <div style="font-size: 12px; color: #71717a;">SPE Universal Companion Active</div>
  </div>

  <div class="chat-body">
    <div class="center-greeting">What are we building today?</div>
  </div>

  <div class="composer-container">
    <!-- Floating Specification Lift Badge -->
    <div style="background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: #fff;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>SPE Specification Lift Detected</span>
        </div>
        <span style="font-size: 11px; color: #34d399; font-family: 'SF Mono', monospace;">15,000w Verified Spec • Zero Drift</span>
      </div>
      <div style="font-size: 12px; color: #a1a1aa; line-height: 1.4;">
        Brief prompt <em>"build me a shopping app"</em> mapped to <strong>Product App Architecture & Relational Schema Contract</strong>. Invariants, TDD roadmap, and API contracts will be compiled client-side in 12ms.
      </div>
    </div>

    <!-- Active Input Box -->
    <div class="composer-box">
      <div class="composer-text">build me a shopping app</div>
      <div class="composer-bottom">
        <button class="btn-enhance">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          Enhance Specification
          <kbd style="font-size: 9.5px; opacity: 0.7; font-family: monospace;">↵</kbd>
        </button>
        <button class="btn-send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </button>
      </div>
    </div>
  </div>
</body>
</html>
`;
    await page.setContent(chatHtml);
    await page.waitForTimeout(300);

    const shotPath = path.join(artifactDir, 'preview_spe_chatgpt_lift.png');
    await page.screenshot({ path: shotPath });
    console.log('Saved preview 3 (ChatGPT Lift):', shotPath);
    await page.close();
  }

  // =========================================================================
  // 4. On-Page Document Hologram (Notion / Google Docs Simulation)
  // =========================================================================
  {
    const page = await browser.newPage({ viewport: { width: 1160, height: 780 }, deviceScaleFactor: 2 });
    const docHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      background: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Geist", system-ui, sans-serif;
      color: #f4f4f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 36px 20px;
      min-height: 100vh;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    .editor-container {
      width: 900px;
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 36px 52px 48px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      position: relative;
    }
    .doc-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .doc-icon {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: #1c1c21;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #a1a1aa;
    }
    .doc-title {
      font-size: 17px;
      font-weight: 600;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .doc-meta {
      font-size: 12px;
      color: #71717a;
    }
    .doc-paragraph {
      font-size: 15px;
      line-height: 1.7;
      color: #d4d4d8;
      margin: 0 0 28px 0;
    }
    .doc-selection-highlight {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border-radius: 4px;
      padding: 3px 6px;
      position: relative;
    }
    ${contentCss}
  </style>
</head>
<body>
  <div class="editor-container">
    <div class="doc-header">
      <div class="doc-title-row">
        <div class="doc-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        </div>
        <div class="doc-title">Q3 Product Architecture Brief.md</div>
      </div>
      <div class="doc-meta">Drafting in Notion / Google Docs • Auto-Saved</div>
    </div>

    <p class="doc-paragraph" style="margin-bottom: 44px;">
      Our principal software engineering thesis requires replacing manual testing with deterministic compile-time verification.
    </p>

    <!-- Floating Dynamic Island Pill -->
    <div id="spe-inline-action-bar" style="display: flex; position: absolute; top: 134px; left: 52px;">
      <div class="spe-bar-brand">
        <svg class="spe-bar-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>SPE</span>
      </div>
      <button class="spe-action-btn" id="spe-action-humanize">
        Humanize
        <kbd class="spe-btn-key">⌥1</kbd>
      </button>
      <button class="spe-action-btn" id="spe-action-executive">
        Executive
        <kbd class="spe-btn-key">⌥2</kbd>
      </button>
      <button class="spe-action-btn" id="spe-action-polish">
        Polish
        <kbd class="spe-btn-key">⌥3</kbd>
      </button>
      <button class="spe-action-btn" id="spe-action-lift">
        Prompt Lift
        <kbd class="spe-btn-key">⌥4</kbd>
      </button>
    </div>

    <p class="doc-paragraph" style="margin-top: 20px;">
      <span class="doc-selection-highlight">In today&#39;s fast-paced digital world, leveraging AI is a testament to innovation and plays a crucial role to delve into new opportunities.</span>
    </p>

    <!-- Simulated Live Transformation Diff Inspector -->
    <div id="spe-diff-modal" style="display: flex; position: absolute; top: 260px; left: 52px;">
      <div class="spe-diff-header">
        <div class="spe-diff-title-row">
          <div class="spe-diff-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path></svg>
          </div>
          <span class="spe-diff-title">Editorial Polish</span>
          <span class="spe-diff-mode-badge">70% Human Cadence</span>
        </div>
        <button class="spe-diff-close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="spe-diff-stats-strip">
        <span class="spe-stat-tag">4 Clichés Purged</span>
        <span class="spe-stat-sep">•</span>
        <span class="spe-stat-tag">6 Words Pruned</span>
        <span class="spe-stat-sep">•</span>
        <span class="spe-stat-tag emerald">Zero AI Drift</span>
      </div>

      <div class="spe-diff-body">
        <span class="spe-diff-del">In</span> <span class="spe-diff-del">today&#39;s</span> <span class="spe-diff-del">fast-paced</span> <span class="spe-diff-del">digital</span> <span class="spe-diff-del">world,</span> <span class="spe-diff-ins">today,</span> <span class="spe-diff-same">leveraging AI is</span> <span class="spe-diff-del">a</span> <span class="spe-diff-del">testament</span> <span class="spe-diff-del">to</span> <span class="spe-diff-ins">proof</span> <span class="spe-diff-ins">of</span> <span class="spe-diff-same">innovation and plays a</span> <span class="spe-diff-del">crucial</span> <span class="spe-diff-ins">key</span> <span class="spe-diff-same">role to</span> <span class="spe-diff-del">delve</span> <span class="spe-diff-del">into</span> <span class="spe-diff-ins">explore</span> <span class="spe-diff-same">new opportunities.</span>
      </div>

      <div class="spe-diff-footer">
        <div class="spe-diff-meta">
          <span class="spe-status-dot"></span>
          <span>100% Offline Core</span>
        </div>
        <div class="spe-diff-actions">
          <button class="spe-diff-btn-copy" id="spe-diff-btn-copy">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
          <button class="spe-diff-btn-apply" id="spe-diff-btn-apply">
            Replace
            <kbd>↵</kbd>
          </button>
        </div>
      </div>
    </div>

    <p class="doc-paragraph" style="margin-top: 310px;">
      By enforcing pre-commit verification gates, customer data confidentiality remains uncompromised across all remote inference providers.
    </p>
  </div>
</body>
</html>
`;
    await page.setContent(docHtml);
    await page.waitForTimeout(300);

    const shotPath = path.join(artifactDir, 'preview_spe_document_hologram.png');
    await page.screenshot({ path: shotPath });
    console.log('Saved preview 4 (Document Hologram):', shotPath);
    await page.close();
  }

  await browser.close();
  console.log('All 4 luxury previews captured successfully!');
})();
