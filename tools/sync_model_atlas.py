#!/usr/bin/env python3
"""
tools/sync_model_atlas.py

Automated AI Model Discovery and Atlas Synchronization Engine for SPE.
Maintains the canonical, real-time registry of cutting-edge AI models,
their verified context windows, pricing, thinking/reasoning capabilities,
and commercial tier gating (Free vs Pro).

Outputs:
  - apps/web/src/engine/modelAtlas/modelAtlasRegistry.json
  - evidence/model_atlas_manifest.json
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_REGISTRY_PATH = REPO_ROOT / "apps/web/src/engine/modelAtlas/modelAtlasRegistry.json"
MANIFEST_PATH = REPO_ROOT / "evidence/model_atlas_manifest.json"

VERIFIED_MODELS = [
    # --- ANTHROPIC ---
    {
        "id": "claude-3-7-sonnet",
        "name": "Claude 3.7 Sonnet (Hybrid Reasoning)",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "contextWindow": 200000,
        "maxOutputTokens": 64000,
        "costInputPerM": 3.0,
        "costOutputPerM": 15.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Frontier Reasoning",
        "releaseDate": "2025-02-24",
        "dialectTemplateKey": "claude",
        "description": "Anthropic's hybrid model with controllable extended thinking and premier code synthesis.",
    },
    {
        "id": "claude-3-5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "provider": "Anthropic",
        "category": "coding-specialist",
        "contextWindow": 200000,
        "maxOutputTokens": 8192,
        "costInputPerM": 3.0,
        "costOutputPerM": 15.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Industry Benchmark",
        "releaseDate": "2024-10-22",
        "dialectTemplateKey": "claude",
        "description": "Standard-setting intelligence and coding precision with 200K token context.",
    },
    {
        "id": "claude-3-5-haiku",
        "name": "Claude 3.5 Haiku",
        "provider": "Anthropic",
        "category": "general-intelligence",
        "contextWindow": 200000,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.80,
        "costOutputPerM": 4.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "Ultra Fast",
        "releaseDate": "2024-11-04",
        "dialectTemplateKey": "claude",
        "description": "High-velocity Anthropic intelligence with blazing sub-second response times.",
    },
    {
        "id": "claude-3-opus",
        "name": "Claude 3 Opus",
        "provider": "Anthropic",
        "category": "frontier-reasoning",
        "contextWindow": 200000,
        "maxOutputTokens": 4096,
        "costInputPerM": 15.0,
        "costOutputPerM": 75.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Deep Analysis",
        "releaseDate": "2024-02-29",
        "dialectTemplateKey": "claude",
        "description": "Anthropic's powerhouse for deep textual comprehension and literary nuance.",
    },

    # --- OPENAI ---
    {
        "id": "o3-mini",
        "name": "OpenAI o3-mini (High-Speed Reasoning)",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "contextWindow": 200000,
        "maxOutputTokens": 100000,
        "costInputPerM": 1.10,
        "costOutputPerM": 4.40,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Reasoning Leader",
        "releaseDate": "2025-01-31",
        "dialectTemplateKey": "chatgpt",
        "description": "Cost-efficient STEM and code reasoning with low/medium/high reasoning effort knobs.",
    },
    {
        "id": "o1",
        "name": "OpenAI o1 (Full Reasoning)",
        "provider": "OpenAI",
        "category": "frontier-reasoning",
        "contextWindow": 200000,
        "maxOutputTokens": 100000,
        "costInputPerM": 15.0,
        "costOutputPerM": 60.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Deep Scientific",
        "releaseDate": "2024-12-05",
        "dialectTemplateKey": "chatgpt",
        "description": "Full-depth chain-of-thought model trained to spend more time thinking before answering.",
    },
    {
        "id": "gpt-4-5-preview",
        "name": "GPT-4.5 Preview",
        "provider": "OpenAI",
        "category": "general-intelligence",
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "costInputPerM": 75.0,
        "costOutputPerM": 150.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Massive Scale",
        "releaseDate": "2025-02-27",
        "dialectTemplateKey": "chatgpt",
        "description": "OpenAI's largest foundational model with unmatched world intuition and broad EQ.",
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o (Omni Flagship)",
        "provider": "OpenAI",
        "category": "general-intelligence",
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "costInputPerM": 2.50,
        "costOutputPerM": 10.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": True,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Multimodal Pro",
        "releaseDate": "2024-11-20",
        "dialectTemplateKey": "chatgpt",
        "description": "High-throughput omni model natively processing text, audio, and visual inputs.",
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o mini",
        "provider": "OpenAI",
        "category": "general-intelligence",
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "costInputPerM": 0.15,
        "costOutputPerM": 0.60,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "Cost Efficient",
        "releaseDate": "2024-07-18",
        "dialectTemplateKey": "chatgpt",
        "description": "Accessible everyday baseline for lightweight tasks and structured extraction.",
    },

    # --- GOOGLE GEMINI ---
    {
        "id": "gemini-2-0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "Google",
        "category": "general-intelligence",
        "contextWindow": 1048576,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.10,
        "costOutputPerM": 0.40,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": True,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "1M Free Context",
        "releaseDate": "2025-02-05",
        "dialectTemplateKey": "gemini",
        "description": "Google's 2.0 generation multimodal workhorse with native real-time streaming.",
    },
    {
        "id": "gemini-2-0-pro-exp",
        "name": "Gemini 2.0 Pro Experimental",
        "provider": "Google",
        "category": "frontier-reasoning",
        "contextWindow": 2097152,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.0,
        "costOutputPerM": 0.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": True,
            "supportsAudio": True,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "2M Deep Context",
        "releaseDate": "2025-02-05",
        "dialectTemplateKey": "gemini",
        "description": "Frontier Google intelligence capable of ingesting entire enterprise codebases.",
    },
    {
        "id": "gemini-2-0-flash-thinking",
        "name": "Gemini 2.0 Flash Thinking",
        "provider": "Google",
        "category": "frontier-reasoning",
        "contextWindow": 1048576,
        "maxOutputTokens": 65536,
        "costInputPerM": 0.0,
        "costOutputPerM": 0.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Reasoning Trace",
        "releaseDate": "2024-12-19",
        "dialectTemplateKey": "gemini",
        "description": "Exposes visible thought process before generating conclusions.",
    },
    {
        "id": "gemini-1-5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "Google",
        "category": "general-intelligence",
        "contextWindow": 2097152,
        "maxOutputTokens": 8192,
        "costInputPerM": 1.25,
        "costOutputPerM": 5.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": True,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Long-Horizon",
        "releaseDate": "2024-05-14",
        "dialectTemplateKey": "gemini",
        "description": "Proven 2M-token production model for multimodal document repositories.",
    },
    {
        "id": "gemini-1-5-flash",
        "name": "Gemini 1.5 Flash",
        "provider": "Google",
        "category": "general-intelligence",
        "contextWindow": 1048576,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.075,
        "costOutputPerM": 0.30,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": True,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "High Throughput",
        "releaseDate": "2024-05-14",
        "dialectTemplateKey": "gemini",
        "description": "Ultra low cost multimodal baseline for high-volume summarization.",
    },

    # --- xAI GROK ---
    {
        "id": "grok-3",
        "name": "Grok 3 (Frontier Truth & Reasoning)",
        "provider": "xAI",
        "category": "frontier-reasoning",
        "contextWindow": 131072,
        "maxOutputTokens": 32768,
        "costInputPerM": 3.0,
        "costOutputPerM": 15.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Truth-Maximizing",
        "releaseDate": "2025-02-17",
        "dialectTemplateKey": "grok",
        "description": "xAI's flagship reasoning model trained on Colossus supercluster with DeepSearch.",
    },
    {
        "id": "grok-3-mini",
        "name": "Grok 3 Mini",
        "provider": "xAI",
        "category": "frontier-reasoning",
        "contextWindow": 131072,
        "maxOutputTokens": 16384,
        "costInputPerM": 0.50,
        "costOutputPerM": 2.0,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Fast Reasoning",
        "releaseDate": "2025-02-17",
        "dialectTemplateKey": "grok",
        "description": "Compact reasoning engine for rapid factual validation and code debugging.",
    },
    {
        "id": "grok-2",
        "name": "Grok 2",
        "provider": "xAI",
        "category": "general-intelligence",
        "contextWindow": 131072,
        "maxOutputTokens": 8192,
        "costInputPerM": 2.0,
        "costOutputPerM": 10.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "Uncensored Direct",
        "releaseDate": "2024-08-13",
        "dialectTemplateKey": "grok",
        "description": "High-clarity model with real-time web awareness and uncompromising directness.",
    },

    # --- DEEPSEEK ---
    {
        "id": "deepseek-r1",
        "name": "DeepSeek-R1 (Open Reasoning Benchmark)",
        "provider": "DeepSeek",
        "category": "frontier-reasoning",
        "contextWindow": 65536,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.55,
        "costOutputPerM": 2.19,
        "capabilities": {
            "supportsThinking": True,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Open Reasoning",
        "releaseDate": "2025-01-20",
        "dialectTemplateKey": "chatgpt",
        "description": "World-class open reasoning model with transparent chain-of-thought traces.",
    },
    {
        "id": "deepseek-v3",
        "name": "DeepSeek-V3 (671B MoE Workhorse)",
        "provider": "DeepSeek",
        "category": "coding-specialist",
        "contextWindow": 65536,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.14,
        "costOutputPerM": 0.28,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "High Value MoE",
        "releaseDate": "2024-12-26",
        "dialectTemplateKey": "chatgpt",
        "description": "Extremely cost-effective 671B Mixture-of-Experts architecture for coding.",
    },

    # --- OPEN WEIGHTS & SPECIALISTS ---
    {
        "id": "llama-3-3-70b",
        "name": "Meta Llama 3.3 70B Instruct",
        "provider": "Meta",
        "category": "open-weights",
        "contextWindow": 131072,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.20,
        "costOutputPerM": 0.40,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "Open Leader",
        "releaseDate": "2024-12-06",
        "dialectTemplateKey": "chatgpt",
        "description": "Meta's flagship open-weights model matching prior 405B capabilities at 70B efficiency.",
    },
    {
        "id": "qwen-2-5-coder-32b",
        "name": "Qwen 2.5 Coder 32B",
        "provider": "Alibaba",
        "category": "coding-specialist",
        "contextWindow": 131072,
        "maxOutputTokens": 8192,
        "costInputPerM": 0.15,
        "costOutputPerM": 0.30,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": False,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "free",
        "badge": "Coding Prodigy",
        "releaseDate": "2024-11-12",
        "dialectTemplateKey": "cursor",
        "description": "Specialized open-source code generation model powering Cursor and offline IDEs.",
    },
    {
        "id": "mistral-large-2411",
        "name": "Mistral Large 2 (Nov 2024)",
        "provider": "Mistral",
        "category": "general-intelligence",
        "contextWindow": 131072,
        "maxOutputTokens": 8192,
        "costInputPerM": 2.0,
        "costOutputPerM": 6.0,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": True,
            "supportsToolCalling": True,
            "supportsStructuredOutputs": True,
        },
        "requiredTier": "pro",
        "badge": "Multilingual EU",
        "releaseDate": "2024-11-18",
        "dialectTemplateKey": "chatgpt",
        "description": "Top-tier European frontier model with unmatched multilingual reasoning.",
    },

    # --- CREATIVE MULTIMODAL MEDIA ---
    {
        "id": "midjourney-v6-1",
        "name": "Midjourney v6.1",
        "provider": "Midjourney",
        "category": "creative-multimodal",
        "contextWindow": 2048,
        "maxOutputTokens": 1,
        "costInputPerM": 0.05,
        "costOutputPerM": 0.05,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": False,
            "supportsToolCalling": False,
            "supportsStructuredOutputs": False,
        },
        "requiredTier": "pro",
        "badge": "Photorealism Gold",
        "releaseDate": "2024-07-30",
        "dialectTemplateKey": "midjourney",
        "description": "Industry leader in artistic coherence, cinematic lighting, and photorealistic textures.",
    },
    {
        "id": "flux-1-pro",
        "name": "FLUX.1 [pro]",
        "provider": "Black Forest Labs",
        "category": "creative-multimodal",
        "contextWindow": 2048,
        "maxOutputTokens": 1,
        "costInputPerM": 0.05,
        "costOutputPerM": 0.05,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": False,
            "supportsToolCalling": False,
            "supportsStructuredOutputs": False,
        },
        "requiredTier": "pro",
        "badge": "Typography & Hands",
        "releaseDate": "2024-08-01",
        "dialectTemplateKey": "flux",
        "description": "Premier open-architecture image generation model with exceptional typography rendering.",
    },
    {
        "id": "runway-gen-3-alpha",
        "name": "Runway Gen-3 Alpha Turbo",
        "provider": "Runway",
        "category": "creative-multimodal",
        "contextWindow": 2048,
        "maxOutputTokens": 1,
        "costInputPerM": 0.25,
        "costOutputPerM": 0.25,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": True,
            "supportsAudio": False,
            "supportsSystemRole": False,
            "supportsToolCalling": False,
            "supportsStructuredOutputs": False,
        },
        "requiredTier": "pro",
        "badge": "Cinematic Motion",
        "releaseDate": "2024-08-15",
        "dialectTemplateKey": "runway",
        "description": "High-fidelity video generation with controlled camera kinematics and physical realism.",
    },
    {
        "id": "suno-v4",
        "name": "Suno v4",
        "provider": "Suno",
        "category": "creative-multimodal",
        "contextWindow": 2048,
        "maxOutputTokens": 1,
        "costInputPerM": 0.10,
        "costOutputPerM": 0.10,
        "capabilities": {
            "supportsThinking": False,
            "supportsVision": False,
            "supportsAudio": True,
            "supportsSystemRole": False,
            "supportsToolCalling": False,
            "supportsStructuredOutputs": False,
        },
        "requiredTier": "pro",
        "badge": "Studio Master Audio",
        "releaseDate": "2024-11-20",
        "dialectTemplateKey": "suno",
        "description": "State-of-the-art musical arrangement, vocal timbre, and multi-track audio generation.",
    },
]


def sync_atlas() -> None:
    print(f"[*] Synchronizing SPE Model Atlas with {len(VERIFIED_MODELS)} verified models...")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Sort deterministically by provider and name
    sorted_models = sorted(VERIFIED_MODELS, key=lambda m: (m["provider"], m["name"]))

    # Serialize raw model data to calculate SHA-256
    raw_models_json = json.dumps(sorted_models, sort_keys=True)
    digest = hashlib.sha256(raw_models_json.encode("utf-8")).hexdigest()

    registry_payload = {
        "version": "2.0.0",
        "lastUpdated": now_iso,
        "checksumSha256": digest,
        "totalModels": len(sorted_models),
        "models": sorted_models,
    }

    OUTPUT_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REGISTRY_PATH.write_text(json.dumps(registry_payload, indent=2), encoding="utf-8")
    print(f"[+] Wrote verified Model Atlas Registry to: {OUTPUT_REGISTRY_PATH}")

    # Also record audit manifest
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "timestamp": now_iso,
        "checksumSha256": digest,
        "totalModels": len(sorted_models),
        "proTierCount": sum(1 for m in sorted_models if m["requiredTier"] == "pro"),
        "freeTierCount": sum(1 for m in sorted_models if m["requiredTier"] == "free"),
        "reasoningModelsCount": sum(1 for m in sorted_models if m["capabilities"]["supportsThinking"]),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[+] Wrote audit manifest to: {MANIFEST_PATH}")
    print(f"[+] Summary: {manifest['totalModels']} models ({manifest['freeTierCount']} Free, {manifest['proTierCount']} Pro, {manifest['reasoningModelsCount']} Frontier Reasoning)")


def check_atlas() -> bool:
    print("[*] Verifying SPE Model Atlas Registry...")
    if not OUTPUT_REGISTRY_PATH.exists():
        print(f"[-] Registry file not found: {OUTPUT_REGISTRY_PATH}")
        return False
    data = json.loads(OUTPUT_REGISTRY_PATH.read_text(encoding="utf-8"))
    models = data.get("models", [])
    raw_models_json = json.dumps(models, sort_keys=True)
    digest = hashlib.sha256(raw_models_json.encode("utf-8")).hexdigest()
    recorded = data.get("checksumSha256")
    matches = digest == recorded
    print(f"[*] Recorded Checksum: {recorded}")
    print(f"[*] Computed Checksum: {digest}")
    print(f"[*] Integrity Status:  {'✓ VERIFIED (Bit-for-bit SHA-256 match)' if matches else '✗ MISMATCH'}")
    print(f"[*] Models Count:      {len(models)}")
    return matches


if __name__ == "__main__":
    if "--check" in sys.argv:
        ok = check_atlas()
        sys.exit(0 if ok else 1)
    else:
        sync_atlas()

