"""Route catalogs and SEO metadata validation for Tiers A-F."""

from __future__ import annotations

import re
from typing import Any

from .models import RouteMetadata, SeoValidationReport

BASE_CANONICAL_DOMAIN = "https://promptengine.run"

TIER_A_CATEGORY_OWNERSHIP: list[RouteMetadata] = [
    RouteMetadata(
        path="/ai-instruction-assurance",
        tier="TIER_A",
        title="AI Instruction Assurance | System Prompt Engine (SPE)",
        meta_description="Guaranteed prompt boundary invariants, zero-leak firewalls, and causal proof graphs for mission-critical enterprise LLM agents.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/ai-instruction-assurance",
        schema_type="TechArticle",
        h1="AI Instruction Assurance Platform",
        target_intent="category_ownership",
    ),
    RouteMetadata(
        path="/instruction-drift",
        tier="TIER_A",
        title="Instruction Drift Sentinel | Detect Prompt Decay in Production",
        meta_description="Continuously detect and attribute LLM prompt instruction drift across model API updates and multi-turn agent deployments.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/instruction-drift",
        schema_type="TechArticle",
        h1="Instruction Drift Sentinel & Root Cause Attribution",
        target_intent="category_ownership",
    ),
    RouteMetadata(
        path="/kv-cache-optimization",
        tier="TIER_A",
        title="KV-Cache Alignment & Inference Economics | SPE",
        meta_description="Measure prefill latency, TTFT, throughput, and memory savings across vLLM, SGLang, and llama.cpp with empirical test lab evidence.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/kv-cache-optimization",
        schema_type="TechArticle",
        h1="Inference Economics & KV-Cache Alignment",
        target_intent="category_ownership",
    ),
    RouteMetadata(
        path="/prompt-firewall",
        tier="TIER_A",
        title="Zero-Egress Prompt Firewall & Capability Gatekeeper | SPE",
        meta_description="Air-gapped capability authorization firewall preventing SSRF, prompt injection, and unauthorized file system mutations in agent systems.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/prompt-firewall",
        schema_type="TechArticle",
        h1="Runtime Agent Capability Firewall",
        target_intent="category_ownership",
    ),
    RouteMetadata(
        path="/causal-proof-graph",
        tier="TIER_A",
        title="Causal Proof Graph for Prompts | Explain Why Clauses Exist",
        meta_description="Bidirectional causal graph tracing every prompt clause to formal requirement sources, policy rules, and AST transforms.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/causal-proof-graph",
        schema_type="TechArticle",
        h1="Causal Proof Graph Engine",
        target_intent="category_ownership",
    ),
]

TIER_B_FREE_ACQUISITION_TOOLS: list[RouteMetadata] = [
    RouteMetadata(
        path="/tools/audio-to-text",
        tier="TIER_B",
        title="Free In-Browser Audio to Text Converter | Private & Offline",
        meta_description="Transcribe audio files directly in your browser with zero server egress, WebAssembly Whisper, and verified Telugu support.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/audio-to-text",
        schema_type="WebApplication",
        h1="Free Offline Audio to Text Transcriber",
        target_intent="tool_acquisition",
    ),
    RouteMetadata(
        path="/tools/video-to-text",
        tier="TIER_B",
        title="Free Video to Text Transcription Tool | Local Browser AI",
        meta_description="Extract and transcribe speech from video files with zero cloud upload. Private, client-side, and completely free forever.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/video-to-text",
        schema_type="WebApplication",
        h1="Free In-Browser Video to Text Extractor",
        target_intent="tool_acquisition",
    ),
    RouteMetadata(
        path="/tools/free-3d-website-builder",
        tier="TIER_B",
        title="Free 3D Website Studio | Interactive WebGL & Three.js",
        meta_description="Build interactive 3D web experiences and export clean standalone HTML/JS with zero vendor lock-in and zero data tracking.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/free-3d-website-builder",
        schema_type="WebApplication",
        h1="Free 3D Website Builder & WebGL Studio",
        target_intent="tool_acquisition",
    ),
    RouteMetadata(
        path="/tools/prompt-linter",
        tier="TIER_B",
        title="Free System Prompt Linter & Constraint Checker | SPE",
        meta_description="Check your system prompt for contradictory constraints, PII leaks, secret keys, and positional attention blindspots online.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/prompt-linter",
        schema_type="WebApplication",
        h1="Free Online System Prompt Linter",
        target_intent="tool_acquisition",
    ),
    RouteMetadata(
        path="/tools/context-salience-tester",
        tier="TIER_B",
        title="Free Context Salience & Lost-in-the-Middle Tester | SPE",
        meta_description="Visualize instruction attenuation and prompt attention salience across 128k context windows with free synthetic probe tests.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/context-salience-tester",
        schema_type="WebApplication",
        h1="Context Salience & Attention Attenuation Tester",
        target_intent="tool_acquisition",
    ),
    RouteMetadata(
        path="/tools/token-pruner",
        tier="TIER_B",
        title="Free Evidence-Preserving Prompt Token Pruner | SPE",
        meta_description="Safely compress system prompts by 15-40% while mathematically verifying that non-negotiable intent and safety rules are preserved.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/tools/token-pruner",
        schema_type="WebApplication",
        h1="Evidence-Preserving Prompt Token Pruner",
        target_intent="tool_acquisition",
    ),
]

TIER_C_EVIDENCE_PAGES: list[RouteMetadata] = [
    RouteMetadata(
        path="/models",
        tier="TIER_C",
        title="Model Passport & Empirical Prompt Sensitivity Atlas | SPE",
        meta_description="Empirical execution provenance and instruction sensitivity profiles across GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, and Llama 3.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/models",
        schema_type="CollectionPage",
        h1="Empirical Model Atlas & Execution Passports",
        target_intent="evidence_verification",
    ),
    RouteMetadata(
        path="/failure-genome",
        tier="TIER_C",
        title="Failure Genome Ω | Open Corpus of Prompt Failure Patterns",
        meta_description="Public catalog of verified prompt vulnerabilities, jailbreaks, and hallucinations cataloged under SPE-FG-YYYY-NNNNNN IDs.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/failure-genome",
        schema_type="Dataset",
        h1="Prompt Failure Genome Ω Repository",
        target_intent="evidence_verification",
    ),
    RouteMetadata(
        path="/benchmarks",
        tier="TIER_C",
        title="SPE-Bench Ω | Verified AI Instruction Assurance Benchmarks",
        meta_description="Reproducible benchmark results across DEV, VAL, and HELD_OUT test suites evaluated with deterministic and programmatic oracles.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/benchmarks",
        schema_type="Dataset",
        h1="SPE-Bench Ω Verification Suites",
        target_intent="evidence_verification",
    ),
    RouteMetadata(
        path="/proofs",
        tier="TIER_C",
        title="Cryptographic Proof Receipt Verifier | RFC 8785 Ed25519",
        meta_description="Verify signed SPE proof receipts in your browser with RFC 8785 JCS canonicalization and zero-dependency Ed25519 cryptography.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/proofs",
        schema_type="WebApplication",
        h1="Cryptographic Receipt Verifier",
        target_intent="evidence_verification",
    ),
]

TIER_D_INTEGRATIONS: list[RouteMetadata] = [
    RouteMetadata(
        path="/integrations/langchain",
        tier="TIER_D",
        title="LangChain System Prompt Integration & Assurance | SPE",
        meta_description="Enforce bounded rule consistency, PII protection, and signed receipts on LangChain prompts and agent pipelines.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/langchain",
        schema_type="TechArticle",
        h1="LangChain AI Instruction Assurance",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/vercel-ai-sdk",
        tier="TIER_D",
        title="Vercel AI SDK System Prompt Guardrails & Compilation | SPE",
        meta_description="Transcompile system instructions to typed Vercel AI SDK system strings with KV-cache optimization and receipt seals.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/vercel-ai-sdk",
        schema_type="TechArticle",
        h1="Vercel AI SDK Integration Guide",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/mcp",
        tier="TIER_D",
        title="Model Context Protocol (MCP) Tool Firewall & Proxy | SPE",
        meta_description="Intercept and enforce strict capability bounds, schema validation, and rate limits on Anthropic MCP server tool calls.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/mcp",
        schema_type="TechArticle",
        h1="Model Context Protocol (MCP) Security Proxy",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/cursor",
        tier="TIER_D",
        title="Cursor Rules (.cursorrules) Verification & Compiler | SPE",
        meta_description="Lint, optimize, and verify .cursorrules instruction sets to eliminate hallucinated imports and contradictory developer rules.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/cursor",
        schema_type="TechArticle",
        h1="Cursor Rules Assurance & Dialect Lowering",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/openai",
        tier="TIER_D",
        title="OpenAI System Instruction Assurance & ChatML Lowering | SPE",
        meta_description="Lower canonical prompt specifications to OpenAI ChatML dialect with strict JSON schema enforcement and zero-leak guardrails.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/openai",
        schema_type="TechArticle",
        h1="OpenAI Architecture & ChatML Compiler",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/anthropic",
        tier="TIER_D",
        title="Anthropic Claude XML System Prompt Compiler & Gates | SPE",
        meta_description="Lower canonical instructions to structured Anthropic XML tags (<rules>, <examples>, <guardrails>) with salience optimization.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/anthropic",
        schema_type="TechArticle",
        h1="Anthropic Claude XML Integration",
        target_intent="integrations",
    ),
    RouteMetadata(
        path="/integrations/vllm",
        tier="TIER_D",
        title="vLLM PagedAttention KV-Cache Alignment & Benchmarking | SPE",
        meta_description="Align prompt token length to exact 16/32 block allocations in vLLM PagedAttention for maximum throughput and memory efficiency.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/integrations/vllm",
        schema_type="TechArticle",
        h1="vLLM PagedAttention Alignment Integration",
        target_intent="integrations",
    ),
]

TIER_E_COMPETITOR_MIGRATIONS: list[RouteMetadata] = [
    RouteMetadata(
        path="/compare/promptfoo",
        tier="TIER_E",
        title="SPE vs Promptfoo: Formal Assurance vs Heuristic Testing",
        meta_description="Compare System Prompt Engine and Promptfoo on cryptographic proof receipts, bounded rule consistency, and causal proof graphs.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compare/promptfoo",
        schema_type="TechArticle",
        h1="SPE vs Promptfoo Architecture Comparison",
        target_intent="competitor_comparison",
    ),
    RouteMetadata(
        path="/compare/langfuse",
        tier="TIER_E",
        title="SPE vs Langfuse: Instruction Assurance vs Observability",
        meta_description="Detailed comparison between pre-deployment formal instruction assurance (SPE) and post-hoc LLM tracing & observability (Langfuse).",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compare/langfuse",
        schema_type="TechArticle",
        h1="SPE vs Langfuse: Prevention vs Observability",
        target_intent="competitor_comparison",
    ),
    RouteMetadata(
        path="/compare/braintrust",
        tier="TIER_E",
        title="SPE vs Braintrust: Air-Gapped Verification vs Cloud Eval",
        meta_description="Evaluate the architectural differences between SPE's air-gapped zero-egress CI gate and Braintrust cloud-hosted LLM evals.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compare/braintrust",
        schema_type="TechArticle",
        h1="SPE vs Braintrust Architectural Review",
        target_intent="competitor_comparison",
    ),
    RouteMetadata(
        path="/compare/arize",
        tier="TIER_E",
        title="SPE vs Arize Phoenix: Invariant Gates vs Post-Hoc Traces",
        meta_description="Explore why prompt boundary invariants must be verified deterministically in CI/CD before shipping to Phoenix trace collectors.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compare/arize",
        schema_type="TechArticle",
        h1="SPE vs Arize Phoenix Comparison",
        target_intent="competitor_comparison",
    ),
    RouteMetadata(
        path="/migrate/cursorrules",
        tier="TIER_E",
        title="Migrate from .cursorrules to SPE Open Package (.spe)",
        meta_description="Step-by-step guide to migrating loose .cursorrules files into versioned, testable, signed .spe packages with CI merge gates.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/migrate/cursorrules",
        schema_type="TechArticle",
        h1="Migrating from .cursorrules to SPE Packages",
        target_intent="migration_guide",
    ),
    RouteMetadata(
        path="/migrate/open-prompt",
        tier="TIER_E",
        title="Migrating Legacy Markdown Prompts to Canonical SPE ABI",
        meta_description="Convert unversioned markdown prompts to the open Prompt ABI with multi-dialect lowering to OpenAI, Claude, and Gemini.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/migrate/open-prompt",
        schema_type="TechArticle",
        h1="Legacy Prompt Migration & ABI Lowering",
        target_intent="migration_guide",
    ),
]

TIER_F_GOVERNANCE_PACKS: list[RouteMetadata] = [
    RouteMetadata(
        path="/compliance/eu-ai-act",
        tier="TIER_F",
        title="EU AI Act (2024/1689) Instruction Governance Evidence Pack",
        meta_description="Map prompt safeguards to EU AI Act Articles 10, 13, 14, and 15 with automated SBOM, audit logs, and human-in-the-loop gates.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compliance/eu-ai-act",
        schema_type="TechArticle",
        h1="EU AI Act AI Instruction Governance Pack",
        target_intent="governance_compliance",
    ),
    RouteMetadata(
        path="/compliance/iso-42001",
        tier="TIER_F",
        title="ISO/IEC 42001 AI Management System (AIMS) Control Readiness",
        meta_description="Automated evidence compilation for ISO/IEC 42001 Annex A controls governing AI model instructions, safety, and risk.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compliance/iso-42001",
        schema_type="TechArticle",
        h1="ISO/IEC 42001 AI Management System Pack",
        target_intent="governance_compliance",
    ),
    RouteMetadata(
        path="/compliance/owasp-llm-top-10",
        tier="TIER_F",
        title="OWASP GenAI Top 10 Mitigation Engine & Audit Reports | SPE",
        meta_description="Deterministic policy checking against LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, and LLM06 Excessive Agency.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compliance/owasp-llm-top-10",
        schema_type="TechArticle",
        h1="OWASP GenAI Top 10 Compliance Engine",
        target_intent="governance_compliance",
    ),
    RouteMetadata(
        path="/compliance/hipaa-gdpr",
        tier="TIER_F",
        title="HIPAA & GDPR PII/PHI Boundary Defense for Prompts | SPE",
        meta_description="Air-gapped regex and named entity detectors ensuring zero HIPAA PHI or GDPR personal data exposure in system prompt templates.",
        canonical_url=f"{BASE_CANONICAL_DOMAIN}/compliance/hipaa-gdpr",
        schema_type="TechArticle",
        h1="HIPAA & GDPR Prompt Boundary Defense",
        target_intent="governance_compliance",
    ),
]

ALL_TIER_ROUTES: list[RouteMetadata] = [
    *TIER_A_CATEGORY_OWNERSHIP,
    *TIER_B_FREE_ACQUISITION_TOOLS,
    *TIER_C_EVIDENCE_PAGES,
    *TIER_D_INTEGRATIONS,
    *TIER_E_COMPETITOR_MIGRATIONS,
    *TIER_F_GOVERNANCE_PACKS,
]


def validate_seo_routes(routes: list[RouteMetadata]) -> SeoValidationReport:
    """Validates SEO routes against canonical crawlability and metadata invariants."""
    errors: list[str] = []
    warnings: list[str] = []
    seen_paths: set[str] = set()
    seen_canonicals: set[str] = set()

    valid_count = 0

    valid_schemas = {
        "TechArticle",
        "WebApplication",
        "SoftwareApplication",
        "Dataset",
        "CollectionPage",
        "Article",
    }

    for route in routes:
        route_errors = []

        # 1. Path format
        if not route.path.startswith("/"):
            route_errors.append(f"Path '{route.path}' must start with '/'")
        if route.path in seen_paths:
            route_errors.append(f"Duplicate path detected: '{route.path}'")
        seen_paths.add(route.path)

        # 2. Canonical URL format
        expected_canonical = f"{BASE_CANONICAL_DOMAIN}{route.path}"
        if route.canonical_url != expected_canonical:
            route_errors.append(f"Canonical URL mismatch for '{route.path}': got '{route.canonical_url}', expected '{expected_canonical}'")
        if route.canonical_url in seen_canonicals:
            route_errors.append(f"Duplicate canonical URL detected: '{route.canonical_url}'")
        seen_canonicals.add(route.canonical_url)

        # 3. Title checks
        if not route.title or len(route.title.strip()) == 0:
            route_errors.append(f"Empty title for '{route.path}'")
        elif len(route.title) > 75:
            warnings.append(f"Title for '{route.path}' is {len(route.title)} chars (recommended <= 70)")

        # 4. Meta description checks
        if not route.meta_description or len(route.meta_description.strip()) == 0:
            route_errors.append(f"Empty meta description for '{route.path}'")
        elif len(route.meta_description) < 40:
            route_errors.append(f"Meta description too short for '{route.path}' ({len(route.meta_description)} chars)")
        elif len(route.meta_description) > 175:
            warnings.append(f"Meta description for '{route.path}' is {len(route.meta_description)} chars (recommended <= 165)")

        # 5. H1 check
        if not route.h1 or len(route.h1.strip()) == 0:
            route_errors.append(f"Empty H1 for '{route.path}'")

        # 6. Schema truth: no stacked Article/TechArticle; valid schema type
        if route.schema_type not in valid_schemas:
            route_errors.append(f"Invalid schema type '{route.schema_type}' for '{route.path}'")

        # 7. Crawlability vs noindex
        if route.crawlable and route.noindex:
            route_errors.append(f"Conflicting crawl settings on '{route.path}': crawlable is True but noindex is True")

        if route_errors:
            errors.extend(route_errors)
        else:
            valid_count += 1

    return SeoValidationReport(
        total_routes_checked=len(routes),
        valid_routes=valid_count,
        errors=errors,
        warnings=warnings,
        is_valid=len(errors) == 0,
    )


def generate_sitemap_xml(routes: list[RouteMetadata], base_url: str = BASE_CANONICAL_DOMAIN) -> str:
    """Generates deterministic sitemap.xml for all crawlable routes."""
    entries = []
    for r in routes:
        if r.crawlable and not r.noindex:
            entries.append(
                f"  <url>\n    <loc>{r.canonical_url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>"
            )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
