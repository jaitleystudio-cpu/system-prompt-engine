/**
 * SPE Multilingual Dual-Prompt Intelligence Engine
 * Comprehensive Verification Suite
 * 
 * Tests:
 * 1. Script & Language Detection across 16+ diverse global languages
 * 2. Calibrated BPE/SentencePiece Token Density Measurements
 * 3. Model Pricing Catalog & Cost Calculation per 1,000 runs
 * 4. Dual-Prompt Synthesis (Native Prompt vs English Prompt vs Hybrid)
 * 5. Semantic Intent Preservation Verification
 * 6. UI Integration & Studio Component Architecture
 */

import {
  detectLanguage,
  synthesizeDualPrompts,
  SUPPORTED_LANGUAGES,
  MODEL_PRICING_CATALOG,
} from "../src/engine/multilingualDualPrompt.ts";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const webSrc = join(root, "apps", "web", "src");

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log("==================================================================");
console.log("🌍 TESTING: SPE Multilingual Dual-Prompt Intelligence Engine");
console.log("==================================================================");

// ==============================================================================
// 1. Script & Language Detection Tests
// ==============================================================================
console.log("\n[1/5] Testing Script & Language Detection across 16+ languages...");

const testCases = [
  { text: "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.", expectedCode: "te", name: "Telugu" },
  { text: "मुझे एक नया टेक स्टार्टअप शुरू करना है। मुझे वित्तीय मॉडल चाहिए।", expectedCode: "hi", name: "Hindi" },
  { text: "எனக்கு ஒரு புதிய தொழில் தொடங்க வேண்டும். விரிவான திட்டம் தேவை.", expectedCode: "ta", name: "Tamil" },
  { text: "আমি একটি নতুন সফটওয়্যার ব্যবসা শুরু করতে চাই।", expectedCode: "bn", name: "Bengali" },
  { text: "મને એક નવો વ્યવસાય શરૂ કરવો છે. મને વ્યાપાર યોજના જોઈએ છે.", expectedCode: "gu", name: "Gujarati" },
  { text: "ನನಗೆ ಹೊಸ ಮಹಿಳೆಯರ ಉಡುಪುಗಳ ವ್ಯಾಪಾರವನ್ನು ಪ್ರಾರಂಭಿಸಬೇಕು.", expectedCode: "kn", name: "Kannada" },
  { text: "എനിക്ക് ഒരു പുതിയ ബിസിനസ്സ് ആരംഭിക്കണം. ഒരു ബിസിനസ്സ് പ്ലാൻ വേണം.", expectedCode: "ml", name: "Malayalam" },
  { text: "Quiero crear una tienda online de moda femenina sostenible.", expectedCode: "es", name: "Spanish" },
  { text: "Je veux lancer une boutique en ligne éco-responsable pour femmes.", expectedCode: "fr", name: "French" },
  { text: "Ich möchte ein nachhaltiges Online-Modegeschäft für Frauen gründen.", expectedCode: "de", name: "German" },
  { text: "女性向けの持続可能なオンラインブティックを開設したいです。", expectedCode: "ja", name: "Japanese" },
  { text: "我想创办一家专为女性打造的可持续在线时尚精品店。", expectedCode: "zh", name: "Chinese" },
  { text: "أريد إنشاء متجر إلكتروني للأزياء النسائية المستدامة مع خطة عمل متكاملة.", expectedCode: "ar", name: "Arabic" },
  { text: "Я хочу запустить онлайн-магазин женской одежды с бизнес-планом.", expectedCode: "ru", name: "Russian" },
  { text: "여성용 지속 가능한 패션 온라인 부티크를 시작하고 싶습니다.", expectedCode: "ko", name: "Korean" },
  { text: "I want to start a premium women's clothing boutique business.", expectedCode: "en", name: "English" },
  // Romanized Indic Test Cases
  { text: "naku oka software consultancy start cheyali ani undi", expectedCode: "te", name: "Telugu (Tinglish)" },
  { text: "mujhe ek naya fintech startup shuru karna hai aur funding chahiye", expectedCode: "hi", name: "Hindi (Hinglish)" },
  { text: "enakku oru pudhiya restaurant business pannanum", expectedCode: "ta", name: "Tamil (Tanglish)" },
];

for (const tc of testCases) {
  const detected = detectLanguage(tc.text);
  assert(detected.code === tc.expectedCode, `Correctly detected ${tc.name} (${detected.name} [${detected.flag}])`);
}

// Fallback test
const emptyDetected = detectLanguage("");
assert(emptyDetected.code === "en", "Empty text defaults gracefully to English");

// Verify authentic native synthesis for Hindi, Tamil, Spanish, German, Japanese
console.log("\n  Testing authentic native synthesis across major languages...");
const hindiBundle = synthesizeDualPrompts("मुझे एक नया टेक स्टार्टअप शुरू करना है।");
assert(hindiBundle.detectedLanguage.code === "hi", "Hindi prompt detected as 'hi'");
assert(hindiBundle.nativePrompt.includes("सिस्टम भूमिका और उद्देश्य"), "Hindi prompt synthesized with authentic Devanagari sections");

const tamilBundle = synthesizeDualPrompts("எனக்கு ஒரு புதிய தொழில் தொடங்க வேண்டும்.");
assert(tamilBundle.detectedLanguage.code === "ta", "Tamil prompt detected as 'ta'");
assert(tamilBundle.nativePrompt.includes("கணினி பங்கு மற்றும் நோக்கம்"), "Tamil prompt synthesized with authentic Tamil sections");

const spanishBundle = synthesizeDualPrompts("Quiero crear una tienda online de ropa sostenible.");
assert(spanishBundle.detectedLanguage.code === "es", "Spanish prompt detected as 'es'");
assert(spanishBundle.nativePrompt.includes("Rol del Sistema y Objetivo"), "Spanish prompt synthesized with authentic Spanish sections");

// ==============================================================================
// 2. Calibrated Token Density & Model Catalog Tests
// ==============================================================================
console.log("\n[2/5] Testing Tokenizer Densities & Model Pricing Tiers...");

// Check density ratios reflecting multi-byte UTF-8 expansion in BPE
assert(SUPPORTED_LANGUAGES.te.tokensPerChar === 0.72, "Telugu density calibrated at 0.72 tokens/char (UTF-8 BPE overhead)");
assert(SUPPORTED_LANGUAGES.ta.tokensPerChar === 0.74, "Tamil density calibrated at 0.74 tokens/char");
assert(SUPPORTED_LANGUAGES.hi.tokensPerChar === 0.62, "Hindi density calibrated at 0.62 tokens/char");
assert(SUPPORTED_LANGUAGES.en.tokensPerChar === 0.25, "English density calibrated at 0.25 tokens/char (~4 chars/token)");

// Model pricing catalog
const requiredModels = ["claude-sonnet", "gpt-4o", "o3-mini", "gemini-flash", "deepseek-r1", "local-llama"];
for (const mId of requiredModels) {
  assert(Boolean(MODEL_PRICING_CATALOG[mId]), `Model pricing tier registered: ${mId}`);
}
assert(MODEL_PRICING_CATALOG["local-llama"].inputCostPer1M === 0.0, "Local on-device inference has $0.00 provider API cost");

// ==============================================================================
// 3. Dual-Prompt Synthesis & Savings Matrix
// ==============================================================================
console.log("\n[3/5] Testing Dual-Prompt Synthesis (Telugu Clothing Store Example)...");

const teluguInput = "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.";
const bundle = synthesizeDualPrompts(teluguInput, "Business", "claude-sonnet");

assert(bundle.detectedLanguage.code === "te", "Telugu language correctly tagged in bundle");
assert(bundle.nativePrompt.length > 500, `Native Telugu prompt generated (${bundle.nativePrompt.length} chars)`);
assert(bundle.englishPrompt.length > 500, `Optimized English prompt generated (${bundle.englishPrompt.length} chars)`);
assert(bundle.hybridPrompt.length > 500, `Bilingual hybrid prompt generated (${bundle.hybridPrompt.length} chars)`);

// Check Telugu content in native prompt
assert(bundle.nativePrompt.includes("వ్యాపార నమూనా") || bundle.nativePrompt.includes("మహిళల దుస్తుల"), "Native prompt contains rich Telugu domain semantics");
// Check English prompt structure
assert(bundle.englishPrompt.includes("# System Role & Objective"), "English prompt contains structured enterprise role");
assert(bundle.englishPrompt.includes("women's clothing retail boutique"), "English prompt correctly captures business intent");

// Intent preservation & empirical fidelity calculation
assert(bundle.nativeMetrics.intentPreserved === true, "Native version preserves user intention");
assert(bundle.englishMetrics.intentPreserved === true, "Optimized English version verified semantic equivalence");
assert(bundle.hybridMetrics.intentPreserved === true, "Hybrid version verified semantic equivalence");
assert(bundle.nativeMetrics.intentFidelityScore >= 0.8, `Empirical intent fidelity score computed (${bundle.nativeMetrics.intentFidelityScore * 100}%)`);
assert(Array.isArray(bundle.nativeMetrics.preservedEntities), "Preserved entities returned as array");

// Estimation flag honesty
assert(bundle.nativeMetrics.isTokenCountExact === false, "Honest disclosure: Token count labeled as Estimated");
assert(bundle.englishMetrics.isTokenCountExact === false, "Honest disclosure: Token count labeled as Estimated");

// Measured token efficiency
console.log(`  📊 Native Prompt:  ${bundle.nativeMetrics.charCount} chars | ~${bundle.nativeMetrics.estimatedTokens} est. tokens | $${bundle.nativeMetrics.costPer1kRuns}/1k runs`);
console.log(`  📊 English Prompt: ${bundle.englishMetrics.charCount} chars | ~${bundle.englishMetrics.estimatedTokens} est. tokens | $${bundle.englishMetrics.costPer1kRuns}/1k runs`);
console.log(`  💰 Token Savings:  ${bundle.tokenSavingsPercent}% | Cost Savings: ${bundle.costSavingsPercent}%`);

assert(bundle.englishMetrics.estimatedTokens < bundle.nativeMetrics.estimatedTokens, "English prompt is significantly more token-efficient than Native script");
assert(bundle.tokenSavingsPercent > 30, `Token savings exceed 30% (${bundle.tokenSavingsPercent}%)`);
assert(bundle.recommendedVersion === "english", "Objective recommendation prioritizes cost/efficiency while leaving choice to user");
assert(bundle.recommendationReason.includes("saves ~") || bundle.recommendationReason.includes("English"), "Clear, transparent recommendation reason provided");

// Test arbitrary non-boutique Telugu request (Hotel business)
const hotelInput = "నాకు హోటల్ వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.";
const hotelBundle = synthesizeDualPrompts(hotelInput, "Business", "claude-sonnet");
assert(hotelBundle.nativePrompt.includes("హోటల్"), "Hotel prompt dynamically includes hotel objective");
assert(!hotelBundle.nativePrompt.includes("సూరత్"), "Hotel prompt does not leak boutique saree/lehenga text");
assert(hotelBundle.englishPrompt.includes(hotelInput), "English prompt preserves exact user objective reference");

// ==============================================================================
// 4. Model Cost Switcher Calculations
// ==============================================================================
console.log("\n[4/5] Testing Cost Variations across Frontier Models...");

const bundleGpt = synthesizeDualPrompts(teluguInput, "Business", "gpt-4o");
const bundleGemini = synthesizeDualPrompts(teluguInput, "Business", "gemini-flash");
const bundleLocal = synthesizeDualPrompts(teluguInput, "Business", "local-llama");

assert(bundleGpt.nativeMetrics.costPer1kRuns > 0, "GPT-4o calculates non-zero cost per 1k runs");
assert(bundleGemini.nativeMetrics.costPer1kRuns < bundleGpt.nativeMetrics.costPer1kRuns, "Gemini Flash is cheaper than GPT-4o");
assert(bundleLocal.nativeMetrics.costPer1kRuns === 0, "Local Llama model calculates exactly $0.00 cost");

// ==============================================================================
// 5. UI Integration & Component Wiring Verification
// ==============================================================================
console.log("\n[5/5] Verifying Web UI Wiring in Apps/Web...");

const studioFile = join(webSrc, "engine", "DualLanguagePromptStudio.tsx");
const engineFile = join(webSrc, "engine", "multilingualDualPrompt.ts");
const radarFile = join(webSrc, "engine", "PromptRadarInspector.tsx");
const composerFile = join(webSrc, "composer", "UnifiedComposer.tsx");

assert(existsSync(studioFile), "DualLanguagePromptStudio.tsx component exists");
assert(existsSync(engineFile), "multilingualDualPrompt.ts logic module exists");

const radarContent = readFileSync(radarFile, "utf8");
assert(radarContent.includes("DualLanguagePromptStudio"), "PromptRadarInspector imports DualLanguagePromptStudio");
assert(radarContent.includes('"multilingual"'), "PromptRadarInspector includes 'multilingual' in tab union and tab list");

const composerContent = readFileSync(composerFile, "utf8");
assert(composerContent.includes("DualLanguagePromptStudio"), "UnifiedComposer imports DualLanguagePromptStudio");
assert(composerContent.includes("showDualStudio"), "UnifiedComposer includes showDualStudio toggle state");

console.log("\n==================================================================");
console.log("🎉 ALL MULTILINGUAL DUAL-PROMPT TESTS PASSED SUCCESSFULLY!");
console.log("==================================================================");
