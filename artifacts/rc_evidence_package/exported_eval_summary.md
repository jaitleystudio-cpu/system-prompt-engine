# SPE × Promptfoo CI/CD Bridge Report

### Export Overview
- **Project**: `spe-unit-test-eval`
- **Prompt Content Hash**: `230592988db3c7647240bb25027c5780ec43028df3bffef80e6ee866c2d873dc`
- **RFC 8785 JCS Receipt Digest**: `a5b219c0c7c0667ee3bf99a38e56334bf330e3467921c51bc01cf9fd364c1b6d`
- **Downstream Providers**: `openai:gpt-6-1-sol, anthropic:claude-5-5-sonnet`
- **Static Schema**: Enforced (JSON)
- **Max Latency Threshold**: `2000ms`
- **Adversarial Red-Team Suite**: Enabled (6 plugin families)

### Upstream SPE Measured Pre-Flight Results
Before spending token credits in Promptfoo:
1. **Zero-Token Pre-Flight Check**: Static type analysis measured **0 fatal boundary errors** and **0 warnings** (Status: `PASSED`).
2. **1024 Hostile Gym Probes**: Measured **1024 / 1024 killed (100.0% Mutation Kill Rate)** and **31 / 31** metamorphic relations satisfied.
3. **Deterministic Seed Replay**: Re-run with frozen PRNG seed (`42`) and cryptographic receipt `a5b219c0c7c0667e...`.
