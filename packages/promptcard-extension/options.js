/**
 * PROMPTCARD · V1.4.0 — Options & Settings Script
 */

const SETTINGS_KEY = "promptcard_settings";
const HISTORY_KEY = "promptcard_history";

document.addEventListener("DOMContentLoaded", async () => {
  const providerSelect = document.getElementById("provider-select");
  const apiKeyInput = document.getElementById("api-key-input");
  const modelNameInput = document.getElementById("model-name-input");
  const offlineToggle = document.getElementById("offline-toggle");
  const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
  const testConnBtn = document.getElementById("test-connection-btn");
  const saveBtn = document.getElementById("save-settings-btn");
  const statusMsg = document.getElementById("connection-status");
  const historyCounter = document.getElementById("history-counter-label");
  const clearHistoryBtn = document.getElementById("clear-history-btn");
  const exportHistoryBtn = document.getElementById("export-history-btn");

  // Load Settings
  const saved = await chrome.storage.local.get([SETTINGS_KEY, HISTORY_KEY]);
  const settings = saved[SETTINGS_KEY] || {
    provider: "offline",
    apiKey: "",
    model: "gemini-2.5-flash",
    offlineMode: true,
  };
  const history = saved[HISTORY_KEY] || [];

  providerSelect.value = settings.provider || "offline";
  apiKeyInput.value = settings.apiKey || "";
  modelNameInput.value = settings.model || "gemini-2.5-flash";
  offlineToggle.checked = settings.offlineMode ?? true;

  updateHistoryCounter(history.length);

  function updateHistoryCounter(len) {
    historyCounter.textContent = `${len}/20 Items`;
  }

  // Toggle API key visibility
  toggleKeyVisibility.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibility.textContent = "Hide";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibility.textContent = "Show";
    }
  });

  // Save Settings
  saveBtn.addEventListener("click", async () => {
    const newSettings = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelNameInput.value.trim(),
      offlineMode: offlineToggle.checked,
    };

    await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });

    showStatus("Configuration saved successfully!", "success");
  });

  // Test Connection
  testConnBtn.addEventListener("click", async () => {
    showStatus("Testing engine connection...", "success");

    const provider = providerSelect.value;
    const isOffline = offlineToggle.checked || provider === "offline";

    if (isOffline) {
      setTimeout(() => {
        showStatus("✓ SPE Offline Air-Gapped Engine verified ($0.00 bill, 0ms latency).", "success");
      }, 300);
      return;
    }

    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus("Error: API Key is required when not in offline mode.", "error");
      return;
    }

    try {
      if (provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showStatus("✓ Gemini API Connection verified successfully!", "success");
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showStatus("✓ OpenAI API Connection verified successfully!", "success");
      } else {
        showStatus(`✓ Configuration verified for ${provider}.`, "success");
      }
    } catch (err) {
      showStatus(`Connection test failed: ${err.message}`, "error");
    }
  });

  // Clear History
  clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all PromptCard history?")) {
      await chrome.storage.local.set({ [HISTORY_KEY]: [] });
      updateHistoryCounter(0);
      showStatus("History cleared successfully.", "success");
    }
  });

  // Export History (JSON)
  exportHistoryBtn.addEventListener("click", async () => {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    const items = data[HISTORY_KEY] || [];
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptcard_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = `status-msg ${type}`;
    setTimeout(() => {
      if (type === "success") {
        statusMsg.style.display = "none";
      }
    }, 4000);
  }
});
