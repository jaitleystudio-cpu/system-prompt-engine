/**
 * PROMPTCARD · V1.4.0 — Extension Popup Controller
 *
 * Coordinates offline VLM prompt inversion, multi-model export formatting,
 * language tab switching (EN, 中文, 日本語, {} JSON), history rendering,
 * region crop triggering, and direct UIDrop bridge.
 */

// State
let activeItem = null;
let activeMode = "en";
let history = [];

// DOM References (lazy getters to allow safe Node.js unit testing)
const getEl = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);
const getThumbPreview = () => getEl("thumb-preview");
const getCardTitle = () => getEl("card-title");
const getCardSubtitle = () => getEl("card-subtitle");
const getTagsContainer = () => getEl("tags-container");
const getPromptOutput = () => getEl("prompt-output");
const getHistoryCount = () => getEl("history-count");
const getHistoryList = () => getEl("history-list");
const getToast = () => getEl("toast");
const getDropzone = () => getEl("dropzone");
const getFileInput = () => getEl("file-input");

// Multi-Model Formatters
export function formatForMidjourney(promptText, aspectRatio = "16:9") {
  const clean = (promptText || "").replace(/;/g, ",").trim();
  return `${clean} --ar ${aspectRatio} --v 6.1 --style raw`;
}

export function formatForFlux(promptText) {
  const clean = (promptText || "").replace(/;/g, ",").trim();
  return `photorealistic style, cinematic lighting, ultra-detailed textures, ${clean}`;
}

export function formatForStableDiffusion(promptText) {
  const clean = (promptText || "").replace(/;/g, ",").trim();
  return `masterpiece, highly detailed visual composition, professional photography, ${clean}, 8k resolution, photorealistic`;
}

export function formatForClaudeGpt(promptText, tags = []) {
  const tagsStr = tags.length ? tags.map((t) => `#${t}`).join(" ") : "#aesthetic #design";
  return `Please reconstruct or visually reference this scene with strict adherence to the following aesthetic specifications:\n\n${promptText}\n\nStyle Keywords: ${tagsStr}\nStrict Invariant: Preserve composition, color palette, and lighting dynamics.`;
}

// Show Toast
function showToast(message) {
  const toast = getToast();
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// Copy to Clipboard
async function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  if (!text) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(successMsg);
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    showToast("Failed to copy");
  }
}

// Render Active Item
function renderActiveItem(item) {
  if (!item) return;
  activeItem = item;

  const cardTitle = getCardTitle();
  const cardSubtitle = getCardSubtitle();
  const thumbPreview = getThumbPreview();
  const tagsContainer = getTagsContainer();

  // Title & Preview
  if (cardTitle) cardTitle.textContent = item.title || "Visual Deconstruction";
  if (cardSubtitle) {
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "Just now";
    cardSubtitle.textContent = `Analyzed ${timeStr} · 100% On-Device`;
  }
  if (thumbPreview && item.thumbnail) {
    thumbPreview.src = item.thumbnail;
  }

  // Tags
  if (tagsContainer) {
    tagsContainer.innerHTML = "";
    const tags = item.tags && item.tags.length ? item.tags : ["visual concept", "composition", "palette", "aesthetic"];
    tags.slice(0, 4).forEach((tag) => {
      const pill = document.createElement("span");
      pill.className = "pc-tag-pill";
      pill.textContent = tag;
      tagsContainer.appendChild(pill);
    });
  }

  // Active Prompt Text
  updatePromptText();
}

// Update Prompt Text based on active mode
function updatePromptText() {
  const promptOutput = getPromptOutput();
  if (!promptOutput || !activeItem) return;

  if (activeMode === "en") {
    promptOutput.value = activeItem.prompts?.en || activeItem.prompt || "";
  } else if (activeMode === "zh") {
    promptOutput.value = activeItem.prompts?.zh || "中文提示词生成中...";
  } else if (activeMode === "ja") {
    promptOutput.value = activeItem.prompts?.ja || "日本語プロンプト生成中...";
  } else if (activeMode === "json") {
    promptOutput.value = JSON.stringify(activeItem.structured_json || {}, null, 2);
  }
}

// Render History List
function renderHistory(items) {
  history = items || [];
  const historyCount = getHistoryCount();
  const historyList = getHistoryList();

  if (historyCount) {
    historyCount.textContent = `${history.length}/20`;
  }
  if (!historyList) return;

  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML = '<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 10px;">No previous scans</div>';
    return;
  }

  history.forEach((histItem) => {
    const row = document.createElement("div");
    row.className = "pc-history-item";

    const thumb = document.createElement("img");
    thumb.className = "pc-history-thumb";
    thumb.src = histItem.thumbnail || "icons/icon16.png";
    thumb.alt = "Thumb";

    const snippet = document.createElement("div");
    snippet.className = "pc-history-snippet";
    snippet.textContent = histItem.prompts?.en || histItem.title || "Image Prompt";

    const time = document.createElement("div");
    time.className = "pc-history-time";
    time.textContent = histItem.timestamp ? new Date(histItem.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    row.appendChild(thumb);
    row.appendChild(snippet);
    row.appendChild(time);

    row.addEventListener("click", () => {
      renderActiveItem(histItem);
    });

    historyList.appendChild(row);
  });
}

// Load Extension State
async function initialize() {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    // Standalone or test environment
    const defaultItem = {
      id: "demo-item",
      title: "GTA VI Promotional Art Analysis",
      thumbnail: "icons/icon48.png",
      tags: ["high illustration", "comic line art", "urban crime vibe", "game promo art"],
      prompts: {
        en: "tropical coast wooden dock; woman on the left in athletic bikini top; man on the right in white vest and backwards cap; waterfront marina setting; saturated neon pastel lighting; comic outline linework; dominant colors: turquoise, coral, sun-bleached wood; materials: cotton, nylon, polished timber; 16:9 aspect ratio; intended as promotional game art for GTA VI",
        zh: "热带海岸木质码头; 左侧身着运动比基尼上衣的女子; 右侧身着白色背心反戴鸭舌帽的男子; 滨水游艇码头场景; 饱和霓虹粉彩光照; 漫画轮廓线条; 主色调: 绿松石色, 珊瑚粉, 晒白原木; 材质: 棉织物, 尼龙, 抛光木料; 16:9 纵横比; 预期作为 GTA VI 官方宣传艺术图",
        ja: "熱帯沿岸の木製桟橋; 左側にスポーツビキニトップを着た女性; 右側に白いベストと後ろ向きキャップを被った男性; 海岸マリーナの舞台設定; 鮮やかなネオンパステル調のライティング; コミック風のアウトライン線画; 主要カラー: ターコイズ, コーラル, 褪色したウッド; 質感と素材: コットン, ナイロン, 研磨木材; 16:9 アスペクト比; GTA VI の公式プロモーションゲームアートとしての構成",
      },
      structured_json: {
        setting: "tropical coast wooden dock",
        aspect_ratio: "16:9",
        color_palette: ["#40E0D0", "#FF7F50", "#DEB887", "#1E3A8A"],
        materials_and_textures: ["cotton", "nylon", "polished timber"],
      },
      timestamp: Date.now(),
    };
    renderActiveItem(defaultItem);
    renderHistory([defaultItem]);
    return;
  }

  // Query Background for History
  chrome.runtime.sendMessage({ action: "GET_HISTORY" }, (res) => {
    if (res && res.history && res.history.length > 0) {
      renderActiveItem(res.history[0]);
      renderHistory(res.history);
    } else {
      // Default placeholder item
      const sampleItem = {
        id: "sample-gta",
        title: "Sample Artwork Analysis",
        thumbnail: "icons/icon48.png",
        tags: ["high illustration", "comic line art", "urban crime vibe", "game promo art"],
        prompts: {
          en: "tropical coast wooden dock; woman on the left in athletic bikini top; man on the right in white vest and backwards cap; waterfront marina setting; saturated neon pastel lighting; comic outline linework; dominant colors: turquoise, coral, sun-bleached wood; materials: cotton, nylon, polished timber; 16:9 aspect ratio; intended as promotional game art for GTA VI",
          zh: "热带海岸木质码头; 滨水游艇码头场景; 饱和霓虹粉彩光照; 主色调: 绿松石色, 珊瑚粉, 晒白原木; 16:9 纵横比",
          ja: "熱帯沿岸の木製桟橋; 海岸マリーナの舞台設定; 鮮やかなネオンパステル調のライティング; 16:9 アスペクト比",
        },
        structured_json: {
          setting: "tropical coast wooden dock",
          aspect_ratio: "16:9",
          color_palette: ["#40E0D0", "#FF7F50", "#DEB887"],
        },
        timestamp: Date.now(),
      };
      renderActiveItem(sampleItem);
      renderHistory([sampleItem]);
    }
  });
}

// Wire Event Listeners
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initialize();

  // Mode Tabs
  document.querySelectorAll(".pc-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pc-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeMode = btn.getAttribute("data-mode") || "en";
      updatePromptText();
    });
  });

  // Copy Main Prompt
  const copyBtn = document.getElementById("btn-copy-prompt");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (promptOutput) {
        copyToClipboard(promptOutput.value, "Prompt copied to clipboard!");
      }
    });
  }

  // Model Exports
  const btnMj = document.getElementById("btn-export-mj");
  if (btnMj) {
    btnMj.addEventListener("click", () => {
      const enPrompt = activeItem?.prompts?.en || promptOutput?.value || "";
      const ar = activeItem?.structured_json?.aspect_ratio || "16:9";
      copyToClipboard(formatForMidjourney(enPrompt, ar), "Copied Midjourney v6.1 prompt!");
    });
  }

  const btnFlux = document.getElementById("btn-export-flux");
  if (btnFlux) {
    btnFlux.addEventListener("click", () => {
      const enPrompt = activeItem?.prompts?.en || promptOutput?.value || "";
      copyToClipboard(formatForFlux(enPrompt), "Copied FLUX.1 prompt!");
    });
  }

  const btnSd = document.getElementById("btn-export-sd");
  if (btnSd) {
    btnSd.addEventListener("click", () => {
      const enPrompt = activeItem?.prompts?.en || promptOutput?.value || "";
      copyToClipboard(formatForStableDiffusion(enPrompt), "Copied SD 3.5 prompt!");
    });
  }

  const btnLlm = document.getElementById("btn-export-llm");
  if (btnLlm) {
    btnLlm.addEventListener("click", () => {
      const enPrompt = activeItem?.prompts?.en || promptOutput?.value || "";
      const tags = activeItem?.tags || [];
      copyToClipboard(formatForClaudeGpt(enPrompt, tags), "Copied Claude / GPT-4o directive!");
    });
  }

  // Snip Screen Region Button
  const snipBtn = document.getElementById("btn-snip-region");
  if (snipBtn) {
    snipBtn.addEventListener("click", async () => {
      if (typeof chrome === "undefined" || !chrome.tabs) return;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { action: "START_REGION_CAPTURE" });
          window.close();
        }
      } catch (err) {
        console.warn("Could not start region snip:", err);
      }
    });
  }

  // Open in UIDrop Bridge
  const uidropBtn = document.getElementById("btn-open-uidrop");
  if (uidropBtn) {
    uidropBtn.addEventListener("click", () => {
      const targetUrl = "https://systempromptengine.com/uidrop";
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: targetUrl });
      } else {
        window.open(targetUrl, "_blank");
      }
    });
  }

  // Options Button
  const optBtn = document.getElementById("btn-options");
  if (optBtn) {
    optBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  // Clear History
  const clearBtn = document.getElementById("btn-clear-history");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, () => {
          renderHistory([]);
          showToast("History cleared");
        });
      } else {
        renderHistory([]);
        showToast("History cleared");
      }
    });
  }

  // Dropzone and File Input
  const dropzone = getDropzone();
  const fileInput = getFileInput();
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer?.files?.length) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files?.length) {
        handleImageFile(e.target.files[0]);
      }
    });
  }
});
}

// Process Selected Image File
function handleImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Please select a valid image file");
    return;
  }

  showToast("Analyzing image on-device...");
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result;
    if (!dataUrl) return;

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "ANALYZE_IMAGE_DATA", imageDataUrl: dataUrl }, (res) => {
        if (res?.result) {
          renderActiveItem(res.result);
          initialize(); // refresh history
        }
      });
    } else {
      // Local demo fallback
      const localItem = {
        id: `img-${Date.now()}`,
        title: file.name,
        thumbnail: dataUrl,
        tags: ["custom upload", "high fidelity", "client deconstructed", "raw aesthetics"],
        prompts: {
          en: `custom input image; dominant setting from ${file.name}; high fidelity textures; balanced lighting; 16:9 aspect ratio`,
          zh: `用户上传图像; 场景源自 ${file.name}; 高精度纹理; 均衡光影`,
          ja: `ユーザーアップロード画像; ${file.name} 由来の構図; 高精細テクスチャ; バランスの取れたライティング`,
        },
        structured_json: {
          source: file.name,
          aspect_ratio: "16:9",
        },
        timestamp: Date.now(),
      };
      renderActiveItem(localItem);
      history.unshift(localItem);
      renderHistory(history);
    }
  };
  reader.readAsDataURL(file);
}
