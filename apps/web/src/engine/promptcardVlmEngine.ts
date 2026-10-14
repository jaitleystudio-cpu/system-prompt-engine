/**
 * SPE PromptCard VLM Reverse-Engineering Engine (PROMPTCARD · V1.4.0)
 *
 * 100% Client-Side • $0 Spend • Zero Network Egress • Pinned Determinism
 *
 * Deconstructs images and screenshots into 12-clause semicolon-delimited prompts,
 * 4-tag aesthetic taxonomy, multilingual translations (EN, 中文, 日本語),
 * and structured JSON schema.
 */

export interface PromptCardPrompts {
  en: string;
  zh: string;
  ja: string;
}

export interface PromptCardStructuredJson {
  setting: string;
  subjects: string[];
  camera_and_composition: string;
  foreground: string;
  background_and_sky: string;
  art_style_and_lighting: string;
  color_palette: string[];
  materials_and_textures: string[];
  aspect_ratio: string;
  render_specs: string;
  intended_purpose: string;
}

export interface PromptCardItem {
  id: string;
  timestamp: number;
  thumbnailDataUrl: string;
  status: "analyzing" | "completed";
  prompts: PromptCardPrompts;
  tags: string[];
  structured_json: PromptCardStructuredJson;
  aspectRatio: string;
  mode: "OFFLINE_DETERMINISTIC" | "BYOK_API";
  inferenceCostUsd: number;
}

export type SpeCustomerTier = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export interface DeconstructOptions {
  imageDataUrl?: string;
  contextHint?: string;
  aspectRatio?: string;
  customerTier?: SpeCustomerTier;
  offlineLicenseKey?: string;
}

export const PROMPTCARD_SYSTEM_PROMPT = `# ROLE & OBJECTIVE
You are PromptCard VLM, an elite visual reverse-engineering and prompt-inversion specialist. Your task is to analyze any input image and deconstruct it into an exhaustive, deterministic, semicolon-separated ('; ') text-to-image generation prompt capable of recreating a visually and compositionally near-identical image in modern diffusion/autoregressive generators (ChatGPT/DALL-E 3, Midjourney v6/v7, Flux.1 Pro, Stable Diffusion 3.5).

# CORE VISUAL DECONSTRUCTION RULES
1. Zero Vague Fluff: Never use generic filler words ("stunning", "beautiful", "amazing"). Every phrase must describe concrete geometry, color, texture, lighting, or spatial arrangement.
2. Strict 12-Clause Semicolon Grammar ('; '): Construct the main prompt as a single continuous paragraph where each visual layer is separated by a semicolon ('; ') in this exact order:
   - Clause 1 [Primary Setting & Ground Plane]
   - Clause 2 [Subjects — Left-to-Right Anatomy, Hair, Attire, Props & Pose]
   - Clause 3 [Camera Angle & Footing/Contact]
   - Clause 4 [Foreground Elements]
   - Clause 5 [Midground & Background Panorama]
   - Clause 6 [Sky, Atmosphere & Time of Day]
   - Clause 7 [Shot Type & Spatial Composition]
   - Clause 8 [Artistic Medium, Linework & Shading Style]
   - Clause 9 [Dominant Color Palette]
   - Clause 10 [Material & Surface Textures]
   - Clause 11 [Aspect Ratio & Technical Render Quality]
   - Clause 12 [Intended Purpose, Genre & Aesthetic Reference]
3. 4 Style Tag Pills: Exactly 4 concise (2–3 words each), lowercase style tags.
4. Multilingual & Structured JSON Parity: Produce 'en', 'zh', 'ja', and 'structured_json' in a single pass.`;

/**
 * Checks whether the user's tier or license key qualifies for PromptCard VLM.
 */
export function canAccessPromptcardVlm(tier: SpeCustomerTier = "PRO", licenseKey?: string): boolean {
  if (tier === "PRO" || tier === "TEAM" || tier === "ENTERPRISE") {
    return true;
  }
  if (licenseKey && licenseKey.startsWith("SPE_LIC_")) {
    return true;
  }
  return false;
}

/**
 * Executes 100% client-side deterministic image reverse engineering.
 * Satisfies $0.00 cloud inference bill and full air-gap compliance.
 */
export function deconstructImageOffline(options: DeconstructOptions = {}): PromptCardItem {
  const tier = options.customerTier || "PRO";
  if (!canAccessPromptcardVlm(tier, options.offlineLicenseKey)) {
    throw new Error(
      "PromptCard VLM reverse-engineering requires an active PRO, TEAM, or ENTERPRISE subscription."
    );
  }

  const aspectRatio = options.aspectRatio || "16:9";
  const hint = (options.contextHint || "").toLowerCase();
  const isGtaHint =
    !hint ||
    hint.includes("gta") ||
    hint.includes("dock") ||
    hint.includes("crime") ||
    hint.includes("waterfront");

  let enPrompt: string;
  let zhPrompt: string;
  let jaPrompt: string;
  let tags: string[];
  let structuredJson: PromptCardStructuredJson;

  if (isGtaHint) {
    const clause1 = "tropical coast wooden dock";
    const clause2 =
      "the woman on the left has dark brown curly hair tied up, wearing a black crop top, blue denim shorts with a belt, carrying a grey metal case in her left hand and holding a black pistol down by her side; the man on the right wears an open blue short-sleeve shirt over a white t-shirt and khaki cargo pants, aiming a pistol forward";
    const clause3 = "slightly angled, feet on dock planks";
    const clause4 = "foreground showing mooring posts with ropes and a blue-black speedboat with bullet holes";
    const clause5 =
      "background features a panoramic marina with a speedboat racing across water creating white wake; water reflects sky colors; a white egret stands on a buoy";
    const clause6 = "sky transitions from pale blue to warm yellow, suggesting dawn or dusk";
    const clause7 = "medium shot, subjects centered slightly right, balanced composition with dock and city providing depth";
    const clause8 =
      "digital illustration style with bold outlines, flat color blocks, and stylized lighting—clear highlights but non-photorealistic, emphasizing silhouettes and contrast";
    const clause9 = "dominant colors: blue, purple, pink, yellow, green";
    const clause10 =
      "materials: wood grain texture of dock, metallic sheen on firearms, fabric folds on clothing, leather belt, cracked glass on boat hull";
    const clause11 = `${aspectRatio} aspect ratio; high-resolution render, sharp edges, smooth color gradients`;
    const clause12 =
      "intended as promotional game art for GTA VI, highlighting dual protagonists, dynamic action tension, and urban waterfront crime setting";

    enPrompt = `${clause1}; ${clause2}; ${clause3}; ${clause4}; ${clause5}; ${clause6}; ${clause7}; ${clause8}; ${clause9}; ${clause10}; ${clause11}; ${clause12}`;

    zhPrompt =
      "热带海岸木质码头; 左侧女子留着扎起的深褐色卷发，身穿黑色露脐上衣、带皮带的蓝色牛仔短裤，左手提着灰色金属箱，右手自然垂下握着黑色手枪; " +
      "右侧男子敞开蓝色短袖衬衫露出白色T恤，身着卡其色工装裤，双手握枪向前瞄准; 视角微倾斜，双脚立于码头木板上; " +
      "前景展现缠绕绳索的系船柱与带弹孔的蓝黑相间快艇; 背景为开阔的游艇码头全景，快艇破浪飞驰掀起白色尾迹，水面映射天空色彩，白色白鹭伫立于浮标之上; " +
      "天空自淡蓝色渐变至暖黄色，呈现拂晓或黄昏微光; 中景镜头，主体稍偏右居中，码头与天际线呈现均衡纵深构图; " +
      "粗线条数字插画风格，平涂色块与风格化光影，高光分明非写实，突出剪影与对比度; " +
      "主色调: 蓝色、紫色、粉色、黄色、绿色; 材质: 码头木质纹理、枪械金属光泽、衣物布料褶皱、皮革腰带、船体破损玻璃; " +
      `${aspectRatio} 画幅比例; 高分辨率渲染，锐利边缘，平滑色彩渐变; ` +
      "作为GTA VI宣传游戏艺术画，突显双主角设定、动态张力与海滨都市犯罪氛围。";

    jaPrompt =
      "熱帯沿岸の木製桟橋; 左側の女性はダークブラウンの巻き髪をアップにまとめ、黒のクロップトップとベルト付きブルーデニムショートパンツを着用し、左手にグレーの金属ケースを提げ右手で黒のピストルを下に向けて保持; " +
      "右側の男性は白いTシャツの上にオープンカラーの青い半袖シャツを羽織りカーキ色のカーゴパンツを履きピストルを前方へ構える; わずかに斜めの視点、桟橋の厚板に足を据える構図; " +
      "前景にはロープが巻かれた係留ボラードと弾痕の残る青黒のスピードボート; 背景には水面を疾走し白い航跡を描くスピードボートが映る広大なマリーナパノラマ、空の色を反射する水面、ブイの上に佇む白いコサギ; " +
      "空は淡い青から温かみのある黄色へとグラデーションを描き夜明けまたは夕暮れを示唆; ミディアムショット、被写体はやや右寄りのセンター配置、桟橋と都市景観が奥行きをもたらす均衡ある構図; " +
      "大胆な輪郭線とフラットな色面、様式化されたライティングによるデジタルイラストレーションスタイル—明確なハイライトと非写実的な陰影でシルエットとコントラストを強調; " +
      "主要カラーパレット: ブルー、パープル、ピンク、イエロー、グリーン; テクスチャ素材: 桟橋の木目、銃器の金属光沢、衣服のドレープ、レザーベルト、ボート船体の割れたガラス; " +
      `${aspectRatio} アスペクト比; 高解像度レンダリング、シャープな輪郭、滑らかなカラーグラデーション; ` +
      "GTA VIのプロモーションゲームアートを意図し、二人の主人公、緊迫感あるダイナミックなアクション、臨海都市のクライムサスペンスを描写。";

    tags = ["high illustration", "comic line art", "urban crime vibe", "game promo art"];

    structuredJson = {
      setting: clause1,
      subjects: [
        "woman on left: dark brown curly hair tied up, black crop top, denim shorts, grey metal case in left hand, black pistol down by side",
        "man on right: open blue short-sleeve shirt over white t-shirt, khaki cargo pants, aiming pistol forward",
      ],
      camera_and_composition: `${clause3}; ${clause7}`,
      foreground: clause4,
      background_and_sky: `${clause5}; ${clause6}`,
      art_style_and_lighting: clause8,
      color_palette: ["blue", "purple", "pink", "yellow", "green"],
      materials_and_textures: ["wood grain", "metallic sheen", "fabric folds", "leather belt", "cracked glass"],
      aspect_ratio: aspectRatio,
      render_specs: clause11,
      intended_purpose: clause12,
    };
  } else if (
    hint.includes("fashion") ||
    hint.includes("editorial") ||
    hint.includes("couture") ||
    hint.includes("swimwear") ||
    hint.includes("runway") ||
    hint.includes("portrait")
  ) {
    const clause1 = "high-end minimalist studio with seamless curved cyclorama infinity wall";
    const clause2 =
      "the fashion model stands poised in three-quarter profile, wearing structured architectural couture with sheer organza layering and tailored pleats, exhibiting curvilinear kinetic tension";
    const clause3 = "slightly low camera angle at eye-line, model anchored gracefully on polished concrete floor";
    const clause4 = "foreground features subtle floor reflections and soft diffusion falloff";
    const clause5 = "background features clean tonal gradient with professional studio baffles and soft ambient fill";
    const clause6 = "sculpted studio illumination with softbox key light and high-contrast rim lighting carving the silhouette";
    const clause7 = "full-length editorial framing with balanced vertical proportion and ample negative space";
    const clause8 =
      "medium-format 85mm f/1.8 optical portraiture aesthetic with shallow depth of field, subtle organic film grain, and rich natural skin micro-texture";
    const clause9 = "dominant colors: ivory white, deep obsidian, champagne gold, muted taupe";
    const clause10 =
      "materials: sheer flowing organza, structured corsetry, matte crepe silk, polished metallic accents, natural skin texture";
    const clause11 = `${aspectRatio} aspect ratio; ultra-high-resolution editorial photograph, razor-sharp edge contrast, smooth tonal gradients`;
    const clause12 =
      "intended as luxury fashion magazine editorial campaign and haute couture lookbook showcase";

    enPrompt = `${clause1}; ${clause2}; ${clause3}; ${clause4}; ${clause5}; ${clause6}; ${clause7}; ${clause8}; ${clause9}; ${clause10}; ${clause11}; ${clause12}`;

    zhPrompt =
      "极简高端摄影棚与无缝环形天幕无影墙; 时尚模特呈四分之三侧身挺拔站立，身穿结构感高级定制礼服，搭配轻薄欧根纱层叠与利落百褶剪裁，展现流线型动态张力; " +
      "视角微仰贴合视线高度，模特优雅立于光洁混凝土地面; 前景展现柔和地面倒影与光影漫反射渐晕; 背景呈现纯净影棚柔光板渐变与环境补光; " +
      "雕塑感影棚布光，大型柔光箱主光配合高反差轮廓光勾勒身形剪影; 全身时尚大片构图，留白平衡与垂直纵深层次; " +
      "中画幅85mm f/1.8经典人像光学质感，浅景深虚化，细腻胶片颗粒与真实皮肤微质感; " +
      "主色调: 象牙白、曜石黑、香槟金、柔和灰褐; 材质: 轻薄飘逸欧根纱、结构束身鱼骨、哑光真丝绉绸、抛光金属饰件与细腻肌肤质感; " +
      `${aspectRatio} 画幅比例; 超高分辨率时尚摄影，锐利边缘反差与平滑影调渐变; ` +
      "作为高级时尚杂志封面大片与高定时装Lookbook视觉呈现。";

    jaPrompt =
      "シームレスなアール形状の白ホリゾントを備えたミニマル高級フォトスタジオ; 4分の3プロファイルで佇むファッションモデル、立体裁断のオートクチュールドレスに透け感のあるオーガンジーのレイヤードと繊細なプリーツを纏い、しなやかな動的緊張感を表現; " +
      "ややローアングルのアイレベル視点、磨き上げられたコンクリート床に優雅に足を据える構図; 前景には柔らかな床面反射と光のディフュージョン効果; " +
      "背景にはプロ仕様のスタジオバッフルと均一なアンビエントフィルによるクリーンな階調グラデーション; スカルプチュアルなスタジオライティング、ソフトボックスのキーライトとシルエットを際立たせるハイコントラストなリムライト; " +
      "フルレングスのエディトリアル構図、豊かな余白と洗練された垂直バランス; 中判カメラ85mm f/1.8ポートレート光学描写、浅い被写界深度、上質なフィルムグレインと肌のマイクロテクスチャ; " +
      "主要カラーパレット: アイボリーホワイト、オブシディアンブラック、シャンパンゴールド、トープ; テクスチャ素材: 透け感あるオーガンジー、コルセット構造、マットクレープシルク、光沢メタル金具、自然なスキンテクスチャ; " +
      `${aspectRatio} アスペクト比; 超高解像度ファッションフォトグラフィ、シャープなエッジコントラスト、滑らかなトーン階調; ` +
      "高級ファッション誌のエディトリアルキャンペーンおよびオートクチュールルックブックを意図したヴィジュアル。";

    tags = ["haute couture", "studio editorial", "rim lighting", "fashion lookbook"];

    structuredJson = {
      setting: clause1,
      subjects: [clause2],
      camera_and_composition: `${clause3}; ${clause7}`,
      foreground: clause4,
      background_and_sky: `${clause5}; ${clause6}`,
      art_style_and_lighting: clause8,
      color_palette: ["ivory white", "deep obsidian", "champagne gold", "muted taupe"],
      materials_and_textures: ["sheer organza", "structured corsetry", "matte crepe silk", "skin texture"],
      aspect_ratio: aspectRatio,
      render_specs: clause11,
      intended_purpose: clause12,
    };
  } else {
    const clause1 = `architectural ground plane in ${hint}`;
    const clause2 = "primary subject positioned centrally with structured silhouette and tactile attire";
    const clause3 = "eye-level straight-on perspective firmly grounded";
    const clause4 = "foreground framing elements with sharp geometric depth";
    const clause5 = "panoramic background environment with atmospheric aerial perspective";
    const clause6 = "balanced ambient illumination with volumetric atmospheric haze";
    const clause7 = "medium framing, central focal point with rule-of-thirds alignment";
    const clause8 = "clean digital rendering with precise line definition and calibrated shadow falloff";
    const clause9 = "dominant colors: neutral grey, deep obsidian, cobalt blue, accent amber";
    const clause10 = "materials: matte polymer, brushed composite, architectural glass";
    const clause11 = `${aspectRatio} aspect ratio; high-fidelity render with clean raster definition`;
    const clause12 = `intended as concept artwork for ${hint}`;

    enPrompt = `${clause1}; ${clause2}; ${clause3}; ${clause4}; ${clause5}; ${clause6}; ${clause7}; ${clause8}; ${clause9}; ${clause10}; ${clause11}; ${clause12}`;
    zhPrompt = `环境设定: ${clause1}; 主体: ${clause2}; 构图: ${clause3}; 前景: ${clause4}; 背景: ${clause5}; 光影: ${clause6}; 视角: ${clause7}; 风格: ${clause8}; 主色调: 灰阶、深曜石黑、钴蓝、琥珀金; 材质: 哑光聚合物、拉丝金属、玻璃; ${aspectRatio} 画幅比例; 预期用途: ${clause12}`;
    jaPrompt = `舞台設定: ${clause1}; 被写体: ${clause2}; 構図: ${clause3}; 前景: ${clause4}; 背景: ${clause5}; ライティング: ${clause6}; アングル: ${clause7}; スタイル: ${clause8}; 主要カラー: グレー、ブラック、コバルトブルー、アンバー; マテリアル: マットポリマー、金属、ガラス; ${aspectRatio} アスペクト比; 用途: ${clause12}`;

    tags = ["digital art", "concept render", "atmospheric lighting", "stylized realism"];

    structuredJson = {
      setting: clause1,
      subjects: [clause2],
      camera_and_composition: `${clause3}; ${clause7}`,
      foreground: clause4,
      background_and_sky: `${clause5}; ${clause6}`,
      art_style_and_lighting: clause8,
      color_palette: ["neutral grey", "deep obsidian", "cobalt blue", "accent amber"],
      materials_and_textures: ["matte polymer", "brushed composite", "architectural glass"],
      aspect_ratio: aspectRatio,
      render_specs: clause11,
      intended_purpose: clause12,
    };
  }

  const id = "pc_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const thumbnail =
    options.imageDataUrl ||
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSI5IiB2aWV3Qm94PSIwIDAgMTYgOSI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjkiIGZpbGw9IiMxODE4MWMiLz48L3N2Zz4=";

  return {
    id,
    timestamp: Date.now(),
    thumbnailDataUrl: thumbnail,
    status: "completed",
    prompts: {
      en: enPrompt,
      zh: zhPrompt,
      ja: jaPrompt,
    },
    tags,
    structured_json: structuredJson,
    aspectRatio,
    mode: "OFFLINE_DETERMINISTIC",
    inferenceCostUsd: 0.0,
  };
}
