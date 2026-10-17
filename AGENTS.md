# AGENTS.md — SPE Ω Repository Invariant Governance

## 🛡️ ZERO-STALE-MODEL INVARIANT (STRICT LAW)

All AI agents, coding assistants, automated subagents, and human contributors working within the `system-prompt-engine` repository are bound by the following non-negotiable architectural invariant:

### 1. BANNED OUTDATED MODELS (FAIL-CLOSED)
Under **NO circumstances** may any agent generate, suggest, hardcode, or default to pre-2026 legacy models in new features, UI copy, CLI arguments, or compiler targets:
- ❌ **Claude 3.5 / Claude 3.7** (Retired 2024–2025 models)
- ❌ **GPT-4o / GPT-4o-mini / o1 / o1-mini / o3-mini** (Retired 2024–2025 models)
- ❌ **Claude 4.5** (Superseded by Claude 5.5 / Claude Code 2.1)
- ❌ **Fictional "GPT-5"** (Superseded by OpenAI GPT-6.1-Sol Codex)

*Exception*: Historical security vulnerability post-mortems (OWASP CVE reproductions) and migration regression tests where legacy strings are explicitly tagged with `// historical` or `// LEGACY`.

---

### 2. AUTHORITATIVE LATE-2026 FRONTIER TARGETS
All prompts, transcompilers, model selectors, and benchmarks MUST strictly feature:
- **Anthropic**:
  - `claude-5-5-sonnet` (Claude Sonnet 5.5 — Hybrid Reasoning & Instruction Adherence)
  - `claude-5-5-haiku` (Claude Haiku 5.5 — Sub-Second Low-Latency Edge)
  - `claude-5-5-opus` (Claude Opus 5.5 — Deep Formal Mathematical Reasoning)
  - `claude-code-2-1` (Claude Code 2.1.293 Cloud/Desktop/Headless specs)
- **OpenAI**:
  - `gpt-6-1-sol` (OpenAI GPT-6.1-Sol Codex — Agentic Systems & Software Engineering)
  - `gpt-6-astra` (OpenAI GPT-6 Astra — Multimodal & High-Speed CoT)
- **Meta**:
  - `meta-muse-code` (Meta Muse Code 1.3 / Muse-Spark 1.3 — Local Silicon Execution)
- **Google**:
  - `gemini-3-pro` / `gemini-3-flash`

---

### 3. ENFORCEMENT & GATEKEEPING
- The gate is automated via `tools/lint-frontier-models.mjs`.
- It executes automatically on `npm run build` in `apps/web`.
- If any forbidden model string is introduced into active code, the build exits with code 1 immediately.
