# Batch H — Repo / Source / Computer-Use Adapter Matrix

**Date:** 2026-09-26 (IST)  
**Base tip (Batch G PASS):** `ef39e2692a2c6c3e0b83ba3cbaf47a4b96003587`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**Normative:** `docs/superpowers/specs/2026-09-24-context-grounding-auto-routing-amendment.md`  
**HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN.**

Legend: **PRESENT** / **PARTIAL** / **MISSING** / **BLOCKED** (pre-H → post-H).

| # | Requirement | Pre-H | Post-H | Owner(s) |
|---|---|---|---|---|
| 1 | Repo access capability tag / profile field | MISSING (no `repository_access` on provider profiles) | PRESENT | `data/provider_profiles_v1.json` (`LOCAL_WASM` declares `repository_access`); tags in `spe_runtime/adapters/environment_capabilities.py` |
| 2 | Source/file access capability + `local_temp_file` adapter | PARTIAL (`local_temp_file.py` write fixture exists; no `file_access` capability tag / selection path) | PRESENT | `LOCAL_WASM` + `file_access`; `environment_capabilities` ↔ `local_temp_file` (read/inspect intent; write fixture remains confined; ≠ execute) |
| 3 | Browser/computer-use capability tag | MISSING | PRESENT | `EXTERNAL_OPTIONAL` declares `browser_computer_use`; adapter documents tag ≠ desktop control / no auto side-effects |
| 4 | Selection via `CapabilityNeed` / `select_profile` covers new tags | PARTIAL (generic tag matching works; tags absent from registry) | PRESENT | `spe_runtime/providers/adapter.py` + env helper `select_for_environment_need` |
| 5 | Capability selection ≠ AuthorityGrant / no side-effect auto-enable | PRESENT (Batch E ProfileSelection invariants) | PRESENT (kept + Batch H adversarial asserts) | `adapter.ProfileSelection`; `environment_capabilities` never mints grant / network / credentials |
| 6 | Protocol/prompt: conditional “if environment provides…” (ANY_AI portable) | PRESENT (`capability_routing.build_auto_route_node` + `protocol_render`) | PRESENT (extended with env-tag conditional clauses; still ANY_AI portable) | `capability_routing.py`; `adapters/environment_capabilities.py` (`conditional_capability_prompt_clause`); `protocol_render.py` |
| 7 | Bind into `execution_record` / `.spe` if Batch E profile bind exists | PRESENT (profile_id / digest / status / reason) | PRESENT (unchanged bind path; new tags ride on profile capabilities + digest bump for changed profiles) | `packages/web-runtime` + `spe_runtime.portability.spe_artifact` |
| 8 | Create/UI surfacing of new capability labels | PARTIAL (ACTIVE PROFILE shows id/version/status/digest; not capability list) | PARTIAL→PRESENT (thin capabilities line on ACTIVE PROFILE from TS mirror; no redesign) | `ExecutionContractPanel.tsx` + `providerProfiles.ts` |
| 9 | Tool results as UNTRUSTED_SOURCE / non-authority | PARTIAL (grounding firewall / protocol law) | PRESENT for env adapters | `classify_environment_tool_result` → `UNTRUSTED_SOURCE`; never authority |
| 10 | `capability_manifest.schema.json` full env manifest | BLOCKED (STUB since pre-Batch) | BLOCKED (left stub; tags live on provider profiles + env adapter constants — no parallel registry) | `schemas/capability_manifest.schema.json` |
| 11 | Adversarial: no self-escalate; missing → UNAVAILABLE/BLOCKED; file/repo ≠ execute; computer-use ≠ desktop control | PARTIAL (Batch E suite) | PRESENT | `tests/unit/test_batch_h_environment_adapters.py` |
| 12 | Real browser automation / OS computer-use agent / C07 side-effect bridge | — | BLOCKED (explicit non-goal) | N/A |

## Canonical tags (Batch H)

| Tag | Meaning (DATA / selection only) | Default profile coverage |
|-----|----------------------------------|--------------------------|
| `repository_access` | Repo-grounded read/inspect intent in prompts/contracts | `LOCAL_WASM` |
| `file_access` | User-supplied source/file grounding (local sandbox path) | `LOCAL_WASM` |
| `browser_computer_use` | Env may expose browser/computer-use tools; portable “if available” | `EXTERNAL_OPTIONAL` (requires `allow_external`) |

## Non-claims

- Tag presence ≠ authorization for irreversible actions.
- `browser_computer_use` ≠ SPE desktop automation agent.
- `file_access` / `repository_access` ≠ code execution or AuthorityGrant.
- HOSTING remains FORBIDDEN. WORLD#1 remains NOT_PROVEN.
