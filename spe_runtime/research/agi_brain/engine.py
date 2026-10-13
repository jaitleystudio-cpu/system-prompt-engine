"""
SPE AGI BRAIN Ω — Master Scientific Engine Orchestrator
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, Any, List, Optional
from spe_runtime.research.agi_brain.types import (
    ScientificObjective,
    DomainType,
    InventionStrategy,
    VerificationStatus,
    ScientificPromptContract,
)
from spe_runtime.research.agi_brain.knowledge_reconstruction import KnowledgeReconstructionEngine
from spe_runtime.research.agi_brain.scientific_world_models import ScientificWorldModelEngine
from spe_runtime.research.agi_brain.scientific_imagination import ScientificImaginationEngine
from spe_runtime.research.agi_brain.experimental_verification import ExperimentalVerificationEngine
from spe_runtime.research.agi_brain.discovery_learning import DiscoveryLearningEngine
from spe_runtime.research.agi_brain.controlled_self_improvement import ControlledSelfImprovementEngine
from spe_runtime.research.agi_brain.objective import DiscoveryObjectiveCalculator
from spe_runtime.research.agi_brain.long_horizon_writer import LongHorizonWriterEngine
from spe_runtime.research.agi_brain.gilden_ops_bridge import GildenOpsBridge
from spe_runtime.research.agi_brain.prompt_contract import ScientificPromptContractCompiler

class SpeAgiBrain:
    """
    Central orchestration engine for SPE AGI BRAIN Ω.
    Unites Knowledge Reconstruction, World Modeling, 12 Invention Strategies,
    Formal Verification, Meta-Learning, 100k-word Generation, and Gilden Ops.
    """

    def __init__(self, spending_cap_nanos: int = 5_000_000_000):
        self.knowledge_engine = KnowledgeReconstructionEngine()
        self.world_model_engine = ScientificWorldModelEngine()
        self.imagination_engine = ScientificImaginationEngine()
        self.verification_engine = ExperimentalVerificationEngine()
        self.learning_engine = DiscoveryLearningEngine()
        self.self_improvement_engine = ControlledSelfImprovementEngine()
        self.objective_calculator = DiscoveryObjectiveCalculator()
        self.writer_engine = LongHorizonWriterEngine()
        self.gilden_bridge = GildenOpsBridge(spending_cap_nanos=spending_cap_nanos)
        self.contract_compiler = ScientificPromptContractCompiler()

    def run_discovery_session(
        self,
        objective: ScientificObjective,
        raw_claims: List[Dict[str, Any]],
        strategy: Optional[InventionStrategy] = None,
        lean_proof: Optional[str] = None,
        property_tests: Optional[List[bool]] = None,
        empirical_p_value: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Runs a complete end-to-end scientific discovery investigation."""
        # 1. Reconstruct Knowledge
        knowledge_state = self.knowledge_engine.reconstruct(objective, raw_claims)

        # 2. Select or generate candidate mechanism
        selected_strategy = strategy or self.learning_engine.get_top_strategy()
        candidate = self.imagination_engine.generate_candidate(
            selected_strategy, objective, knowledge_state
        )

        # 3. Create and test world model
        world_model = self.world_model_engine.create_model(
            model_id=f"wm-{candidate.candidate_id}",
            domain=objective.domain,
            executable_representation=candidate.mechanism,
            formal_lean_statement=lean_proof,
        )

        # 4. Mechanically verify candidate
        verification = self.verification_engine.verify_candidate(
            candidate=candidate,
            lean_proof_script=lean_proof,
            property_test_results=property_tests,
            empirical_p_value=empirical_p_value,
        )

        # 5. Update meta-learning policy
        self.learning_engine.record_investigation_outcome(selected_strategy, verification)

        # 6. Compile 6-part contract
        contract = self.contract_compiler.compile_contract(
            objective=objective,
            candidate=candidate,
            verification=verification,
        )

        return {
            "objective": objective,
            "knowledge_state": knowledge_state,
            "candidate": candidate,
            "world_model": world_model,
            "verification": verification,
            "contract": contract,
            "contract_markdown": self.contract_compiler.render_markdown(contract),
        }

    def generate_manuscript(
        self,
        title: str,
        target_words: int,
        chapter_titles: List[str],
    ) -> Dict[str, Any]:
        """Generates a structured long-horizon document up to and exceeding 100,000 words."""
        doc = self.writer_engine.plan_document(
            title=title, target_words=target_words, chapter_titles=chapter_titles
        )
        for ch in doc.chapters:
            for sec in ch.sections:
                self.writer_engine.generate_section_content(sec)
        return self.writer_engine.compile_final_document(doc)
