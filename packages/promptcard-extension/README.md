# PromptCard - Image to Prompt AI (PROMPTCARD · V1.4.0)

Manifest V3 Chrome Extension replicating the exact workflow, floating glassmorphism UI, and reverse-engineering capabilities demonstrated in PromptCard V1.4.0.

## Key Features

1. **Right-Click Context Menu Trigger:**
   Right-click any web image and select **"Analyze image with PromptCard"**. Images are fetched securely in the background service worker, avoiding tainted canvas and CORS errors.

2. **Isolated Glassmorphism Shadow DOM Overlay:**
   Injected into `#promptcard-shadow-host` with an open shadow root to guarantee zero CSS collisions with host websites.

3. **Dual Floating Panels:**
   - **Main Card (`PROMPTCARD · V1.4.0`):**
     - Loading state with smooth horizontal progress bar (10% -> 70% -> 85%) and status label.
     - Result state with scrollable prompt box, 4 rounded style tag pills (`high illustration`, `comic line art`, `urban crime vibe`, `game promo art`), instant language switcher (`EN`, `中文`, `日本語`, `{}`), and full-width `Copy` button.
   - **History Card (`HISTORY`):**
     - Positioned to the top-right; shows `1/20` counter, `Clear` button, and thumbnail gallery with live `Analyzing` / `Done` badges. Clicking any thumbnail restores that card.

4. **"In File/Pic" Multi-Input:**
   - Upload local image files directly via file picker.
   - Interactive screen region drag-crop overlay for capturing any arbitrary webpage element.

5. **100% Offline Air-Gapped Engine ($0.00 Cloud Bill):**
   Includes a local deterministic deconstruction engine that runs completely offline with zero network egress, alongside optional BYOK providers (Gemini, OpenAI, OpenRouter, Ollama).

## Installation

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select `packages/promptcard-extension`.
4. (Optional) Open the extension settings page to configure an external VLM provider or leave in Offline mode for $0.00 zero-cost inference.

## Testing

Run the automated verification test suite:
```bash
node test/promptcard.test.mjs
```
