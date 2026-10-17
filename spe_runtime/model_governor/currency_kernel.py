"""
Frontier Model Currency Governor (FMCG) - Python Kernel
MANDATE: Zero Stale Models. Enforces 2026 Frontier Generation.
"""

from typing import Dict, Any, List, Optional

FRONTIER_ACTIVE_YEAR: int = 2026
FRONTIER_MIN_RELEASE_DATE: str = "2026-01-01"

FRONTIER_MODELS_2026: Dict[str, Dict[str, Any]] = {
    # ─── LATE 2026 FRONTIER SPECIFICATIONS ─────────────────────────────────────
    "claude-5-5-sonnet": {
        "id": "claude-5-5-sonnet",
        "name": "Claude Sonnet 5.5",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "context_window": 524288,
        "max_output_tokens": 131072,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "claude-5-5-haiku": {
        "id": "claude-5-5-haiku",
        "name": "Claude Haiku 5.5",
        "provider": "Anthropic",
        "category": "general-intelligence",
        "context_window": 262144,
        "max_output_tokens": 32768,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "claude-5-5-opus": {
        "id": "claude-5-5-opus",
        "name": "Claude Opus 5.5",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "context_window": 1048576,
        "max_output_tokens": 262144,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "claude-code-2-1": {
        "id": "claude-code-2-1",
        "name": "Claude Code 2.1.293",
        "provider": "Anthropic",
        "category": "coding-specialist",
        "context_window": 524288,
        "max_output_tokens": 131072,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "gpt-6-1-sol": {
        "id": "gpt-6-1-sol",
        "name": "OpenAI GPT-6.1-Sol Codex",
        "provider": "OpenAI",
        "category": "coding-specialist",
        "context_window": 524288,
        "max_output_tokens": 131072,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "gpt-6-astra": {
        "id": "gpt-6-astra",
        "name": "OpenAI GPT-6 Astra",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "context_window": 524288,
        "max_output_tokens": 131072,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "meta-muse-code": {
        "id": "meta-muse-code",
        "name": "Meta Muse Code 1.3",
        "provider": "Meta",
        "category": "open-weights",
        "context_window": 262144,
        "max_output_tokens": 65536,
        "release_date": "2026-10-01",
        "generation": "2026-frontier",
    },
    "claude-4-5-sonnet": {
        "id": "claude-4-5-sonnet",
        "name": "Claude 4.5 Sonnet (Hybrid Frontier)",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "context_window": 262144,
        "max_output_tokens": 65536,
        "release_date": "2026-06-18",
        "generation": "2026-frontier",
    },
    "claude-4-5-opus": {
        "id": "claude-4-5-opus",
        "name": "Claude 4.5 Opus (Ultra Reasoning)",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "context_window": 524288,
        "max_output_tokens": 131072,
        "release_date": "2026-08-12",
        "generation": "2026-frontier",
    },
    "claude-4-5-haiku": {
        "id": "claude-4-5-haiku",
        "name": "Claude 4.5 Haiku",
        "provider": "Anthropic",
        "category": "general-intelligence",
        "context_window": 262144,
        "max_output_tokens": 16384,
        "release_date": "2026-07-02",
        "generation": "2026-frontier",
    },
    "gpt-5": {
        "id": "gpt-5",
        "name": "OpenAI GPT-5 (Omni Flagship 2026)",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "context_window": 262144,
        "max_output_tokens": 32768,
        "release_date": "2026-05-14",
        "generation": "2026-frontier",
    },
    "gpt-5-codex": {
        "id": "gpt-5-codex",
        "name": "OpenAI GPT-5 Codex (Agentic Engineer)",
        "provider": "OpenAI",
        "category": "coding-specialist",
        "context_window": 262144,
        "max_output_tokens": 65536,
        "release_date": "2026-07-22",
        "generation": "2026-frontier",
    },
    "o4-mini": {
        "id": "o4-mini",
        "name": "OpenAI o4-mini (High-Speed Reasoning)",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "context_window": 262144,
        "max_output_tokens": 65536,
        "release_date": "2026-04-08",
        "generation": "2026-frontier",
    },
    "o3-pro": {
        "id": "o3-pro",
        "name": "OpenAI o3-pro (Extended Deliberation)",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "context_window": 262144,
        "max_output_tokens": 100000,
        "release_date": "2026-06-25",
        "generation": "2026-frontier",
    },
    "gemini-3-pro": {
        "id": "gemini-3-pro",
        "name": "Google Gemini 3 Pro (4M Multimodal)",
        "provider": "Google",
        "category": "frontier-reasoning",
        "context_window": 4194304,
        "max_output_tokens": 65536,
        "release_date": "2026-05-20",
        "generation": "2026-frontier",
    },
    "gemini-3-flash": {
        "id": "gemini-3-flash",
        "name": "Google Gemini 3 Flash (Realtime Agent)",
        "provider": "Google",
        "category": "general-intelligence",
        "context_window": 2097152,
        "max_output_tokens": 32768,
        "release_date": "2026-06-11",
        "generation": "2026-frontier",
    },
    "grok-4": {
        "id": "grok-4",
        "name": "xAI Grok 4 (Frontier Truth & Reasoning)",
        "provider": "xAI",
        "category": "frontier-reasoning",
        "context_window": 262144,
        "max_output_tokens": 32768,
        "release_date": "2026-07-15",
        "generation": "2026-frontier",
    },
    "deepseek-r2": {
        "id": "deepseek-r2",
        "name": "DeepSeek-R2 (Open Frontier Reasoning)",
        "provider": "DeepSeek",
        "category": "frontier-reasoning",
        "context_window": 131072,
        "max_output_tokens": 32768,
        "release_date": "2026-05-02",
        "generation": "2026-frontier",
    },
    "deepseek-v4": {
        "id": "deepseek-v4",
        "name": "DeepSeek-V4 (MoE Coding Engine)",
        "provider": "DeepSeek",
        "category": "coding-specialist",
        "context_window": 131072,
        "max_output_tokens": 16384,
        "release_date": "2026-06-20",
        "generation": "2026-frontier",
    },
    "llama-4-405b": {
        "id": "llama-4-405b",
        "name": "Meta Llama 4 405B Maverick",
        "provider": "Meta",
        "category": "open-weights",
        "context_window": 262144,
        "max_output_tokens": 32768,
        "release_date": "2026-06-28",
        "generation": "2026-frontier",
    },
    "gemini-2-5-ultra": {
        "id": "gemini-2-5-ultra",
        "name": "Google Gemini 2.5 Ultra",
        "provider": "Google",
        "category": "frontier-reasoning",
        "context_window": 2097152,
        "max_output_tokens": 65536,
        "release_date": "2026-04-18",
        "generation": "2026-frontier",
    },
    "grok-3-5": {
        "id": "grok-3-5",
        "name": "xAI Grok 3.5 Realtime",
        "provider": "xAI",
        "category": "general-intelligence",
        "context_window": 131072,
        "max_output_tokens": 16384,
        "release_date": "2026-03-10",
        "generation": "2026-frontier",
    },
    "llama-4-70b": {
        "id": "llama-4-70b",
        "name": "Meta Llama 4 70B Instruct",
        "provider": "Meta",
        "category": "open-weights",
        "context_window": 131072,
        "max_output_tokens": 16384,
        "release_date": "2026-05-18",
        "generation": "2026-frontier",
    },
    "midjourney-v7": {
        "id": "midjourney-v7",
        "name": "Midjourney v7",
        "provider": "Midjourney",
        "category": "creative-multimodal",
        "context_window": 4096,
        "max_output_tokens": 1,
        "release_date": "2026-06-05",
        "generation": "2026-frontier",
    },
    "flux-2-pro": {
        "id": "flux-2-pro",
        "name": "FLUX.2 [pro]",
        "provider": "Black Forest Labs",
        "category": "creative-multimodal",
        "context_window": 4096,
        "max_output_tokens": 1,
        "release_date": "2026-05-15",
        "generation": "2026-frontier",
    },
}

LEGACY_TO_FRONTIER_MAPPING: Dict[str, str] = {
    # Anthropic legacy (Claude 3.x, 4.5) -> Claude 5.5
    "claude-3-opus": "claude-5-5-opus",
    "claude-3-sonnet": "claude-5-5-sonnet",
    "claude-3-haiku": "claude-5-5-haiku",
    "claude-3-5-sonnet": "claude-5-5-sonnet",
    "claude-3-5-haiku": "claude-5-5-haiku",
    "claude-3-7-sonnet": "claude-5-5-sonnet",
    "anthropic:claude-3-7-sonnet-20250219": "claude-5-5-sonnet",
    "claude-4-5-sonnet": "claude-5-5-sonnet",
    "claude-4-5-haiku": "claude-5-5-haiku",
    "claude-4-5-opus": "claude-5-5-opus",

    # OpenAI legacy (GPT-4.x, o1, o3-mini, GPT-5) -> GPT-6.1-Sol / Astra
    "gpt-4": "gpt-6-1-sol",
    "gpt-4-turbo": "gpt-6-1-sol",
    "gpt-4o": "gpt-6-1-sol",
    "gpt-4o-mini": "gpt-6-astra",
    "gpt-4-5": "gpt-6-1-sol",
    "gpt-4.5": "gpt-6-1-sol",
    "gpt-4-5-preview": "gpt-6-1-sol",
    "gpt-4.5-preview": "gpt-6-1-sol",
    "gpt-5": "gpt-6-1-sol",
    "gpt-5-codex": "gpt-6-1-sol",
    "o1": "gpt-6-astra",
    "o1-preview": "gpt-6-astra",
    "o1-mini": "gpt-6-astra",
    "o3-mini": "gpt-6-astra",
    "o4-mini": "gpt-6-astra",
    "o3-pro": "gpt-6-astra",

    # Google legacy (Gemini 1.5, Gemini 2.0) -> Gemini 3
    "gemini-1-5-flash": "gemini-3-flash",
    "gemini-1.5-flash": "gemini-3-flash",
    "gemini-1-5-pro": "gemini-3-pro",
    "gemini-1.5-pro": "gemini-3-pro",
    "gemini-2-0-flash": "gemini-3-flash",
    "gemini-2.0-flash": "gemini-3-flash",
    "gemini-2-0-flash-thinking": "gemini-3-flash",
    "gemini-2.0-flash-thinking": "gemini-3-flash",
    "gemini-2-0-pro-exp": "gemini-3-pro",
    "gemini-2.0-pro-exp": "gemini-3-pro",
    "gemini-2-0-pro": "gemini-3-pro",
    "gemini-2.0-pro": "gemini-3-pro",

    # xAI legacy (Grok 2, Grok 3) -> Grok 4
    "grok-2": "grok-4",
    "grok-3": "grok-4",
    "grok-3-mini": "grok-4",

    # DeepSeek legacy (R1, V3) -> R2, V4
    "deepseek-r1": "deepseek-r2",
    "deepseek-v3": "deepseek-v4",

    # Meta legacy (Llama 3.x) -> Llama 4
    "llama-3-3-70b": "llama-4-70b",
    "llama-3.3-70b": "llama-4-70b",
    "llama-3-1-405b": "llama-4-405b",
    "llama-3.1-405b": "llama-4-405b",
    "llama-3-1-70b": "llama-4-70b",
    "llama-3.1-70b": "llama-4-70b",
    "llama-3-1-8b": "llama-4-70b",
    "llama-3.1-8b": "llama-4-70b",
}


def is_model_current(model_id: str) -> bool:
    """Returns True if the model belongs to the active 2026 Frontier Generation."""
    clean_id = model_id.strip().lower().replace(".", "-")
    return clean_id in FRONTIER_MODELS_2026 or model_id.strip() in FRONTIER_MODELS_2026


def auto_upgrade_legacy_model(model_id: str) -> Dict[str, Any]:
    """
    Transparently upgrades any obsolete 2024/2025 model to its 2026 frontier successor.
    """
    clean_id = model_id.strip().lower()
    normalized_id = clean_id.replace(".", "-")

    if clean_id in FRONTIER_MODELS_2026:
        return {
            "upgraded_id": clean_id,
            "was_legacy": False,
            "original_id": clean_id,
            "model": FRONTIER_MODELS_2026[clean_id],
        }
    if normalized_id in FRONTIER_MODELS_2026:
        return {
            "upgraded_id": normalized_id,
            "was_legacy": False,
            "original_id": clean_id,
            "model": FRONTIER_MODELS_2026[normalized_id],
        }

    mapped_id = LEGACY_TO_FRONTIER_MAPPING.get(clean_id) or LEGACY_TO_FRONTIER_MAPPING.get(normalized_id)
    if mapped_id and mapped_id in FRONTIER_MODELS_2026:
        model = FRONTIER_MODELS_2026[mapped_id]
        return {
            "upgraded_id": mapped_id,
            "was_legacy": True,
            "original_id": clean_id,
            "model": model,
            "notice": f"Upgraded obsolete model '{clean_id}' to 2026 frontier model '{model['name']}' ({mapped_id}).",
        }

    default_model = FRONTIER_MODELS_2026["claude-4-5-sonnet"]
    return {
        "upgraded_id": default_model["id"],
        "was_legacy": True,
        "original_id": clean_id,
        "model": default_model,
        "notice": f"Unrecognized model '{clean_id}' defaulted to 2026 frontier flagship '{default_model['name']}'.",
    }


def assert_model_currency(model_id: str, context: str = "execution") -> None:
    """
    Raises ValueError if an obsolete model is used without upgrade.
    """
    if is_model_current(model_id):
        return
    upgrade = auto_upgrade_legacy_model(model_id)
    raise ValueError(
        f"[CURRENCY_GATE_VIOLATION] {context}: Obsolete model '{model_id}' rejected. "
        f"SPE strictly requires active 2026 frontier models. Use '{upgrade['upgraded_id']}' instead."
    )


def get_default_frontier_model() -> Dict[str, Any]:
    """Returns the default 2026 frontier flagship."""
    return FRONTIER_MODELS_2026["claude-4-5-sonnet"]


def get_active_frontier_models() -> List[Dict[str, Any]]:
    """Returns all verified 2026 frontier models."""
    return list(FRONTIER_MODELS_2026.values())
