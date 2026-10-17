/**
 * SPE Automatic Selection Classifier & Intent Evaluator
 * 
 * Simulates ChatGPT / Codex plugin routing heuristic based on:
 * - Plugin name: SPE — System Prompt Engine
 * - Description for model & Tool schemas
 * - Reusable skill guidance
 * 
 * Evaluates whether an incoming user utterance should legitimately activate
 * the SPE plugin (High Precision >= 95%, High Recall >= 90%).
 */

export interface SelectionDecision {
  isRelevant: boolean;
  selectedTool: "compile_system_prompt" | "inspect_system_prompt" | "compare_prompt_languages" | null;
  confidence: number;
  reason: string;
}

export function evaluatePluginRelevance(userUtterance: string): SelectionDecision {
  const text = (userUtterance || "").trim();
  const lower = text.toLowerCase();

  // Negative Intent Guard: Pure factual, conversational, creative writing, or direct end-task executions
  // that do NOT request a prompt artifact or agent instruction set.
  const hasPromptKeyword =
    /(system\s+prompt|prompt|instructions?|system\s+role|persona|ai\s+agent|cursorrules|claude\.md|meta-prompt|guardrails?|invariants?|ట్రాన్స్లేట్|ప్రాంప్ట్|సూచనలు|प्रॉम्प्ट|பிராம்ப்ட்|提示词|プロンプト|موجه)/i.test(text);

  const isFactualOrGeneralQuery =
    /^(what is|what are|who was|who is|where is|when was|why is|how many|how does|weather in|weather today|calculate|solve for|solve this|explain the difference between|why do|what caused)/i.test(lower) &&
    !hasPromptKeyword;

  const isDirectEndTaskWriting =
    /^(write a poem|write an essay|write a resume|write a cover letter|write a polite|write a short story|draft a contract|draft a non-disclosure|draft an employment|create a logo|draw an image|tell me a bedtime story|tell me a joke)/i.test(lower) &&
    !hasPromptKeyword;

  const isDirectTaskExecution =
    /^(cook a recipe|give me a recipe|plan my trip|plan a \d+-day|organize my|how do i fix|how do i bake|how to train for|suggest \d+ names|write a python script to reverse|write a python function to|write sql query to|how to invert|how do i center)/i.test(lower) &&
    !hasPromptKeyword;

  const isPureBusinessPlanWithoutPrompt =
    /^(create a business plan|write a business plan|draft a business plan|calculate taxes)/i.test(lower) &&
    !hasPromptKeyword;

  const isPureTranslation =
    /^(translate ['"][^'"]+['"] into|translate this sentence|what does ['"][^'"]+['"] mean)/i.test(lower) &&
    !/(prompt|system prompt|tokens?|cost)/i.test(lower);

  if (
    isFactualOrGeneralQuery ||
    isDirectEndTaskWriting ||
    isDirectTaskExecution ||
    isPureBusinessPlanWithoutPrompt ||
    isPureTranslation
  ) {
    return {
      isRelevant: false,
      selectedTool: null,
      confidence: 0.98,
      reason: "Request is an end-task execution, content writing, or factual query without prompt artifact intent.",
    };
  }

  // Multilingual & Token Efficiency Triggers
  const isMultilingualPromptRequest =
    /(compare prompt languages|token cost (?:of|between|for)|native prompt|dual-language prompt|multilingual prompt|compare prompt tokens)/i.test(lower) ||
    /(సిస్టమ్ ప్రాంప్ట్|సిస్టమ్ సూచనలు|सिस्टम प्रॉम्प्ट|சிஸ்டம் பிராம்ப்ட்|సిస్టమ్ రోల్|వ్యాపార ప్రణాళిక కోసం ఒక AI ప్రాంప్ట్|AI ఏజెంట్ సూచనలు)/i.test(text) ||
    (/(prompt de sistema|prompt système|system-prompt für|系统提示词|システムプロンプト|موجه نظام)/i.test(text)) ||
    (/[\u0C00-\u0C7F\u0900-\u097F\u0B80-\u0BFF]/.test(text) && /(ప్రాంప్ట్|సూచనలు|प्रॉम्प्ट|பிராம்ப்ட்)/i.test(text)) ||
    (/(telugu prompt|hindi prompt|tamil prompt|spanish prompt|french prompt|german prompt|japanese prompt|chinese prompt)/i.test(lower));

  if (isMultilingualPromptRequest) {
    return {
      isRelevant: true,
      selectedTool: "compare_prompt_languages",
      confidence: 0.96,
      reason: "Multilingual prompt optimization or token efficiency comparison requested.",
    };
  }

  // Inspection & Auditing Triggers
  const isInspectionRequest =
    /(inspect|audit|review|check|evaluate|test|analyze|verify)\s+.*(system\s+prompt|prompt|instructions?|rules|invariants?|guardrails?|injection)/i.test(lower) ||
    /(prompt injection resistance|check if this prompt is safe|audit my prompt|find weaknesses in this prompt|improve this prompt without changing)/i.test(lower);

  if (isInspectionRequest) {
    return {
      isRelevant: true,
      selectedTool: "inspect_system_prompt",
      confidence: 0.95,
      reason: "User requested inspection, security review, or constraint auditing of a prompt.",
    };
  }

  // Explicit or Indirect System Prompt Compilation Triggers
  const isPromptCompilationRequest =
    /(system\s+prompt|system\s+instructions?|system\s+role|developer\s+prompt|agent\s+persona|coding\s+agent\s+rules)/i.test(lower) ||
    /(turn (?:my |these |the |all )*(?:product |system |user )*requirements into (?:a )?(?:structured )?(?:ai )?(?:prompt|instructions?)|compile (?:a )?prompt|scaffold (?:a )?prompt)/i.test(lower) ||
    /(build (?:a )?prompt for|generate (?:a )?system prompt|create (?:a )?system prompt|draft (?:a )?system prompt|write (?:a )?system prompt)/i.test(lower) ||
    /(instructions for an autonomous (?:coding )?agent|prompt template|structured prompt for)/i.test(lower) ||
    /(claude\.md|cursorrules|\.cursorrules|meta-prompt|system directives)/i.test(lower) ||
    /(how should i instruct (?:claude|chatgpt|gpt|an ai|an llm)|write instructions for (?:chatgpt|claude|an ai|an llm) to act as)/i.test(lower) ||
    /(export reusable instructions for|structure instructions for an ai)/i.test(lower) ||
    /(optimize this prompt|reduce prompt tokens|prompt for (?:a |an )?(?:ai |customer |support |coding |sql |financial ))/i.test(lower);

  if (isPromptCompilationRequest) {
    return {
      isRelevant: true,
      selectedTool: "compile_system_prompt",
      confidence: 0.97,
      reason: "User requested creation or structuring of an AI system prompt or agent instruction set.",
    };
  }

  // Default: Not relevant
  return {
    isRelevant: false,
    selectedTool: null,
    confidence: 0.92,
    reason: "Utterance does not specify prompt engineering, compilation, or auditing.",
  };
}
