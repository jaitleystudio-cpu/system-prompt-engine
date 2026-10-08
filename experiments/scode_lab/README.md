# S-CODE diagnostic witness lab

**Research prototype only.** This does not run inside SPE's product, verify an AI answer, prove fault localization in agents, or qualify the October 10 release.

Given a declared set of mutually exclusive fault classes and manually specified binary witness responses, `compile_witnesses` chooses the least-cost subset with a minimum Hamming separation between every pair of fault signatures **and the no-fault signature**. `compatible_faults` preserves ambiguity and unknown observations. `next_probe` chooses a remaining check by uniform-prior information gain per unit cost. There is no authority or side effect.

Run: `python3 -m unittest experiments.scode_lab.test_design -v`.

Assumptions currently required: one fault at a time; stable/noiseless binary checks; trusted witness specification; fixed costs; a complete known fault set; at most 16 candidate witnesses; equal prior probabilities for the probe heuristic. Correlated witnesses, simultaneous faults, false positives, model-dependent drift, inferred causal labels, and witness-design expense are **not modeled**. Hamming distance in this toy matrix is not a proof of error correction in real agent behavior.

**Research next step:** seed 8–12 fault types across reproducible agent tasks, learn witness sensitivity and specificity on development cases, freeze a hidden test, and compare with post-hoc dependency tracing and an LLM judge at matched observation and cost budgets. Report localization accuracy, ambiguity, false localization, calls, latency and privacy. If witness signatures do not transfer, this lab does not justify a product system.

Prior-art anchors: [GraphTracer](https://arxiv.org/abs/2510.10581), [AgenTracer](https://arxiv.org/abs/2509.03312), [AgentDiagnose](https://aclanthology.org/2025.emnlp-demos.15/), [ProxySPEX](https://arxiv.org/abs/2505.17495), [CaMeL](https://arxiv.org/abs/2503.18813), and classical [active fault diagnosis](https://arxiv.org/abs/1202.3701). Pre-run witness design for AI obligations is a hypothesis to test against these and other prior art, not a first-in-world claim.
