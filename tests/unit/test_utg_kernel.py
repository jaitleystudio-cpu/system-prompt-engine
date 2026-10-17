"""
Unit and Adversarial Tests for Master Prompt 3:
Universal Theorem Graph & Epistemic Moat Kernel (UTG-M10).
"""

import hashlib
from pathlib import Path
import pytest

from spe_runtime.utg import (
    CANONICAL_WASM_SHA256,
    CopyPurityReport,
    Kleene4Value,
    SCapsule,
    UnverifiedTransitionError,
    UTGKernel,
)


def test_open_science_theorem_binding():
    """Law 1: Binds architectural directives to peer-reviewed preprints."""
    capsule = UTGKernel.get_capsule_by_topic("execution_state_ledger")
    assert isinstance(capsule, SCapsule)
    assert "arXiv:2603.09114" in capsule.identifier
    assert "Chaudhary et al." in capsule.authors
    assert len(capsule.empirical_theorem) > 30
    assert len(capsule.operational_invariant) > 20

    # Prompt card representation (~200 token card)
    card = capsule.to_prompt_card()
    assert "### 🧬 S-CAPSULE:" in card
    assert capsule.identifier in card
    assert capsule.operational_invariant in card

    # JSON-LD evidence passport receipt
    receipt = capsule.to_jsonld_receipt(test_execution_hash="deadbeef1234")
    assert receipt["@type"] == "EmpiricalTheoremBinding"
    assert receipt["identifier"] == capsule.identifier
    assert receipt["testExecutionHash"] == "deadbeef1234"


def test_open_science_capsule_fallback_default():
    """Law 1: Unknown topic gracefully resolves to foundational capsule."""
    capsule = UTGKernel.get_capsule_by_topic("nonexistent_exotic_topic_999")
    assert isinstance(capsule, SCapsule)
    assert capsule.paper_title != ""


def test_kleene4_monotone_join_algebra():
    """Law 2: Monotone join lattice L_4 = {TRUE, FALSE, UNKNOWN, CONTRADICTION}."""
    # Identity
    assert UTGKernel.kleene4_join(Kleene4Value.UNKNOWN, Kleene4Value.UNKNOWN) == Kleene4Value.UNKNOWN
    assert UTGKernel.kleene4_join(Kleene4Value.TRUE, Kleene4Value.TRUE) == Kleene4Value.TRUE
    assert UTGKernel.kleene4_join(Kleene4Value.FALSE, Kleene4Value.FALSE) == Kleene4Value.FALSE

    # UNKNOWN is the bottom element: UNKNOWN \sqcup x = x
    assert UTGKernel.kleene4_join(Kleene4Value.UNKNOWN, Kleene4Value.TRUE) == Kleene4Value.TRUE
    assert UTGKernel.kleene4_join(Kleene4Value.UNKNOWN, Kleene4Value.FALSE) == Kleene4Value.FALSE
    assert UTGKernel.kleene4_join(Kleene4Value.TRUE, Kleene4Value.UNKNOWN) == Kleene4Value.TRUE
    assert UTGKernel.kleene4_join(Kleene4Value.FALSE, Kleene4Value.UNKNOWN) == Kleene4Value.FALSE

    # Mutual conflict produces CONTRADICTION (top element)
    assert UTGKernel.kleene4_join(Kleene4Value.TRUE, Kleene4Value.FALSE) == Kleene4Value.CONTRADICTION
    assert UTGKernel.kleene4_join(Kleene4Value.FALSE, Kleene4Value.TRUE) == Kleene4Value.CONTRADICTION

    # CONTRADICTION is absorbing
    assert UTGKernel.kleene4_join(Kleene4Value.CONTRADICTION, Kleene4Value.TRUE) == Kleene4Value.CONTRADICTION
    assert UTGKernel.kleene4_join(Kleene4Value.CONTRADICTION, Kleene4Value.UNKNOWN) == Kleene4Value.CONTRADICTION


def test_kleene4_unverified_transition_gate():
    """Law 2: UNKNOWN cannot be coerced to TRUE without an immutable witness artifact."""
    # Transition without witness raises UnverifiedTransitionError
    with pytest.raises(UnverifiedTransitionError) as exc_info:
        UTGKernel.assert_valid_lattice_transition(
            current_state=Kleene4Value.UNKNOWN,
            target_state=Kleene4Value.TRUE,
            witness_artifact=None,
        )
    assert "Kleene-4 Invariant Violation" in str(exc_info.value)

    # Empty string witness also raises
    with pytest.raises(UnverifiedTransitionError):
        UTGKernel.assert_valid_lattice_transition(
            current_state=Kleene4Value.UNKNOWN,
            target_state=Kleene4Value.TRUE,
            witness_artifact="",
        )

    # Transition with tangible witness succeeds
    assert UTGKernel.assert_valid_lattice_transition(
        current_state=Kleene4Value.UNKNOWN,
        target_state=Kleene4Value.TRUE,
        witness_artifact="sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ) is True

    # Transition to FALSE or remaining UNKNOWN does not require witness
    assert UTGKernel.assert_valid_lattice_transition(
        current_state=Kleene4Value.UNKNOWN,
        target_state=Kleene4Value.FALSE,
    ) is True


def test_wilson_lower_bound_with_small_n_penalty():
    """Law 3: Wilson 95% lower bound penalizes small sample sizes (n < 30)."""
    # 0 trials edge case
    assert UTGKernel.compute_wilson_lower_bound(successes=0, trials=0) == 0.0

    # Invalid input bounds check
    with pytest.raises(ValueError):
        UTGKernel.compute_wilson_lower_bound(successes=15, trials=10)

    # Perfect 5/5 score with small n (5 < 30) receives heavy penalty (5/30 = 1/6)
    w_small = UTGKernel.compute_wilson_lower_bound(successes=5, trials=5, penalty_small_n=True)
    # Without penalty, 5/5 has lower bound ~0.5655; with penalty ~0.5655 * (5/30) = ~0.094
    assert w_small < 0.20

    # 100/100 score with large n (100 >= 30) receives zero sample penalty
    w_large = UTGKernel.compute_wilson_lower_bound(successes=100, trials=100, penalty_small_n=True)
    assert w_large > 0.95

    # Verification that unpenalized 5/5 is much higher than penalized
    w_unpenalized = UTGKernel.compute_wilson_lower_bound(successes=5, trials=5, penalty_small_n=False)
    assert w_unpenalized > w_small


def test_canonical_wasm_freeze_verification():
    """Law 4: Canonical WASM Bytecode Freeze matches pinned immutable SHA-256."""
    assert CANONICAL_WASM_SHA256 == "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d"

    # Non-existent file returns False
    assert UTGKernel.verify_canonical_wasm_freeze("/non/existent/wasm/module.wasm") is False

    # Tampered bytes returns False
    tampered_bytes = b"\x00asm\x01\x00\x00\x00tampered"
    assert UTGKernel.verify_canonical_wasm_freeze(tampered_bytes) is False

    # Check repository canonical wasm if present
    repo_wasm = Path(__file__).resolve().parent.parent.parent / "portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm"
    if repo_wasm.exists():
        assert UTGKernel.verify_canonical_wasm_freeze(repo_wasm) is True


def test_copy_purity_gate():
    """Law 5: Zero-Hype Copy Purity checks for unreviewed marketing strings."""
    # Factual engineering statement passes
    factual_text = "The AST kernel enforces Kleene-4 lattice verification with zero ambient network access."
    rep_clean = UTGKernel.verify_copy_purity(factual_text)
    assert isinstance(rep_clean, CopyPurityReport)
    assert rep_clean.is_pure is True
    assert len(rep_clean.violations) == 0

    # Hype strings are detected and flagged
    hype_text = "This revolutionary tool is a complete game changer and a silver bullet for engineers."
    rep_hype = UTGKernel.verify_copy_purity(hype_text)
    assert rep_hype.is_pure is False
    assert len(rep_hype.violations) >= 3
    assert any("game changer" in v for v in rep_hype.violations)
    assert any("revolutionary" in v for v in rep_hype.violations)
    assert any("silver bullet" in v for v in rep_hype.violations)


def test_kleene4_string_type_coercion():
    """Verify string inputs are accepted and normalized in kleene4_join and assert_valid_lattice_transition."""
    assert UTGKernel.kleene4_join("unknown", "true") == Kleene4Value.TRUE
    assert UTGKernel.kleene4_join("TRUE", "false") == Kleene4Value.CONTRADICTION
    assert UTGKernel.kleene4_join("contradiction", "unknown") == Kleene4Value.CONTRADICTION

    # Transition with string states
    with pytest.raises(UnverifiedTransitionError):
        UTGKernel.assert_valid_lattice_transition("unknown", "true", witness_artifact=None)

    assert UTGKernel.assert_valid_lattice_transition("unknown", "true", witness_artifact="sha256:abc") is True
    assert UTGKernel.assert_valid_lattice_transition("UNKNOWN", "FALSE") is True

