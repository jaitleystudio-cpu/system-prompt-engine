# S-CODE diagnostic witness lab

**Research prototype only.** This does not run inside SPE's product, verify an AI answer, prove fault localization in agents, or qualify the October 10 release.

Given a declared set of mutually exclusive fault classes and manually specified binary witness responses, `compile_witnesses` chooses the least-cost subset with a minimum Hamming separation between every pair of fault signatures **and the no-fault signature**. `compatible_faults` preserves ambiguity and unknown observations. `next_probe` chooses a remaining check by uniform-prior information gain per unit cost. There is no authority or side effect.

Run: `python3 -m unittest experiments.scode_lab.test_design -v`.

Assumptions currently required: one fault at a time; stable/noiseless binary checks; trusted witness specification; fixed costs; a complete known fault set; at most 16 candidate witnesses; equal prior probabilities for the probe heuristic. Correlated witnesses, simultaneous faults, false positives, model-dependent drift, inferred causal labels, and witness-design expense are **not modeled**. Hamming distance in this toy matrix is not a proof of error correction in real agent behavior.

**Research next step:** seed 8–12 fault types across reproducible agent tasks, learn witness sensitivity and specificity on development cases, freeze a hidden test, and compare at matched observation and cost budgets with fixed checks, minimal-cost observation selection, an AAS-style obligation-coverage and scheduling baseline where applicable, post-hoc dependency tracing, and an LLM judge. Report localization accuracy, ambiguity, false localization, calls, latency and privacy. If witness signatures do not transfer, this lab does not justify a product system.

Prior-art anchors: [GraphTracer](https://arxiv.org/abs/2510.10581), [AgenTracer](https://arxiv.org/abs/2509.03312), [AgentDiagnose](https://aclanthology.org/2025.emnlp-demos.15/), [ProxySPEX](https://arxiv.org/abs/2505.17495), [CaMeL](https://arxiv.org/abs/2503.18813), [Assurance-Aware Semantic Scheduling](https://arxiv.org/html/2609.34376v1), [minimal-cost offline diagnosability](https://arxiv.org/abs/cs/0607037), [sensor placement for online fault diagnosis](https://arxiv.org/abs/2211.11741), and classical [active fault diagnosis](https://arxiv.org/abs/1202.3701). Pre-action evidence selection and economical diagnostic observation sets already exist. The narrower behavioral-intent fault-separability application is a hypothesis to test, not a first-in-world claim.
