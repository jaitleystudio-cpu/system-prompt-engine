// SPE Extension Popup Controller (Awwwards / Linear-Tier Refined UI)
import { speBrowser } from "./src/browserCompat.js";
import { EntitlementManager, SUBSCRIPTION_TIERS } from "./src/entitlementManager.js";
import { SpeAutoActionsEngine } from "./src/autoActionsEngine.js";
import { POWER_PROMPTS_VAULT } from "./src/promptsData.js";

const VAULT = Array.isArray(POWER_PROMPTS_VAULT) && POWER_PROMPTS_VAULT.length > 0
  ? POWER_PROMPTS_VAULT
  : [
      {
        id: "code-fullstack-feature-architect",
        title: "Full-Stack Feature Blueprint",
        tagline: "Architect complete features with typed schemas, API contracts & tests",
        category: "Architecture",
        template: `Act as a Principal Full-Stack Software Architect. Design a production-grade implementation blueprint. Include: Domain types & database schemas, API request/response contracts, 5 critical edge cases / failure modes with mitigations, and phased step-by-step TDD checklist.`
      },
      {
        id: "write-100-percent-humanizer",
        title: "Editorial Prose & Voice Humanizer",
        tagline: "Strip generic robotic AI prose and rewrite in authentic, punchy human cadence",
        category: "Editorial",
        template: `Act as an award-winning editor and literary essayist. Rewrite the provided text into authentic, compelling, natural human prose. Invariants: Completely purge AI clichés (delve, tapestry, crucial, testament, realm, fast-paced world). Vary sentence lengths for musical rhythm. Use active verbs and concrete specifics.`
      },
      {
        id: "seo-outrank-competitor",
        title: "Search Dominance & E-E-A-T Guide",
        tagline: "Outrank competitor content with deep empirical evidence & zero fluff",
        category: "Growth",
        template: `Act as an authoritative SEO strategist. Write a comprehensive, search-dominant guide targeting the primary keyword. Answer search intent within the first 100 words. Provide H2/H3 subheadings, comparison table, step-by-step guidance, and 4 FAQs. Voice: natural human, zero generic AI clichés.`
      },
      {
        id: "copy-high-converting-landing-page",
        title: "Direct-Response Conversion Matrix",
        tagline: "Landing page architecture: Hero narrative, friction removal & risk reversal",
        category: "Conversion",
        template: `Act as a world-class Direct-Response Copywriter. Write complete high-converting landing page copy. Include: Above-the-fold Hero (Headline, Subhead, CTA), Problem Agitation (PAS), 3 Benefit Blocks (Feature -> Human Transformation), and Risk-Free Guarantee CTA.`
      },
      {
        id: "biz-yc-pitch-deck-scrutinizer",
        title: "Venture Partner Pitch Scrutinizer",
        tagline: "Stress-test your startup thesis against ruthless venture partner critiques",
        category: "Strategy",
        template: `Act as a cynical, top-tier Silicon Valley Venture Partner. Scrutinize the provided startup pitch: 1. The fatal 18-month blind spot. 2. Defensibility vs native model updates. 3. Zero-dollar distribution velocity loop. 4. 5 hardest partner questions with winning answers.`
      }
    ];

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("prompt-list");
  const searchInput = document.getElementById("search-input");
  const modelSelect = document.getElementById("model-select");
  const browserIndicator = document.getElementById("browser-indicator");
  const btnUpgrade = document.getElementById("btn-upgrade");
  const btnKeyToggle = document.getElementById("btn-key-toggle");
  const keyForm = document.getElementById("key-form");
  const keyInput = document.getElementById("key-input");
  const btnSubmitKey = document.getElementById("btn-submit-key");
  const keyStatus = document.getElementById("key-status");
  const statusDot = document.getElementById("status-dot");
  const tierText = document.getElementById("tier-text");

  // Telemetry elements
  const statCliches = document.getElementById("stat-cliches");
  const statWords = document.getElementById("stat-words");
  const statValue = document.getElementById("stat-value");

  // Studio elements
  const sandboxInput = document.getElementById("sandbox-input");
  const btnInsertSample = document.getElementById("btn-insert-sample");
  const sandboxDiffBox = document.getElementById("sandbox-diff-box");
  const sandboxDiffText = document.getElementById("sandbox-diff-text");
  const sandboxMetricPill = document.getElementById("sandbox-metric-pill");
  const btnCopySandbox = document.getElementById("btn-copy-sandbox");
  let lastSandboxTransformed = "";

  // Segmented Pill Navigation
  const navPills = document.querySelectorAll(".nav-pill");
  const tabPanes = {
    studio: document.getElementById("pane-studio"),
    vault: document.getElementById("pane-vault")
  };

  navPills.forEach(pill => {
    pill.addEventListener("click", () => {
      navPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const target = pill.dataset.tab;
      Object.entries(tabPanes).forEach(([k, pane]) => {
        if (pane) {
          pane.classList.toggle("active", k === target);
        }
      });
    });
  });

  // Display detected browser runtime
  if (browserIndicator) {
    browserIndicator.textContent = `${speBrowser.name} • Offline Core`;
  }

  // Update checkout URL with browser attribution
  if (btnUpgrade) {
    btnUpgrade.href = EntitlementManager.getCheckoutUrl("monthly");
  }

  // Refresh Telemetry Stats
  async function refreshRoiStats() {
    const roi = await EntitlementManager.getLifetimeRoiMetrics();
    if (statCliches) statCliches.textContent = (roi.clichesPurged || 0).toLocaleString();
    if (statWords) statWords.textContent = `${(roi.wordsPruned || 0).toLocaleString()}w`;
    if (statValue) statValue.textContent = `$${(roi.valueSavedUsd || 0).toFixed(2)}`;
  }

  // Render subscription tier and daily usage
  async function updateTierDisplay() {
    const entitlement = await EntitlementManager.getCurrentEntitlement();
    const usage = await EntitlementManager.getDailyUsage();

    if (entitlement.isPro) {
      if (statusDot) statusDot.className = "status-dot pro";
      if (tierText) tierText.textContent = "Pro Active";
      if (btnKeyToggle) btnKeyToggle.textContent = "Manage Key";
    } else {
      if (statusDot) statusDot.className = "status-dot";
      if (tierText) tierText.textContent = `${usage.remaining}/15 Free`;
    }

    await refreshRoiStats();
  }

  await updateTierDisplay();

  // License Key drawer toggle
  if (btnKeyToggle && keyForm) {
    btnKeyToggle.addEventListener("click", () => {
      keyForm.classList.toggle("active");
      if (keyForm.classList.contains("active")) {
        keyInput.focus();
      }
    });
  }

  // License Key activation
  if (btnSubmitKey && keyInput) {
    btnSubmitKey.addEventListener("click", async () => {
      const keyVal = keyInput.value.trim();
      if (!keyVal) return;
      btnSubmitKey.disabled = true;
      btnSubmitKey.textContent = "...";
      const res = await EntitlementManager.activateLicense(keyVal);
      btnSubmitKey.disabled = false;
      btnSubmitKey.textContent = "Verify";

      if (keyStatus) {
        keyStatus.style.display = "inline";
        if (res.success) {
          keyStatus.style.color = "#10b981";
          keyStatus.textContent = "✓ Verified";
          setTimeout(() => window.location.reload(), 700);
        } else {
          keyStatus.style.color = "#f43f5e";
          keyStatus.textContent = res.error || "Invalid key";
        }
      }
    });
  }

  // Load selected model preference
  try {
    const prefs = await speBrowser.storage.local.get(["selectedModel"]);
    if (prefs.selectedModel && modelSelect) {
      modelSelect.value = prefs.selectedModel;
    }
  } catch (err) {
    console.warn("Storage read error", err);
  }

  if (modelSelect) {
    modelSelect.addEventListener("change", async (e) => {
      await speBrowser.storage.local.set({ selectedModel: e.target.value });
    });
  }

  // Sample prompt insert
  if (btnInsertSample && sandboxInput) {
    btnInsertSample.addEventListener("click", () => {
      sandboxInput.value = "In today's fast-paced digital world, leveraging AI is a testament to innovation and plays a crucial role to delve into new opportunities.";
      sandboxInput.focus();
    });
  }

  // Studio Action Buttons
  document.querySelectorAll(".btn-action").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = sandboxInput ? sandboxInput.value.trim() : "";
      if (!text) {
        if (sandboxInput) sandboxInput.focus();
        return;
      }

      const action = btn.dataset.action;
      let transformed = text;

      if (action === "humanize") {
        transformed = SpeAutoActionsEngine.humanizeText(text);
      } else if (action === "fluent") {
        transformed = SpeAutoActionsEngine.paraphraseText(text, "fluent");
      } else if (action === "grammar") {
        transformed = SpeAutoActionsEngine.fixGrammarAndFlow(text);
      } else if (action === "executive") {
        transformed = SpeAutoActionsEngine.paraphraseText(text, "executive");
      }

      const diffResult = SpeAutoActionsEngine.computeTransformationDiff(text, transformed);
      lastSandboxTransformed = transformed;

      // Render Token Diff
      const html = diffResult.diff.map(tok => {
        if (tok.type === "del") {
          return `<span class="spe-diff-del">${escapeHtml(tok.text)}</span>`;
        }
        if (tok.type === "ins") {
          return `<span class="spe-diff-ins">${escapeHtml(tok.text)}</span>`;
        }
        return `<span>${escapeHtml(tok.text)} </span>`;
      }).join("");

      sandboxDiffText.innerHTML = html;
      sandboxMetricPill.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        ${diffResult.metrics.clichesPurged} Clichés Purged • ${diffResult.metrics.humanScore}
      `;
      sandboxDiffBox.style.display = "flex";

      // Record Action Usage and update telemetry
      await EntitlementManager.recordActionUsage(diffResult.metrics);
      await updateTierDisplay();
    });
  });

  if (btnCopySandbox) {
    btnCopySandbox.addEventListener("click", () => {
      if (!lastSandboxTransformed) return;
      navigator.clipboard.writeText(lastSandboxTransformed).then(() => {
        const origHtml = btnCopySandbox.innerHTML;
        btnCopySandbox.innerHTML = `<span>Copied ✓</span>`;
        setTimeout(() => btnCopySandbox.innerHTML = origHtml, 1400);
      });
    });
  }

  // =========================================================================
  // Power Prompts Vault
  // =========================================================================
  function renderVault(query = "") {
    if (!listEl) return;
    const q = query.toLowerCase();
    const filtered = VAULT.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.tagline.toLowerCase().includes(q) || 
      (p.category && p.category.toLowerCase().includes(q))
    );

    listEl.innerHTML = filtered.map(p => `
      <div class="prompt-card" data-id="${p.id}">
        <div class="card-top">
          <span class="card-title">${escapeHtml(p.title)}</span>
          <span class="card-category-tag">${escapeHtml(p.category || "PROMPT")}</span>
        </div>
        <div class="card-desc">${escapeHtml(p.tagline)}</div>
        <button class="btn-card-copy" data-id="${p.id}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Blueprint
        </button>
      </div>
    `).join("");

    listEl.querySelectorAll(".btn-card-copy").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = VAULT.find(p => p.id === btn.dataset.id);
        if (item) {
          navigator.clipboard.writeText(item.template).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<span>Copied ✓</span>`;
            setTimeout(() => btn.innerHTML = originalHtml, 1400);
          });
        }
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderVault(e.target.value);
    });
  }

  renderVault();
});
