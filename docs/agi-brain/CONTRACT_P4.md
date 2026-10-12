# P4 — Preregistered contract: long-document quality with a free local model

FROZEN before the full runs (a 2,400-word SPE pilot in /tmp was run only to smoke-test plumbing; it is not evidence). ₹0: local Ollama only.
Prior art: DeepWriter (Wang et al., AAAI-26, doi 10.1609/aaai.v40i39.40648) — planning-then-generation for >100k-word books; DeepWriter-Bench / BookScore (coherence, richness, factual grounding). The DeepWriter-Bench data/rubric was **not obtained** here; we borrow only its dimension names (coherence, factual grounding) and do not compute BookScore.

## Model and settings
Generator `qwen2.5:1.5b` (digest 65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b, Q4_K_M); embeddings `nomic-embed-text:latest` (0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f). Ollama at 127.0.0.1:11435. Options: temperature 0.7, top_p 0.9, seed 20261012, num_ctx 4096, repeat_penalty 1.1.

## Arms (same model, options, instruction, corpus, word target 100,000)
- **SPE**: `p4_ollama.py spe` — `longdoc.LongDocJob` + `OllamaGenerator`: 16 LLM-generated chapters × 10 sections, per-section BM25 retrieval (top-3 corpus chunks), fixed acronym glossary from the corpus, previous-section tail, continuation-to-target, sentence-boundary trim, claim manifest (numeric claims "verified" only when all numbers occur in a retrieved chunk).
- **Baseline**: `p4_ollama.py baseline` — single-pass naive continuation: corpus excerpt + instruction, then repeated "continue" with the last 1,200 words, 900 tokens per call, until 100,000 words (truncated to exactly the target).
If 100k is not reached in reasonable time, the actual length and throughput are reported; nothing is padded.

## Source corpus
The 9 files listed in `p4_ollama.CORPUS_FILES` (≈6.3k words), sha256 recorded in each run JSON.

## Metrics (`metrics_p4.py`, independent of the generator; computed identically for both arms)
1. **Factual grounding**: claim = sentence with a digit. Grounded if all its numbers occur in one corpus chunk AND ≥30% of its content words occur in that chunk. Report grounded_rate and claim count.
2. **Cross-chapter consistency**: acronym expansions "Words (ACR)": internal contradictions (acronym with ≥2 distinct expansions) and contradictions vs the corpus's expansion.
3. **Repetition**: mean distinct-4 per unit; repeated 8-gram rate; near-duplicate paragraph pairs (nomic cosine ≥ 0.95) per 100 paragraphs.
4. **Coherence**: mean cosine of adjacent paragraphs (local coherence); SPE only: section-title adherence.
Units: SPE sections; baseline split into the same number of equal-length pseudo-sections. 95% CIs for SPE−baseline by independent bootstrap over units (2,000 resamples, seed 7).

## Hypotheses (directional, one document per arm ⇒ descriptive, not generalisable)
P4-H1 grounded_rate SPE > baseline (CI excludes 0). P4-H2 fewer acronym contradictions. P4-H3 distinct-4 higher / repeated-8gram lower / fewer near-dups. P4-H4 adjacent coherence not lower by more than 0.02.
Human readability: **BLOCKED** (no human raters). No quality claim beyond these automated metrics.
