"""
Prior-Art Coverage Ledger & Scientific Lineage Registry (Hard Test & Original CWC-F12).
Grounds CWC-1 in foundational literature across experimental design, causality,
robust Bayesian design, trusted timestamping, and autonomous scientific rediscovery.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class PriorArtRecord:
    citation_id: str
    authors: str
    year: int
    title: str
    venue: str
    doi_or_url: str
    cwc_system_role: str
    falsification_contribution: str


PRIOR_ART_REGISTRY: Tuple[PriorArtRecord, ...] = (
    PriorArtRecord(
        citation_id="LINDLEY-1956",
        authors="Lindley, D.V.",
        year=1956,
        title="On a measure of the information provided by an experiment",
        venue="The Annals of Mathematical Statistics, 27(4): 986-1005",
        doi_or_url="https://doi.org/10.1214/aoms/1177728069",
        cwc_system_role="Mathematical foundation of Expected Information Gain (EIG) as expected reduction in Shannon entropy.",
        falsification_contribution="Established the information-theoretic value of experimental actions prior to observation.",
    ),
    PriorArtRecord(
        citation_id="PEARL-2009",
        authors="Pearl, J.",
        year=2009,
        title="Causality: Models, Reasoning, and Inference (2nd Edition)",
        venue="Cambridge University Press",
        doi_or_url="https://doi.org/10.1017/CBO9780511803161",
        cwc_system_role="Interventional calculus do(x) discriminating observationally equivalent causal DAGs and structural mechanisms.",
        falsification_contribution="Defines non-interventional observational equivalence and proves necessity of active interventions.",
    ),
    PriorArtRecord(
        citation_id="GO-ISAAC-2022",
        authors="Go, A. and Isaac, R.",
        year=2022,
        title="Robust Expected Information Gain",
        venue="Proceedings of Machine Learning Research (PMLR), 180: 785-795",
        doi_or_url="https://proceedings.mlr.press/v180/go22a.html",
        cwc_system_role="Ambiguity sets and worst-case Robust Expected Information Gain (REIG) preventing prior sensitivity reversal.",
        falsification_contribution="Protects against experiment ranking reversal under misspecified or subjective Bayesian priors.",
    ),
    PriorArtRecord(
        citation_id="RFC-3161",
        authors="Adams, C., Cain, P., Pinkas, D., and Zuccherato, R.",
        year=2001,
        title="Internet X.509 Public Key Infrastructure Time-Stamp Protocol (TSP)",
        venue="IETF RFC 3161",
        doi_or_url="https://www.rfc-editor.org/rfc/rfc3161.html",
        cwc_system_role="Formal requirements for authentic chronological tokens, tamper-evident hash chaining, and defined trust boundaries.",
        falsification_contribution="Prevents post-observation backdating attacks via local append-only hash chains with replay protection.",
    ),
    PriorArtRecord(
        citation_id="NIST-ARIA-2026",
        authors="National Institute of Standards and Technology (NIST)",
        year=2026,
        title="ARIA Evaluation Planning Manual: Elements of ARIA-Style AI Evaluations",
        venue="NIST ARIA Program Publications",
        doi_or_url="https://www.nist.gov/publications/aria-evaluation-planning-manual-elements-aria-style-ai-evaluations",
        cwc_system_role="Independent adversarial evaluation and cryptographic separation between proposer, custody, and adjudicator.",
        falsification_contribution="Eliminates evidence laundering where the same entity proposes, measures, and certifies discoveries.",
    ),
    PriorArtRecord(
        citation_id="EUREKABENCH-2026",
        authors="EurekaBench Collaboration",
        year=2026,
        title="EurekaBench: Evaluating Long-Horizon Explanatory Scientific Discovery in Autonomous Agents",
        venue="arXiv:2610.00492",
        doi_or_url="https://arxiv.org/abs/2610.00492",
        cwc_system_role="Scientific benchmarking standard testing genuine explanatory mechanisms over shallow predictive fluency.",
        falsification_contribution="Distinguishes high-accuracy curve fitting from underlying causal mechanism identification.",
    ),
    PriorArtRecord(
        citation_id="FIREBENCH-2026",
        authors="Wang, D. et al.",
        year=2026,
        title="FIRE-Bench: A Benchmark for Evaluating Frontier AI on Scientific Rediscovery",
        venue="Proceedings of Machine Learning Research (PMLR), 306: wang26d",
        doi_or_url="https://proceedings.mlr.press/v306/wang26d.html",
        cwc_system_role="Autonomous end-to-end scientific rediscovery through experimental planning, execution, and verification.",
        falsification_contribution="Exposes failure modes in closed-loop experimentation without hypothesis falsification.",
    ),
)


class PriorArtLedger:
    """Manages verified bibliographic prior art coverage for CWC-1."""

    @classmethod
    def get_prior_art_records(cls) -> Tuple[PriorArtRecord, ...]:
        return PRIOR_ART_REGISTRY

    @classmethod
    def verify_coverage(cls) -> Dict[str, Any]:
        """Verifies that all 7 required scientific lineages are tracked and covered."""
        records = cls.get_prior_art_records()
        citation_ids = [r.citation_id for r in records]
        required_citations = {
            "LINDLEY-1956",
            "PEARL-2009",
            "GO-ISAAC-2022",
            "RFC-3161",
            "NIST-ARIA-2026",
            "EUREKABENCH-2026",
            "FIREBENCH-2026",
        }
        missing = required_citations - set(citation_ids)
        return {
            "total_prior_art_records": len(records),
            "is_complete": len(missing) == 0,
            "missing_citations": list(missing),
            "citations_covered": citation_ids,
        }
