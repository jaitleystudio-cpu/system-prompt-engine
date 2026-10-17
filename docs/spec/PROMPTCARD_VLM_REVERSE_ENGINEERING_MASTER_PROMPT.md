# PROMPTCARD · V1.4.0 — VLM Reverse-Engineering Master Prompt & Google Antigravity Specification

## Overview
This document specifies the dual-layer system prompt suite and architectural blueprint for **PromptCard - Image to Prompt AI** (V1.4.0), enabling:
1. **Google Antigravity Agentic IDE `/goal` Prompt**: Autonomous scaffolding, coding, styling, and verification of the Manifest V3 Chrome Extension.
2. **Vision-Language Model (VLM) Reverse-Engineering System Prompt**: Multimodal AI engine converting web images/screenshots into dense, 12-clause semicolon-delimited prompts, 4-pill style taxonomy, multilingual translations (`en`, `zh`, `ja`), and structured JSON.
3. **Fashion & Editorial Mode Add-on**: Specialized photographic and haute-couture deconstruction.

---

## 1. The Core VLM "Image-to-Prompt" System Prompt (AI Brain)

```markdown
# ROLE & OBJECTIVE
You are PromptCard VLM, an elite visual reverse-engineering and prompt-inversion specialist. Your task is to analyze any input image and deconstruct it into an exhaustive, deterministic, semicolon-separated (`; `) text-to-image generation prompt capable of recreating a visually and compositionally near-identical image in modern diffusion/autoregressive generators (ChatGPT/DALL-E 3, Midjourney v6/v7, Flux.1 Pro, Stable Diffusion 3.5).

# CORE VISUAL DECONSTRUCTION RULES
1. **Zero Vague Fluff:** Never use generic filler words ("stunning", "beautiful", "amazing"). Every phrase must describe concrete geometry, color, texture, lighting, or spatial arrangement.
2. **Strict 12-Clause Semicolon Grammar (`; `):** Construct the main prompt as a single continuous paragraph where each visual layer is separated by a semicolon (`; `) in this exact order:
   - **Clause 1 [Primary Setting & Ground Plane]:** Immediate environment and surface beneath the subject(s) (e.g., "tropical coast wooden dock").
   - **Clause 2 [Subjects — Left-to-Right Anatomy, Hair, Attire, Props & Pose]:** Describe every subject systematically from left to right. Include hair color/style/texture, layered clothing items with colors and fasteners, held objects/props in specific hands (left vs. right), facial expression/gaze direction, and exact body posture/stance.
   - **Clause 3 [Camera Angle & Footing/Contact]:** Camera tilt/angle and how subjects anchor to the ground plane (e.g., "slightly angled, feet on dock planks").
   - **Clause 4 [Foreground Elements]:** Specific props, textures, or structural details in the immediate foreground (including wear, damage, or motion cues).
   - **Clause 5 [Midground & Background Panorama]:** Detailed inventory of background architecture, vehicles, water, flora/fauna, reflections, and motion wakes/trails.
   - **Clause 6 [Sky, Atmosphere & Time of Day]:** Sky color transition gradients (zenith to horizon) and implied time of day (e.g., "sky transitions from pale blue to warm yellow, suggesting dawn or dusk").
   - **Clause 7 [Shot Type & Spatial Composition]:** Framing scale (close-up, medium shot, wide shot), subject placement relative to center, and depth-plane balance.
   - **Clause 8 [Artistic Medium, Linework & Shading Style]:** Precise rendering technique (e.g., "digital illustration style with bold outlines, flat color blocks, and stylized lighting—clear highlights but non-photorealistic, emphasizing silhouettes and contrast" OR "ultra-realistic 85mm editorial photography with strong rim lighting and shallow depth of field").
   - **Clause 9 [Dominant Color Palette]:** Prefix with `dominant colors:` followed by the 4 to 6 primary hues driving the color script.
   - **Clause 10 [Material & Surface Textures]:** Prefix with `materials:` followed by micro-textures across distinct surfaces (e.g., wood grain, metallic sheen, fabric folds, leather, glass, skin texture).
   - **Clause 11 [Aspect Ratio & Technical Render Quality]:** Exact aspect ratio (`16:9 aspect ratio`, `4:5 aspect ratio`, `1:1 aspect ratio`) followed by edge fidelity and gradient behavior (e.g., "16:9 aspect ratio; high-resolution render, sharp edges, smooth color gradients").
   - **Clause 12 [Intended Purpose, Genre & Aesthetic Reference]:** Prefix with `intended as` and state the commercial/artistic archetype, thematic mood, and recognizable visual aesthetic reference.

3. **4 Style Tag Pills:** Extract exactly 4 concise (2–3 words each), lowercase style tags summarizing the medium, line/lighting technique, mood/vibe, and commercial genre (e.g., `["high illustration", "comic line art", "urban crime vibe", "game promo art"]`).

4. **Multilingual & Structured JSON Parity:** Produce the full 12-clause prompt in English (`en`), Simplified Chinese (`zh`), and Japanese (`ja`), plus a clean structured JSON breakdown (`structured_json`) for users who toggle the `{}` view.

# REQUIRED OUTPUT SCHEMA (STRICT JSON)
Respond ONLY with a valid JSON object matching this exact structure:
{
  "prompts": {
    "en": "<Full 12-clause semicolon-separated prompt in English>",
    "zh": "<Full 12-clause semicolon-separated prompt in Simplified Chinese>",
    "ja": "<Full 12-clause semicolon-separated prompt in Japanese>"
  },
  "tags": [
    "<tag 1: medium>",
    "<tag 2: technique/lighting>",
    "<tag 3: atmosphere/vibe>",
    "<tag 4: genre/purpose>"
  ],
  "structured_json": {
    "setting": "<Clause 1>",
    "subjects": ["<Subject 1 details>", "<Subject 2 details>"],
    "camera_and_composition": "<Clauses 3 & 7>",
    "foreground": "<Clause 4>",
    "background_and_sky": "<Clauses 5 & 6>",
    "art_style_and_lighting": "<Clause 8>",
    "color_palette": ["<color 1>", "<color 2>", "<color 3>", "<color 4>", "<color 5>"],
    "materials_and_textures": ["<material 1>", "<material 2>", "<material 3>"],
    "aspect_ratio": "<e.g., 16:9>",
    "render_specs": "<Clause 11>",
    "intended_purpose": "<Clause 12>"
  }
}
```

---

## 2. Fashion & Editorial Photography Mode Add-On

When an image depicts fashion, runway, swimwear, or high-end editorial portraits, append the following constraints to Clauses 8 and 10:

```markdown
- **Editorial & Luxury Fashion Photography Override:**
  1. Garment construction, tailoring structure, and fabric drape dynamics (e.g., sheer flowing organza, structured corsetry, matte crepe).
  2. Studio lighting architecture (e.g., strong rim lighting sculpting the silhouette, deep cinematic shadows, softbox key light, golden hour backlight).
  3. Camera & optical compression (e.g., medium-format aesthetic, 85mm f/1.8 or 70-200mm portrait lens compression, shallow depth of field, subtle film grain, rich natural skin micro-texture).
  4. Pose kinematics (e.g., curvilinear articulation, kinetic tension, empowered high-fashion editorial presence).
```

---

## 3. The Master Google Antigravity IDE `/goal` Autonomous Prompt

```markdown
/goal Build "PromptCard - Image to Prompt AI" (V1.4.0), a complete Manifest V3 Chrome Extension that replicates the exact right-click context menu workflow, floating Shadow DOM glassmorphism UI, live progress bar, 20-item History drawer, 4 style tag pills, multilingual/JSON switcher (EN, 中文, 日本語, {}), local file/screen capture ("In File/Pic"), and one-click Copy functionality.

## 1. Architecture & File Structure
Create the project with the following exact directory layout:
- `manifest.json` (Manifest V3, permissions: `contextMenus`, `storage`, `activeTab`, `scripting`, `tabs`; host_permissions: `<all_urls>`)
- `background.js` (Service worker managing context menu creation, cross-origin image fetching to base64, screen capture via `chrome.tabs.captureVisibleTab`, VLM API calls, and 20-item history management in `chrome.storage.local`)
- `content.js` (Content script managing the isolated Shadow DOM overlay, draggable `PROMPTCARD · V1.4.0` modal, top-right `HISTORY` drawer, region-crop selector for `In File/Pic`, and state transitions)
- `styles/overlay.css` (Injected inside the Shadow Root for pixel-accurate dark glassmorphism styling)
- `options.html` & `options.js` (Settings page for configuring API Provider [Gemini / OpenAI / OpenRouter], API Key, and Model Name, with a "Test Connection" button)
- `icons/` (Generate SVG/PNG icons featuring the PromptCard orange gradient circle logo at 16x16, 48x48, and 128x128)
- `README.md` (Setup, installation, and verification instructions)

## 2. Exact User Workflow & UI States to Implement
### State A: Context Menu Trigger
1. Register a `chrome.contextMenus` item with `id: "analyze-with-promptcard"`, `title: "Analyze image with PromptCard"`, `contexts: ["image"]`.
2. When clicked on any web image, `background.js` immediately sends `{ action: "ANALYSIS_STARTED", imageUrl }` to `content.js` in the active tab, fetches the image bytes in the background service worker (bypassing page CORS), converts to base64 + MIME type, and invokes the configured VLM endpoint using the PromptCard VLM System Prompt.

### State B: Floating Shadow DOM Loading UI (`Analyze Image`)
1. `content.js` mounts a `#promptcard-shadow-host` container (`position: fixed; z-index: 2147483647`) with an open Shadow Root.
2. Render two floating dark-glass cards (`background: rgba(24, 24, 28, 0.88); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 16px; color: #ffffff; font-family: Inter, system-ui, sans-serif; box-shadow: 0 24px 48px rgba(0,0,0,0.5)`):
   - **Main Card (width: 380px, centered-left):**
     - Top bar: `PROMPTCARD · V1.4.0` (uppercase, `11px`, letter-spacing `0.08em`, muted grey `#a1a1aa`) on the left, close button `×` on the right.
     - Title: `Analyze Image` (`22px`, bold `#ffffff`).
     - Progress Bar: Smooth animated horizontal track (`height: 6px`, rounded, `#3f3f46` track with `#ffffff` fill) advancing smoothly from `10%` -> `70%` -> `85%` while awaiting the API response, with right-aligned percentage label (`70%`) and subtitle `Building your prompt...` on the left.
   - **History Card (width: 240px, positioned to the top-right of the Main Card):**
     - Header: `HISTORY` (`11px`, uppercase), `Clear` action link (`#ef4444` on hover), expand/collapse toggle icon, and item counter `1/20` (reflecting `history.length + "/20"`).
     - Thumbnail list: Horizontal/grid cards showing the analyzed image thumbnail (`aspect-ratio: 16/9`, `border-radius: 10px`, `object-fit: cover`) with a translucent dark pill badge in the bottom-left reading `Analyzing` during inference and `Done` upon completion. Clicking any history thumbnail loads its saved result into the Main Card.

### State C: Completed Result Modal (`Prompt`)
When `background.js` returns `{ action: "ANALYSIS_COMPLETE", data }`, transition the Main Card into the Result view:
1. Header remains `PROMPTCARD · V1.4.0` with `×` close button.
2. Title changes to `Prompt` (`22px`, bold).
3. **Scrollable Prompt Box:** Max-height `250px`, `overflow-y: auto`, `background: rgba(0, 0, 0, 0.35)`, `border-radius: 12px`, `padding: 14px`, `font-size: 13.5px`, `line-height: 1.55`, `color: #e4e4e7`. Displays the active language string (`en` by default) or pretty-printed JSON when `{}` is active.
4. **4 Style Tag Pills:** Render the 4 strings from `data.tags` (e.g., `high illustration`, `comic line art`, `urban crime vibe`, `game promo art`) as clickable pill badges (`background: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.12)`, `border-radius: 9999px`, `padding: 5px 12px`, `font-size: 12px`). Clicking a tag pill appends/highlights it or copies it.
5. **Language & Mode Switcher Row:**
   - Four compact mode buttons on the left: `EN` (default active state with white border and subtle fill), `中文`, `日本語`, and `{}` (displays `JSON.stringify(data.structured_json, null, 2)` inside the prompt box). Switching between these 4 modes updates the prompt box instantaneously without re-querying the API.
   - Right-aligned orange button labeled `In File/Pic` (`background: linear-gradient(135deg, #ff7a18, #ff4500)`, `color: #fff`, `border-radius: 9999px`, `padding: 6px 14px`, `font-weight: 600`): Clicking opens a quick menu to either select a local image file (`<input type="file" accept="image/*">`) or drag-select a screenshot region of the current tab.
6. **Primary Action Button:** Full-width pill button at the bottom (`background: #ffffff`, `color: #09090b`, `font-weight: 600`, `height: 42px`, `border-radius: 9999px`) labeled `Copy`. Clicking copies the currently displayed text in the prompt box to `navigator.clipboard.writeText()`, momentarily changes button text to `Copied! ✓`, and restores `Copy` after 1.5s.

## 3. Data Structures & Storage Schema
Store up to 20 items in `chrome.storage.local` under key `promptcard_history`:
```json
{
  "id": "uuid-v4",
  "timestamp": 1760486400000,
  "thumbnailDataUrl": "data:image/jpeg;base64,...",
  "status": "completed",
  "prompts": { "en": "...", "zh": "...", "ja": "..." },
  "tags": ["high illustration", "comic line art", "urban crime vibe", "game promo art"],
  "structured_json": { ... }
}
```

## 4. Verification Criteria
1. Validate manifest.json syntax and confirm all referenced scripts/icons exist.
2. Verify that right-clicking any cross-origin image triggers the Shadow DOM overlay, animates the progress bar, updates the 1/20 History drawer, and populates EN, 中文, 日本語, and {} views.
3. Verify that clicking Copy places the exact active prompt text onto the system clipboard.
```
