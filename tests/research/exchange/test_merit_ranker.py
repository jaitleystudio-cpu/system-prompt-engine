"""
Test suite for SPE Ω Merit Ranker & Evidence Passport Kernel (Master Prompt 1).
Verifies:
1. Wilson lower bound confidence interval math and uncertainty awareness (490/500 > 5/5).
2. 6-dimension evaluation weights and composite scoring.
3. Disqualifying security hard gate (unauthorized egress, credential exfil, prompt injection).
4. Zero capital influence (sponsored inventory isolation, zero rank weight).
5. Evidence Passport emission protocol.
"""

import pytest

from spe_runtime.research.exchange.merit_ranker import (
    compute_wilson_lower_bound,
    EvaluationDimensions,
    EvidencePassport,
    MeritRanker,
    MeritRankingResult,
    SecurityAudit,
    SecurityDisqualificationError,
)


def test_wilson_lower_bound_uncertainty_awareness():
    """
    Constitutional Law 4: UNCERTAINTY-AWARE WILSON SCORE.
    Ranking must never treat 5 passes out of 5 tests as superior to 490 passes out of 500 tests.
    """
    wilson_5_of_5 = compute_wilson_lower_bound(5, 5, z=1.96)
    wilson_490_of_500 = compute_wilson_lower_bound(490, 500, z=1.96)

    # 5/5 has high sample variance / low confidence: lower bound ~ 0.5655
    # 490/500 has high confidence: lower bound ~ 0.9636
    assert wilson_490_of_500 > wilson_5_of_5
    assert wilson_5_of_5 < 0.65
    assert wilson_490_of_500 > 0.95


def test_wilson_lower_bound_boundary_conditions():
    """Verifies edge cases: n=0, perfect score, zero score, invalid inputs."""
    assert compute_wilson_lower_bound(0, 0) == 0.0
    assert compute_wilson_lower_bound(0, -1) == 0.0

    # 0 out of 100
    w_zero = compute_wilson_lower_bound(0, 100)
    assert w_zero == 0.0

    # 100 out of 100
    w_perfect = compute_wilson_lower_bound(100, 100)
    assert 0.95 < w_perfect <= 1.0

    # Invalid bounds
    with pytest.raises(ValueError):
        compute_wilson_lower_bound(105, 100)

    with pytest.raises(ValueError):
        compute_wilson_lower_bound(-1, 100)


def test_evaluation_dimensions_weights_sum_to_one():
    """Verifies 6 dimensions sum exactly to 1.0 (100%)."""
    weights = EvaluationDimensions.WEIGHTS
    assert sum(weights.values()) == pytest.approx(1.0)
    assert weights["functional_task_success"] == 0.35
    assert weights["reliability_robustness"] == 0.20
    assert weights["verified_compatibility"] == 0.15
    assert weights["resource_token_efficiency"] == 0.10
    assert weights["maintenance_update_quality"] == 0.10
    assert weights["documentation_ergonomics"] == 0.10


def test_evaluation_dimensions_composite_calculation():
    """Verifies weighted composite score calculation."""
    dims = EvaluationDimensions(
        functional_task_success=1.0,
        reliability_robustness=1.0,
        verified_compatibility=1.0,
        resource_token_efficiency=1.0,
        maintenance_update_quality=1.0,
        documentation_ergonomics=1.0,
    )
    assert dims.compute_composite_score() == pytest.approx(1.0)

    dims_mixed = EvaluationDimensions(
        functional_task_success=0.80,  # 0.28
        reliability_robustness=0.90,   # 0.18
        verified_compatibility=0.70,   # 0.105
        resource_token_efficiency=0.60,# 0.06
        maintenance_update_quality=0.50,# 0.05
        documentation_ergonomics=0.50, # 0.05
    )
    expected = (0.80*0.35) + (0.90*0.20) + (0.70*0.15) + (0.60*0.10) + (0.50*0.10) + (0.50*0.10)
    assert dims_mixed.compute_composite_score() == pytest.approx(expected)


def test_security_hard_gate_disqualifications():
    """
    Constitutional Law 3: THE DISQUALIFYING HARD GATE.
    Critical vulnerabilities result in immediate REJECTION (DISQUALIFIED).
    High functional performance cannot compensate for a security violation.
    """
    # 1. Unauthorized network egress
    sec_egress = SecurityAudit(unauthorized_network_egress=True)
    is_disq, reasons = sec_egress.is_disqualified()
    assert is_disq is True
    assert any("egress" in r.lower() for r in reasons)

    # 2. Credential exfiltration
    sec_exfil = SecurityAudit(credential_exfiltration=True)
    is_disq, reasons = sec_exfil.is_disqualified()
    assert is_disq is True
    assert any("credential" in r.lower() for r in reasons)

    # 3. Ambient authority escalation
    sec_ambient = SecurityAudit(ambient_authority_escalation=True)
    is_disq, reasons = sec_ambient.is_disqualified()
    assert is_disq is True
    assert any("ambient" in r.lower() for r in reasons)

    # 4. Prompt injection detected
    sec_injection = SecurityAudit(prompt_injection_detected=True)
    is_disq, reasons = sec_injection.is_disqualified()
    assert is_disq is True
    assert any("prompt injection" in r.lower() for r in reasons)

    # 5. Static analysis failure
    sec_static = SecurityAudit(static_analysis="FAILED_RISK")
    is_disq, reasons = sec_static.is_disqualified()
    assert is_disq is True
    assert any("static analysis" in r.lower() for r in reasons)


def test_passport_generation_and_disqualification_immutability():
    """Verifies that high performance cannot compensate for security violations in Evidence Passports."""
    passport = MeritRanker.generate_evidence_passport(
        target_identifier="@skill/hostile-but-fast",
        version_digest="sha256:badcode123",
        trials_n=1000,
        successes=1000,  # 100% success rate!
        security_audit=SecurityAudit(
            unauthorized_network_egress=True,
            exfiltration_risk="DETECTED",
        ),
    )
    assert passport.validity_window.status == "DISQUALIFIED"
    assert passport.top_three_eligibility is False
    assert passport.composite_score == 0.0

    passport_dict = passport.to_dict()
    assert passport_dict["top_three_eligibility"] is False
    assert passport_dict["validity_window"]["status"] == "DISQUALIFIED"
    assert passport_dict["passport_id"].startswith("EVP-")


def test_zero_capital_influence_law():
    """
    Constitutional Law 2: ZERO RANKING INFLUENCE FROM CAPITAL.
    Sponsorship spend, install count, and marketing claims have ZERO weight on organic rank.
    Sponsored candidates are strictly isolated to labeled external inventory.
    """
    candidates = [
        # Candidate 1: High merit, $0 spend
        {
            "name": "@skill/merit-first",
            "trials_n": 200,
            "successes": 190,
            "is_sponsored": False,
            "sponsor_bid_usd": 0.0,
            "installation_count": 10,
        },
        # Candidate 2: High capital ($10,000 ad spend), 1M installs, but lower empirical score
        {
            "name": "@skill/billion-dollar-corp",
            "trials_n": 50,
            "successes": 40,
            "is_sponsored": True,
            "sponsor_bid_usd": 10000.0,
            "installation_count": 1000000,
        },
        # Candidate 3: Organic second
        {
            "name": "@skill/second-best",
            "trials_n": 150,
            "successes": 140,
            "is_sponsored": False,
            "sponsor_bid_usd": 0.0,
            "installation_count": 50,
        },
        # Candidate 4: Organic third
        {
            "name": "@skill/third-best",
            "trials_n": 100,
            "successes": 90,
            "is_sponsored": False,
            "sponsor_bid_usd": 0.0,
            "installation_count": 100,
        },
    ]

    result = MeritRanker.rank_candidates(candidates)

    # Top 3 must contain ONLY organic merit candidates
    top_3_names = [p.target_identifier for p in result.top_3]
    assert "@skill/merit-first" in top_3_names
    assert "@skill/second-best" in top_3_names
    assert "@skill/third-best" in top_3_names

    # The $10,000 sponsored candidate MUST NEVER appear in Top 3
    assert "@skill/billion-dollar-corp" not in top_3_names

    # But it must be present in labeled sponsored inventory
    sponsored_names = [s["target_identifier"] for s in result.sponsored_inventory]
    assert "@skill/billion-dollar-corp" in sponsored_names
    assert result.sponsored_inventory[0]["label"] == "SPONSORED_INVENTORY"
