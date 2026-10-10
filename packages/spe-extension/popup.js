// SPE Extension Popup Controller
import { speBrowser } from "./src/browserCompat.js";
import { EntitlementManager, SUBSCRIPTION_TIERS } from "./src/entitlementManager.js";
import { POWER_PROMPTS_VAULT } from "./src/promptsData.js";

const VAULT = Array.isArray(POWER_PROMPTS_VAULT) && POWER_PROMPTS_VAULT.length > 0
  ? POWER_PROMPTS_VAULT
  : [
      {
        id: "seo-outrank-competitor",
        title: "#1 Google Outranking Blueprint",
        tagline: "Outrank competitor content with full E-E-A-T depth & zero fluff",
        category: "SEO",
        template: `Act as an authoritative SEO strategist. Write a comprehensive, search-dominant guide targeting the primary keyword. Answer search intent within the first 100 words. Provide H2/H3 subheadings, comparison table, step-by-step guidance, and 4 FAQs. Voice: natural human, zero generic AI clichés.`
      },
      {
        id: "copy-high-converting-landing-page",
        title: "High-Converting SaaS Landing Page Copy",
        tagline: "Direct-response landing page copy: Hero, PAS agitation, benefits & CTA",
        category: "Marketing",
        template: `Act as a world-class Direct-Response Copywriter. Write complete high-converting landing page copy. Include: Above-the-fold Hero (Headline, Subhead, CTA), Problem Agitation (PAS), 3 Benefit Blocks (Feature -> Human Transformation), and Risk-Free Guarantee CTA.`
      },
      {
        id: "code-fullstack-feature-architect",
        title: "Full-Stack Feature Architecture Blueprint",
        tagline: "Architect complete features with typed schemas, API contracts & tests",
        category: "Coding",
        template: `Act as a Principal Full-Stack Software Architect. Design a production-grade implementation blueprint. Include: Domain types & database schemas, API request/response contracts, 5 critical edge cases / failure modes with mitigations, and phased step-by-step TDD checklist.`
      },
      {
        id: "write-100-percent-humanizer",
        title: "100% Human Style Rewriter (AI Fluff Stripper)",
        tagline: "Strip generic robotic AI prose and rewrite in authentic, punchy human cadence",
        category: "Writing",
        template: `Act as an award-winning editor and literary essayist. Rewrite the provided text into authentic, compelling, natural human prose. Invariants: Completely purge AI clichés (delve, tapestry, crucial, testament, realm, fast-paced world). Vary sentence lengths for musical rhythm. Use active verbs and concrete specifics.`
      },
      {
        id: "biz-yc-pitch-deck-scrutinizer",
        title: "YC Pitch Deck Scrutinizer & Moat Tester",
        tagline: "Stress-test your startup pitch against ruthless venture partner critiques",
        category: "Business",
        template: `Act as a cynical, top-tier Silicon Valley Venture Partner. Scrutinize the provided startup pitch: 1. The fatal 18-month blind spot. 2. Defensibility vs native model updates. 3. Zero-dollar distribution velocity loop. 4. 5 hardest partner questions with winning answers.`
      }
    ];

document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("prompt-list");
  const searchInput = document.getElementById("search-input");
  const modelSelect = document.getElementById("model-select");
  const tierBadge = document.getElementById("tier-badge");
  const browserIndicator = document.getElementById("browser-indicator");
  const btnUpgrade = document.getElementById("btn-upgrade");
  const btnKeyToggle = document.getElementById("btn-key-toggle");
  const keyForm = document.getElementById("key-form");
  const keyInput = document.getElementById("key-input");
  const btnSubmitKey = document.getElementById("btn-submit-key");
  const keyStatus = document.getElementById("key-status");
  const proBanner = document.getElementById("pro-banner");

  // Display detected browser runtime
  browserIndicator.textContent = `Running on ${speBrowser.name} • Offline Core`;

  // Update checkout URL with browser attribution
  if (btnUpgrade) {
    btnUpgrade.href = EntitlementManager.getCheckoutUrl("monthly");
  }

  // Render subscription tier
  async function updateTierDisplay() {
    const entitlement = await EntitlementManager.getCurrentEntitlement();
    if (entitlement.isPro) {
      tierBadge.className = "tier-badge pro";
      tierBadge.textContent = "⚡ PRO ($1/MO)";
      proBanner.innerHTML = `
        <div class="pro-banner-header">
          <span class="pro-tag">⭐ SPE Pro Active</span>
          <span style="color: #10b981; font-size: 10px;">Unlimited 100k Specs Active</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span>Key: <code style="color: #cbd5e1;">${entitlement.key ? entitlement.key.slice(0, 14) + "..." : "Active"}</code></span>
          <button id="btn-deactivate" style="background: none; border: none; color: #ef4444; font-size: 10px; cursor: pointer; text-decoration: underline;">Deactivate</button>
        </div>
      `;
      const btnDeactivate = document.getElementById("btn-deactivate");
      if (btnDeactivate) {
        btnDeactivate.addEventListener("click", async () => {
          await EntitlementManager.deactivateLicense();
          window.location.reload();
        });
      }
    } else {
      tierBadge.className = "tier-badge free";
      tierBadge.textContent = "Free Tier";
    }
  }

  await updateTierDisplay();

  // License Key toggle
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
      btnSubmitKey.textContent = "Activate";

      keyStatus.style.display = "block";
      if (res.success) {
        keyStatus.style.color = "#10b981";
        keyStatus.textContent = "✓ Pro Activated!";
        setTimeout(() => window.location.reload(), 800);
      } else {
        keyStatus.style.color = "#ef4444";
        keyStatus.textContent = res.error || "Activation failed";
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

  // Render prompt cards
  function render(query = "") {
    const q = query.toLowerCase();
    const filtered = VAULT.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.tagline.toLowerCase().includes(q) || 
      (p.category && p.category.toLowerCase().includes(q))
    );

    listEl.innerHTML = filtered.map(p => `
      <div class="card">
        <div class="card-title">
          <span>${p.title}</span>
          <button class="btn-copy" data-id="${p.id}">Copy 📋</button>
        </div>
        <div class="card-tagline">${p.tagline}</div>
      </div>
    `).join("");

    listEl.querySelectorAll(".btn-copy").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = VAULT.find(p => p.id === btn.dataset.id);
        if (item) {
          navigator.clipboard.writeText(item.template).then(() => {
            const original = btn.textContent;
            btn.textContent = "Copied! ✓";
            setTimeout(() => btn.textContent = original, 1500);
          });
        }
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      render(e.target.value);
    });
  }

  render();
});
