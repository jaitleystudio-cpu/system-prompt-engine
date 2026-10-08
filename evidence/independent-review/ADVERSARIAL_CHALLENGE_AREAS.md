# SPE Ω — Adversarial Challenge Areas for Grok Refutation

This document provides the hostile verification checklist for **Grok**.  
Your objective is to find flaws, false PASSes, security bypasses, overclaims, and architecture gaps.

---

## Challenge Area 1: False PASS Hunting & Test Integrity
- Inspect test suites in `tests/unit/` (751 tests).
- Search for tests that pass trivially without actually exercising logic (e.g. tests with empty assertions, mock returns that bypass validation).
- Verify that mutation/negative tests exist for every core module.
- Confirm that `run_paired_baseline` cannot claim `OBSERVED_LOCAL` for simulated models without verified runtime receipts (`test_simulated_cannot_claim_observed_local`).

## Challenge Area 2: Security & Capability Escalation Attacks
- Target: `spe_runtime/runtime_gateway/firewall.py` & `McpCapabilityAdapter`.
- Attack vectors to test:
  1. **Ed25519 Grant Forgery**: Can an attacker forge or tamper with a `CapabilityGrant` signature and have `install_grant()` accept it?
  2. **Untrusted Issuer**: Can an attacker install a grant from an issuer not registered in `trusted_roots`?
  3. **Self-Granting Attack**: Can an untrusted agent grant itself capability authority, or evaluate against a self-issued grant?
  4. **Pre-Approval Budget Leak**: When a high-impact capability (e.g. `PAYMENT`, `DEPLOY`, `PRODUCTION_CHANGE`) returns `REQUIRES_APPROVAL`, is the budget debited prematurely?
  5. **Budget Reservation & Rollback**: Does the 2-phase reservation model (`reserve_budget`, `commit_budget`, `rollback_budget`) correctly restore funds on denied approvals or aborted transactions?
  6. **Durable Replay Attacks Across Restarts**: Can an attacker replay a consumed grant nonce or request nonce after the firewall process terminates and restarts?
  7. **Timezone Offset Parsing**: Can grant expirations with positive or negative UTC offsets (`+05:30`, `-08:00`) be manipulated to bypass time checks?
  8. **Delegation Escalation**: Can an agent delegate permissions it does not hold via `A2APolicyEngine`?

## Challenge Area 3: Gilden Moat Operator Durability & Authenticated Receipts
- Target: `spe_runtime/gilden/kernel.py` & `spe_runtime/gilden/operator.py`.
- Challenge vectors:
  1. **Self-Grant Authority Guard**: Can Gilden execute an external effect if `authority_grant_id` is missing, self-issued, or unauthorized?
  2. **Ed25519 Effect Receipt Verification**: Are `EffectReceipt` records signed using RFC 8785 JCS canonicalization + Ed25519? Can a tampered receipt pass `verify_effect_receipt()`?
  3. **Append-Only Hash Chaining**: Does `GildenStore` maintain cryptographic SHA-256 hash chaining across consecutive records?
  4. **Ledger Tamper Detection**: If a record in `gilden_ledger.jsonl` is modified on disk, does store reload detect corruption and fail closed?
  5. **Fsync Durability**: Are ledger records flushed and synced with `os.fsync()` after every write?
  6. **Budget Ceiling**: Can `BudgetGuard` be breached by concurrent or excessive requests?

## Challenge Area 4: Failure Genome Durability & Minimization
- Target: `spe_runtime/failure_genome/store.py` & `spe_runtime/counterexample_minimizer/minimizer.py`.
- Challenge vectors:
  1. Can corrupt lines in `genome_entries.jsonl` cause data loss or crash on store reload?
  2. Can poisoning payloads (e.g. recursive reproducers, multi-megabyte buffers) bypass poisoning detection?
  3. Does deduplication correctly merge counts without losing oldest or latest occurrence timestamps?
  4. Does `check_holdout_contamination` catch subtler semantic leaks or only exact/substring matches?

## Challenge Area 5: Commercial Entitlement & Webhook Edge Cases
- Target: `spe_runtime/entitlement/manager.py` & `spe_runtime/entitlement/license.py`.
- Challenge vectors:
  1. Can out-of-order webhook delivery ever resurrect a cancelled or delinquent subscription?
  2. Can offline Ed25519 licenses be forged without the private signing key?
  3. Does clock rollback detection hold across arbitrary backwards time jumps?

## Challenge Area 6: Scientific, Regulatory & SEO Claim Guard
- Target: `apps/web/` copy, `scripts/generate-evidence-seo.mjs`, and `evidence/benchmarks/`.
- Challenge vectors:
  1. Does any public copy claim generic "30-50% GPU memory savings" or "formal proof of AI correctness"?
  2. Does any document claim SPE is an official regulatory certifier for EU AI Act or ISO 42001?
  3. Are all 25 pre-rendered SEO pages backed by substantive, unique content rather than thin doorway pages?
  4. Is the +66.7% benchmark delta truthfully labeled `SIMULATED` rather than `OBSERVED_LOCAL`?
