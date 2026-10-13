# P4 — Results: long-document quality, free local model (preregistered in CONTRACT_P4.md)

**Overall verdict: NOT_PROVEN.** Two hypotheses SUPPORTED (H1 grounding, H3 repetition), two REJECTED (H2 acronym consistency, H4 adjacent coherence). There is one document per arm, so these results describe these two documents only and don't generalize. Not a PASS. No independent replay yet (Bro replay pending).

## Provenance
- Contract, generator and metrics frozen at `5938903c` (pre-run). Code unchanged since then (`git diff 5938903c HEAD -- spe_runtime/research/agi_brain/` is empty).
- sha256: `metrics_p4.py` bc747381…f8a2, `p4_ollama.py` 083640fb…2f4f1c, `longdoc.py` dc67c0c8…5b0f.
- Generator `qwen2.5:1.5b` digest 65ec0654…c57b (Q4_K_M); embeddings `nomic-embed-text` digest 0a109f42…e59f; Ollama 127.0.0.1:11435; temp 0.7, top_p 0.9, seed 20261012, num_ctx 4096, repeat_penalty 1.1. Corpus sha256s (9 files) are in both run JSONs and they match.
- Scored artifacts: SPE `evidence/agi-brain/p4/spe/assembled_UNEXPORTED.md` sha256 c10104c2feaf8a0b055da41b4a3ade89eb0fd3fc91a47405c6f1bcea826cc634; baseline `evidence/agi-brain/p4/baseline/baseline.md` sha256 5b04693bcac6b563f7f0b93ef816eb3370e3edcf666486e8afca3e465fd97871.
- Metrics output `evidence/agi-brain/p4/metrics_p4.json` sha256 6715eaf2c77cd7696197afc4117e9e406cc788fb45672d85d02fb773774b8a20 (run 2026-10-13 on Prawins-Mac-mini.local, about 54 s wall).

## Length and throughput
| arm | stage | words | wall s | LLM calls | gen tokens | words/s | tok/s |
|---|---|---|---|---|---|---|---|
| SPE | `checks_failed` (not exported) | 105,069 section words (job check); 107,743 `wc -w` incl. headings | 3797.4 | 213 | 149,128 | 27.7 | 39.3 |
| baseline | `exported` | 100,000 (truncated to target) | 2925.2 | 147 | 126,724 | 34.2 | 43.3 |

**Deviation (disclosed):** the SPE run failed its own export gate only because its total is 105,069 words, which is +5.07% over the 100,000 target and outside the ±5% tolerance. We did not regenerate. We scored the unexported assembled document as produced, analogous to the contract's "report the actual length" clause. The SPE document is 7.7% longer than the baseline by `wc`.

## Metrics (frozen `metrics_p4.py`, identical for both arms)
| metric | SPE | baseline | SPE − baseline [bootstrap 95% CI, 2,000 resamples, seed 7] |
|---|---|---|---|
| numeric claims (sentences with a digit) | 1,043 | 300 | — |
| grounded claims | 190 | 25 | — |
| **grounded_rate** | 0.182 | 0.083 | **+0.099 [+0.042, +0.154]** |
| **distinct-4 mean per unit** | 0.972 | 0.511 | **+0.461 [+0.417, +0.502]** |
| repeated 8-gram rate | 0.037 | 0.799 | −0.762 (doc-level, no CI) |
| near-dup paragraph pairs (cos ≥ 0.95) | 5 | 14,730 | — |
| near-dups per 100 paragraphs | 0.67 | 1,766.2 | −1,765.5 (doc-level, no CI) |
| **adjacent coherence mean** | 0.724 | 0.890 | **−0.166 [−0.176, −0.157]** |
| acronym internal contradictions | 13 | 3 | +10 (doc-level, no CI) |
| acronym contradictions vs corpus | 0 | 1 (CSC → "continuous system composition") | −1 |
| title adherence (SPE only) | 0.612 | — | — |
| units / paragraphs scored | 199 / 751 | 199 / 834 | — |

## Hypotheses
- **P4-H1 (grounded_rate higher): SUPPORTED.** The CI excludes 0. The absolute level is still low: 82% of SPE numeric claims are not grounded under the metric.
- **P4-H2 (fewer acronym contradictions): REJECTED.** SPE has 13 internal contradictions vs 3 for the baseline (13+0 vs 3+1 in total). SPE is better only against the corpus (0 vs 1). Caveat: the frozen regex treats leading function words as part of the expansion (e.g. "the zero-cost product law" vs "zero-cost product law"), which inflates the counts. SPE also uses many more distinct acronyms, so it has more chances to contradict itself. Real contradictions still exist in SPE, e.g. CSC → "counterfactual intelligent compilation", ABI with 4 expansions, FAR → "false success rate". The verdict stands as measured.
- **P4-H3 (less repetition): SUPPORTED.** All three sub-metrics favor SPE by large margins. The baseline degenerated into loops: "zero-payment (ZPP)" alone appears more than 600 times.
- **P4-H4 (coherence not lower by > 0.02): REJECTED.** The measured gap is −0.166 and the whole CI lies below −0.02. Caveat: the baseline's high adjacent cosine is largely an artifact of its repetition loops, because near-identical adjacent windows score high. The paragraph units also differ by arm. The baseline has no blank lines, so the metric fell back to 120-word windows (834). SPE used real paragraphs (751). The code comment says "for both", but the fallback runs per document. The coherence CI resamples adjacent pairs, not sections. Even so, the verdict stands as preregistered.

## Limitations
- One document per arm and one seed, so the results are descriptive only.
- The SPE export gate failed: +5.07% length, scored unexported.
- The section split counts model-emitted `## ` headings inside section bodies. That gives 199 SPE units instead of the 160 planned sections, and the baseline was split into 199 pseudo-sections to match.
- Paragraph-unit asymmetry and acronym-regex artifacts, as described above.
- DeepWriter-Bench / BookScore was not computed.
- **Human readability: BLOCKED** (no human raters). We make no quality claim beyond these automated metrics.
- Builder = this run. Independent verification (Bro replay) is not done.

## Cost
₹0. Local Ollama on the Mac mini only, with no paid API or service.

## Replay
`python3 -m spe_runtime.research.agi_brain.metrics_p4 evidence/agi-brain/p4/spe/assembled_UNEXPORTED.md evidence/agi-brain/p4/baseline/baseline.md OUT.json` (needs Ollama with `nomic-embed-text` at `$SPE_OLLAMA`, default 127.0.0.1:11435). Compare against `metrics_p4.json`.
