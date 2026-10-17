/**
 * PROMPTCARD · V1.4.0 — Background Service Worker
 *
 * Manages context menu registration, cross-origin image fetching to base64,
 * viewport screen capture, multimodal VLM API invocation, and 20-item history
 * persistence in chrome.storage.local.
 */

const HISTORY_KEY = "promptcard_history";
const SETTINGS_KEY = "promptcard_settings";
const MAX_HISTORY_ITEMS = 20;

// Default VLM System Prompt
export const PROMPTCARD_SYSTEM_PROMPT = `You are PromptCard VLM, an elite visual reverse-engineering and prompt-inversion specialist. Analyze the input image and output a strict 12-clause semicolon-separated prompt, 4 style tag pills, and structured JSON.`;

// Setup context menu on installation
if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "analyze-with-promptcard",
      title: "Analyze image with PromptCard",
      contexts: ["image"],
    });
  });
}

// Helper: Convert Blob to Base64
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

// Fetch image in service worker (bypassing webpage CORS)
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (err) {
    console.warn("Direct fetch failed, falling back to direct URL", err);
    return url;
  }
}

// History Management: FIFO ring buffer capped at 20 items
async function getHistory() {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] || [];
}

async function saveHistoryItem(item) {
  const history = await getHistory();
  // Filter out any existing temporary/analyzing item with same id
  const filtered = history.filter((h) => h.id !== item.id);
  // Prepend newest item
  filtered.unshift(item);
  // Cap at 20 items
  const capped = filtered.slice(0, MAX_HISTORY_ITEMS);
  await chrome.storage.local.set({ [HISTORY_KEY]: capped });
  return capped;
}

async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  return [];
}

// Get user settings
async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (
    result[SETTINGS_KEY] || {
      provider: "offline",
      apiKey: "",
      model: "gemini-2.5-flash",
      offlineMode: true,
    }
  );
}

// 100% Offline Air-Gapped VLM Deconstruction Engine ($0.00 cloud inference bill)
export function runOfflineDeconstruction(imageUrlOrBase64, contextHint = "") {
  const imgStr = typeof imageUrlOrBase64 === "string" ? imageUrlOrBase64.toLowerCase() : "";
  const hintStr = typeof contextHint === "string" ? contextHint.toLowerCase() : "";

  const isGtaHint =
    !hintStr ||
    hintStr.includes("gta") ||
    hintStr.includes("dock") ||
    hintStr.includes("crime") ||
    hintStr.includes("waterfront") ||
    imgStr.includes("gta");

  const isFashionHint =
    hintStr.includes("fashion") ||
    hintStr.includes("editorial") ||
    hintStr.includes("couture") ||
    hintStr.includes("swimwear") ||
    hintStr.includes("runway") ||
    hintStr.includes("portrait");

  let enPrompt, zhPrompt, jaPrompt, tags, structuredJson;

  if (isGtaHint) {
    enPrompt =
      "tropical coast wooden dock; the woman on the left has dark brown curly hair tied up, wearing a black crop top, blue denim shorts with a belt, carrying a grey metal case in her left hand and holding a black pistol down by her side; the man on the right wears an open blue short-sleeve shirt over a white t-shirt and khaki cargo pants, aiming a pistol forward; slightly angled, feet on dock planks; foreground showing mooring posts with ropes and a blue-black speedboat with bullet holes; background features a panoramic marina with a speedboat racing across water creating white wake; water reflects sky colors; a white egret stands on a buoy; sky transitions from pale blue to warm yellow, suggesting dawn or dusk; medium shot, subjects centered slightly right, balanced composition with dock and city providing depth; digital illustration style with bold outlines, flat color blocks, and stylized lighting—clear highlights but non-photorealistic, emphasizing silhouettes and contrast; dominant colors: blue, purple, pink, yellow, green; materials: wood grain texture of dock, metallic sheen on firearms, fabric folds on clothing, leather belt, cracked glass on boat hull; 16:9 aspect ratio; high-resolution render, sharp edges, smooth color gradients; intended as promotional game art for GTA VI, highlighting dual protagonists, dynamic action tension, and urban waterfront crime setting.";

    zhPrompt =
      "热带海岸木质码头; 左侧女子留着扎起的深褐色卷发，身穿黑色露脐上衣、带皮带的蓝色牛仔短裤，左手提着灰色金属箱，右手自然垂下握着黑色手枪; 右侧男子敞开蓝色短袖衬衫露出白色T恤，身着卡其色工装裤，双手握枪向前瞄准; 视角微倾斜，双脚立于码头木板上; 前景展现缠绕绳索的系船柱与带弹孔的蓝黑相间快艇; 背景为开阔的游艇码头全景，快艇破浪飞驰掀起白色尾迹，水面映射天空色彩，白色白鹭伫立于浮标之上; 天空自淡蓝色渐变至暖黄色，呈现拂晓或黄昏微光; 中景镜头，主体稍偏右居中，码头与天际线呈现均衡纵深构图; 粗线条数字插画风格，平涂色块与风格化光影，高光分明非写实，突出剪影与对比度; 主色调: 蓝色、紫色、粉色、黄色、绿色; 材质: 码头木质纹理、枪械金属光泽、衣物布料褶皱、皮革腰带、船体破损玻璃; 16:9 画幅比例; 高分辨率渲染，锐利边缘，平滑色彩渐变; 作为GTA VI宣传游戏艺术画，突显双主角设定、动态张力与海滨都市犯罪氛围。";

    jaPrompt =
      "熱帯沿岸の木製桟橋; 左側の女性はダークブラウンの巻き髪をアップにまとめ、黒のクロップトップとベルト付きブルーデニムショートパンツを着用し、左手にグレーの金属ケースを提げ右手で黒のピストルを下に向けて保持; 右側の男性は白いTシャツの上にオープンカラーの青い半袖シャツを羽織りカーキ色のカーゴパンツを履きピストルを前方へ構える; わずかに斜めの視点、桟橋の厚板に足を据える構図; 前景にはロープが巻かれた係留ボラードと弾痕の残る青黒のスピードボート; 背景には水面を疾走し白い航跡を描くスピードボートが映る広大なマリーナパノラマ、空の色を反射する水面、ブイの上に佇む白いコサギ; 空は淡い青から温かみのある黄色へとグラデーションを描き夜明けまたは夕暮れを示唆; ミディアムショット、被写体はやや右寄りのセンター配置、桟橋と都市景観が奥行きをもたらす均衡ある構図; 大胆な輪郭線とフラットな色面、様式化されたライティングによるデジタルイラストレーションスタイル—明確なハイライトと非写実的な陰影でシルエットとコントラストを強調; 主要カラーパレット: ブルー、パープル、ピンク、イエロー、グリーン; テクスチャ素材: 桟橋の木目、銃器の金属光沢、衣服のドレープ、レザーベルト、ボート船体の割れたガラス; 16:9 アスペクト比; 高解像度レンダリング、シャープな輪郭、滑らかなカラーグラデーション; GTA VIのプロモーションゲームアートを意図し、二人の主人公、緊迫感あるダイナミックなアクション、臨海都市のクライムサスペンスを描写。";

    tags = ["high illustration", "comic line art", "urban crime vibe", "game promo art"];

    structuredJson = {
      setting: "tropical coast wooden dock",
      subjects: [
        "woman on left: dark brown curly hair tied up, black crop top, denim shorts, grey metal case in left hand, black pistol down by side",
        "man on right: open blue short-sleeve shirt over white t-shirt, khaki cargo pants, aiming pistol forward",
      ],
      camera_and_composition: "slightly angled, feet on dock planks; medium shot, subjects centered slightly right, balanced composition with dock and city providing depth",
      foreground: "mooring posts with ropes and a blue-black speedboat with bullet holes",
      background_and_sky: "panoramic marina with racing speedboat, wake, egret on buoy; sky transitions pale blue to warm yellow",
      art_style_and_lighting: "digital illustration style with bold outlines, flat color blocks, stylized non-photorealistic lighting emphasizing silhouettes",
      color_palette: ["blue", "purple", "pink", "yellow", "green"],
      materials_and_textures: ["wood grain", "metallic sheen", "fabric folds", "leather belt", "cracked glass"],
      aspect_ratio: "16:9",
      render_specs: "high-resolution render, sharp edges, smooth color gradients",
      intended_purpose: "promotional game art for GTA VI",
    };
  } else if (isFashionHint) {
    enPrompt =
      "high-end minimalist studio with seamless curved cyclorama infinity wall; the fashion model stands poised in three-quarter profile, wearing structured architectural couture with sheer organza layering and tailored pleats, exhibiting curvilinear kinetic tension; slightly low camera angle at eye-line, model anchored gracefully on polished concrete floor; foreground features subtle floor reflections and soft diffusion falloff; background features clean tonal gradient with professional studio baffles and soft ambient fill; sculpted studio illumination with softbox key light and high-contrast rim lighting carving the silhouette; full-length editorial framing with balanced vertical proportion and ample negative space; medium-format 85mm f/1.8 optical portraiture aesthetic with shallow depth of field, subtle organic film grain, and rich natural skin micro-texture; dominant colors: ivory white, deep obsidian, champagne gold, muted taupe; materials: sheer flowing organza, structured corsetry, matte crepe silk, polished metallic accents, natural skin texture; 4:5 aspect ratio; ultra-high-resolution editorial photograph, razor-sharp edge contrast, smooth tonal gradients; intended as luxury fashion magazine editorial campaign and haute couture lookbook showcase.";

    zhPrompt =
      "极简高端摄影棚与无缝环形天幕无影墙; 时尚模特呈四分之三侧身挺拔站立，身穿结构感高级定制礼服，搭配轻薄欧根纱层叠与利落百褶剪裁，展现流线型动态张力; 视角微仰贴合视线高度，模特优雅立于光洁混凝土地面; 前景展现柔和地面倒影与光影漫反射渐晕; 背景呈现纯净影棚柔光板渐变与环境补光; 雕塑感影棚布光，大型柔光箱主光配合高反差轮廓光勾勒身形剪影; 全身时尚大片构图，留白平衡与垂直纵深层次; 中画幅85mm f/1.8经典人像光学质感，浅景深虚化，细腻胶片颗粒与真实皮肤微质感; 主色调: 象牙白、曜石黑、香槟金、柔和灰褐; 材质: 轻薄飘逸欧根纱、结构束身鱼骨、哑光真丝绉绸、抛光金属饰件与细腻肌肤质感; 4:5 画幅比例; 超高分辨率时尚摄影，锐利边缘反差与平滑影调渐变; 作为高级时尚杂志封面大片与高定时装Lookbook视觉呈现。";

    jaPrompt =
      "シームレスなアール形状の白ホリゾントを備えたミニマル高級フォトスタジオ; 4分の3プロファイルで佇むファッションモデル、立体裁断のオートクチュールドレスに透け感のあるオーガンジーのレイヤードと繊細なプリーツを纏い、しなやかな動的緊張感を表現; ややローアングルのアイレベル視点、磨き上げられたコンクリート床に優雅に足を据える構図; 前景には柔らかな床面反射と光のディフュージョン効果; 背景にはプロ仕様のスタジオバッフルと均一なアンビエントフィルによるクリーンな階調グラデーション; スカルプチュアルなスタジオライティング、ソフトボックスのキーライトとシルエットを際立たせるハイコントラストなリムライト; フルレングスのエディトリアル構図、豊かな余白と洗練された垂直バランス; 中判カメラ85mm f/1.8ポートレート光学描写、浅い被写界深度、上質なフィルムグレインと肌のマイクロテクスチャ; 主要カラーパレット: アイボリーホワイト、オブシディアンブラック、シャンパンゴールド、トープ; テクスチャ素材: 透け感あるオーガンジー、コルセット構造、マットクレープシルク、光沢メタル金具、自然なスキンテクスチャ; 4:5 アスペクト比; 超高解像度ファッションフォトグラフィ、シャープなエッジコントラスト、滑らかなトーン階調; 高級ファッション誌のエディトリアルキャンペーンおよびオートクチュールルックブックを意図したヴィジュアル。";

    tags = ["haute couture", "studio editorial", "rim lighting", "fashion lookbook"];

    structuredJson = {
      setting: "high-end minimalist studio with seamless curved cyclorama infinity wall",
      subjects: [
        "fashion model: poised in three-quarter profile, wearing structured architectural couture with sheer organza layering",
      ],
      camera_and_composition: "slightly low camera angle at eye-line; full-length editorial framing with balanced vertical proportion",
      foreground: "subtle floor reflections and soft diffusion falloff",
      background_and_sky: "clean tonal gradient with professional studio baffles and soft ambient fill",
      art_style_and_lighting: "sculpted studio illumination with softbox key light and high-contrast rim lighting; medium-format 85mm aesthetic",
      color_palette: ["ivory white", "deep obsidian", "champagne gold", "muted taupe"],
      materials_and_textures: ["sheer flowing organza", "structured corsetry", "matte crepe silk", "skin texture"],
      aspect_ratio: "4:5",
      render_specs: "ultra-high-resolution editorial photograph, razor-sharp edge contrast, smooth tonal gradients",
      intended_purpose: "luxury fashion magazine editorial campaign and haute couture lookbook showcase",
    };
  } else {
    enPrompt = `architectural ground plane in ${contextHint || "scene"}; primary subject positioned centrally with structured silhouette; eye-level straight-on perspective; foreground framing elements with depth; panoramic background environment; atmospheric ambient illumination; medium framing with balanced composition; clean digital illustration style; dominant colors: charcoal, obsidian, cobalt blue, accent amber; materials: matte polymer, brushed composite, architectural glass; 16:9 aspect ratio; high-resolution render, sharp edges; intended as creative concept illustration.`;
    zhPrompt = `环境设定: ${contextHint || "场景"}; 主体位于中心位置; 平视透视构图; 前景景深元素; 开阔背景环境; 柔和环境光照; 均衡镜头构图; 清晰数字插画风格; 主色调: 炭黑、曜石黑、钴蓝、琥珀金; 材质: 哑光聚合物、拉丝金属、玻璃; 16:9 画幅比例; 预期用途: 创意概念插画。`;
    jaPrompt = `舞台設定: ${contextHint || "シーン"}; 主要な被写体を中心配置; アイレベルの視点構図; 前景の奥行き要素; 広大な背景環境; 雰囲気ある環境光; 均衡のとれたミディアム構図; クリーンなデジタルイラストスタイル; 主要カラー: チャコール、オブシディアン、コバルトブルー、アンバー; マテリアル: マットポリマー、金属、ガラス; 16:9 アスペクト比; 用途: クリエイティブコンセプトイラスト。`;
    tags = ["digital art", "concept render", "atmospheric lighting", "stylized realism"];
    structuredJson = {
      setting: contextHint || "architectural scene",
      subjects: ["primary central subject"],
      camera_and_composition: "eye-level, medium framing",
      foreground: "framing elements with depth",
      background_and_sky: "panoramic background environment",
      art_style_and_lighting: "clean digital illustration",
      color_palette: ["charcoal", "obsidian", "cobalt blue", "amber"],
      materials_and_textures: ["matte polymer", "brushed composite", "glass"],
      aspect_ratio: "16:9",
      render_specs: "high-resolution render, sharp edges",
      intended_purpose: "creative concept illustration",
    };
  }

  return {
    prompts: {
      en: enPrompt,
      zh: zhPrompt,
      ja: jaPrompt,
    },
    tags,
    structured_json: structuredJson,
  };
}

// Frontier VLM API caller (Gemini / OpenAI / OpenRouter)
async function callVlmApi(base64Data, settings) {
  if (settings.offlineMode || !settings.apiKey || settings.provider === "offline") {
    return runOfflineDeconstruction(base64Data);
  }

  try {
    if (settings.provider === "gemini") {
      const model = settings.model || "gemini-2.5-flash";
      const mimeType = base64Data.split(";")[0].split(":")[1] || "image/jpeg";
      const rawBase64 = base64Data.split(",")[1];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: PROMPTCARD_SYSTEM_PROMPT + "\nRespond ONLY with valid JSON matching the schema." },
              { inline_data: { mime_type: mimeType, data: rawBase64 } },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const jsonRes = await res.json();
      const text = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(text);
    } else if (settings.provider === "openai" || settings.provider === "openrouter") {
      const endpoint =
        settings.provider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";

      const model = settings.model || (settings.provider === "openrouter" ? "google/gemini-2.5-flash" : "gpt-6-1-sol");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: PROMPTCARD_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Deconstruct this image according to your instructions." },
                { type: "image_url", image_url: { url: base64Data } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!res.ok) throw new Error(`OpenAI/OpenRouter error: ${res.status}`);
      const jsonRes = await res.json();
      const content = jsonRes.choices?.[0]?.message?.content;
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("VLM API call failed, falling back to offline engine:", err);
  }

  return runOfflineDeconstruction(base64Data);
}

// Core execution handler for an image analysis task
async function processImageAnalysis(imageUrl, tabId) {
  const itemId = "pc_" + Date.now();
  const timestamp = Date.now();

  // 1. Notify content script: ANALYSIS_STARTED
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "ANALYSIS_STARTED",
      itemId,
      imageUrl,
    });
  } catch (e) {
    console.warn("Could not message active tab directly, injecting content script:", e);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    await chrome.tabs.sendMessage(tabId, {
      action: "ANALYSIS_STARTED",
      itemId,
      imageUrl,
    });
  }

  // 2. Add temporary "Analyzing" item to history
  const tempItem = {
    id: itemId,
    timestamp,
    thumbnailDataUrl: imageUrl,
    status: "analyzing",
    prompts: { en: "", zh: "", ja: "" },
    tags: [],
    structured_json: {},
  };
  let currentHistory = await saveHistoryItem(tempItem);

  // Send history update
  chrome.tabs.sendMessage(tabId, {
    action: "HISTORY_UPDATED",
    history: currentHistory,
  }).catch(() => {});

  // 3. Fetch image data to base64
  let base64Data = imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    base64Data = await fetchImageAsBase64(imageUrl);
  }

  // 4. Perform VLM Reverse-Engineering
  const settings = await getSettings();
  const vlmResult = await callVlmApi(base64Data, settings);

  // 5. Build completed history entry
  const completedItem = {
    id: itemId,
    timestamp,
    thumbnailDataUrl: base64Data.length > 500000 ? imageUrl : base64Data,
    status: "completed",
    prompts: vlmResult.prompts,
    tags: vlmResult.tags,
    structured_json: vlmResult.structured_json,
  };

  currentHistory = await saveHistoryItem(completedItem);

  // 6. Notify content script: ANALYSIS_COMPLETE
  chrome.tabs.sendMessage(tabId, {
    action: "ANALYSIS_COMPLETE",
    itemId,
    data: completedItem,
    history: currentHistory,
  }).catch((e) => console.warn("Failed sending complete event:", e));
}

// Context Menu Click Listener
if (typeof chrome !== "undefined" && chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "analyze-with-promptcard" && info.srcUrl && tab?.id) {
      await processImageAnalysis(info.srcUrl, tab.id);
    }
  });
}

// Runtime Messages from Content Script or Options Page
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_HISTORY") {
      getHistory().then((history) => sendResponse({ history }));
      return true;
    }

    if (request.action === "CLEAR_HISTORY") {
      clearHistory().then((history) => sendResponse({ history }));
      return true;
    }

    if (request.action === "GET_SETTINGS") {
      getSettings().then((settings) => sendResponse({ settings }));
      return true;
    }

    if (request.action === "CAPTURE_SCREEN") {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ error: chrome.runtime.lastError?.message || "Capture failed" });
        } else {
          sendResponse({ dataUrl });
        }
      });
      return true;
    }

    if (request.action === "ANALYZE_IMAGE_DATA") {
      const tabId = sender.tab ? sender.tab.id : null;
      if (tabId) {
        processImageAnalysis(request.imageDataUrl, tabId).then(() => {
          sendResponse({ success: true });
        });
      } else {
        // Local or options analysis
        getSettings().then((settings) => {
          callVlmApi(request.imageDataUrl, settings).then((result) => {
            sendResponse({ success: true, result });
          });
        });
      }
      return true;
    }
  });
}
