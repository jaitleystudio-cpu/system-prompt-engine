# SPE × Promptfoo CI/CD Bridge Report

### Export Overview
- **Project**: `spe-unit-test-eval`
- **Prompt Content Hash**: `230592988db3c7647240bb25027c5780ec43028df3bffef80e6ee866c2d873dc`
- **RFC 8785 JCS Receipt Digest**: `151e03a71f8a7d5c0e7c8102b42a4560cc1f754b04b575ec98bee47440ade5f6`
- **Downstream Providers**: `openai:gpt-4o, anthropic:claude-3-5-sonnet`
- **Static Schema**: Enforced (JSON)
- **Max Latency Threshold**: `2000ms`
- **Adversarial Red-Team Suite**: Enabled (6 plugin families)

### Upstream SPE Measured Pre-Flight Results
Before spending token credits in Promptfoo:
1. **Zero-Token Pre-Flight Check**: Static type analysis measured **0 fatal boundary errors** and **0 warnings** (Status: `PASSED`).
2. **1024 Hostile Gym Probes**: Measured **1024 / 1024 killed (100.0% Mutation Kill Rate)** and **31 / 31** metamorphic relations satisfied.
3. **Deterministic Seed Replay**: Re-run with frozen PRNG seed (`42`) and cryptographic receipt `151e03a71f8a7d5c...`.
