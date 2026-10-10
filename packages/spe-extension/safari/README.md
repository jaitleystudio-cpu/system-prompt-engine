# SPE Safari Web Extension (macOS & iOS)

This directory contains the native Apple App Wrapper and WebExtension bundle for **Safari on macOS and iOS / iPadOS**.

---

## 🛠️ How to Load Locally in Safari (Developer Mode)

1. Open **Safari**.
2. Go to **Safari** > **Settings...** > **Advanced** and enable **"Show Develop menu in menu bar"**.
3. In the menu bar, click **Develop** > check **"Allow Unsigned Extensions"** (Enter Mac system password).
4. Run the cross-browser build script:
   ```bash
   node scripts/build-cross-browser.mjs
   ```
5. Open the built bundle `packages/spe-extension/dist/safari` or launch the Xcode project to run the companion app on macOS or an iOS simulator.
6. In **Safari Settings** > **Extensions**, toggle **SPE System Prompt Engine** to `ON`.
7. Grant website access to `chatgpt.com`, `claude.ai`, and `gemini.google.com`.

---

## 🍎 Building with Xcode for the Mac App Store / iOS App Store

To convert and generate a full Xcode Project with both macOS and iOS targets:
```bash
xcrun safari-web-extension-converter packages/spe-extension/dist/safari \
  --project-location ./safari/xcode \
  --app-name "SPE Companion" \
  --bundle-identifier io.systempromptengine.safari \
  --swift
```

### Apple App Store Review Compliance (Guideline 3.1.3(b) Multiplatform Services)
Under Apple App Store Review Guideline 3.1.3(b):
- SPE is a multiplatform developer tool available across Chrome, Firefox, Edge, Safari, and Web.
- Users can sign in or enter an offline license key to activate subscriptions purchased on web.
- For users purchasing natively inside the macOS/iOS app, integrate Apple StoreKit In-App Purchase ($0.99/month tier) alongside the web license unlock.
