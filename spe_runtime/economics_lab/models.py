"""Models for Inference Economics Lab."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class InferenceStack(str, Enum):
    VLLM = "vLLM"
    SGLANG = "SGLang"
    LLAMA_CPP = "llama.cpp"
    OLLAMA = "Ollama"
    TENSORRT_LLM = "TensorRT-LLM"
    PROVIDER_CACHING = "provider_prompt_caching"


@dataclass
class StackMeasurement:
    stack: InferenceStack
    stack_version: str
    model_name: str
    input_tokens: int
    cached_tokens: int
    cache_hit_ratio: float
    prefill_latency_ms: float
    ttft_p50_ms: float
    ttft_p95_ms: float
    decode_tokens_per_sec: float
    gpu_memory_mb: float
    cost_per_request_usd: float
    evidence_class: str = "OBSERVED_LOCAL"  # or OBSERVED_REMOTE / CALIBRATED_ESTIMATE


@dataclass
class EconomicsComparison:
    stack: InferenceStack
    baseline_ttft_p50_ms: float
    candidate_ttft_p50_ms: float
    ttft_delta_pct: float
    prefill_delta_pct: float
    cost_delta_pct: float
    defensible_statement: str
    evidence_class: str
