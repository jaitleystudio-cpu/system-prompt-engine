// SPE Extension Popup Controller

const VAULT = [
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

document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("prompt-list");
  const searchInput = document.getElementById("search-input");
  const modelSelect = document.getElementById("model-select");

  // Load preferences
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["selectedModel"], (data) => {
      if (data.selectedModel) modelSelect.value = data.selectedModel;
    });
  }

  modelSelect.addEventListener("change", (e) => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ selectedModel: e.target.value });
    }
  });

  function render(query = "") {
    const q = query.toLowerCase();
    const filtered = VAULT.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.tagline.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q)
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

  searchInput.addEventListener("input", (e) => {
    render(e.target.value);
  });

  render();
});
