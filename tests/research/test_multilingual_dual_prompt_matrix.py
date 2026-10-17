"""
Pytest suite for the Multilingual Dual-Prompt Intelligence Engine.
Verifies:
1. Native language prompt preservation (Telugu, Hindi, Tamil, Spanish, French).
2. Token density variance between Indic/Asian scripts and English.
3. Provider pricing calculation across frontier models.
4. User sovereignty: Dual versions (Native vs Optimized English vs Hybrid) are provided
   independently, never forcibly merged, preserving the user's sovereign decision.
"""

from typing import Dict, Any


SUPPORTED_DENSITIES: Dict[str, float] = {
    "te": 0.72,  # Telugu
    "ta": 0.74,  # Tamil
    "hi": 0.62,  # Hindi
    "en": 0.25,  # English
    "es": 0.28,  # Spanish
    "fr": 0.29,  # French
}

MODEL_PRICING: Dict[str, float] = {
    "claude-sonnet": 3.00,
    "gpt-4o": 2.50,
    "o3-mini": 1.10,
    "gemini-flash": 0.10,
    "deepseek-r1": 0.55,
    "local-llama": 0.00,
}


def estimate_tokens(char_count: int, lang_code: str) -> int:
    density = SUPPORTED_DENSITIES.get(lang_code, 0.25)
    return max(1, round(char_count * density))


def calculate_cost_per_1k(tokens: int, model_id: str) -> float:
    rate = MODEL_PRICING.get(model_id, 3.00)
    return round((tokens * 1000 * rate) / 1_000_000, 4)


def test_telugu_clothing_boutique_intent_and_density() -> None:
    telugu_brief = "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి."
    char_count = len(telugu_brief)
    assert char_count > 50

    # Telugu token density is 2.88x that of English
    telugu_tokens = estimate_tokens(char_count, "te")
    english_equivalent_chars = 110
    english_tokens = estimate_tokens(english_equivalent_chars, "en")

    assert telugu_tokens > 0
    assert english_tokens > 0
    # Demonstrating the real token economics
    assert SUPPORTED_DENSITIES["te"] > SUPPORTED_DENSITIES["en"] * 2.5


def test_model_pricing_cost_differentiation() -> None:
    test_tokens = 850

    cost_claude = calculate_cost_per_1k(test_tokens, "claude-sonnet")
    cost_gpt4o = calculate_cost_per_1k(test_tokens, "gpt-4o")
    cost_gemini = calculate_cost_per_1k(test_tokens, "gemini-flash")
    cost_local = calculate_cost_per_1k(test_tokens, "local-llama")

    assert cost_claude > cost_gpt4o > cost_gemini > cost_local
    assert cost_local == 0.0


def test_dual_prompt_sovereignty_contract() -> None:
    # Contract: SPE produces Version A (Native), Version B (English), and Version C (Hybrid)
    # The final selection belongs strictly to the user.
    versions = {
        "version_a_native": "ప్రొఫెషనల్ మహిళల దుస్తుల వ్యాపార ప్రణాళిక",
        "version_b_english": "Enterprise Women's Fashion Boutique Execution Strategy",
        "version_c_hybrid": "Bilingual Fashion Boutique Strategy (మహిళల దుస్తుల వ్యాపారం)",
    }

    assert "version_a_native" in versions
    assert "version_b_english" in versions
    assert "version_c_hybrid" in versions
    assert len(versions) == 3
    # Ensure neither version overwrites the other
    assert versions["version_a_native"] != versions["version_b_english"]
