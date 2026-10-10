// SPE Extension Service Worker (Manifest V3)
// 100% Offline, Zero Cloud Egress, Local Storage Only

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      selectedModel: "auto",
      shieldActive: true,
      customPrompts: [],
      favoriteIds: ["seo-outrank-competitor", "copy-high-converting-landing-page", "write-100-percent-humanizer"]
    });
    console.log("SPE Browser Companion initialized successfully.");
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_CONFIG") {
    chrome.storage.local.get(["selectedModel", "shieldActive", "favoriteIds"], (data) => {
      sendResponse({ status: "OK", data });
    });
    return true;
  }
  
  if (request.type === "SET_CONFIG") {
    chrome.storage.local.set(request.payload, () => {
      sendResponse({ status: "OK" });
    });
    return true;
  }
});
