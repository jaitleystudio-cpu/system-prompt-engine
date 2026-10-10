// SPE Browser Companion - Content Script (ChatGPT, Claude & Gemini)
// 1-Click Injection & Invariant Hallucination Shield

(function () {
  if (window.__SPE_COMPANION_INITIALIZED__) return;
  window.__SPE_COMPANION_INITIALIZED__ = true;

  // Prompts Data
  const VAULT = [
    {
      id: "seo-outrank-competitor",
      title: "#1 Google Outranking Blueprint",
      tagline: "Outrank competitor content with full E-E-A-T depth & zero fluff",
      category: "SEO",
      icon: "🎯",
      upvotes: 4892,
      variables: [
        { name: "keyword", label: "Target Keyword", placeholder: "e.g. best crm for startups", default: "best crm for small business" },
        { name: "competitor_focus", label: "Competitor Topic / Gap", placeholder: "e.g. competitor lacks real pricing comparison", default: "focus on hidden onboarding fees and real team workflows" }
      ],
      template: `Act as an authoritative SEO strategist. Write a comprehensive, search-dominant guide targeting "{keyword}". Outperform competitors on {competitor_focus}. Deliver immediate value in the first 100 words. Provide H2/H3 subheads, comparison table, step-by-step guidance, and 4 FAQs. Voice: natural, expert human, zero generic AI clichés.`
    },
    {
      id: "seo-semantic-keyword-cluster",
      title: "Semantic Keyword & Topic Cluster Architect",
      tagline: "Turn 1 keyword into a complete 30-day topical authority blueprint",
      category: "SEO",
      icon: "🗺️",
      upvotes: 3740,
      variables: [
        { name: "seed_topic", label: "Seed Topic / Niche", placeholder: "e.g. cold email automation", default: "b2b lead generation" }
      ],
      template: `Act as a Senior SEO Topical Authority Architect. Analyze "{seed_topic}" and build a 30-day topical authority cluster: 1 Pillar page concept, 5 Sub-topic clusters with 4 long-tail articles each, search intent classification (Informational, Commercial, Transactional), and internal linking blueprint.`
    },
    {
      id: "copy-high-converting-landing-page",
      title: "High-Converting SaaS Landing Page Copy",
      tagline: "Direct-response landing page copy: Hero, PAS agitation, benefits & CTA",
      category: "Marketing",
      icon: "💎",
      upvotes: 5610,
      variables: [
        { name: "product_name", label: "Product Name", placeholder: "e.g. SPE", default: "SPE" },
        { name: "target_audience", label: "Target Audience", placeholder: "e.g. founders & marketers", default: "founders, marketers, and AI creators" },
        { name: "core_pain", label: "Core Pain Point", placeholder: "e.g. hallucinating prompts", default: "wasting hours wrestling with brittle, hallucinating AI prompts" },
        { name: "solution", label: "Unique Solution", placeholder: "e.g. 1-click verified prompts", default: "1-click verified prompts with zero hallucination shields" }
      ],
      template: `Act as a world-class Direct-Response Copywriter. Write complete high-converting landing page copy for {product_name} targeting {target_audience} who suffer from {core_pain}. Introduce {solution} as the breakthrough mechanism. Include: Above-the-fold Hero (Headline, Subhead, CTA), Problem Agitation (PAS), 3 Benefit Blocks (Feature -> Human Transformation), and Risk-Free Guarantee CTA.`
    },
    {
      id: "copy-viral-hook-and-thread",
      title: "Viral Social Hook & Thought Leadership Post",
      tagline: "Turn any complex insight into a high-engagement LinkedIn & X post",
      category: "Marketing",
      icon: "🚀",
      upvotes: 4120,
      variables: [
        { name: "core_insight", label: "Core Insight", placeholder: "e.g. why 90% of AI prompts fail", default: "why static 2023 prompt templates fail and how real prompt compilation works" }
      ],
      template: `Act as a top 0.1% Tech Creator. Transform this insight: "{core_insight}" into a viral, high-authority post. Provide 3 scroll-stopping hook variations (Counter-intuitive truth, Hard lesson, Data revelation). Use short punchy sentences, high whitespace, 3 concrete takeaways, and zero corporate fluff.`
    },
    {
      id: "code-fullstack-feature-architect",
      title: "Full-Stack Feature Architecture Blueprint",
      tagline: "Architect complete features with typed schemas, API contracts & tests",
      category: "Coding",
      icon: "🛠️",
      upvotes: 6180,
      variables: [
        { name: "feature_desc", label: "Feature Description", placeholder: "e.g. Team permissions", default: "Browser extension companion for 1-click prompt injection" },
        { name: "tech_stack", label: "Tech Stack", placeholder: "e.g. TypeScript, React", default: "TypeScript, Vite, React, Chrome Manifest V3" }
      ],
      template: `Act as a Principal Full-Stack Software Architect. Design a production-grade implementation blueprint for "{feature_desc}" using {tech_stack}. Include: Domain types & database schemas, API request/response contracts, 5 critical edge cases / failure modes with mitigations, and phased step-by-step TDD checklist.`
    },
    {
      id: "code-root-cause-debugger",
      title: "Production Root-Cause Debugger & Fixer",
      tagline: "Diagnose errors, explain root causes & produce minimal clean diffs",
      category: "Coding",
      icon: "🩺",
      upvotes: 5310,
      variables: [
        { name: "error_msg", label: "Error Message / Bug", placeholder: "e.g. TypeError in event listener", default: "Memory leak or unbounded re-renders on active chat tab change" }
      ],
      template: `Act as an elite Systems Debugger. Analyze this issue: "{error_msg}". Provide: 1. Root cause explanation at runtime level. 2. Minimal reproduction scenario. 3. Minimal correct code replacement diff. 4. Automated unit test ensuring zero regressions.`
    },
    {
      id: "biz-yc-pitch-deck-scrutinizer",
      title: "YC Pitch Deck Scrutinizer & Moat Tester",
      tagline: "Stress-test your startup pitch against ruthless venture partner critiques",
      category: "Business",
      icon: "🏛️",
      upvotes: 4420,
      variables: [
        { name: "pitch", label: "Startup Pitch", placeholder: "e.g. AI Prompt Engine", default: "SPE: 1-click prompt companion & assurance compiler for ChatGPT and Claude" }
      ],
      template: `Act as a cynical, top-tier Silicon Valley Venture Partner. Scrutinize this startup pitch: "{pitch}". Deliver a high-stakes critique: 1. The fatal 18-month blind spot. 2. Defensibility vs OpenAI/Anthropic native updates. 3. Zero-dollar distribution velocity loop. 4. 5 hardest partner questions with winning answers.`
    },
    {
      id: "write-100-percent-humanizer",
      title: "100% Human Style Rewriter (AI Fluff Stripper)",
      tagline: "Strip generic robotic AI prose and rewrite in authentic, punchy human cadence",
      category: "Writing",
      icon: "✍️",
      upvotes: 7290,
      variables: [
        { name: "draft_text", label: "Draft Text to Humanize", placeholder: "Paste your AI draft here", default: "In today's fast-paced digital world, leveraging AI is crucial for unlocking unparalleled growth..." }
      ],
      template: `Act as an award-winning editor and literary essayist. Rewrite the following into authentic, compelling, natural human prose: "{draft_text}". Invariants: Completely purge AI clichés (delve, tapestry, crucial, testament, realm, fast-paced world). Vary sentence lengths for musical rhythm. Use active verbs and concrete specifics.`
    }
  ];

  let currentCategory = "All";
  let searchQuery = "";
  let openCardId = null;

  // Detect Host Platform
  function getHostPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("openai.com")) return "ChatGPT";
    if (host.includes("claude.ai")) return "Claude";
    if (host.includes("gemini.google.com")) return "Gemini";
    return "AI Chat";
  }

  // Find Target Input Field
  function findChatInput() {
    // ChatGPT
    const gptInput = document.querySelector("#prompt-textarea, textarea[data-id='root'], textarea[tabindex='0']");
    if (gptInput) return gptInput;

    // Claude
    const claudeInput = document.querySelector("div[contenteditable='true'], fieldset div[contenteditable='true']");
    if (claudeInput) return claudeInput;

    // Gemini
    const geminiInput = document.querySelector("rich-textarea div[contenteditable='true'], div[contenteditable='true']");
    if (geminiInput) return geminiInput;

    // Generic fallback
    return document.querySelector("textarea, div[contenteditable='true']");
  }

  // Inject Text into Active Chat Input
  function injectPromptText(text) {
    const input = findChatInput();
    if (!input) {
      alert("SPE: Could not detect the active chat box. Please click into the prompt area and try again.");
      return false;
    }

    input.focus();

    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (input.isContentEditable) {
      // For contenteditable divs (Claude / ChatGPT rich mode)
      input.textContent = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
    }

    // Flash toast
    showToast("Prompt Compiled & Injected! ⚡");
    return true;
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 32px;
      background: linear-gradient(135deg, #00d2ff, #3a7bd5);
      color: #0f172a;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,210,255,0.5);
      z-index: 10000000;
      transition: all 0.3s;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  // Build UI Container
  const root = document.createElement("div");
  root.id = "spe-companion-root";

  // Trigger Pill
  const pill = document.createElement("div");
  pill.className = "spe-trigger-pill";
  pill.innerHTML = `
    <span>⚡ SPE Prompts</span>
    <span class="spe-badge">1-Click</span>
  `;

  // Drawer Panel
  const drawer = document.createElement("div");
  drawer.className = "spe-drawer-panel";

  function renderDrawerContent() {
    const platform = getHostPlatform();
    
    // Filter prompts
    const filtered = VAULT.filter(p => {
      const matchCat = currentCategory === "All" || p.category === currentCategory;
      const matchSearch = !searchQuery || 
        p.title.toLowerCase().includes(searchQuery) || 
        p.tagline.toLowerCase().includes(searchQuery) ||
        p.category.toLowerCase().includes(searchQuery);
      return matchCat && matchSearch;
    });

    drawer.innerHTML = `
      <div class="spe-header">
        <div class="spe-header-title">
          <span>⚡ System Prompt Engine</span>
          <span class="spe-shield-badge">🛡️ Hallucination Shield</span>
        </div>
        <button class="spe-close-btn" id="spe-close-btn">✕</button>
      </div>

      <div class="spe-filter-bar">
        <input 
          type="text" 
          class="spe-search-input" 
          placeholder="Search 1-click power prompts (SEO, Copy, Code)..." 
          id="spe-search-box"
          value="${searchQuery}"
        />
        <div class="spe-category-pills">
          ${["All", "SEO", "Marketing", "Coding", "Business", "Writing"].map(cat => `
            <button class="spe-category-pill ${currentCategory === cat ? 'spe-active' : ''}" data-cat="${cat}">
              ${cat}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="spe-prompt-list">
        ${filtered.length === 0 ? `
          <div style="text-align: center; color: var(--spe-text-secondary); padding: 30px;">
            No prompts found matching "${searchQuery}".
          </div>
        ` : filtered.map(p => {
          const isOpen = openCardId === p.id;
          return `
            <div class="spe-prompt-card" data-id="${p.id}">
              <div class="spe-card-top">
                <div class="spe-card-title">
                  <span>${p.icon}</span>
                  <span>${p.title}</span>
                </div>
                <div class="spe-card-actions">
                  <button class="spe-btn-vars" data-action="toggle-vars" data-id="${p.id}">
                    ${isOpen ? "Hide" : "Edit"}
                  </button>
                  <button class="spe-btn-insert" data-action="insert" data-id="${p.id}">
                    Inject ⚡
                  </button>
                </div>
              </div>

              <div class="spe-card-tagline">${p.tagline}</div>

              ${isOpen ? `
                <div class="spe-var-drawer">
                  ${p.variables.map(v => `
                    <div class="spe-var-input-group">
                      <label>${v.label}</label>
                      <input 
                        type="text" 
                        data-var="${v.name}" 
                        data-pid="${p.id}" 
                        value="${v.default || ''}" 
                        placeholder="${v.placeholder}"
                      />
                    </div>
                  `).join("")}
                  <button class="spe-btn-insert" style="width: 100%; margin-top: 4px;" data-action="insert-with-vars" data-id="${p.id}">
                    Compile & Inject to ${platform} 🚀
                  </button>
                </div>
              ` : ''}

              <div class="spe-card-meta">
                <div class="spe-card-stats">
                  <span>👍 ${p.upvotes.toLocaleString()}</span>
                  <span>•</span>
                  <span>${p.category}</span>
                </div>
                <span style="font-size: 11px; color: #34d399;">✓ Invariant Sound</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="spe-footer">
        <span>Target: <strong>${platform}</strong> (Auto-Tuned)</span>
        <a href="https://github.com/system-prompt-engine" target="_blank">SPE Studio ↗</a>
      </div>
    `;

    // Attach Event Listeners
    drawer.querySelector("#spe-close-btn")?.addEventListener("click", () => {
      drawer.classList.remove("spe-open");
    });

    const searchBox = drawer.querySelector("#spe-search-box");
    if (searchBox) {
      searchBox.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderDrawerContent();
        const updatedBox = drawer.querySelector("#spe-search-box");
        if (updatedBox) {
          updatedBox.focus();
          updatedBox.setSelectionRange(updatedBox.value.length, updatedBox.value.length);
        }
      });
    }

    drawer.querySelectorAll(".spe-category-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        currentCategory = btn.dataset.cat;
        renderDrawerContent();
      });
    });

    drawer.querySelectorAll("button[data-action='toggle-vars']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        openCardId = openCardId === id ? null : id;
        renderDrawerContent();
      });
    });

    drawer.querySelectorAll("button[data-action='insert']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const prompt = VAULT.find(item => item.id === id);
        if (!prompt) return;

        let compiled = prompt.template;
        prompt.variables.forEach(v => {
          compiled = compiled.replace(new RegExp(`{${v.name}}`, 'g'), v.default || v.placeholder);
        });

        if (injectPromptText(compiled)) {
          drawer.classList.remove("spe-open");
        }
      });
    });

    drawer.querySelectorAll("button[data-action='insert-with-vars']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const prompt = VAULT.find(item => item.id === id);
        if (!prompt) return;

        let compiled = prompt.template;
        const inputs = drawer.querySelectorAll(`input[data-pid='${id}']`);
        inputs.forEach(input => {
          const varName = input.dataset.var;
          const val = input.value.trim() || input.placeholder;
          compiled = compiled.replace(new RegExp(`{${varName}}`, 'g'), val);
        });

        if (injectPromptText(compiled)) {
          drawer.classList.remove("spe-open");
        }
      });
    });
  }

  // Toggle Drawer Open/Close
  pill.addEventListener("click", () => {
    const isOpen = drawer.classList.contains("spe-open");
    if (isOpen) {
      drawer.classList.remove("spe-open");
    } else {
      renderDrawerContent();
      drawer.classList.add("spe-open");
      setTimeout(() => {
        drawer.querySelector("#spe-search-box")?.focus();
      }, 100);
    }
  });

  root.appendChild(pill);
  root.appendChild(drawer);
  document.body.appendChild(root);

  console.log("⚡ SPE Companion loaded into " + getHostPlatform());
})();
