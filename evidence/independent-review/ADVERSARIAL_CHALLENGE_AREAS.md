# SPE Ω — Adversarial Challenge Areas for Grok Refutation

This document provides the hostile verification checklist for **Grok**.  
Your objective is to find flaws, false PASSes, security bypasses, overclaims, and architecture gaps.

---

## Challenge Area 1: False PASS Hunting
- Inspect test suites in `tests/unit/` (736 tests).
- Search for tests that pass trivially without actually exercising logic (e.g. tests with empty assertions, mock returns that bypass validation).
- Verify that mutation/negative tests exist for every core module.

## Challenge Area 2: Security & Capability Escalation Attacks
- Target: `spe_runtime/runtime_gateway/firewall.py` & `McpCapabilityAdapter`.
- Attack vectors to test:
  1. Can an agent craft a payload that tricks `CapabilityFirewall` into executing an unauthorized capability (e.g. `PAYMENT`, `PRODUCTION_CHANGE`)?
  2. Can replay nonces be bypassed with subtle formatting alterations (e.g. whitespace, lowercase, UTF-8 normalization)?
  3. Can an agent delegate permissions it does not hold via `A2APolicyEngine`?
  4. Does `test-network-egress.py` fail if an unauthorized external connection is attempted?

## Challenge Area 3: Failure Genome Durability & Minimization
- Target: `spe_runtime/failure_genome/store.py` & `spe_runtime/counterexample_minimizer/minimizer.py`.
- Challenge vectors:
  1. Can corrupt lines in `genome_entries.jsonl` cause data loss or crash on store reload?
  2. Can poisoning payloads (e.g. recursive reproducers, multi-megabyte buffers) bypass poisoning detection?
  3. Does deduplication correctly merge counts without losing oldest or latest occurrence timestamps?
  4. Does `check_holdout_contamination` catch subtler semantic leaks or only exact/substring matches?

## Challenge Area 4: Gilden Moat Operator Boundaries & Invariants
- Target: `spe_runtime/gilden/operator.py` & `spe_runtime/gilden/kernel.py`.
- Challenge vectors:
  1. Can Gilden execute an external effect if `authority_grant_id` is missing or self-generated?
  2. Can `BudgetGuard` be bypassed by submitting concurrent micro-requests that race before remaining budget updates?
  3. Are `EFFECT_RECEIPT` cryptographic digests strictly reproducible from payload inputs?

## Challenge Area 5: Commercial Entitlement & Webhook Edge Cases
- Target: `spe_runtime/entitlement/manager.py` & `spe_runtime/entitlement/license.py`.
- Challenge vectors:
  1. Can out-of-order webhook delivery ever resurrect a cancelled or delinquent subscription?
  2. Can offline Ed25519 licenses be forged without the private signing key?
  3. Does clock rollback detection hold across arbitrary backwards time jumps?

## Challenge Area 6: Scientific & Regulatory Claim Guard
- Target: `apps/web/` copy and `scripts/generate-evidence-seo.mjs`.
- Challenge vectors:
  1. Does any public copy claim generic "30-50% GPU memory savings" or "formal proof of AI correctness"?
  2. Does any document claim SPE is an official regulatory certifier for EU AI Act or ISO 42001?
  3. Are all 25 pre-rendered SEO pages backed by substantive, unique content rather than thin doorway pages?
