"""
SPE Ω PRO — Unified Reality-Grounded Discovery Engine (RGD-1 Orchestrator)
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
import time
from typing import Dict, List, Optional
from spe_runtime.research.rgd.types import (
    ResearchMission,
    ResponseSpeedClass,
    Rgd1Result,
    NANOS_PER_USD,
)
from spe_runtime.research.rgd.mission_compiler import compile_research_mission
from spe_runtime.research.rgd.knowledge_reconstruction import (
    ScholarlyCatalogInterface,
    extract_structured_evidence,
    build_evidence_graph,
)
from spe_runtime.research.rgd.counterfactual_compiler import (
    compile_competing_theories,
    generate_candidate_experiments,
    select_minimal_discriminating_set,
)
from spe_runtime.research.rgd.verification_certificate import (
    issue_verification_certificate,
    verify_certificate_integrity,
)
from spe_runtime.research.rgd.compounding_lifecycle import CompoundingCapabilityRegistry
from spe_runtime.research.rgd.deep_research_job import (
    create_deep_research_job,
    checkpoint_section,
    verify_cross_chapter_consistency,
    assemble_final_manuscript,
)


class SpeRgdEngine:
    """
    Unified SPE Ω Reality-Grounded Discovery (RGD-1) Engine.
    Coordinates the full scientific discovery workflow:
    Mission Compilation -> 400M+ Catalog Search -> 11-Field Evidence Extraction ->
    Evidence Graph -> Counterfactual VOI Optimization -> Verification Certificates ->
    Compounding Lifecycle -> 100k-Word Deep Research Manuscripts.
    """

    def __init__(
        self,
        catalog: Optional[ScholarlyCatalogInterface] = None,
        registry: Optional[CompoundingCapabilityRegistry] = None,
    ):
        self.catalog = catalog or ScholarlyCatalogInterface()
        self.registry = registry or CompoundingCapabilityRegistry()

    def execute_discovery(
        self,
        raw_prompt: str,
        domain: Optional[str] = None,
        speed_class: ResponseSpeedClass = ResponseSpeedClass.EVIDENCE_ANSWER,
        budget_nanos: int = 10_000_000_000,  # $10.00 USD
    ) -> Rgd1Result:
        """
        Executes a complete Reality-Grounded Discovery run under exact NanoUSD accounting.
        """
        t0 = time.time()

        # Step 1: Research Mission Compilation
        mission = compile_research_mission(
            raw_prompt=raw_prompt,
            domain=domain,
            speed_class=speed_class,
            budget_nanos=budget_nanos,
        )

        # Step 2: Global Scholarly Discovery across 400M+ catalog
        query_terms = mission.objective
        records = self.catalog.search(query=query_terms, domain=mission.target_domain, limit=10)
        if not records:
            # Fallback to domain search if query is specific
            records = self.catalog.search(query=mission.target_domain, limit=5)

        # Step 3: 11-Field Structured Evidence Extraction
        structured_evidences = [
            extract_structured_evidence(rec, target_hypothesis=mission.objective)
            for rec in records
        ]

        # Step 4: Queryable Evidence Graph Synthesis
        evidence_graph = build_evidence_graph(structured_evidences, central_claim=mission.objective)

        # Step 5: Check Compounding Lifecycle for Reusable Procedure
        reusable_proc = self.registry.find_valid_procedure_for_domain(mission.target_domain)
        compounding_id = reusable_proc.procedure_id if reusable_proc else None

        # Step 6: Counterfactual Discovery Compilation
        theories = compile_competing_theories(mission, evidence_graph)

        # Step 7: Candidate Discriminating Experiments & VOI Optimization
        all_experiments = generate_candidate_experiments(theories, mission)
        selected_experiments = select_minimal_discriminating_set(
            all_experiments,
            max_budget_nanos=budget_nanos,
            target_uncertainty_reduction=0.75,
        )

        # Step 8: Research Verification Certificates (RVC) with Truth Conservation
        certificates = []
        for rec, ev in zip(records, structured_evidences):
            # Collect known contradictions
            contradictions = [
                f"{other.provenance}: {other.results[:80]}"
                for other in structured_evidences
                if other.scientific_relationship.value == "CONTRADICTION" and other.evidence_id != ev.evidence_id
            ]
            cert = issue_verification_certificate(
                claim=f"Efficacy of {rec.title[:60]} in satisfying {mission.target_domain} constraints",
                record=rec,
                evidence=ev,
                contradictions=contradictions,
            )
            # Verify seal integrity
            assert verify_certificate_integrity(cert), "Certificate seal verification failed!"
            certificates.append(cert)

        elapsed_ms = int((time.time() - t0) * 1000)
        total_exp_cost_nanos = sum(e.expected_cost_nanos for e in selected_experiments)

        result_id = f"rgd_{hashlib.sha256((mission.mission_id + str(elapsed_ms)).encode('utf-8')).hexdigest()[:12]}"

        return Rgd1Result(
            result_id=result_id,
            mission=mission,
            records_scanned=len(records),
            structured_evidences=structured_evidences,
            evidence_graph=evidence_graph,
            competing_theories=theories,
            selected_experiments=selected_experiments,
            certificates=certificates,
            compounding_procedure_id=compounding_id,
            speed_class_achieved=speed_class,
            elapsed_ms=elapsed_ms,
            total_cost_nanos=total_exp_cost_nanos,
        )

    def start_deep_research_job(
        self,
        mission: ResearchMission,
        title: Optional[str] = None,
        target_total_words: int = 100_000,
    ) -> DeepResearchJob:
        return create_deep_research_job(
            mission=mission,
            title=title,
            target_total_words=target_total_words,
        )
