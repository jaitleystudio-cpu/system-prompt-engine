/**
 * PROMPTCARD · V1.4.0 — Offscreen Document Script
 *
 * Provides headless Canvas API access for Manifest V3 background service workers.
 * Performs fast downsampling, thumbnail creation, and pixel color extraction.
 */

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.target !== "offscreen") return;

    if (request.type === "RESIZE_IMAGE") {
      resizeImage(request.dataUrl, request.maxWidth || 512, request.maxHeight || 512)
        .then((resizedDataUrl) => sendResponse({ success: true, dataUrl: resizedDataUrl }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.type === "EXTRACT_PALETTE") {
      extractColorPalette(request.dataUrl, request.sampleCount || 5)
        .then((palette) => sendResponse({ success: true, palette }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
}

/**
 * Resize image using offscreen canvas to keep memory & transmission lightweight.
 */
function resizeImage(dataUrl, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.getElementById("offscreen-canvas") || document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = (e) => reject(new Error("Failed to load image in offscreen canvas: " + e));
    img.src = dataUrl;
  });
}

/**
 * Extract dominant color palette from image data URL.
 */
function extractColorPalette(dataUrl, sampleCount) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.getElementById("offscreen-canvas") || document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 64, 64);

      const imgData = ctx.getImageData(0, 0, 64, 64).data;
      const hexList = [];

      // Sample evenly spaced pixels across the thumbnail
      const step = Math.floor(imgData.length / (sampleCount * 4));
      for (let i = 0; i < imgData.length && hexList.length < sampleCount; i += step * 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        if (!hexList.includes(hex)) {
          hexList.push(hex);
        }
      }

      resolve(hexList);
    };
    img.onerror = (e) => reject(new Error("Failed to extract palette: " + e));
    img.src = dataUrl;
  });
}
