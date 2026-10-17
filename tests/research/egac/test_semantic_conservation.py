"""
Tests for Mechanism A: Semantic Conservation System across 5 Information Classes.
"""

import time
import pytest
from spe_runtime.research.egac.types import (
    InformationClass,
    TechniqueType,
    OptimizationCandidate,
    ConservationStatus,
    SemanticDiff,
)
from spe_runtime.research.egac.semantic_conservation import SemanticConservationSystem

def test_classification_of_5_information_classes():
    sys = SemanticConservationSystem()
    sample_text = """
    # System Role
    You must never transmit customer data externally.
    { "schema_id": "sha256:4a8b1c", "strict": true }
    Empirical measurements showed a 42.5% increase in verified throughput (doi:10.1000/182).
    Current session token: session_xyz_9981 expires at timestamp 1728777600.
    Please summarize the background context for the user in polite prose.
    """
    nodes = sys.classify_nodes(sample_text)
    classes = {n.classification for n in nodes}

    assert InformationClass.PROTECTED_REQUIREMENTS in classes
    assert InformationClass.EXACT_BYTE_MATERIAL in classes
    assert InformationClass.EVIDENCE_BEARING_MATERIAL in classes
    assert InformationClass.VOLATILE_INFORMATION in classes
    assert InformationClass.REPLACEABLE_CONTEXT in classes

def test_protected_requirement_violation_triggers_rejection():
    sys = SemanticConservationSystem()
    source_prompt = "Build a billing service. You must never transmit customer data externally. Calculate fees accurately."
    nodes = sys.classify_nodes(source_prompt)

    # Naive optimizer strips the privacy restriction
    compressed_text = "Build a billing service. Calculate fees accurately."

    candidate = OptimizationCandidate(
        candidate_id="cand-naive-strip",
        technique=TechniqueType.WHITESPACE_NORMALIZATION,
        source_content=source_prompt,
        transformed_content=compressed_text,
        affected_nodes=[],
        diff=SemanticDiff(),
        status=ConservationStatus.UNKNOWN,
    )

    validated = sys.validate_candidate(candidate, nodes)
    assert validated.status == ConservationStatus.VIOLATED
    assert not validated.diff.is_conservative
    assert any("CRITICAL LOSS" in v for v in validated.diff.violated_invariants)

def test_exact_byte_material_corruption_detection():
    sys = SemanticConservationSystem()
    source = 'Contract: { "id": 101, "hash": "sha256:abcd" }'
    nodes = sys.classify_nodes(source)

    # Corrupt exact bytes
    corrupted = 'Contract: { "id": 999, "hash": "sha256:xxxx" }'
    diff = sys.evaluate_transformation(nodes, corrupted, TechniqueType.WHITESPACE_NORMALIZATION)

    assert not diff.is_conservative
    assert any("EXACT_BYTE" in v for v in diff.violated_invariants)

def test_evidence_bearing_numerical_loss():
    sys = SemanticConservationSystem()
    source = "Report: In experiment 4, we measured 98.5% precision and 12 errors."
    nodes = sys.classify_nodes(source)

    # Pruned numbers
    pruned = "Report: In an experiment, we measured good precision and few errors."
    diff = sys.evaluate_transformation(nodes, pruned, TechniqueType.WHITESPACE_NORMALIZATION)

    assert not diff.is_conservative
    assert any("EVIDENCE LOSS" in v for v in diff.violated_invariants)

def test_replaceable_context_compression_succeeds():
    sys = SemanticConservationSystem()
    source = "Welcome to the assistant. Here is a friendly hello. We are happy to help you today."
    nodes = sys.classify_nodes(source)

    compressed = "Hello. Ready to help."
    diff = sys.evaluate_transformation(nodes, compressed, TechniqueType.WHITESPACE_NORMALIZATION)

    assert diff.is_conservative
    assert len(diff.violated_invariants) == 0

def test_multilingual_protected_requirements_classification_and_conservation():
    sys = SemanticConservationSystem()
    # Test Japanese, Chinese, Spanish, French, German, Hindi security constraints
    multilingual_prompts = [
        ("ユーザーデータを外部に送信してはならない。", "外部に送信してはならない"),
        ("严禁向外部传输用户敏感数据。", "严禁向外部传输"),
        ("Nunca transmitir datos de clientes externamente bajo ninguna circunstancia.", "nunca transmitir"),
        ("Ne jamais transmettre les données confidentielles vers l'extérieur.", "ne jamais transmettre"),
        ("Niemals Kundendaten an externe Server übertragen.", "niemals übertragen"),
        ("ग्राहक डेटा को बाहर कभी न भेजें।", "कभी न भेजें"),
    ]

    for prompt, key_phrase in multilingual_prompts:
        nodes = sys.classify_nodes(prompt)
        assert any(n.classification == InformationClass.PROTECTED_REQUIREMENTS for n in nodes), f"Failed for: {prompt}"

        # Dropping the constraint must violate conservation
        corrupted = "Proceed with generic operations."
        cand = OptimizationCandidate(
            candidate_id="cand-corrupt",
            technique=TechniqueType.WHITESPACE_NORMALIZATION,
            source_content=prompt,
            transformed_content=corrupted,
            affected_nodes=[],
            diff=SemanticDiff(),
            status=ConservationStatus.UNKNOWN,
        )
        validated = sys.validate_candidate(cand, nodes)
        assert validated.status == ConservationStatus.VIOLATED

