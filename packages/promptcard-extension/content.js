/**
 * PROMPTCARD · V1.4.0 — Content Script
 *
 * Injects isolated Shadow DOM overlay, renders draggable PROMPTCARD · V1.4.0 modal,
 * animated progress bar, top-right 20-item HISTORY drawer, 4 style tag pills,
 * multilingual/JSON switcher, region screenshot cropper, and 1-click clipboard copy.
 */

(function () {
  if (window.__promptcard_initialized) return;
  window.__promptcard_initialized = true;

  let shadowHost = null;
  let shadowRoot = null;
  let activeState = "IDLE"; // "IDLE" | "LOADING" | "RESULT"
  let currentActiveMode = "en"; // "en" | "zh" | "ja" | "json"
  let activeData = null;
  let historyItems = [];
  let progressInterval = null;
  let currentProgress = 10;

  // Initialize or return Shadow Root container
  function ensureShadowRoot() {
    if (shadowRoot) return shadowRoot;

    const existingHost = document.getElementById("promptcard-shadow-host");
    if (existingHost) existingHost.remove();

    shadowHost = document.createElement("div");
    shadowHost.id = "promptcard-shadow-host"; // #promptcard-shadow-host
    document.documentElement.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: "open" });

    // Link overlay.css
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("styles/overlay.css");
    shadowRoot.appendChild(link);

    // Main App Container
    const container = document.createElement("div");
    container.id = "promptcard-container";
    shadowRoot.appendChild(container);

    return shadowRoot;
  }

  // Hide / Close UI
  function closeOverlay() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      activeState = "IDLE";
    }
  }

  // Smooth progress animation: 10% -> 70% -> 85%
  function startProgressSimulation() {
    currentProgress = 10;
    updateProgressUI(currentProgress, "Building your prompt...");

    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(() => {
      if (currentProgress < 70) {
        currentProgress += Math.floor(Math.random() * 8) + 4;
        if (currentProgress > 70) currentProgress = 70;
        updateProgressUI(currentProgress, "Building your prompt...");
      } else if (currentProgress < 85) {
        currentProgress += 1;
        updateProgressUI(currentProgress, "Refining aesthetic syntax...");
      }
    }, 180);
  }

  function updateProgressUI(pct, subtitle) {
    if (!shadowRoot) return;
    const bar = shadowRoot.querySelector(".promptcard-progress-fill");
    const percentEl = shadowRoot.querySelector(".promptcard-progress-percent");
    const subEl = shadowRoot.querySelector(".promptcard-progress-subtitle");

    if (bar) bar.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (subEl && subtitle) subEl.textContent = subtitle;
  }

  // Format active prompt text based on current language or JSON mode
  function getActivePromptText() {
    if (!activeData) return "";
    if (currentActiveMode === "en") return activeData.prompts?.en || "";
    if (currentActiveMode === "zh") return activeData.prompts?.zh || "";
    if (currentActiveMode === "ja") return activeData.prompts?.ja || "";
    if (currentActiveMode === "json") {
      return JSON.stringify(activeData.structured_json || {}, null, 2);
    }
    return activeData.prompts?.en || "";
  }

  // Render Overlay based on current state
  function render() {
    const root = ensureShadowRoot();
    const container = root.querySelector("#promptcard-container");
    if (!container) return;

    if (activeState === "IDLE") {
      container.innerHTML = "";
      return;
    }

    const counterText = `${historyItems.length}/20`;

    container.innerHTML = `
      <!-- Main Card -->
      <div class="promptcard-card promptcard-main" id="promptcard-main-card">
        <div class="promptcard-topbar">
          <div class="promptcard-badge-version">
            <span class="dot"></span> PROMPTCARD · V1.4.0
          </div>
          <button class="promptcard-close-btn" id="pc-close-btn" title="Close">×</button>
        </div>

        <h2 class="promptcard-title">${activeState === "LOADING" ? "Analyze Image" : "Prompt"}</h2>

        ${
          activeState === "LOADING"
            ? `
          <div class="promptcard-progress-wrapper">
            <div class="promptcard-progress-track">
              <div class="promptcard-progress-fill" style="width: ${currentProgress}%"></div>
            </div>
            <div class="promptcard-progress-labels">
              <span class="promptcard-progress-subtitle">Building your prompt...</span>
              <span class="promptcard-progress-percent">${currentProgress}%</span>
            </div>
          </div>
        `
            : `
          <!-- Scrollable Prompt Box -->
          <div class="promptcard-prompt-box" id="pc-prompt-box">${escapeHtml(getActivePromptText())}</div>

          <!-- 4 Style Tag Pills -->
          <div class="promptcard-tags-grid">
            ${(activeData?.tags || [])
              .map(
                (tag) => `<div class="promptcard-tag-pill" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</div>`
              )
              .join("")}
          </div>

          <!-- Mode & Action Toolbar -->
          <div class="promptcard-controls-row">
            <div class="promptcard-lang-group">
              <button class="promptcard-mode-btn ${currentActiveMode === "en" ? "active" : ""}" data-mode="en">EN</button>
              <button class="promptcard-mode-btn ${currentActiveMode === "zh" ? "active" : ""}" data-mode="zh">中文</button>
              <button class="promptcard-mode-btn ${currentActiveMode === "ja" ? "active" : ""}" data-mode="ja">日本語</button>
              <button class="promptcard-mode-btn ${currentActiveMode === "json" ? "active" : ""}" data-mode="json">{}</button>
            </div>
            <div class="promptcard-infile-wrapper">
              <button class="promptcard-infile-btn" id="pc-infile-btn">
                <span>📷</span> In File/Pic
              </button>
              <div class="promptcard-quick-menu" id="pc-quick-menu">
                <button class="promptcard-quick-item" id="pc-menu-file">
                  <span>📁</span> Select Image File
                </button>
                <button class="promptcard-quick-item" id="pc-menu-crop">
                  <span>✂️</span> Drag-Crop Region
                </button>
              </div>
            </div>
          </div>

          <!-- Primary Full-Width Copy Button -->
          <button class="promptcard-copy-btn" id="pc-copy-btn">
            <span class="pc-btn-text">Copy</span>
          </button>
        `
        }
      </div>

      <!-- History Companion Drawer -->
      <div class="promptcard-card promptcard-history" id="promptcard-history-card">
        <div class="promptcard-history-header">
          <span class="promptcard-history-title">HISTORY</span>
          <div class="promptcard-history-actions">
            <button class="promptcard-history-clear" id="pc-history-clear">Clear</button>
            <span class="promptcard-history-counter" id="pc-history-counter">${counterText}</span>
          </div>
        </div>
        <div class="promptcard-history-list">
          ${
            historyItems.length === 0
              ? `<div class="promptcard-history-empty">No images analyzed yet</div>`
              : historyItems
                  .map((item) => {
                    const isAnalyzing = item.status === "analyzing";
                    return `
                <div class="promptcard-history-item" data-id="${item.id}">
                  <img src="${item.thumbnailDataUrl || ""}" alt="History Thumbnail" />
                  <span class="promptcard-history-badge ${isAnalyzing ? "analyzing" : "done"}">
                    ${isAnalyzing ? "Analyzing" : "Done"}
                  </span>
                </div>
              `;
                  })
                  .join("")
          }
        </div>
      </div>

      <!-- Hidden Local File Input -->
      <input type="file" id="pc-hidden-file-input" accept="image/*" style="display: none;" />
    `;

    bindEvents();
  }

  // Bind interactive DOM events inside the shadow root
  function bindEvents() {
    if (!shadowRoot) return;

    // Close Button
    shadowRoot.getElementById("pc-close-btn")?.addEventListener("click", closeOverlay);

    // Language / Format Switches
    shadowRoot.querySelectorAll(".promptcard-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = e.currentTarget.getAttribute("data-mode");
        currentActiveMode = mode;
        shadowRoot.querySelectorAll(".promptcard-mode-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        const promptBox = shadowRoot.getElementById("pc-prompt-box");
        if (promptBox) {
          promptBox.textContent = getActivePromptText();
        }
      });
    });

    // Tag pills click -> copy tag
    shadowRoot.querySelectorAll(".promptcard-tag-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        const tag = e.currentTarget.getAttribute("data-tag");
        if (tag) {
          navigator.clipboard.writeText(tag).then(() => {
            const originalText = pill.textContent;
            pill.textContent = "Copied ✓";
            setTimeout(() => {
              pill.textContent = originalText;
            }, 1000);
          });
        }
      });
    });

    // Copy Button -> copies active prompt text
    const copyBtn = shadowRoot.getElementById("pc-copy-btn");
    copyBtn?.addEventListener("click", () => {
      const text = getActivePromptText();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.classList.add("copied");
        const btnText = copyBtn.querySelector(".pc-btn-text");
        if (btnText) btnText.textContent = "Copied! ✓";
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          if (btnText) btnText.textContent = "Copy";
        }, 1500);
      });
    });

    // History Item Click -> loads saved item into Main Card
    shadowRoot.querySelectorAll(".promptcard-history-item").forEach((itemEl) => {
      itemEl.addEventListener("click", () => {
        const id = itemEl.getAttribute("data-id");
        const found = historyItems.find((h) => h.id === id);
        if (found && found.status === "completed") {
          activeData = found;
          activeState = "RESULT";
          render();
        }
      });
    });

    // Clear History Button
    shadowRoot.getElementById("pc-history-clear")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, (res) => {
        historyItems = res?.history || [];
        render();
      });
    });

    // In File/Pic Quick Menu & Local File / Screen Crop
    const inFileBtn = shadowRoot.getElementById("pc-infile-btn");
    const quickMenu = shadowRoot.getElementById("pc-quick-menu");
    const menuFile = shadowRoot.getElementById("pc-menu-file");
    const menuCrop = shadowRoot.getElementById("pc-menu-crop");
    const fileInput = shadowRoot.getElementById("pc-hidden-file-input");

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          startImageAnalysisFromDataUrl(dataUrl);
        };
        reader.readAsDataURL(file);
      }
    });

    inFileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      quickMenu?.classList.toggle("open");
    });

    menuFile?.addEventListener("click", (e) => {
      e.stopPropagation();
      quickMenu?.classList.remove("open");
      fileInput?.click();
    });

    menuCrop?.addEventListener("click", (e) => {
      e.stopPropagation();
      quickMenu?.classList.remove("open");
      startRegionCropper();
    });

    shadowRoot.addEventListener("click", (e) => {
      if (!quickMenu?.contains(e.target) && e.target !== inFileBtn) {
        quickMenu?.classList.remove("open");
      }
    });

    // Make Cards Draggable
    makeDraggable(shadowRoot.getElementById("promptcard-main-card"));
    makeDraggable(shadowRoot.getElementById("promptcard-history-card"));
  }

  // Interactive Screen Region Cropper
  function startRegionCropper() {
    const cropper = document.createElement("div");
    cropper.className = "promptcard-cropper-overlay";
    document.body.appendChild(cropper);

    let startX = 0;
    let startY = 0;
    let isDrawing = false;
    let selectionBox = null;

    cropper.addEventListener("mousedown", (e) => {
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;

      selectionBox = document.createElement("div");
      selectionBox.className = "promptcard-crop-selection";
      selectionBox.style.left = `${startX}px`;
      selectionBox.style.top = `${startY}px`;
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      cropper.appendChild(selectionBox);
    });

    cropper.addEventListener("mousemove", (e) => {
      if (!isDrawing || !selectionBox) return;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${w}px`;
      selectionBox.style.height = `${h}px`;
    });

    cropper.addEventListener("mouseup", (e) => {
      if (!isDrawing) return;
      isDrawing = false;

      const endX = e.clientX;
      const endY = e.clientY;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      cropper.remove();

      if (width < 20 || height < 20) return; // Too small, cancel

      // Capture active tab screenshot and crop via canvas
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (res) => {
        if (!res?.dataUrl) return;
        const img = new Image();
        img.onload = () => {
          const pixelRatio = window.devicePixelRatio || 1;
          const canvas = document.createElement("canvas");
          canvas.width = width * pixelRatio;
          canvas.height = height * pixelRatio;
          const ctx = canvas.getContext("2d");

          ctx.drawImage(
            img,
            x * pixelRatio,
            y * pixelRatio,
            width * pixelRatio,
            height * pixelRatio,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
          startImageAnalysisFromDataUrl(croppedDataUrl);
        };
        img.src = res.dataUrl;
      });
    });
  }

  // Trigger analysis for locally sourced image (upload / region crop)
  function startImageAnalysisFromDataUrl(dataUrl) {
    activeState = "LOADING";
    startProgressSimulation();
    render();

    chrome.runtime.sendMessage({
      action: "ANALYZE_IMAGE_DATA",
      imageDataUrl: dataUrl,
    });
  }

  // Utility: Draggable Element
  function makeDraggable(element) {
    if (!element) return;
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (
        e.target.tagName === "BUTTON" ||
        e.target.tagName === "INPUT" ||
        e.target.classList.contains("promptcard-tag-pill") ||
        e.target.classList.contains("promptcard-quick-item") ||
        e.target.id === "pc-prompt-box"
      ) {
        return;
      }
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      const rect = element.getBoundingClientRect();
      element.style.top = rect.top - pos2 + "px";
      element.style.left = rect.left - pos1 + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Chrome Runtime Message Listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "ANALYSIS_STARTED") {
      activeState = "LOADING";
      currentProgress = 10;
      startProgressSimulation();
      render();
    }

    if (message.action === "HISTORY_UPDATED") {
      historyItems = message.history || [];
      render();
    }

    if (message.action === "ANALYSIS_COMPLETE") {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      updateProgressUI(100, "Prompt Ready");

      setTimeout(() => {
        activeState = "RESULT";
        activeData = message.data;
        historyItems = message.history || [];
        render();
      }, 300);
    }
  });

  // Fetch initial history on load
  chrome.runtime.sendMessage({ action: "GET_HISTORY" }, (res) => {
    if (res?.history) {
      historyItems = res.history;
    }
  });
})();
