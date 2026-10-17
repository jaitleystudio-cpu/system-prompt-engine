# SPE Ω PRO — Scientific Discovery Engine (RGD-1: Reality-Grounded Discovery)
**Frontier Research & Invention Architecture Specification | October 12, 2026**
**Research Designation**: SPE Ω RGD-1 | **Product**: SPE Pro | **Status**: Approved Research Quarantine Track

---

## 1. Executive Vision: From Prompt Engine to Scientific Discovery Engine

Modern AI research assistants generally begin with a user query and attempt to generate a literature review or plausible answer. **SPE Ω PRO (RGD-1: Reality-Grounded Discovery)** transforms SPE from an inference and prompt optimization engine into an autonomous scientific discovery engine capable of tackling challenges that previously required an entire scientific research team:
* Searching vast global literature across 400M+ scholarly records.
* Discovering overlooked cross-disciplinary connections and contradictions.
* Creating mathematically and physically grounded hypotheses.
* Challenging its own conclusions through counterfactual boundary testing.
* Designing and executing discriminating experiments.
* Compounding reusable verified capabilities across investigations.

### The Three Epistemic Demarcations
To prevent ungrounded hype and ensure scientific integrity, SPE Ω enforces three strict demarcations:
1. **400M+ Searchable Scholarly Records**: Feasible via federated open scholarly infrastructure (OpenAlex 320M curated core + 190M expansion catalog = 510M+ records). Access levels must be rigorously distinguished: *Metadata*, *Abstract*, and *Authorized Full Text*. Catalog scale is not full-text redistribution.
2. **Citation-Backed Speed Classes**: Fast retrieval is delivered in seconds, but retrieval speed is never conflated with exhaustive scientific investigation. Three performance classes are isolated:
   - **Instant Discovery** (1–3 seconds): Ranked records, source metadata, preliminary concept graph.
   - **Evidence Answer** (5–15 seconds): Grounded claim synthesis with resolved DOIs and explicit limitation notes.
   - **Deep Discovery** (Minutes to Hours): Full contradiction analysis, counterfactual experiment selection, computational simulation, and verified proof certificates.
3. **200× Productivity Ambition & AGI**: SPE explicitly rejects arbitrary "200× more intelligent" slogans. Instead, 200× is formulated as an independently measurable stretch target: **200× verified extraction throughput on defined structured research workflows** relative to an experienced human baseline, subject to strict quality and evidence preservation gates.

---

## 2. Global Scholarly Knowledge Reconstruction (400M+ Records)

Searching 400M+ records is merely the entry gate. The central challenge is reconstructing unstructured manuscripts into a queryable, standardized **Evidence Graph**.

### Access Level Invariants
Every paper is tagged with its legal and physical access level:
* `METADATA`: Bibliographic citation, authors, venue, publication date, DOI, topic taxonomy.
* `ABSTRACT`: Synthesized summary, stated objective, high-level conclusion.
* `FULL_TEXT`: Authorized open-access or licensed full body text including methods, tables, and supplementary data.

### 11-Field Standardized Evidence Structure
SPE extracts an immutable 11-field schema from every qualified study:
1. **Research Question**: The precise question investigated.
2. **Hypothesis**: The formal proposition tested by the authors.
3. **Method**: The experimental, observational, or computational protocol.
4. **Population or Material**: The exact biological, physical, synthetic, or algorithmic subjects.
5. **Intervention or Mechanism**: The specific causal variables manipulated or observed.
6. **Results**: The measured outcome values.
7. **Statistical Evidence**: Effect sizes, confidence intervals, $p$-values, Bayes factors, and uncertainty bounds.
8. **Limitations**: Methodological bounds, confounding factors, and non-generalizable domains.
9. **Reproducibility**: Availability of raw data, analysis code, Docker containers, or replication artifacts.
10. **Provenance**: Exact DOI/PMID, version, page, and paragraph/figure citation coordinates.
11. **Scientific Relationship**: Categorized as `SUPPORT`, `CONTRADICTION`, or `UNKNOWN` relative to adjacent nodes.

```
       ┌────────────────────────────────────────────────────────┐
       │             GLOBAL SCHOLARLY CATALOG (400M+)            │
       │    OpenAlex Core (320M) + Expansion Records (190M)     │
       └───────────────────────────┬────────────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
           [METADATA]          [ABSTRACT]         [FULL_TEXT]
               │                   │                   │
               └───────────────────┼───────────────────┘
                                   ▼
                    11-FIELD EVIDENCE EXTRACTION
               (Question, Method, Population, Mechanism,
                Results, Stats, Limitations, Provenance...)
                                   │
                                   ▼
                      QUERYABLE EVIDENCE GRAPH
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
               [SUPPORT]    [CONTRADICTION]    [UNKNOWN]
```

---

## 3. Counterfactual Discovery Compilation (RGD-1 Core Method)

When the scientific literature contains competing explanations for an observed phenomenon:
* **Theory A**: The effect is driven by Mechanism $X$.
* **Theory B**: The effect is driven by Mechanism $Y$.
* **Theory C**: The effect is an artifact of the measurement instrument or sampling bias.

Rather than merely summarizing the competing views, the **Counterfactual Discovery Compiler** asks:
> *What is the minimal, cheapest, and fastest set of experiments that definitively discriminates between these theories?*

### Mathematical Objective Function
For each candidate discriminating experiment $e$, SPE computes its Value of Information (VOI) score $U(e)$:

$$U(e) = \frac{\mathbb{E}[\Delta R(e)]}{C(e) + \lambda T(e)}$$

Where:
* $\Delta R(e) \in [0.0, 1.0]$: The expected reduction in decision-relevant scientific uncertainty (entropy over competing theory probabilities).
* $C(e) \in \mathbb{Z}^+$: The expected monetary and compute execution cost in exact integer **NanoUSD** ($10^9 \text{ nanos} = \$1.00 \text{ USD}$).
* $T(e) \in \mathbb{R}^+$: The expected experiment duration in seconds.
* $\lambda \in \mathbb{R}^+$: The user or project latency-sensitivity penalty ($\text{nanos}/\text{sec}$).

The compiler identifies the Pareto-optimal discriminating experiment set $\mathcal{E}^*$ that minimizes total cost $\sum_{e \in \mathcal{E}^*} C(e)$ while driving posterior uncertainty below a targeted threshold $\epsilon$.

---

## 4. Research Verification Certificate (RVC) & Truth Conservation

Every consequential claim produced by SPE Ω Pro carries a cryptographic **Research Verification Certificate (RVC)** sealed with a SHA-256 hash.

### 10-Field Certificate Schema
1. `claim`: Precise scientific proposition and claimed domain scope.
2. `source_identity`: Verified DOI, PMID, arXiv ID, or repository identifier.
3. `evidence_location`: Exact passage, table, figure, or code citation.
4. `evidence_relationship`: `SUPPORT`, `CONTRADICTION`, or `UNKNOWN`.
5. `methodology_check`: Verification that the methodology justifies the stated causal inference.
6. `statistical_check`: Verification of reported numerical metrics, effect sizes, and uncertainty.
7. `reproduction_state`: Independent replication status (`REPRODUCED`, `UNTESTED`, `FAILED`).
8. `contradictions`: Explicit enumeration of conflicting literature nodes.
9. `freshness_state`: Publication version, retraction status check, and date of last verification.
10. `qualification`: Verification verdict.

### The Truth Conservation Invariant
Four immutable qualification verdicts are permitted:
* `SUPPORTED_WITHIN_TESTED_SCOPE`
* `CONTRADICTED`
* `INCONCLUSIVE`
* `NOT_VERIFIED`

> **Law of Truth Conservation**:
> Under no circumstance may an unverified hypothesis or claim tagged `NOT_VERIFIED` or `INCONCLUSIVE` be promoted to `SUPPORTED_WITHIN_TESTED_SCOPE` through repeated self-assessment, semantic rephrasing, or model agreement. Promotion requires authentic independent empirical data, formal proof, or direct evidence witness.

---

## 5. Compounding Research Capabilities Lifecycle

SPE Ω Pro preserves and expands knowledge across research missions without requiring unconstrained self-rewriting. Knowledge compounds along a verified trajectory:

$$\text{Research} \longrightarrow \text{Evidence} \longrightarrow \text{Validated Procedure} \longrightarrow \text{Transfer Gate} \longrightarrow \text{Reusable Capability}$$

### Integration with Existing SPE Systems
* **WDIC (Witness-Directed Intent Compilation)**: Compiles successful experimental protocols and evaluation pipelines into parameterized, executable capability modules.
* **CSC (Counterfactual Specification Closure)**: Subject compiled capabilities to adversarial boundary probes, hunting for latent failure modes.
* **LVT (Learning Validity Transactions)**: Verifies that the capability transfers to held-out, unseen domains and alternative foundation models before granting certification.
* **EGAC (Evidence-Gated Adaptive Compute)**: Optimizes execution cost in exact NanoUSD, determining when reuse of a pre-compiled capability beats running full discovery from scratch.

### Automatic Assumption Invalidation
A capability does not remain valid indefinitely. If underlying benchmark data, external library APIs, model weights, or empirical assumptions change, the capability is automatically flagged `INVALIDATED` or downgraded to `REQUIRES_REQUALIFICATION`.

---

## 6. Persistent 100,000-Word Deep Research Job Architecture

Complex discovery missions (such as complete patent drafts, pharmaceutical landscape monographs, or materials synthesis blueprints) require up to 100,000 words of rigorous prose without truncation.

### The Deep Research Job Protocol
Instead of attempting a single, impossible 100k-token LLM generation:
1. **Single User Job Contract**: The user submits one research mission and receives one unified, validated manuscript.
2. **Canonical Outline & State Checkpointer**: Research progresses through structured chapters and sections tracked in persistent state.
3. **Shared Terminology & Symbol Registry**: A global symbol table ensures that variables, units, equations, and definitions remain mathematically consistent across 100,000 words.
4. **Active Reference Registry**: Source DOIs and evidence nodes are registered once and indexed throughout chapters.
5. **Cross-Chapter Consistency Engine**: Forward and backward invariants ensure section transitions and data tables do not contradict prior chapters.
6. **Zero-Truncation Guarantee**: SPE never truncates legitimate long-form outputs to arbitrary 2,048-token windows.

---

## 7. The 12 Scientific Hypotheses & Evaluation Program

SPE Ω Pro's architecture is guided by 12 formal research hypotheses:

| ID | Hypothesis | Evaluation Benchmark | Priority |
|---|---|---|---|
| **R01** | Claim-aware retrieval outperforms naive vector passage similarity | SciFact-Open | High |
| **R02** | Contradiction-aware evidence graphs reduce false consensus bias | ResearcherBench | High |
| **R03** | **Decision-reversal search retrieves more consequential evidence per query** | Held-Out Conflicting Corpus | **Top Priority** |
| **R04** | Explicit 11-field scientific representations reduce invalid causal inferences | AstaBench | Medium |
| **R05** | **Counterfactual experiment planning maximizes information gain per dollar** | BoxingGym | **Top Priority** |
| **R06** | Parallel hypothesis generation increases validated originality | InnoGym | High |
| **R07** | Research Verification Certificates eliminate phantom citations | ScientistOne Suite | High |
| **R08** | Reusable research procedures reduce subsequent task cost by $\ge 40\%$ | SPE Transfer Suite | High |
| **R09** | **LVT transfer gates prevent false self-improvement on held-out tasks** | LVT 4-Arm Trials | **Top Priority** |
| **R10** | Adaptive compute allocation improves verified outcomes per dollar (VSOD) | EGAC Benchmark | High |
| **R11** | Literature freshness tracking prevents adoption of retracted findings | RetractionWatch Replay | Medium |
| **R12** | Integrated RGD-1 pipeline improves end-to-end scientific task completion | AstaBench End-to-End | High |

---

## 8. Implementation Roadmap (R0 through R8)

* **R0**: Freeze benchmark definitions, baseline models, and evaluation harnesses.
* **R1**: Build 400M+ scholarly catalog interface with 3 access levels (`METADATA`, `ABSTRACT`, `FULL_TEXT`).
* **R2**: Construct 11-field Structured Evidence extractor and Evidence Graph with contradiction mapping.
* **R3**: Implement Counterfactual Discovery Compiler with exact integer NanoUSD VOI metric $U(e)$.
* **R4**: Build Research Verification Certificate (RVC) generator with SHA-256 seal and Truth Conservation.
* **R5**: Integrate compounding research lifecycle with WDIC, CSC, LVT, and EGAC.
* **R6**: Build persistent 100k-word deep research job coordinator with cross-chapter consistency.
* **R7**: Deploy Universal Web Studio UI with 400M+ Explorer, Evidence Graph, and Certificate Viewer.
* **R8**: Execute full adversarial test battery and verify zero air-gap egress and exact NanoUSD arithmetic.
