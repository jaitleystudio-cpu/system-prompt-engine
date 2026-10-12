# LVT-3 Prior-Art Check (citation existence)

Date: 2026-10-12 (IST). Method: WebFetch of the arXiv abstract/HTML page (or official page) for each citation in the owner brief "SPE Ω — Verified Discovery & Capability Evolution". VERIFIED = page resolved and title/content matches the claim attributed in the brief. This is an existence + claim-match check only, NOT an exhaustive novelty search.

| # | Citation in brief | Source fetched | Resolved title / authors | Brief's claim matches? | Status |
|---|---|---|---|---|---|
| 1 | Darwin Gödel Machine (2025) | arxiv.org/abs/2505.22954 | "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents" — Zhang, Hu, Lu, Lange, Clune | Yes: SWE-bench 20.0% → 50.0%, Polyglot 14.2% → 30.7% | VERIFIED |
| 2 | SIGIL (Jul 2026) | arxiv.org/abs/2607.27309 | "SIGIL: Skill Compilation for Reliable and Efficient Agent Execution" — Dantanarayana, Kashmira, Tang, Mars (U. Michigan) | Yes: adherence up to 100% vs 26.2–54.0%; tokens −21–45% for 3 of 4 models | VERIFIED |
| 3 | AUTO: The AGI Compiler (Jul 2026) | arxiv.org/abs/2607.04542 | "Auto: The AGI Compiler" — J. Jaber, O. Jaber (RightNow AI) | Yes: 6.4× end-to-end; loose guard silently mislabels 48.9% (applicability-guard failure) | VERIFIED |
| 4 | SpecBench (May 2026) | arxiv.org/abs/2605.21384 | "SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents" — Zhao, Srikanth, Wu, Jiang (Weco AI) | Yes: visible tests saturated while held-out compositional tests fail | VERIFIED |
| 5 | Reality Is the Final Verifier (Sep 2026) | arxiv.org/abs/2609.12039 | "Reality Is the Final Verifier: On Two Key Gaps in Agentic Software Engineering" — Krentsel, Agarwal, Cemri, Liu, …, Zaharia, Stoica (UC Berkeley) | Yes: requirement gap + model gap; §6.1 explicitly proposes "dynamic evaluator sequencing … reduce the most uncertainty per unit cost" (directly overlaps H12) | VERIFIED |
| 6 | arXiv 2606.26294 | arxiv.org/abs/2606.26294 | Red Queen Gödel Machine (RQGM): co-evolving agents and their evaluators, anchor-gated evaluator replacement with selective erasure | Exists. Directly overlaps H11 (joint qualification of solution + evaluator) | VERIFIED |
| 7 | AlphaEvolve blog | deepmind.google/discover/blog/alphaevolve-… (May 14 2025) | "AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms" | Yes: LLM + evolutionary search + automated evaluators | VERIFIED |
| 8 | FIRE-Bench, ICML 2026 (PMLR v306) | arXiv 2602.02905; icml.cc/virtual/2026/poster/61975; paper header text "Proceedings of the 43rd ICML, Seoul … PMLR 306, 2026" | "FIRE-Bench: Evaluating AI Agents on the Rediscovery of Scientific Insights" — Wang, Bai, Luo, et al. | Yes: strongest agents < 50 F1 | VERIFIED (via ICML page + paper header; proceedings.mlr.press v306 page itself not fetched) |
| 9 | NVIDIA NeMo Switchyard (Aug 2026) | not in the requested check list | — | — | NOT_CHECKED |

## Novelty implications (honest)
- H11 (jointly qualify solution + evaluator + transfer envelope) overlaps substantially with RQGM (#6: evaluator co-evolution gated on ground-truth anchors), AUTO (#3: conformal applicability guards + deopt + contract-gated emission) and SIGIL (#2). Classical roots: CEGIS, version spaces, explanation-based generalisation, SOAR chunking.
- H12 (choose the next experiment by expected reduction in consequential uncertainty) is classical active learning / query-by-committee / Bayesian experimental design, and #5 proposes it for evaluator sequencing.
- Therefore no novelty claim is made. At most, the specific *combination* tested here is a candidate for a systematic prior-art review, which has not been done.
